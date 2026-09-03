import fs from 'node:fs';
import path from 'node:path';

const [serverFile, patchDir] = process.argv.slice(2);
if (!serverFile || !patchDir) throw new Error('usage: patch-server-v2.mjs <server.js> <patch-dir>');
let src = fs.readFileSync(serverFile, 'utf8');
const syncBlock = fs.readFileSync(path.join(patchDir, 'server-sync-block.txt'), 'utf8').trimEnd();
const syncRoutes = fs.readFileSync(path.join(patchDir, 'server-sync-routes.txt'), 'utf8').trimEnd();
const synthai2Compat = fs.readFileSync(path.join(patchDir, 'synthai2-local-compat.txt'), 'utf8').trimEnd();

function replaceString(find, replacement, label) {
  if (!src.includes(find)) throw new Error(`missing patch anchor: ${label}`);
  src = src.replace(find, replacement);
}
function replaceRegex(pattern, replacement, label) {
  if (!pattern.test(src)) throw new Error(`missing patch pattern: ${label}`);
  src = src.replace(pattern, replacement);
}

replaceString(
  "const fs = require('fs');\nconst os = require('os');",
  "const fs = require('fs');\nconst crypto = require('crypto');\nconst { Readable } = require('stream');\nconst { pipeline } = require('stream/promises');\nconst os = require('os');",
  'node sync imports'
);
replaceString(
  "const PHONE_INBOX_DIR = process.env.SYNTHIA_PHONE_INBOX || path.join(os.homedir(), 'storage', 'downloads', 'SynthiaInbox');",
  "const PHONE_INBOX_DIR = process.env.SYNTHIA_PHONE_INBOX || path.join(os.homedir(), 'storage', 'downloads', 'SynthiaInbox');\nconst PHONE_SYNC_CONFIG_FILE = process.env.SYNTHIA_PHONE_SYNC_CONFIG || path.join(__dirname, 'config', 'phone-sync.json');\nconst SYNC_STATE_FILE = path.join(DATA_DIR, 'phone-sync-state.json');\nconst SYNC_INBOX_DIR = process.env.SYNTHIA_SYNC_INBOX || path.join(DATA_DIR, 'sync-inbox');\nconst SYNC_POLL_MS = Math.max(15000, parseInt(process.env.SYNTHIA_SYNC_POLL_MS || '30000', 10));",
  'sync constants'
);
replaceRegex(
  /function wakeMCP\(\) \{[\s\S]*?\n\}\n\nfunction killMCP\(\) \{/,
  "function wakeMCP() {\n  if (SYSTEM.mcp.status === 'online') return { status: 'already_running', mcp: SYSTEM.mcp };\n  SYSTEM.mcp.status = 'online';\n  SYSTEM.mcp.server = 'in-process-message-bus';\n  SYSTEM.mcp.since = Date.now();\n  logEvent('mcp', 'system', 'Local MCP message bus online', { transport: 'http+websocket', role: 'message-passer' });\n  broadcastTerminal({ type: 'mcp_status', status: 'online' });\n  persistState();\n  return { status: 'online', mcp: SYSTEM.mcp };\n}\n\nfunction killMCP() {",
  'replace simulated MCP wake'
);
replaceRegex(
  /app\.post\('\/mcp\/route',[\s\S]*?\n\}\);\n\n\/\/ ── \/mcp\/events/,
  "app.post('/mcp/route', (req, res) => {\n  const { from, to, target_agent, message, intent, project } = req.body;\n  const target = String(to || target_agent || 'chatgpt').toLowerCase();\n  if (!message) return res.status(400).json({ error: 'message required' });\n  const item = {\n    id: `route_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,\n    kind: 'routed-message',\n    from: from || 'unknown',\n    to: target,\n    message,\n    intent: intent || 'message',\n    project: project || 'synthia',\n    created_at: Date.now()\n  };\n  enqueue(target, item);\n  SYSTEM.last_routed_message = message;\n  logEvent('route', item.from, `Routed to ${target}: ${String(message).substring(0, 80)}`, item);\n  persistState();\n  res.json({ routed: true, message: item, inbox: target, timestamp: Date.now() });\n});\n\n// ── /mcp/events",
  'wire MCP route to real inbox'
);

const apiMarker = "// ═══════════════════════════════════════════════════════════════════\n// API ENDPOINTS";
replaceString(apiMarker, `${syncBlock}\n\n${synthai2Compat}\n\n${apiMarker}`, 'API marker');
const appsMarker = "// ── /apps ───────────────────────────────────────────────────────";
replaceString(appsMarker, `${syncRoutes}\n\n${appsMarker}`, 'apps marker');
replaceString(
  "  startBuilderWatcher();\n  startPureSynthiaDaemon();\n  console.log('   Ready.');",
  "  startBuilderWatcher();\n  startPureSynthiaDaemon();\n  startPhoneSync();\n  console.log('   Phone sync: ' + (loadPhoneSyncConfig() ? 'configured' : 'not configured'));\n  console.log('   Ready.');",
  'start phone sync'
);
replaceString(
  "  stopPureSynthiaDaemon();\n  server.close(() => process.exit(0));",
  "  stopPureSynthiaDaemon();\n  if (phoneSyncTimer) clearInterval(phoneSyncTimer);\n  phoneSyncTimer = null;\n  savePhoneSyncState();\n  server.close(() => process.exit(0));",
  'persist sync on shutdown'
);
src = src.replace("  Any shell command also works (ls, ps, etc.)", "  Shell execution is disabled; use the listed Synthia commands.");

fs.writeFileSync(serverFile, src);
console.log('patched server.js: durable sync + real in-process MCP + Synthai2 local compatibility');
