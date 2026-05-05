# README Showcase Readiness Checklist

## Purpose

This document is the readiness checklist for #120 full README showcase work.

It exists to decide whether #120 is safe to start, how it should be split, and which claims or visuals are safe to present as current versus future.

This document does not:

- implement #120
- modify `README.md` or `README.en.md`
- generate diagrams or visual assets
- approve runtime, companion, or automation implementation

## Current recommendation

Current recommendation:

- Do not start the full README showcase until this checklist is satisfied.
- Prefer splitting #120 into multiple small PRs instead of one large showcase PR.
- A minimal issue-to-context pipeline diagram may come before any full showcase rewrite.
- Keep the full product showcase postponed until current-versus-future boundaries are reviewed in both README languages.

Rationale:

- The repo now has stronger narrative and boundary docs than before, but many visually attractive directions still point at future or design-only layers.
- The biggest current risk is overclaiming runtime, companion, status, or remediation capabilities that are not implemented.
- A minimal, source-tracked diagram or docs map is easier to audit than a combined hero, copy, roadmap, and mascot pass.

## Current implemented capabilities

The items below are safe to describe as current only when the wording stays narrow and implementation-facing.

### 1. Deterministic GitHub issue-to-context compilation

- Safe phrasing: `spec-injector` currently compiles a GitHub issue and repo-defined context into a bounded task package or planning prompt.
- Evidence: `README.md`, `README.en.md`, [product-moat.md](product-moat.md), [workflow.md](workflow.md)
- Do not imply: generic fuzzy request support, markdown brief ingestion, hidden planner behavior, or hosted orchestration

### 2. Bounded task package / prompt generation

- Safe phrasing: the current CLI emits bounded Markdown task packages and compact planning prompts for AI coding agents.
- Evidence: `README.md`, `README.en.md`, [workflow.md](workflow.md), [validation.md](validation.md)
- Do not imply: autonomous execution plans, automatic implementation, or approval to edit beyond issue scope

### 3. Source references and diagnostics

- Safe phrasing: output can surface source references, missing paths, unreadable paths, and other context diagnostics.
- Evidence: `README.md`, [source-trust.md](source-trust.md)
- Do not imply: semantic understanding, complete repo comprehension, or human-approved source selection

### 4. Source trust / context budget direction

- Safe phrasing: the project already documents source-trust and context-budget vocabulary that guides how context should be prioritized and bounded.
- Evidence: [source-trust.md](source-trust.md), `README.md`, `README.en.md`
- Do not imply: all future trust/budget policies are fully implemented end to end in a stable protocol layer

### 5. Validation / evidence workflow

- Safe phrasing: the repo defines a validation and implementation-evidence workflow around build/test checks, PR body backfill, and issue evidence comments.
- Evidence: [workflow.md](workflow.md), [validation.md](validation.md), `README.md`, `README.en.md`
- Do not imply: validation auto-fix, automated closeout, or merge authority

### 6. Readback verification workflow

- Safe phrasing: workflow rules require readback verification for PR body and issue evidence writes.
- Evidence: [workflow.md](workflow.md), [validation.md](validation.md)
- Do not imply: a general-purpose GitHub automation bot or review-resolution runtime

### 7. Read-only label / milestone audit checker

- Safe phrasing: the project includes read-only workflow guardrails for label / milestone / evidence audit scenarios.
- Evidence: `README.md`, [workflow.md](workflow.md), [validation.md](validation.md)
- Do not imply: metadata auto-remediation, auto-labeling, or roadmap dashboard ownership

### 8. Optional live `gh` smoke test

- Safe phrasing: the repo keeps an opt-in live `gh` smoke path to validate the minimal GitHub issue read chain.
- Evidence: `README.md`, `README.en.md`
- Do not imply: network-dependent default tests, hosted runtime behavior, or always-on GitHub syncing

### 9. Docs-only design records for brand / visual / status / companion direction

- Safe phrasing: the repo documents future-facing design records for brand architecture, visual workflow, status vocabulary, companion posture, and local status lifecycle.
- Evidence: [brand-architecture.md](brand-architecture.md), [visual-asset-workflow.md](visual-asset-workflow.md), [status-event-schema.md](status-event-schema.md), [spec-cat-companion-design.md](spec-cat-companion-design.md), [status-runtime-evaluation.md](status-runtime-evaluation.md), [local-status-file-lifecycle.md](local-status-file-lifecycle.md)
- Do not imply: these future layers are implemented, approved for immediate build, or safe to market as current product behavior

## Future / design-only capabilities

The items below must remain future, planned, or design-only in any README showcase work:

- fuzzy request / markdown brief adapters
- semantic RAG / vector search
- hidden LLM planning
- hosted control plane
- agent orchestration platform
- remediation loop
- merge bot
- automatic review thread resolution
- companion runtime
- daemon / sidecar / watcher
- Tauri app / browser overlay
- Spec Cat UI
- status JSON emitter
- local status file writes
- target repo mutation
- GitHub Projects / roadmap dashboard

Rules for README wording:

- If the capability is not implemented today, label it as `future`, `planned`, `design-only`, `possible`, or `if later approved`.
- If the capability has an explicit no-go or wait state, preserve that posture instead of weakening it into soft hype.
- If a capability needs human approval, runtime work, or a new issue before implementation, do not collapse it into current product copy.

Boundary notes:

- #112 currently recommends no runtime implementation now; README showcase work must not contradict that conclusion.
- #185 is a lifecycle design record, not evidence that status files or emitters exist.
- #149 remains parked and must not be reframed as an active or approved showcase feature.

## Safe visual candidates

These visuals may be safe before a full showcase, provided they stay minimal and explicitly labeled.

### 1. Minimal issue-to-context pipeline diagram

- Safe content: issue input, deterministic parsing / references / guardrails / diagnostics, bounded task package output
- Required caption or caveat: current implemented pipeline; future request adapters not shown as implemented
- Current vs future labeling: current path only, or clearly separate future inputs with distinct labeling
- Alt text requirement: bilingual alt text and surrounding caption alignment for `README.md` and `README.en.md`
- Preferred source form: Mermaid or hand-authored Markdown first

### 2. Source trust / context budget conceptual diagram

- Safe content: strong vs inferred sources, full-include vs reference-only vs diagnostics-only
- Required caption or caveat: conceptual model grounded in source-trust docs; not a promise of every future protocol surface
- Current vs future labeling: current vocabulary with careful note when design vocabulary exceeds implemented rendering
- Alt text requirement: bilingual and terminology-aligned
- Preferred source form: Mermaid or Markdown

### 3. Validation / evidence workflow diagram

- Safe content: validation, PR, issue evidence comment, PR body backfill, readback verification, human review gate
- Required caption or caveat: workflow discipline, not automation
- Current vs future labeling: current workflow only
- Alt text requirement: bilingual and explicit about human approval
- Preferred source form: Mermaid or Markdown

### 4. Current-versus-future roadmap table

- Safe content: implemented today, design-only, explicitly parked, explicitly no-go-for-now
- Required caption or caveat: roadmap boundary summary, not delivery promise
- Current vs future labeling: mandatory
- Alt text requirement: bilingual labels for table headers and status meaning
- Preferred source form: Markdown table

### 5. Docs map / architecture map

- Safe content: which docs define product boundary, workflow, visual boundaries, status vocabulary, and companion constraints
- Required caption or caveat: documentation map, not runtime architecture diagram
- Current vs future labeling: note which docs are implementation-facing versus design-only
- Alt text requirement: bilingual where embedded in README
- Preferred source form: Markdown list or Mermaid

## Unsafe / premature visuals

The visuals below are unsafe now because they are highly likely to overclaim:

- hosted dashboard UI
- live companion runtime
- Spec Cat actively operating the workflow
- automatic remediation loop
- target repo auto-editing
- local status files shown as already written and consumed
- RAG / vector database system
- multi-agent control plane
- merge bot / approval bot

Why these are unsafe:

- They imply authority, automation, or runtime behavior that the current product explicitly does not claim.
- They visually compress future design records into present-tense product proof.
- They weaken the repo-safe boundary that `spec-injector` currently uses as a core positioning advantage.

## README alignment checklist

Before #120 starts, confirm all of the following:

- `README.md` and `README.en.md` use equivalent product claims
- non-goals remain explicit in both languages
- docs links match across both README files
- bilingual captions and alt text stay aligned
- current-versus-future wording is mirrored rather than drifted
- #112 no-go runtime conclusion is not contradicted
- #185 design-only lifecycle is not presented as implemented behavior
- #149 remediation loop is not implied as current, approved, or active

Additional wording discipline:

- If one README says `current`, the other should not soften or expand it into a roadmap promise.
- If one README introduces a future-facing visual, the other must carry the same caveat and status label.
- Avoid one language becoming the product-truth source while the other becomes marketing shorthand.

## Suggested #120 split plan

Do not execute #120 as one large PR. Prefer a staged plan.

### PR A: minimal pipeline diagram / docs map

- Scope: add a minimal current-state pipeline diagram or docs map with conservative captions
- Non-goals: no hero rewrite, no mascot asset, no runtime claims, no README narrative overhaul
- Dependencies: this readiness checklist, existing docs boundaries
- Review gates: overclaim check, bilingual caption plan, diagram source review, current-versus-future audit

### PR B: current capability showcase section

- Scope: tighten README showcase copy around current implemented capabilities only
- Non-goals: no future roadmap hero, no companion UI framing, no runtime posture change
- Dependencies: PR A if the diagram lands first, current/future audit complete
- Review gates: wording parity across both README files, evidence links correct, no future capability leakage

### PR C: roadmap / future design boundaries

- Scope: add a compact future-boundary section that links to design records without presenting them as built
- Non-goals: no implementation approval, no design-record rewrite, no parked issue reactivation
- Dependencies: current capabilities wording settled first
- Review gates: future labeling audit, #112 / #185 / #149 consistency review, no overclaim visuals

### PR D: visual polish / hero only after asset strategy is ready

- Scope: optional later polish for hero, layout, or small asset integration after asset workflow and bilingual review are ready
- Non-goals: no speculative product UI, no companion runtime scene, no hosted-platform imagery
- Dependencies: [visual-asset-workflow.md](visual-asset-workflow.md), approved asset strategy, previous README claim alignment
- Review gates: asset provenance review, bilingual alt text, overclaim review, human approval on final visuals

## Review gates before #120

The following gates should pass before starting any full showcase work:

- current/future capability audit
- bilingual diff review
- overclaim checklist review
- diagram caption review
- source docs link check
- no runtime / no automation claim check
- no target repo mutation claim check

Practical interpretation:

- A reviewer should be able to point at each showcase sentence and classify it as current, future, or docs-only design record.
- Every diagram caption should say whether it reflects current implementation, conceptual vocabulary, or future design.
- Any sentence that requires hidden runtime, automation authority, or target repo mutation should fail the gate.

## Relationship to existing docs / issues

This checklist should be read together with:

- #119 README product narrative refresh
- #120 full README showcase
- #132 brand architecture decision record
- #133 visual asset workflow plan
- #111 status event schema proposal
- #100 Spec Cat companion design direction
- #112 status runtime evaluation
- #185 local status file lifecycle design
- #149 supervised remediation loop park
- [brand-architecture.md](brand-architecture.md)
- [visual-asset-workflow.md](visual-asset-workflow.md)
- [status-event-schema.md](status-event-schema.md)
- [spec-cat-companion-design.md](spec-cat-companion-design.md)
- [status-runtime-evaluation.md](status-runtime-evaluation.md)
- [local-status-file-lifecycle.md](local-status-file-lifecycle.md)
- [product-moat.md](product-moat.md)
- [source-trust.md](source-trust.md)
- [workflow.md](workflow.md)
- [validation.md](validation.md)

Suggested reading order:

1. `README.md` / `README.en.md`
2. [brand-architecture.md](brand-architecture.md)
3. [visual-asset-workflow.md](visual-asset-workflow.md)
4. [status-runtime-evaluation.md](status-runtime-evaluation.md) and [local-status-file-lifecycle.md](local-status-file-lifecycle.md)
5. [workflow.md](workflow.md) and [validation.md](validation.md)

## Final recommendation

Final recommendation:

- Do not execute #120 as a single large PR.
- First do a minimal pipeline diagram or docs map PR, if a human approves that narrower step.
- Keep #149 parked and out of README showcase positioning.
- Keep runtime, companion, status-file, and remediation features future-facing until separate implementation approval exists.

Readiness verdict:

- `Current`: ready to document conservative current capabilities more clearly.
- `Not ready`: full showcase that mixes current product proof with future companion or runtime storytelling.
- `Best next step`: a small, reviewable, source-tracked diagram or docs-map PR before any broader README showcase pass.
