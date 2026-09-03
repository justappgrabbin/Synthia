import fs from 'node:fs';

const [startFile, indexFile, syncFile] = process.argv.slice(2);
if (!startFile || !indexFile || !syncFile) throw new Error('usage: patch-web.mjs <synthia-start.html> <mobile-index.html> <sync-connector.js>');

let start = fs.readFileSync(startFile, 'utf8');
const oldConst = "    const LOCAL_SYNTHIA = 'file:///android_asset/synthia-server/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux/index.html';";
const newConst = `    const SERVER_SYNTHIA = 'http://127.0.0.1:3000/studio/apps/mobile-linux/';\n    const LOCAL_SYNTHIA = 'file:///android_asset/synthia-server/apps/synthia-sovereign-studio/dist/public/apps/mobile-linux/index.html';\n    let backendReady = false;\n    let handingOff = false;`;
if (!start.includes(oldConst)) throw new Error('launcher constant anchor missing');
start = start.replace(oldConst, newConst);

const oldEnter = `    function enterSynthia() {\n      location.href = LOCAL_SYNTHIA;\n    }`;
const newEnter = `    function enterSynthia() {\n      location.href = backendReady ? SERVER_SYNTHIA : LOCAL_SYNTHIA;\n    }\n\n    function handoffToBackend() {\n      if (handingOff) return;\n      handingOff = true;\n      location.replace(SERVER_SYNTHIA);\n    }`;
if (!start.includes(oldEnter)) throw new Error('launcher enter anchor missing');
start = start.replace(oldEnter, newEnter);

const oldReady = `        if (res.ok) {\n          const state = document.getElementById('state');\n          state.dataset.state = 'ready';\n          state.textContent = 'Linux backend is online';\n          document.getElementById('status').textContent = 'Local runtime ready on 127.0.0.1:3000';\n          return;\n        }`;
const newReady = `        if (res.ok) {\n          backendReady = true;\n          const state = document.getElementById('state');\n          state.dataset.state = 'ready';\n          state.textContent = 'Linux backend is online — connecting Synthia';\n          document.getElementById('status').textContent = 'Connected to local runtime on 127.0.0.1:3000';\n          setTimeout(handoffToBackend, 150);\n          return true;\n        }`;
if (!start.includes(oldReady)) throw new Error('launcher ready anchor missing');
start = start.replace(oldReady, newReady);

const oldTail = `    setInterval(checkBackend, 3500);\n    checkBackend();`;
const newTail = `    window.synthiaCheck = checkBackend;\n    setInterval(checkBackend, 1800);\n    checkBackend();`;
if (!start.includes(oldTail)) throw new Error('launcher polling anchor missing');
start = start.replace(oldTail, newTail);
fs.writeFileSync(startFile, start);

let index = fs.readFileSync(indexFile, 'utf8');
const syncTag = '    <script defer src="./assets/synthia-sync-connector.js"></script>';
const bridgeTag = '    <script defer src="./assets/synthia-backend-bridge.js"></script>';
if (!index.includes(syncTag)) throw new Error('mobile index sync tag missing');
if (!index.includes('synthia-backend-bridge.js')) index = index.replace(syncTag, `${bridgeTag}\n${syncTag}`);
fs.writeFileSync(indexFile, index);

let sync = fs.readFileSync(syncFile, 'utf8');
const oldFetch = `    const response = await fetch(path, {`;
const newFetch = `    const target = /^https?:\\/\\//i.test(path) ? path : \`http://127.0.0.1:3000\${String(path).startsWith('/') ? path : '/' + path}\`;\n    const response = await fetch(target, {`;
if (!sync.includes(oldFetch)) throw new Error('sync fetch anchor missing');
sync = sync.replace(oldFetch, newFetch);
fs.writeFileSync(syncFile, sync);
