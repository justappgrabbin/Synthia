import fs from 'node:fs';

const path = '.github/backend-update-v0471/build.sh';
let s = fs.readFileSync(path, 'utf8');

// The private phone sync config's credential field is `token`.
s = s.replaceAll('.workspace_token', '.token');

const vars = 'PHONECFG="$RES/config/phone-sync.json"';
if (!s.includes(vars)) throw new Error('phone config variable anchor missing');
s = s.replace(vars, `${vars}\nDEX="classes2.dex"\nMARKER="$RES/v048-refresh"`);

const configCopy = 'cp "$TMP/input/phone-sync-config.json" "$TMP/final/$PHONECFG"';
if (!s.includes(configCopy)) throw new Error('config copy anchor missing');
s = s.replace(configCopy, `${configCopy}\nunzip -p "$TMP/base.apk" "$DEX" > "$TMP/final/$DEX"\nprintf '%s\\n' 'Synthia backend payload refresh marker' > "$TMP/final/$MARKER"\nnode "$ROOT/.github/backend-hook-v048/patch-dex.mjs" "$TMP/final/$DEX"\nstrings "$TMP/final/$DEX" | grep -q '^v048-refresh$'\nif strings "$TMP/final/$DEX" | grep -q '^package.json$'; then echo "Native refresh check still points at package.json" >&2; exit 1; fi`);

const zipDelete = 'zip -q -d "$TMP/patched-unsigned.apk" "$INDEX" "$SYNC" "$FOUNDRY" "$SERVER" "$PHONECFG" || true';
if (!s.includes(zipDelete)) throw new Error('zip delete anchor missing');
s = s.replace(zipDelete, 'zip -q -d "$TMP/patched-unsigned.apk" "$INDEX" "$SYNC" "$FOUNDRY" "$SERVER" "$PHONECFG" "$DEX" "$MARKER" || true');

const zipAdd = '(cd "$TMP/final" && zip -q "$TMP/patched-unsigned.apk" "$INDEX" "$SYNC" "$FOUNDRY" "$SERVER" "$PHONECFG")';
if (!s.includes(zipAdd)) throw new Error('zip add anchor missing');
s = s.replace(zipAdd, '(cd "$TMP/final" && zip -q "$TMP/patched-unsigned.apk" "$INDEX" "$SYNC" "$FOUNDRY" "$SERVER" "$PHONECFG" "$DEX" "$MARKER")');

const actualConfigVerify = 'unzip -p "$OUT/$APK_NAME" "$PHONECFG" | jq -e \'.workspace_id and .token\' >/dev/null';
if (!s.includes(actualConfigVerify)) throw new Error('config verification anchor missing');
s = s.replace(actualConfigVerify, `${actualConfigVerify}\nunzip -p "$OUT/$APK_NAME" "$DEX" > "$TMP/final-classes2.dex"\nstrings "$TMP/final-classes2.dex" | grep -q '^v048-refresh$'\nunzip -p "$OUT/$APK_NAME" "$MARKER" | grep -q 'backend payload refresh marker'`);

const diffRemoval = 'rm -f "$TMP/ref47/$PHONECFG" "$TMP/after/$PHONECFG"';
if (!s.includes(diffRemoval)) throw new Error('diff removal anchor missing');
s = s.replace(diffRemoval, `${diffRemoval}\nrm -f "$TMP/ref47/$DEX" "$TMP/after/$DEX"\nrm -f "$TMP/ref47/$MARKER" "$TMP/after/$MARKER"`);

const changed = 'changed_entries_relative_to_v047:["synthia-sync-connector.js","server.js","config/phone-sync.json"]';
if (!s.includes(changed)) throw new Error('verification changed-entry anchor missing');
s = s.replace(changed, 'changed_entries_relative_to_v047:["synthia-sync-connector.js","server.js","config/phone-sync.json","classes2.dex","assets/synthia-server/v048-refresh"]');

const unchanged = 'unchanged_from_v047:["visible v0.4.7 shell","Artifact Foundry","native Android runtime","bundled Linux rootfs"]';
if (!s.includes(unchanged)) throw new Error('verification unchanged anchor missing');
s = s.replace(unchanged, 'unchanged_from_v047:["visible v0.4.7 shell","Artifact Foundry","bundled Linux rootfs"],backend_refresh_note:"classes2.dex changes only the extraction marker so the repaired backend is installed once"');

fs.writeFileSync(path, s);
console.log('prepared one-time installed-backend refresh without changing the visible 4.7 shell');
