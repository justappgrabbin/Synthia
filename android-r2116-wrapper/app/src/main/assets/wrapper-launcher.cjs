const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { Worker } = require('node:worker_threads');
const childProcess = require('node:child_process');
const { syncBuiltinESMExports } = require('node:module');

const projectRoot = path.resolve(process.argv[2] || '');
if (!projectRoot || !fs.existsSync(path.join(projectRoot, 'package.json'))) {
  console.error('Synthia residence not found:', projectRoot);
  process.exit(70);
}
process.chdir(projectRoot);

const originalSpawn = childProcess.spawn;
function splitChain(command) { return String(command).split(/\s*&&\s*/).map(x => x.trim()).filter(Boolean); }
function splitArgs(command) {
  const parts = [];
  String(command).replace(/"([^"]*)"|'([^']*)'|([^\s]+)/g, (_, d, s, bare) => { parts.push(d ?? s ?? bare); return ''; });
  return parts;
}
async function runNodeFile(file, args, cwd, out, err) {
  const absolute = path.resolve(cwd, file);
  if (!absolute.startsWith(projectRoot + path.sep)) { err.write(`Refusing verification target outside residence: ${absolute}\n`); return 66; }
  if (!fs.existsSync(absolute)) { err.write(`Verification target missing: ${file}\n`); return 66; }
  return await new Promise(resolve => {
    const worker = new Worker(pathToFileURL(absolute), { argv: args, stdout: true, stderr: true });
    worker.stdout.on('data', d => out.write(d));
    worker.stderr.on('data', d => err.write(d));
    worker.on('error', e => { err.write(`${e.stack || e.message || e}\n`); resolve(1); });
    worker.on('exit', code => resolve(Number.isInteger(code) ? code : 1));
  });
}
async function runPackageScript(scriptName, cwd, out, err, stack = []) {
  if (stack.includes(scriptName)) { err.write(`Recursive npm script detected: ${[...stack, scriptName].join(' -> ')}\n`); return 65; }
  const pkgPath = path.join(cwd, 'package.json');
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); }
  catch (e) { err.write(`Cannot read ${pkgPath}: ${e.message}\n`); return 66; }
  const command = pkg.scripts?.[scriptName];
  if (!command) { err.write(`Unknown package script: ${scriptName}\n`); return 64; }
  for (const segment of splitChain(command)) {
    const argv = splitArgs(segment);
    const executable = (argv.shift() || '').toLowerCase();
    let code;
    if (executable === 'node') {
      const file = argv.shift();
      if (!file) { err.write(`Invalid node command in script ${scriptName}\n`); return 64; }
      code = await runNodeFile(file, argv, cwd, out, err);
    } else if ((executable === 'npm' || executable === 'npm.cmd') && argv[0] === 'run' && argv[1]) {
      code = await runPackageScript(argv[1], cwd, out, err, [...stack, scriptName]);
    } else {
      err.write(`Unsupported verification command: ${segment}\n`); return 64;
    }
    if (code !== 0) return code;
  }
  return 0;
}
function virtualNpm(scriptName, options = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough();
  child.pid = -1; child.killed = false; child.kill = () => { child.killed = true; return false; };
  const cwd = path.resolve(options.cwd || process.cwd());
  queueMicrotask(async () => {
    const code = await runPackageScript(scriptName, cwd, child.stdout, child.stderr);
    child.stdout.end(); child.stderr.end(); child.emit('exit', code, null); child.emit('close', code, null);
  });
  return child;
}
childProcess.spawn = function(command, args = [], options = {}) {
  const base = path.basename(String(command)).toLowerCase();
  if ((base === 'npm' || base === 'npm.cmd') && args?.[0] === 'run' && args?.[1]) return virtualNpm(String(args[1]), options);
  return originalSpawn.call(childProcess, command, args, options);
};
syncBuiltinESMExports();
process.env.PORT = '6969';
process.env.HOST = '127.0.0.1';
process.env.SYNTHIA_AUTO_OPEN = '0';
const serve = pathToFileURL(path.join(projectRoot, 'bootstrap', 'serve.mjs')).href;
import(serve).catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
