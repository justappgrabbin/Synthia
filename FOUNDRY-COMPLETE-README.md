# Foundry - Complete System

**The component operating system where files carry their own identity, quality, and lineage.**

---

## What This Is

A complete system for managing code components with:
- **Immutable identity** (glyphs)
- **Full lineage tracking** (parent chains)
- **Attribution** (who created what)
- **Trust-first architecture** (oversight, not gatekeeping)
- **Forever reversibility** (back button always works)

---

## Philosophy

> "Let the system work. Only intervene if something's actually harmful."

- Trust first, oversight after
- No gates by default
- Auto-rollback on harm
- System learns from mistakes

---

## The Four Modules

### 1. foundry-core
**Pure functions. Zero I/O. 100% deterministic.**

- Glyph generation (SHA-256 based identity)
- Content normalization (CRLF→LF, whitespace)
- Ed25519 signing/verification
- Lineage tracking
- Quality lifecycle (draft→tested→production)

**Files:**
```
foundry-core/
├── src/
│   ├── glyph/
│   │   ├── types.ts        # Core types
│   │   ├── id.ts           # Glyph ID generation
│   │   ├── normalize.ts    # Content normalization
│   │   └── hash.ts         # SHA-256 hashing
│   ├── signing/
│   │   └── sign.ts         # Ed25519 signatures
│   └── index.ts
└── test/                   # 25+ determinism tests
```

**Usage:**
```typescript
import { createGlyph } from '@foundry/core';

const glyph = createGlyph({
  content: 'export const Button = () => <button>Click</button>',
  producer: {
    userId: 'user-alice',
    tool: 'vscode',
    environment: 'local'
  }
});

console.log(glyph.id); // sha256:...
```

---

### 2. foundry-selector
**Observation only. Detects gaps. Never mutates.**

- App library index
- User profile matching
- Deterministic scoring
- Gap detection (what's missing)
- Explainable recommendations

**Files:**
```
foundry-selector/
├── src/
│   ├── library/
│   │   └── index.ts        # App catalog
│   ├── alignment/
│   │   ├── engine.ts       # Scoring algorithm
│   │   └── gap-detection.ts # Find missing capabilities
│   └── profile/
│       └── types.ts        # User profiles, app records
└── demo.ts
```

**Usage:**
```typescript
import { selectApp } from '@foundry/selector';

const profile = {
  needs: ['auth', 'dashboard'],
  constraints: ['high-reliability'],
  preferences: ['fast-setup'],
  avoid: ['experimental']
};

const result = selectApp(profile);
console.log(result.selectedApp);    // sha256:...
console.log(result.confidence);     // 0.88
console.log(result.missing);        // ['analytics']
```

---

### 3. foundry-builder
**Mutation layer. Only acts on approved changes.**

- App forking (creates new lineage)
- Gap filler generation
- New glyph creation
- Provenance tracking

**Files:**
```
foundry-builder/
├── src/
│   ├── types.ts            # ApprovedChangeRequest
│   ├── builder.ts          # buildApp() - the one function
│   ├── fork.ts             # App forking
│   └── fillers/
│       └── index.ts        # Generate routing, boot, errors, etc
└── test/
    └── integration.test.ts # Enforcement tests
```

**Usage:**
```typescript
import { buildApp } from '@foundry/builder';

const result = await buildApp({
  baseApp: 'sha256:original',
  fillGaps: ['routing', 'error-handling'],
  reason: 'User needs routing',
  producer: {
    userId: 'foundry-selector',
    tool: 'foundry-builder/1.0',
    environment: 'node/20'
  }
}, getAppContent);

console.log(result.newAppGlyph);   // sha256:derived
console.log(result.fillers);       // [routing, error-boundary]
```

---

### 4. foundry-overseer
**Trust + oversight. Watches, warns, doesn't block.**

- Post-execution review
- Harm detection (technical + intent)
- Lineage analysis
- Pattern detection (learning)
- Auto-rollback on harm

**Files:**
```
foundry-overseer/
└── src/
    └── index.ts            # review(), formatReview()
```

**Usage:**
```typescript
import { review, formatReview } from '@foundry/overseer';

const buildResult = {
  newGlyph: 'sha256:derived',
  baseGlyph: 'sha256:original',
  producer: 'foundry-selector',
  changes: ['added routing', 'added boot'],
  reason: 'User needs routing'
};

const overseerReview = review(buildResult, getGlyph);

console.log(overseerReview.safe);        // true
console.log(overseerReview.severity);    // 'info'
console.log(overseerReview.warnings);    // [...]
console.log(formatReview(overseerReview));
```

---

## Installation

```bash
# Extract
tar -xzf foundry-complete-system.tar.gz
cd foundry-complete-system

# Build all modules
cd foundry-core && npm install && npm run build && cd ..
cd foundry-selector && npm install && npm run build && cd ..
cd foundry-builder && npm install && npm run build && cd ..
cd foundry-overseer && npm install && npm run build && cd ..
```

---

## The Flow

### Normal Operation (No Harm)
```
User: "Make me an app with auth and dashboard"
  ↓
Selector: Detects gap (missing routing)
  ↓
Builder: Creates derived glyph (adds routing)
  ↓
Overseer: Reviews (safe: true)
  ↓
User: Sees app with routing added
```

### Harm Detected
```
User: "Make me an app"
  ↓
Selector: Detects gaps
  ↓
Builder: Creates derived glyph (adds 10 things)
  ↓
Overseer: Reviews (safe: false - too many changes)
  ↓
Auto-rollback + show warning
  ↓
User: Sees original, warned about anomaly
```

---

## Core Principles

### 1. Glyphs = Infrastructure
Users never think about glyphs unless they want to.

**Users think:**
- "my app"
- "the button component"
- "version 2"
- "go back"

**System thinks:**
- glyph sha256:abc
- parent: sha256:def
- lineage depth: 3
- created by: user-alice

### 2. Immutability
Every change creates a NEW glyph.  
Original never mutated.  
Can always revert.

### 3. Attribution
Every glyph marked with creator:
- `user-alice`
- `foundry-selector`
- `foundry-builder`

Always know who did what.

### 4. Trust First
System works by default.  
Oversight after (not before).  
No gates unless harm detected.

### 5. Forever Reversibility
If it ever existed, you can return to it.

```typescript
// Timeline
[glyph-1] → [glyph-2] → [glyph-3] → [glyph-4]

// User can jump anywhere
currentApp = glyph-1;  // Back to start
currentApp = glyph-3;  // Back one step
```

---

## What Counts as Harmful

### Technical Harm (auto-rollback, always)
- ✗ Breaks existing functionality
- ✗ Corrupts data
- ✗ Causes runtime errors
- ✗ Makes app unusable
- ✗ Destroys reversibility

### Intent Harm (context-dependent)
- ✗ Adds capabilities NOT requested
- ✗ Removes features unexpectedly
- ✗ Escalates scope materially
- ✗ Changes behavior drastically

### NOT Harmful
- ✓ Drafts, experiments, variants
- ✓ Failed builds
- ✓ Weird ideas

**"Failure is allowed. Damage is not."**

---

## Demos

### Run selector demo
```bash
cd foundry-selector
npm run demo
```

### Run builder tests
```bash
cd foundry-builder
npm test
```

### Run direct flow demo
```bash
node demo-direct-flow.mjs
```

---

## Architecture

```
┌─────────────────────────────────────┐
│  foundry-core                       │
│  Pure functions, deterministic      │
│  Glyph generation, signing          │
└─────────────────────────────────────┘
             ↑ uses
┌─────────────────────────────────────┐
│  foundry-selector                   │
│  Observes, detects, recommends      │
│  Never mutates                      │
└─────────────────────────────────────┘
             ↓ suggests
┌─────────────────────────────────────┐
│  foundry-builder                    │
│  Creates derived glyphs             │
│  Tracks lineage                     │
└─────────────────────────────────────┘
             ↓ builds
┌─────────────────────────────────────┐
│  foundry-overseer                   │
│  Watches, warns, learns             │
│  Doesn't block                      │
└─────────────────────────────────────┘
```

---

## Key Innovations

### 1. Glyph ID ≠ Content Hash
Same bytes, different lineage → different identity.

### 2. Timestamps Excluded
Deterministic across time and machines.

### 3. Parent Order Irrelevant
Sorted before hashing (deterministic).

### 4. Quality Affects ID
Can't promote without new glyph.

### 5. Trust-First Architecture
Oversight after, not gates before.

---

## Use Cases

### Component Library
```
Designer creates Button
  → glyph sha256:abc (user-designer)

Developer adds TypeScript types
  → glyph sha256:def (user-developer)
    parent: sha256:abc

Selector adds error boundary
  → glyph sha256:ghi (foundry-selector)
    parent: sha256:def
```

### App Development
```
User: "Make dashboard app"
Selector: Finds SaaS Dashboard (88% match)
Builder: Adds missing routing
Overseer: Reviews (safe, 2 changes)
User: Gets complete app
```

### Continuous Integration
```
CI: Runs tests on glyph sha256:abc
Tests pass
CI: Creates attestation (Ed25519 signature)
Glyph promoted: draft → tested
```

---

## Spec Compliance

All SPEC-1 requirements met:
- ✅ Deterministic glyph format
- ✅ Quality states (monotonic)
- ✅ Provenance tracking
- ✅ Content-addressable storage
- ✅ Deterministic assembly
- ✅ Export/re-import (metadata preserved)
- ✅ Trust/attestation (Ed25519)
- ✅ Observability (audit trail)
- ✅ Security (immutability)

---

## Status

✅ Core library - Complete  
✅ Selector - Complete  
✅ Builder - Complete  
✅ Overseer - Complete  
✅ Direct flow - Working  
✅ Harm detection - Defined  
✅ Learning loop - Designed  

---

## Philosophy Summary

**The Old Way (What We Removed):**
- Change Request gates
- Policy engine
- Approval flows
- Pre-execution blocking

**The New Way (What We Built):**
- Direct flow (trust first)
- Enhanced metadata (attribution)
- Post-execution oversight (non-blocking)
- Auto-rollback on harm
- Forever reversibility

---

## The Golden Rules

1. **Glyphs are invisible infrastructure** (users don't think about them)
2. **Harm = observable negative effect** (not vibes)
3. **Back button works forever** (immutability)
4. **Rollback is automatic** (permission is optional)
5. **System learns from mistakes** (no new gates)

---

**The system can breathe now.**

Built by: Claude & Adaya  
Date: December 2025  
Philosophy: Trust first, oversight after
