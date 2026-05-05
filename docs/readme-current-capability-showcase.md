# README Current Capability Showcase Planning

## 1. Purpose

This document is the planning artifact for `#120` current capability showcase section planning.

It intentionally does not:

- modify `README.md` or `README.en.md`
- implement `#120`
- produce final showcase copy
- propose runtime/automation changes

The goal is to define what can be presented as **current** safely, what needs caveats, and what must stay design-only.

## 2. Current recommendation

- Do not modify README yet until this planning boundary is accepted.
- Prefer adding a future small README PR B after this planning doc is merged.
- Keep `#120` as the umbrella issue and do not close it from this work.
- Keep `#149` parked and unchanged.
- Do not present future / design-only capabilities as current in any README claim.

## 3. Capability classification

| Capability | Classification | Safe wording | Supporting docs / evidence | Must not imply |
| --- | --- | --- | --- | --- |
| deterministic GitHub issue-to-context compilation | safe current | `spec-injector` compiles a GitHub issue and repo references into a bounded issue-to-context package. | `README.md`, `README.en.md`, `docs/workflow.md`, `docs/source-trust.md`, `docs/issue-to-context-pipeline.md` | autonomous planning runtime, auto-fix, hidden planner, hosted control plane |
| bounded task package / prompt generation | safe current | CLI output is bounded and structured for human review and AI agent handoff. | `README.md`, `README.en.md`, `docs/workflow.md`, `docs/validation.md` | automatic implementation, PR merge authority, target repo mutation |
| source references and diagnostics | safe current | Outputs can surface source references and clear diagnostics for missing/unreadable context. | `docs/workflow.md`, `docs/source-trust.md`, `docs/issue-to-context-pipeline.md` | model confidence inference, complete codebase understanding, automatic correction |
| missing / unreadable / alias hint diagnostics | current with caveat | Missing and unreadable paths can be visible, with alias hints labelled as hints only. | `docs/source-trust.md`, `docs/workflow.md`, `docs/issue-to-context-pipeline.md` | confirmed-path guarantees, alias promoted to official reference |
| source trust / context budget design direction | current with caveat | source trust categories and budget priorities are documented for bounded context selection. | `docs/source-trust.md`, `docs/product-moat.md` | finished runtime policy implementation, confidence scoring, guaranteed full context coverage |
| validation / evidence workflow | safe current | Human-reviewed validation and evidence workflow exists for PRs (build/test, evidence, readback). | `docs/workflow.md`, `docs/validation.md`, `docs/readme-showcase-readiness.md` | auto-merge, auto-close, remediation loop |
| readback verification workflow | safe current | PR body and issue evidence are readback-verified after writes. | `docs/workflow.md`, `docs/validation.md` | automatic review-thread resolution, bot merge gate |
| review finding necessity assessment workflow | current with caveat | Findings from automated reviewers are triaged by classification before action. | `docs/workflow.md`, `docs/validation.md`, `README.md` | one-line compliance to bots, ignoring high-risk scope expansion |
| read-only label / milestone audit checker | safe current | The audit checker is read-only and supports workflow guardrails. | `docs/label-taxonomy.md`, `docs/workflow.md` | read-only to mutating checker, metadata auto-repair |
| optional live `gh` smoke test | current with caveat | live `gh` smoke checks are optional and non-default in this planning boundary. | `docs/workflow.md`, `README.md` | always-on GitHub mutation or hosted sync behavior |
| README / docs link structure | safe current | Repository evidence and capability claims are linked through docs-first references. | `README.md`, `README.en.md`, `docs/readme-showcase-readiness.md`, `docs/issue-to-context-pipeline.md` | standalone claims without linked evidence |
| brand / visual / status / companion design records | design-only / future | design records exist for future directions and remain non-execution documents. | `docs/brand-architecture.md`, `docs/visual-asset-workflow.md`, `docs/status-event-schema.md`, `docs/spec-cat-companion-design.md`, `docs/status-runtime-evaluation.md`, `docs/local-status-file-lifecycle.md` | these records are shipped runtime or shipped companion behavior |
| minimal issue-to-context pipeline map | safe current | Existing pipeline map documents the current deterministic flow and future-lane separation. | `docs/issue-to-context-pipeline.md`, `docs/readme-showcase-readiness.md`, `README.md` | full protocol runtime, merged future lanes |

## 4. Candidate current capabilities

### 4.1 safe current

- deterministic GitHub issue-to-context compilation
- bounded task package / prompt generation
- source references and diagnostics
- validation / evidence workflow
- readback verification workflow
- read-only label / milestone audit checker
- README / docs link structure
- minimal issue-to-context pipeline map

### 4.2 current with caveat

- missing / unreadable / alias hint diagnostics
- source trust / context budget design direction
- optional live `gh` smoke test
- review finding necessity assessment workflow

### 4.3 design-only / future or not current

- brand / visual / status / companion design records
- any capability requiring future runtime execution or hosted/daemon behavior

### 4.4 Capability detail map (current-capable candidates)

| Capability | Safe wording | Supporting docs | Evidence source | Must not imply | README vs linked doc |
| --- | --- | --- | --- | --- | --- |
| deterministic GitHub issue-to-context compilation | Compiles GitHub issues into bounded, agent-ready task context. | `docs/issue-to-context-pipeline.md`, `docs/source-trust.md`, `docs/workflow.md`, `README.md`/`README.en.md` | repository docs + issue-to-context planner behavior in implementation code | autonomous editing, hidden planner | README + linked docs |
| bounded task package / prompt generation | Emits bounded task packages and compact planning prompts for human-guided agent workflows. | `docs/workflow.md`, `docs/validation.md`, `docs/brand-architecture.md`, `README.md`/`README.en.md` | repo scripts/docs + workflow policy | auto-synthesis, no-human control, runtime scheduling | README + linked docs |
| source references and diagnostics | Surfaces confirmed references and diagnostics for context assembly. | `docs/source-trust.md`, `docs/workflow.md`, `docs/issue-to-context-pipeline.md` | docs contracts and observed compiler vocabulary in docs/tests | vector search, full repo comprehension, silent omission | linked docs |
| missing / unreadable / alias hint diagnostics | Surfaces missing and unreadable signals, while alias hints remain non-confirmed. | `docs/source-trust.md`, `docs/workflow.md`, `docs/issue-to-context-pipeline.md` | diagnostics vocabulary and bounded behavior in docs | confirmed-path guarantees from hints | linked docs |
| validation / evidence workflow | Supports human-reviewed validation, issue evidence, PR body evidence, and readback checks. | `docs/workflow.md`, `docs/validation.md`, `docs/readme-showcase-readiness.md` | documented PR/Issue evidence pattern | automated merge, auto-close, remediation loop | README + linked docs |
| readback verification workflow | Requires readback verification after evidence writes before merge handoff. | `docs/workflow.md`, `docs/validation.md` | workflow contract and process checks | one-step automation or bot authority | README + linked docs |
| review finding necessity assessment workflow | Classifies automated findings (adopted / not adopted / optional / noise / human review) before fix. | `docs/workflow.md`, `docs/validation.md` | workflow rules | one-pass auto-fix and bot-driven scope changes | linked docs |
| read-only label / milestone audit checker | Uses read-only checker logic as governance support, not mutation. | `docs/label-taxonomy.md`, `docs/workflow.md` | docs contract and examples | metadata mutation and auto-remediation | linked docs |
| optional live `gh` smoke test | Optional, network-dependent smoke validation for environment checks. | `docs/workflow.md`, `README.md`/`README.en.md` | repo workflow guidance | "always-on" runtime sync and mutation | linked docs |
| README / docs link structure | Keeps claims mirrored by linked evidence/docs structure. | `docs/readme-showcase-readiness.md`, `docs/validation.md`, `README.md`/`README.en.md` | docs topology and workflow checklist | unlinked claim duplication between languages | README + linked docs |

## 5. Required supporting docs

- `docs/readme-showcase-readiness.md`
- `docs/issue-to-context-pipeline.md`
- `docs/source-trust.md`
- `docs/workflow.md`
- `docs/validation.md`
- `docs/label-taxonomy.md`
- `docs/brand-architecture.md`
- `docs/visual-asset-workflow.md`
- `docs/status-event-schema.md`
- `docs/spec-cat-companion-design.md`
- `docs/status-runtime-evaluation.md`
- `docs/local-status-file-lifecycle.md`
- `docs/product-moat.md`

## 6. Safe wording examples

- "Compiles GitHub issues into bounded, agent-ready task context."
- "Surfaces references and diagnostics so missing or unreadable context is visible."
- "Supports human-reviewed validation and evidence workflows."
- "Includes read-only workflow guardrails such as label / milestone audit."
- "Documents future companion/status directions without implementing runtime behavior."
- "Keeps human merge decisions explicit and workflow checks auditable."

## 7. Unsafe wording examples

- "Runs your agents."
- "Automatically fixes review comments."
- "Keeps your repo state in sync."
- "Provides a live companion runtime."
- "Indexes your codebase with semantic RAG."
- "Mutates target repos safely."
- "Approves or merges PRs."
- "Maintains live local status files."
- "Ships a Spec Cat UI."

## 8. Future / design-only exclusions

The following are explicitly excluded from current showcase claims:

- fuzzy request / markdown brief adapters
- semantic RAG / vector search
- hidden LLM planning
- hosted control plane
- agent orchestration platform
- remediation loop
- auto-fix / auto-merge / auto-close
- automatic review thread resolution
- companion runtime
- daemon / sidecar / watcher
- Tauri app / browser overlay
- Spec Cat UI
- status JSON emitter
- local status file writes
- target repo mutation
- GitHub Projects / roadmap dashboard
- full protocol runtime

If any appears, it must be labeled in README as `future`, `planned`, `design-only`, or `explicitly not implemented`.

## 9. README placement options

| Option | Description | Benefit | Risk | Recommended status |
| --- | --- | --- | --- | --- |
| Option A | add a small `Current capabilities` section directly in README | immediate user visibility, minimal doc churn | higher overclaim risk if capability links are not strict | Revisit after alignment review |
| Option B | link to a standalone planning docs page first | lowest overclaim risk, better auditability, bilingual parity easier to enforce | one extra navigation step for readers | Recommended |
| Option C | add compact table under current workflow section | concise and discoverable; still keeps structure | ambiguous if evidence columns are incomplete | Conditional on successful readback |
| Option D | defer direct README changes | maximum safety; allows one clean planning merge first | slower progress | Recommended only if docs cross-link parity is not yet stable |

## 10. README.md / README.en.md alignment rules

- Claim parity required: any current/future claim must appear in both files with equivalent meaning.
- Ordering parity required: current and future sections should follow the same sequence logic.
- Current/future wording mirrored: if one file says "current", the other must not soften or expand it.
- Links mirrored: linked docs/evidence must be available in both docs and align.
- Visual captions / alt text mirrored if visuals are added later.
- No English-only embedded claims unless an explicit bilingual strategy exists.

## 11. Review gates for future PR B

Future PR B can only proceed when all gates below pass:

- Every current capability in README has at least one supporting docs link or implemented behavior.
- No future/design-only capability is framed as shipped.
- `README.md` and `README.en.md` claims are equivalent in intent and strength.
- #112 runtime no-go remains explicit.
- #185 local status lifecycle remains design-only.
- #149 remediation loop remains parked.
- No target repo mutation is implied.
- No generated assets are introduced in PR B.
- Human merge/review authority is explicit; no automation merge claim.
- `Closes #120` PR body evidence and issue evidence process are prepared for traceability when PR B lands.

## 12. Relationship to existing docs and issues

- Issues: `#119`, `#120`, `#187`, `#189`, `#132`, `#133`, `#111`, `#100`, `#112`, `#185`, `#149`
- Docs: `docs/readme-showcase-readiness.md`, `docs/issue-to-context-pipeline.md`, `docs/source-trust.md`, `docs/workflow.md`, `docs/validation.md`, `docs/product-moat.md`, `docs/brand-architecture.md`, `docs/visual-asset-workflow.md`, `docs/status-event-schema.md`, `docs/spec-cat-companion-design.md`, `docs/status-runtime-evaluation.md`, `docs/local-status-file-lifecycle.md`, `docs/label-taxonomy.md`

## 13. Final recommendation

- Keep `#120` open as the umbrella.
- Run future PR B as a small, bounded "current capability showcase" update (or linked docs-first entry) only after this planning boundary is accepted.
- Do not include companion runtime, local status writes, or remediation loop as current.
- Keep `#149` parked.
- Perform direct README modifications only after this planning document is merged and review gates are accepted.
