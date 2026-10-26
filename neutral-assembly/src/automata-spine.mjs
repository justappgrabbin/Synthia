// Neutral Assembly v2.0 / phase 4: durable dependency-aware task execution.
// Adapter calls run only after a passing probe and a supplied authenticated actor.
// The host owns authorization, isolation, and idempotency for any external side effect.
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const digest = value => createHash('sha256').update(value).digest('hex');
function validate(steps) {
  if (!Array.isArray(steps) || !steps.length || steps.length > 128) throw new Error('invalid task steps');
  const names = new Set();
  for (const step of steps) {
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(step.id) || names.has(step.id) || !step.capability) throw new Error('invalid or duplicate task step');
    names.add(step.id);
  }
  for (const step of steps) {
    for (const dep of step.dependencies || []) if (!names.has(dep) || dep === step.id) throw new Error('invalid task dependency');
  }
  const seen = new Set(), active = new Set(), byId = new Map(steps.map(x => [x.id, x]));
  const dfs = id => {
    if (active.has(id)) throw new Error('task dependency cycle');
    if (seen.has(id)) return;
    active.add(id);
    for (const dep of byId.get(id).dependencies || []) dfs(dep);
    active.delete(id);
    seen.add(id);
  };
  for (const id of names) dfs(id);
}
export class AutomataSpine {
  constructor({ root, ownerId, adapters = {} }) {
    if (!root || !ownerId) throw new Error('root and ownerId required');
    this.root = root;
    this.ownerId = ownerId;
    this.adapters = adapters;
  }
  path(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('invalid task id');
    return join(this.root, 'tasks', `${id}.json`);
  }
  async persist(task) {
    const folder = join(this.root, 'tasks');
    await mkdir(folder, { recursive: true });
    const temp = join(folder, `${task.taskId}.${randomUUID()}.tmp`);
    await writeFile(temp, JSON.stringify(task), { flag: 'wx' });
    await rename(temp, this.path(task.taskId));
  }
  async create({ workspaceId, steps, constraints = {}, permissions = [] }) {
    if (!workspaceId) throw new Error('workspaceId required');
    validate(steps);
    const spec = { workspaceId, steps, constraints, permissions };
    const taskId = digest(JSON.stringify(spec));
    try {
      const existing = await this.get(taskId);
      if (JSON.stringify(existing.spec) !== JSON.stringify(spec)) throw new Error('task id collision');
      return existing;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const task = { schema: 'synthia.autonomous-task/v2', taskId, spec, status: 'pending', checkpoints: [], results: {}, blocker: null };
    await this.persist(task);
    return task;
  }
  async get(taskId) { return JSON.parse(await readFile(this.path(taskId), 'utf8')); }
  async run(taskId, { actor }) {
    // This comparison is not authentication. A trusted host must verify the caller's identity.
    if (actor !== this.ownerId) throw new Error('owner authorization required');
    const task = await this.get(taskId);
    const steps = task.spec.steps;
    validate(steps);
    if (task.status === 'verified') return task;
    task.status = 'running'; task.blocker = null;
    await this.persist(task);
    while (Object.keys(task.results).length < steps.length) {
      const step = steps.find(s => !(s.id in task.results) && (s.dependencies || []).every(dep => dep in task.results));
      if (!step) throw new Error('no executable task step');
      const adapter = this.adapters[step.capability];
      if (!adapter || typeof adapter.probe !== 'function' || typeof adapter.execute !== 'function' || typeof adapter.verify !== 'function') {
        task.status = 'blocked'; task.blocker = { stepId: step.id, reason: `capability not registered: ${step.capability}` };
        await this.persist(task); return task;
      }
      let passed = false;
      try { passed = await adapter.probe() === true; }
      catch { passed = false; }
      if (!passed) {
        task.status = 'blocked'; task.blocker = { stepId: step.id, reason: `capability probe failed: ${step.capability}` };
        await this.persist(task); return task;
      }
      const key = digest(`${taskId}:${step.id}`);
      const inputs = Object.fromEntries((step.dependencies || []).map(dep => [dep, task.results[dep].output]));
      try {
        // Adapter is responsible for resource isolation and honoring the idempotency key.
        const output = await adapter.execute({ workspaceId: task.spec.workspaceId, step, inputs, idempotencyKey: key });
        if (await adapter.verify(output, { step, inputs }) !== true) throw new Error(`acceptance rejected: ${step.id}`);
        task.results[step.id] = { capability: step.capability, output, idempotencyKey: key, accepted: true };
        task.checkpoints.push({ stepId: step.id, resultDigest: digest(JSON.stringify(output)), accepted: true });
        task.status = 'running'; task.blocker = null;
        await this.persist(task);
      } catch (error) {
        task.status = 'failed';
        task.blocker = { stepId: step.id, reason: error.message || String(error) };
        task.checkpoints.push({ stepId: step.id, accepted: false, error: task.blocker.reason });
        await this.persist(task);
        return task;
      }
    }
    task.status = 'verified'; task.blocker = null;
    await this.persist(task);
    return task;
  }
}
