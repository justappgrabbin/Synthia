#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
INBOXDIR="$ROOT/.github/inbox-fix-v046"
V047="$ROOT/.github/artifact-foundry-v047"
V045="$ROOT/.github/synthia-v045"
OUT="$ROOT/out"
TMP="${RUNNER_TEMP:-/tmp/synthia-v0471-backend-update}"
BRIDGE="https://leisphnjslcuepflefri.supabase.co/functions/v1/synthia-github-build-bridge"
RES="assets/synthia-server"
BASE="$RES/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux"
INDEX="$BASE/index.html"
SYNC="$BASE/assets/synthia-sync-connector.js"
FOUNDRY="$BASE/assets/synthia-artifact-foundry.js"
SERVER="$RES/server.js"
PHONECFG="$RES/config/phone-sync.json"
DEX="classes2.dex"
MARKER="$RES/v048-refresh"
APK_NAME="Synthia-Phone-Selfhosted-v0.4.7.1-BACKEND-UPDATE-SPINE.apk"
EXPECTED_CERT="8599183b1c8a934fb3ea01307769aeb578c65cb20f761923224e3533d64cf27b"

rm -rf "$TMP" "$OUT"
mkdir -p "$TMP/input" "$TMP/signing" "$TMP/current47/$BASE/assets" "$TMP/final/$BASE/assets" "$TMP/final/$RES/config" "$OUT"
say(){ printf '\n== %s ==\n' "$*"; }

say "Acquire installed lineage, signing kit, and phone sync config"
response="$(curl -fsS -H "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=synthia-birth-build")"
oidc="$(printf '%s' "$response" | jq -r '.value')"
[[ -n "$oidc" && "$oidc" != null ]]
auth="Authorization: Bearer $oidc"
curl -fsS -H "$auth" "$BRIDGE?asset=apk0" -o "$TMP/input/apk.part-00"
curl -fsS -H "$auth" "$BRIDGE?asset=apk1" -o "$TMP/input/apk.part-01"
curl -fsS -H "$auth" "$BRIDGE?asset=signing" -o "$TMP/input/signing.zip"
curl -fsS -H "$auth" "$BRIDGE?asset=phoneconfig" -o "$TMP/input/phone-sync-config.json"
cat "$TMP/input/apk.part-00" "$TMP/input/apk.part-01" > "$TMP/base.apk"
unzip -tq "$TMP/base.apk" >/dev/null
jq -e '.endpoint and .file_endpoint and .workspace_id and .token' "$TMP/input/phone-sync-config.json" >/dev/null

say "Verify update signing identity"
unzip -q "$TMP/input/signing.zip" -d "$TMP/signing"
test -f "$TMP/signing/synthia-local-sync.jks"
test -f "$TMP/signing/SIGNING-KEY-README.txt"
SIGNING_DIR="$TMP/signing" node <<'NODE'
const fs=require('fs'),dir=process.env.SIGNING_DIR,text=fs.readFileSync(dir+'/SIGNING-KEY-README.txt','utf8');
const first=ps=>{for(const p of ps){const m=text.match(p);if(m)return m[1].trim().replace(/^["']|["']$/g,'')}return''};
let alias=first([/--ks-key-alias\s+([^\s]+)/i,/\balias\s*[:=]\s*([^\s]+)/i])||'synthia';
let store=first([/--ks-pass\s+pass:([^\s]+)/i,/(?:keystore|store)\s*password\s*[:=]\s*([^\s]+)/i,/\bstorepass\s*[:=]?\s*([^\s]+)/i]);
let key=first([/--key-pass\s+pass:([^\s]+)/i,/\bkey\s*password\s*[:=]\s*([^\s]+)/i,/\bkeypass\s*[:=]?\s*([^\s]+)/i]);
if(!store)store=first([/\bpassword\s*[:=]\s*([^\s]+)/i]);
if(!key)key=store;
if(!store||!key)process.exit(2);
fs.writeFileSync(dir+'/parsed.json',JSON.stringify({alias,store,key}));
NODE
SIGN_ALIAS="$(jq -r .alias "$TMP/signing/parsed.json")"
STORE_PASS="$(jq -r .store "$TMP/signing/parsed.json")"
KEY_PASS="$(jq -r .key "$TMP/signing/parsed.json")"
rm "$TMP/signing/parsed.json"
APKSIGNER="$(find "${ANDROID_HOME:-$ANDROID_SDK_ROOT}/build-tools" -type f -name apksigner | sort -V | tail -1)"
ZIPALIGN="$(find "${ANDROID_HOME:-$ANDROID_SDK_ROOT}/build-tools" -type f -name zipalign | sort -V | tail -1)"
test -x "$APKSIGNER" && test -x "$ZIPALIGN"
cert_from_apk(){
  "$APKSIGNER" verify --print-certs "$1" 2>&1 \
    | grep -i -m1 'certificate SHA-256 digest:' \
    | sed -E 's/.*digest:[[:space:]]*//' \
    | tr -d ':[:space:]' \
    | tr 'A-F' 'a-f'
}
"$APKSIGNER" verify --verbose "$TMP/base.apk" >/dev/null
base_cert="$(cert_from_apk "$TMP/base.apk")"
key_cert="$(keytool -exportcert -keystore "$TMP/signing/synthia-local-sync.jks" -storepass "$STORE_PASS" -alias "$SIGN_ALIAS" 2>/dev/null | sha256sum | awk '{print $1}')"
[[ -n "$base_cert" && "$base_cert" == "$EXPECTED_CERT" ]]
[[ -n "$key_cert" && "$key_cert" == "$EXPECTED_CERT" ]]
echo "verified installed lineage and update signer"

say "Reconstruct current v0.4.7 payload exactly"
unzip -p "$TMP/base.apk" "$INDEX" > "$TMP/current47/$INDEX"
node - "$TMP/current47/$INDEX" <<'NODE'
const fs=require('fs'),p=process.argv[2];let s=fs.readFileSync(p,'utf8');
const tag='    <script defer src="./assets/synthia-artifact-foundry.js"></script>\n';
if(!s.includes('synthia-artifact-foundry.js')){
  if(!s.includes('</body>'))throw new Error('index has no body close');
  s=s.replace('  </body>',tag+'  </body>');
}
fs.writeFileSync(p,s);
NODE
cp "$INBOXDIR/synthia-sync-connector.js" "$TMP/current47/$SYNC"
cp "$V047/synthia-artifact-foundry.js" "$TMP/current47/$FOUNDRY"

say "Apply only backend + update-spine repair"
cp "$TMP/current47/$INDEX" "$TMP/final/$INDEX"
cp "$TMP/current47/$SYNC" "$TMP/final/$SYNC"
cp "$TMP/current47/$FOUNDRY" "$TMP/final/$FOUNDRY"
unzip -p "$TMP/base.apk" "$SERVER" > "$TMP/final/$SERVER"
cp "$TMP/input/phone-sync-config.json" "$TMP/final/$PHONECFG"
unzip -p "$TMP/base.apk" "$DEX" > "$TMP/final/$DEX"
printf '%s\n' 'Synthia backend payload refresh marker' > "$TMP/final/$MARKER"
node "$ROOT/.github/backend-hook-v048/patch-dex.mjs" "$TMP/final/$DEX"
strings "$TMP/final/$DEX" | grep -q '^v048-refresh$'
if strings "$TMP/final/$DEX" | grep -q '^package.json$'; then
  echo "Native refresh check still points at package.json" >&2
  exit 1
fi

node - "$TMP/final/$SYNC" <<'NODE'
const fs=require('fs'),p=process.argv[2];
let s=fs.readFileSync(p,'utf8');
const old='  async function local(path, options = {}) {\n    const response = await fetch(path, {';
const replacement='  const LOCAL_BACKEND = "http://127.0.0.1:3000";\n\n  async function local(path, options = {}) {\n    const target = location.protocol === "file:" ? LOCAL_BACKEND + path : path;\n    const response = await fetch(target, {';
if(!s.includes(old)) throw new Error('connector fetch anchor not found');
s=s.replace(old,replacement);
fs.writeFileSync(p,s);
NODE
node "$V045/patch-server-v2.mjs" "$TMP/final/$SERVER" "$V045"

node --check "$TMP/final/$SYNC"
node --check "$TMP/final/$FOUNDRY"
node --check "$TMP/final/$SERVER"
grep -q 'http://127.0.0.1:3000' "$TMP/final/$SYNC"
grep -q "app.get('/sync/status'" "$TMP/final/$SERVER"
grep -q "app.post('/sync/poll'" "$TMP/final/$SERVER"
grep -q "app.get('/sync/notifications'" "$TMP/final/$SERVER"
grep -q 'synthia_get_updates' "$TMP/final/$SERVER"
grep -q 'artifact.binary_ready' "$TMP/final/$SERVER"
grep -q 'startPhoneSync' "$TMP/final/$SERVER"

say "Patch APK while preserving package identity"
unzip -p "$TMP/base.apk" AndroidManifest.xml | sha256sum | awk '{print $1}' > "$TMP/base-manifest.sha256"
cp "$TMP/base.apk" "$TMP/patched-unsigned.apk"
zip -q -d "$TMP/patched-unsigned.apk" "$INDEX" "$SYNC" "$FOUNDRY" "$SERVER" "$PHONECFG" "$DEX" "$MARKER" || true
zip -q -d "$TMP/patched-unsigned.apk" 'META-INF/*' || true
(
  cd "$TMP/final"
  zip -q "$TMP/patched-unsigned.apk" "$INDEX" "$SYNC" "$FOUNDRY" "$SERVER" "$PHONECFG" "$DEX" "$MARKER"
)
"$ZIPALIGN" -f -p 4 "$TMP/patched-unsigned.apk" "$TMP/aligned.apk"
STORE_PASS="$STORE_PASS" KEY_PASS="$KEY_PASS" "$APKSIGNER" sign \
  --ks "$TMP/signing/synthia-local-sync.jks" --ks-key-alias "$SIGN_ALIAS" \
  --ks-pass env:STORE_PASS --key-pass env:KEY_PASS \
  --out "$OUT/$APK_NAME" "$TMP/aligned.apk"
"$APKSIGNER" verify --verbose "$OUT/$APK_NAME" >/dev/null
new_cert="$(cert_from_apk "$OUT/$APK_NAME")"
[[ -n "$new_cert" && "$new_cert" == "$EXPECTED_CERT" && "$new_cert" == "$base_cert" ]]
unzip -p "$OUT/$APK_NAME" AndroidManifest.xml | sha256sum | awk '{print $1}' > "$TMP/new-manifest.sha256"
cmp "$TMP/base-manifest.sha256" "$TMP/new-manifest.sha256"

say "Verify v0.4.7 UI/Foundry unchanged and backend spine connected"
unzip -p "$OUT/$APK_NAME" "$INDEX" | cmp - "$TMP/current47/$INDEX"
unzip -p "$OUT/$APK_NAME" "$FOUNDRY" | cmp - "$TMP/current47/$FOUNDRY"
unzip -p "$OUT/$APK_NAME" "$SYNC" | grep -q 'http://127.0.0.1:3000'
unzip -p "$OUT/$APK_NAME" "$SERVER" | grep -q 'synthia_get_updates'
unzip -p "$OUT/$APK_NAME" "$SERVER" | grep -q 'artifact.binary_ready'
unzip -p "$OUT/$APK_NAME" "$PHONECFG" | jq -e '.workspace_id and .token' >/dev/null
unzip -p "$OUT/$APK_NAME" "$DEX" > "$TMP/final-classes2.dex"
strings "$TMP/final-classes2.dex" | grep -q '^v048-refresh$'
unzip -p "$OUT/$APK_NAME" "$MARKER" | grep -q 'backend payload refresh marker'

mkdir -p "$TMP/ref47" "$TMP/after"
unzip -q "$TMP/base.apk" -d "$TMP/ref47"
unzip -q "$OUT/$APK_NAME" -d "$TMP/after"
rm -rf "$TMP/ref47/META-INF" "$TMP/after/META-INF"
cp "$TMP/current47/$INDEX" "$TMP/ref47/$INDEX"
cp "$TMP/current47/$SYNC" "$TMP/ref47/$SYNC"
cp "$TMP/current47/$FOUNDRY" "$TMP/ref47/$FOUNDRY"
for allowed in "$SYNC" "$SERVER" "$PHONECFG" "$DEX" "$MARKER"; do
  rm -f "$TMP/ref47/$allowed" "$TMP/after/$allowed"
done
if ! diff -qr "$TMP/ref47" "$TMP/after" > "$TMP/diff.txt"; then
  cat "$TMP/diff.txt"
  exit 1
fi

sha256sum "$OUT/$APK_NAME" > "$OUT/$APK_NAME.sha256"
size="$(stat -c %s "$OUT/$APK_NAME")"
connector_sha="$(sha256sum "$TMP/final/$SYNC" | awk '{print $1}')"
server_sha="$(sha256sum "$TMP/final/$SERVER" | awk '{print $1}')"
jq -n \
  --arg release "Synthia Phone Selfhosted v0.4.7.1 — Backend + Update Spine" \
  --arg ancestor "Synthia-Phone-Selfhosted-v0.4.7-ARTIFACT-FOUNDRY.apk" \
  --arg cert "$new_cert" \
  --arg connector_sha256 "$connector_sha" \
  --arg server_sha256 "$server_sha" \
  --argjson size "$size" \
  '{release:$release,ancestor:$ancestor,manifest_identical:true,signing_certificate_sha256:$cert,size_bytes:$size,new_changes_relative_to_v047:["file-origin sync requests now target http://127.0.0.1:3000","real /sync backend routes restored","phone sync/update configuration installed","background update polling enabled","downloaded update files SHA-256 verified before inbox admission","one-time installed-backend extraction refresh enabled"],unchanged_from_v047:["visible v0.4.7 shell","Artifact Foundry","bundled Linux rootfs"],backend_refresh_note:"classes2.dex changes only the extraction marker so the repaired backend is installed once",changed_entries_relative_to_v047:["synthia-sync-connector.js","server.js","config/phone-sync.json","classes2.dex","assets/synthia-server/v048-refresh"],connector_sha256:$connector_sha256,server_sha256:$server_sha256}' > "$OUT/VERIFICATION.json"
printf '\nBuilt: %s\n' "$OUT/$APK_NAME"
