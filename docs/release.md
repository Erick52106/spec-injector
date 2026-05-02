# Release and Install Strategy

## Purpose

This document defines the current install, usage, and future release phases for `spec-injector`.

The current goal is to let developers and AI implementers get the `spec` CLI through a local clone plus `pnpm link --global`, without assuming a published stable npm release already exists.

## Current status

- `package.json` already defines the CLI bin as `spec`.
- The project is currently suited for local development install.
- There is not yet a formal stable npm release.
- Do not assume a stable global install for `spec-injector` is currently available or supported.
- CI already exists and runs `pnpm test`.
- `pnpm test` runs `pnpm build` first, then executes CLI integration tests.

## Phase 1: Local development install

```bash
git clone https://github.com/Erick52106/spec-injector.git
cd spec-injector
corepack enable
pnpm install
pnpm build
pnpm test
pnpm link --global
spec --help
```

Explanation:

- `pnpm install` installs project dependencies.
- `pnpm build` compiles the TypeScript source into the runnable CLI output.
- `pnpm test` runs the build step and then the CLI integration tests.
- `pnpm link --global` exposes the local CLI as the `spec` command on the current machine.
- `spec --help` verifies that the CLI is available after linking.

## Using spec-injector in a target repo

```bash
cd /path/to/target-repo
spec init --repo .
spec validate --repo .
spec config suggest always-read --repo .
spec plan <issue-number> --repo . --dry-run --format prompt --verbose
```

Explanation:

- `spec init --repo .` creates `.spec-injector/config.json` in the target repo.
- `spec validate --repo .` validates the config and reports project metadata and discovery settings.
- `spec config suggest always-read --repo .` suggests candidate files only and does not modify config automatically.
- `spec plan <issue-number> --repo . --dry-run --format prompt --verbose` is a compact prompt-oriented flow that is suitable for AI implementers before implementation starts.

## AI implementer setup guidance

When asked to use `spec-injector`:

- First check whether `spec --help` works.
- If not installed, follow the local development install steps.
- Do not assume a stable npm release exists.
- Do not run `pnpm publish`.
- Do not modify a target repo until the user has approved initialization.
- Prefer dry-run prompt generation before implementation.
- Treat the issue body as the source of truth.

## Phase 2: GitHub install candidate

Future support may include:

```bash
pnpm add --global github:Erick52106/spec-injector
```

This is currently only a candidate path. It is not yet guaranteed, validated, or officially supported.

## Phase 3: npm beta candidate

Possible future release conditions:

- CI is stable.
- CLI integration tests cover core commands.
- README quickstart is complete.
- Release notes or changelog policy is defined.
- Package metadata has been reviewed.

Possible future commands:

```bash
pnpm publish --tag beta
pnpm add --global spec-injector@beta
```

This phase has not been executed yet.

## Phase 4: npm stable candidate

Possible future release conditions:

- Beta usage has been validated.
- Install documentation has been verified.
- Versioning policy has been defined.
- Changelog process has been defined.
- Breaking-change policy has been defined.

Possible future command:

```bash
pnpm add --global spec-injector
```

There is no stable release at this time.

## Non-goals

This document does not currently:

- publish to npm
- create a release workflow
- create an npm token
- modify package metadata
- promise that a stable npm package is already available
- automatically modify a user's repo CI
