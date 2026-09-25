# Research + Report Automaton v0.1.0

Additive bounded-automata cartridge for Synthia. It does not replace or modify the protected 5.8/Prime baseline.

Flow:

question -> ResearchScout -> EvidenceMiner -> ScientistLoop -> ReportPlanner -> ReportWriter -> ReportVerifier -> Publisher

What is included in the ZIP:
- research-report-automaton.js
- demo.html
- manifest.json
- test.js
- README.md

Runtime behavior:
- accepts local/supplied source text immediately
- automatically uses window.SynthiaResearchBridge when 5.8 exposes browser/container research access
- includes a no-key Wikipedia research fallback
- creates traceable source artifacts, evidence objects, claims, findings, contradiction records, Markdown/HTML reports, provenance, and verification output
- rejects invalid citation/source/claim links during verification
- exports report.md, report.html, claims.json, sources.json, provenance.json, verification.json

Verification performed before upload:
- deterministic success-path test passed
- 3 sources -> 7 claims -> 6 findings
- support coverage: 1.000
- invalid-citation / unsupported-finding failure-path test passed

Donor mechanisms preserved:
- SYNTHIA-CONTRACTS.md
- synthia-autonomous-dev.html makeProcess / DISEMINER / AutoNovel
- pure-synthia-research-proposal.md evidence, hypothesis, derivation, falsification, and complexity-ledger discipline
