# Architecture

This document describes the cross-cutting design decisions behind `clinical-faker`. It is kept in sync as the system evolves — if an implementation detail here becomes stale, fix the doc in the same PR that changes the behavior.

## Overview

Everything starts from a single canonical in-memory patient model (`PatientGraph`), built once by resolving a dependency graph of generation steps against a seeded pseudo-random number generator. Three export methods compile that same model into different formats:

- `.toJSON()` — the plain canonical representation.
- `.toHL7(eventType)` — a pipe-and-hat delimited HL7 v2 message string.
- `.toFHIR(bundleType)` — a FHIR R4 JSON `Bundle`.

Because all three are compiled from the same `PatientGraph`, and every entity gets exactly one deterministically-generated ID, the same seed produces cross-referentially consistent output in every format.

## Seeded PRNG

Two generators, used together:

- **SplitMix32** derives decorrelated child seeds: `deriveStreamSeed(masterSeed, label)` hashes a master seed plus a node/entity label so that, e.g., the Demographics node and the Conditions node never share a correlated random sequence even though they both trace back to the same top-level seed.
- **Mulberry32** is the actual working stream generator for each node: `mulberry32(deriveStreamSeed(masterSeed, nodeId))`. It's a small, fast xorshift-multiply generator — not cryptographic, but standard for synthetic-data generation and sufficient for realistic statistical distributions.

Every generation node gets its own Mulberry32 stream this way, and can further `fork(label)` its own stream into decorrelated sub-streams (e.g., one per repeated observation).

**Implementation requirements** (closing gaps an external review caught before any code was written):
- All Mulberry32/SplitMix32 state transitions and outputs must be normalized to unsigned 32-bit (`>>> 0`) at every step. JavaScript's bitwise operators work on signed 32-bit integers; skipping this produces inconsistent results depending on sign/overflow.
- `gaussian(mean, stdDev)` (Box-Muller) must be **stateless per call** — always consume two fresh uniform draws and never cache the transform's second output ("spare value") across calls. A cached spare tied to a shared stream would make a stream's later draws depend on how many times `gaussian()` happened to be called before, which is fragile under any future conditional/branching sampling logic. The extra entropy cost is negligible for synthetic data generation.

## DAG resolution engine

Generation steps are declared as nodes with an `id` and a `dependsOn` list, and resolved via a generic topological sort (Kahn's algorithm) — not a hardcoded pipeline. The clinically-meaningful resolution order (Seed → Demographics → Archetype Assignment → Conditions → Numerical Samplers → Medications) emerges from each node's declared dependencies rather than being hand-coded as a sequence. This is what lets new archetypes, and eventually a custom archetype builder, plug in or override nodes without touching the resolver itself.

**`encounterNode`**: the original spec's resolution order has no explicit encounter step, but `Encounter` (class, period, location, attending provider) is part of the IR and needs something to produce it. `encounterNode` depends only on `demographicsNode` (an encounter's timing/location/provider doesn't depend on the patient's archetype), so it resolves in parallel with `archetypeAssignmentNode` — exactly the kind of simultaneous-readiness case the lexical tie-break rule above exists for. MVP always produces exactly one `Encounter`; the array shape exists for the future temporal-progression roadmap item (multiple visits over time), not used yet.

**Tie-breaking**: when more than one node becomes ready (in-degree 0) at the same step, the resolver processes them in ascending lexical order by node `id`. A correct array/queue-based Kahn's implementation is already deterministic on any spec-compliant JS engine (Array/Map/Set iteration order is spec-guaranteed), but making the tie-break an explicit, documented contract removes any ambiguity for future maintainers rather than relying on it being an incidental property of the current implementation.

## Canonical patient model (`.toJSON()`)

The entity set below was audited directly against the fields required by the HL7 v2 segments and FHIR resources already committed to the MVP (`MSH`/`EVN`/`PID`/`PV1`/`DG1`/`ORC`/`OBR`/`OBX`; `Patient`/`Encounter`/`Condition`/`Observation`/`MedicationRequest`/`AllergyIntolerance`) — every field exists because something we're already committed to building needs it, not speculative modeling. Notably, this includes `Observation.referenceRange`/`abnormalFlag`, which the original spec calls for directly ("reference ranges, and abnormal flags") but an earlier draft of this IR omitted.

```ts
interface PatientGraph {
  id: string;
  seed: number;
  referenceDate: string;               // ISO date; anchors all encounter/observation timestamps. Deterministic default derived from the seed if the caller doesn't supply one — never wall-clock "now", which would break reproducibility.
  demographics: Demographics;          // nested, not flattened
  archetype?: string;
  encounters: Encounter[];
  conditions: ConditionEntity[];       // { code, display } — ICD-10-CM
  observations: ObservationEntity[];   // generic LOINC-coded source of truth (vitals + labs)
  medications: MedicationEntity[];     // { name, rxcui, sig }
  allergies: AllergyEntity[];
}

interface Identifier { value: string; assigningAuthority: string }   // HL7 CX / FHIR Identifier — every PID-3/PV1-7/PV1-17-style ID needs an assigning authority, not just a bare string
interface Address { line: string; city: string; state: string; postalCode: string; country: string }   // HL7 XAD / FHIR Address
interface Provider { identifier: Identifier; firstName: string; lastName: string }   // HL7 XCN / FHIR Practitioner reference

interface Demographics {
  firstName: string; lastName: string;
  dob: string; age: number;
  gender: 'male' | 'female' | 'other' | 'unknown';
  mrn: Identifier;
  address: Address;
}

interface Encounter {
  id: string;
  class: 'inpatient' | 'outpatient' | 'emergency';   // HL7 PV1-2 / FHIR Encounter.class
  period: { start: string; end?: string };            // HL7 PV1-44 / FHIR Encounter.period
  location?: string;                                  // HL7 PV1-3 point of care / facility display name
  attendingProvider: Provider;                        // HL7 PV1-7; reused as admitting (PV1-17) and ordering (ORC-12/OBR-16) provider — a deliberate MVP simplification, not a distinct-roles model
}

interface ConditionEntity { code: string; display: string; onsetDate?: string }

interface ObservationEntity {
  loincCode: string; display: string;
  value: number | string; unit?: string;
  effectiveDateTime: string;                          // HL7 OBX-14 / FHIR Observation.effectiveDateTime
  referenceRange?: { low: number; high: number };      // HL7 OBX-7 / FHIR Observation.referenceRange
  abnormalFlag?: 'H' | 'L' | 'N';                      // HL7 OBX-8 / FHIR Observation.interpretation
}

interface MedicationEntity { name: string; rxcui: string; sig: string }

interface AllergyEntity { substance: string; reaction?: string; criticality?: 'low' | 'high' | 'unable-to-assess' }
```

- **Demographics** use `gender: 'male' | 'female' | 'other' | 'unknown'` — matching FHIR's `Patient.gender` directly. Biological/birth sex, if ever needed, is a separate future US Core extension field, not conflated with `gender`.
- **Vitals are a hybrid model**: the generic `observations` array (LOINC code + value + unit) is the single source of truth, since it also has to represent lab values (glucose, HbA1c) that aren't vital signs. `.toJSON()` additionally projects well-known vital-sign LOINC codes (blood pressure, heart rate, temperature, respiratory rate, SpO2) into a friendly `vitals` sub-object for consumers who just want the common numbers without walking the generic array.
- **Medications use a combined shape** — `{ name, rxcui, sig }`, e.g. `{ name: "Lisinopril 10mg", rxcui: "314076", sig: "Daily" }` — rather than separate drug-name/strength fields. This matches how RxNorm itself models a specific strength+form as one distinct concept/code, and stays additively extensible if a structured strength field is ever needed.
- **Deliberately not modeled**, since nothing already committed requires it: Insurance/Coverage (`IN1` isn't in the segment list), Immunizations, Procedures, a full `Organization`/`Facility` resource (sending/receiving facility for `MSH-4`/`MSH-6` is message-level configuration passed to `.toHL7()`, not part of the patient), a separate `Order`/`ServiceRequest` entity (placer/filler order numbers can be generated deterministically at HL7-serialization time from the seed, without a first-class IR entity).

## HL7 v2 serialization

Messages are built as nested arrays (segment → field → component → subcomponent). A single `encodeHL7Text(raw, delimiters)` utility is invoked exactly once, at the point a raw leaf string is written into that structure — never twice, never at the wrong structural level. One generic recursive `serializeMessage()` walker then joins subcomponents (`&`), components (`^`), repetitions (`~`), and fields (`|`).

## FHIR R4 referential integrity

Each entity (Patient, Encounter, Condition, Observation, MedicationRequest) is assigned exactly one deterministic ID at DAG-resolution time via `generateSeededUUID(prng)`, stored once in the canonical IR, and reused verbatim as `urn:uuid:<id>` for both a bundle entry's `fullUrl` and every `Reference` that points at it. "Validated" FHIR output means required fields are non-optional TypeScript parameters on the builder functions (malformed shapes are compile-time errors) plus a handful of cheap structural assertions — not a full StructureDefinition/JSON-Schema runtime validator, in keeping with the zero-runtime-schema-footprint goal.

## Archetype comorbidity model

A patient is generated from exactly one archetype (`GenerationOptions.archetype`) — there's no multi-archetype composition. That doesn't mean single-condition patients, though: an archetype's own `conditions: ConditionSpec[]` already supports probabilistic comorbidities within itself (e.g. `Type2Diabetes` producing `E78.5` hyperlipidemia at some probability less than 1.0). Real-world cross-category comorbidity — hypertension and type 2 diabetes are commonly comorbid together — is modeled the same way: an archetype's own definition can include a probabilistic condition/medication entry that happens to belong to another archetype's usual category (e.g. `Type2Diabetes` including a probabilistic `I10` entry), using the mechanism that already exists rather than needing new architecture.

**Future state, not built now**: true multi-archetype composition (`archetype` accepting an array, merging multiple archetypes' conditions/medications/observation distributions into one patient) is a real extension but adds real complexity — overlapping observation distributions between archetypes need a conflict-resolution rule, medication lists need de-duplication, etc. Deferred until cross-pollinated single-archetype comorbidity proves insufficient.

## Ontology tree-shaking

Each ontology subset (ICD-10-CM, RxNorm, LOINC, UCUM) is a small literal-array module scoped by system and archetype (e.g. `src/ontology/icd10cm/hypertension.ts`). Archetypes import only the slices they need; codes shared across archetypes (e.g., common vital-sign LOINC codes) live in `common-*.ts` files. `package.json` declares `"sideEffects": false`, which is a hard requirement for this to actually tree-shake — no ontology or registry module may run side-effecting code at module scope.

See `THIRD_PARTY_NOTICES.md` (added once the ontology licensing audit phase lands) for attribution requirements tied to the bundled LOINC/UCUM/RxNorm content.

## `node:net` isolation

Only `src/mllp/**` is permitted to import `node:net`. This keeps the root, `hl7`, and `fhir` entry points free of Node-specific APIs, which is what makes future edge/browser-runtime compatibility a non-issue rather than a rewrite.
