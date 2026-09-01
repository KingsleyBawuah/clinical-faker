# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project scaffold: Bun/TypeScript/Biome toolchain, contributor conventions, and design docs (`docs/architecture.md`, `docs/implementation.md`).
- CI workflow with quality gates: lint, typecheck, type coverage, tests, build, license checks, and commit message linting.
- Seeded PRNG core (`src/core/prng`): SplitMix32 seed derivation, Mulberry32 generation streams with deterministic `fork()`, stateless Box-Muller Gaussian sampling, and seeded RFC 4122 v4-shaped UUIDs — the determinism foundation the rest of the generator builds on. Not yet exposed via a public entry point.
- DAG resolver (`src/core/dag`): generic Kahn's-algorithm topological sort with a deterministic ascending-lexical-id tie-break, plus a `ClinicalFakerError` base class and `CyclicDependencyError`/`UnresolvedDependencyError`/`DuplicateNodeIdError`/`DependencyNotReadyError`. Not yet exposed via a public entry point.
- `createPatient(options?)`: generates a deterministic synthetic patient (demographics, one encounter) and returns a `Patient` with a `.toJSON()` export. First public entry point — `clinical-faker`'s root import now works end to end.

### Fixed

- `bun run build`'s output (`dist/index.js`) was silently empty at runtime despite a successful build: Bun's bundler tree-shook away `src/index.ts`'s entire re-exported content because of `package.json`'s `"sideEffects": false`. Fixed by switching to the array form (`"sideEffects": ["./src/index.ts"]`), which keeps every other module tree-shakable while exempting the root barrel.
- `Demographics.dob`/`.age` could disagree by a year: `birthYear` was computed without checking whether the sampled birthday had already occurred relative to `referenceDate`.
- `Patient.toJSON()` closed over a stale snapshot instead of reflecting the patient object's current state.
- A non-finite `seed` (e.g. `NaN`) silently serialized as `"seed":null` in JSON output instead of being rejected; `seed` is now normalized/validated (`InvalidSeedError`).
- An invalid or calendar-impossible `referenceDate` override (e.g. `"2024-02-31"`) crashed generation with an uncaught `RangeError` instead of a clear error (`InvalidReferenceDateError`).
- Generated provider NPIs failed real-world Luhn checksum validation ~90% of the time; they now carry a correctly-computed NPI check digit.
- Inpatient encounters could last as little as 15 minutes; inpatient stays now have a 12-hour minimum duration.
- `projectVitals` picked whichever same-LOINC-code observation appeared last in the array rather than the one with the latest `effectiveDateTime`.
