# Local Status File Lifecycle Design Record

## Purpose

This document is the #185 docs-only design record for a future local status file / event log lifecycle in `spec-injector`.

It defines lifecycle, boundaries, privacy constraints, stale-state handling, and future implementation prerequisites for possible local workflow observability artifacts.

It does not implement or authorize:

- CLI status emitter
- CLI status JSON output
- daemon
- watcher
- sidecar runtime
- companion UI
- Tauri app
- browser overlay
- hosted control plane
- agent orchestration
- remediation bot
- merge bot
- target repo automation

`spec-injector` remains a deterministic issue-to-context compiler for AI coding agents. This record only defines a future observability design prerequisite.

## Current Recommendation

Current recommendation: no-go for implementation now.

The project should define the lifecycle first, keep any future producer opt-in and local-only, and preserve strict separation from CLI core semantics.

Local status files, if ever implemented later, must be treated as observational evidence rather than decision authority:

- they may summarize workflow posture
- they may support local display or debugging
- they must not authorize merge, close, review resolution, or target repo mutation
- they must not replace fresh `git` / GitHub readback

This continues the direction in [status-runtime-evaluation.md](status-runtime-evaluation.md): status observability may be designed now, but runtime implementation remains out of scope until explicit prerequisites are met.

## Product Boundary

`spec-injector` remains the deterministic issue-to-context compiler.

A future local status file lifecycle may support workflow observability only:

- local orientation
- debugging
- fixture design
- future read-only companion display

It must not turn `spec-injector` into:

- a daemon
- a hidden controller
- a hosted control plane
- a review or merge authority
- a target repo automation system

Status files must remain non-authoritative:

- they must not mutate target repos
- they must not approve merge
- they must not close issues
- they must not resolve review threads
- they must not replace live git / GitHub state

`Spec Cat` may display sanitized status derived from accepted local artifacts, but it must remain a descriptive consumer rather than an actor.

## Data Model Decision

This design considers four options:

### Option A: Snapshot only

Benefits:

- simplest consumer path
- cheap to read
- useful for a future UI surface

Risks:

- weak audit trail
- limited debugging context
- hard to explain transitions or stale history

### Option B: Event log only

Benefits:

- strong audit and debugging value
- captures transition history
- easier fixture coverage for state changes

Risks:

- every consumer must replay history
- more complicated stale / rotation handling
- harder for lightweight display surfaces

### Option C: Snapshot plus event log

Benefits:

- snapshot supports latest-state display
- event log supports audit and debugging
- aligns with the vocabulary in [status-event-schema.md](status-event-schema.md)
- keeps UI and diagnostics concerns separate

Risks:

- more lifecycle surface area
- retention and stale policy must be explicit
- greater risk of accidental over-persistence if fields are not tightly bounded

### Option D: Neither until runtime is approved

Benefits:

- zero implementation risk now
- no new local data surface today

Risks:

- future emitter / consumer work has no accepted lifecycle target
- follow-up issues would re-open the same foundational questions

### Recommendation

Recommendation: design for both snapshot plus event log conceptually, but implement neither now.

If a future opt-in local producer is approved:

- snapshot should represent latest known workflow posture for lightweight readers
- event log should represent append-only-ish transition history for audit / debugging
- both must remain stale-aware and explicitly non-authoritative
- both must be local-only by default

## File Location Options

No location is approved for implementation in this PR. The options below are design candidates only.

### Option A: Repo-local `.spec-injector/status/`

Benefits:

- easy for tools to discover relative to the current repo
- straightforward manual inspection
- predictable location for fixtures and debugging

Risks:

- high risk of being mistaken as part of repo state
- high risk of accidental commit or target repo contamination
- easy to blur workflow observability with source-controlled project content

Target repo mutation risk: high.

Privacy implications:

- may expose workflow metadata inside a working repository
- may leak local paths or evidence references if copied or committed

Cleanup behavior:

- difficult to guarantee safe cleanup if users treat it as repo content
- higher chance of stale artifacts surviving across branches or clones

Recommended status: no-go unless a future issue explicitly approves repo-local writes and proves they cannot contaminate target repos.

### Option B: Worktree-local `.spec-injector/status/`

Benefits:

- better isolation than writing into an unrelated target repo
- tied to an explicit worktree lifecycle
- easier to remove when the worktree is retired

Risks:

- still lives inside a git working area
- can still be accidentally committed
- stale data may persist across branch reuse if cleanup is weak

Target repo mutation risk: medium to high.

Privacy implications:

- local path exposure remains sensitive
- evidence URLs and workflow summaries may remain on disk longer than intended

Cleanup behavior:

- can be cleaned with the worktree, but only if cleanup is explicit and reviewed

Recommended status: design candidate only; safer than target repo-local writes, but still not preferred until a stronger non-commit / non-mutation boundary is proven.

### Option C: User-level cache directory

Examples may include OS-specific cache paths or a future app-specific local cache root.

Benefits:

- separates observability artifacts from repo content
- lower accidental commit risk
- easier to treat as local-only operational data

Risks:

- discoverability is weaker without explicit tooling or metadata
- multiple repos / worktrees need stable namespacing
- cleanup rules must avoid deleting unrelated user data

Target repo mutation risk: low.

Privacy implications:

- still stores local workflow data on disk
- must treat repo names, issue references, and local paths as sensitive

Cleanup behavior:

- can support explicit retention windows or manual cleanup
- must not auto-delete aggressively without user visibility

Recommended status: strongest default design candidate for a future implementation.

### Option D: Temp directory

Benefits:

- cheap to create
- naturally ephemeral on some systems
- useful for experiments or test fixtures

Risks:

- poor durability for debugging
- OS cleanup rules are inconsistent
- consumers may lose state unexpectedly
- temp reuse can create ambiguity about ownership

Target repo mutation risk: low.

Privacy implications:

- temp storage is still local storage
- location may still reveal usernames or path structure

Cleanup behavior:

- may disappear unpredictably
- cannot be the sole source for debugging or manual inspection expectations

Recommended status: acceptable for future tests or prototypes, not the preferred default for human-facing lifecycle artifacts.

### Option E: Configurable future path

Benefits:

- can adapt to different environments
- can support privacy-sensitive local setups
- can separate worktree-specific and user-level storage policies

Risks:

- too much configurability too early can weaken determinism
- harder docs and support burden
- consumers must handle more path permutations

Target repo mutation risk: depends on chosen path; unacceptably high if pointed at a target repo.

Privacy implications:

- path configuration itself may reveal user environment details
- unsafe choices could persist sensitive data in inappropriate locations

Cleanup behavior:

- must require explicit ownership and clear inspection / deletion affordances

Recommended status: possible future extension only after a safe default path is accepted.

### Location Recommendation

If implementation is approved in a future issue, prefer a user-level local cache default with explicit namespacing for repo and worktree identity.

Writing `.spec-injector/status/` into a target repo or target worktree should be treated as high-risk and no-go unless a future issue explicitly approves that path, proves non-mutation expectations, and documents commit-avoidance safeguards.

## Suggested File Shapes

These are design candidates only. No files are created by this PR.

Possible future shapes:

- `current-status.json`
- `events.jsonl`
- `metadata.json`

Suggested roles:

- `current-status.json`: latest sanitized snapshot for lightweight readers
- `events.jsonl`: append-only-ish event history for debugging, audit, and fixture design
- `metadata.json`: local lifecycle metadata such as retention policy, producer identity, or rotation metadata if needed later

A separate human-readable README is not required by default. Human inspection should work directly against readable JSON / JSONL.

## Producer Boundary

Future producers may include:

- an explicit workflow step
- a future opt-in CLI emitter if separately approved
- a future test fixture or mock generator
- a future local sidecar only if separately approved after lifecycle acceptance

Future producers must not include:

- hidden background agent
- autonomous watcher by default
- target repo scanner
- GitHub polling loop by default
- companion UI writing authority
- any process that mutates target repos or review state through status artifacts

Producer requirements:

- production must be explicit and user-visible
- schema version must be written intentionally
- privacy filtering must occur before persistence
- failure to write status must not break core compilation behavior unless a future workflow explicitly depends on it

## Consumer Boundary

Future consumers may include:

- `Spec Cat` display surfaces
- local widgets
- documentation examples
- debugging and audit tools
- fixture readers

Future consumers must not treat status as:

- merge approval
- issue close authority
- review thread resolution authority
- target repo mutation instruction
- a source of truth replacing fresh git / GitHub state

Consumer requirements:

- treat missing status as absence, not success
- treat stale status as clearly degraded
- degrade safely on malformed or old schema data
- surface evidence URLs as references, not approval

## Lifecycle

The lifecycle below is for future design acceptance. It does not authorize implementation now.

### Create

Who may perform it:

- explicit workflow step
- future approved opt-in producer
- fixture generation in tests or docs examples

What must be validated:

- explicit local-only path ownership
- schema version present
- producer identity present
- timestamp present
- required privacy filtering applied

Failure behavior:

- creation failure should surface a warning or error to the producer caller
- missing status file after failed creation means no status, not a silent success claim

Privacy considerations:

- avoid secrets, raw command output, private issue body copies, and target repo snapshots
- local paths must be treated as sensitive fields

What must not happen:

- no target repo mutation
- no hidden fallback write into repo roots
- no automatic creation of `.spec-injector/` in target repos

### Update

Who may perform it:

- the same class of explicit approved producer that created the artifact

What must be validated:

- schema compatibility
- append or replace semantics are explicit
- stale policy metadata remains intact
- privacy filtering still applies to newly added fields

Failure behavior:

- failed updates should not corrupt previous readable state if avoidable
- consumers should treat partial writes as malformed and degrade safely

Privacy considerations:

- avoid adding new sensitive fields opportunistically
- avoid retaining raw failure output or unrelated local context

What must not happen:

- no automatic escalation into daemon-like retry loops
- no consumer-triggered self-healing rewrite unless separately approved

### Read

Who may perform it:

- human inspectors
- future read-only consumers
- docs and debugging tools

What must be validated:

- schema version support
- freshness metadata presence
- basic JSON / JSONL parseability

Failure behavior:

- read failure should degrade to `no status`, `warning`, or `needs human review`
- consumers must not fabricate certainty from unreadable files

Privacy considerations:

- consumers should minimize display of sensitive local paths
- displayed summaries should stay sanitized

What must not happen:

- no interpretation of stale or missing data as live authority
- no automatic sharing or upload of local artifacts

### Stale

Who may perform it:

- any consumer may classify a file as stale based on explicit accepted policy
- a future approved producer may annotate a stale condition

What must be validated:

- snapshot timestamp
- producer identity
- source metadata
- schema version
- explicit stale threshold definition

Failure behavior:

- stale files remain readable but must be visually or textually marked stale
- stale status cannot drive merge, close, or review decisions

Privacy considerations:

- stale artifacts may linger on disk; retention policy must treat them carefully

What must not happen:

- no implicit refresh by hidden background behavior
- no silent promotion of stale data into current status

### Rotate / Archive

Who may perform it:

- explicit maintenance step
- future approved producer if rotation is part of an accepted lifecycle

What must be validated:

- retention policy
- maximum size or age threshold
- archive destination remains local-only
- archived artifacts remain inspectable if retained

Failure behavior:

- rotation failure should not destroy the only readable copy unexpectedly
- consumers may continue with the latest valid snapshot and warn about rotation failure

Privacy considerations:

- archives multiply retained data and therefore increase exposure risk
- archived content must remain sanitized and bounded

What must not happen:

- no unbounded event log growth
- no opaque archive format by default
- no silent migration to remote storage

### Delete

Who may perform it:

- explicit user action
- explicit cleanup step for an accepted lifecycle
- fixture teardown in tests

What must be validated:

- artifact ownership is clear
- user can inspect before deletion when feasible
- deletion scope does not escape the approved local status path

Failure behavior:

- failed deletion should report the leftover artifact clearly
- leftover files mean cleanup is incomplete, not successful

Privacy considerations:

- deletion policy should prioritize sensitive stale artifacts
- cleanup logs must not reveal more private detail than the artifacts themselves

What must not happen:

- no destructive recursive cleanup outside the approved status path
- no automatic deletion as a side effect of merely reading status

## Stale Status Policy

Status snapshots and event logs can become stale.

Every future snapshot should include at least:

- `timestamp`
- `producer`
- `source`
- `schemaVersion`

Recommended stale rules:

- stale threshold must be explicitly accepted before implementation
- consumers must display stale status clearly
- stale data must never drive merge, close, or review decisions
- any human decision about merge readiness, issue closeout, or review resolution must re-read live git / GitHub state

The exact stale threshold is intentionally not fixed in this PR. It should be accepted together with file location and producer UX, because durability expectations differ across cache, temp, and worktree-local options.

## Retention And Cleanup

Retention must be conservative and explicit.

Requirements:

- event logs must not grow unbounded
- retention policy should be configurable later or use a conservative default
- cleanup should be explicit, inspectable, and non-destructive by default
- users should be able to inspect artifacts before deleting them
- secrets and raw outputs must never be retained

Recommended future direction:

- keep snapshots small and replaceable
- rotate event logs by size, age, or explicit workflow boundary only after policy approval
- archive only when there is clear debugging value
- prefer deletion of stale artifacts over indefinite retention

## Privacy / Local-only Constraints

Future local status artifacts must follow strict data minimization.

Do not persist by default:

- secrets
- raw command output
- private issue body copies
- target repo source snapshots
- full target repo file lists
- unrelated local environment details

Treat as sensitive:

- local paths
- worktree paths
- repo location hints
- evidence URLs that may reveal private workflow state

Allowed with care:

- sanitized summaries
- issue and PR references
- evidence URLs as pointers
- validation result summaries without raw logs

Evidence URLs are references only. They do not imply approval or authority.

## Local Path Sensitivity

Local paths should be treated as privacy-sensitive local metadata.

Requirements:

- do not assume paths are safe to display verbatim in all consumers
- prefer redacted or minimized path presentation in UI layers
- never treat path persistence as harmless just because storage is local

A future implementation should explicitly decide whether full paths, basename-only paths, or redacted path tokens are sufficient for each file shape.

## Evidence URL Handling

Evidence URLs may be stored only as references to human-readable evidence.

Requirements:

- treat evidence URLs as pointers, not approval state
- do not infer merge safety from URL presence
- do not persist unrelated comment bodies by default just because a URL exists
- consumers should label evidence links as external references requiring live readback when decisions matter

## Failure Behavior

Future local status lifecycle behavior must fail conservatively.

Principles:

- missing status file means no status, not an error by itself
- malformed status means warning or needs human review
- old schema version means warning and migration or compatibility handling before consumption
- consumers must degrade safely
- no automatic rewrite, migration, or repair unless a future tool explicitly approves it

A failure in status artifact handling must not silently claim that the workflow is healthy, complete, or approved.

## Malformed / Missing / Old Schema Behavior

### Missing file

Interpretation:

- no status available
- not an implementation failure by default

Consumer behavior:

- show absence clearly
- do not show green / success fallback

### Malformed data

Interpretation:

- warning or needs human review

Consumer behavior:

- stop trusting the artifact
- surface parse or validation failure succinctly
- do not auto-rewrite unless explicitly approved in a future issue

### Old `schemaVersion`

Interpretation:

- warning
- migration or compatibility step required before trusted consumption

Consumer behavior:

- degrade safely
- identify version mismatch
- do not silently coerce into current semantics

## Manual Inspection And Debugging

Status artifacts should be inspectable by humans.

Expectations:

- prefer JSON / JSONL
- avoid opaque binary formats
- keep example payloads readable
- keep examples sanitized
- make state transitions understandable without replaying private raw logs

Manual inspection is a core design goal because the lifecycle is meant to support debugging and observability, not hidden runtime complexity.

## Relationship To Existing Docs / Issues

This record depends on and complements:

- #111 and [status-event-schema.md](status-event-schema.md): defines the future event / snapshot vocabulary this lifecycle would carry
- #112 and [status-runtime-evaluation.md](status-runtime-evaluation.md): records the current no-go recommendation and requires lifecycle acceptance before any emitter or runtime work
- #100 and [spec-cat-companion-design.md](spec-cat-companion-design.md): constrains `Spec Cat` to read-only descriptive consumption of sanitized status
- [workflow.md](workflow.md): keeps source issue, dedicated worktree, validation, evidence, and human review authoritative
- [validation.md](validation.md): keeps command output and readback evidence as the real merge-readiness checks

This document does not reopen runtime approval, companion UI implementation, or product positioning.

## Future Implementation Prerequisites

Any future emitter or reader proposal should require all of the following first:

- accepted lifecycle design
- accepted file path decision
- privacy review
- accepted stale policy
- accepted retention policy
- accepted opt-in UX
- proof that target repos are not mutated
- test fixtures before real writes
- explicit human approval for any emitter

Additional guardrails:

- separate future issue for any producer implementation
- separate future issue for any sidecar or UI consumer implementation
- explicit schema compatibility plan
- explicit cleanup ownership model

## Follow-up Issue Recommendations

Keep follow-ups small and gated:

- `test(status): add fixtures for status lifecycle examples`
- `docs(status): define status file path decision`
- `feat(status): add opt-in local snapshot emitter, if approved later`
- `design(companion): consume snapshot in Spec Cat mockup, if approved later`

## Non-goals

This document does not:

- add a CLI emitter
- add a CLI command or flag
- add runtime code
- add status JSON output
- add a daemon, watcher, or sidecar implementation
- add a Tauri app or browser overlay
- add companion UI
- create any status files
- create `.spec-injector/status/`
- modify tests, CI, package scripts, or dependencies
- modify target repos
- implement #120 full showcase
- implement #149 supervised remediation loop
