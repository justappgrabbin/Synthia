# Neutral Assembly (source reconstruction v0.1)

This directory repairs the missing working-directory failure in [Neutral assembly CI run #35658341330](https://github.com/justappgrabbin/Synthia/actions/runs/35658341330). It is a **new, bounded implementation**, not a recovered copy of the never-committed September 21 source snapshot. The original two workflow files and branch are preserved.

## Executable behavior

- Accepts individual file entries or a validated ZIP (stored and DEFLATE entries).
- Content-addresses and persists original bytes with SHA-256; ZIP originals are retained unmodified.
- Generates deterministic source manifests and append-only proposals.
- Requires an explicitly supplied owner identity when creating a materialized assembly. The host must authenticate that identity; the library alone is not an authentication boundary.
- Emits durable, content-addressed assembly receipts and reads assembled files after reopening the store.
- Rejects path traversal, duplicate ZIP names, CRC mismatches, excessive ZIP expansion, cross-source proposals, and missing approvals.

## Verify

Run `cd neutral-assembly && npm test && npm run compliance` with Node >=22. No npm install or third-party dependencies are required.

## Not implemented or claimed

The missing original Neutral Assembly package has **not** been recovered. This module does not mount GitHub repositories, execute arbitrary source code, repair projects, provide a UI, or independently authenticate users. It provides tested immutable ingestion and approval-bounded assembly primitives for subsequent integration. Do not mark original delivery acceptance criteria complete solely because CI turns green.


## Specification v2.0 implementation increment (not a full release)

Primary design contract: **Resonance Neutral Assembly Spec v2.0, 2026-09-21** (26 pages).
This increment preserves the original source vault and adds compositional modules:

- `src/mount-fabric.mjs`: immutable mount descriptors backed by the real source vault, ranked project-root detection, runtime candidates (never marked executable without a probe), source reading, approved overlays.
- `src/automata-spine.mjs`: bounded dependency-aware task graph, actual registered adapter execution, acceptance predicates, persisted checkpoints, restart-safe skip of accepted steps, explicit blocked/failed states.
- `src/backend-resolver.mjs`: no default remote server, evidence/probe-based lane selection with explicit rejection reasons. Never claims a generated backend without a registered passing adapter.
- `test/spec-*.test.mjs` and `test/import-boundary.test.mjs`: exercised end-to-end Node ingest/mount/task/approval/restart path, failure paths, and neutral-import boundary.

### Explicit remaining specification requirements

The full **A01–A18 release acceptance suite has NOT yet passed**. The tests here do not prove phone-browser preview, GitHub API acquisition/commit overlay, Library/Supabase remote adapters, TAR/TGZ/nested archive traversal, browser/worker/Python/Android runtime probes, secure execution sandbox, backend package generation, cross-device publication, reproducible node import, Supabase RLS, or a full branch-conflict acceptance gate.

Importantly, passing the current CI does not mean physical Android acceptance or complete system verification. A capability requires a real host adapter, real probe, permissions and observed output. `ownerId` comparisons alone do not authenticate a caller. Any non-idempotent external tool must honor the supplied idempotency key; restart cannot magically make an external side effect atomic.

No legacy files have been deleted and no existing Synthia domain-specific modules are imported by the neutral startup path. This enforces the **separation requested by the specification** without claiming that specialized Synthia worlds or state-address systems are invalid or impossible.
