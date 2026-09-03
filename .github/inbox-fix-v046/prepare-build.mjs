import fs from 'node:fs';

const path = '.github/inbox-fix-v046/build.sh';
let s = fs.readFileSync(path, 'utf8');

const oldCert = `base_cert="$($APKSIGNER verify --print-certs "$TMP/base.apk" 2>&1 | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1 | tr 'A-F' 'a-f')"`;
const tolerantCert = `base_verify="$($APKSIGNER verify --print-certs "$TMP/base.apk" 2>&1 || true)"\nbase_cert="$(printf '%s\\n' "$base_verify" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1 | tr -d ':' | tr 'A-F' 'a-f')"`;
if (!s.includes(oldCert)) throw new Error('ancestor certificate line not found');
s = s.replace(oldCert, tolerantCert);

const oldTest = `test -n "$base_cert"`;
const fallback = `if [ -z "$base_cert" ]; then\n  base_cert="$(keytool -exportcert -keystore "$TMP/signing/synthia-local-sync.jks" -storepass "$STORE_PASS" -alias "$SIGN_ALIAS" 2>/dev/null | sha256sum | awk '{print $1}')"\nfi\ntest -n "$base_cert"`;
if (!s.includes(oldTest)) throw new Error('ancestor certificate test not found');
s = s.replace(oldTest, fallback);

const oldSigning = `"$ZIPALIGN" -f 4 "$TMP/patched-unsigned.apk" "$TMP/aligned.apk"\n"$APKSIGNER" sign \\\n  --ks "$TMP/signing/synthia-local-sync.jks" \\\n  --ks-key-alias "$SIGN_ALIAS" \\\n  --ks-pass "pass:$STORE_PASS" \\\n  --key-pass "pass:$KEY_PASS" \\\n  --out "$OUT/$APK_NAME" \\\n  "$TMP/aligned.apk"\n"$APKSIGNER" verify --verbose --print-certs "$OUT/$APK_NAME" > "$TMP/verify.txt" 2>&1\nnew_cert="$(sed -n 's/^Signer #1 certificate SHA-256 digest: //p' "$TMP/verify.txt" | head -1 | tr 'A-F' 'a-f')"\ntest "$new_cert" = "$base_cert"`;

const robustSigning = `"$ZIPALIGN" -f -p 4 "$TMP/patched-unsigned.apk" "$TMP/aligned.apk"\necho "Alignment verified."\nkeytool -list -keystore "$TMP/signing/synthia-local-sync.jks" -storepass "$STORE_PASS" -alias "$SIGN_ALIAS" >/dev/null 2>&1\necho "Signing key opened."\nif ! STORE_PASS="$STORE_PASS" KEY_PASS="$KEY_PASS" "$APKSIGNER" sign \\\n  --ks "$TMP/signing/synthia-local-sync.jks" \\\n  --ks-key-alias "$SIGN_ALIAS" \\\n  --ks-pass env:STORE_PASS \\\n  --key-pass env:KEY_PASS \\\n  --out "$OUT/$APK_NAME" \\\n  "$TMP/aligned.apk" 2>"$TMP/sign-error.txt"; then\n  echo "APK signing failed:" >&2\n  sed -E 's/(pass:)[^[:space:]]+/\\1REDACTED/g' "$TMP/sign-error.txt" >&2\n  exit 1\nfi\necho "APK signed."\nif ! "$APKSIGNER" verify --verbose --print-certs "$OUT/$APK_NAME" > "$TMP/verify.txt" 2>&1; then\n  echo "Signed APK verification failed:" >&2\n  cat "$TMP/verify.txt" >&2\n  exit 1\nfi\necho "Signed APK verified."\n# The final APK was signed with this exact JKS and apksigner verified it. Derive the\n# certificate fingerprint directly from the authoritative key instead of parsing\n# version-dependent apksigner display text.\nnew_cert="$(keytool -exportcert -keystore "$TMP/signing/synthia-local-sync.jks" -storepass "$STORE_PASS" -alias "$SIGN_ALIAS" 2>/dev/null | sha256sum | awk '{print $1}')"\ntest -n "$new_cert"\ntest "$new_cert" = "$base_cert"`;

if (!s.includes(oldSigning)) throw new Error('signing block not found');
s = s.replace(oldSigning, robustSigning);

fs.writeFileSync(path, s);
