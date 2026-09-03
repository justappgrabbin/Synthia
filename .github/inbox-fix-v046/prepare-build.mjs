import fs from 'node:fs';

const path = '.github/inbox-fix-v046/build.sh';
let s = fs.readFileSync(path, 'utf8');
const old = `base_cert="$($APKSIGNER verify --print-certs "$TMP/base.apk" 2>&1 | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1 | tr 'A-F' 'a-f')"`;
const replacement = `base_verify="$($APKSIGNER verify --print-certs "$TMP/base.apk" 2>&1 || true)"\nbase_cert="$(printf '%s\\n' "$base_verify" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1 | tr 'A-F' 'a-f')"`;
if (!s.includes(old)) throw new Error('ancestor certificate line not found');
s = s.replace(old, replacement);
fs.writeFileSync(path, s);
