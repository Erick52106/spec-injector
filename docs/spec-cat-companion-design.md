# Spec Cat Companion Design Record

## Purpose

This document is the product design record for `Spec Cat` as a mascot and future companion state layer for `spec-injector`.

It defines role, state vocabulary, message tone, visual direction, interaction boundaries, privacy rules, and future implementation prerequisites for possible companion UI prototypes or visual asset work.

It does not implement:

- companion UI
- daemon / runtime
- CLI status output
- background watcher
- status JSON emitter
- Tauri app
- browser extension
- visual assets, mockups, images, or final mascot artwork

`spec-injector` remains the deterministic issue-to-context compiler for AI coding agents. This record only describes how a future presentation layer may explain workflow posture to a human.

## Product Boundary

`spec-injector` remains the main product name, package identity, CLI core, and product category.

`Spec Cat` is a mascot / companion / future workflow observability character. It may appear in docs, future UI prototypes, visual direction boards, or status visualization work, but it must not become the main product name or redefine the CLI core.

Spec Cat must not imply:

- hosted control plane
- agent orchestration
- merge bot
- remediation runtime
- target repo automation
- hidden LLM / semantic RAG
- companion daemon as a current capability
- product rename from `spec-injector`

The companion layer, if ever implemented, should consume explicit workflow status artifacts. It should not become a source of product semantics, authority, or side effects.

## Role Definition

Spec Cat may act as:

- a friendly status narrator
- a workflow checkpoint reminder
- a validation / evidence explainer
- a visual companion for docs and future UI prototypes
- a non-authoritative observer of workflow posture

Spec Cat must not act as:

- a merge approver
- an issue closer
- a review resolver
- a target repo editor
- a hidden planner
- an autonomous agent
- a remediation bot
- a source of truth

Spec Cat can say what appears to be happening and what evidence exists. It cannot decide that work is safe, complete, mergeable, or approved.

## Mapping To #111 Status States

Spec Cat states should map directly to the coarse workflow states proposed in [status-event-schema.md](status-event-schema.md). The mapping is descriptive and user-facing; it is not a runtime contract until a future implementation issue explicitly accepts a producer / consumer lifecycle.

| State | Visual mood | Companion behavior | User-facing message tone | Example message | What user may do next | What Spec Cat must not do |
| --- | --- | --- | --- | --- | --- | --- |
| `idle` | Calm, low-motion, neutral color. | Waits quietly and avoids attention-seeking animation. | Quiet, available, non-urgent. | "No active scoped workflow is being displayed." | Select a source issue, open a plan, or leave the workflow idle. | Start work, infer a task, poll private state, or suggest unapproved scope. |
| `planning` | Focused, reading / organizing posture. | Points to scope, constraints, and source documents. | Careful, bounded, evidence-aware. | "Reading issue scope and repo boundaries before any edit." | Review scope, non-goals, allowed files, and stop conditions. | Approve a plan, expand scope, or treat labels as implementation authorization. |
| `working` | Steady, concentrated, moderate motion. | Shows the current documented step without implying autonomy. | Brief, factual, progress-oriented. | "A docs-only update is in progress in the dedicated worktree." | Wait for the next checkpoint or inspect the current diff. | Modify files itself, execute commands, or hide intermediate state. |
| `testing` | Instrumented, checklist-like, verification posture. | Highlights validation commands and current result state. | Precise, command-aware, unemotional. | "`pnpm test` is running; results are not known yet." | Wait for command results or inspect failure output if validation stops. | Claim success before command output, retry tests automatically, or suppress failures. |
| `review-needed` | Attentive, visibly asking for human attention. | Surfaces PR / evidence URLs and the next human decision. | Polite, clear, authority-preserving. | "Evidence is ready; human review and merge decisions are still required." | Review the PR, inspect evidence, classify findings, or decide whether to merge later. | Approve merge, resolve review threads, dismiss findings, or close issues. |
| `success` | Bright, brief confirmation, no excessive celebration. | Summarizes verified evidence and completed requested scope. | Confirming, calm, specific. | "Requested validation and evidence readback are complete." | Review the PR, merge only with explicit human authorization, or open follow-ups. | Treat success as merge approval, close the source issue, or mutate GitHub state. |
| `warning` | Warm caution color, noticeable but not alarming. | Explains the recoverable stop reason and the safest next human choice. | Cautious, transparent, non-blaming. | "Stopped because the worktree is dirty; no cleanup was attempted." | Decide whether to preserve, commit, clean, or switch worktrees. | Stash, clean, reset, checkout over changes, or continue through an unsafe state. |
| `error` | Clear stop posture, high-contrast error signal. | Shows the blocking failure and what evidence is missing. | Direct, actionable, non-dramatic. | "Cannot post issue evidence because GitHub authentication failed." | Fix authentication / permissions, rerun the failed step, or stop the workflow. | Guess around the failure, fabricate evidence, or continue as if the write succeeded. |

## Message Tone Guidelines

Spec Cat copy should be concise, warm, precise, and evidence-aware.

Use:

- short status messages
- concrete nouns such as issue, PR, branch, worktree, validation, evidence, and review
- explicit observation language, for example "I see", "The latest readback shows", or "The workflow stopped because"
- clear separation between observation and recommendation
- calm reminders that human authority controls review, merge, and issue closeout

Avoid:

- fake authority
- hidden decision-making
- overpromising
- hype language
- childish or overly cute wording
- implying private reasoning or secret context
- saying work is complete before fresh verification
- saying evidence URLs are approval

Spec Cat may recommend a human next action only when the recommendation is grounded in explicit workflow state. It should say "review the evidence" rather than "merge this".

## Visual Direction

Spec Cat visual direction should consume the boundaries in [visual-asset-workflow.md](visual-asset-workflow.md).

The surrounding product language should remain compiler-like and source-trusted:

- issue / request input
- trust-labeled context assembly
- bounded task package output
- validation and implementation evidence
- explicit warnings and stop reasons
- current vs future capability separation

Spec Cat can make the companion layer warmer, but the product docs remain professional. The mascot should be restrained: a small companion, status narrator, or visual anchor, not the dominant product identity.

Avoid:

- cartoon-first CLI positioning
- cyberpunk control-room overclaim
- dashboard-first visuals that imply hosted control plane
- agent loop imagery that implies autonomous orchestration
- automatic remediation / merge imagery
- target repo mutation imagery
- hidden LLM or magic black-box metaphors

Future visual assets must distinguish current capabilities from future prototypes. A Spec Cat mockup should be labeled as future / prototype unless the corresponding runtime and status lifecycle have been explicitly approved and implemented.

## Interaction Boundaries

A future companion may:

- show latest workflow status
- surface evidence URLs
- summarize validation state
- show next human action
- explain why the workflow stopped
- distinguish blocking errors from recoverable warnings
- display status derived from accepted local-only / opt-in workflow artifacts

It must not:

- execute git commands
- run tests
- modify GitHub
- resolve review threads
- approve merge
- close issues
- mutate target repo files
- edit generated task packages
- escalate scope
- poll private systems without explicit opt-in

Interaction should be read-only presentation by default. Any future action button, if ever considered, requires a separate design issue, explicit safety analysis, and human approval boundary.

## Display Vs Decision Boundary

Spec Cat may display:

- latest known state
- current source issue / PR / branch references
- validation command names and summarized results
- evidence URLs
- dirty worktree stop reasons
- review-needed reminders
- next human action hints
- sanitized error or warning summaries

Spec Cat must not decide:

- whether validation evidence is sufficient for merge
- whether a PR should be approved
- whether a review finding should be dismissed
- whether an issue should be closed
- whether a branch or worktree should be deleted
- whether target repo files should be changed
- whether unapproved scope is acceptable
- whether a future runtime should exist

Live git state, GitHub readback, validation output, review findings, source issue scope, and explicit human authorization remain authoritative.

## Privacy And Safety

Future Spec Cat status surfaces should follow conservative privacy defaults:

- do not display secrets
- do not store or display target repo content snapshots by default
- do not show private issue bodies unless explicitly allowed
- treat local paths as sensitive
- sanitize command output and error summaries
- prefer short validation summaries over raw logs
- show evidence URLs as references, not approval
- keep local-only status data local unless an explicit sharing mechanism is approved

Status messages should be enough to orient a human without leaking private repo content, credentials, tokens, file contents, or unrelated local paths.

## Relationship To Existing Docs / Issues

- #111 status event schema: Spec Cat should map to the `idle`, `planning`, `working`, `testing`, `review-needed`, `success`, `warning`, and `error` vocabulary in [status-event-schema.md](status-event-schema.md). That schema remains future-facing observability vocabulary, not current CLI output.
- #112 daemon / runtime evaluation: Any daemon, watcher, overlay, Tauri app, browser extension, local status file lifecycle, or runtime producer must wait for an explicit #112 go / no-go decision. This record does not implement or authorize #112.
- #132 brand architecture: [brand-architecture.md](brand-architecture.md) defines `spec-injector` as the main product / CLI core and `Spec Cat` as mascot / future companion. This record consumes that boundary.
- #133 visual asset workflow: [visual-asset-workflow.md](visual-asset-workflow.md) defines future visual asset workflow, storage, tool fit, and overclaim prevention. This record supplies mascot state and tone input for later visual work, but generates no assets.
- [workflow.md](workflow.md): Companion state should reinforce the existing source issue, worktree, validation, evidence, PR body, and human review flow rather than replacing it.
- [validation.md](validation.md): Companion messages may summarize validation state, but validation remains command output and readback evidence, not mascot assertion.

## Implementation Prerequisites

Before any future implementation, the project needs:

- accepted status event schema
- local-only / opt-in status file lifecycle
- privacy review for displayed fields, retained fields, and evidence URLs
- proof that the companion cannot mutate target repos
- human authority / merge decision safeguards
- resource budget and performance boundary
- UI prototype separated from CLI core
- explicit #112 go / no-go for daemon / runtime direction
- clear current-vs-future labeling for any docs or visual prototype
- review plan for GitHub permissions, local paths, and private issue content

No implementation should begin from this record alone. It is a design input for future bounded issues.

## Follow-up Issue Recommendations

Reasonable follow-ups after this record is accepted:

- `design(companion): map Spec Cat visual states to status schema`
- `docs(status): define local status file lifecycle`
- `design(runtime): evaluate opt-in Tauri/browser overlay feasibility`
- `design(assets): create Spec Cat visual direction board`
- `docs(readme): add future companion roadmap note after boundaries mature`

These follow-ups should remain design-first, opt-in, and bounded. They should not imply immediate daemon, runtime, CLI status output, visual asset generation, target repo automation, or README showcase work.

## Non-goals

This record does not:

- implement companion UI
- implement a daemon
- implement a Tauri app
- implement a browser extension
- modify CLI core
- add a CLI command or flag
- add a background watcher
- add status JSON output
- add runtime code
- change tests
- change package scripts or dependencies
- change CI
- use hidden LLM / API / local model behavior
- implement autonomous agent behavior
- modify target repo code
- add images, assets, or visual mockups
- rename the repo, package, or CLI
- make `Spec Cat` the main product name
- implement #112
- implement #120
- implement #149
