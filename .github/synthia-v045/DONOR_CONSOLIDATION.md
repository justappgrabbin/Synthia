# Synthia Birth Candidate — Donor Consolidation

Canonical goal: preserve the currently shipped Synthia residence and state, use the repaired Android embedded-Node launcher/runtime, mount the current Synthai2 application layer, reconnect the canonical `Synthia-server` backend lineage, and transplant only unique capabilities from older repositories. No donor becomes a competing canonical runtime or backend.

See `SERVER_LINEAGE.md` for the non-negotiable split between the phone-local residence server, `Synthia-server`, Supabase, and Synthai2.

## Current canonical inputs

### Existing installed/shipped Synthia
- Preserve full residence payload and existing app identity (`com.synthia.phone`).
- Preserve persistent Android app data by updating with the same signing identity.
- Preserve Pure Synthia, Foundry/tooling, Morph/state-space modules, Inbox and existing artifacts.
- Preserve the phone-local server only for its correct local/offline role; it is not allowed to become a competing remote backend.

### `justappgrabbin/Synthia-server` — canonical backend lineage
Pinned integration frontier for this pass: `a39bc304387097927f969fd5dd4818822705ed1e`.

This is not an optional donor. It is the canonical backend/integration-hub lineage that the phone residence must reconnect to.

Keep/merge by role:
- canonical integration queue and dependency-order contract
- Control Center/admin hub
- address logic
- upload/artifact routing
- MCP/message coordination contracts
- graph/gap/mix integration
- Synthia bridge infrastructure

Do not copy `server/lite.js` wholesale into the Android runtime. Its current implementation contains remote-host assumptions, shell/process spawning, Node 24 requirements, and optional Python/Trident process control. Port only the needed contracts/routes into the phone-safe local runtime. Supabase remains durable persistence/sync.

### `justappgrabbin/Synthai2`
Use current `main` at build time as the current full-stack application/source donor and record the resolved commit in the APK residence.

Current app/server source includes:
- React/Vite application surface
- Express API
- local in-memory storage model
- workspace file APIs
- persistent mesh-event API
- app mount/run APIs
- Human Design/chart/transit/growth services
- external integration helpers
- older Linux-container/Python controls

For Android, keep the app surface and local-capable services, but do not start a second authoritative backend. Container/Python/external-AI services are not required for boot. API behavior needed by the app is adapted into the phone-local residence server or routed to the canonical `Synthia-server` backend.

## Historical donor repositories

### `justappgrabbin/cautious-octo-doodle`
Role: source-preserving organ bank / audit archive. Do not boot it as the canonical runtime.

Useful preserved capabilities include:
- Pure Synthia substrate (`Synthia_Morph_Substrate_FULL_PureJS.html`)
- MemoryStore / PureMemorySubstrate
- MorphField / QuantumPotentialNode
- RelationalSentenceEngine / PressureEngine / AutonomyEngine
- UniversalIngester
- IntegrationCircuitSubstrate / VisualCircuitMesh
- MRNN kernel
- Morph orchestrator core + bootstrap
- materializeApp
- MCP bridge
- app-center / builder / SVG studio / mesh-matrix / body-app concepts
- unique-pattern extraction inventories and source-preserving archives

Rule: compare by capability and source identity. Import only genuinely missing or newer organs; do not restore duplicate shells.

### `justappgrabbin/cuddly-doodle`
Role: older experimental Synthia implementation. Do not copy its Python/Flask runtime into the phone residence.

Potential capability donors to port/adapt into current JS architecture if not already superseded:
- ephemeris + current transit logic
- field scanner / resonance weighting concepts
- collapse engine concepts
- memory pattern-learning concepts
- avatar/expression/speech synchronization concepts
- persona modulation concepts
- self-builder gap-detection / evolution concepts
- quest + glyph logging concepts

Any retained capability must be implemented in the current JS/in-process Synthia architecture or registered as reference material. Python, Flask, OpenAI-required, shell-required, SQLite-only and Replit-specific infrastructure are not runtime dependencies for the Android birth candidate.

### `justappgrabbin/urban-couscous` — pin `1e94d4dc72d7fb9bb5f6cbf5e462284363bcf7ba`
Role: August Pure-JS Klein/research-module donor.

Keep:
- `src/research-modules/diseminer.js` — executable local distributional-semantics model
- `src/research-modules/autoling-1968.js`
- `src/research-modules/automatic-novel-writing.js`
- `src/research-modules/historical-change-in-language.js`
- `src/research-modules/llm-change-paper.js`
- `src/research-modules/index.js`

Do not activate `GENESIS-INITIALIZER.js` as canonical logic: it contains demo/random identity generation and simulated connection states. Preserve only as provenance/reference if needed.

### `justappgrabbin/LCM-State-space-` — pin `e83549266ed63f495175450627e3fe54c7ad2343`
Role: LCM/state-space/resonance donor.

Strong missing organs:
- `extracted/session_build-1/hopfieldAttractor.js`
- `extracted/session_build-1/stateSpace.js`
- `extracted/session_build-1/resonance_engine.js`
- `extracted/session_build-1/kingWen.js`
- `extracted/session_build-1/spectrumColor.js`
- `extracted/session_build-1/dimensionalChannel.js`
- `extracted/session_build-1/dimensionalEdge.js`
- `extracted/session_build-1/channelArchitectures.js`
- `extracted/session_build-1/witness.js`

Python alternates remain reference-only. The JS versions are the preferred donors for the phone runtime.

### `justappgrabbin/Linux` — pin `65914438f1adad6f3f4e6bba7b20902fa950629f`
Role: historical merged-package manifest and binary donor archive.

Its recorded merge combines the Kimi shell, AION runtime/functions, Synthia/Syntia bridges, resonance analysis and Docker/APK tooling. Treat it as provenance and a fallback source archive. Do not make its Kimi shell canonical and do not reactivate old container/PC requirements on the phone.

### `justappgrabbin/Aion`
Current head intentionally deleted most application source. Preserve/recover the useful pre-deletion source from commit `930455bb0c1112f61625970d0ab8fd56be41fde8` rather than treating the sparse head as the complete AION implementation.

Recoverable source includes the typed `FileNode`, mesh, ingestion, agent, Human Design, resonance, symbolic-signature, hypothesis and project contracts. These are schema/interface donors; they do not replace the current Synthia runtime.

### `justappgrabbin/SynthAIPRODeploy` — pin `1b7bdd1334c771f844b1bcbc2030907f19aba22c`
Role: older deployment/UI/ingestion donor.

Useful donors:
- `FileIngestionEngine.tsx`
- `AdminDashboard.tsx`
- Body/OS/Notebook interfaces
- older APK workflow and Capacitor build lessons
- Supabase provider/UI patterns

Do not restore its old phone model (PC container + same-Wi-Fi browser/PWA), Python AION runtime, or Pyodide as required phone infrastructure. The current embedded-Node Android residence supersedes that deployment model.

### `justappgrabbin/Sentai-Sentai-okay-since-I-sent-her-yes-that-s-right` — pin `9f6f33afd6dcd3db297d6754ee2f7bf63b336652`
Role: SPEC-1 / resonance / OS-shell donor.

Strong missing organs:
- `data/SPEC1_implementation.ts`
- `data/qian-kernel.js`
- `data/canonical/384-spectrum.json`
- `data/chromesthesia_knowledge.json`
- `data/isobench_knowledge.json`
- `data/isobench_mrnn_benchmark.json`
- `data/unified_crossmodal_knowledge_graph.json`
- `data/synthia-os-client.js`
- `server/mcp-continuity-server.js` as packet-contract reference only
- `src/apps/os-shell/**` as UI donor only

Do not treat placeholder ephemeris math in the SPEC-1 starter as authoritative astronomy.

### `justappgrabbin/shiny-fiesta` — pin `7a1703a0136b4022da58ab8650d1659ba789c0d6`
Role: repaired browser/store compatibility donor.

The recorded build passed with 1,738 transformed modules and preserved its OS store, App Center/App Store, browser bridge, render backend and dual-server/RAG concepts. Treat the surviving compatibility/build notes as provenance and recover source only from Git history if a current capability gap specifically requires it.

### `justappgrabbin/didactic-octo-disco` — pin `9a3bfda679ee7242cc825ad9e147e9aed4d1110b`
Role: historical Morph/MRNN bridge application donor.

It contains a compiled app plus legacy `MRNN_MCP_Orchestrator.js`, MRNN MCP client, Morph frontend/demo, resonance OS brain, a Synthia integration checkpoint, and old Python QHD/Trident services. `Synthia-server` already carries the didactic message bridge, so do not duplicate that bridge. Preserve the MRNN/Morph logic only when it adds behavior not already present in Pure Synthia.

### `justappgrabbin/resonance-neural-net` — pin `cb30a6e9d5ad68412bfcea19029ee184664185bb`
Role: resonance-orchestrator donor explicitly designed to connect to `Synthia-server`.

Strong donor:
- `client/src/lib/orchestrator.ts` — self-assembling resonance orchestrator with node lifecycle, senses, connecting points, Super Base retrieval, RAG/code/MCP interfaces, discovery and assembly concepts.
- neural mesh visualization / meta-orchestrator UI may be retained as tooling surfaces.

Do not import its older coordinate constants as the canonical address spine. Its 5-mesh/13-layer/center/node addressing predates the current canonical Synthia address model. Port the orchestration mechanics onto the current state/address model instead.

### `justappgrabbin/SynthAI-Hub` — pin `c270f50116dc973967e6ed39a74808267d86ac76`
Role: historical backend/control-center duplicate.

Its `README.md`, `control-center-api.js`, and `mcp-hub-addon.js` are byte-identical to files already represented in the `Synthia-server` lineage. Do not mount this as a second hub. Preserve its `synthia-populate-workflow.yml` only as historical automation/provenance if useful.

## Selected missing-organ queue

Explicitly missing or materially distinct from the current canonical runtime under their donor identities:
1. Hopfield gate attractor implementation.
2. SPEC-1 TypeScript implementation starter.
3. Qian kernel implementation.
4. August Pure-JS distributional DISEMINER research module.
5. Resonance neural-net orchestration mechanics, adapted to the current canonical address/state model.

The birth build preserves pinned donor sources under `pure-synthia/donors/recovered/`. Activation remains capability-by-capability after compatibility verification; preservation does not imply unreviewed execution.

## Selection rules

1. Current working Synthia behavior wins over an older donor.
2. Unique capability is preserved even when its old shell is discarded.
3. Duplicate implementations are not mounted as separate apps unless they expose materially different behavior.
4. No Acode dependency.
5. No first-boot Node/npm installation dependency.
6. MCP remains a message-passing layer, not Synthia's brain.
7. Phone state is persistent; APK payload upgrades must not erase user state.
8. Backend-delivered artifacts are acknowledged only after successful local persistence and checksum verification.
9. The new UI must not hide or orphan legacy residence artifacts; legacy modules remain addressable through the residence/app registry.
10. Donor files are commit-pinned for reproducibility; moving repository heads cannot silently change the APK payload.
11. `Synthia-server` is the canonical backend lineage. Supabase is persistence/sync. The phone-local server is the offline residence host. Synthai2 is the current app/source layer.

## Freeze condition

Do not issue the replacement APK until:
- current Synthai2 main is built/preserved and its required local APIs have a working phone-safe route;
- `Synthia-server` is reconnected as the canonical backend lineage rather than silently replaced;
- all named donor repositories have been capability-diffed against the consolidated runtime;
- selected unique organs are mounted or explicitly retained as reference/dormant source;
- sync, persistence, Inbox/admin actions, uploader, builder intake, runtime restart/recovery and local UI startup pass build verification.
