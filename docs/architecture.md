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

**`encounterNode`**: the original spec's resolution order has no explicit encounter step, but `Encounter` (class, period, location, attending provider) is part of the IR and needs something to produce it. `encounterNode` depends only on `seed` (for `referenceDate`, which anchors its timing) — nothing about an encounter's timing, location, or attending provider currently depends on demographics or archetype, so no dependency on either is declared until something actually needs one (**PR 1e**: an earlier draft of this note said `encounterNode` depends on `demographicsNode`, written before `seedNode` existed as a concrete design; that dependency was corrected rather than kept as unused speculative wiring — see the "don't design for hypothetical future requirements" convention in `AGENTS.md`). Once Phase 4 archetypes exist, `encounterNode` and `archetypeAssignmentNode` will both be ready as soon as `seed` resolves — exactly the kind of simultaneous-readiness case the lexical tie-break rule below exists for. MVP always produces exactly one `Encounter`; the array shape exists for the future temporal-progression roadmap item (multiple visits over time), not used yet.

**Tie-breaking**: when more than one node becomes ready (in-degree 0) at the same step, the resolver processes them in ascending lexical order by node `id`. A correct array/queue-based Kahn's implementation is already deterministic on any spec-compliant JS engine (Array/Map/Set iteration order is spec-guaranteed), but making the tie-break an explicit, documented contract removes any ambiguity for future maintainers rather than relying on it being an incidental property of the current implementation.

**`seedNode`** (**PR 1e**): the DAG's root, with no dependencies of its own. It produces the patient's own id (`generateSeededUUID`) and `referenceDate` — deriving `referenceDate` deterministically from the seed (a fixed 2024-01-01 UTC anchor plus a seeded day offset, never wall-clock "now") is what lets both `demographicsNode` (for `dob`) and `encounterNode` (for encounter timing) read one shared, consistent date instead of each computing their own. `createPatient`'s `options.referenceDate` overrides the derived value when a caller needs a specific date instead. The fixed anchor means `referenceDate` will always fall within a roughly 2024–2025 window regardless of when the library actually runs — an accepted, deliberate tradeoff (determinism over "always looks current"), not an oversight.

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

- **`age`/`dob` have one source of truth.** `age` is sampled first (bounded by the archetype's `demographicConstraints` if present, otherwise a realistic default adult range), and `dob` is *derived* from it relative to `referenceDate` (with a randomized day/month for realism) — never sampled independently. This makes a patient whose stated age doesn't match their birthdate structurally impossible rather than just unlikely. **A real off-by-one here was caught by external review (PR 1e)**: deriving `birthYear` as a flat `referenceYear - age` ignores whether the sampled birth month/day has actually occurred yet within `referenceDate`'s year — someone whose birthday falls after `referenceDate` in the calendar is a year younger than that naive subtraction implies. `demographicsNode`'s `deriveDob` now compares the sampled birth month/day against `referenceDate`'s before deciding between `referenceYear - age` and `referenceYear - age - 1`.
- **`abnormalFlag` is computed, not generated.** It's a pure function of `value` compared against `referenceRange` at the moment the observation is created — never sampled or hardcoded per archetype. This guarantees a value can't be flagged abnormal while sitting inside its own reference range, or vice versa.
- **Gaussian sampling is bounded.** Box-Muller produces a true bell curve with unbounded tails, so an unlucky draw can produce a physically impossible value (a negative blood pressure, a systolic reading in the 300s). `ObservationDistributionSpec` gains a `clamp: { min: number; max: number }` (physically-possible outer bounds — distinct from `referenceRange`, which is the *clinically normal* range used for the abnormal flag). The sampler resamples (bounded to a small number of attempts) rather than clamping outright, to avoid an artificial spike of values sitting exactly at the boundary; clamping is only the last-resort fallback if resampling doesn't converge.

**Tracked but deferred to Phase 4's actual design pass** (implementation-level rather than IR-shape decisions):
- Timestamp ordering across an encounter and everything generated within it — `ObservationEntity.effectiveDateTime` should fall within its `Encounter.period`, and `ConditionEntity.onsetDate` should relate sensibly to the encounter rather than being sampled independently. Likely needs `numericalSamplersNode` to gain an explicit DAG dependency on `encounterNode` (not yet declared) so it can read the encounter's timing.
- MRN uniqueness is not guaranteed across different seeds (each patient's MRN derives independently from its own seed) — not urgent since nothing currently relies on cross-patient MRN uniqueness, but worth revisiting if generating large synthetic populations becomes a real use case.

## HL7 v2 serialization

Messages are built as nested arrays (segment → field → component → subcomponent). A single `encodeHL7Text(raw, delimiters)` utility is invoked exactly once, at the point a raw leaf string is written into that structure — never twice, never at the wrong structural level. One generic recursive `serializeMessage()` walker then joins subcomponents (`&`), components (`^`), repetitions (`~`), and fields (`|`).

**Version**: HL7 v2.5.1 (`MSH-12`). Chosen as the most common real-world interface-engine baseline for `ADT`/`ORM`/`ORU` traffic (the post–Meaningful-Use era standard most production interface engines still speak), and it's the version HAPI HL7v2's own message-class model (the reference Java implementation used to sanity-check message structure below) is most complete for across all three message types this phase targets.

**Segment terminator**: segments join with a bare carriage return (`\r`, `0x0D`) — never `\n` or `\r\n` — confirmed against HL7 v2.5.1 Chapter 2 and HAPI's own line-ending handling (which treats `0x0D` as the segment boundary and is merely tolerant of a trailing `0x0A`, not requiring or emitting one). A wrong terminator is a real interoperability failure, not a style choice: production interface engines (Mirth, Rhapsody, InterSystems) and both parsers in this project's own cross-validation plan (`hl7v2`, HAPI) tokenize on `\r` and will mis-tokenize or reject a message that instead uses `\n`. `serializeMessage()` must hardcode `\r` as the segment join character, full stop — this is not configurable per caller.

**The `MSH` segment needs special-casing in `serializeMessage()`, not the same array-join logic every other segment uses.** `MSH-1` is defined as the field-separator character itself (the character immediately following the literal `MSH`), and `MSH-2` is the encoding-characters string (`^~\&`) — confirmed against HL7 v2.5.1 Chapter 2. Working through what naive array-join does here catches a real bug before it ships: if `MSH` were represented like any other segment — `["MSH", "|", "^~\&", field3, ...]` joined by inserting `|` between every element — the output duplicates the separator, because `MSH-1`'s *value* (`"|"`) collides with the `|` the join itself inserts before it: `"MSH" + "|" + "|" + "|" + "^~\&" + ...` → `MSH|||^~\&|...`, one pipe too many, corrupting every field ordinal after it. The correct construction writes `MSH-1` and `MSH-2` as a fixed literal prefix (`"MSH" + fieldSep + encodingChars + fieldSep`) and only resumes normal array-join semantics starting at `MSH-3`. PR 2a must implement this as an explicit branch (or a segment-specific builder), not a generic path that happens to special-case field 1.

**Escaping order**: `encodeHL7Text` must replace the escape character (`\`) with `\E\` *before* replacing any other delimiter — confirmed against HL7 v2.5.1's defined escape sequences (`\E\` escape, `\F\` field `|`, `\S\` component `^`, `\T\` subcomponent `&`, `\R\` repetition `~`). Escaping delimiters first would corrupt the output, since each of those replacements itself inserts new `\` characters that a subsequent "escape `\`" pass would then re-escape (e.g. `|` → `\F\`, then a later `\`→`\E\` pass turns that into `\E\F\E\`). This is a standard trap in any escaping implementation — you always neutralize the escape character itself first — but worth stating as an explicit, tested ordering requirement rather than leaving it as an implicit property of whatever order the replacements happen to be written in.

**Timestamps use the `DTM` format, not ISO-8601.** The canonical IR stores dates/timestamps as ISO-8601 (`referenceDate`, `Encounter.period`, `ObservationEntity.effectiveDateTime`, etc.), but HL7 v2.5.1's `TS`/`DTM` datatype (`MSH-7`, `EVN-2`, `PID-7`, `PV1-44`, `OBR-7`, `OBX-14`) is `YYYY[MM[DD[HH[MM[SS[.S[S[S[S]]]]]]]]][+/-ZZZZ]` — no hyphens, colons, or `T` separator — confirmed against HL7 v2.5.1 Chapter 2. A shared `toDTM(isoString, precision)` formatter (date-only `YYYYMMDD` for `PID-7`; full timestamp `YYYYMMDDHHMMSS` for the rest) is a required part of PR 2b — every date-bearing field must go through it, never string-substitute the ISO punctuation out ad hoc per call site.

**Message structure is modeled as nested groups, not a flat segment list** — verified against real example messages and HAPI's own `ORU_R01`/`ORM_O01` message-class definitions:
- `ADT^A01`/`ADT^A08`: `MSH, EVN, PID, [PV1], [DG1...], [AL1...]` — flat, no grouping needed.
- `ORU^R01`: `MSH, PATIENT_RESULT{ PATIENT{ PID, [PV1] }, { ORDER_OBSERVATION{ ORC, OBR, { OBX } } } }` — `PID`/`PV1` sit inside a `PATIENT` sub-group of `PATIENT_RESULT` (confirmed via HAPI's `message.getPATIENT_RESULT().getORDER_OBSERVATION()` accessor chain, which only exists because `PATIENT_RESULT` is itself a group containing both a `PATIENT` group and repeating `ORDER_OBSERVATION` groups), which in turn contains repeating `ORDER_OBSERVATION` groups (one `ORC`+`OBR` plus repeating `OBX`s each).
- `ORM^O01`: `MSH, [PID], [PV1], { ORC, OBR }` — the same `ORC`/`OBR` group as `ORU^R01`, just without the `OBX`s.
- **This grouping is a parsing/validation-level concept, not a wire-format one** — on the pipe-delimited wire there's no literal group marker, so the actual byte sequence is still the flat, sequential `MSH\rPID\rPV1\rORC\rOBR\rOBX...\r`. The group model matters for how the *builder code* is organized (so it can be validated against a real tree-based parser like `hl7v2` and reused correctly for `ORM^O01`), not for how bytes are joined on output.

The `ORC`/`OBR`/`OBX` group builder is shared between `ORU^R01` and `ORM^O01` rather than duplicated. Modeling the group explicitly (an ordered list of segments/sub-groups) costs a small amount of structure up front that MVP's actual output doesn't observably need yet (today, every message instantiates exactly one group), but it's what keeps the shape honest against what the real spec — and the independent `hl7v2` parser used for cross-validation — actually expects, and means a future multi-order message (two `OBR`s in one `ORU^R01`) is "the array has two entries" instead of a rewrite. The alternative (a flat segment array) was considered and rejected for the same reason this document's DAG section rejects a hardcoded generation sequence: it bakes "exactly one `OBR`" into the shape of the code rather than treating it as a data-driven property.

**Set IDs on repeating segments** (`DG1-1`, `AL1-1`, `OBX-1`, all datatype `SI`) are a 1-based sequential integer, reset per message (or per parent group, for `OBX` within each `ORDER_OBSERVATION`) — not sampled or carried over from the IR. Each repeating-segment builder takes its own array index as an explicit `index: number` argument from the caller's iteration rather than tracking a counter internally, keeping it a pure function like everything else in this pipeline.

**`AL1` (allergies)**: included in this phase, appended to the ADT builder — `AllergyEntity` already exists in the canonical IR (for FHIR's `AllergyIntolerance`), and `AL1` is a standard optional repeating ADT segment in real-world traffic, so this is one more segment builder over data that already exists, not a new message type or segment family.

**Medications (`RXO`/`RXE`, `RDE^O11`) are explicitly out of scope for this phase.** Carrying medications over HL7 v2 properly needs a different message type (`RDE^O11`) and a new segment family (`RXO`/`RXE`/`RXR`/`RXC`), and none of the three message types this phase targets (`ADT^A01`/`A08`, `ORM^O01`, `ORU^R01`) is a pharmacy order — see the README's stated use cases. Tracked as an unscheduled future roadmap item in `docs/implementation.md` ("Extended HL7 v2 coverage").

**Canonical IR → HL7 v2 coded-value mappings**, resolved now rather than left ambiguous per builder:

| IR field | IR values | HL7 v2 target | Table | Mapping |
|---|---|---|---|---|
| `demographics.gender` | `male \| female \| other \| unknown` | `PID-8` (Administrative Sex) | Table 0001 | `M \| F \| O \| U` |
| `encounter.class` | `inpatient \| outpatient \| emergency` | `PV1-2` (Patient Class) | Table 0004 | `I \| O \| E` |
| `condition.rank` | `primary \| secondary` | `DG1-15` (Diagnosis Priority) | — | `1 \| 2` |
| `allergy.criticality` | `low \| high \| unable-to-assess` | `AL1-4` (Allergy Severity) | Table 0128 | `MI \| SV \| U` |
| `observation.value` | `number \| string` | `OBX-2` (Value Type) | Table 0125 | `NM` if `typeof value === "number"`, else `ST` |

These are pure functions with no fallback branch needed — every IR union is closed and every arm maps to exactly one HL7 code, so a `never`-exhaustiveness check at each mapping function catches an unmapped case at compile time if the IR's union ever grows.

**Deterministic message metadata**: `MSH-7` (message date/time) and `MSH-10` (message control ID) are derived from the seed by default — `MSH-10` via a dedicated forked PRNG stream (`prng.fork("msh-10")`), `MSH-7` from `referenceDate` — never `Date.now()`, so two calls to `.toHL7()` with the same seed produce byte-identical output, matching how `.toJSON()`/`.toFHIR()` already behave as pure functions of the IR. Real interface traffic expects `MSH-10` to be unique per message instance (a receiving system echoes it back in `MSA-2` for ACK correlation, and two messages sharing one control ID sent to the same receiver is ambiguous for dedup), so a caller simulating several distinct messages from one patient needs a way to vary it — `.toHL7(eventType, options?)` accepts an explicit `options.messageControlId` override for that case. The library doesn't do this by mutating hidden state to hand out a new ID per call: that would reintroduce exactly the kind of hidden order-dependence the seeded-PRNG `fork()` footgun already warns against elsewhere in this document — a caller who needs distinct IDs supplies them explicitly instead of the library guessing when uniqueness matters. **`MSH-10` (`ST` datatype) has a confirmed 20-character maximum in HL7 v2.5.1** (verified against the base standard, not assumed) — `generateSeededUUID`'s 36-character hyphenated format is too long and must not be reused here; the default generator needs a compact form instead (e.g. a 16-character base36/hex digest of the forked stream's output), implemented and tested in PR 2b.

**`.toHL7()` options**, formalizing what "message-level configuration passed to `.toHL7()`" (see "Deliberately not modeled" above) actually means as a type:

```ts
type HL7EventType = "ADT^A01" | "ADT^A08" | "ORM^O01" | "ORU^R01";

interface HL7ExportOptions {
  sendingApplication?: string;    // MSH-3, default "CLINICAL_FAKER"
  sendingFacility?: string;       // MSH-4, default "CLINICAL_FAKER_FACILITY"
  receivingApplication?: string;  // MSH-5, default "RECEIVING_APP"
  receivingFacility?: string;     // MSH-6, default "RECEIVING_FACILITY"
  messageControlId?: string;      // MSH-10 override — must be ≤ 20 chars; InvalidMessageControlIdError otherwise
  processingId?: "P" | "T" | "D"; // MSH-11, default "P" (Production) — matches this library's synthetic-but-production-shaped output
}
```

`.toHL7(eventType: HL7EventType, options?: HL7ExportOptions)` is the resulting signature.

**Empty-collection handling for `ORU^R01`**: `patient.observations` is `[]` by default until a Phase 4 archetype populates it (see Phase 1's `demographicsNode`/`encounterNode` notes). `.toHL7("ORU^R01")` on such a patient produces a **structurally valid message with an `OBR` and zero `OBX` segments** — legal per the spec (an `ORDER_OBSERVATION` group's `OBSERVATION` sub-group is itself optional/repeating, not required-minimum-one) and consistent with how `.toJSON()`/`.toFHIR()` already handle the same empty-array case: no result to serialize is a legitimate state, not a caller error. `createPatient()` doesn't throw `UnknownArchetypeError`-style validation errors for "not enough data to be interesting" elsewhere in the IR, and `.toHL7()` shouldn't invent a new rule for it here.

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

**A real `sideEffects: false` bundler bug, caught by actually running the build output (PR 1e)**: `bun run build` reported success and `bun build`'s own summary said "Bundled 1 module", but `dist/index.js` contained nothing but a dangling `export { createPatient, ... }` statement — none of the names were actually defined, so `node`'s ESM loader threw `SyntaxError: Export 'X' is not defined in module` the moment anything imported it. Isolated with a minimal 3-file reproduction outside this repo: a package with `"sideEffects": false` whose entry point is a *pure re-export barrel* (`export { Foo } from "./a.ts"` with no local declarations of its own) gets its entire re-exported content tree-shaken away by Bun's bundler, because being re-exported by the entry point itself isn't treated as a "used" signal the way an external importer's usage would be. The fix is the standard array form of `sideEffects` that names the entry file as an exception — `"sideEffects": ["./src/index.ts"]` — rather than the boolean `false`; this still declares every other module (including future ontology data modules) side-effect-free for tree-shaking purposes, it just stops the bundler from discarding the one file whose entire job is re-exporting. **The lesson generalizes**: `bun run build` exiting 0 is not proof the build works — this is exactly why `scripts/smoke-test-esm.mjs` actually imports and exercises `dist/index.js` under plain Node rather than just checking the file exists, and why this bug was caught by running that import by hand before ever pushing, not by trusting the exit code.

**On `"./src/index.ts"` naming a file that isn't published**: `package.json`'s `"files": ["dist"]` means `src/` never reaches `node_modules`, so a downstream consumer's own bundler reading the installed `package.json` won't find anything at that path — the exception simply matches nothing for them. That's harmless today: the only thing they can ever import is the already-fully-bundled, flat `dist/index.js` (real local declarations, not a re-export barrel), so there's no barrel left for their bundler to wrongly tree-shake regardless of what `sideEffects` says. This entry exists purely so *our own* `bun build` step (which reads `src/`, not `dist/`) doesn't re-trigger the bug above. Once Phase 5's multi-entry `--splitting` build ships shared chunk files a consumer's bundler could plausibly tree-shake incorrectly, this will need revisiting with entries matching the shipped `dist/*` paths — tracked here rather than solved speculatively now.
