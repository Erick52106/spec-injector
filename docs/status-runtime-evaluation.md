# Status Runtime Evaluation

## Purpose

This document is the #112 go / no-go evaluation for a possible future daemon / status runtime layer.

It evaluates whether `spec-injector` should ever add local workflow status production, a status file lifecycle, a sidecar reader, or presentation surfaces for companion UX. It does not implement or authorize:

- daemon
- companion UI
- CLI status output
- background watcher
- status emitter
- Tauri app
- browser overlay
- browser extension
- hosted control plane
- agent orchestration
- target repo automation

`spec-injector` remains a deterministic issue-to-context compiler for AI coding agents. This document is a future design decision record, not a runtime implementation plan.

## Current Recommendation

Recommendation: no-go for implementation now.

Continue design-only until the status schema, privacy model, resource budget, local file lifecycle, and workflow ownership boundaries are proven. Re-evaluate only after the prerequisites in this document are explicitly met by separate, small issues.

The conservative path is:

1. Keep the CLI core focused on deterministic context compilation.
2. Treat status events as future observability vocabulary, not current output.
3. Define local-only lifecycle and stale-state policy before adding producers or readers.
4. Prototype readers without daemon behavior before considering a persistent process.
5. Keep `Spec Cat` as a presentation consumer, never as an automation controller.

## Product Boundary

`spec-injector` remains the main product, package identity, CLI core, and deterministic issue-to-context compiler.

A future runtime layer must be:

- optional
- local-first
- explicitly enabled
- separate from CLI core semantics
- bounded in resource usage
- privacy-safe by default
- read-only toward target repos and GitHub unless a separate human-approved workflow explicitly performs a normal GitHub action

`Spec Cat` may consume workflow status as a friendly narrator, checkpoint reminder, or evidence explainer. It must not produce authoritative decisions, mutate state, or become a hidden controller.

The runtime layer must not become:

- hosted control plane
- autonomous agent orchestrator
- merge bot
- issue closer
- review resolver
- remediation bot
- hidden planner
- semantic RAG service
- product rename path

## Problems A Runtime Layer Could Solve

A narrowly scoped, local status layer could help with:

- showing workflow state without requiring humans to reread long chat logs
- keeping humans aware of dirty worktree, blocked validation, stale evidence, or review-needed states
- supporting a future `Spec Cat` presentation layer with explicit status artifacts
- exposing a local status snapshot for widgets, overlays, or static visual prototypes
- reducing context switching during AI-assisted issue / PR workflows
- making validation and evidence freshness easier to inspect
- separating display state from private model reasoning or chat transcript shape

These benefits are about observability and human orientation. They are not arguments for autonomous action.

## Problems It Must Not Solve

A runtime layer must not try to solve:

- auto-fix
- auto-merge
- issue closeout
- review thread resolution
- target repo modification
- hidden planning
- background agent work
- human decision replacement
- GitHub approval authority
- broad repo monitoring
- private code indexing
- hosted workflow coordination

If a proposed runtime feature requires authority over merge, closeout, review resolution, test remediation, or target repo mutation, it is outside this product boundary.

## Architecture Options

### A. No Runtime, Docs-only Status Reports

Description: keep status reporting in human-readable docs, final reports, issue comments, and PR bodies. No status files, daemon, watcher, or sidecar process exists.

Benefits:

- preserves the current CLI boundary
- no new resource usage
- no new privacy surface
- no stale local state problem beyond normal written evidence
- simplest to audit

Risks:

- humans still need to read chat logs, issue comments, or PR bodies
- future companion prototypes cannot consume structured local status
- status visualization remains manual

Resource cost: none beyond existing workflow documentation.

Privacy implications: no new local or external data store.

Implementation complexity: none.

Recommended status now: adopted as the current baseline.

### B. Local Status File / Event Log Written By Explicit Workflow Steps

Description: explicit workflow steps write a local status event log or current snapshot file. There is no watcher or persistent process.

Benefits:

- creates a structured artifact for future readers
- keeps production explicit and auditable
- avoids always-on runtime behavior
- can test stale-state, privacy, and lifecycle rules cheaply
- aligns with the #111 status event schema

Risks:

- stale files may mislead humans if freshness is unclear
- local paths and evidence URLs may leak sensitive workflow context
- file lifecycle can become confusing across worktrees
- producers may accidentally be treated as authoritative

Resource cost: low; bounded disk writes at explicit workflow checkpoints.

Privacy implications: local-only by default, but fields must be redacted and local paths treated as sensitive.

Implementation complexity: low to medium, mostly lifecycle and schema validation.

Recommended status now: design next, but do not implement until lifecycle, stale-state, and privacy rules are accepted.

### C. Opt-in CLI Status Emitter

Description: the CLI can emit status events or snapshots only when the human explicitly enables a flag, command, or config option.

Benefits:

- keeps status production close to known workflow steps
- can reuse CLI validation, source issue, and context assembly knowledge
- supports deterministic fixtures if output shape is accepted
- easier to test than a daemon

Risks:

- may pollute CLI core if companion semantics leak into core commands
- may imply status JSON is a stable product contract before lifecycle is proven
- can blur compiled context output with runtime observability output
- opt-in UX and failure behavior need careful design

Resource cost: low when invoked explicitly; no idle cost.

Privacy implications: depends on emitted fields; must avoid secrets, raw private issue bodies, and target repo content snapshots.

Implementation complexity: medium.

Recommended status now: no-go for implementation; revisit after option B has a proven lifecycle and #111 schema stability.

### D. Local Sidecar Process Reading Status File

Description: a local sidecar process reads an accepted local status file or event log and exposes it to a presentation layer. It does not scan repos, poll GitHub, or run workflow commands.

Benefits:

- separates CLI core from presentation concerns
- can support widgets without changing compiler behavior
- can remain read-only if strictly limited to accepted status artifacts
- makes future companion UX easier to test

Risks:

- persistent process behavior creates lifecycle, failure, and trust issues
- stale or missing status can be mistaken for live state
- local IPC / port choices add security review requirements
- users may perceive it as a daemon even if read-only

Resource cost: low to medium; must define idle CPU, memory, disk, IPC, and startup boundaries before implementation.

Privacy implications: local-only, but a sidecar increases the need for access control, data minimization, and clear shutdown behavior.

Implementation complexity: medium to high.

Recommended status now: no-go; consider only after local status file lifecycle is proven and a non-daemon reader prototype demonstrates value.

### E. Tauri Always-on-top Widget

Description: a local desktop widget displays status snapshots, `Spec Cat` state, warnings, and review-needed reminders.

Benefits:

- provides a visible companion surface without changing CLI core
- can make workflow posture easy to see during long tasks
- supports future visual / mascot direction

Risks:

- high chance of overclaiming current capability
- may imply a current companion runtime exists
- desktop packaging and permission model add maintenance cost
- always-on-top UI can become distracting or misleading
- requires a robust stale-state policy before it can be trusted

Resource cost: medium to high; needs explicit idle CPU, memory, startup, and shutdown budgets.

Privacy implications: visible local UI may expose repo names, issue titles, paths, evidence URLs, or private workflow summaries on screen.

Implementation complexity: high.

Recommended status now: no-go; keep as future design exploration only.

### F. Browser Overlay / Extension-like Viewer

Description: a local browser surface, extension-like viewer, or overlay reads approved status snapshots and displays workflow state near issue / PR review surfaces.

Benefits:

- can place status near GitHub review context
- may avoid desktop packaging complexity
- supports visual experiments and local prototypes

Risks:

- browser extension permissions are easy to over-scope
- GitHub page context can blur display with authority
- private issue / PR content exposure risk is higher
- cross-browser maintenance is expensive
- may be mistaken for GitHub automation or review approval tooling

Resource cost: medium; depends on polling, page injection, extension permissions, and browser lifecycle.

Privacy implications: high sensitivity because browser surfaces may contain private repo content and authenticated GitHub state.

Implementation complexity: high.

Recommended status now: no-go; do not implement until local status artifacts, privacy review, and human authority boundaries are proven elsewhere.

## Go Criteria

Future implementation may be reconsidered only if all of these are true:

- #111 status event schema is accepted, stable, and versioned.
- Local status file lifecycle is defined, including path, producer, retention, cleanup, and multi-worktree behavior.
- There is proof that status production and display cannot mutate target repos.
- Privacy review is completed for every proposed stored and displayed field.
- Resource budget is defined before implementation.
- Explicit opt-in UX is documented.
- Human authority boundaries are documented for review, merge, issue closeout, and validation decisions.
- Failure and stale status policy is defined.
- Validation and evidence freshness rules are defined.
- Implementation is split into small issues with one responsibility each.
- CLI core pollution checks are part of review.
- Current-vs-future capability language is clear in docs and PR bodies.
- A docs-only or file-reader prototype demonstrates real value before any daemon or always-on UI is considered.

## No-go Criteria

Runtime implementation must not proceed if it:

- requires persistent GitHub polling
- requires background file scanning of the target repo
- requires storing secrets
- requires sending private repo content externally
- implies merge approval authority
- implies issue close authority
- implies review thread resolution authority
- requires modifying the target repo
- couples companion layer semantics to CLI core behavior
- cannot distinguish stale status from live state
- cannot bound resource usage
- cannot be disabled by the human
- hides local paths, repo identity, or evidence provenance from the human
- depends on private chat transcripts as source of truth
- introduces hosted control plane positioning
- creates a background agent loop

Any one of these conditions is enough to stop implementation and return to design.

## Privacy / Local-only Model

The default model must be local-only:

- no cloud service
- no external telemetry
- no secret capture
- no target repo content snapshots
- no raw command output retention by default
- no private issue body copying unless explicitly allowed
- no external upload of local paths, repo names, worktree paths, or evidence summaries

Future artifacts should prefer:

- sanitized evidence URLs
- concise validation summaries
- issue / PR numbers over full private text
- redacted local paths where display does not require full paths
- field-level privacy notes in schema examples
- explicit user control over retention and deletion

Local paths are sensitive. Private issue bodies, review comments, and repo contents are sensitive. Status artifacts should orient the human without becoming a second copy of private project data.

## Resource Budget

No implementation should start until it defines budget categories for:

- idle CPU
- memory
- disk writes
- polling frequency
- GitHub API usage
- startup time
- shutdown behavior
- stale file cleanup
- error handling
- log retention
- battery impact on laptops

This document does not set hard numeric limits. The requirement is that any future implementation issue must define measurable bounds before code is written.

If resource usage cannot be bounded and explained, the runtime is no-go.

## Status Freshness / Stale State Policy

Events and snapshots can become stale.

Any future status artifact must include:

- timestamp
- producer identity
- source workflow step
- schema version
- current state
- freshness / stale threshold policy
- enough provenance for a human to re-read live state

Any UI or companion surface must display stale warnings when the latest status is old, incomplete, or produced by a different worktree / branch than the current workflow.

Stale status cannot drive decisions. Merge, closeout, review resolution, validation success, and evidence freshness must re-read live GitHub and repo state before action. A status snapshot may point to evidence; it is not evidence by itself.

## Relationship To Existing Docs / Issues

- #111 status event schema: [status-event-schema.md](status-event-schema.md) defines future workflow observability vocabulary. This evaluation depends on that vocabulary but does not implement a producer or runtime.
- #100 Spec Cat companion design: [spec-cat-companion-design.md](spec-cat-companion-design.md) defines `Spec Cat` as a non-authoritative presentation layer. This evaluation keeps `Spec Cat` as a consumer of status, not an automation controller.
- #132 brand architecture: [brand-architecture.md](brand-architecture.md) keeps `spec-injector` as the main product / CLI core and `Spec Cat` as a mascot / optional future companion layer. Runtime work must not redefine the product.
- #133 visual asset workflow: [visual-asset-workflow.md](visual-asset-workflow.md) requires future visual and companion work to avoid overclaiming implemented capability. Runtime mockups must be labeled future / prototype unless implemented later.
- [workflow.md](workflow.md) remains the source for issue / PR / worktree workflow discipline. A runtime cannot replace source issue, validation, evidence, PR body, or human review steps.
- [validation.md](validation.md) remains the source for validation quality gates. Status display can summarize validation, but command output and readback evidence remain authoritative.

## Recommended Follow-up Issues

Keep follow-up issues small, gated, and docs-first:

- `docs(status): define local status file lifecycle`
- `design(runtime): prototype local status file reader, no daemon`
- `design(companion): define stale status display rules for Spec Cat`
- `docs(privacy): review status fields and local-only retention policy`
- `design(runtime): define resource budget for status readers`
- `test(status): add schema fixture validation only after lifecycle approval`

Do not open implementation issues for a daemon, Tauri widget, browser overlay, extension, or CLI status emitter until the lifecycle, privacy, stale-state, and resource prerequisites are accepted.

## Decision Summary

Current decision: no-go for runtime implementation.

Recommended near-term path: document and validate the local status artifact lifecycle before building any producer, reader, sidecar, daemon, desktop widget, or browser surface.

The strongest future candidate is a local status file / event log written by explicit workflow steps, followed by a read-only local file reader prototype. Persistent daemons, Tauri widgets, and browser overlays remain future no-go until the project proves that local-only status artifacts are useful, safe, fresh, and separate from CLI core.
