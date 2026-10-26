// A14 first gate: neutral startup must not traverse outside its package or import domain code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../src');

test('neutral source import graph is limited to the package and Node core', async () => {
  const files = (await readdir(root)).filter(x => x.endsWith('.mjs'));
  assert.ok(files.includes('index.mjs'));
  assert.ok(files.includes('mount-fabric.mjs'));
  assert.ok(files.includes('automata-spine.mjs'));
  assert.ok(files.includes('backend-resolver.mjs'));
  for (const file of files) {
    const content = await readFile(join(root, file), 'utf8');
    const imports = [...content.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)].map(x => x[1]);
    for (const dependency of imports) {
      assert.ok(dependency.startsWith('node:') || (dependency.startsWith('./') && resolve(root, dependency).startsWith(root + '/')), `${file} imports non-neutral dependency ${dependency}`);
    }
    // Tripwire beyond the import boundary; not a substitute for a runtime SQL/source graph audit.
    assert.doesNotMatch(content, /(?:from\s*['"]|import\s*\(['"])[^'"]*(?:chart|astrology|planetary|bodygraph|zodiac)[^'"]*['"]/i);
  }
});
