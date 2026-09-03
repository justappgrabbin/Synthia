#!/usr/bin/env bash
set -euo pipefail
ROOT="$(pwd)"
PATCHDIR="$ROOT/.github/front-wiring-v0472"
OUT="$ROOT/out"
APK="$OUT/Synthia-Phone-Selfhosted-v0.4.7.2-FRONTEND-WIRED.apk"
SHA_FILE="$APK.sha256"
VER="$OUT/VERIFICATION.json"
TMP="${RUNNER_TEMP:-/tmp}/synthia-v0472-refresh-stage"
BRIDGE="https://leisphnjslcuepflefri.supabase.co/functions/v1/synthia-github-build-bridge"
DEX="classes2.dex"
MARKER="assets/synthia-server/v472-refresh"
EXPECTED_CERT="8599183b1c8a934fb3ea01307769aeb578c65cb20f761923224e3533d64cf27b"

rm -rf "$TMP"
mkdir -p "$TMP/payload/assets/synthia-server" "$TMP/signing" "$TMP/before" "$TMP/after"
test -f "$APK" && test -f "$VER"
cp "$APK" "$TMP/pre-refresh.apk"
unzip -tq "$TMP/pre-refresh.apk" >/dev/null
unzip -p "$TMP/pre-refresh.apk" "$DEX" > "$TMP/payload/$DEX"
node "$PATCHDIR/patch-refresh-dex.mjs" "$TMP/payload/$DEX"
printf '%s\n' 'Synthia v0.4.7.2 installed payload refresh marker' > "$TMP/payload/$MARKER"
strings "$TMP/payload/$DEX" | grep -q '^v472-refresh$'
if strings "$TMP/payload/$DEX" | grep -q '^v048-refresh$'; then
  echo 'old v048 refresh marker still present in classes2.dex' >&2
  exit 1
fi

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
old_cert="$(cert_from_apk "$TMP/pre-refresh.apk")"
test "$old_cert" = "$EXPECTED_CERT"

cp "$TMP/pre-refresh.apk" "$TMP/patched-unsigned.apk"
zip -q -d "$TMP/patched-unsigned.apk" "$DEX" "$MARKER" || true
zip -q -d "$TMP/patched-unsigned.apk" 'META-INF/*' || true
(cd "$TMP/payload" && zip -q "$TMP/patched-unsigned.apk" "$DEX" "$MARKER")
"$ZIPALIGN" -f -p 4 "$TMP/patched-unsigned.apk" "$TMP/aligned.apk"
STORE_PASS="$STORE_PASS" KEY_PASS="$KEY_PASS" "$APKSIGNER" sign \
  --ks "$TMP/signing/synthia-local-sync.jks" --ks-key-alias "$SIGN_ALIAS" \
  --ks-pass env:STORE_PASS --key-pass env:KEY_PASS \
  --out "$TMP/final.apk" "$TMP/aligned.apk"
"$APKSIGNER" verify --verbose "$TMP/final.apk" >/dev/null
new_cert="$(cert_from_apk "$TMP/final.apk")"
test "$new_cert" = "$old_cert"
unzip -tq "$TMP/final.apk" >/dev/null
cmp <(unzip -p "$TMP/pre-refresh.apk" AndroidManifest.xml) <(unzip -p "$TMP/final.apk" AndroidManifest.xml)

unzip -q "$TMP/pre-refresh.apk" -d "$TMP/before"
unzip -q "$TMP/final.apk" -d "$TMP/after"
rm -rf "$TMP/before/META-INF" "$TMP/after/META-INF"
rm -f "$TMP/before/$DEX" "$TMP/after/$DEX" "$TMP/before/$MARKER" "$TMP/after/$MARKER"
if ! diff -qr "$TMP/before" "$TMP/after" > "$TMP/diff.txt"; then
  cat "$TMP/diff.txt"
  exit 1
fi
unzip -p "$TMP/final.apk" "$DEX" > "$TMP/final-classes2.dex"
strings "$TMP/final-classes2.dex" | grep -q '^v472-refresh$'
unzip -p "$TMP/final.apk" "$MARKER" | grep -q 'v0.4.7.2 installed payload refresh marker'

mv "$TMP/final.apk" "$APK"
sha256sum "$APK" > "$SHA_FILE"
size="$(stat -c %s "$APK")"
tmpver="$TMP/VERIFICATION.json"
jq --argjson size "$size" '
  .size_bytes=$size
  | .classes2_identical=false
  | .installed_payload_refresh="classes2.dex advances only the existing one-time extraction marker from v048-refresh to v472-refresh so phones already on v0.4.7.1 install the newly wired payload exactly once"
  | .repairs += ["force one-time installation of v0.4.7.2 payload over an already-extracted v0.4.7.1 residence"]
  | .changed_entries += ["classes2.dex","assets/synthia-server/v472-refresh"]
' "$VER" > "$tmpver"
mv "$tmpver" "$VER"
printf 'Installed-payload refresh verified; final APK: %s\n' "$APK"
