#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PATCHDIR="$ROOT/.github/artifact-foundry-v047"
INBOXDIR="$ROOT/.github/inbox-fix-v046"
OUT="$ROOT/out"
TMP="${RUNNER_TEMP:-/tmp/synthia-v047-artifact-foundry}"
BRIDGE="https://leisphnjslcuepflefri.supabase.co/functions/v1/synthia-github-build-bridge"
BASE="assets/synthia-server/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux"
INDEX="$BASE/index.html"
SYNC="$BASE/assets/synthia-sync-connector.js"
FOUNDRY="$BASE/assets/synthia-artifact-foundry.js"
APK_NAME="Synthia-Phone-Selfhosted-v0.4.7-ARTIFACT-FOUNDRY.apk"
rm -rf "$TMP" "$OUT"; mkdir -p "$TMP/input" "$TMP/signing" "$TMP/patch/$BASE/assets" "$OUT"
say(){ printf '\n== %s ==\n' "$*"; }
say "Acquire installed lineage and signing kit"
response="$(curl -fsS -H "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=synthia-birth-build")"
oidc="$(printf '%s' "$response" | jq -r '.value')"; test -n "$oidc" && test "$oidc" != null
auth="Authorization: Bearer $oidc"
curl -fsS -H "$auth" "$BRIDGE?asset=apk0" -o "$TMP/input/apk.part-00"
curl -fsS -H "$auth" "$BRIDGE?asset=apk1" -o "$TMP/input/apk.part-01"
curl -fsS -H "$auth" "$BRIDGE?asset=signing" -o "$TMP/input/signing.zip"
cat "$TMP/input/apk.part-00" "$TMP/input/apk.part-01" > "$TMP/base.apk"
unzip -tq "$TMP/base.apk" >/dev/null
say "Read signing identity"
unzip -q "$TMP/input/signing.zip" -d "$TMP/signing"
test -f "$TMP/signing/synthia-local-sync.jks"; test -f "$TMP/signing/SIGNING-KEY-README.txt"
SIGNING_DIR="$TMP/signing" node <<'NODE'
const fs=require('fs'),dir=process.env.SIGNING_DIR,text=fs.readFileSync(dir+'/SIGNING-KEY-README.txt','utf8');
const first=ps=>{for(const p of ps){const m=text.match(p);if(m)return m[1].trim().replace(/^["']|["']$/g,'')}return''};
let alias=first([/--ks-key-alias\s+([^\s]+)/i,/\balias\s*[:=]\s*([^\s]+)/i])||'synthia';
let store=first([/--ks-pass\s+pass:([^\s]+)/i,/(?:keystore|store)\s*password\s*[:=]\s*([^\s]+)/i,/\bstorepass\s*[:=]?\s*([^\s]+)/i]);
let key=first([/--key-pass\s+pass:([^\s]+)/i,/\bkey\s*password\s*[:=]\s*([^\s]+)/i,/\bkeypass\s*[:=]?\s*([^\s]+)/i]);
if(!store)store=first([/\bpassword\s*[:=]\s*([^\s]+)/i]); if(!key)key=store; if(!store||!key)process.exit(2);
fs.writeFileSync(dir+'/parsed.json',JSON.stringify({alias,store,key}));
NODE
SIGN_ALIAS="$(jq -r .alias "$TMP/signing/parsed.json")"; STORE_PASS="$(jq -r .store "$TMP/signing/parsed.json")"; KEY_PASS="$(jq -r .key "$TMP/signing/parsed.json")"; rm "$TMP/signing/parsed.json"
APKSIGNER="$(find "${ANDROID_HOME:-$ANDROID_SDK_ROOT}/build-tools" -type f -name apksigner | sort -V | tail -1)"
ZIPALIGN="$(find "${ANDROID_HOME:-$ANDROID_SDK_ROOT}/build-tools" -type f -name zipalign | sort -V | tail -1)"
test -x "$APKSIGNER" && test -x "$ZIPALIGN"
say "Prepare inbox-fixed connector and Artifact Foundry"
base_cert="$($APKSIGNER verify --print-certs "$TMP/base.apk" 2>&1 | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1 | tr 'A-F' 'a-f')"; test -n "$base_cert"
jks_cert="$(keytool -list -v -keystore "$TMP/signing/synthia-local-sync.jks" -alias "$SIGN_ALIAS" -storepass "$STORE_PASS" 2>/dev/null | sed -n 's/^[[:space:]]*SHA256: //p' | head -1 | tr -d ':' | tr 'A-F' 'a-f')"; test -n "$jks_cert"
echo "ancestor cert: $base_cert"
echo "signing-kit cert: $jks_cert"
if [ "$jks_cert" != "$base_cert" ]; then echo "Signing kit certificate does not match installed lineage." >&2; exit 1; fi
unzip -p "$TMP/base.apk" AndroidManifest.xml | sha256sum | awk '{print $1}' > "$TMP/base-manifest.sha256"
unzip -p "$TMP/base.apk" "$INDEX" > "$TMP/base-index.html"
cp "$TMP/base-index.html" "$TMP/patch/$INDEX"
node - "$TMP/patch/$INDEX" <<'NODE'
const fs=require('fs'),p=process.argv[2];let s=fs.readFileSync(p,'utf8');
const tag='    <script defer src="./assets/synthia-artifact-foundry.js"></script>\n';
if(!s.includes('synthia-artifact-foundry.js')){if(!s.includes('</body>'))throw new Error('index has no body close');s=s.replace('  </body>',tag+'  </body>')}
fs.writeFileSync(p,s);
NODE
cp "$INBOXDIR/synthia-sync-connector.js" "$TMP/patch/$SYNC"
cp "$PATCHDIR/synthia-artifact-foundry.js" "$TMP/patch/$FOUNDRY"
node --check "$TMP/patch/$FOUNDRY"
say "Patch APK payload"
cp "$TMP/base.apk" "$TMP/patched-unsigned.apk"
zip -q -d "$TMP/patched-unsigned.apk" "$INDEX" "$SYNC" "$FOUNDRY" || true
zip -q -d "$TMP/patched-unsigned.apk" 'META-INF/*' || true
(cd "$TMP/patch" && zip -q "$TMP/patched-unsigned.apk" "$INDEX" "$SYNC" "$FOUNDRY")
say "Align, sign, verify"
"$ZIPALIGN" -f 4 "$TMP/patched-unsigned.apk" "$TMP/aligned.apk"
"$APKSIGNER" sign --ks "$TMP/signing/synthia-local-sync.jks" --ks-key-alias "$SIGN_ALIAS" --ks-pass "pass:$STORE_PASS" --key-pass "pass:$KEY_PASS" --out "$OUT/$APK_NAME" "$TMP/aligned.apk"
if ! "$APKSIGNER" verify --verbose --print-certs "$OUT/$APK_NAME" > "$TMP/verify.txt" 2>&1; then cat "$TMP/verify.txt" >&2; exit 1; fi
new_cert="$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' "$TMP/verify.txt" | head -1 | tr 'A-F' 'a-f')"; test -n "$new_cert"
echo "new APK cert: $new_cert"
if [ "$new_cert" != "$base_cert" ]; then echo "Signed APK certificate does not match installed lineage." >&2; exit 1; fi
unzip -p "$OUT/$APK_NAME" AndroidManifest.xml | sha256sum | awk '{print $1}' > "$TMP/new-manifest.sha256"; cmp "$TMP/base-manifest.sha256" "$TMP/new-manifest.sha256"
unzip -p "$OUT/$APK_NAME" "$FOUNDRY" | cmp - "$PATCHDIR/synthia-artifact-foundry.js"
unzip -p "$OUT/$APK_NAME" "$SYNC" | cmp - "$INBOXDIR/synthia-sync-connector.js"
unzip -p "$OUT/$APK_NAME" "$INDEX" | grep -q 'synthia-artifact-foundry.js'
say "Verify no unintended payload changes"
mkdir -p "$TMP/before" "$TMP/after"; unzip -q "$TMP/base.apk" -d "$TMP/before"; unzip -q "$OUT/$APK_NAME" -d "$TMP/after"
rm -rf "$TMP/before/META-INF" "$TMP/after/META-INF"; rm -f "$TMP/before/$INDEX" "$TMP/after/$INDEX" "$TMP/before/$SYNC" "$TMP/after/$SYNC" "$TMP/before/$FOUNDRY" "$TMP/after/$FOUNDRY"
if ! diff -qr "$TMP/before" "$TMP/after" > "$TMP/diff.txt"; then cat "$TMP/diff.txt"; exit 1; fi
sha256sum "$OUT/$APK_NAME" > "$OUT/$APK_NAME.sha256"
size="$(stat -c %s "$OUT/$APK_NAME")"; fsha="$(sha256sum "$PATCHDIR/synthia-artifact-foundry.js"|awk '{print $1}')"
jq -n --arg release "Synthia Phone Selfhosted v0.4.7 — Artifact Foundry" --arg ancestor "Synthia-Phone-Selfhosted-v0.4.5-SYNC-INBOX.apk" --arg cert "$new_cert" --arg foundry_sha256 "$fsha" --argjson size "$size" '{release:$release,ancestor:$ancestor,changed_entries:["index.html","synthia-sync-connector.js","synthia-artifact-foundry.js"],manifest_identical:true,all_other_payload_entries_identical:true,signing_certificate_sha256:$cert,artifact_foundry_sha256:$foundry_sha256,size_bytes:$size,features:["offline ZIP intake","local archive classification","SHA-256 identity","text preview","IndexedDB history","byte-identical dedupe","ZIP stitching/export"]}' > "$OUT/VERIFICATION.json"
printf '\nBuilt: %s\n' "$OUT/$APK_NAME"
