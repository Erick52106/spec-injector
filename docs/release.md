# Release and Install Strategy

## Purpose

This document defines the current install, usage, and future release phases for `spec-injector`.

The current goal is to let developers and AI implementers get the `spec` CLI through a local clone plus `npm link`, without assuming a published stable npm release already exists.

## Current status

- `package.json` already defines the CLI bin as `spec`.
- The project is currently suited for local development install.
- There is not yet a formal stable npm release.
- Do not assume `npm install -g spec-injector` is currently available or supported.
- CI already exists and runs `npm test`.
- `npm test` runs `npm run build` first, then executes CLI integration tests.

## Phase 1: Local development install

```bash
git clone https://github.com/Erick52106/spec-injector.git
cd spec-injector
npm install
npm run build
npm test
npm link
spec --help
```

Explanation:

- `npm install` installs project dependencies.
- `npm run build` compiles the TypeScript source into the runnable CLI output.
- `npm test` runs the build step and then the CLI integration tests.
- `npm link` exposes the local CLI as the `spec` command on the current machine.
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
- Do not run `npm publish`.
- Do not modify a target repo until the user has approved initialization.
- Prefer dry-run prompt generation before implementation.
- Treat the issue body as the source of truth.

## Phase 2: GitHub install candidate

Future support may include:

```bash
npm install -g github:Erick52106/spec-injector
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
npm publish --tag beta
npm install -g spec-injector@beta
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
npm install -g spec-injector
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
