import fs from 'node:fs';

const path = '.github/artifact-foundry-v047/build.sh';
let s = fs.readFileSync(path, 'utf8');

const afterInbox = 'INBOXDIR="$ROOT/.github/inbox-fix-v046"';
if (!s.includes(afterInbox)) throw new Error('INBOXDIR anchor missing');
s = s.replace(afterInbox, `${afterInbox}\nBACKENDDIR="$ROOT/.github/backend-hook-v048"`);

const oldName = 'APK_NAME="Synthia-Phone-Selfhosted-v0.4.7-ARTIFACT-FOUNDRY.apk"';
const newName = 'APK_NAME="Synthia-Phone-Selfhosted-v0.4.8-BACKEND-CONNECTED.apk"';
if (!s.includes(oldName)) throw new Error('APK name anchor missing');
s = s.replace(oldName, newName);

const prepAnchor = 'node --check "$TMP/patch/$FOUNDRY"';
if (!s.includes(prepAnchor)) throw new Error('Foundry check anchor missing');
const backendPrep = `
START="assets/synthia-start.html"
SERVER="assets/synthia-server/server.js"
PHONE_CONFIG="assets/synthia-server/config/phone-sync.json"
MARKER="assets/synthia-server/v048-refresh"
BRIDGE_JS="$BASE/assets/synthia-backend-bridge.js"
DEX="classes2.dex"
EXPECTED_WORKSPACE="44bce193-f68b-4c07-9013-77b6429d0351"
EXPECTED_PARTICIPANT="synthia-phone-v045"
mkdir -p "$TMP/patch/assets/synthia-server/config" "$TMP/patch/$BASE/assets"
unzip -p "$TMP/base.apk" "$START" > "$TMP/patch/$START"
unzip -p "$TMP/base.apk" "$SERVER" > "$TMP/patch/$SERVER"
unzip -p "$TMP/base.apk" "$DEX" > "$TMP/patch/$DEX"
cp "$BACKENDDIR/synthia-backend-bridge.js" "$TMP/patch/$BRIDGE_JS"
printf '%s\\n' 'Synthia backend payload refresh marker v0.4.8' > "$TMP/patch/$MARKER"
say "Restore backend sync routes"
node "$ROOT/.github/synthia-v045/patch-server-v2.mjs" "$TMP/patch/$SERVER" "$ROOT/.github/synthia-v045"
node --check "$TMP/patch/$SERVER"
grep -q "app.get('/sync/status'" "$TMP/patch/$SERVER"
grep -q "app.get('/sync/notifications'" "$TMP/patch/$SERVER"
grep -q "startPhoneSync();" "$TMP/patch/$SERVER"
say "Attach existing private phone sync configuration"
curl -fsS -H "$auth" "$BRIDGE?asset=phoneconfig" -o "$TMP/patch/$PHONE_CONFIG"
jq -e --arg workspace "$EXPECTED_WORKSPACE" --arg participant "$EXPECTED_PARTICIPANT" '.endpoint and .file_endpoint and .token and .workspace_id == $workspace and .participant_ref == $participant' "$TMP/patch/$PHONE_CONFIG" >/dev/null
chmod 600 "$TMP/patch/$PHONE_CONFIG"
echo "Phone sync configuration validated without printing credentials."
say "Wire UI to localhost backend"
node "$BACKENDDIR/patch-web.mjs" "$TMP/patch/$START" "$TMP/patch/$INDEX" "$TMP/patch/$SYNC"
node --check "$TMP/patch/$SYNC"
node --check "$TMP/patch/$BRIDGE_JS"
grep -q 'window.synthiaCheck = checkBackend' "$TMP/patch/$START"
grep -q 'http://127.0.0.1:3000/studio/apps/mobile-linux/' "$TMP/patch/$START"
grep -q 'synthia-backend-bridge.js' "$TMP/patch/$INDEX"
grep -q 'http://127.0.0.1:3000' "$TMP/patch/$SYNC"
say "Force one-time installed backend refresh"
node "$BACKENDDIR/patch-dex.mjs" "$TMP/patch/$DEX"
strings "$TMP/patch/$DEX" | grep -q '^v048-refresh$'
if strings "$TMP/patch/$DEX" | grep -q '^package.json$'; then echo "Native refresh check still points at package.json" >&2; exit 1; fi`;
s = s.replace(prepAnchor, `${prepAnchor}\n${backendPrep}`);

const oldPatch = `cp "$TMP/base.apk" "$TMP/patched-unsigned.apk"\nzip -q -d "$TMP/patched-unsigned.apk" "$INDEX" "$SYNC" "$FOUNDRY" || true\nzip -q -d "$TMP/patched-unsigned.apk" 'META-INF/*' || true\n(cd "$TMP/patch" && zip -q "$TMP/patched-unsigned.apk" "$INDEX" "$SYNC" "$FOUNDRY")`;
const newPatch = `cp "$TMP/base.apk" "$TMP/patched-unsigned.apk"\nfor entry in "$START" "$SERVER" "$PHONE_CONFIG" "$MARKER" "$INDEX" "$SYNC" "$BRIDGE_JS" "$FOUNDRY" "$DEX"; do zip -q -d "$TMP/patched-unsigned.apk" "$entry" || true; done\nzip -q -d "$TMP/patched-unsigned.apk" 'META-INF/*' || true\n(cd "$TMP/patch" && zip -q "$TMP/patched-unsigned.apk" "$START" "$SERVER" "$PHONE_CONFIG" "$MARKER" "$INDEX" "$SYNC" "$BRIDGE_JS" "$FOUNDRY" "$DEX")`;
if (!s.includes(oldPatch)) throw new Error('APK patch block missing');
s = s.replace(oldPatch, newPatch);

const oldSyncCheck = 'unzip -p "$OUT/$APK_NAME" "$SYNC" | cmp - "$INBOXDIR/synthia-sync-connector.js"';
const newSyncCheck = 'unzip -p "$OUT/$APK_NAME" "$SYNC" | cmp - "$TMP/patch/$SYNC"';
if (!s.includes(oldSyncCheck)) throw new Error('sync verification anchor missing');
s = s.replace(oldSyncCheck, newSyncCheck);

const indexCheck = `unzip -p "$OUT/$APK_NAME" "$INDEX" | grep -q 'synthia-artifact-foundry.js'`;
if (!s.includes(indexCheck)) throw new Error('index verification anchor missing');
const extraChecks = `
unzip -p "$OUT/$APK_NAME" "$INDEX" | grep -q 'synthia-backend-bridge.js'
unzip -p "$OUT/$APK_NAME" "$START" | grep -q 'window.synthiaCheck = checkBackend'
unzip -p "$OUT/$APK_NAME" "$START" | grep -q 'http://127.0.0.1:3000/studio/apps/mobile-linux/'
unzip -p "$OUT/$APK_NAME" "$SERVER" | node --check
unzip -p "$OUT/$APK_NAME" "$SERVER" | grep -q "app.get('/sync/status'"
unzip -p "$OUT/$APK_NAME" "$MARKER" | grep -q 'v0.4.8'
unzip -p "$OUT/$APK_NAME" "$PHONE_CONFIG" | jq -e --arg workspace "$EXPECTED_WORKSPACE" --arg participant "$EXPECTED_PARTICIPANT" '.token and .workspace_id == $workspace and .participant_ref == $participant' >/dev/null
unzip -p "$OUT/$APK_NAME" "$DEX" > "$TMP/final-classes2.dex"
strings "$TMP/final-classes2.dex" | grep -q '^v048-refresh$'`;
s = s.replace(indexCheck, `${indexCheck}\n${extraChecks}`);

const oldDiff = `rm -rf "$TMP/before/META-INF" "$TMP/after/META-INF"; rm -f "$TMP/before/$INDEX" "$TMP/after/$INDEX" "$TMP/before/$SYNC" "$TMP/after/$SYNC" "$TMP/before/$FOUNDRY" "$TMP/after/$FOUNDRY"`;
const newDiff = `rm -rf "$TMP/before/META-INF" "$TMP/after/META-INF"\nfor entry in "$START" "$SERVER" "$PHONE_CONFIG" "$MARKER" "$INDEX" "$SYNC" "$BRIDGE_JS" "$FOUNDRY" "$DEX"; do rm -f "$TMP/before/$entry" "$TMP/after/$entry"; done`;
if (!s.includes(oldDiff)) throw new Error('diff exclusion anchor missing');
s = s.replace(oldDiff, newDiff);

const oldMetaStart = `jq -n --arg release "Synthia Phone Selfhosted v0.4.7 — Artifact Foundry"`;
const metaIndex = s.indexOf(oldMetaStart);
if (metaIndex < 0) throw new Error('verification metadata anchor missing');
const metaEnd = s.indexOf('\nprintf', metaIndex);
if (metaEnd < 0) throw new Error('verification metadata end missing');
const newMeta = `jq -n --arg release "Synthia Phone Selfhosted v0.4.8 — Backend Connected" --arg ancestor "Synthia Phone Selfhosted v0.4.7 — Artifact Foundry" --arg cert "$new_cert" --arg foundry_sha256 "$fsha" --arg workspace "$EXPECTED_WORKSPACE" --arg participant "$EXPECTED_PARTICIPANT" --argjson size "$size" '{release:$release,ancestor:$ancestor,changed_entries:["classes2.dex","assets/synthia-start.html","assets/synthia-server/server.js","assets/synthia-server/config/phone-sync.json","assets/synthia-server/v048-refresh","assets/synthia-server/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux/index.html","assets/synthia-server/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux/assets/synthia-sync-connector.js","assets/synthia-server/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux/assets/synthia-backend-bridge.js","assets/synthia-server/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux/assets/synthia-artifact-foundry.js"],manifest_identical:true,all_other_payload_entries_identical:true,signing_certificate_sha256:$cert,artifact_foundry_sha256:$foundry_sha256,size_bytes:$size,workspace_id:$workspace,participant_ref:$participant,private_sync_config_embedded:true,features:["Artifact Foundry preserved","inbox fix preserved","native runtime autostart preserved","one-time installed backend refresh","launcher health handoff to localhost server","file-mode fallback upgrades to localhost when ready","sync connector explicitly targets localhost backend","durable /sync routes restored","existing private phone sync configuration installed"]}' > "$OUT/VERIFICATION.json"`;
s = s.slice(0, metaIndex) + newMeta + s.slice(metaEnd);

fs.writeFileSync(path, s);
const generated = s.split('\n');
for (let n = 106; n <= 114; n++) console.log(`v048 generated line ${n}: ${generated[n - 1] ?? ''}`);
console.log('prepared v0.4.8 backend-connected build on top of proven v0.4.7 signer');
