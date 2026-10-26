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
