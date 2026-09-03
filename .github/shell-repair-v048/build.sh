#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PATCHDIR="$ROOT/.github/shell-repair-v048"
V045="$ROOT/.github/synthia-v045"
V047="$ROOT/.github/artifact-foundry-v047"
OUT="$ROOT/out"
TMP="${RUNNER_TEMP:-/tmp/synthia-v048-shell-repair}"
BRIDGE="https://leisphnjslcuepflefri.supabase.co/functions/v1/synthia-github-build-bridge"
RES="assets/synthia-server"
BASE="$RES/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux"
INDEX="$BASE/index.html"
SHELL="$BASE/assets/synthia-local.js"
SYNC="$BASE/assets/synthia-sync-connector.js"
FOUNDRY="$BASE/assets/synthia-artifact-foundry.js"
SERVER="$RES/server.js"
PHONECFG="$RES/config/phone-sync.json"
APK_NAME="Synthia-Phone-Selfhosted-v0.4.8-SHELL-REPAIR.apk"
rm -rf "$TMP" "$OUT"; mkdir -p "$TMP/input" "$TMP/signing" "$TMP/patch/$BASE/assets" "$TMP/patch/$RES/config" "$OUT"
say(){ printf '\n== %s ==\n' "$*"; }

say "Acquire installed lineage, signing kit, and phone sync config"
response="$(curl -fsS -H "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=synthia-birth-build")"
oidc="$(printf '%s' "$response" | jq -r '.value')"; test -n "$oidc" && test "$oidc" != null
auth="Authorization: Bearer $oidc"
curl -fsS -H "$auth" "$BRIDGE?asset=apk0" -o "$TMP/input/apk.part-00"
curl -fsS -H "$auth" "$BRIDGE?asset=apk1" -o "$TMP/input/apk.part-01"
curl -fsS -H "$auth" "$BRIDGE?asset=signing" -o "$TMP/input/signing.zip"
curl -fsS -H "$auth" "$BRIDGE?asset=phoneconfig" -o "$TMP/input/phone-sync-config.json"
cat "$TMP/input/apk.part-00" "$TMP/input/apk.part-01" > "$TMP/base.apk"
unzip -tq "$TMP/base.apk" >/dev/null

say "Read and verify signing identity"
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
"$APKSIGNER" verify --verbose "$TMP/base.apk" >/dev/null
base_cert="$($APKSIGNER verify --print-certs "$TMP/base.apk" 2>&1 | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1 | tr -d ':' | tr 'A-F' 'a-f')"
key_cert="$(keytool -exportcert -keystore "$TMP/signing/synthia-local-sync.jks" -storepass "$STORE_PASS" -alias "$SIGN_ALIAS" 2>/dev/null | sha256sum | awk '{print $1}')"
test -n "$base_cert" && test "$base_cert" = "$key_cert"
echo "verified update certificate: $base_cert"

say "Extract the exact payload entries being repaired"
unzip -p "$TMP/base.apk" "$INDEX" > "$TMP/patch/$INDEX"
unzip -p "$TMP/base.apk" "$SHELL" > "$TMP/patch/$SHELL"
unzip -p "$TMP/base.apk" "$SERVER" > "$TMP/patch/$SERVER"
cp "$TMP/input/phone-sync-config.json" "$TMP/patch/$PHONECFG"
cp "$PATCHDIR/synthia-sync-connector.js" "$TMP/patch/$SYNC"
cp "$V047/synthia-artifact-foundry.js" "$TMP/patch/$FOUNDRY"

say "Wire Synthia, Notifications, Foundry, and real sync backend"
node "$PATCHDIR/patch-shell.mjs" "$TMP/patch/$SHELL"
node "$PATCHDIR/patch-foundry.mjs" "$TMP/patch/$FOUNDRY"
node "$V045/patch-server-v2.mjs" "$TMP/patch/$SERVER" "$V045"
node --check "$TMP/patch/$SHELL"
node --check "$TMP/patch/$SYNC"
node --check "$TMP/patch/$FOUNDRY"
node --check "$TMP/patch/$SERVER"
grep -q "app.get('/sync/notifications'" "$TMP/patch/$SERVER"
grep -q 'id:"synthia"' "$TMP/patch/$SHELL"
grep -q 'id:"notifications"' "$TMP/patch/$SHELL"
! grep -q "synthia-admin-button" "$TMP/patch/$SYNC"
! grep -q "id:'saf-btn'" "$TMP/patch/$FOUNDRY"

node - "$TMP/patch/$INDEX" <<'NODE'
const fs=require('fs'),p=process.argv[2];let s=fs.readFileSync(p,'utf8');
const foundry='    <script defer src="./assets/synthia-artifact-foundry.js"></script>\n';
if(!s.includes('synthia-artifact-foundry.js')){if(!s.includes('</body>'))throw new Error('index has no body close');s=s.replace('  </body>',foundry+'  </body>')}
fs.writeFileSync(p,s);
NODE

say "Patch APK without changing native package identity"
unzip -p "$TMP/base.apk" AndroidManifest.xml | sha256sum | awk '{print $1}' > "$TMP/base-manifest.sha256"
cp "$TMP/base.apk" "$TMP/patched-unsigned.apk"
zip -q -d "$TMP/patched-unsigned.apk" "$INDEX" "$SHELL" "$SYNC" "$FOUNDRY" "$SERVER" "$PHONECFG" || true
zip -q -d "$TMP/patched-unsigned.apk" 'META-INF/*' || true
(cd "$TMP/patch" && zip -q "$TMP/patched-unsigned.apk" "$INDEX" "$SHELL" "$SYNC" "$FOUNDRY" "$SERVER" "$PHONECFG")
"$ZIPALIGN" -f -p 4 "$TMP/patched-unsigned.apk" "$TMP/aligned.apk"
STORE_PASS="$STORE_PASS" KEY_PASS="$KEY_PASS" "$APKSIGNER" sign \
  --ks "$TMP/signing/synthia-local-sync.jks" --ks-key-alias "$SIGN_ALIAS" \
  --ks-pass env:STORE_PASS --key-pass env:KEY_PASS \
  --out "$OUT/$APK_NAME" "$TMP/aligned.apk"
"$APKSIGNER" verify --verbose --print-certs "$OUT/$APK_NAME" > "$TMP/verify.txt"
new_cert="$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' "$TMP/verify.txt" | head -1 | tr -d ':' | tr 'A-F' 'a-f')"
test "$new_cert" = "$base_cert"
unzip -p "$OUT/$APK_NAME" AndroidManifest.xml | sha256sum | awk '{print $1}' > "$TMP/new-manifest.sha256"; cmp "$TMP/base-manifest.sha256" "$TMP/new-manifest.sha256"
unzip -p "$OUT/$APK_NAME" "$SERVER" | grep -q "app.get('/sync/notifications'"
unzip -p "$OUT/$APK_NAME" "$SHELL" | grep -q 'id:"synthia"'
unzip -p "$OUT/$APK_NAME" "$SHELL" | grep -q 'id:"notifications"'
unzip -p "$OUT/$APK_NAME" "$SYNC" | grep -q 'v0.4.8'

sha256sum "$OUT/$APK_NAME" > "$OUT/$APK_NAME.sha256"
size="$(stat -c %s "$OUT/$APK_NAME")"
jq -n --arg release "Synthia Phone Selfhosted v0.4.8 — Shell Repair" --arg ancestor "Synthia-Phone-Selfhosted-v0.4.5-SYNC-INBOX.apk" --arg cert "$new_cert" --argjson size "$size" '{release:$release,ancestor:$ancestor,manifest_identical:true,signing_certificate_sha256:$cert,size_bytes:$size,repairs:["mount Pure Synthia as tray app","replace floating notification control with tray app","restore /sync backend routes","install phone sync config","move Artifact Foundry into tray","remove both floating controls"],changed_entries:["mobile-linux/index.html","mobile-linux/assets/synthia-local.js","mobile-linux/assets/synthia-sync-connector.js","mobile-linux/assets/synthia-artifact-foundry.js","server.js","config/phone-sync.json"]}' > "$OUT/VERIFICATION.json"
printf '\nBuilt: %s\n' "$OUT/$APK_NAME"
