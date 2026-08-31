# clinical-faker

Zero-dependency, TypeScript-first synthetic clinical data generator. Generates a deterministic, seeded canonical patient model and exports it as plain JSON, HL7 v2 messages, or FHIR R4 bundles — for integration-testing healthcare systems without touching real patient data.

> **Status**: early development. The API below reflects the target design and is not yet fully implemented — see `docs/implementation.md` for current progress.

> **Not clinically validated.** This library generates synthetic data for software/integration testing. It is not validated for clinical education, research, or any use where medical accuracy matters — values are designed to be internally consistent and plausible at a glance, not epidemiologically or pharmacologically accurate. See `docs/architecture.md`'s "Scope & Non-Goals" for what "realistic" does and doesn't mean here.

## Use cases

- **Testing an HL7 v2 interface engine or listener** — feed it generated `ADT^A01`/`A08`, `ORM^O01`, or `ORU^R01` messages instead of hand-writing brittle fixture strings or capturing real (PHI-bearing) traffic.
- **Testing a FHIR API client or server** — generate referentially-consistent `Patient`/`Encounter`/`Condition`/`Observation`/`MedicationRequest` bundles without standing up a real EHR sandbox or test tenant.
- **Deterministic, non-flaky test suites** — the same seed always produces the same patient, so `expect(...)` assertions in a test never depend on data that changes between runs.
- **Exercising a specific clinical scenario on demand** — pick a named archetype (e.g. `AdultHypertension`) to get a patient whose vitals, diagnosis, and medications are already shaped like that condition, instead of hand-crafting edge-case data by hand.
- **Seeding demo or staging environments** with data that looks realistic but is entirely synthetic — no real patient data ever involved.
- **Integration-testing an MLLP-speaking system** end to end (see below) — a real TCP round trip with byte framing and ACKs, without a real HL7 interface engine in the loop.

## Install

The package itself is plain ESM (Node >=18), so any package manager works, even though the project is developed with Bun.

```
bun add clinical-faker
npm install clinical-faker
pnpm add clinical-faker
yarn add clinical-faker
```

## Usage

```ts
import { createPatient } from "clinical-faker";

const patient = createPatient({ seed: 42, archetype: "AdultHypertension" });

patient.toJSON();               // plain canonical representation
patient.toHL7("ADT^A01");       // pipe-delimited HL7 v2 message string
patient.toFHIR("collection");   // FHIR R4 Bundle
```

The same seed always produces the same patient — across all three export formats — which is the point: reproducible fixtures for test suites.

`.toJSON()` returns a plain object shaped like this (abbreviated):

```json
{
  "id": "pat-98213",
  "demographics": {
    "firstName": "Jane",
    "lastName": "Doe",
    "dob": "1958-04-12",
    "gender": "female",
    "mrn": { "value": "MRN00042", "assigningAuthority": "clinical-faker" },
    "address": { "line": "742 Evergreen Terrace", "city": "Springfield", "state": "IL", "postalCode": "62704", "country": "US" }
  },
  "vitals": { "systolicBp": 142, "diastolicBp": 90, "heartRate": 74 },
  "conditions": [{ "code": "I10", "display": "Essential hypertension" }],
  "medications": [{ "name": "Lisinopril 10mg", "rxcui": "314076", "sig": "Daily" }]
}
```

### In a test

```ts
import { expect, test } from "bun:test"; // or vitest, or jest — same idea
import { createPatient } from "clinical-faker";

test("hypertensive patient has an elevated systolic reading", () => {
  const patient = createPatient({ seed: 42, archetype: "AdultHypertension" });

  expect(patient.toJSON().vitals?.systolicBp).toBeGreaterThan(130);
  expect(createPatient({ seed: 42, archetype: "AdultHypertension" })).toEqual(patient); // same seed, same patient
});
```

## MLLP mock server

```ts
import { MLLPServer, sendMLLP } from "clinical-faker/mllp";

const server = new MLLPServer({ port: 0 });
await server.listen();

const ack = await sendMLLP("localhost", server.port, patient.toHL7("ADT^A01"));
```

## Design

See `docs/architecture.md` for the canonical patient model, the seeded PRNG/DAG resolution engine, and the HL7/FHIR serialization approach.

## Third-party data

This package bundles small subsets of ICD-10-CM, RxNorm, LOINC, and UCUM codes. See `THIRD_PARTY_NOTICES.md` (added once the ontology licensing audit lands) for attribution requirements that apply to anyone redistributing this package's output.

## License

MIT — see `LICENSE`.
