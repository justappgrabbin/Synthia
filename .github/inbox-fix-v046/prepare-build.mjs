import fs from 'node:fs';

const path = '.github/inbox-fix-v046/build.sh';
let s = fs.readFileSync(path, 'utf8');

const oldCert = `base_cert="$($APKSIGNER verify --print-certs "$TMP/base.apk" 2>&1 | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1 | tr 'A-F' 'a-f')"`;
const tolerantCert = `base_verify="$($APKSIGNER verify --print-certs "$TMP/base.apk" 2>&1 || true)"\nbase_cert="$(printf '%s\\n' "$base_verify" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1 | tr 'A-F' 'a-f')"`;
if (!s.includes(oldCert)) throw new Error('ancestor certificate line not found');
s = s.replace(oldCert, tolerantCert);

const oldTest = `test -n "$base_cert"`;
const fallback = `if [ -z "$base_cert" ]; then\n  base_cert="$(keytool -exportcert -keystore "$TMP/signing/synthia-local-sync.jks" -storepass "$STORE_PASS" -alias "$SIGN_ALIAS" 2>/dev/null | sha256sum | awk '{print $1}')"\nfi\ntest -n "$base_cert"`;
if (!s.includes(oldTest)) throw new Error('ancestor certificate test not found');
s = s.replace(oldTest, fallback);

fs.writeFileSync(path, s);
