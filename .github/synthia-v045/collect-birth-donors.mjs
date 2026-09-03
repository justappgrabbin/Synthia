import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const [residenceDir] = process.argv.slice(2);
if (!residenceDir) throw new Error('usage: collect-birth-donors.mjs <residence-dir>');

const donorFiles = [
  // canonical backend lineage contracts/source
  ['Synthia-server','a39bc304387097927f969fd5dd4818822705ed1e','integration/README.md','backend'],
  ['Synthia-server','a39bc304387097927f969fd5dd4818822705ed1e','address.ts','backend'],
  ['Synthia-server','a39bc304387097927f969fd5dd4818822705ed1e','bridges/didactic-octo-disco-bridge.ts','backend'],
  ['Synthia-server','a39bc304387097927f969fd5dd4818822705ed1e','control-center-api.js','backend'],
  ['Synthia-server','a39bc304387097927f969fd5dd4818822705ed1e','mcp-hub-addon.js','backend'],

  // Pure-JS Klein research organs
  ['urban-couscous','1e94d4dc72d7fb9bb5f6cbf5e462284363bcf7ba','src/research-modules/index.js','research'],
  ['urban-couscous','1e94d4dc72d7fb9bb5f6cbf5e462284363bcf7ba','src/research-modules/diseminer.js','research'],
  ['urban-couscous','1e94d4dc72d7fb9bb5f6cbf5e462284363bcf7ba','src/research-modules/autoling-1968.js','research'],
  ['urban-couscous','1e94d4dc72d7fb9bb5f6cbf5e462284363bcf7ba','src/research-modules/automatic-novel-writing.js','research'],
  ['urban-couscous','1e94d4dc72d7fb9bb5f6cbf5e462284363bcf7ba','src/research-modules/historical-change-in-language.js','research'],
  ['urban-couscous','1e94d4dc72d7fb9bb5f6cbf5e462284363bcf7ba','src/research-modules/llm-change-paper.js','research'],

  // state-space / attractor organs
  ['LCM-State-space-','e83549266ed63f495175450627e3fe54c7ad2343','extracted/session_build-1/hopfieldAttractor.js','state-space'],
  ['LCM-State-space-','e83549266ed63f495175450627e3fe54c7ad2343','extracted/session_build-1/stateSpace.js','state-space'],
  ['LCM-State-space-','e83549266ed63f495175450627e3fe54c7ad2343','extracted/session_build-1/resonance_engine.js','state-space'],
  ['LCM-State-space-','e83549266ed63f495175450627e3fe54c7ad2343','extracted/session_build-1/kingWen.js','state-space'],
  ['LCM-State-space-','e83549266ed63f495175450627e3fe54c7ad2343','extracted/session_build-1/spectrumColor.js','state-space'],
  ['LCM-State-space-','e83549266ed63f495175450627e3fe54c7ad2343','extracted/session_build-1/dimensionalChannel.js','state-space'],
  ['LCM-State-space-','e83549266ed63f495175450627e3fe54c7ad2343','extracted/session_build-1/dimensionalEdge.js','state-space'],
  ['LCM-State-space-','e83549266ed63f495175450627e3fe54c7ad2343','extracted/session_build-1/channelArchitectures.js','state-space'],
  ['LCM-State-space-','e83549266ed63f495175450627e3fe54c7ad2343','extracted/session_build-1/witness.js','state-space'],

  // SPEC-1 / Qian / canonical data
  ['Sentai-Sentai-okay-since-I-sent-her-yes-that-s-right','9f6f33afd6dcd3db297d6754ee2f7bf63b336652','data/SPEC1_implementation.ts','spec1'],
  ['Sentai-Sentai-okay-since-I-sent-her-yes-that-s-right','9f6f33afd6dcd3db297d6754ee2f7bf63b336652','data/qian-kernel.js','spec1'],
  ['Sentai-Sentai-okay-since-I-sent-her-yes-that-s-right','9f6f33afd6dcd3db297d6754ee2f7bf63b336652','data/canonical/384-spectrum.json','spec1'],
  ['Sentai-Sentai-okay-since-I-sent-her-yes-that-s-right','9f6f33afd6dcd3db297d6754ee2f7bf63b336652','data/unified_crossmodal_knowledge_graph.json','spec1'],

  // resonance orchestrator mechanics; address constants are donor-only
  ['resonance-neural-net','cb30a6e9d5ad68412bfcea19029ee184664185bb','client/src/lib/orchestrator.ts','orchestration'],
  ['resonance-neural-net','cb30a6e9d5ad68412bfcea19029ee184664185bb','client/src/components/NeuralMeshVisualizer.tsx','orchestration'],
  ['resonance-neural-net','cb30a6e9d5ad68412bfcea19029ee184664185bb','client/src/components/MetaOrchestratorPanel.tsx','orchestration'],

  // selected older deployment/AION provenance
  ['Aion','930455bb0c1112f61625970d0ab8fd56be41fde8','index.ts','contracts'],
  ['SynthAIPRODeploy','1b7bdd1334c771f844b1bcbc2030907f19aba22c','FileIngestionEngine.tsx','ingestion'],
  ['shiny-fiesta','7a1703a0136b4022da58ab8650d1659ba789c0d6','MERGE_NOTES.md','provenance'],
  ['Linux','65914438f1adad6f3f4e6bba7b20902fa950629f','artifacts/MERGED_PACKAGE_STATUS.md','provenance'],
  ['didactic-octo-disco','9a3bfda679ee7242cc825ad9e147e9aed4d1110b','legacy/MRNN_MCP_Orchestrator.js','orchestration'],
  ['SynthAI-Hub','c270f50116dc973967e6ed39a74808267d86ac76','.github/workflows/synthia-populate-workflow.yml','provenance'],
];

const root = path.join(residenceDir, 'pure-synthia', 'donors', 'recovered');
await fs.mkdir(root, { recursive: true });
const manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  policy: 'Pinned donor source is preserved. Runtime activation requires compatibility verification and canonical-address adaptation.',
  files: [],
};

for (const [repo, commit, sourcePath, role] of donorFiles) {
  const encoded = sourcePath.split('/').map(encodeURIComponent).join('/');
  const url = `https://raw.githubusercontent.com/justappgrabbin/${repo}/${commit}/${encoded}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`donor fetch failed ${response.status}: ${repo}@${commit}/${sourcePath}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const destination = path.join(root, repo, sourcePath);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes);
  manifest.files.push({
    repo,
    commit,
    sourcePath,
    role,
    size: bytes.length,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  });
}

await fs.copyFile(path.join(process.cwd(), '.github/synthia-v045/SERVER_LINEAGE.md'), path.join(root, 'SERVER_LINEAGE.md'));
await fs.copyFile(path.join(process.cwd(), '.github/synthia-v045/DONOR_CONSOLIDATION.md'), path.join(root, 'DONOR_CONSOLIDATION.md'));
await fs.writeFile(path.join(root, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`preserved ${manifest.files.length} pinned donor files`);
