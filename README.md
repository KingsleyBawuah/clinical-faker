# clinical-faker

Zero-dependency, TypeScript-first synthetic clinical data generator. Generates a deterministic, seeded canonical patient model and exports it as plain JSON, HL7 v2 messages, or FHIR R4 bundles — for integration-testing healthcare systems without touching real patient data.

> **Status**: early development. The API below reflects the target design and is not yet fully implemented — see `docs/implementation.md` for current progress.

## Install

```
bun add clinical-faker
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
