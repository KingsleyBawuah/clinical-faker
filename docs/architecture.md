# Architecture

This document describes the cross-cutting design decisions behind `clinical-faker`. It is kept in sync as the system evolves — if an implementation detail here becomes stale, fix the doc in the same PR that changes the behavior.

## Overview

Everything starts from a single canonical in-memory patient model (`PatientGraph`), built once by resolving a dependency graph of generation steps against a seeded pseudo-random number generator. Three export methods compile that same model into different formats:

- `.toJSON()` — the plain canonical representation.
- `.toHL7(eventType)` — a pipe-and-hat delimited HL7 v2 message string.
- `.toFHIR(bundleType)` — a FHIR R4 JSON `Bundle`.

Because all three are compiled from the same `PatientGraph`, and every entity gets exactly one deterministically-generated ID, the same seed produces cross-referentially consistent output in every format.

## Scope & Non-Goals

The target audience is software engineers testing HL7/FHIR-speaking systems — not clinicians, researchers, or students. Neither this library's design nor the people maintaining it should be treated as a source of clinical accuracy, so the bar for "realistic" is deliberately capped by what the actual use case needs, not by how medically precise the data could theoretically be made:

- **In scope**:
  - **Structural validity** — well-formed HL7 v2 / FHIR R4, correct types, referential integrity. Non-negotiable; it's the entire reason this library exists instead of hand-written fixture JSON.
  - **Internal self-consistency** — no contradictions within one generated patient: age matches DOB, gender is compatible with the archetype, an abnormal flag matches its value against its own reference range, nothing physically impossible (see "Generation plausibility invariants" and "Demographic plausibility" below).
  - **Surface clinical plausibility** — values fall in realistic ranges for the stated condition, and ontology codes/medications are real and appropriate for it. The bar: a knowledgeable reviewer glancing at the output says "plausible hypertensive patient," not "let me audit this against clinical guidelines."
- **Explicitly out of scope**: population-representative statistical distributions calibrated against real epidemiological studies, drug-drug interaction checking, dose adjustment for renal/hepatic function, detailed multi-year disease-progression pathophysiology, age/sex-specific normal ranges for every lab test. These need real clinical/pharmacological expertise this project doesn't have, and wouldn't make the library more useful for its actual purpose — a test asserting an `ORU^R01` message parses correctly with an elevated `OBX` value doesn't need that value to match a peer-reviewed prevalence study.
- **Not the same project as** [Synthea](https://synthetichealth.github.io/synthea/) (MITRE's synthetic patient population generator, built over years by a team with clinical/epidemiological expertise, for population-health research and HIE testing at scale) — a different mission and a much larger scope. `clinical-faker` optimizes for deterministic, seed-reproducible, zero-dependency test fixtures, not population health simulation.

## Seeded PRNG

Two generators, used together:

- **SplitMix32** derives decorrelated child seeds: `deriveStreamSeed(masterSeed, label)` hashes a master seed plus a node/entity label so that, e.g., the Demographics node and the Conditions node never share a correlated random sequence even though they both trace back to the same top-level seed.
- **Mulberry32** is the actual working stream generator for each node: `mulberry32(deriveStreamSeed(masterSeed, nodeId))`. It's a small, fast xorshift-multiply generator — not cryptographic, but standard for synthetic-data generation and sufficient for realistic statistical distributions.

Every generation node gets its own Mulberry32 stream this way, and can further `fork(label)` its own stream into decorrelated sub-streams (e.g., one per repeated observation).

**Why a seeded PRNG at all**: the entire value proposition of this library is that the same seed produces the same patient, every time, in every export format — that's what makes it usable as a test fixture instead of `Math.random()`-flavored noise that would make assertions flaky. A "PRNG" is a deterministic formula that produces a sequence of numbers statistically indistinguishable from random, but 100% reproducible given the same starting number (the seed). That reproducibility is the whole point; cryptographic randomness (`crypto.randomUUID()`, `crypto.getRandomValues()`) would be actively wrong here, since it's designed specifically to *not* be reproducible.

**Why Mulberry32**: this project explicitly doesn't need cryptographic-strength randomness — nothing security-relevant depends on a synthetic blood pressure reading being unguessable. What it does need is speed (generating many patients in a test suite shouldn't be slow) and a tiny, dependency-free implementation (in keeping with the zero-dependency goal — no reason to pull in a full crypto library for this). Mulberry32 is a handful of lines of bit-shifting and multiplication: fast, statistically well-distributed, and the de facto standard across the JS faker-library ecosystem for exactly this kind of use.

**Why SplitMix32 as well, rather than just Mulberry32 alone**: every generation step (Demographics, Conditions, Medications, each individual Observation) needs its own independent random stream, all traceable back to one master seed. If every step instead pulled from one shared Mulberry32 stream, the amount of randomness one step consumes would shift what the next step sees — meaning an unrelated change (e.g., adding one more comorbidity condition to an archetype) could silently change every patient's blood pressure reading generated after it, even though blood pressure has nothing to do with conditions. SplitMix32's specific strength is turning one input into many well-separated, uncorrelated outputs — exactly the "seed splitter" needed to hand each node its own private starting point without that fragility. Mulberry32 and SplitMix32 are good at different jobs (long-running generation vs. one-shot seed derivation); using both gets both properties instead of picking one and doing without the other.

**Why Gaussian sampling (Box-Muller) for vitals and labs**: a raw PRNG produces a *uniform* distribution — every value in a range equally likely, like a fair die roll. Real clinical measurements don't work that way; they cluster around a typical value with rarer extremes, which is a *Gaussian* (bell-curve) distribution, described by a mean and a standard deviation. The Box-Muller transform is the standard, simple technique for converting the uniform numbers a PRNG naturally produces into that bell-curve shape. Without it, a hypertension archetype's systolic BP would be "any number from 90 to 200 with equal likelihood" instead of realistically clustering around an elevated value — the difference between data that looks synthetic and data that looks like real measurements.

**Implementation requirements** (closing gaps an external review caught before any code was written):
- All Mulberry32/SplitMix32 state transitions and outputs must be normalized to unsigned 32-bit (`>>> 0`) at every step. JavaScript's bitwise operators work on signed 32-bit integers; skipping this produces inconsistent results depending on sign/overflow.
- `gaussian(mean, stdDev)` (Box-Muller) must be **stateless per call** — always consume two fresh uniform draws and never cache the transform's second output ("spare value") across calls. A cached spare tied to a shared stream would make a stream's later draws depend on how many times `gaussian()` happened to be called before, which is fragile under any future conditional/branching sampling logic. The extra entropy cost is negligible for synthetic data generation.
- `fork(label)` must be a pure function of the stream's own *original* seed and `label` — never the stream's current mutable state. If forking depended on how many `next()` calls happened first, `parent.fork("x")` would produce a different child depending on unrelated prior usage of `parent`, which is exactly the kind of hidden order-dependence this project avoids everywhere else (DAG tie-breaking, stateless Gaussian sampling).
- **Because of that purity, `fork(label)` called twice with the same label returns identical child streams — this is a real footgun for future collection-generating code.** A loop like `for (const obs of observations) { const s = prng.fork("observation"); ... }` would silently give every iteration the exact same random values. Code that forks once per item in a collection (repeated observations, multiple conditions, etc.) must include the item's index or id in the label — e.g. `prng.fork(`observation-${i}`)` — not a fixed string.

**TypeScript 6.0 gotcha, verified while building this**: starting in TS 6.0, `compilerOptions.types` defaults to an empty array instead of auto-discovering every installed `@types/*` package. Without `"types": ["bun"]` explicitly set, `bun:test`'s ambient module declarations silently disappear and `tsc --noEmit` fails with `Cannot find module 'bun:test'` — confirmed against real Bun documentation, not assumed. `tsconfig.json` also needs `"allowImportingTsExtensions": true` for Bun-style imports that include the `.ts` suffix (e.g. `from "./mulberry32.ts"`), which Bun resolves natively but `tsc` rejects without that flag.

## DAG resolution engine

Generation steps are declared as nodes with an `id` and a `dependsOn` list, and resolved via a generic topological sort (Kahn's algorithm) — not a hardcoded pipeline. The clinically-meaningful resolution order (Seed → Demographics → Archetype Assignment → Conditions → Numerical Samplers → Medications) emerges from each node's declared dependencies rather than being hand-coded as a sequence. This is what lets new archetypes, and eventually a custom archetype builder, plug in or override nodes without touching the resolver itself.

**Why a DAG instead of a hardcoded sequence**: a directed acyclic graph is just nodes connected by "must happen before" edges with no loops — the same idea as a Makefile or a CI pipeline with job dependencies. The alternative would be a single function that does "generate demographics, then archetype, then conditions, then observations, then medications" in that literal order, baked into the code. That works for the current five steps, but breaks the moment something needs to *extend* generation without editing that function from outside the library — which is exactly what the roadmap's Custom Archetype Builder needs: a new generation step that depends on existing steps but wasn't anticipated when the pipeline was written. With a DAG, adding a step is just declaring what it depends on; the resolver figures out where it fits. With a hardcoded sequence, extending it means editing code a library consumer can't safely touch.

**`encounterNode`**: the original spec's resolution order has no explicit encounter step, but `Encounter` (class, period, location, attending provider) is part of the IR and needs something to produce it. `encounterNode` depends only on `demographicsNode` (an encounter's timing/location/provider doesn't depend on the patient's archetype), so it resolves in parallel with `archetypeAssignmentNode` — exactly the kind of simultaneous-readiness case the lexical tie-break rule above exists for. MVP always produces exactly one `Encounter`; the array shape exists for the future temporal-progression roadmap item (multiple visits over time), not used yet.

**Tie-breaking**: when more than one node becomes ready (in-degree 0) at the same step, the resolver processes them in ascending lexical order by node `id`. A correct array/queue-based Kahn's implementation is already deterministic on any spec-compliant JS engine (Array/Map/Set iteration order is spec-guaranteed), but making the tie-break an explicit, documented contract removes any ambiguity for future maintainers rather than relying on it being an incidental property of the current implementation.

**`getResult<T>` and the one unavoidable type assertion**: keeping the resolver generic/domain-agnostic (see "why a DAG" above) means it stores every node's result type-erased, in a single `Map<NodeId, unknown>` — it can't know at compile time what type a `demographicsNode` result is versus a `seedNode` result. `getResult<T>(nodeId)` reverses that erasure so a node's `resolve` function gets back a properly-typed value for each of its declared dependencies. That reversal is exactly the kind of narrowing TypeScript can't verify on its own, so `src/core/dag/resolver.ts` carries one `type-coverage:ignore-next-line` at the single `Map.get(...)` read where it happens — verified against `type-coverage`'s own docs that `--strict` (this project's setting) flags every `as` assertion as uncovered with no exception for ones that are actually sound, and that leaving an ignore comment unused is itself reported, so it can't quietly drift out of date. The alternative — a hand-maintained central registry type mapping every node id to its result type, giving fully sound types with zero assertions — was considered and rejected: it would force every future node (including third-party custom-archetype nodes) to be registered in one central place before the resolver could type-check calling it, which is exactly the coupling the DAG design exists to avoid.

**Duplicate node ids**: `resolveDAG` rejects two nodes sharing the same `id` with `DuplicateNodeIdError`, rather than silently letting the later one overwrite the earlier one in its internal lookup. Caught in self-review before this landed: without the guard, a duplicate id would make `results.size` (which counts unique resolved ids) permanently fall short of `nodes.length` (which counts array entries, duplicates included) — so a perfectly valid, acyclic graph with a duplicate id would incorrectly report `CyclicDependencyError` instead of the actual problem.

**Reading an undeclared dependency**: a node can only safely call `getResult(id)` for an `id` it listed in its own `dependsOn` — the resolver only guarantees *those* ids are ready by the time `resolve` runs. Calling it for anything else is a bug in that node's own definition, not a graph-shape problem `resolveDAG` can validate upfront, so it's caught at the point of misuse with `DependencyNotReadyError` rather than silently reading a stale value or `undefined`. This extends `ClinicalFakerError` like every other error here (an external review flagged the first version of this guard for throwing a plain `Error` instead) so that a future custom-node author can catch every error the library throws, including mistakes in their own node's definition, with one type.

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
  dob: string; age: number;               // dob is derived from age relative to referenceDate, never sampled independently — see "Generation plausibility invariants"
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

interface ConditionEntity {
  code: string; display: string; onsetDate?: string;
  rank: 'primary' | 'secondary';   // derived directly from the archetype's ConditionSpec.probability (1.0 = primary, <1.0 = comorbidity) — see "Generation plausibility invariants"
}

interface ObservationEntity {
  loincCode: string; display: string;
  value: number | string; unit?: string;
  effectiveDateTime: string;                          // HL7 OBX-14 / FHIR Observation.effectiveDateTime
  referenceRange?: { low: number; high: number };      // HL7 OBX-7 / FHIR Observation.referenceRange
  abnormalFlag?: 'H' | 'L' | 'N';                      // HL7 OBX-8 / FHIR Observation.interpretation — always derived from value vs referenceRange, never independently generated
}

interface MedicationEntity { name: string; rxcui: string; sig: string }

interface AllergyEntity { substance: string; reaction?: string; criticality?: 'low' | 'high' | 'unable-to-assess' }
```

- **Demographics** use `gender: 'male' | 'female' | 'other' | 'unknown'` — matching FHIR's `Patient.gender` directly. Biological/birth sex, if ever needed, is a separate future US Core extension field, not conflated with `gender`.
- **Vitals are a hybrid model**: the generic `observations` array (LOINC code + value + unit) is the single source of truth, since it also has to represent lab values (glucose, HbA1c) that aren't vital signs. `.toJSON()` additionally projects well-known vital-sign LOINC codes (blood pressure, heart rate, temperature, respiratory rate, SpO2) into a friendly `vitals` sub-object for consumers who just want the common numbers without walking the generic array.
- **Medications use a combined shape** — `{ name, rxcui, sig }`, e.g. `{ name: "Lisinopril 10mg", rxcui: "314076", sig: "Daily" }` — rather than separate drug-name/strength fields. This matches how RxNorm itself models a specific strength+form as one distinct concept/code, and stays additively extensible if a structured strength field is ever needed.
- **Deliberately not modeled**, since nothing already committed requires it: Insurance/Coverage (`IN1` isn't in the segment list), Immunizations, Procedures, a full `Organization`/`Facility` resource (sending/receiving facility for `MSH-4`/`MSH-6` is message-level configuration passed to `.toHL7()`, not part of the patient), a separate `Order`/`ServiceRequest` entity (placer/filler order numbers can be generated deterministically at HL7-serialization time from the seed, without a first-class IR entity).

## Generation plausibility invariants

Independently-generated fields can contradict each other even when each one is individually valid — the same failure mode as the demographic-constraints gap above, just numeric/temporal instead of categorical. Three invariants close off the concrete cases found so far:

- **`age`/`dob` have one source of truth.** `age` is sampled first (bounded by the archetype's `demographicConstraints` if present, otherwise a realistic default adult range), and `dob` is *derived* from it relative to `referenceDate` (with a randomized day/month for realism) — never sampled independently. This makes a patient whose stated age doesn't match their birthdate structurally impossible rather than just unlikely.
- **`abnormalFlag` is computed, not generated.** It's a pure function of `value` compared against `referenceRange` at the moment the observation is created — never sampled or hardcoded per archetype. This guarantees a value can't be flagged abnormal while sitting inside its own reference range, or vice versa.
- **Gaussian sampling is bounded.** Box-Muller produces a true bell curve with unbounded tails, so an unlucky draw can produce a physically impossible value (a negative blood pressure, a systolic reading in the 300s). `ObservationDistributionSpec` gains a `clamp: { min: number; max: number }` (physically-possible outer bounds — distinct from `referenceRange`, which is the *clinically normal* range used for the abnormal flag). The sampler resamples (bounded to a small number of attempts) rather than clamping outright, to avoid an artificial spike of values sitting exactly at the boundary; clamping is only the last-resort fallback if resampling doesn't converge.

**Tracked but deferred to Phase 4's actual design pass** (implementation-level rather than IR-shape decisions):
- Timestamp ordering across an encounter and everything generated within it — `ObservationEntity.effectiveDateTime` should fall within its `Encounter.period`, and `ConditionEntity.onsetDate` should relate sensibly to the encounter rather than being sampled independently. Likely needs `numericalSamplersNode` to gain an explicit DAG dependency on `encounterNode` (not yet declared) so it can read the encounter's timing.
- MRN uniqueness is not guaranteed across different seeds (each patient's MRN derives independently from its own seed) — not urgent since nothing currently relies on cross-patient MRN uniqueness, but worth revisiting if generating large synthetic populations becomes a real use case.

## HL7 v2 serialization

Messages are built as nested arrays (segment → field → component → subcomponent). A single `encodeHL7Text(raw, delimiters)` utility is invoked exactly once, at the point a raw leaf string is written into that structure — never twice, never at the wrong structural level. One generic recursive `serializeMessage()` walker then joins subcomponents (`&`), components (`^`), repetitions (`~`), and fields (`|`).

## FHIR R4 referential integrity

Each entity (Patient, Encounter, Condition, Observation, MedicationRequest) is assigned exactly one deterministic ID at DAG-resolution time via `generateSeededUUID(prng)`, stored once in the canonical IR, and reused verbatim as `urn:uuid:<id>` for both a bundle entry's `fullUrl` and every `Reference` that points at it. "Validated" FHIR output means required fields are non-optional TypeScript parameters on the builder functions (malformed shapes are compile-time errors) plus a handful of cheap structural assertions — not a full StructureDefinition/JSON-Schema runtime validator, in keeping with the zero-runtime-schema-footprint goal.

**Why a seeded UUID instead of `crypto.randomUUID()`**: `generateSeededUUID` pulls bytes from a node's own Mulberry32 stream and formats them to look like a standard UUID, rather than using real randomness. FHIR requires every resource to have an `id`, and cross-references within a bundle use `urn:uuid:<id>` — a hard requirement of the spec, not a stylistic choice. A real random UUID would satisfy the *format*, but would break the library's core guarantee: the same seed has to produce the exact same patient every time, including the exact same IDs, so a test asserting "patient seed 42 has this specific Encounter ID" doesn't flake between runs. Deriving the UUID's bytes from the seeded stream instead of real randomness is what makes "same seed in, byte-identical FHIR bundle out" actually true.

## Archetype comorbidity model

A patient is generated from exactly one archetype (`GenerationOptions.archetype`) — there's no multi-archetype composition. That doesn't mean single-condition patients, though: an archetype's own `conditions: ConditionSpec[]` already supports probabilistic comorbidities within itself (e.g. `Type2Diabetes` producing `E78.5` hyperlipidemia at some probability less than 1.0). Real-world cross-category comorbidity — hypertension and type 2 diabetes are commonly comorbid together — is modeled the same way: an archetype's own definition can include a probabilistic condition/medication entry that happens to belong to another archetype's usual category (e.g. `Type2Diabetes` including a probabilistic `I10` entry), using the mechanism that already exists rather than needing new architecture.

**Future state, not built now**: true multi-archetype composition (`archetype` accepting an array, merging multiple archetypes' conditions/medications/observation distributions into one patient) is a real extension but adds real complexity — overlapping observation distributions between archetypes need a conflict-resolution rule, medication lists need de-duplication, etc. Deferred until cross-pollinated single-archetype comorbidity proves insufficient.

**Invalid archetype handling**: `GenerationOptions.archetype` is typed as `keyof typeof ARCHETYPES | ArchetypeDefinition`, not loose `string` — a misspelled archetype name is a **TypeScript compile error** for any TS consumer, and a malformed `ArchetypeDefinition` object is also a compile error (its required fields are non-optional). This can't help a plain-JS consumer or a dynamically-computed string, though, so `createPatient()` also throws a runtime `UnknownArchetypeError` (extending a common `ClinicalFakerError` base in `src/core/errors.ts`, alongside the DAG's `CyclicDependencyError`/`UnresolvedDependencyError`) as the fallback for whatever the type system can't catch.

**Demographic plausibility**: `ArchetypeDefinition` carries an optional `demographicConstraints?: { minAge?: number; maxAge?: number; compatibleGenders?: Gender[] }` — without it, nothing stops an archetype that only makes clinical sense for one sex or age range (e.g. a hypothetical pregnancy-related archetype) from being paired with demographics that make the resulting patient nonsensical. Two places use it: `demographicsNode` consults the *requested* archetype's constraints while generating age/gender (the requested archetype is known synchronously from `options` the moment generation starts, no DAG dependency needed to read it) — the constraint shapes demographics generation rather than demographics happening to violate it after the fact. A future auto-assignment path (picking a realistic archetype automatically rather than always naming one) filters candidates by already-resolved demographics instead, which works naturally since that step runs after `demographicsNode`. Neither MVP archetype (`AdultHypertension`, `Type2Diabetes`) needs a real constraint here, but the field exists from the start so adding a constrained archetype later doesn't require revisiting every existing one. A future demographic-override API that let a caller force an incompatible combination directly would throw `IncompatibleArchetypeError` (also extending `ClinicalFakerError`) rather than silently producing an implausible patient.

## Ontology tree-shaking

Each ontology subset (ICD-10-CM, RxNorm, LOINC, UCUM) is a small literal-array module scoped by system and archetype (e.g. `src/ontology/icd10cm/hypertension.ts`). Archetypes import only the slices they need; codes shared across archetypes (e.g., common vital-sign LOINC codes) live in `common-*.ts` files. `package.json` declares `"sideEffects": false`, which is a hard requirement for this to actually tree-shake — no ontology or registry module may run side-effecting code at module scope.

See `THIRD_PARTY_NOTICES.md` (added once the ontology licensing & data-accuracy audit phase lands) for attribution requirements tied to the bundled LOINC/UCUM/RxNorm content.

### Ontology data-accuracy verification

Hand-authoring a bounded subset of an ontology (a code plus its display text) carries real risk of typos or stale entries with nothing to catch them. Every bundled code gets checked against a free, no-registration, NLM/Regenstrief-backed authoritative source as part of the ontology licensing & data-accuracy audit phase, rather than trusted on faith:

- **ICD-10-CM**: NLM Clinical Table Search Service (`clinicaltables.nlm.nih.gov/api/icd10cm`) — e.g. looking up `I10` returns `"Essential (primary) hypertension"`, confirmed live.
- **RxNorm**: NLM's public RxNorm REST API (`rxnav.nlm.nih.gov`) — e.g. looking up RxCUI `314076` returns `"lisinopril 10 MG Oral Tablet"`, confirmed live.
- **LOINC**: the same NLM Clinical Table Search Service (`clinicaltables.nlm.nih.gov/api/loinc_items`) — no LOINC.org account needed, unlike LOINC's own official search API.
- **UCUM**: [`@lhncbc/ucum-lhc`](https://github.com/lhncbc/ucum-lhc) (npm) — a UCUM validation library from NLM's Lister Hill National Center, which co-maintains the UCUM spec alongside Regenstrief; can programmatically confirm our bundled unit strings are valid UCUM syntax. Its `LICENSE.md` (fetched and read directly, not assumed from the npm metadata's ambiguous "SEE LICENSE IN LICENSE.md") is a permissive BSD-style license — fine for devDependency use, and its LOINC/UCUM attribution language is a real candidate source for `THIRD_PARTY_NOTICES.md` when Phase 4.5 actually bundles LOINC/UCUM content.

All four are free and require no API key or account — confirmed by querying each directly. This can run as a script/test against bundled ontology files whenever they change, independent of the licensing-text side of that phase.

## Cross-validation with independent parsers

Round-trip tests (serialize, then split by delimiter and confirm fields match the source data) only prove our HL7/FHIR builders are internally consistent with our own serializer — they can't catch a case where our output is subtly non-conformant to the actual spec, since the same misunderstanding would produce both the message and the test that checks it. To catch that class of bug, generated output gets fed into independent, unrelated implementations as part of the test suite for those phases:

- **HL7 v2**: [`hl7v2`](https://github.com/panates/hl7v2) (npm, MIT) — chosen over Redox's `@redox-opensource/redox-hl7-v2` (also real and viable, verified via the npm registry and `gh api`, but plain JS and its last publish is older) because `hl7v2` is TypeScript-native (matches this project's stack) and actively maintained (pushed April 2026 at the time of checking), with parser, serializer, validator, server, and client support.
- **FHIR R4**: the official HL7 FHIR reference validator, via `fhir-validator-wrapper` — maintained under the official `github.com/FHIR` org by Grahame Grieve, FHIR's technical lead. This is the actual reference implementation the FHIR community uses to certify conformance, not a third-party approximation.

Both are **devDependencies only, used in tests** — never bundled into the published package, so this doesn't touch the zero-runtime-dependency policy. The FHIR validator wraps a Java tool, so its CI job needs a JVM (`actions/setup-java`), added when the FHIR compilation phase starts.

## `node:net` isolation

Only `src/mllp/**` is permitted to import `node:net`. This keeps the root, `hl7`, and `fhir` entry points free of Node-specific APIs, which is what makes future edge/browser-runtime compatibility a non-issue rather than a rewrite.

## Multi-entry build (verified)

`bun build <entry1> <entry2> <entry3> --splitting` correctly deduplicates a module shared across multiple entry points into one chunk, with each entry importing from it rather than duplicating the code — confirmed with a throwaway 3-entry-point test against Bun 1.4.0 before relying on it. This is what lets `clinical-faker/mllp` import `clinical-faker/hl7`'s segment builders (Phase 5 depends on Phase 2) without either duplicating that code across bundles or forcing a different build tool.
