# Implementation status

Living checklist of phase status and remaining work. Update this in the same PR that changes status — don't let it drift.

Each phase ships as multiple small PRs (one unit of work each), per `AGENTS.md`'s workflow rules.

## Phase 1 — Project Scaffold, Docs, Seeded PRNG, DAG Core

- [x] **PR 1a — Scaffold & docs**: `package.json`, `tsconfig*.json`, `.gitignore`, `AGENTS.md`, `README.md`, `CLAUDE.md`, `docs/architecture.md`, `docs/implementation.md`, `biome.json`.
- [ ] **PR 1b — CI workflow**: `.github/workflows/ci.yml` (install, typecheck, lint, test, build on every PR). Moved ahead of any source code so nothing merges without CI active, per `AGENTS.md`'s "every PR runs CI" rule.
- [ ] **PR 1c — Seeded PRNG**: `src/core/prng/**` (SplitMix32, Mulberry32, Box-Muller gaussian, seeded UUID). Must implement: unsigned 32-bit normalization (`>>> 0`) throughout, and a stateless `gaussian()` (no cached Box-Muller spare value across calls). + tests.
- [ ] **PR 1d — DAG resolver**: `src/core/dag/**`, `src/core/errors.ts` (topological sort with deterministic ascending-lexical-id tie-break, cycle/unresolved-dependency detection) + tests.
- [ ] **PR 1e — Canonical IR & generator wiring**: `src/entities/types.ts` (full entity set: `PatientGraph`, `Demographics`, `Identifier`, `Address`, `Provider`, `Encounter`, `ConditionEntity`, `ObservationEntity`, `MedicationEntity`, `AllergyEntity` — see `docs/architecture.md`), `src/entities/vitalsProjection.ts`, `src/entities/exporters/toJSON.ts`, `src/nodes/{seedNode,demographicsNode,encounterNode}.ts`, `src/generator.ts`, `src/index.ts` + tests. `encounterNode` depends only on `demographicsNode` and produces exactly one `Encounter` for MVP (see `docs/architecture.md`'s DAG resolution engine section).

## Later phases (not yet designed in detail)

We go through the library one piece at a time — each phase below gets its own detailed design discussion (types, algorithms, file layout) when we actually start it, not before. Locking in speculative detail for a phase we haven't started tends to get revisited anyway once the prior phase's real constraints are known.

- **HL7 v2 serialization** — segment/composite builders and message assembly (`ADT^A01`/`A08`, `ORM^O01`, `ORU^R01`), compiled from the canonical IR.
- **FHIR R4 compilation** — resource builders and bundle assembly, compiled from the same canonical IR.
- **Clinical archetypes + bundled ontology subsets** — `AdultHypertension`, `Type2Diabetes`, and the ICD-10-CM/RxNorm/LOINC/UCUM data they draw from.
- **Ontology licensing & attribution audit** — verify current LOINC/UCUM/RxNorm/ICD-10-CM redistribution terms from authoritative sources once we know exactly what's bundled, and add `THIRD_PARTY_NOTICES.md`.
- **MLLP mock server** — a later, lower-priority phase (not next after archetypes); zero-dependency TCP mock with byte framing and auto-ACK. Design deferred until we get here.
- **CD: automated npm publish** — release workflow, after the above are far enough along to have something worth publishing.

## Not yet started (roadmap, tracked separately)

Temporal progression, US Core/USCDI profiles, Custom Archetype Builder API, FHIR REST mock server, SMART on FHIR v2 auth mocking, edge/browser runtime compatibility, multi-archetype composition (a patient generated from more than one archetype at once — see `docs/architecture.md`'s "Archetype comorbidity model"; MVP handles cross-category comorbidity by cross-pollinating an archetype's own condition list instead).
