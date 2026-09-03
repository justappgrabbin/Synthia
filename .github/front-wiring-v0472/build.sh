#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PATCHDIR="$ROOT/.github/front-wiring-v0472"
BASEBUILD="$ROOT/.github/backend-update-v0471/build.sh"
OUT="$ROOT/out"
TMP="${RUNNER_TEMP:-/tmp/synthia-v0472-front-wiring}"
BRIDGE="https://leisphnjslcuepflefri.supabase.co/functions/v1/synthia-github-build-bridge"
RES="assets/synthia-server"
BASE="$RES/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux"
SHELL="$BASE/assets/synthia-local.js"
SYNC="$BASE/assets/synthia-sync-connector.js"
FOUNDRY="$BASE/assets/synthia-artifact-foundry.js"
SERVER="$RES/server.js"
APK_NAME="Synthia-Phone-Selfhosted-v0.4.7.2-FRONTEND-WIRED.apk"
BASE_NAME="Synthia-Phone-Selfhosted-v0.4.7.1-BACKEND-UPDATE-SPINE.apk"
EXPECTED_CERT="8599183b1c8a934fb3ea01307769aeb578c65cb20f761923224e3533d64cf27b"
say(){ printf '\n== %s ==\n' "$*"; }

rm -rf "$TMP"
mkdir -p "$TMP/patch/$BASE/assets" "$TMP/signing" "$OUT"

say "Rebuild exact v0.4.7.1 working baseline"
chmod +x "$BASEBUILD"
"$BASEBUILD"
test -f "$OUT/$BASE_NAME"
cp "$OUT/$BASE_NAME" "$TMP/base-v0471.apk"
unzip -tq "$TMP/base-v0471.apk" >/dev/null

say "Acquire existing Synthia update signer"
response="$(curl -fsS -H "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=synthia-birth-build")"
oidc="$(printf '%s' "$response" | jq -r '.value')"
test -n "$oidc" && test "$oidc" != null
auth="Authorization: Bearer $oidc"
curl -fsS -H "$auth" "$BRIDGE?asset=signing" -o "$TMP/signing.zip"
unzip -q "$TMP/signing.zip" -d "$TMP/signing"
test -f "$TMP/signing/synthia-local-sync.jks"
test -f "$TMP/signing/SIGNING-KEY-README.txt"
SIGNING_DIR="$TMP/signing" node <<'NODE'
const fs=require('fs'),dir=process.env.SIGNING_DIR,text=fs.readFileSync(dir+'/SIGNING-KEY-README.txt','utf8');
const first=ps=>{for(const p of ps){const m=text.match(p);if(m)return m[1].trim().replace(/^["']|["']$/g,'')}return''};
let alias=first([/--ks-key-alias\s+([^\s]+)/i,/\balias\s*[:=]\s*([^\s]+)/i])||'synthia';
let store=first([/--ks-pass\s+pass:([^\s]+)/i,/(?:keystore|store)\s*password\s*[:=]\s*([^\s]+)/i,/\bstorepass\s*[:=]?\s*([^\s]+)/i]);
let key=first([/--key-pass\s+pass:([^\s]+)/i,/\bkey\s*password\s*[:=]\s*([^\s]+)/i,/\bkeypass\s*[:=]?\s*([^\s]+)/i]);
if(!store)store=first([/\bpassword\s*[:=]\s*([^\s]+)/i]); if(!key)key=store; if(!store||!key)process.exit(2);
fs.writeFileSync(dir+'/parsed.json',JSON.stringify({alias,store,key}));
NODE
SIGN_ALIAS="$(jq -r .alias "$TMP/signing/parsed.json")"
STORE_PASS="$(jq -r .store "$TMP/signing/parsed.json")"
KEY_PASS="$(jq -r .key "$TMP/signing/parsed.json")"
rm "$TMP/signing/parsed.json"
APKSIGNER="$(find "${ANDROID_HOME:-$ANDROID_SDK_ROOT}/build-tools" -type f -name apksigner | sort -V | tail -1)"
ZIPALIGN="$(find "${ANDROID_HOME:-$ANDROID_SDK_ROOT}/build-tools" -type f -name zipalign | sort -V | tail -1)"
test -x "$APKSIGNER" && test -x "$ZIPALIGN"
cert_from_apk(){ "$APKSIGNER" verify --print-certs "$1" 2>&1 | grep -i -m1 'certificate SHA-256 digest:' | sed -E 's/.*digest:[[:space:]]*//' | tr -d ':[:space:]' | tr 'A-F' 'a-f'; }
base_cert="$(cert_from_apk "$TMP/base-v0471.apk")"
key_cert="$(keytool -exportcert -keystore "$TMP/signing/synthia-local-sync.jks" -storepass "$STORE_PASS" -alias "$SIGN_ALIAS" 2>/dev/null | sha256sum | awk '{print $1}')"
test "$base_cert" = "$EXPECTED_CERT"
test "$key_cert" = "$EXPECTED_CERT"

say "Extract only the frontend/server entries being rewired"
unzip -p "$TMP/base-v0471.apk" "$SHELL" > "$TMP/patch/$SHELL"
unzip -p "$TMP/base-v0471.apk" "$FOUNDRY" > "$TMP/patch/$FOUNDRY"
unzip -p "$TMP/base-v0471.apk" "$SERVER" > "$TMP/patch/$SERVER"
cp "$PATCHDIR/synthia-sync-connector.js" "$TMP/patch/$SYNC"

say "Wire Synthia, Admin, Foundry and System settings"
node "$PATCHDIR/patch-shell.mjs" "$TMP/patch/$SHELL"
node "$PATCHDIR/patch-foundry.mjs" "$TMP/patch/$FOUNDRY"
node "$PATCHDIR/patch-server.mjs" "$TMP/patch/$SERVER"
node --check "$TMP/patch/$SHELL"
node --check "$TMP/patch/$SYNC"
node --check "$TMP/patch/$FOUNDRY"
node --check "$TMP/patch/$SERVER"
grep -q 'id:"synthia"' "$TMP/patch/$SHELL"
grep -q 'id:"admin"' "$TMP/patch/$SHELL"
grep -q 'id:"foundry"' "$TMP/patch/$SHELL"
grep -q 'o==="system"&&m.jsx(SY_SYSTEM_SETTINGS' "$TMP/patch/$SHELL"
grep -q "app.get('/api/synthia/status'" "$TMP/patch/$SERVER"
grep -q "app.post('/sync/control'" "$TMP/patch/$SERVER"
! grep -q 'synthia-admin-button' "$TMP/patch/$SYNC"
! grep -q "id:'saf-btn'" "$TMP/patch/$FOUNDRY"

say "Patch APK without changing v0.4.7.1 native layer"
rm -rf "$OUT" && mkdir -p "$OUT"
unzip -p "$TMP/base-v0471.apk" AndroidManifest.xml | sha256sum | awk '{print $1}' > "$TMP/base-manifest.sha256"
unzip -p "$TMP/base-v0471.apk" classes2.dex | sha256sum | awk '{print $1}' > "$TMP/base-classes2.sha256"
cp "$TMP/base-v0471.apk" "$TMP/patched-unsigned.apk"
zip -q -d "$TMP/patched-unsigned.apk" "$SHELL" "$SYNC" "$FOUNDRY" "$SERVER" || true
zip -q -d "$TMP/patched-unsigned.apk" 'META-INF/*' || true
(cd "$TMP/patch" && zip -q "$TMP/patched-unsigned.apk" "$SHELL" "$SYNC" "$FOUNDRY" "$SERVER")
"$ZIPALIGN" -f -p 4 "$TMP/patched-unsigned.apk" "$TMP/aligned.apk"
STORE_PASS="$STORE_PASS" KEY_PASS="$KEY_PASS" "$APKSIGNER" sign \
  --ks "$TMP/signing/synthia-local-sync.jks" --ks-key-alias "$SIGN_ALIAS" \
  --ks-pass env:STORE_PASS --key-pass env:KEY_PASS \
  --out "$OUT/$APK_NAME" "$TMP/aligned.apk"
"$APKSIGNER" verify --verbose "$OUT/$APK_NAME" >/dev/null
new_cert="$(cert_from_apk "$OUT/$APK_NAME")"
test "$new_cert" = "$base_cert"
unzip -tq "$OUT/$APK_NAME" >/dev/null
unzip -p "$OUT/$APK_NAME" AndroidManifest.xml | sha256sum | awk '{print $1}' > "$TMP/new-manifest.sha256"
unzip -p "$OUT/$APK_NAME" classes2.dex | sha256sum | awk '{print $1}' > "$TMP/new-classes2.sha256"
cmp "$TMP/base-manifest.sha256" "$TMP/new-manifest.sha256"
cmp "$TMP/base-classes2.sha256" "$TMP/new-classes2.sha256"

say "Verify no unintended payload changes"
mkdir -p "$TMP/before" "$TMP/after"
unzip -q "$TMP/base-v0471.apk" -d "$TMP/before"
unzip -q "$OUT/$APK_NAME" -d "$TMP/after"
rm -rf "$TMP/before/META-INF" "$TMP/after/META-INF"
for allowed in "$SHELL" "$SYNC" "$FOUNDRY" "$SERVER"; do rm -f "$TMP/before/$allowed" "$TMP/after/$allowed"; done
if ! diff -qr "$TMP/before" "$TMP/after" > "$TMP/diff.txt"; then cat "$TMP/diff.txt"; exit 1; fi

sha256sum "$OUT/$APK_NAME" > "$OUT/$APK_NAME.sha256"
size="$(stat -c %s "$OUT/$APK_NAME")"
shell_sha="$(sha256sum "$TMP/patch/$SHELL" | awk '{print $1}')"
server_sha="$(sha256sum "$TMP/patch/$SERVER" | awk '{print $1}')"
jq -n \
  --arg release "Synthia Phone Selfhosted v0.4.7.2 — Frontend Wired" \
  --arg ancestor "$BASE_NAME" \
  --arg cert "$new_cert" \
  --arg shell_sha256 "$shell_sha" \
  --arg server_sha256 "$server_sha" \
  --argjson size "$size" \
  '{release:$release,ancestor:$ancestor,manifest_identical:true,classes2_identical:true,signing_certificate_sha256:$cert,size_bytes:$size,repairs:["register Synthia in app tray","register Admin Inbox in app tray","register Artifact Foundry in app tray","remove global floating Admin button","remove floating Foundry launch button","implement Settings > System status screen","wire Synthia app to /synthia/public","expose /api/synthia/status","separate local backend/Pure Synthia/remote sync status","remote sync defaults OFF and is user-toggleable","preserve v0.4.7.1 backend/update spine"],changed_entries:["mobile-linux/assets/synthia-local.js","mobile-linux/assets/synthia-sync-connector.js","mobile-linux/assets/synthia-artifact-foundry.js","server.js"],shell_sha256:$shell_sha256,server_sha256:$server_sha256}' > "$OUT/VERIFICATION.json"
printf '\nBuilt: %s\n' "$OUT/$APK_NAME"
