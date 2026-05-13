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

## Versioning Policy

`spec-injector` uses a SemVer-like package version policy even before a stable npm release exists. The package version is still useful for local runners, target repo capability audits, implementation evidence, and future release notes.

Current policy:

- Patch version: default bump for merged deliverable changes.
- Minor version: human-reviewed milestone decision.
- Major version: human-reviewed product-stability decision.

Version bumps should happen through a normal reviewed PR. This project does not currently use Changesets and does not auto-publish npm packages.

## Patch Version Bump

Patch is the third number, for example `0.1.0 -> 0.1.1`.

After an implementation PR merges, the next release-maintenance PR should bump patch by default when the merge changed any shipped or user-facing deliverable:

- CLI behavior, flags, output, error handling, or command routing
- `spec workflow-check`, `spec evidence-check`, `spec awp-review-check`, `spec doctor`, or other checker behavior
- bug fix, parser fix, classifier fix, reference collection fix, or config loader fix
- tests that protect shipped CLI / workflow behavior
- docs that define target repo adoption contracts, release/install behavior, AWP evidence gates, or other workflow contracts that downstream repos can rely on
- package metadata or install instructions that affect how users invoke the tool

Patch bump can be batched across multiple merged PRs. It does not need to happen inside every feature PR, but it should not be skipped when downstream repos would otherwise see the same version for materially different capabilities.

## No Patch Bump Needed

Some changes can use capability checks, issue evidence, or docs notes without bumping package version immediately:

- comment-only GitHub closeout or metadata-only label/milestone repair
- typo-only docs that do not change a contract, command, install path, or downstream expectation
- planning docs explicitly marked future / design-only and not used as current capability
- internal audit reports that do not change user-facing behavior or adopted workflow policy
- worktree cleanup, branch cleanup, or evidence readback with no repo diff

If uncertain, prefer recording the uncertainty in the PR body and leave the minor/major/patch decision to a release-maintenance PR instead of changing version ad hoc.

## Minor Version Gate

Minor is the second number, for example `0.1.x -> 0.2.0`.

Minor bumps require human or high-level reviewer assessment. Good candidates include:

- a coherent workflow generation is complete, such as a full AWP evidence gate set moving from experimental docs to adopted CLI behavior
- downstream repos have adopted the contract and compatibility fixtures are stable
- release notes can describe a meaningful capability set rather than a single patch
- the compatibility boundary is understood and documented
- known safety non-goals remain explicit

AI implementers should stop and request human release review before changing the minor version.

## Major Version Gate

Major is the first number, for example `0.x -> 1.0.0`.

Major bumps require explicit product-level approval. A major release should wait until the project can make stable public commitments about:

- CLI compatibility and deprecation policy
- install path and package distribution
- target repo mutation boundaries
- workflow-check / evidence-check authority limits
- security and private-context handling
- release notes and changelog expectations

No AI workflow should infer a major bump from merged implementation work alone.

## Release Checklist

Until a separate issue adopts Changesets or release automation, use a simplified manual release PR:

```markdown
## Release checklist

- [ ] Source PRs / issues listed
- [ ] Version bump type: patch / minor / major
- [ ] Reason for bump type
- [ ] `package.json` version updated
- [ ] `pnpm-lock.yaml` updated only if package metadata requires it
- [ ] Capability notes or changelog summary updated, if applicable
- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm build`
- [ ] `pnpm test`
- [ ] `git diff --check`
- [ ] No `pnpm publish`
- [ ] No npm token or registry setting changed
```

Patch release PRs may be opened by an AI implementer when the source issue explicitly scopes release maintenance or when the user asks to prepare the release PR. Minor and major release PRs require explicit human authorization in the issue or prompt.

## Anti-Churn Rules

Avoid meaningless version churn:

- Do not bump version for every comment-only or label-only closeout.
- Do not bump version twice for the same merged capability batch.
- Do not bump minor or major to make a PR look more important.
- Do not publish to npm as part of a version bump unless a separate issue explicitly authorizes publication.
- Do not treat capability checks such as `spec doctor --workflow awp --format json` as a substitute for package version forever; they are a compatibility bridge, not the release policy.

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
