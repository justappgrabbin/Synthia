// Neutral Assembly v2.0 / phase 5: evidence-based, local-first backend selection.
// A declared lane is not available until its actual capability probe has passed.
const ORDER = ['none', 'browser', 'worker', 'local-node', 'local-python', 'supabase', 'generated-backend'];
const LOCAL = new Set(ORDER.slice(0, 5));
const SHARED = new Set(ORDER.slice(5));
const PERSISTENCE = new Set(['ephemeral', 'device', 'embedded', 'shared']);
export function resolveBackend({
  workspaceId, requiredCapabilities = [], probes = [], persistence = 'ephemeral',
  secretsRequired = [], networkRequired = false, shared = false, allowGenerated = false
}) {
  if (!workspaceId) throw new Error('workspaceId required');
  if (!Array.isArray(requiredCapabilities) || !Array.isArray(probes) || !Array.isArray(secretsRequired)) throw new Error('invalid backend contract');
  if (!PERSISTENCE.has(persistence)) throw new Error('invalid persistence tier');
  const needed = [...new Set(requiredCapabilities)];
  const rejects = [];
  let selected = null;
  for (const lane of ORDER) {
    const probe = probes.find(p => p.lane === lane);
    const why = [];
    if ((shared || persistence === 'shared') && LOCAL.has(lane)) why.push('durable shared state or coordination required');
    if (networkRequired && lane === 'none') why.push('network required');
    if (secretsRequired.length && !SHARED.has(lane) && !probe?.secureSecretStore) why.push('required secrets unavailable in this lane');
    if (lane === 'generated-backend' && !allowGenerated) why.push('backend generation not approved');
    if (!probe || probe.passed !== true) why.push('executable capability probe not passed');
    if (probe && !needed.every(name => Array.isArray(probe.capabilities) && probe.capabilities.includes(name))) why.push('required capability not supported');
    if (why.length) { rejects.push({ lane, reason: why.join('; ') }); continue; }
    selected = lane;
    break;
  }
  return {
    workspaceId, requiredCapabilities: needed,
    selectedLane: selected, status: selected ? 'ready' : 'blocked',
    reason: selected ? [`${selected} has a passed probe for all required capabilities`] : ['no eligible runtime has passed required probes'],
    rejectedLanes: rejects,
    persistence, secretsRequired, networkRequired,
    lifecycle: selected ? { start: 'provided by registered adapter', health: 'probe passed', stop: 'provided by registered adapter' } : { start: 'blocked', health: 'unavailable', stop: 'not started' },
    acceptanceTests: []
  };
}
