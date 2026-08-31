# AGENTS.md

Instructions for anyone (human or AI agent) contributing to `clinical-faker`.

## Project

`clinical-faker` is a zero-dependency, TypeScript-first synthetic clinical data generator that produces HL7 v2 messages and FHIR R4 bundles from a single deterministic, seeded canonical patient model. See `docs/architecture.md` for the design and `docs/implementation.md` for current phase status and remaining work.

## Setup & commands

```
bun install       # install dev dependencies
bun test          # run the test suite
bun run typecheck # strict TypeScript, no emit
bun run lint      # Biome check (format + lint + import organization), no writes
bun run lint:fix  # Biome check, applying safe fixes
bun run build     # bundle JS (bun build) + emit .d.ts (tsc --emitDeclarationOnly)
```

Formatting and linting are handled by [Biome](https://biomejs.dev/) (`biome.json`), not ESLint/Prettier.

## Workflow

- **Never commit directly to `main`.** All work happens on a feature branch and lands via pull request. This is enforced by GitHub branch protection on `main` (pull request required, enforced for admins too, force-pushes and deletion disabled) — not just a documented convention.
- **One unit of work per PR.** Keep PRs small and focused — a single phase's sub-step, not a whole phase, and never multiple unrelated changes bundled together.
- **Conventional Commits** for every commit message (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, etc.).
- **TDD**: write tests alongside or before the implementation they cover. A PR that adds behavior without tests is incomplete.
- **100% type coverage**: no `any`, no unchecked type escapes (`as unknown as T`, non-null assertions used to silence real gaps). `bun run typecheck` must pass with the repo's strict `tsconfig.json` settings.
- Update `docs/implementation.md` as part of the PR when a phase or sub-step is completed or when scope changes.
- **Update `CHANGELOG.md`** in the same PR for any user-facing change — a new feature, a bug fix, a breaking change, or a deprecation — filed under `## [Unreleased]` in the appropriate [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) category (`Added`/`Changed`/`Deprecated`/`Removed`/`Fixed`/`Security`). Docs-only changes, CI/tooling changes, and internal refactors with no behavior change don't need an entry. At release time, `[Unreleased]` becomes the new version section.
- **Don't commit before outlining the changes for review.** An agent working in this repo must summarize what a commit will contain — files touched, and why — and let the user review it before running `git commit`. This applies even when the user has already asked for the underlying work to be done; committing is a separate, explicitly-reviewed step.

## CI/CD

- Every PR runs CI: `bun install`, `bun run typecheck`, `bun run ci:lint` (Biome), `bun test`, `bun run build`. All must pass before merge.
- Publishing to npm is automated, not manual: a tagged release (or merge to `main` with a version bump, depending on how the workflow is finalized) triggers a GitHub Actions workflow that builds and runs `npm publish` (or `bun publish`, whichever proves more reliable for this package's exports map) using an `NPM_TOKEN` repository secret.
- The actual `.github/workflows/*.yml` files land as their own dedicated PR(s) once there's a meaningful build to verify — see `docs/implementation.md` for tracking.

## Zero-dependency policy

No runtime `dependencies` in `package.json` — ever. `devDependencies` are limited to TypeScript and test tooling. If a task seems to need a third-party runtime package, that's a signal to reconsider the approach, not to add the dependency.
