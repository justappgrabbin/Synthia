import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const hex = input => createHash('sha256').update(input).digest('hex');
const bytes = input => Buffer.isBuffer(input) ? input : Buffer.from(input);
const fixed = value => JSON.stringify(value);
function safePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\') || path.includes('\0') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) throw new Error('unsafe artifact path');
  const parts = path.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new Error('unsafe artifact path');
  return path;
}
function crc32(data) {
  let crc = 0xffffffff;
  for (const b of data) {
    crc ^= b;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function unpackZip(raw, { maxFiles, maxBytes }) {
  const data = bytes(raw);
  if (data.length < 22) throw new Error('invalid ZIP');
  let end = -1;
  for (let p = data.length - 22; p >= Math.max(0, data.length - 65557); p--) {
    if (data.readUInt32LE(p) === 0x06054b50 && p + 22 + data.readUInt16LE(p + 20) === data.length) { end = p; break; }
  }
  if (end < 0 || data.readUInt16LE(end + 4) || data.readUInt16LE(end + 6)) throw new Error('invalid ZIP directory');
  const count = data.readUInt16LE(end + 10);
  const size = data.readUInt32LE(end + 12);
  let at = data.readUInt32LE(end + 16), total = 0;
  if (count > maxFiles || at + size > end || count !== data.readUInt16LE(end + 8)) throw new Error('ZIP limits or directory mismatch');
  const stop = at + size, files = [], paths = new Set();
  for (let i = 0; i < count; i++) {
    if (at + 46 > stop || data.readUInt32LE(at) !== 0x02014b50) throw new Error('invalid ZIP entry');
    const flags = data.readUInt16LE(at + 8), method = data.readUInt16LE(at + 10);
    const expectedCrc = data.readUInt32LE(at + 16), compressed = data.readUInt32LE(at + 20), expanded = data.readUInt32LE(at + 24);
    const nameLength = data.readUInt16LE(at + 28), extraLength = data.readUInt16LE(at + 30), commentLength = data.readUInt16LE(at + 32);
    const start = at + 46, next = start + nameLength + extraLength + commentLength;
    if (next > stop || flags & 1 || !(method === 0 || method === 8) || flags & 0x800 && nameLength === 0) throw new Error('unsupported ZIP entry');
    const name = data.subarray(start, start + nameLength).toString('utf8');
    const local = data.readUInt32LE(at + 42);
    at = next;
    if (name.endsWith('/')) continue;
    safePath(name);
    if (paths.has(name)) throw new Error('duplicate ZIP path');
    paths.add(name);
    if (expanded > maxBytes || total + expanded > maxBytes) throw new Error('ZIP expanded limit');
    if (local + 30 > data.length || data.readUInt32LE(local) !== 0x04034b50) throw new Error('invalid ZIP local header');
    const payloadStart = local + 30 + data.readUInt16LE(local + 26) + data.readUInt16LE(local + 28);
    if (payloadStart + compressed > data.length || payloadStart + compressed > end) throw new Error('truncated ZIP');
    const packed = data.subarray(payloadStart, payloadStart + compressed);
    const body = method === 0 ? packed : inflateRawSync(packed, { maxOutputLength: maxBytes + 1 });
    if (body.length !== expanded || crc32(body) !== expectedCrc) throw new Error('ZIP integrity mismatch');
    total += expanded;
    files.push({ path: name, content: body });
  }
  if (at !== stop) throw new Error('ZIP directory length mismatch');
  return files;
}
export class NeutralAssembly {
  constructor({ root, ownerId, maxFiles = 256, maxBytes = 16 * 1024 * 1024 }) {
    if (!root || !ownerId) throw new Error('root and ownerId required');
    this.root = root;
    this.ownerId = ownerId;
    this.maxFiles = maxFiles;
    this.maxBytes = maxBytes;
  }
  async put(collection, digest, content) {
    const folder = join(this.root, collection);
    await mkdir(folder, { recursive: true });
    const path = join(folder, digest);
    try { await writeFile(path, content, { flag: 'wx' }); }
    catch (error) {
      if (error.code !== 'EEXIST' || !(await readFile(path)).equals(bytes(content))) throw error;
    }
  }
  async get(collection, digest) {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('invalid digest');
    return readFile(join(this.root, collection, digest));
  }
  async importFiles(name, entries, source = null) {
    safePath(name);
    if (!Array.isArray(entries) || entries.length > this.maxFiles) throw new Error('file limit exceeded');
    const seen = new Set(), normalized = [];
    let total = 0;
    for (const entry of entries) {
      const path = safePath(entry.path);
      if (seen.has(path)) throw new Error('duplicate artifact path');
      seen.add(path);
      const content = bytes(entry.content);
      total += content.length;
      if (total > this.maxBytes) throw new Error('expanded bytes limit');
      normalized.push({ path, digest: hex(content), content });
    }
    if (source) await this.put('sources', hex(source), bytes(source));
    for (const entry of normalized) await this.put('sources', entry.digest, entry.content);
    const manifest = {
      schema: 'synthia.neutral-assembly/v1', name,
      sourceDigest: source ? hex(source) : null,
      files: normalized.map(({ path, digest, content }) => ({ path, digest, bytes: content.length }))
        .sort((a, b) => a.path.localeCompare(b.path))
    };
    const manifestBytes = Buffer.from(fixed(manifest));
    const manifestId = hex(manifestBytes);
    await this.put('manifests', manifestId, manifestBytes);
    return { manifestId, manifest };
  }
  importZip(name, archive) {
    const data = bytes(archive);
    return this.importFiles(name, unpackZip(data, this), data);
  }
  async propose({ manifestId, path, content, proposedBy }) {
    safePath(path);
    if (!proposedBy) throw new Error('proposer required');
    await this.get('manifests', manifestId);
    const data = bytes(content), digest = hex(data);
    if (data.length > this.maxBytes) throw new Error('overlay too large');
    await this.put('sources', digest, data);
    const proposal = { manifestId, path, digest, proposedBy };
    const raw = Buffer.from(fixed(proposal)), proposalId = hex(raw);
    await this.put('proposals', proposalId, raw);
    return { proposalId, proposal };
  }
  async assemble({ manifestId, proposalIds = [], actor }) {
    // The caller must supply a verified actor identity; this is not an authentication service.
    if (actor !== this.ownerId) throw new Error('owner approval required');
    const manifest = JSON.parse(await this.get('manifests', manifestId));
    const output = new Map(manifest.files.map(entry => [entry.path, entry.digest]));
    if (proposalIds.length > this.maxFiles) throw new Error('proposal limit exceeded');
    for (const proposalId of proposalIds) {
      const proposal = JSON.parse(await this.get('proposals', proposalId));
      if (proposal.manifestId !== manifestId) throw new Error('proposal source mismatch');
      safePath(proposal.path);
      await this.get('sources', proposal.digest);
      output.set(proposal.path, proposal.digest);
    }
    const files = [...output].map(([path, digest]) => ({ path, digest })).sort((a, b) => a.path.localeCompare(b.path));
    const receipt = { schema: 'synthia.neutral-assembly-receipt/v1', manifestId, proposalIds, approvedBy: actor, files };
    const raw = Buffer.from(fixed(receipt)), assemblyId = hex(raw);
    await this.put('assemblies', assemblyId, raw);
    return { assemblyId, receipt };
  }
  async readAssembledFile(assemblyId, path) {
    const receipt = JSON.parse(await this.get('assemblies', assemblyId));
    const record = receipt.files.find(f => f.path === safePath(path));
    if (!record) throw new Error('assembly file not found');
    return this.get('sources', record.digest);
  }
}
export { crc32, unpackZip };
