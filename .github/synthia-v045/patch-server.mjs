import fs from 'node:fs';

const file = process.argv[2];
if (!file) throw new Error('server.js path required');
let src = fs.readFileSync(file, 'utf8');

function mustReplace(find, replacement, label) {
  if (typeof find === 'string') {
    if (!src.includes(find)) throw new Error(`missing patch anchor: ${label}`);
    src = src.replace(find, replacement);
  } else {
    if (!find.test(src)) throw new Error(`missing patch pattern: ${label}`);
    src = src.replace(find, replacement);
  }
}

mustReplace("const fs = require('fs');\nconst os = require('os');", "const fs = require('fs');\nconst crypto = require('crypto');\nconst { Readable } = require('stream');\nconst { pipeline } = require('stream/promises');\nconst os = require('os');", 'node sync imports');

mustReplace(
  "const PHONE_INBOX_DIR = process.env.SYNTHIA_PHONE_INBOX || path.join(os.homedir(), 'storage', 'downloads', 'SynthiaInbox');",
  "const PHONE_INBOX_DIR = process.env.SYNTHIA_PHONE_INBOX || path.join(os.homedir(), 'storage', 'downloads', 'SynthiaInbox');\nconst PHONE_SYNC_CONFIG_FILE = process.env.SYNTHIA_PHONE_SYNC_CONFIG || path.join(__dirname, 'config', 'phone-sync.json');\nconst SYNC_STATE_FILE = path.join(DATA_DIR, 'phone-sync-state.json');\nconst SYNC_INBOX_DIR = process.env.SYNTHIA_SYNC_INBOX || path.join(DATA_DIR, 'sync-inbox');\nconst SYNC_POLL_MS = Math.max(15000, parseInt(process.env.SYNTHIA_SYNC_POLL_MS || '30000', 10));",
  'sync constants'
);

mustReplace(
  /function wakeMCP\(\) \{[\s\S]*?\n\}\n\nfunction killMCP\(\) \{/,
  `function wakeMCP() {\n  if (SYSTEM.mcp.status === 'online') return { status: 'already_running', mcp: SYSTEM.mcp };\n  SYSTEM.mcp.status = 'online';\n  SYSTEM.mcp.server = 'in-process-message-bus';\n  SYSTEM.mcp.since = Date.now();\n  logEvent('mcp', 'system', 'Local MCP message bus online', { transport: 'http+websocket', role: 'message-passer' });\n  broadcastTerminal({ type: 'mcp_status', status: 'online' });\n  persistState();\n  return { status: 'online', mcp: SYSTEM.mcp };\n}\n\nfunction killMCP() {`,
  'replace simulated MCP wake'
);

mustReplace(
  /app\.post\('\/mcp\/route',[\s\S]*?\n\}\);\n\n\/\/ ── \/mcp\/events/,
  `app.post('/mcp/route', (req, res) => {\n  const { from, to, target_agent, message, intent, project } = req.body;\n  const target = String(to || target_agent || 'chatgpt').toLowerCase();\n  if (!message) return res.status(400).json({ error: 'message required' });\n  const item = {\n    id: \`route_\${Date.now()}_\${Math.random().toString(36).slice(2, 8)}\`,\n    kind: 'routed-message',\n    from: from || 'unknown',\n    to: target,\n    message,\n    intent: intent || 'message',\n    project: project || 'synthia',\n    created_at: Date.now()\n  };\n  enqueue(target, item);\n  SYSTEM.last_routed_message = message;\n  logEvent('route', item.from, \`Routed to \${target}: \${String(message).substring(0, 80)}\`, item);\n  persistState();\n  res.json({ routed: true, message: item, inbox: target, timestamp: Date.now() });\n});\n\n// ── /mcp/events`,
  'wire MCP route to real inbox'
);

const syncBlock = String.raw`
// ═══════════════════════════════════════════════════════════════════
// PHONE SYNC — durable two-way residence bridge
// ═══════════════════════════════════════════════════════════════════
let phoneSyncTimer = null;
let phoneSyncBusy = false;

function loadPhoneSyncConfig() {
  try {
    if (!fs.existsSync(PHONE_SYNC_CONFIG_FILE)) return null;
    const cfg = JSON.parse(fs.readFileSync(PHONE_SYNC_CONFIG_FILE, 'utf8'));
    if (!cfg.endpoint || !cfg.file_endpoint || !cfg.workspace_id || !cfg.participant_ref || !cfg.token) return null;
    return cfg;
  } catch (err) {
    console.error('Phone sync config failed:', err.message);
    return null;
  }
}
function loadPhoneSyncState() {
  try { if (fs.existsSync(SYNC_STATE_FILE)) return JSON.parse(fs.readFileSync(SYNC_STATE_FILE, 'utf8')); } catch (_) {}
  return { last_seen_version: 0, connected: false, last_poll_at: null, last_success_at: null, last_error: null, installed: [] };
}
const PHONE_SYNC = loadPhoneSyncState();
function savePhoneSyncState() {
  ensureDataDir();
  fs.writeFileSync(SYNC_STATE_FILE, JSON.stringify(PHONE_SYNC, null, 2));
}
async function fileSha256(filePath) {
  return await new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
async function phoneSyncRpc(name, args = {}) {
  const cfg = loadPhoneSyncConfig();
  if (!cfg) throw new Error('phone sync config missing');
  const response = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: { workspace_id: cfg.workspace_id, ...args } } })
  });
  const body = await response.json();
  if (!response.ok || body.error) throw new Error(body.error?.message || body.message || `sync RPC ${name} failed`);
  return body.result?.structuredContent?.result ?? JSON.parse(body.result?.content?.[0]?.text || 'null');
}
async function fetchSyncJson(url) {
  const cfg = loadPhoneSyncConfig();
  const response = await fetch(url, { headers: { Authorization: `Bearer ${cfg.token}` }, cache: 'no-store' });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body) throw new Error(body?.error || `sync fetch failed (${response.status})`);
  return body;
}
async function installBinaryEvent(event) {
  const cfg = loadPhoneSyncConfig();
  const packageKey = String(event.payload?.package_key || '').trim();
  const versionLabel = String(event.payload?.version_label || '').trim();
  if (!packageKey || !versionLabel) throw new Error('binary event missing package/version');
  const manifestUrl = `${cfg.file_endpoint}?package=${encodeURIComponent(packageKey)}&version=${encodeURIComponent(versionLabel)}`;
  const manifest = await fetchSyncJson(manifestUrl);
  if (!manifest.ok) throw new Error(manifest.error || 'binary manifest unavailable');

  const safePackage = packageKey.replace(/[^A-Za-z0-9._-]/g, '_');
  const safeVersion = versionLabel.replace(/[^A-Za-z0-9._-]/g, '_');
  const packageDir = path.join(SYNC_INBOX_DIR, `${safePackage}@${safeVersion}`);
  ensureDir(packageDir);

  for (const item of manifest.files || []) {
    const rel = safeRelativePath(item.file_path || item.object_path);
    if (!rel || !item.storage_path) throw new Error('unsafe binary manifest path');
    const target = resolveInside(packageDir, rel);
    if (!target) throw new Error(`unsafe sync target: ${rel}`);
    ensureDir(path.dirname(target));
    const temp = `${target}.part`;
    const response = await fetch(`${cfg.file_endpoint}?path=${encodeURIComponent(item.storage_path)}`, { headers: { Authorization: `Bearer ${cfg.token}` }, cache: 'no-store' });
    if (!response.ok || !response.body) throw new Error(`download failed for ${rel}: ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temp));
    const actual = await fileSha256(temp);
    if (item.sha256 && actual.toLowerCase() !== String(item.sha256).toLowerCase()) {
      fs.rmSync(temp, { force: true });
      throw new Error(`checksum mismatch for ${rel}`);
    }
    fs.renameSync(temp, target);
  }
  fs.writeFileSync(path.join(packageDir, 'SYNTHIA-SYNC-MANIFEST.json'), JSON.stringify({ ...manifest, event_uuid: event.event_uuid, workspace_version: event.workspace_version }, null, 2));

  ensureDir(WATCH_DIR);
  let watchTarget = path.join(WATCH_DIR, `${safePackage}@${safeVersion}`);
  if (!fs.existsSync(watchTarget)) fs.cpSync(packageDir, watchTarget, { recursive: true });
  scanWatchInbox();
  PHONE_SYNC.installed ||= [];
  PHONE_SYNC.installed.unshift({ package_key: packageKey, version_label: versionLabel, event_uuid: event.event_uuid, installed_at: Date.now(), path: packageDir });
  PHONE_SYNC.installed = PHONE_SYNC.installed.slice(0, 100);
  return { package_key: packageKey, version_label: versionLabel, path: packageDir, files: manifest.file_count || manifest.files?.length || 0 };
}
async function pollPhoneSync() {
  if (phoneSyncBusy) return { ok: true, busy: true, ...PHONE_SYNC };
  phoneSyncBusy = true;
  PHONE_SYNC.last_poll_at = Date.now();
  try {
    const cfg = loadPhoneSyncConfig();
    if (!cfg) throw new Error('phone sync config missing');
    const updates = await phoneSyncRpc('synthia_get_updates', { since_version: Number(PHONE_SYNC.last_seen_version || 0), limit: 100 });
    for (const event of updates || []) {
      let details = { event_type: event.event_type };
      if (event.event_type === 'artifact.binary_ready') details = { ...details, ...(await installBinaryEvent(event)) };
      await phoneSyncRpc('synthia_acknowledge_update', {
        participant_ref: cfg.participant_ref,
        event_uuid: event.event_uuid,
        receipt_status: event.event_type === 'artifact.binary_ready' ? 'applied' : 'seen',
        details
      });
      PHONE_SYNC.last_seen_version = event.workspace_version;
      PHONE_SYNC.last_success_at = Date.now();
      PHONE_SYNC.last_error = null;
      PHONE_SYNC.connected = true;
      savePhoneSyncState();
    }
    if (!(updates || []).length) {
      PHONE_SYNC.connected = true;
      PHONE_SYNC.last_success_at = Date.now();
      PHONE_SYNC.last_error = null;
      savePhoneSyncState();
    }
    return { ok: true, updates: (updates || []).length, ...PHONE_SYNC };
  } catch (err) {
    PHONE_SYNC.connected = false;
    PHONE_SYNC.last_error = err.message;
    savePhoneSyncState();
    logEvent('error', 'phone-sync', `Phone sync failed: ${err.message}`);
    return { ok: false, error: err.message, ...PHONE_SYNC };
  } finally {
    phoneSyncBusy = false;
  }
}
function startPhoneSync() {
  if (phoneSyncTimer) return;
  ensureDir(SYNC_INBOX_DIR);
  phoneSyncTimer = setInterval(() => { pollPhoneSync().catch(() => {}); }, SYNC_POLL_MS);
  setTimeout(() => { pollPhoneSync().catch(() => {}); }, 1200).unref();
}
async function phoneNotifications() {
  const [mine, owner] = await Promise.all([
    phoneSyncRpc('synthia_get_notifications', { recipient_ref: 'synthia', unread_only: true, limit: 100 }),
    phoneSyncRpc('synthia_get_notifications', { recipient_ref: 'adaya', unread_only: true, limit: 100 })
  ]);
  const unique = new Map([...(mine || []), ...(owner || [])].map(n => [n.notification_type + ':' + (n.payload?.request_id || n.payload?.proposal_id || n.notification_id), n]));
  return [...unique.values()].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
}
async function markDecisionNotificationsRead(notice) {
  const all = await Promise.all([
    phoneSyncRpc('synthia_get_notifications', { recipient_ref: 'synthia', unread_only: true, limit: 100 }),
    phoneSyncRpc('synthia_get_notifications', { recipient_ref: 'adaya', unread_only: true, limit: 100 })
  ]);
  const key = notice.payload?.request_id || notice.payload?.proposal_id || null;
  const matches = all.flat().filter(n => n.notification_type === notice.notification_type && (key ? (n.payload?.request_id === key || n.payload?.proposal_id === key) : n.notification_id === notice.notification_id));
  await Promise.all(matches.map(n => phoneSyncRpc('synthia_mark_notification_read', { notification_id: n.notification_id })));
}
`;

const apiMarker = "// ═══════════════════════════════════════════════════════════════════\n// API ENDPOINTS";
if (!src.includes(apiMarker)) throw new Error('missing API marker');
src = src.replace(apiMarker, syncBlock + "\n\n" + apiMarker);

const healthMarker = "// ── /apps ───────────────────────────────────────────────────────";
const syncRoutes = String.raw`
// ── /sync ───────────────────────────────────────────────────────
app.get('/sync/status', (req, res) => res.json({ ok: true, configured: !!loadPhoneSyncConfig(), busy: phoneSyncBusy, ...PHONE_SYNC }));
app.post('/sync/poll', async (req, res) => {
  const result = await pollPhoneSync();
  res.status(result.ok ? 200 : 502).json(result);
});
app.get('/sync/notifications', async (req, res) => {
  try { res.json({ ok: true, notifications: await phoneNotifications() }); }
  catch (err) { res.status(502).json({ ok: false, error: err.message }); }
});
app.post('/sync/mark-read', async (req, res) => {
  try {
    const id = Number(req.body?.notification_id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok:false, error:'notification_id required' });
    await phoneSyncRpc('synthia_mark_notification_read', { notification_id: id });
    res.json({ ok: true, notification_id: id });
  } catch (err) { res.status(502).json({ ok:false, error:err.message }); }
});
app.post('/sync/decision', async (req, res) => {
  try {
    const notice = req.body?.notification || {};
    const decision = req.body?.decision;
    if (!['approved','rejected'].includes(decision)) return res.status(400).json({ ok:false,error:'invalid decision' });
    if (notice.notification_type === 'connection.requested' && notice.payload?.request_id) {
      await phoneSyncRpc('synthia_respond_connection', { request_id: notice.payload.request_id, decision });
    } else if (notice.notification_type === 'change.approval_requested' && notice.payload?.proposal_id) {
      await phoneSyncRpc('synthia_respond_change', { proposal_id: notice.payload.proposal_id, decision });
    } else return res.status(400).json({ ok:false,error:'notification is not actionable' });
    await markDecisionNotificationsRead(notice);
    res.json({ ok: true, decision });
  } catch (err) { res.status(502).json({ ok:false,error:err.message }); }
});
`;
if (!src.includes(healthMarker)) throw new Error('missing apps marker');
src = src.replace(healthMarker, syncRoutes + "\n\n" + healthMarker);

mustReplace(
  "  startBuilderWatcher();\n  startPureSynthiaDaemon();\n  console.log('   Ready.');",
  "  startBuilderWatcher();\n  startPureSynthiaDaemon();\n  startPhoneSync();\n  console.log('   Phone sync: ' + (loadPhoneSyncConfig() ? 'configured' : 'not configured'));\n  console.log('   Ready.');",
  'start phone sync'
);

mustReplace(
  "  stopPureSynthiaDaemon();\n  server.close(() => process.exit(0));",
  "  stopPureSynthiaDaemon();\n  if (phoneSyncTimer) clearInterval(phoneSyncTimer);\n  phoneSyncTimer = null;\n  savePhoneSyncState();\n  server.close(() => process.exit(0));",
  'persist sync on shutdown'
);

src = src.replace("  Any shell command also works (ls, ps, etc.)", "  Shell execution is disabled; use the listed Synthia commands.");
fs.writeFileSync(file, src);
console.log('patched server.js for durable Synthia phone sync');
