import fs from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('server.js path required');
let src = fs.readFileSync(file, 'utf8');

function replaceRegex(pattern, replacement, label) {
  if (!pattern.test(src)) throw new Error(`missing portability pattern: ${label}`);
  src = src.replace(pattern, replacement);
}
function replaceString(find, replacement, label) {
  if (!src.includes(find)) throw new Error(`missing portability anchor: ${label}`);
  src = src.replace(find, replacement);
}

replaceString(
  "const { spawn, execFileSync } = require('child_process');",
  "const { spawn } = require('child_process');\nconst { pathToFileURL } = require('url');\nconst AdmZip = require('adm-zip');",
  'imports'
);

replaceRegex(
  /function runGit\(args\) \{[\s\S]*?\n\}\n\nfunction pythonInvocation\(script, args = \[\]\) \{[\s\S]*?\n\}\n\nfunction callLcm\(payload = \{\}\) \{[\s\S]*?\n\}\n\nfunction routeBySynthiaRules/,
  `let morphChatRuntimePromise = null;
async function getMorphChatRuntime() {
  if (!morphChatRuntimePromise) {
    const url = pathToFileURL(path.join(PURE_SYNTHIA_DIR, 'src', 'synthia', 'morph-chat', 'runtime.mjs')).href;
    morphChatRuntimePromise = import(url).then(mod => mod.default || new mod.MorphChatRuntime());
  }
  return morphChatRuntimePromise;
}
async function callLcm(payload = {}) {
  const runtime = await getMorphChatRuntime();
  const action = payload.action || 'query';
  if (action === 'status') return { ok: true, engine: 'pure-synthia-morph-chat', local: true, snapshot: runtime.snapshot() };
  if (action === 'query') {
    const result = await runtime.send(String(payload.text || ''), { sharedContext: { source: payload.source || 'phone-server' } });
    return { ok: true, engine: 'pure-synthia-morph-chat', result: { response: result.assistant?.text || '', semantic: result.semantic, trace: result.trace, provider: result.provider } };
  }
  if (action === 'ingest_file') {
    let content = typeof payload.content === 'string' ? payload.content : '';
    if (!content && payload.path) {
      const target = path.resolve(String(payload.path));
      if (fs.existsSync(target) && fs.statSync(target).isFile()) content = fs.readFileSync(target, 'utf8');
    }
    if (!content) throw new Error('LCM ingest needs file content or a readable local path');
    const concepts = await runtime.invokeTool('diseminer', content, { source: payload.path || 'phone-ingest', metadata: payload.metadata || {} });
    const linguistic = await runtime.invokeTool('autoling', content, { source: payload.path || 'phone-ingest', metadata: payload.metadata || {} });
    return { ok: true, engine: 'pure-synthia-morph-chat', result: { concepts, linguistic, path: payload.path || null } };
  }
  throw new Error('unsupported local LCM action: ' + action);
}

function routeBySynthiaRules`,
  'replace Python LCM bridge'
);

replaceRegex(
  /function gitSyncStatus\(\) \{[\s\S]*?\n\}\n\nfunction pushBuilderJob/,
  `function gitSyncStatus() {
  return {
    enabled: false,
    transport: 'synthia-sync',
    message: 'Phone residence uses Synthia Sync instead of a local git executable.',
    approvals_dir: GITHUB_APPROVAL_DIR,
    auto_pull: false
  };
}

function pushBuilderJob`,
  'replace local git status'
);

replaceString(
  "      runAutobuilder(job, queued.source, () => finishBuilderJob(job, sandboxTarget));",
  "      runAutobuilder(job, queued.source, projectDir => finishBuilderJob(job, projectDir || sandboxTarget));",
  'autobuilder callback'
);

replaceRegex(
  /function runAutobuilder\(job, source, done\) \{[\s\S]*?\n\}\n\nasync function runSelfWriter/,
  `function runAutobuilder(job, source, done) {
  try {
    ensureBuilderDirs();
    const projectDir = path.join(BUILDER_PROJECTS_DIR, job.id);
    if (fs.existsSync(projectDir)) fs.rmSync(projectDir, { recursive: true, force: true });
    ensureDir(projectDir);
    const stat = fs.statSync(source);
    if (stat.isDirectory()) {
      fs.cpSync(source, projectDir, { recursive: true });
    } else if (String(source).toLowerCase().endsWith('.zip') || String(source).toLowerCase().endsWith('.apk')) {
      const zip = new AdmZip(source);
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        const rel = safeRelativePath(entry.entryName);
        if (!rel) continue;
        const target = resolveInside(projectDir, rel);
        if (!target) continue;
        ensureDir(path.dirname(target));
        fs.writeFileSync(target, entry.getData());
      }
    } else {
      fs.copyFileSync(source, path.join(projectDir, path.basename(source)));
    }
    const files = [];
    const walk = dir => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else files.push(path.relative(projectDir, full).replace(/\\\\/g, '/'));
        if (files.length >= 5000) return;
      }
    };
    walk(projectDir);
    const report = { ok: true, engine: 'synthia-js-autobuilder', source, project_dir: projectDir, file_count: files.length, files, completed_at: new Date().toISOString() };
    const reportPath = path.join(BUILDER_REPORTS_DIR, job.id + '.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    job.autobuilder_exit_code = 0;
    job.report_path = reportPath;
    job.log.push('Synthia JS autobuilder ingested ' + files.length + ' files');
    done(projectDir);
  } catch (err) {
    job.autobuilder_exit_code = 1;
    job.log.push(err.stack || err.message);
    job.error = err.message;
    done(null);
  }
}

async function runSelfWriter`,
  'replace Python autobuilder'
);

replaceRegex(
  /async function runSelfWriter\(prompt\) \{[\s\S]*?\n\}\n\nasync function synthiaChatEnvelope/,
  `async function runSelfWriter(prompt) {
  ensureBuilderDirs();
  const job = {
    id: 'selfwrite_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    status: 'writing', source: 'Synthia JS Writer', kind: 'selfwrite', prompt,
    started_at: Date.now(), sandbox_path: null, report_path: null, promoted_url: null, log: []
  };
  SYSTEM.builder.status = 'writing';
  pushBuilderJob(job);
  try {
    const result = await callTrident('/generate', {
      prompt: plainEnglishInstruction() + '\n\nReturn ONLY JSON: {"files":[{"path":"index.html","content":"..."}],"notes":"..."}. Build a phone-first app for:\n' + prompt,
      head: 'code', max_tokens: 2600, temperature: 0.55,
      rag_query: 'Synthia autonomous builder phone app repair'
    });
    const raw = extractGeneratedText(result.body || result) || JSON.stringify(result.body || result);
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('writer did not return a file manifest');
    const manifest = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error('writer manifest contains no files');
    const projectDir = path.join(BUILDER_UPDATES_DIR, job.id);
    ensureDir(projectDir);
    for (const item of manifest.files) {
      const rel = safeRelativePath(item.path);
      const target = rel && resolveInside(projectDir, rel);
      if (!target) throw new Error('writer attempted an unsafe path');
      ensureDir(path.dirname(target));
      fs.writeFileSync(target, String(item.content ?? ''));
    }
    const reportPath = path.join(BUILDER_REPORTS_DIR, job.id + '.json');
    fs.writeFileSync(reportPath, JSON.stringify({ ok:true, prompt, notes:manifest.notes || '', files:manifest.files.map(f=>f.path), created_at:new Date().toISOString() }, null, 2));
    job.sandbox_path = projectDir;
    job.report_path = reportPath;
    job.status = 'written-needs-review';
    job.log.push('Synthia JS writer created ' + manifest.files.length + ' files for review.');
  } catch (err) {
    job.status = 'write-needs-provider';
    job.error = err.message;
    SYSTEM.builder.last_error = err.message;
  }
  job.finished_at = Date.now();
  SYSTEM.builder.status = 'idle';
  logEvent('builder', 'autowriter', 'Self-write finished: ' + job.status, job);
  persistState();
  return job;
}

async function synthiaChatEnvelope`,
  'replace Python self writer'
);

replaceRegex(
  /app\.post\('\/builder\/seedbox\/run',[\s\S]*?\n\}\);/,
  `app.post('/builder/seedbox/run', requireAdmin, (req, res) => {
  res.status(409).json({ ok:false, error:'Seedbox shell launcher is not part of the embedded phone residence. Use registered Synthia capabilities instead.' });
});`,
  'disable seedbox shell launcher'
);
replaceRegex(
  /app\.post\('\/github\/pull',[\s\S]*?\n\}\);/,
  `app.post('/github/pull', requireAdmin, (req, res) => {
  res.status(409).json({ ok:false, error:'Phone updates arrive through Synthia Sync; local git shell is intentionally not required.' });
});`,
  'disable git pull shell'
);
replaceRegex(
  /app\.post\('\/github\/prepare-commit',[\s\S]*?\n\}\);/,
  `app.post('/github/prepare-commit', requireAdmin, (req, res) => {
  res.status(409).json({ ok:false, error:'Commit preparation is handled by the build backend, not a phone shell process.' });
});`,
  'disable git prepare shell'
);

fs.writeFileSync(file, src);
console.log('patched required Python/shell paths to JS/in-process Synthia paths');
