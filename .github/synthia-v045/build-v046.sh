#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"
PATCHDIR="$ROOT/.github/synthia-v045"
WRAPPER="$ROOT/android-r2116-wrapper"
OUTBASE="Synthia-Phone-Selfhosted-v0.4.6-BIRTH-CANDIDATE.apk"
BRIDGE="https://leisphnjslcuepflefri.supabase.co/functions/v1/synthia-github-build-bridge"
TMP="${RUNNER_TEMP:-/tmp/synthia-birth}"
mkdir -p "$TMP" "$ROOT/out"

say(){ printf '\n== %s ==\n' "$*"; }

say "Acquire current Synthai2"
rm -rf "$TMP/synthai2-current"
git clone --depth=1 https://github.com/justappgrabbin/Synthai2.git "$TMP/synthai2-current"
SYNTHAI2_SHA="$(git -C "$TMP/synthai2-current" rev-parse HEAD)"
printf '{"synthia_birth":"%s","synthai2":"%s","synthia_server":"%s"}\n' \
  "${GITHUB_SHA:-unknown}" "$SYNTHAI2_SHA" "a39bc304387097927f969fd5dd4818822705ed1e" > "$TMP/source-lineage.json"

say "Acquire short-lived private build assets"
response="$(curl -fsS -H "Authorization: bearer ${ACTIONS_ID_TOKEN_REQUEST_TOKEN}" "${ACTIONS_ID_TOKEN_REQUEST_URL}&audience=synthia-birth-build")"
oidc="$(printf '%s' "$response" | jq -r '.value')"
test -n "$oidc" && test "$oidc" != null
auth="Authorization: Bearer $oidc"
mkdir -p "$TMP/synthia-inputs"
curl -fsS -H "$auth" "$BRIDGE?asset=apk0" -o "$TMP/synthia-inputs/apk.part-00"
curl -fsS -H "$auth" "$BRIDGE?asset=apk1" -o "$TMP/synthia-inputs/apk.part-01"
curl -fsS -H "$auth" "$BRIDGE?asset=signing" -o "$TMP/synthia-inputs/signing.zip"
curl -fsS -H "$auth" "$BRIDGE?asset=phoneconfig" -o "$TMP/synthia-inputs/phone-sync-config.json"
cat "$TMP/synthia-inputs/apk.part-00" "$TMP/synthia-inputs/apk.part-01" > "$TMP/current.apk"
unzip -tq "$TMP/current.apk" >/dev/null

say "Read signing identity without exposing credentials"
rm -rf "$TMP/signing" && mkdir -p "$TMP/signing"
unzip -q "$TMP/synthia-inputs/signing.zip" -d "$TMP/signing"
test -f "$TMP/signing/synthia-local-sync.jks"
test -f "$TMP/signing/SIGNING-KEY-README.txt"
node <<'NODE' > "$TMP/signing/parsed.json"
const fs = require('fs');
const text = fs.readFileSync(process.env.RUNNER_TEMP + '/signing/SIGNING-KEY-README.txt','utf8');
const first = patterns => { for (const p of patterns) { const m=text.match(p); if(m) return m[1].trim().replace(/^['\"]|['\"]$/g,''); } return ''; };
let alias = first([/--ks-key-alias\s+([^\s]+)/i,/\balias\s*[:=]\s*([^\s]+)/i]) || 'synthia';
let store = first([/--ks-pass\s+pass:([^\s]+)/i,/(?:keystore|store)\s*password\s*[:=]\s*([^\s]+)/i,/\bstorepass\s*[:=]?\s*([^\s]+)/i]);
let key = first([/--key-pass\s+pass:([^\s]+)/i,/\bkey\s*password\s*[:=]\s*([^\s]+)/i,/\bkeypass\s*[:=]?\s*([^\s]+)/i]);
if (!store) store = first([/\bpassword\s*[:=]\s*([^\s]+)/i]);
if (!key) key = store;
if (!store) process.exit(2);
fs.writeFileSync(process.env.RUNNER_TEMP + '/signing/parsed.json', JSON.stringify({alias,store,key}));
NODE
SIGN_ALIAS="$(jq -r .alias "$TMP/signing/parsed.json")"
STORE_PASS="$(jq -r .store "$TMP/signing/parsed.json")"
KEY_PASS="$(jq -r .key "$TMP/signing/parsed.json")"
test -n "$SIGN_ALIAS" && test -n "$STORE_PASS" && test -n "$KEY_PASS"
KEY_CERT="$(keytool -list -v -keystore "$TMP/signing/synthia-local-sync.jks" -alias "$SIGN_ALIAS" -storepass "$STORE_PASS" 2>/dev/null | sed -n 's/^[[:space:]]*SHA256: //p' | head -1 | tr -d ':' | tr 'A-F' 'a-f')"
test -n "$KEY_CERT"
rm -f "$TMP/signing/parsed.json"

say "Detect Android update lineage"
AAPT="$(find "$ANDROID_HOME/build-tools" -type f -name aapt | sort -V | tail -1)"
APKSIGNER="$(find "$ANDROID_HOME/build-tools" -type f -name apksigner | sort -V | tail -1)"
ZIPALIGN="$(find "$ANDROID_HOME/build-tools" -type f -name zipalign | sort -V | tail -1)"
APKANALYZER="$(find "$ANDROID_HOME" -type f -name apkanalyzer 2>/dev/null | head -1 || true)"
test -x "$APKSIGNER" && test -x "$ZIPALIGN"
app_id=""; old_code=""
if test -n "$APKANALYZER" && test -x "$APKANALYZER"; then
  app_id="$($APKANALYZER manifest application-id "$TMP/current.apk" 2>/dev/null || true)"
  old_code="$($APKANALYZER manifest version-code "$TMP/current.apk" 2>/dev/null || true)"
fi
if { test -z "$app_id" || test -z "$old_code"; } && test -x "$AAPT"; then
  badging="$($AAPT dump badging "$TMP/current.apk" 2>/dev/null || true)"
  test -n "$app_id" || app_id="$(printf '%s\n' "$badging" | sed -n "s/^package: name='\([^']*\)'.*/\1/p" | head -1)"
  test -n "$old_code" || old_code="$(printf '%s\n' "$badging" | sed -n "s/^package:.*versionCode='\([^']*\)'.*/\1/p" | head -1)"
fi
if test -z "$app_id" || ! [[ "$old_code" =~ ^[0-9]+$ ]]; then
  echo "Unable to read current APK package/version" >&2
  test -x "$AAPT" && "$AAPT" dump badging "$TMP/current.apk" || true
  exit 1
fi
test "$app_id" = "com.synthia.phone"
SYNTHIA_APPLICATION_ID="$app_id"
SYNTHIA_OLD_VERSION_CODE="$old_code"
SYNTHIA_VERSION_CODE="$((old_code + 1))"
SYNTHIA_VERSION_NAME="0.4.6-birth-candidate.1"
echo "Android lineage: $SYNTHIA_APPLICATION_ID versionCode $SYNTHIA_OLD_VERSION_CODE -> $SYNTHIA_VERSION_CODE"

say "Build current Synthai2 UI"
pushd "$TMP/synthai2-current" >/dev/null
npm ci --ignore-scripts --no-audit --no-fund
NODE_ENV=production npx vite build --base=./
test -f dist/public/index.html
test -d dist/public/assets
popd >/dev/null

say "Extract and preserve current Synthia residence"
rm -rf "$TMP/residence-extract" "$TMP/residence"
mkdir -p "$TMP/residence-extract"
unzip -q "$TMP/current.apk" 'assets/synthia-server/*' -d "$TMP/residence-extract"
mv "$TMP/residence-extract/assets/synthia-server" "$TMP/residence"
test -f "$TMP/residence/server.js"
test -f "$TMP/residence/pure-synthia/runtime/daemon.mjs"
test -f "$TMP/residence/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux/index.html"

say "Mount current Synthai2 without erasing old residence"
ui="$TMP/residence/apps/synthia-sovereign-studio/dist/public/apps/synthai2"
rm -rf "$ui" && mkdir -p "$ui"
cp -a "$TMP/synthai2-current/dist/public/." "$ui/"
src="$TMP/residence/pure-synthia/donors/current/Synthai2"
rm -rf "$src" && mkdir -p "$src"
cp -a "$TMP/synthai2-current/client/src" "$src/client-src"
cp -a "$TMP/synthai2-current/server" "$src/server"
cp -a "$TMP/synthai2-current/shared" "$src/shared"
cp "$TMP/synthai2-current/package.json" "$TMP/synthai2-current/vite.config.ts" "$src/"
cp "$TMP/source-lineage.json" "$src/SOURCE_LINEAGE.json"
test -f "$ui/index.html"
test -f "$src/client-src/lib/humanDesignEngine.ts"

say "Repair local runtime, sync, message bus, and Synthai2 compatibility"
server="$TMP/residence/server.js"
node "$PATCHDIR/patch-server-v2.mjs" "$server" "$PATCHDIR"
node "$PATCHDIR/patch-embedded-node.mjs" "$server"
node "$PATCHDIR/patch-portable-js.mjs" "$server"
cp "$PATCHDIR/synthia-sync-connector.js" "$TMP/residence/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux/assets/synthia-sync-connector.js"
mkdir -p "$TMP/residence/config"
cp "$TMP/synthia-inputs/phone-sync-config.json" "$TMP/residence/config/phone-sync.json"
node "$PATCHDIR/collect-birth-donors.mjs" "$TMP/residence"
node - <<NODE
const fs=require('fs');
const p='$TMP/residence/package.json';
const j=JSON.parse(fs.readFileSync(p));
j.dependencies={...(j.dependencies||{}),'adm-zip':'^0.5.16'};
if (j.scripts) delete j.scripts.ingest;
fs.writeFileSync(p,JSON.stringify(j,null,2)+'\n');
NODE
grep -q "artifact.binary_ready" "$server"
grep -q "startPhoneSync" "$server"
grep -q "Synthia Phone Residence API" "$server"
! grep -q "function pythonInvocation" "$server"
! grep -q "spawn('bash'" "$server"
! grep -q "execFileSync('git'" "$server"
node --check "$server"

say "Bundle production dependencies"
pushd "$TMP/residence" >/dev/null
npm install --omit=dev --ignore-scripts --no-audit --no-fund
test -d node_modules/express
test -d node_modules/ws
test -d node_modules/cors
test -d node_modules/adm-zip

say "Run Pure Synthia verification"
node pure-synthia/tests/full-wiring.node.mjs
node pure-synthia/tests/durable-restart.node.mjs
node pure-synthia/tests/current-synthia-swarm.node.mjs
test -f pure-synthia/donors/recovered/MANIFEST.json
jq -e '.files | length >= 20' pure-synthia/donors/recovered/MANIFEST.json >/dev/null

say "Boot residence and exercise real local APIs"
export PORT=6969
export DATA_DIR="$TMP/synthia-smoke-data"
mkdir -p "$DATA_DIR"
node server.js > "$TMP/synthia-server.log" 2>&1 &
pid=$!
cleanup_server(){ kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; }
trap cleanup_server EXIT
ready=0
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:6969/api/health > "$TMP/health.json"; then ready=1; break; fi
  sleep 1
done
if test "$ready" != 1; then cat "$TMP/synthia-server.log"; exit 1; fi
jq -e '.status == "ok" and .local == true and .persistent == true' "$TMP/health.json" >/dev/null
curl -fsS http://127.0.0.1:6969/api/mesh/status | jq -e '.status == "online"' >/dev/null
curl -fsS -X POST -H 'Content-Type: application/json' \
  --data '{"path":"birth-test/state.txt","content":"persistent"}' \
  http://127.0.0.1:6969/api/workspace/files | jq -e '.success == true' >/dev/null
mounted="$(curl -fsS -X POST -H 'Content-Type: application/json' \
  --data '{"name":"birth-smoke","runCommand":"node hello.js","files":[{"path":"hello.js","content":"console.log(\"synthia-local-ok\")"}]}' \
  http://127.0.0.1:6969/api/apps/mount)"
mounted_id="$(printf '%s' "$mounted" | jq -r '.app.id')"
test -n "$mounted_id" && test "$mounted_id" != null
curl -fsS -X POST -H 'Content-Type: application/json' --data '{}' \
  "http://127.0.0.1:6969/api/apps/$mounted_id/run" > "$TMP/run.json"
jq -e '.success == true' "$TMP/run.json" >/dev/null
grep -q 'synthia-local-ok' "$TMP/run.json"
curl -fsS http://127.0.0.1:6969/studio/apps/synthai2/ | grep -Eqi '<html|<!doctype'
curl -fsS http://127.0.0.1:6969/mcp/status >/dev/null
cleanup_server
trap - EXIT
popd >/dev/null

say "Build checksummed residence payload"
rm -f "$TMP/synthia-v046.zip"
(cd "$TMP/residence" && zip -q -r "$TMP/synthia-v046.zip" . -x '*.git/*' '*.DS_Store')
unzip -tq "$TMP/synthia-v046.zip" >/dev/null
PAYLOAD_SHA="$(sha256sum "$TMP/synthia-v046.zip" | awk '{print $1}')"

say "Assemble embedded-Node Android wrapper"
app="$WRAPPER/app"
mkdir -p "$app/src/main/java/world/synthia/r2116" "$app/src/main/res/drawable" "$app/src/main/assets"
cp "$PATCHDIR/MainActivity.java" "$app/src/main/java/world/synthia/r2116/MainActivity.java"
sed -i 's#/studio/apps/mobile-linux/#/studio/apps/synthai2/#' "$app/src/main/java/world/synthia/r2116/MainActivity.java"
cp "$PATCHDIR/NodeRuntime.java" "$app/src/main/java/world/synthia/r2116/NodeRuntime.java"
cp "$PATCHDIR/SynthiaRuntimeService.java" "$app/src/main/java/world/synthia/r2116/SynthiaRuntimeService.java"
sed -i "s/@@PAYLOAD_SHA256@@/$PAYLOAD_SHA/g" "$app/src/main/java/world/synthia/r2116/SynthiaRuntimeService.java"
cp "$PATCHDIR/native-lib.cpp" "$app/src/main/cpp/native-lib.cpp"
cp "$PATCHDIR/AndroidManifest.xml" "$app/src/main/AndroidManifest.xml"
cp "$PATCHDIR/build.gradle" "$app/build.gradle"
cp "$PATCHDIR/wrapper-launcher.cjs" "$app/src/main/assets/wrapper-launcher.cjs"
cp "$TMP/synthia-v046.zip" "$app/src/main/assets/synthia-v045.zip"
rm -f "$app/src/main/assets/synthia-r21.16.zip"
if test -f "$TMP/residence/pure-synthia/extension/icon-512.png"; then
  cp "$TMP/residence/pure-synthia/extension/icon-512.png" "$app/src/main/res/drawable/synthia_icon.png"
else
  cp "$TMP/residence/apps/synthia-sovereign-studio/dist/public/icons/icon-512.png" "$app/src/main/res/drawable/synthia_icon.png"
fi

say "Compile Android release"
pushd "$WRAPPER" >/dev/null
chmod +x gradlew
SYNTHIA_APPLICATION_ID="$SYNTHIA_APPLICATION_ID" \
SYNTHIA_VERSION_CODE="$SYNTHIA_VERSION_CODE" \
SYNTHIA_VERSION_NAME="$SYNTHIA_VERSION_NAME" \
./gradlew :app:assembleRelease --no-daemon --stacktrace
test -f app/build/outputs/apk/release/app-release-unsigned.apk
popd >/dev/null

say "Align, sign, and verify update identity"
unsigned="$WRAPPER/app/build/outputs/apk/release/app-release-unsigned.apk"
aligned="$TMP/aligned.apk"
final="$TMP/$OUTBASE"
"$ZIPALIGN" -f -p 4 "$unsigned" "$aligned"
STORE_PASS="$STORE_PASS" KEY_PASS="$KEY_PASS" "$APKSIGNER" sign \
  --ks "$TMP/signing/synthia-local-sync.jks" \
  --ks-key-alias "$SIGN_ALIAS" \
  --ks-pass env:STORE_PASS \
  --key-pass env:KEY_PASS \
  --out "$final" "$aligned"
"$APKSIGNER" verify --verbose --print-certs "$final" >/dev/null
new_cert="$($APKSIGNER verify --print-certs "$final" 2>/dev/null | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -1 | tr -d ':' | tr 'A-F' 'a-f')"
test "$new_cert" = "$KEY_CERT"
final_badging="$($AAPT dump badging "$final")"
final_id="$(printf '%s\n' "$final_badging" | sed -n "s/^package: name='\([^']*\)'.*/\1/p" | head -1)"
final_code="$(printf '%s\n' "$final_badging" | sed -n "s/^package:.*versionCode='\([^']*\)'.*/\1/p" | head -1)"
test "$final_id" = "$SYNTHIA_APPLICATION_ID"
test "$final_code" = "$SYNTHIA_VERSION_CODE"
sha256sum "$final" > "$TMP/$OUTBASE.sha256"
jq -n \
  --arg artifact "$OUTBASE" \
  --arg application_id "$final_id" \
  --arg old_version_code "$SYNTHIA_OLD_VERSION_CODE" \
  --arg version_code "$final_code" \
  --arg version_name "$SYNTHIA_VERSION_NAME" \
  --arg payload_sha256 "$PAYLOAD_SHA" \
  --arg apk_sha256 "$(sha256sum "$final" | awk '{print $1}')" \
  --arg signer_sha256 "$new_cert" \
  --arg synthai2_sha "$SYNTHAI2_SHA" \
  --arg synthia_server_sha "a39bc304387097927f969fd5dd4818822705ed1e" \
  '{ok:true,artifact:$artifact,application_id:$application_id,old_version_code:$old_version_code,version_code:$version_code,version_name:$version_name,payload_sha256:$payload_sha256,apk_sha256:$apk_sha256,signer_sha256:$signer_sha256,synthai2_sha:$synthai2_sha,synthia_server_sha:$synthia_server_sha,checks:["current Synthai2 built","server lineage recorded","donor preservation","server syntax","Pure Synthia full wiring","durable restart","current swarm","local API boot","workspace persistence","mounted JS execution","Synthai2 UI served","MCP route answered","same package id","same signing key"]}' \
  > "$TMP/$OUTBASE.json"

say "Publish private birth candidate"
mkdir -p "$TMP/chunks"
rm -f "$TMP/chunks/$OUTBASE.part-"*
split -b 10m -d -a 2 "$final" "$TMP/chunks/$OUTBASE.part-"
for part in "$TMP/chunks/$OUTBASE.part-"*; do
  name="$(basename "$part")"
  curl -fsS -X POST -H "$auth" --data-binary @"$part" "$BRIDGE?name=$name" >/dev/null
done
curl -fsS -X POST -H "$auth" --data-binary @"$TMP/$OUTBASE.sha256" "$BRIDGE?name=$OUTBASE.sha256" >/dev/null
curl -fsS -X POST -H "$auth" -H 'Content-Type: application/json' --data-binary @"$TMP/$OUTBASE.json" "$BRIDGE?name=$OUTBASE.json" >/dev/null

cp "$final" "$ROOT/out/$OUTBASE"
cp "$TMP/$OUTBASE.sha256" "$ROOT/out/$OUTBASE.sha256"
cp "$TMP/$OUTBASE.json" "$ROOT/out/$OUTBASE.json"

echo "BIRTH_ARTIFACT=$OUTBASE" >> "${GITHUB_ENV:-/dev/null}"
say "Birth candidate built and verified"
