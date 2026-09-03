const fs = require('node:fs');
const path = require('node:path');

const [projectRoot, dataDir, stateDir, watchDir, sandboxDir] = process.argv.slice(2);
if (!projectRoot || !fs.existsSync(path.join(projectRoot, 'server.js'))) {
  console.error('Synthia residence server.js not found:', projectRoot);
  process.exitCode = 70;
  return;
}

for (const dir of [dataDir, stateDir, watchDir, sandboxDir]) {
  if (dir) fs.mkdirSync(dir, { recursive: true });
}
process.chdir(projectRoot);
process.env.PORT = '6969';
process.env.HOST = '127.0.0.1';
process.env.SYNTHIA_AUTO_OPEN = '0';
if (dataDir) process.env.DATA_DIR = dataDir;
if (stateDir) process.env.SYNTHIA_STATE_DIR = stateDir;
if (watchDir) process.env.SYNTHIA_WATCH_DIR = watchDir;
if (sandboxDir) process.env.SYNTHIA_SANDBOX_DIR = sandboxDir;
if (dataDir) process.env.SYNTHIA_PHONE_INBOX = path.join(dataDir, 'phone-inbox');
process.env.SYNTHIA_SYNC_POLL_MS = process.env.SYNTHIA_SYNC_POLL_MS || '30000';

require(path.join(projectRoot, 'server.js'));
