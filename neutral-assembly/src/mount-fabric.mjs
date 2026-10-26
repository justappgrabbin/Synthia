// Neutral Assembly v2.0 / phase 2: content-addressed, immutable workspace mounts.
// No application-domain imports. Actual source ingestion and integrity belong to NeutralAssembly.
import { createHash } from 'node:crypto';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value);
const VALID_SOURCES = new Set(['upload', 'folder', 'archive', 'github', 'library', 'supabase', 'url']);
const genericMarkers = new Map([
  ['package.json', { score: 12, reason: 'Node/package manifest' }],
  ['index.html', { score: 9, reason: 'web entrypoint' }],
  ['vite.config.js', { score: 9, reason: 'Vite build configuration' }],
  ['vite.config.ts', { score: 9, reason: 'Vite build configuration' }],
  ['pyproject.toml', { score: 12, reason: 'Python package manifest' }],
  ['requirements.txt', { score: 6, reason: 'Python dependencies' }],
  ['Cargo.toml', { score: 12, reason: 'Rust manifest' }],
  ['AndroidManifest.xml', { score: 10, reason: 'Android manifest' }],
  ['README.md', { score: 2, reason: 'README evidence' }]
]);
const under = (path, root) => root === '.' ? path : path.startsWith(root + '/') ? path.slice(root.length + 1) : null;
function safeWorkspacePath(path) {
  if (typeof path !== 'string' || !path || path.startsWith('/') || path.includes('\\') || path.includes('\0') || /^[a-zA-Z]:/.test(path) || path.split('/').some(x => !x || x === '.' || x === '..')) {
    throw new Error('unsafe workspace path');
  }
  return path;
}
function normalizeManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.files)) throw new Error('missing source manifest');
  const seen = new Set();
  for (const file of manifest.files) {
    safeWorkspacePath(file.path);
    if (seen.has(file.path)) throw new Error('duplicate manifest path');
    if (!/^[a-f0-9]{64}$/.test(file.digest)) throw new Error('invalid source digest');
    seen.add(file.path);
  }
  return manifest;
}
export function discoverProjectRoots(files) {
  const paths = files.map(x => typeof x === 'string' ? x : x.path);
  const candidates = new Map();
  for (const path of paths) {
    safeWorkspacePath(path);
    const parts = path.split('/');
    const filename = parts.at(-1);
    const marker = genericMarkers.get(filename);
    if (!marker) continue;
    const root = parts.length === 1 ? '.' : parts.slice(0, -1).join('/');
    const value = candidates.get(root) || { path: root, score: 0, evidence: [] };
    value.score += marker.score;
    value.evidence.push(`${filename}: ${marker.reason}`);
    candidates.set(root, value);
  }
  if (!candidates.size) return [{ path: '.', score: 0, evidence: ['no recognized project entrypoint; inspection only'] }];
  return [...candidates.values()].sort((a, b) => b.score - a.score || a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path));
}
export function discoverRuntimeCandidates(files, selectedRoot = '.') {
  const paths = new Set(files.map(f => typeof f === 'string' ? f : f.path).map(p => under(p, selectedRoot)).filter(x => x !== null));
  const candidates = [];
  const add = (name, evidence, mode) => candidates.push({ name, evidence, mode, available: false });
  if (paths.has('index.html')) add('browser-html', ['index.html'], 'probe-required');
  if (paths.has('package.json')) add('node-js', ['package.json'], 'probe-required');
  if (paths.has('vite.config.js') || paths.has('vite.config.ts')) add('vite-build', ['vite.config.js', 'vite.config.ts'].filter(x=>paths.has(x)), 'probe-required');
  if (paths.has('pyproject.toml') || paths.has('requirements.txt')) add('python', ['pyproject.toml','requirements.txt'].filter(x=>paths.has(x)), 'probe-required');
  if (paths.has('AndroidManifest.xml') || [...paths].some(p=>p.endsWith('.apk'))) add('android', ['Android project/container signature'], 'inspection-only');
  if ([...paths].some(p=>p.endsWith('.jar'))) add('jvm', ['JAR artifact'], 'inspection-only');
  return candidates;
}
export class MountFabric {
  constructor({ vault }) {
    if (!vault || !['importFiles', 'importZip', 'get', 'put', 'propose', 'assemble', 'readAssembledFile'].every(k => typeof vault[k] === 'function')) {
      throw new Error('MountFabric requires the real NeutralAssembly storage/overlay contract');
    }
    this.vault = vault;
  }
  async mount({ name, entries, archive, source, sourceVersion = null, provenance = {}, limits = null }) {
    if (!source || !VALID_SOURCES.has(source.kind) || typeof source.ref !== 'string' || !source.ref) throw new Error('source reference required');
    // For remote references, bytes MUST already have been fetched by an authenticated adapter.
    // Do not mark a remote reference mounted if there is no supplied snapshot.
    if ((entries === undefined) === (archive === undefined)) throw new Error('provide exactly one source snapshot: entries or archive');
    if (source.kind === 'github' && !/^[a-f0-9]{40}$/.test(sourceVersion || '')) throw new Error('GitHub mounts require an immutable commit SHA');
    const imported = archive !== undefined ? await this.vault.importZip(name, archive) : await this.vault.importFiles(name, entries);
    const manifest = normalizeManifest(imported.manifest);
    const rootCandidates = discoverProjectRoots(manifest.files);
    const selectedRoot = rootCandidates[0].path;
    const runtimeCandidates = discoverRuntimeCandidates(manifest.files, selectedRoot);
    const descriptor = {
      schema: 'synthia.mount/v2',
      mountId: null, artifactId: imported.manifestId,
      source: { kind: source.kind, ref: source.ref, ...(sourceVersion === null ? {} : { version: sourceVersion }) },
      sourceHash: manifest.sourceDigest || imported.manifestId,
      mountPoint: '/source', mode: 'read-only',
      overlayId: sha256(`overlay:${imported.manifestId}`), manifestHash: imported.manifestId,
      rootCandidates, selectedRoot, runtimeCandidates,
      limits: limits || { maxBytes: this.vault.maxBytes, maxEntries: this.vault.maxFiles, maxDepth: 0 },
      status: 'mounted', errors: [],
      provenance: { ...provenance, sourceRef: source.ref, sourceVersion, sourceHash: manifest.sourceDigest || imported.manifestId, recordedAt: new Date().toISOString() }
    };
    const id = sha256(stable({ ...descriptor, mountId: null }));
    descriptor.mountId = id;
    await this.vault.put('mounts', id, Buffer.from(stable(descriptor)));
    return descriptor;
  }
  async getMount(mountId) {
    if (!/^[a-f0-9]{64}$/.test(mountId)) throw new Error('invalid mount id');
    return JSON.parse(await this.vault.get('mounts', mountId));
  }
  async readSource(mountId, path) {
    safeWorkspacePath(path);
    const descriptor = await this.getMount(mountId);
    const manifest = normalizeManifest(JSON.parse(await this.vault.get('manifests', descriptor.artifactId)));
    const file = manifest.files.find(f => f.path === path);
    if (!file) throw new Error('mounted source file not found');
    return this.vault.get('sources', file.digest);
  }
  async propose(mountId, path, bytes, proposedBy) {
    const descriptor = await this.getMount(mountId);
    return this.vault.propose({ manifestId: descriptor.artifactId, path: safeWorkspacePath(path), content: bytes, proposedBy });
  }
  async accept(mountId, proposalIds, actor) {
    const descriptor = await this.getMount(mountId);
    // The host must authenticate actor; vault checks whether it is the configured owner.
    const assembled = await this.vault.assemble({ manifestId: descriptor.artifactId, proposalIds, actor });
    return { ...assembled, mountId, sourceHash: descriptor.sourceHash };
  }
  async readOverlayAssembly(assemblyId, path) {
    return this.vault.readAssembledFile(assemblyId, safeWorkspacePath(path));
  }
}
