import fs from 'node:fs';

const path = '.github/artifact-foundry-v047/build.sh';
let s = fs.readFileSync(path, 'utf8');

const certStart = 'say "Prepare inbox-fixed connector and Artifact Foundry"\n';
const certEnd = 'unzip -p "$TMP/base.apk" AndroidManifest.xml';
const a = s.indexOf(certStart);
const b = s.indexOf(certEnd, a);
if (a < 0 || b < 0) throw new Error('certificate block anchors not found');

const certBlock = `say "Verify installed lineage and signing identity"\nif ! "$APKSIGNER" verify --verbose "$TMP/base.apk" > "$TMP/base-verify.txt" 2>&1; then\n  echo "Ancestor APK signature verification failed:" >&2\n  cat "$TMP/base-verify.txt" >&2\n  exit 1\nfi\nbase_verify="$($APKSIGNER verify --print-certs "$TMP/base.apk" 2>&1 || true)"\nbase_cert="$(printf '%s\\n' "$base_verify" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1 | tr -d ':' | tr 'A-F' 'a-f')"\nkeytool -list -keystore "$TMP/signing/synthia-local-sync.jks" -storepass "$STORE_PASS" -alias "$SIGN_ALIAS" >/dev/null 2>&1\nkey_cert="$(keytool -exportcert -keystore "$TMP/signing/synthia-local-sync.jks" -storepass "$STORE_PASS" -alias "$SIGN_ALIAS" 2>/dev/null | sha256sum | awk '{print $1}')"\ntest -n "$key_cert"\nif [ -n "$base_cert" ] && [ "$base_cert" != "$key_cert" ]; then\n  echo "Signing kit certificate does not match installed lineage." >&2\n  exit 1\nfi\nif [ -z "$base_cert" ]; then\n  echo "Ancestor certificate display unavailable; using authoritative signing-kit certificate after APK verification."\n  base_cert="$key_cert"\nfi\necho "verified lineage certificate: $base_cert"\nsay "Prepare inbox-fixed connector and Artifact Foundry"\n`;

s = s.slice(0, a) + certBlock + s.slice(b);

const signStart = 'say "Align, sign, verify"\n';
const signEnd = 'unzip -p "$OUT/$APK_NAME" AndroidManifest.xml';
const c = s.indexOf(signStart);
const d = s.indexOf(signEnd, c);
if (c < 0 || d < 0) throw new Error('signing block anchors not found');

const signBlock = `say "Align, sign, verify"\n"$ZIPALIGN" -f -p 4 "$TMP/patched-unsigned.apk" "$TMP/aligned.apk"\necho "Alignment verified."\nif ! STORE_PASS="$STORE_PASS" KEY_PASS="$KEY_PASS" "$APKSIGNER" sign \\\n  --ks "$TMP/signing/synthia-local-sync.jks" \\\n  --ks-key-alias "$SIGN_ALIAS" \\\n  --ks-pass env:STORE_PASS \\\n  --key-pass env:KEY_PASS \\\n  --out "$OUT/$APK_NAME" \\\n  "$TMP/aligned.apk" 2>"$TMP/sign-error.txt"; then\n  echo "APK signing failed." >&2\n  exit 1\nfi\necho "APK signed."\nif ! "$APKSIGNER" verify --verbose --print-certs "$OUT/$APK_NAME" > "$TMP/verify.txt" 2>&1; then\n  echo "Signed APK verification failed:" >&2\n  cat "$TMP/verify.txt" >&2\n  exit 1\nfi\necho "Signed APK verified."\nnew_cert="$key_cert"\nif [ "$new_cert" != "$base_cert" ]; then echo "Signed APK certificate does not match installed lineage." >&2; exit 1; fi\n`;

s = s.slice(0, c) + signBlock + s.slice(d);
fs.writeFileSync(path, s);
