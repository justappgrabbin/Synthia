# Synthia Birth Candidate — Server Lineage

This file prevents the Android birth build from replacing one server with an unrelated server merely because both expose HTTP routes.

## Canonical server roles

### 1. Phone-local residence server
Runs inside the Android app under the embedded Node runtime.

Responsibilities:
- boot and supervise Pure Synthia locally
- serve the phone UI on localhost
- persist local state under the Android residence data directory
- run the local builder/watch/intake pipeline
- maintain local inbox/message-passing routes
- perform durable phone sync, checksum verification, local artifact persistence and acknowledgement
- keep the app usable offline

This role may reuse code from the currently shipped APK because it already contains the local daemon, builder, residence and offline-serving machinery. It is NOT the canonical remote backend and must not invent a competing remote state store.

### 2. `justappgrabbin/Synthia-server`
Canonical remote backend / integration hub lineage.

Pinned source for this birth pass: `a39bc304387097927f969fd5dd4818822705ed1e`.

Responsibilities represented in the repository:
- Control Center / admin-facing hub
- upload and artifact routing
- canonical address logic
- MCP/message coordination
- graph/gap/mix integration work
- Synthia integration queue and dependency ordering
- remote API surface for phone/agents

Its own integration contract states that Supabase is persistence/sync rather than the authoritative runtime and that MCP is a message/coordination bridge rather than Synthia itself.

Do not copy `server/lite.js` wholesale into Android. That file currently contains remote-host assumptions, shell/process spawning, Node 24 requirements and optional Python/Trident process control. Those are not phone boot requirements. Preserve its useful contracts and routes while keeping dangerous/nonportable effectors out of the local runtime.

### 3. Supabase
Shared durable persistence and synchronization layer.

Responsibilities:
- canonical synced records/events
- release/binary storage and manifest delivery
- participant/sync state
- backend persistence shared by phone and remote Synthia services

The phone must persist locally first and acknowledge remote artifacts only after local persistence + checksum verification.

### 4. `justappgrabbin/Synthai2`
Current full-stack application/source donor, not a second canonical backend.

Current `main` contains:
- React/Vite app surface
- Express server
- in-memory storage implementation
- workspace APIs
- mesh event store
- app mount/run API
- Human Design/chart/transit/growth services
- older Linux-container/Python controls and external integration helpers

For Android:
- build and preserve the current app/UI source and local-capable services;
- port or adapt local-capable APIs into the phone residence server where needed;
- do not start a competing persistence backend;
- do not make Python/container/external-AI services required for boot;
- remote persistence/coordination goes through the canonical Synthia-server + Supabase lineage.

## Merge rule

The final phone architecture is:

`Android launcher + embedded Node`
→ `phone-local Synthia residence server`
→ `Pure Synthia + local state + local apps`
↔ `Synthia-server canonical backend/integration hub`
↔ `Supabase durable persistence/sync`

`Synthai2` contributes the current application surface and useful services into that architecture. It does not create another authoritative state spine.

## No silent substitution rule

Before a server implementation can replace another one, the build must identify:
1. its repository/source commit;
2. its role (local runtime vs remote backend vs persistence);
3. the routes/capabilities it replaces;
4. the state it owns;
5. the offline behavior it changes;
6. any dependencies it introduces.

If those six facts are not explicit, the server is a donor only and cannot replace a canonical role.
