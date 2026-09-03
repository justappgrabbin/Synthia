import fs from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('server.js path required');
let src = fs.readFileSync(file, 'utf8');

function replace(find, replacement, label) {
  if (!src.includes(find)) throw new Error(`missing embedded-node anchor: ${label}`);
  src = src.replace(find, replacement);
}

replace(
  "const { pipeline } = require('stream/promises');\nconst os = require('os');",
  "const { pipeline } = require('stream/promises');\nconst { Worker } = require('worker_threads');\nconst os = require('os');",
  'worker import'
);

const oldStart = `function startPureSynthiaDaemon(){
  if (pureSynthiaStopping || pureSynthiaDaemon || !fs.existsSync(PURE_SYNTHIA_DAEMON)) return;
  ensureDir(PURE_SYNTHIA_STATE_DIR);
  pureSynthiaDaemon = spawn(process.execPath, [PURE_SYNTHIA_DAEMON], {
    cwd: PURE_SYNTHIA_DIR,
    env: { ...process.env, SYNTHIA_STATE_DIR: PURE_SYNTHIA_STATE_DIR },
    stdio: ['ignore', 'inherit', 'inherit']
  });
  console.log(\`   Pure Synthia daemon: pid \${pureSynthiaDaemon.pid}\`);
  pureSynthiaDaemon.on('exit', (code, signal) => {
    console.log(\`   Pure Synthia daemon exited: code=\${code} signal=\${signal || ''}\`);
    pureSynthiaDaemon = null;
    if (!pureSynthiaStopping) {
      clearTimeout(pureSynthiaRestartTimer);
      pureSynthiaRestartTimer = setTimeout(startPureSynthiaDaemon, 3000);
    }
  });
}

function stopPureSynthiaDaemon(){
  pureSynthiaStopping = true;
  clearTimeout(pureSynthiaRestartTimer);
  if (pureSynthiaDaemon && pureSynthiaDaemon.exitCode === null) pureSynthiaDaemon.kill('SIGTERM');
}`;

const newStart = `function startPureSynthiaDaemon(){
  if (pureSynthiaStopping || pureSynthiaDaemon || !fs.existsSync(PURE_SYNTHIA_DAEMON)) return;
  ensureDir(PURE_SYNTHIA_STATE_DIR);
  pureSynthiaDaemon = new Worker(PURE_SYNTHIA_DAEMON, {
    env: { ...process.env, SYNTHIA_STATE_DIR: PURE_SYNTHIA_STATE_DIR },
    stdout: true,
    stderr: true
  });
  pureSynthiaDaemon.stdout?.on('data', chunk => process.stdout.write(chunk));
  pureSynthiaDaemon.stderr?.on('data', chunk => process.stderr.write(chunk));
  console.log('   Pure Synthia daemon: embedded worker ' + pureSynthiaDaemon.threadId);
  pureSynthiaDaemon.on('error', error => console.error('Pure Synthia worker error:', error));
  pureSynthiaDaemon.on('exit', code => {
    console.log('   Pure Synthia daemon exited: code=' + code);
    pureSynthiaDaemon = null;
    if (!pureSynthiaStopping) {
      clearTimeout(pureSynthiaRestartTimer);
      pureSynthiaRestartTimer = setTimeout(startPureSynthiaDaemon, 3000);
    }
  });
}

function stopPureSynthiaDaemon(){
  pureSynthiaStopping = true;
  clearTimeout(pureSynthiaRestartTimer);
  if (pureSynthiaDaemon) pureSynthiaDaemon.terminate().catch(() => {});
}`;

replace(oldStart, newStart, 'daemon worker conversion');
fs.writeFileSync(file, src);
console.log('adapted Pure Synthia daemon to embedded Node worker');
