# Catalog / Protocol Model

## Purpose

本文件是 #107 的 design-only proposal，定義 `spec-injector` 未來可共用的 catalog / protocol vocabulary。

`spec-injector` 的產品定位是 deterministic request-to-context compiler for AI coding agents。Catalog / protocol model 的目的，是把目前分散在 classifier、references、guardrails、task package rendering、source trust、input adapters 與 workflow docs 中的語彙，收斂成穩定、可維護、可測試的 design contract。

本文件承接：

- #129 / PR #159：deterministic request-to-context input adapter design，canonical doc 見 [input-adapters.md](input-adapters.md)。
- #130 / PR #156：source trust / context budget design，canonical doc 見 [source-trust.md](source-trust.md)。
- 既有 classifier、references、guardrails、task package docs。

本文件不代表 runtime 已實作，不新增 CLI command / flag，不改 config schema，不新增 dependency，不新增 JSON schema runtime，不改 classifier behavior，不改 task package output，也不建立 custom domains runtime。

## Problem Statement

目前 `spec-injector` 已形成多組 taxonomy：

- classifier domain 與 classifier evidence。
- reference source，例如 built-in preset、repo `always_read`、issue-mentioned、configured docs、auto-discovered。
- guardrail trigger、risk reminder 與 scope boundary。
- task package / prompt sections。
- source trust、include mode、context budget 與 diagnostics。
- #129 input adapter vocabulary，例如 `input_kind`、`source_category`、`trust_level`、`extracted_intent`、`extracted_references`、`diagnostics`、`confirmation_required`、`budget_policy`、`confidence`。

這些 vocabulary 若繼續散落在 code、docs 與 Markdown rendering 中，會造成 drift：

- 同一個 source 在不同文件被不同名稱描述，future output 很難穩定。
- Classifier、references 與 guardrails 可能各自擴張 vocabulary，卻沒有共同 trust / budget boundary。
- Task package section 可能先固定 Markdown wording，後續才發現 public output contract 與 internal design vocabulary 混在一起。
- Future input adapters 可能重複發明 source category / trust level，削弱 #130 的 canonical model。
- Snapshot tests 容易因為 wording 調整大量 churn，而不是測到真正 contract。

#107 應建立 catalog / protocol model，原因不是要立即 runtime 化，而是先定義哪些名稱穩定、哪些仍 internal-only、哪些只是 implementation candidate。穩定 vocabulary 讓 #108 / #109 / #110 / #147 / #151 後續能消費同一套語言，而不需要每張 issue 自己定義一套 partial schema。

這仍是 deterministic request-to-context compiler 的設計，因為 catalog 只描述 context compilation 的 inputs、trust labels、budget policy、diagnostics、guardrails 與 handoff sections。它不是 custom domains runtime、hosted platform、agent orchestration、merge bot、remediation loop、hidden LLM planner、semantic RAG、vector search 或 generic prompt generator。

## Catalog Model Overview

Catalog model 是一組 design vocabulary，不是本 PR 的 runtime schema。

| Catalog | Purpose | Consumes | Output stability |
| --- | --- | --- | --- |
| Domain catalog | 描述 domain id、name、deterministic classifier signals 與 guardrail / reference relationship。 | `docs/classifier.md`、`docs/concepts.md` | Internal design now；future output vocabulary candidate。 |
| Reference source catalog | 描述 source provenance、trust level、discovery mechanism、include / budget policy 與 diagnostics behavior。 | `docs/references.md`、`docs/source-trust.md`、#129 | Stable design vocabulary；future protocol candidate。 |
| Guardrail catalog | 描述 guardrail id、trigger、risk text、scope boundary、blocking / advisory / reminder semantics。 | `docs/guardrails.md`、classifier domains、source trust | Internal design now；future output vocabulary candidate。 |
| Task package section catalog | 描述 full task package / prompt sections 的 stable section model。 | `docs/task-package.md`、source trust、input adapters | Internal design now；future rendering compatibility guide。 |
| Input adapter vocabulary catalog | 承接 #129 的 `input_kind`、`source_category`、`trust_level` 等名稱。 | `docs/input-adapters.md`、`docs/source-trust.md` | Some stable for future output；some implementation candidate。 |
| Diagnostic vocabulary catalog | 承接 #129 / #130 的 missing、unreadable、read failed、ambiguous、conflicting、over-budget 等 diagnostics。 | `docs/source-trust.md`、safe read behavior、future adapters | Stable design vocabulary；future structured diagnostics candidate。 |
| Context budget / include policy vocabulary | 承接 #130 的 `full-include`、`reference-only`、`diagnostics-only`、`hint-only`、`excluded` 與 `budget_policy`。 | `docs/source-trust.md` | Stable design vocabulary；runtime algorithm deferred。 |

Catalog entries should share these common metadata fields when a future implementation issue chooses to encode them:

- `id` or stable name。
- Human-readable `name`。
- `description` / purpose。
- Source inputs or trigger signals。
- Trust / budget handling。
- Public output vs internal-only boundary。
- Failure / diagnostics behavior。
- Non-goals / prohibited interpretations。

These fields are prose design vocabulary today. They are not a JSON schema, not a config schema, and not a public product API in this PR.

## Domain Catalog

Domain catalog defines stable vocabulary for issue areas detected by deterministic classifier signals.

| Field | Design |
| --- | --- |
| Stable domain id | Lowercase stable id，例如 `docs`、`database`、`auth`、`ci`、`frontend`。Existing runtime domains remain source of truth until an implementation issue changes them。 |
| Name | Human-readable label，例如 "Docs"、"Database"。 |
| Deterministic classifier signals | Title keyword、label keyword、body keyword、future path / config signals only when separately designed。 |
| Confidence / score direction | Higher score means stronger deterministic evidence；title > label > body remains current model direction。This document does not change runtime scoring。 |
| Relationship to guardrails | Detected domains can trigger guardrails through `when_detected`。A domain hit only activates a reminder / constraint；it is not approval。 |
| Relationship to references | Domains may help reference discovery or future reference reasons, but must not turn inferred files into confirmed issue scope。 |
| Examples | `docs` triggered by docs wording / labels；`database` triggered by explicit database / migration evidence。 |
| Internal-only vs public output | Current detected domain output exists, but detailed catalog metadata is internal-only design until future protocol work。 |

Domain catalog boundaries:

- Do not implement custom domains runtime in this PR。
- Do not add config-defined domain keywords in this PR。
- Do not modify classifier behavior or scoring。
- Do not imply detected domains authorize file edits。
- Do not expose a product-facing domain JSON protocol in this PR。

### Domain Example

Design-only example, not runtime schema, future implementation candidate only:

```yaml
domain_id: docs
name: Documentation
classifier_signals:
  - title keyword: docs
  - label keyword: area:docs or type:docs, if such taxonomy exists
  - body keyword: README, documentation, guide
score_direction: stronger explicit title / label signals outrank generic body mentions
related_guardrails:
  - docs-only
related_references:
  - configured docs
  - auto-discovered docs
public_output_boundary: detected domain may be public; classifier evidence catalog remains internal-only
must_not_infer:
  - docs domain means runtime files may be changed
  - docs guardrail approves broad documentation rewrite
```

## Reference Source Catalog

Reference source catalog aligns existing reference taxonomy with #129 / #130 source trust vocabulary.

| Reference source | `source_category` | `trust_level` | Discovery mechanism | Include / budget policy | Diagnostics behavior | Human confirmation | Output boundary |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Built-in preset | `built-in preset` | `strong / confirmed` when found | Packaged preset path such as `presets/core/ai-collaboration.md` | `full-include` if budget allows；otherwise high-priority `reference-only` | Missing / read issue should be visible as tool health diagnostic | Not usually required, unless preset conflicts with repo instruction | Public source label exists；catalog metadata internal-only。 |
| Repo `always_read` | `repo always_read` | `strong / confirmed` when found | Target repo `.spec-injector/config.json` | High-priority `full-include` if budget allows；fallback `reference-only` | `not found` / `unreadable` / `read failed` diagnostics | Required if config conflicts with issue or asks unsafe behavior | Public source label exists；future structured fields candidate。 |
| Configured docs | `configured docs` | `medium / confirmed by config` when found | `.spec-injector/config.json` discovery docs / rule-matched docs | `full-include` or `reference-only` depending budget and size | Read failures visible with config/rule reason | Required if config-driven docs imply scope expansion | Public-ish section exists；stable category should align with #130。 |
| Issue-mentioned references | `issue-mentioned` | `strong / confirmed` when found；`diagnostic` when missing | Markdown inline code path、bullet path、explicit repo-relative path in issue body | High priority；`full-include` or `reference-only` by budget | Missing path remains visible；alias hints stay `hint-only` | Required when mentioned path conflicts with non-goals or is ambiguous | Public source label exists；future protocol candidate。 |
| Raw request mentioned references | `raw-request-mentioned` | `weak / hint` until repo-confirmed；can confirm path existence but not authority | #129 raw text deterministic extraction | `reference-only` by default；`diagnostics-only` when vague or docs-only conflict | Missing / ambiguous / conflicting signals visible | Required for runtime edits, broad scope, or low confidence hints | Future boundary only；not current runtime output。 |
| Local markdown brief references | `local-brief-mentioned` | `medium` if human-authored and confirmed；external / untrusted if generated or untracked | #129 local markdown brief parser | Brief summary may be included if small；referenced paths `reference-only` by default | Malformed frontmatter、stale path、generated marker、conflict diagnostics | Required for untracked / generated brief or frontmatter-body conflict | Future boundary only；not current runtime output。 |
| Auto-discovered docs | `auto-discovered docs` | `medium candidate` | Deterministic docs scan / keyword scoring / configured limits | `reference-only` by default；budgeted `full-include` only after stronger sources | Read issue or omitted due to budget should be visible when selected | Required if agent wants to treat candidate as edit scope | Public section exists；category wording should remain candidate-oriented。 |
| Auto-discovered source files | `auto-discovered source files` | `medium candidate` | Deterministic source scan / keyword scoring / configured directories | Usually `reference-only`；avoid full source dump | Read issue / omitted due to budget visible when selected | Required before treating as implementation scope | Public section exists；not an edit list。 |
| Missing / unreadable / read failed references | `diagnostics / missing files` | `diagnostic` | safe read / path resolution / discovery failure | `diagnostics-only`；never normal reference | Use stable labels: `not found`、`unreadable`、`read failed` | Required when missing path is critical or alias hint is needed | Public diagnostics should be visible；raw stack traces internal-only。 |
| Future PR review comment references | `pr-review-comment` | medium for human review finding；diagnostic for bot finding until assessed | Future adapter only | `diagnostics-only` or review context；not normal source | Stale line、bot suggestion、scope expansion diagnostics | Required for bot findings and out-of-scope changes | Future boundary only。 |
| Future dogfood report references | `dogfood-report` | medium for observed command output；weak for conclusions | Future adapter only | Report context / diagnostics；no target repo mutation | Dirty target repo、unsupported conclusion、mutation request diagnostics | Required before turning observation into implementation | Future boundary only。 |
| Future AI-generated partial plan references | `ai-plan-advisory` | `untrusted / external` | Future adapter only | `diagnostics-only` unless human confirms | Unsupported claim、invented file、scope expansion diagnostics | Required for any requirement or file scope | Future boundary only；must never become source of truth by default。 |

Reference source rules:

- Source label and trust label do not equal edit approval。
- Found path confirms existence / readability, not requirement authority。
- Lower-trust sources may seed diagnostics or candidate context, not confirmed task scope。
- Strong explicit sources degraded by budget must leave visible reason。
- Future inputs remain future boundary until separate implementation issues exist。

### Reference Source Example

Design-only example, not runtime schema, future implementation candidate only:

```yaml
source_category: issue-mentioned
trust_level: strong / confirmed when found
discovery_mechanism: explicit repo-relative path in GitHub issue body
budget_policy: high-priority full-include if budget allows; otherwise reference-only
diagnostics:
  missing: not found
  alias_hint: hint-only, not confirmed
confirmation_required:
  - mentioned path conflicts with issue non-goals
  - path is missing and alias candidates are ambiguous
public_output_boundary: source label and diagnostics may be public; catalog entry remains design-only
```

## Guardrail Catalog

Guardrail catalog describes repo-defined constraints / reminders that are matched from deterministic domains or future explicit signals.

| Field | Design |
| --- | --- |
| Guardrail id | Stable id such as `database-change` or `docs-only`。 |
| Trigger domain / signal | Current runtime uses `when_detected` domains。Future signals must remain deterministic and separately designed。 |
| Risk text | Human-readable risk reminder rendered into task package。 |
| Scope boundary | Explains what the guardrail constrains and what it does not authorize。 |
| Blocking / advisory / reminder | Current guardrails are reminders / constraints, not runtime blockers。Future blocking semantics require separate design。 |
| Relationship to source trust | Guardrail risk may be stronger when source trust is weak, conflicting, or diagnostics-heavy。It still cannot upgrade a source。 |
| Relationship to human confirmation | Guardrails can require human confirmation when risky scope is not explicit。They cannot grant approval themselves。 |
| Examples | Database migration review, auth boundary preservation, docs-only no runtime behavior change。 |

Guardrail rules:

- Guardrail is not approval。
- Guardrail cannot automatically expand scope。
- Guardrail cannot become remediation loop。
- Guardrail cannot auto-fix, auto-resolve review threads, or merge。
- Guardrail output should remain deterministic and inspectable。

### Guardrail Example

Design-only example, not runtime schema, future implementation candidate only:

```yaml
guardrail_id: docs-only
trigger_domain:
  - docs
risk_text: Docs issues should not modify runtime behavior unless explicitly approved.
scope_boundary: applies to docs-only issue scope; does not authorize broad README rewrite
severity_semantics: reminder
source_trust_relationship: if issue says docs-only but raw request mentions src paths, require diagnostics and human confirmation
human_confirmation_required:
  - runtime file change
  - CLI/config/schema behavior change
must_not_infer:
  - guardrail approves edits
  - guardrail opens adjacent docs cleanup
```

## Task Package Section Catalog

Task package section catalog defines stable section purposes without changing current Markdown output in this PR.

| Section | Purpose | Source inputs | Trust / budget handling | Output contract | Failure behavior | Example |
| --- | --- | --- | --- | --- | --- | --- |
| Issue / request metadata | Identify source issue or future input request, labels, milestone, branch hints, source URL。 | GitHub issue adapter；future raw / brief adapter。 | Human request context has highest priority；metadata conflict becomes diagnostic。 | Current task package has issue metadata；future input fields internal-only until implemented。 | Missing title/body becomes diagnostic or low-confidence intent。 | `Issue #107`, title, labels, milestone。 |
| Extracted intent | Summarize deterministic goal / scope / non-goals extracted from source input。 | Issue title/body, #129 adapter extraction。 | Intent is high priority; vague intent may carry `confidence` and `confirmation_required`。 | Future output candidate；not current runtime schema。 | Ambiguous or conflicting intent requires diagnostic。 | `design catalog / protocol model`。 |
| Source trust summary | Show how references and inputs are trusted / budgeted。 | #130 source categories and trust levels。 | Strong sources preserved before candidates；diagnostics visible。 | Future section candidate；not current output claim。 | Missing trust label should fail future validation, not silently infer。 | `issue-mentioned strong; auto-discovered medium candidate`。 |
| References | List built-in, always_read, issue-mentioned, configured, auto-discovered, future adapter references。 | Reference discovery and adapters。 | `full-include` / `reference-only` / `diagnostics-only` by source priority。 | Current reference sections exist；catalog provides naming alignment。 | Missing/read failed references move to diagnostics, not normal list。 | `docs/source-trust.md` as issue-mentioned doc。 |
| Diagnostics | Surface missing, unreadable, read failed, ambiguous, conflicting, over-budget, unsupported signals。 | safe read, source trust, adapters, budget policy。 | Diagnostics remain visible even in compact prompt where critical。 | Current Missing Files exists；future richer diagnostics candidate。 | Raw stack traces and local absolute path leakage avoided。 | `not found`, `ambiguous alias candidates`。 |
| Matched guardrails | Show triggered constraints / reminders and risk text。 | Domain classifier + repo guardrail config。 | Guardrails do not change source trust or budget priority by themselves。 | Current section exists。 | If classifier evidence is weak, guardrail remains caution and may require confirmation。 | `docs-only` guardrail。 |
| Validation hints | Suggest relevant checks without claiming they ran。 | Issue body, docs validation matrix, future adapter validation section。 | Human-stated validation outranks inferred hints。 | Current suggested checklist exists；future validation catalog can refine。 | Missing command script should be reported during validation, not hidden。 | `pnpm test`, `git diff --check`。 |
| Human confirmation requirements | List decisions that cannot be made deterministically。 | Ambiguous source trust, guardrails, conflicting inputs, future adapters。 | Low-trust / high-risk signals require confirmation before scope expansion。 | Future section candidate。 | If required confirmation exists, output must not imply approval。 | `raw request mentions runtime file in docs-only issue`。 |
| Non-goals / excluded signals | Preserve forbidden changes and signals deliberately excluded from scope。 | Issue non-goals, prompt constraints, source trust exclusions。 | Non-goals are high-priority context；excluded lower-trust signals should not disappear when important。 | Future section candidate；current docs prose already uses non-goals。 | Conflicting non-goals become diagnostics。 | `No CLI/config/schema changes`。 |
| Implementation handoff notes | Explain how AI implementer should use the package without treating it as autonomous plan。 | Task package docs, workflow docs, guardrails。 | Handoff notes do not upgrade trust or scope。 | Current Instructions / prompt guidance exists。 | If notes imply automation or approval, wording must be corrected。 | `References are context, not edit approval`。 |

### Task Package Section Example

Design-only example, not runtime schema, future implementation candidate only:

```yaml
section_id: source-trust-summary
purpose: summarize source categories, trust levels, and include policy before references
source_inputs:
  - reference source catalog
  - input adapter vocabulary
trust_budget_handling:
  - issue-mentioned found references before auto-discovered candidates
  - diagnostics visible even when content is reference-only
public_output_contract: future output candidate, not current CLI behavior
failure_behavior:
  - missing trust category becomes diagnostics in future implementation
example: issue-mentioned docs are strong; auto-discovered source files are medium candidates
```

## Input Adapter Vocabulary Catalog

#129 defines the input adapter vocabulary that #107 should consume rather than redefine.

| Vocabulary | Meaning | Future public output contract? | Current boundary |
| --- | --- | --- | --- |
| `input_kind` | Kind of request input, such as `github_issue`, `raw_text_request`, `local_markdown_brief`。 | Candidate after implementation issue。 | Design vocabulary only except current GitHub issue entrypoint。 |
| `source_category` | Provenance category aligned with #130。 | Strong candidate for future structured output。 | Stable design vocabulary；current Markdown has partial labels。 |
| `trust_level` | `confirmed`、`strong`、`medium`、`weak / hint`、`diagnostic`、`untrusted / external`。 | Strong candidate after renderer compatibility plan。 | Design vocabulary；do not claim full runtime support。 |
| `extracted_intent` | Deterministically extracted goal / scope summary。 | Candidate。 | Implementation issue required before schema freezes。 |
| `extracted_references` | Explicit paths, issue refs, PR refs, docs refs extracted from input。 | Candidate。 | Prose shorthand `references` should not become schema accidentally。 |
| `diagnostics` | Safe visible warnings / failures / ambiguity / conflicts。 | Strong candidate。 | Current Missing Files is partial implementation；full vocabulary design-only。 |
| `confirmation_required` | Reasons human decision is needed。 | Candidate for future task package section。 | Internal-only until output semantics are designed。 |
| `budget_policy` | Per-source include / omit / fallback guidance。 | Candidate after #130 implementation split。 | Design vocabulary；runtime budget algorithm deferred。 |
| `confidence` | Low / medium / high confidence for weak hints or diagnostics-only signals。 | Probably internal-only or diagnostic-only。 | Must not upgrade trust level；not model confidence。 |

Classification:

- Stable enough for docs / future output vocabulary: `source_category`、`trust_level`、`diagnostics`、`budget_policy` terms aligned with #130。
- Internal-only design vocabulary: detailed `confidence` scoring, guardrail severity semantics, section catalog metadata。
- Implementation candidate: `input_kind`、`extracted_intent`、`extracted_references`、`confirmation_required`。
- Prose shorthand only for now: `references` when used casually, `include_mode` when it is a per-reference expression of `budget_policy`。
- Not ready / future exploration: PR review comment adapter, dogfood report adapter, AI-generated partial plan adapter。
- Explicitly prohibited: hidden LLM interpretation, semantic RAG, vector search, automatic target repo mutation。

### Input Adapter Vocabulary Example

Design-only example, not runtime schema, future implementation candidate only:

```yaml
input_kind: raw_text_request
description: human pasted request text supplied outside GitHub issue body
source_category: human pasted request
trust_level: strong for current instruction; external for repo facts inside paste
extracted_intent: deterministic heading / first explicit goal extraction
extracted_references: raw-request-mentioned paths
confirmation_required:
  - vague scope
  - runtime file mentioned in docs-only request
budget_policy: primary input context; mentioned paths reference-only or diagnostics-only by trust
```

## Diagnostic Vocabulary Catalog

Diagnostics are visible source health / ambiguity signals. They are not normal references and do not authorize work.

| Diagnostic | Meaning | Typical source | Include policy | Confirmation relationship |
| --- | --- | --- | --- | --- |
| `not found` | Requested or selected repo-relative path does not exist。 | issue-mentioned / config / future adapter path | `diagnostics-only` | Required if critical path or alias choice matters。 |
| `unreadable` | Path exists or was selected, but permission/access prevents reading。 | safe read | `diagnostics-only` | Required if reference is necessary for safe work。 |
| `read failed` | IO / encoding / unexpected read failure。 | safe read | `diagnostics-only` | Required if source is high priority。 |
| `ambiguous alias candidates` | Missing path has multiple deterministic basename candidates。 | path alias hints | `hint-only` near diagnostic | Required before choosing any alias。 |
| `rejected classifier evidence` | Signal observed but too generic or lower-confidence。 | classifier | `diagnostics-only` | May guide future classifier issue, not current scope。 |
| `source omitted due to budget` | Selected source was not full-included due to size, budget, priority, safety, or duplicate coverage。 | context budget | visible reason；not silent | Required if omitted strong source blocks work。 |
| `source included as hint, not confirmed` | Candidate shown for review only。 | alias hints / future adapters | `hint-only` | Required before using as confirmed reference。 |
| `conflicting input signals` | Issue body, comments, raw request, labels, or brief disagree。 | input adapters | `diagnostics-only` | Required before choosing broader scope。 |
| `unsupported external claim` | External / AI-generated / dogfood text claims repo fact without evidence。 | future adapters | `diagnostics-only` | Required before trusting claim。 |
| `confirmation required` | Deterministic compiler cannot safely decide。 | source trust / guardrails / adapters | visible decision item | Human decision required before implementation expansion。 |

Diagnostic output should use repo-relative paths and stable labels. It should not leak unnecessary local absolute paths or raw stack traces.

### Diagnostic Vocabulary Example

Design-only example, not runtime schema, future implementation candidate only:

```yaml
diagnostic_id: ambiguous-alias-candidates
source_category: diagnostics / missing files
trust_level: weak / hint
trigger: issue-mentioned path is missing and basename search finds multiple candidates
budget_policy: hint-only
public_output_boundary: visible diagnostic is suitable; candidate scoring internals remain internal-only
confirmation_required: human must choose before any candidate becomes confirmed scope
```

## Context Budget / Include Policy Vocabulary

#130 defines context budget and include policy vocabulary. #107 should treat these as canonical names:

- `full-include`: content included in full task package, bounded by budget。
- `reference-only`: path / source / reason visible, content omitted。
- `diagnostics-only`: warning or failure visible, no reference content。
- `hint-only`: possible candidate shown near diagnostic, not normal reference。
- `excluded`: intentionally omitted due to budget, safety, irrelevance, duplicate coverage, or rule。
- `budget_policy`: future adapter / catalog field describing how a source should be included, downgraded, or omitted。

Budget rules:

- Preserve issue / human request intent before auto-discovered references。
- Preserve explicit non-goals and forbidden changes before optional examples。
- Keep critical diagnostics visible even in compact prompt。
- Degrade lower-trust sources before dropping strong request context。
- Do not use hidden summarization to pretend a large file was included。
- Do not use model confidence, embeddings, semantic ranking, or vector search。

## Internal-only vs Public Output Contract

| Category | Vocabulary / concepts | Rule |
| --- | --- | --- |
| Stable enough for docs / future output vocabulary | `source_category`、`trust_level`、`diagnostics`、`budget_policy`、reference source names、include policy names。 | Safe to use in docs and future protocol planning, but not claim full runtime support。 |
| Internal-only design vocabulary | Domain catalog metadata, guardrail severity taxonomy, detailed section catalog metadata, candidate confidence details。 | Use for design discussion and implementation planning only。 |
| Implementation candidate | `input_kind`、`extracted_intent`、`extracted_references`、`confirmation_required`、source trust summary section、structured diagnostics section。 | Requires separate issue, tests, compatibility plan, and no CLI output churn by default。 |
| Not ready / future exploration | PR review comment adapter, dogfood report adapter, AI-generated partial plan adapter, product-facing structured output。 | May be described as future boundary only。 |
| Explicitly prohibited | Hidden LLM, semantic RAG, vector DB, hosted control plane, agent orchestration, merge bot, remediation loop, target repo automation, plugin system in core。 | Must not be built or implied by this catalog。 |

Do not describe this design as completed ability. Do not claim JSON output, protocol runtime, custom domain catalog runtime, hidden planner, or product-facing machine-readable API exists.

## Compatibility / Migration Path

Migration should be incremental and low-churn:

1. Keep existing CLI output stable while docs adopt catalog vocabulary。
2. Align docs wording first: classifier, references, guardrails, task package, source trust, input adapters。
3. Add future internal TypeScript constants / types only in a separate implementation issue, with tests and no output change by default。
4. Add compatibility tests around stable vocabulary before changing rendering。
5. If task package section labels change later, do it intentionally with snapshot / integration test updates and PR body explanation。
6. Use aliases / prose bridges for old wording during transition, especially `include_mode` vs `budget_policy` and `references` vs `extracted_references`。
7. Keep prompt compact output conservative; do not add large new sections without budget and snapshot strategy。
8. Avoid turning catalog entries into config schema until custom domain / plugin boundaries are separately approved。

Future implementation issue split:

- Internal catalog constants for reference source categories and diagnostics, preserving output。
- Source trust summary rendering experiment behind tests, if accepted。
- Input adapter normalization types for GitHub issue only, preserving current CLI behavior。
- Raw request extraction helpers behind tests, without CLI command / flag。
- Local markdown brief parser behind tests, without config schema change。
- Task package section compatibility tests that reduce snapshot churn by asserting stable section ids or ordered headings。
- Future workflow checker issues consume vocabulary after it is stable, not before。

How this helps follow-ups:

- #108 can consume workflow / validation catalog names for preflight checker design, without implementing it here。
- #109 can consume evidence / metadata vocabulary for PR / evidence / HEAD consistency checker design, without implementing it here。
- #110 can consume metadata vocabulary for label / milestone audit checker design, without implementing it here。
- #147 can consume stable internal workflow vocabulary after #107 / #130 settle, without becoming hosted control plane。
- #151 can use catalog vocabulary as a dogfood measuring ruler, without target repo automation。

## Relationship To Follow-up Issues

### #147 internal workflow contract

#147 should consume only vocabulary that is stable after #107 / #130: source category, trust level, diagnostics, budget policy, evidence metadata, validation state, confirmation requirement. It should remain an internal workflow contract for `spec-injector` repo discipline. It must not turn Harness-inspired practice into hosted control plane, agent orchestration, merge bot, remediation loop, or product runtime.

### #151 second brownfield dogfood

#151 can use this catalog as a measurement checklist:

- Were issue-mentioned references separated from auto-discovered candidates?
- Were missing / unreadable / alias diagnostics visible?
- Did context budget preserve strong sources before candidates?
- Did guardrails stay reminders rather than approvals?
- Did dogfood avoid target repo mutation and `.spec-injector/` writes?

Dogfood observations can become follow-up issues, not direct target repo edits.

### #108 preflight checker

#108 may consume workflow / validation vocabulary such as worktree clean state, branch expectation, validation requirement, confirmation requirement, and stop-and-report diagnostics. This PR does not implement a checker, CLI command, CI workflow, or automation.

### #109 PR / evidence / HEAD consistency checker

#109 may consume evidence / metadata vocabulary such as PR URL, issue evidence comment URL, commit hash / HEAD, validation result, PR body backfill, review freshness, and source issue link. This PR does not implement GitHub automation, PR mutation logic, merge bot, or remediation loop.

### #110 label / milestone audit checker

#110 may consume metadata vocabulary such as issue labels, PR labels, status labels, roadmap milestone, primary layer label, and conflict diagnostics. This PR does not implement label mutation, audit CLI, or GitHub bot behavior.

## Example Catalog Entries

All examples in this section are design-only, not runtime schema, future implementation candidate only.

### Domain catalog entry

```yaml
domain_id: database
name: Database
classifier_signals:
  - title keyword: database
  - body keyword: migration
  - label keyword: area:database, if taxonomy exists
score_direction: explicit title / label evidence outranks generic body wording
related_guardrails:
  - database-change
related_references:
  - issue-mentioned migrations
  - configured architecture docs
internal_only_boundary: classifier evidence details are not current public output
```

### Reference source catalog entry

```yaml
source_category: repo always_read
trust_level: strong / confirmed when found
discovery_mechanism: target repo .spec-injector/config.json always_read
budget_policy: full-include if budget allows; otherwise high-priority reference-only
diagnostics_behavior: not found / unreadable / read failed remain visible
confirmation_required: if repo instruction conflicts with source issue or human prompt
public_output_boundary: source label is public; catalog metadata is design-only
```

### Guardrail catalog entry

```yaml
guardrail_id: database-change
trigger_domain:
  - database
risk_text: Database/schema changes require explicit issue scope and migration review.
scope_boundary: reminder to verify explicit scope; does not approve schema edits
severity_semantics: reminder / advisory in current design
source_trust_relationship: weak database evidence should not expand scope
human_confirmation_required: schema or migration changes not explicitly requested
```

### Task package section catalog entry

```yaml
section_id: human-confirmation-requirements
purpose: list decisions that deterministic compiler cannot safely make
source_inputs:
  - conflicting input signals
  - guardrail risk
  - low-trust references
trust_budget_handling: diagnostics-only signals stay visible until human resolves them
public_output_contract: future candidate only
failure_behavior: output must not imply approval when confirmation is required
```

### Input adapter vocabulary entry

```yaml
field: extracted_references
meaning: explicit paths, issue refs, PR refs, or docs refs found by deterministic adapter extraction
stable_status: implementation candidate
public_output_boundary: future structured output candidate after compatibility issue
must_not_infer:
  - every extracted reference is approved edit scope
  - vague prose can become confirmed reference
```

### Diagnostic vocabulary entry

```yaml
diagnostic_id: source-omitted-due-to-budget
meaning: selected source was not full-included because of budget, size, safety, priority, or duplicate coverage
trust_level: diagnostic
budget_policy: visible reason; content omitted or reference-only
confirmation_required: if omitted source is strong and blocks safe implementation
public_output_boundary: stable diagnostic vocabulary candidate
```

## Risks And Non-goals

This PR explicitly does not build:

- custom domains runtime。
- runtime implementation。
- CLI command / flag changes。
- config schema changes。
- JSON schema runtime file。
- dependency changes。
- classifier behavior changes。
- task package output changes。
- reference discovery architecture rewrite。
- hidden LLM。
- external AI API parser。
- local model parser。
- semantic RAG。
- vector DB / vector search。
- hosted control plane。
- agent orchestration。
- merge bot。
- remediation loop。
- target repo automation。
- target repo branch / commit / PR。
- target repo `.spec-injector/` creation or modification。
- product-facing JSON output。
- plugin system。

Main risks:

- Over-stabilizing vocabulary too early and forcing future implementation into a bad schema。
- Letting "catalog" language imply custom domains runtime or plugin system。
- Letting "protocol" language imply product-facing JSON output already exists。
- Turning internal workflow discipline into product roadmap scope。
- Creating Markdown output churn before tests and compatibility strategy are ready。

Mitigation:

- Keep this PR docs-only。
- Mark examples as design-only / not runtime schema。
- Separate stable docs vocabulary from implementation candidates。
- Require future implementation issues, tests, and compatibility plans before runtime changes。
- Preserve product boundary: deterministic request-to-context compiler, not actor or platform。

## Decision Summary

- Canonical source trust / budget vocabulary comes from [source-trust.md](source-trust.md)。
- Canonical input adapter vocabulary comes from [input-adapters.md](input-adapters.md)。
- #107 adds the catalog layer that ties domains, references, guardrails, task package sections, diagnostics, and budget policies together。
- Catalog vocabulary may guide future output contracts, but this PR does not create runtime schema or product-facing protocol。
- Future checkers and workflow contracts should consume this vocabulary only after it is stable and separately implemented。
