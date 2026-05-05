# Status Event Schema Proposal

## Purpose

本文件是 #111 的 docs-only design proposal，定義 future workflow observability / companion status layer 可使用的 status event schema vocabulary。

它只描述 future-facing state model、event / snapshot shape、privacy boundary、low-resource update strategy 與 consumer boundary。它不實作 daemon、companion UI、Tauri app、browser overlay、background watcher、CLI output、status JSON emitter 或 runtime。

`spec-injector` 目前仍是 deterministic issue-to-context compiler for AI coding agents。Status event schema 是未來 companion / workflow observability layer 可消費的穩定語彙，不是 current CLI core output contract。

## Product Boundary

`spec-injector` remains a deterministic issue-to-context compiler. It compiles source-trusted issue / request context into bounded task packages for AI coding agents.

Status schema is future-facing observability vocabulary:

- It may describe workflow state such as planning, testing, review-needed, warning, or success.
- It may be consumed by a future local companion layer, including `Spec Cat`.
- It may support local widgets, overlays, docs examples, or test fixtures in future issues.
- It must not pollute CLI core with companion, daemon, watcher, dashboard, or runtime assumptions.

This schema does not imply:

- daemon implementation
- companion UI implementation
- CLI JSON output
- background watcher
- hosted control plane
- agent orchestration
- remediation bot
- merge bot
- target repo automation
- hidden LLM / semantic RAG

## State Model

States describe human-readable workflow posture. They are intentionally coarse so future consumers can stay stable while producers evolve.

| State | Meaning | Example trigger | Example user-facing summary | Blocking | Human action needed |
| --- | --- | --- | --- | --- | --- |
| `idle` | No active task is being worked, or the current task is waiting for explicit user direction. | Worktree is clean and no source issue is selected. | "Waiting for the next scoped issue." | Non-blocking | Optional |
| `planning` | The assistant is reading issue scope, repo docs, constraints, or existing state before editing. | Issue body and workflow docs are being inspected. | "Reading #111 and repo boundaries before drafting the schema." | Non-blocking | No |
| `working` | A scoped implementation or docs edit is in progress. | A docs file is being edited in the dedicated worktree. | "Drafting the status event schema proposal." | Non-blocking unless a stop condition appears | No |
| `testing` | Validation, build, tests, diff checks, or readback verification are running. | `git diff --check`, `pnpm build`, or `pnpm test` is running. | "Running validation commands for the docs-only change." | Non-blocking while in progress | No |
| `review-needed` | Work is ready for human review, or a human decision is required before continuing. | PR is opened and evidence is backfilled, or a finding needs human judgment. | "PR is ready for human review; merge remains a human decision." | Blocking only when explicit human decision is required | Yes |
| `success` | The scoped task reached its requested completion criteria. | Validation passed, PR body and issue evidence were readback verified. | "Validation and evidence are ready for review." | Non-blocking | Usually no, except normal review / merge |
| `warning` | A recoverable stop-and-report, stale state, partial validation, or non-fatal risk was observed. | Main or worktree is dirty before starting; optional validation skipped with reason. | "Stopped because the worktree is dirty; no cleanup was attempted." | May be blocking | Often yes |
| `error` | A required operation failed and the workflow cannot continue safely. | GitHub auth failure prevents evidence comment creation. | "Cannot post issue evidence because GitHub authentication failed." | Blocking | Yes |

State meaning is descriptive, not authoritative. A `success` state cannot approve a merge. A `review-needed` state cannot force a reviewer decision. A `warning` state cannot authorize cleanup.

## Event Vs Snapshot Model

### Status Event

A status event is an append-only-ish transition or observation record. It records something that happened in the workflow:

- preflight started
- issue context loaded
- docs edit started
- validation command passed or failed
- dirty worktree stop occurred
- PR evidence was posted
- human review is needed

Events are useful for audit trails, low-resource UI updates, test fixtures, and future companion state transitions. They are not the source of truth for merge decisions, GitHub state, review thread resolution, or target repo state.

### Current Status Snapshot

A current status snapshot is the latest durable summary intended for display. A future local widget may read one snapshot instead of replaying the full event log.

Snapshots may summarize:

- latest state
- active repo / issue / PR
- current action
- validation summary
- dirty state
- next human action
- evidence URLs

A snapshot must not authorize automation. It cannot approve merge, close issue, resolve review thread, mutate target repo, or override live GitHub / git state.

### Source Of Truth

The event log and snapshot are derived observability artifacts. Merge readiness still depends on live git state, GitHub PR / issue readback, validation output, review findings, CI checks, and explicit human authorization.

## Stable JSON Shape

The minimal shape is JSON-object based so future producers can write simple local files and future consumers can avoid parsing prose.

### Required Fields

| Field | Type | Notes |
| --- | --- | --- |
| `schemaVersion` | string | Versioned independently from package version. Initial proposal uses `"status-event/v1"`. |
| `type` | string | `"event"` or `"snapshot"`. |
| `state` | string | One of `idle`, `planning`, `working`, `testing`, `review-needed`, `success`, `warning`, `error`. |
| `severity` | string | Suggested values: `info`, `warning`, `error`. |
| `source` | object | Explicit producer identity, for example `{ "kind": "manual-workflow", "name": "codex" }`. |
| `timestamp` | string | ISO 8601 timestamp produced by the explicit workflow step. |
| `message` | string | Short human-readable summary suitable for UI display. |

### Optional Fields

| Field | Type | Notes |
| --- | --- | --- |
| `repo` | object | Repository identity such as `owner`, `name`, `url`, and local `path`. |
| `issueNumber` | number | Source GitHub issue number when applicable. |
| `prUrl` | string | PR URL when available. |
| `branch` | string | Current implementation branch. |
| `worktreePath` | string | Local path; privacy-sensitive and local-only by default. |
| `currentAction` | string | Short description of what is happening now. |
| `lastCommand` | object | Last relevant command and result summary; do not store secrets or raw private output. |
| `validation` | object | Validation command results and skipped reasons. |
| `checks` | object | GitHub / CI check summary if explicitly read. |
| `dirtyState` | object | Worktree cleanliness and stop reason. |
| `reviewState` | object | Review finding summary and human-decision status. |
| `nextHumanAction` | string | Clear next human action, if any. |
| `evidenceUrls` | array | PR, issue comment, CI, or docs URLs. |
| `relatedIssues` | array | Related issue numbers or URLs. |
| `privacy` | object | Local-only and redaction hints for future consumers. |

### Field Guidelines

- `source` must identify an explicit producer. Hidden autonomous producers are out of scope.
- Avoid using `lastCommand.output`; prefer `exitCode`, `result`, and a concise, sanitized `summary` instead.
- `worktreePath` and repo paths may be sensitive. Future consumers should treat them as local-only unless explicitly shared.
- `validation` should distinguish `passed`, `failed`, `skipped`, and `not-required`.
- `reviewState` should not collapse bot findings into approval. It may record classification counts, but live review threads remain authoritative.

## Example JSON Events

### Planning Event

```json
{
  "schemaVersion": "status-event/v1",
  "type": "event",
  "state": "planning",
  "severity": "info",
  "source": {
    "kind": "manual-workflow",
    "name": "codex"
  },
  "timestamp": "2026-05-05T10:15:00+08:00",
  "repo": {
    "owner": "Erick52106",
    "name": "spec-injector",
    "url": "https://github.com/Erick52106/spec-injector"
  },
  "issueNumber": 111,
  "branch": "docs/status-event-schema-111",
  "currentAction": "Reading issue scope and companion boundary docs",
  "message": "Planning status event schema boundaries before editing docs."
}
```

### Testing Event

```json
{
  "schemaVersion": "status-event/v1",
  "type": "event",
  "state": "testing",
  "severity": "info",
  "source": {
    "kind": "manual-workflow",
    "name": "codex"
  },
  "timestamp": "2026-05-05T11:20:00+08:00",
  "repo": {
    "owner": "Erick52106",
    "name": "spec-injector"
  },
  "issueNumber": 111,
  "branch": "docs/status-event-schema-111",
  "lastCommand": {
    "command": "pnpm build",
    "exitCode": null,
    "result": "running"
  },
  "validation": {
    "commands": [
      {
        "command": "git diff --check",
        "result": "passed"
      },
      {
        "command": "pnpm build",
        "result": "running"
      }
    ]
  },
  "message": "Running requested validation for the docs-only schema proposal."
}
```

### Review-needed Event

```json
{
  "schemaVersion": "status-event/v1",
  "type": "event",
  "state": "review-needed",
  "severity": "info",
  "source": {
    "kind": "manual-workflow",
    "name": "codex"
  },
  "timestamp": "2026-05-05T12:05:00+08:00",
  "repo": {
    "owner": "Erick52106",
    "name": "spec-injector"
  },
  "issueNumber": 111,
  "prUrl": "https://github.com/Erick52106/spec-injector/pull/000",
  "branch": "docs/status-event-schema-111",
  "reviewState": {
    "humanReviewRequired": true,
    "automatedFindingsAssessed": false,
    "mergeAuthorized": false
  },
  "nextHumanAction": "Review the PR. Merge remains a human decision.",
  "message": "Status event schema proposal is ready for human review."
}
```

### Warning Event For Dirty Worktree Stop

```json
{
  "schemaVersion": "status-event/v1",
  "type": "event",
  "state": "warning",
  "severity": "warning",
  "source": {
    "kind": "manual-workflow",
    "name": "codex"
  },
  "timestamp": "2026-05-05T09:45:00+08:00",
  "repo": {
    "owner": "Erick52106",
    "name": "spec-injector",
    "path": "/Users/example/dev/spec-injector"
  },
  "issueNumber": 111,
  "dirtyState": {
    "worktreeClean": false,
    "untrackedFiles": true,
    "modifiedFiles": true,
    "stopReason": "Main worktree was dirty before implementation."
  },
  "nextHumanAction": "Decide whether to preserve, commit, or remove the existing local changes.",
  "message": "Stopped before editing because the worktree is dirty."
}
```

### Error Event For GitHub Auth / Permission Failure

```json
{
  "schemaVersion": "status-event/v1",
  "type": "event",
  "state": "error",
  "severity": "error",
  "source": {
    "kind": "manual-workflow",
    "name": "codex"
  },
  "timestamp": "2026-05-05T12:30:00+08:00",
  "repo": {
    "owner": "Erick52106",
    "name": "spec-injector"
  },
  "issueNumber": 111,
  "branch": "docs/status-event-schema-111",
  "lastCommand": {
    "command": "gh issue comment 111 --body-file /tmp/issue-111-evidence.md",
    "exitCode": 1,
    "result": "failed",
    "summary": "GitHub authentication or permission failed. Full auth output was not stored."
  },
  "nextHumanAction": "Restore GitHub CLI authentication or repository write permission, then retry the evidence workflow.",
  "message": "Cannot post issue evidence because GitHub write access failed."
}
```

### Success Event After Validation And Evidence Ready

```json
{
  "schemaVersion": "status-event/v1",
  "type": "event",
  "state": "success",
  "severity": "info",
  "source": {
    "kind": "manual-workflow",
    "name": "codex"
  },
  "timestamp": "2026-05-05T13:00:00+08:00",
  "repo": {
    "owner": "Erick52106",
    "name": "spec-injector"
  },
  "issueNumber": 111,
  "prUrl": "https://github.com/Erick52106/spec-injector/pull/000",
  "branch": "docs/status-event-schema-111",
  "validation": {
    "commands": [
      {
        "command": "git diff --check",
        "result": "passed"
      },
      {
        "command": "pnpm build",
        "result": "passed"
      },
      {
        "command": "pnpm test",
        "result": "passed"
      }
    ],
    "skipped": [
      {
        "command": "pnpm test:gh",
        "reason": "Not required for docs-only #111 scope."
      }
    ]
  },
  "evidenceUrls": [
    "https://github.com/Erick52106/spec-injector/issues/111#issuecomment-0000000000",
    "https://github.com/Erick52106/spec-injector/pull/000"
  ],
  "reviewState": {
    "humanReviewRequired": true,
    "mergeAuthorized": false
  },
  "message": "Validation passed and evidence is ready for human review."
}
```

## Example Snapshot

```json
{
  "schemaVersion": "status-event/v1",
  "type": "snapshot",
  "state": "review-needed",
  "severity": "info",
  "source": {
    "kind": "local-status-file",
    "name": "future-explicit-producer"
  },
  "timestamp": "2026-05-05T13:05:00+08:00",
  "repo": {
    "owner": "Erick52106",
    "name": "spec-injector",
    "url": "https://github.com/Erick52106/spec-injector",
    "path": "/Users/example/dev/spec-injector-111"
  },
  "issueNumber": 111,
  "prUrl": "https://github.com/Erick52106/spec-injector/pull/000",
  "branch": "docs/status-event-schema-111",
  "worktreePath": "/Users/example/dev/spec-injector-111",
  "currentAction": "Waiting for human PR review",
  "validation": {
    "summary": "Requested docs-only validation passed.",
    "commands": [
      {
        "command": "git diff --check",
        "result": "passed"
      },
      {
        "command": "pnpm build",
        "result": "passed"
      },
      {
        "command": "pnpm test",
        "result": "passed"
      }
    ]
  },
  "dirtyState": {
    "worktreeClean": true
  },
  "reviewState": {
    "humanReviewRequired": true,
    "mergeAuthorized": false,
    "automatedFindingsAssessed": false
  },
  "nextHumanAction": "Review the PR. Do not treat this snapshot as merge authorization.",
  "evidenceUrls": [
    "https://github.com/Erick52106/spec-injector/issues/111#issuecomment-0000000000"
  ],
  "privacy": {
    "localOnly": true,
    "containsLocalPaths": true,
    "containsSecrets": false,
    "containsTargetRepoCode": false
  },
  "message": "Status schema proposal is ready for human review."
}
```

## Low-resource Update Strategy

Future status producers should be explicit and cheap.

Recommended strategy:

- Prefer explicit workflow writes at natural boundaries: preflight, edit start, validation start / finish, PR creation, issue evidence, PR body readback, review-needed, stop-and-report.
- Use a local status file and optional append-only event log as a future boundary, for example a repo-local or worktree-local file chosen by a separate implementation issue.
- Let a future UI watch the local status file with filesystem notifications, or refresh at low frequency.
- Keep GitHub reads event-driven or manually triggered by workflow steps. Do not constantly poll GitHub.
- Do not use OCR, screenshot monitoring, terminal scraping, or hidden browser observation.
- Do not infer state by watching arbitrary user activity.
- Do not introduce hidden autonomous agents. Producers must be explicit workflow participants.

This strategy keeps a future companion layer lightweight and auditable. It also avoids turning `spec-injector` into a daemon, hosted dashboard, or background agent runtime.

## Privacy / Local-only Boundary

Status events may contain sensitive operational metadata even when they do not include source code.

Rules:

- Avoid storing secrets, tokens, raw auth output, environment variables, or credential paths.
- Avoid copying target repo code into status events.
- Avoid copying private issue bodies, PR bodies, review comments, or command output unless explicitly intended and reviewed.
- Treat local paths such as `worktreePath`, repo paths, and temp file paths as sensitive.
- Evidence URLs are acceptable when they point to intended public or repo-local GitHub artifacts.
- Do not expose private issue contents in a public widget or screenshot.
- Do not leak target repo contents, generated task packages, source snippets, or proprietary diagnostics.
- Prefer concise summaries and references over raw output.

Future consumers should assume status artifacts are local-only unless a separate issue explicitly scopes export / sharing behavior.

## Integration Boundary

Possible future consumers:

- local web widget
- Tauri always-on-top widget
- browser overlay
- docs / reports
- test fixtures
- Spec Cat companion state mockups

This document does not implement any consumer. It also does not choose a status file path, storage lifecycle, UI toolkit, overlay technology, or runtime process model.

Any future consumer must preserve the product boundary:

- consume explicit status artifacts
- avoid hidden monitoring
- avoid target repo mutation
- avoid automation authority
- keep `spec-injector` positioned as the deterministic compiler

## Human Authority And Automation Limits

Status events and snapshots are evidence aids, not authority.

They cannot:

- approve merge
- close issue
- resolve review thread
- mutate target repo
- push branch
- create PR
- edit PR body
- post GitHub comments
- change labels or milestones
- override validation failures
- convert bot review into approval

Human merge decision remains authoritative. Assistant / Codex reports, validation summaries, status events, snapshots, and companion UI displays are evidence, not approval.

## Relationship To Existing Docs / Issues

- #100 companion mascot: should map `Spec Cat` states to this schema only through a separate mascot / companion behavior design record. `Spec Cat` remains a mascot / companion character, not the main product name; see [spec-cat-companion-design.md](spec-cat-companion-design.md).
- #112 daemon / runtime evaluation: [status-runtime-evaluation.md](status-runtime-evaluation.md) consumes this schema as an input boundary and records the current no-go recommendation for runtime implementation.
- #132 brand architecture: defines `spec-injector` as the main product / CLI core and `Spec Cat` as mascot / future companion; see [brand-architecture.md](brand-architecture.md).
- #133 visual asset workflow: defines future visual / companion asset boundaries and overclaim prevention; see [visual-asset-workflow.md](visual-asset-workflow.md).
- [workflow.md](workflow.md): defines worktree-first issue / PR / evidence workflow that status events may summarize but cannot replace.
- [validation.md](validation.md): defines validation matrix and quality gates that status events may report but cannot weaken.
- [internal-workflow-contract.md](internal-workflow-contract.md): defines repo-local workflow guardrail vocabulary. This status schema is Layer 4 observability vocabulary, not a replacement for workflow guardrail contracts.

## Follow-up Issue Recommendations

Recommended follow-ups should remain opt-in, bounded, and separate from #111:

- `docs(status): define status file path and lifecycle`
  - Decide where a local status snapshot / event log would live, retention rules, redaction expectations, and cleanup policy.
- `feat(status): emit opt-in local status snapshot`
  - If approved later, add an explicit opt-in producer. Do not add hidden daemon behavior or default background writes.
- `design(companion): map Spec Cat states to status schema`
  - Define how mascot expressions, copy, and state transitions consume this schema without becoming CLI core.
- `design(runtime): evaluate Tauri/browser overlay feasibility`
  - Compare local web widget, Tauri, browser overlay, and no-runtime options after #100 and #111 boundaries are stable.
- `test(status): add schema fixture examples`
  - Add fixture-only examples if a future implementation needs stable parser / consumer tests.
- `docs(privacy): define local observability redaction checklist`
  - Expand privacy review for local paths, private issue content, command summaries, and target repo boundaries.

These follow-ups do not imply immediate implementation. Runtime, CLI output, background watcher, companion UI, and visual assets require their own approved scope.

## Non-goals

This proposal does not:

- implement a daemon
- implement companion UI
- implement a Tauri app
- implement a browser extension
- modify CLI core
- add CLI commands or flags
- add a background watcher
- add status JSON output
- add runtime code
- modify tests
- modify `package.json` or lockfile
- modify CI
- add dependencies
- use hidden LLM / API / local model
- implement autonomous agent behavior
- mutate target repo code
- add images, assets, or visual mockups
- implement #100 or #112
- implement #120 full showcase
- implement #149 remediation loop
- create or copy `.spec-injector/` into any target repo
