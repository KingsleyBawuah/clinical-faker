# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Project scaffold: Bun/TypeScript/Biome toolchain, contributor conventions, and design docs (`docs/architecture.md`, `docs/implementation.md`).
- CI workflow with quality gates: lint, typecheck, type coverage, tests, build, license checks, and commit message linting.
- Seeded PRNG core (`src/core/prng`): SplitMix32 seed derivation, Mulberry32 generation streams with deterministic `fork()`, stateless Box-Muller Gaussian sampling, and seeded RFC 4122 v4-shaped UUIDs — the determinism foundation the rest of the generator builds on. Not yet exposed via a public entry point.
- DAG resolver (`src/core/dag`): generic Kahn's-algorithm topological sort with a deterministic ascending-lexical-id tie-break, plus a `ClinicalFakerError` base class and `CyclicDependencyError`/`UnresolvedDependencyError`/`DuplicateNodeIdError`. Not yet exposed via a public entry point.
