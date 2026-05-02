# spec-injector Conventions

## Purpose

This document defines how spec-injector uses issues, pull requests, labels, and title conventions. The goal is to help humans and AI implementers classify work consistently and reduce scope guessing.

## Labels

### GitHub default labels

spec-injector keeps the GitHub default labels as-is. They should not be deleted or renamed.

- `bug`
- `documentation`
- `duplicate`
- `enhancement`
- `good first issue`
- `help wanted`
- `invalid`
- `question`
- `wontfix`

Usage principles:

- `bug`: bug fix or incorrect behavior
- `documentation`: documentation-related work
- `enhancement`: new feature or improvement proposal
- `duplicate`: duplicate issue
- `question`: question or clarification
- `wontfix`: explicitly not planned

### Custom labels

spec-injector also uses a small set of custom labels.

Type-like custom labels:

- `type:design` — design discussion, architecture planning, or product direction
- `type:ci` — CI, GitHub Actions, or automation changes
- `type:test` — tests, fixtures, or test infrastructure
- `type:chore` — maintenance or repository housekeeping

Area labels:

- `area:cli` — CLI commands, flags, and command routing
- `area:config` — config schema, config loading, or config management
- `area:classifier` — domain classification and scoring
- `area:discovery` — repo-aware docs/source discovery
- `area:template` — task package and prompt rendering templates
- `area:workflow` — AI workflow, slash-command-like usage, or skill-like flow
- `area:ci` — CI and repository automation
- `area:docs` — documentation area
- `area:release` — install, versioning, packaging, or release process
- `area:agent` — agent, subagent, MCP, or structured agent interface

Status labels:

- `status:needs-design` — needs design discussion before implementation
- `status:ready` — ready for implementation
- `status:blocked` — blocked by dependency or decision

### Avoid overlapping labels

Do not create or use the following custom labels:

- `type:feat`
- `type:fix`
- `type:docs`

Reasons:

- `type:feat` overlaps with the GitHub default `enhancement`
- `type:fix` overlaps with the GitHub default `bug`
- `type:docs` overlaps with the GitHub default `documentation`

## Issue title convention

Issue titles should generally follow a Conventional Commits-like style, while still allowing natural wording when that reads better.

Recommended format:

`<type>(optional scope): <description>`

Recommended types:

- `feat`
- `fix`
- `docs`
- `ci`
- `test`
- `refactor`
- `chore`
- `build`
- `release`

Recommended scopes:

- `cli`
- `config`
- `classifier`
- `discovery`
- `template`
- `workflow`
- `ci`
- `docs`
- `release`
- `agent`

Examples:

- `docs(conventions): define labels and title conventions`
- `test(cli): add core CLI integration tests`
- `feat(config): suggest always_read candidates`
- `docs(release): define install strategy`
- `docs(design): define Layer 1/2/3 model`

## PR title convention

Pull request titles should follow Conventional Commits style:

`<type>(optional scope): <description>`

Examples:

- `ci: add GitHub Actions build check`
- `feat(config): manage always_read files`
- `feat(config): suggest always_read candidates`
- `feat(cli): add clean command`
- `docs(workflow): add spec-plan instructions`
- `test(cli): add integration tests`
- `docs(release): define install strategy`
- `docs(design): define Layer 1/2/3 model`
- `feat(classifier): support repo-local custom domains`

Guidance:

- `type` describes the nature of the change
- `scope` identifies the primary affected area
- `description` should be a short imperative phrase or noun phrase
- Do not use `[ci]` / `[config]` / `[cli]` bracket prefixes as the primary convention

## AI implementer guidance

When opening or updating issues / PRs:

- Prefer the existing GitHub default labels when they match.
- Add one area label when the affected area is clear.
- Add a status label only when it reflects current workflow state.
- Do not invent new labels unless explicitly asked.
- Do not use `type:feat` / `type:fix` / `type:docs`.
- Use Conventional Commits style for PR titles.
- If the issue has no labels, do not treat that as permission to expand scope.
- Follow the issue body as the source of truth.

## Non-goals

This document does not currently:

- enforce PR title lint
- add a GitHub Action
- batch-update old issue or PR titles
- replace the issue body as the source of truth
