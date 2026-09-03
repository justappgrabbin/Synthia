#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PATCHDIR="$ROOT/.github/inbox-fix-v046"
OUT="$ROOT/out"
TMP="${RUNNER_TEMP:-/tmp/synthia-v046-inbox-fix}"
BRIDGE="https://leisphnjslcuepflefri.supabase.co/functions/v1/synthia-github-build-bridge"
TARGET="assets/synthia-server/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux/assets/synthia-sync-connector.js"
APK_NAME="Synthia-Phone-Selfhosted-v0.4.6-INBOX-FIX.apk"

rm -rf "$TMP" "$OUT"
mkdir -p "$TMP/input" "$TMP/signing" "$TMP/patch/$(dirname "$TARGET")" "$OUT"

say(){ printf '\n== %s ==\n' "$*"; }

say "Acquire installed-lineage v0.4.5 APK and signing kit"
response="$(curl -fsS -H "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=synthia-birth-build")"
oidc="$(printf '%s' "$response" | jq -r '.value')"
test -n "$oidc" && test "$oidc" != null
auth="Authorization: Bearer $oidc"
curl -fsS -H "$auth" "$BRIDGE?asset=apk0" -o "$TMP/input/apk.part-00"
curl -fsS -H "$auth" "$BRIDGE?asset=apk1" -o "$TMP/input/apk.part-01"
curl -fsS -H "$auth" "$BRIDGE?asset=signing" -o "$TMP/input/signing.zip"
cat "$TMP/input/apk.part-00" "$TMP/input/apk.part-01" > "$TMP/base.apk"
unzip -tq "$TMP/base.apk" >/dev/null

say "Read signing identity"
unzip -q "$TMP/input/signing.zip" -d "$TMP/signing"
test -f "$TMP/signing/synthia-local-sync.jks"
test -f "$TMP/signing/SIGNING-KEY-README.txt"
SIGNING_DIR="$TMP/signing" node <<'NODE'
const fs = require('fs');
const dir = process.env.SIGNING_DIR;
const text = fs.readFileSync(dir + '/SIGNING-KEY-README.txt', 'utf8');
const first = patterns => { for (const p of patterns) { const m = text.match(p); if (m) return m[1].trim().replace(/^[\"']|[\"']$/g, ''); } return ''; };
let alias = first([/--ks-key-alias\s+([^\s]+)/i,/\balias\s*[:=]\s*([^\s]+)/i]) || 'synthia';
let store = first([/--ks-pass\s+pass:([^\s]+)/i,/(?:keystore|store)\s*password\s*[:=]\s*([^\s]+)/i,/\bstorepass\s*[:=]?\s*([^\s]+)/i]);
let key = first([/--key-pass\s+pass:([^\s]+)/i,/\bkey\s*password\s*[:=]\s*([^\s]+)/i,/\bkeypass\s*[:=]?\s*([^\s]+)/i]);
if (!store) store = first([/\bpassword\s*[:=]\s*([^\s]+)/i]);
if (!key) key = store;
if (!store || !key) process.exit(2);
fs.writeFileSync(dir + '/parsed.json', JSON.stringify({alias,store,key}));
NODE
SIGN_ALIAS="$(jq -r .alias "$TMP/signing/parsed.json")"
STORE_PASS="$(jq -r .store "$TMP/signing/parsed.json")"
KEY_PASS="$(jq -r .key "$TMP/signing/parsed.json")"
rm -f "$TMP/signing/parsed.json"

say "Locate Android signing tools"
APKSIGNER="$(find "${ANDROID_HOME:-$ANDROID_SDK_ROOT}/build-tools" -type f -name apksigner 2>/dev/null | sort -V | tail -1)"
ZIPALIGN="$(find "${ANDROID_HOME:-$ANDROID_SDK_ROOT}/build-tools" -type f -name zipalign 2>/dev/null | sort -V | tail -1)"
test -x "$APKSIGNER" && test -x "$ZIPALIGN"

say "Verify ancestor package and certificate"
base_cert="$($APKSIGNER verify --print-certs "$TMP/base.apk" 2>&1 | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1 | tr 'A-F' 'a-f')"
test -n "$base_cert"
unzip -p "$TMP/base.apk" AndroidManifest.xml | sha256sum | awk '{print $1}' > "$TMP/base-manifest.sha256"
unzip -p "$TMP/base.apk" "$TARGET" > "$TMP/original-connector.js"
test -s "$TMP/original-connector.js"

say "Patch only the Admin Inbox connector"
cp "$PATCHDIR/synthia-sync-connector.js" "$TMP/patch/$TARGET"
cp "$TMP/base.apk" "$TMP/patched-unsigned.apk"
zip -q -d "$TMP/patched-unsigned.apk" "$TARGET" || true
zip -q -d "$TMP/patched-unsigned.apk" 'META-INF/*' || true
(
  cd "$TMP/patch"
  zip -q "$TMP/patched-unsigned.apk" "$TARGET"
)

say "Align and sign with the installed Synthia key"
"$ZIPALIGN" -f 4 "$TMP/patched-unsigned.apk" "$TMP/aligned.apk"
"$APKSIGNER" sign \
  --ks "$TMP/signing/synthia-local-sync.jks" \
  --ks-key-alias "$SIGN_ALIAS" \
  --ks-pass "pass:$STORE_PASS" \
  --key-pass "pass:$KEY_PASS" \
  --out "$OUT/$APK_NAME" \
  "$TMP/aligned.apk"
"$APKSIGNER" verify --verbose --print-certs "$OUT/$APK_NAME" > "$TMP/verify.txt" 2>&1
new_cert="$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' "$TMP/verify.txt" | head -1 | tr 'A-F' 'a-f')"
test "$new_cert" = "$base_cert"

say "Prove only the intended payload entry changed"
unzip -p "$OUT/$APK_NAME" AndroidManifest.xml | sha256sum | awk '{print $1}' > "$TMP/new-manifest.sha256"
cmp "$TMP/base-manifest.sha256" "$TMP/new-manifest.sha256"
unzip -p "$OUT/$APK_NAME" "$TARGET" > "$TMP/final-connector.js"
cmp "$PATCHDIR/synthia-sync-connector.js" "$TMP/final-connector.js"
! cmp -s "$TMP/original-connector.js" "$TMP/final-connector.js"

after="$TMP/after"
before="$TMP/before"
mkdir -p "$before" "$after"
unzip -q "$TMP/base.apk" -d "$before"
unzip -q "$OUT/$APK_NAME" -d "$after"
rm -rf "$before/META-INF" "$after/META-INF"
rm -f "$before/$TARGET" "$after/$TARGET"
if ! diff -qr "$before" "$after" > "$TMP/entry-diff.txt"; then
  echo "Unexpected non-signature APK entry changes:" >&2
  cat "$TMP/entry-diff.txt" >&2
  exit 1
fi

say "Write verification files"
sha256sum "$OUT/$APK_NAME" > "$OUT/$APK_NAME.sha256"
size="$(stat -c %s "$OUT/$APK_NAME")"
base_size="$(stat -c %s "$TMP/base.apk")"
connector_sha="$(sha256sum "$PATCHDIR/synthia-sync-connector.js" | awk '{print $1}')"
jq -n \
  --arg release "Synthia Phone Selfhosted v0.4.6 — Inbox Fix" \
  --arg ancestor "Synthia-Phone-Selfhosted-v0.4.5-SYNC-INBOX.apk" \
  --arg target "$TARGET" \
  --arg cert "$new_cert" \
  --arg connector_sha256 "$connector_sha" \
  --argjson size "$size" \
  --argjson ancestor_size "$base_size" \
  '{release:$release,ancestor:$ancestor,changed_entry:$target,manifest_identical:true,all_other_payload_entries_identical:true,signing_certificate_sha256:$cert,connector_sha256:$connector_sha256,size_bytes:$size,ancestor_size_bytes:$ancestor_size}' \
  > "$OUT/VERIFICATION.json"

printf '\nBuilt and verified: %s\n' "$OUT/$APK_NAME"
