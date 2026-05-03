# Input Adapters: Deterministic Request-to-Context Design

## Purpose

本文件是 #129 的 design-only proposal，定義 `spec-injector` 未來如何從 GitHub issue 之外的輸入來源，deterministic 地編譯成 bounded、trust-labeled、agent-ready task package / prompt context。

`spec-injector` 的產品定位是 deterministic request-to-context compiler for AI coding agents。GitHub issue 是目前已實作入口；本文件只設計 input adapter vocabulary、source trust mapping、context budget behavior、diagnostics 與 future implementation split。

Catalog / protocol vocabulary 的收斂設計見 [docs/catalog-protocol.md](catalog-protocol.md)。

本文件不代表 runtime 已實作，不新增 CLI command / flag，不改 config schema，不實作 parser，也不引入 hidden LLM、semantic RAG、vector search 或 target repo automation。

## Problem Statement

### 為什麼不能只吃 GitHub issue

GitHub issue 是好的初始 source of truth，因為它通常有 title、body、labels、milestone、author、comments 與 audit trail。但實際 AI coding workflow 常見的 request 不一定已被整理成 issue：human 可能貼一段 raw task request、local repo 可能有 markdown brief、reviewer 可能留 PR comment，或 dogfood 過程產生 report。

如果 `spec-injector` 只能處理 GitHub issue，AI implementer 在 issue 之外的需求會回到手動複製、自由探索 repo、或讓 agent 自行判斷 scope。這會削弱 deterministic context compilation 的核心價值。

### 為什麼 fuzzy request 仍必須 deterministic / auditable

Fuzzy request 不代表可以使用 fuzzy compiler。越模糊的 request 越需要保守、可追蹤、可重跑的 extraction rules：

- 明確文字可以抽出 intent、path、issue reference、PR reference、checklist 與 labels。
- 模糊描述只能成為 hint，不能升格成 confirmed scope。
- 每個 extracted signal 都必須保留 source category、trust level、reason 與 confidence。
- 未讀到 repo-confirmed evidence 前，不可把 pasted text、AI plan 或 mention 當成 repo fact。

Deterministic adapter 的工作不是猜人類真正想要什麼，而是把可被機械辨識的 request signals 安全地放進 task package / prompt，並把不確定性留在 diagnostics。

### 如何延伸 #130 source trust / context budget

`#130` 定義了 source category、trust level、include mode、diagnostic vocabulary 與 context budget policy。本文件延伸該模型到 input layer：input adapter 必須在任何 reference discovery、guardrail matching、task package rendering 之前，先替 request text 標上 provenance 與 trust labels。

換句話說，#129 不應重新發明 trust taxonomy；它應把 GitHub issue、raw request、local markdown brief 與 future inputs 都轉成 #130 可消費的 source trust metadata。

## Design Principles

- Deterministic first：只使用 frontmatter、Markdown heading、bullet pattern、explicit path、issue / PR reference、label / milestone、checklist 與 raw text token 等可解釋規則。
- Provenance before compilation：每個 signal 先附 source category / trust level / reason，再進 reference discovery 或 context budget。
- Hints stay hints：hint、mention、partial plan、classifier evidence 不可被呈現為 confirmed requirement。
- Human confirmation for ambiguity：ambiguous request、conflicting hints、high-risk scope、future AI-generated plan 都需要 human confirmation。
- Bounded output：input adapter 不可讓 fuzzy prose 造成無限制 reference discovery 或 token explosion。
- Repo-safe boundary：input adapter 只產生 context，不修改 target repo，不建立 target repo branch / commit / PR，不寫 target repo `.spec-injector/`。
- No hidden model：不呼叫 hidden LLM、external AI API、local model、semantic embeddings、vector DB 或 RAG。

## Input Adapter Model

Input adapter 是一個 deterministic normalization layer：

```text
input source
  -> adapter-specific deterministic extraction
  -> trust-labeled request signals
  -> source trust / context budget policy
  -> bounded task package / prompt context
```

Adapter output 應至少包含：

- `input_kind`：例如 `github_issue`、`raw_text_request`、`local_markdown_brief`。
- `source_category`：對齊 [docs/source-trust.md](source-trust.md)。
- `trust_level`：confirmed / strong / medium / weak / hint / diagnostic / untrusted / external。
- `extracted_intent`：可由 title、heading、first paragraph 或 explicit goal section 抽出的 request summary。
- `extracted_references`：explicit repo-relative paths、issue references、PR references、docs references。
- `diagnostics`：missing / unreadable / ambiguous / conflicting / over-budget / unsupported claim。
- `confirmation_required`：需要 human confirmation 的原因。
- `budget_policy`：full-include、reference-only、diagnostics-only、hint-only 或 excluded 的建議。
- `confidence`：只用於 weak / hint 或 diagnostics-only signals；不得升級 trust level。

Schema naming notes:

- `references` is a prose shorthand for `extracted_references`; future protocol work should use `extracted_references`.
- `include_mode` is a per-reference expression of `budget_policy`; future protocol work should prefer `budget_policy` unless #107 defines a more precise catalog field.
- `confidence` is only meaningful for weak / hint or diagnostics-only signals; it must not upgrade trust level.

## Adapter Definitions

### 1. GitHub issue adapter

| Field | Design |
| --- | --- |
| Source category | human-authored GitHub issue；issue comments 需保留 comment author / timestamp provenance。 |
| Trust level | Issue title / body / labels / milestone 可作 strong request source；found issue-mentioned path 可 strong / confirmed；comments 依 author 與 explicit confirmation 降權。 |
| Extraction rules | 讀 title、body、labels、milestone、checkboxes、Markdown headings、inline code paths、bullet paths、issue / PR references、explicit non-goals、validation section。 |
| Allowed extracted signals | Goal、scope、non-goals、validation hints、explicit paths、labels、milestone、linked issues / PRs、checklist items、human confirmation comments。 |
| Diagnostics-only signals | Missing paths、unreadable paths、ambiguous alias candidates、stale references、conflicting labels / body text、comments that look like unapproved suggestions。 |
| Human confirmation requirements | Issue body 與 comments 衝突、label implies scope not present in body、comment suggests expansion、issue is `status:needs-design` but request asks implementation。 |
| Failure modes | Missing body、vague title only、stale paths、labels overclaim scope、AI-generated issue text with unsupported claims、too many mentioned references。 |
| Source trust / budget feed | Issue body and explicit issue-mentioned references get highest input priority; auto-discovery remains candidate-only; missing / ambiguous signals stay diagnostics-visible。 |

Example:

```markdown
Title: fix(cli): handle missing docs path
Body:
- Update `src/docs/finder.ts`
- Add validation for `docs/missing.md`
Non-goals:
- Do not change config schema
```

Extracted signals:

- intent: `handle missing docs path`
- confirmed request source: GitHub issue title / body
- issue-mentioned path hints: `src/docs/finder.ts`, `docs/missing.md`
- diagnostics: if `docs/missing.md` does not exist, keep original path as `not found`; optional alias hint remains `hint-only`
- must not infer: permission to redesign all docs discovery or config schema

### 2. Raw text request / pasted human request adapter

| Field | Design |
| --- | --- |
| Source category | human pasted request / external request text。 |
| Trust level | Request intent 可 strong as human instruction in current workflow；repo facts and file references remain untrusted / external until repo path exists or source is confirmed。 |
| Extraction rules | Parse explicit `Goal:` / `Scope:` / `Non-goals:` headings, bullets, inline code paths, quoted commands, issue / PR URLs, exact file paths, checkboxes, validation commands, branch / PR title hints。 |
| Allowed extracted signals | Human-stated goal、non-goals、allowed / forbidden files、validation commands、explicit path mentions、issue / PR links、requested branch / PR title。 |
| Diagnostics-only signals | Raw prose hints like "probably frontend"、"maybe auth"、implicit ownership claims、unresolvable URLs、paths outside repo、ambiguous file names。 |
| Human confirmation requirements | No source issue exists, requested scope conflicts with repo docs, too many candidate paths, vague request lacks allowed files, request asks target repo mutation without explicit safe workflow。 |
| Failure modes | Ambiguous scope、mixed unrelated tasks、copy-pasted AI plan、file path omitted、absolute local path not under repo、conflicting instructions inside pasted text。 |
| Source trust / budget feed | Human prompt stays high-priority input context, but mentioned paths are `raw-request-mentioned` until found; fuzzy hints can seed limited diagnostics or classifier evidence, not confirmed references。 |

Example:

```markdown
請修登入錯誤，可能在 `src/auth/session.ts`。
不要改 DB schema。
跑 pnpm test。
```

Extracted signals:

- intent: `修登入錯誤`
- raw request mentioned path: `src/auth/session.ts`
- non-goal: `不要改 DB schema`
- validation hint: `pnpm test`
- diagnostics: `可能` lowers confidence; if path is missing, show missing path and do not auto-select another auth file as confirmed
- must not infer: all auth files are in scope, database guardrail is approved, or login root cause is known

### 3. Local markdown brief adapter

| Field | Design |
| --- | --- |
| Source category | local markdown brief; provenance must include repo-relative path, read status, and whether it is tracked / local-only if available。 |
| Trust level | Human-authored tracked brief may be medium / strong for request intent; local-only or generated brief remains external / untrusted until human confirms。References inside brief are not repo-confirmed facts by default。 |
| Extraction rules | Parse YAML frontmatter, top-level headings, `Goal` / `Scope` / `Non-goals` / `Validation` sections, bullets, checkboxes, fenced command blocks, explicit paths, issue / PR links, labels / milestone fields。 |
| Allowed extracted signals | Frontmatter title / issue / labels / milestone, explicit scope, allowed files, forbidden changes, validation commands, referenced docs / source paths。 |
| Diagnostics-only signals | Unsupported frontmatter keys, generated-by markers, stale paths, relative paths escaping repo, broad glob patterns, TODOs without owner confirmation。 |
| Human confirmation requirements | Brief is untracked or generated, frontmatter conflicts with body, brief references closed / unrelated issue, broad glob includes many files, generated-by AI marker exists。 |
| Failure modes | Unreadable brief、malformed frontmatter、frontmatter-body conflict、too many referenced files、brief claims repo behavior without evidence、AI-generated brief treated as trusted source。 |
| Source trust / budget feed | Brief itself may be full-included if small; referenced paths use `local-brief-mentioned`; unsupported claims stay diagnostics-only unless repo docs or human confirmation backs them。 |

Example:

```markdown
---
title: docs-only input adapter design
issue: 129
labels: [type:design]
---

## Scope
- Add `docs/input-adapters.md`
- Link from `docs/source-trust.md`

## Non-goals
- No CLI changes
```

Extracted signals:

- intent: `docs-only input adapter design`
- issue reference: `#129`
- local brief mentioned paths: `docs/input-adapters.md`, `docs/source-trust.md`
- non-goal: `No CLI changes`
- diagnostics: if frontmatter `labels` conflict with linked issue labels, show conflict rather than silently overriding
- must not infer: implementation approval for parser or config schema changes

### 4. Future input: PR review comment

| Field | Design |
| --- | --- |
| Source category | PR review comment / review thread; future input only。 |
| Trust level | Medium for reviewer-observed issue if author is human reviewer; weak / diagnostic for bot comment until necessity assessment; not source issue scope by itself。 |
| Extraction rules | Parse comment body, file path, line range, author association, review state, thread resolved status, linked suggestion block, labels such as CodeRabbit / Codex auto review。 |
| Allowed extracted signals | Review finding summary、commented file path、line reference、requested change text、review verdict、explicit human approval / request changes。 |
| Diagnostics-only signals | Bot suggestions、stale diff context、summary-only comments、unresolved thread without actionable text、suggestion requiring scope expansion。 |
| Human confirmation requirements | Any change outside PR scope, bot finding classification, comment conflicts with source issue, requested change needs product judgment。 |
| Failure modes | Treating bot comment as command、auto-resolving without rationale、using review comment to expand source issue、stale line numbers、missing diff context。 |
| Source trust / budget feed | Future adapter may create review diagnostics or follow-up context, but should not become near-term implementation input for #129。 |

Example: a CodeRabbit comment mentioning `docs/source-trust.md` can become a diagnostics item requiring assessment, not an automatic docs change.

### 5. Future input: dogfood report

| Field | Design |
| --- | --- |
| Source category | dogfood report / evaluation artifact; future input only。 |
| Trust level | Medium for observed command output and diagnostics; weak for conclusions unless backed by exact evidence。 |
| Extraction rules | Parse target repo identity, command, raw output excerpt, false positive / false negative observations, dirty-state note, follow-up recommendation。 |
| Allowed extracted signals | Repro command、observed output、target repo status、diagnostic category、candidate follow-up issue。 |
| Diagnostics-only signals | Unverified conclusion、suggested root cause、target repo file paths not confirmed in source repo、mutation request。 |
| Human confirmation requirements | Any target repo mutation、turning dogfood observation into implementation scope、changing target repo `.spec-injector/`。 |
| Failure modes | Dogfood report becomes target repo automation、dirty target repo ignored、external config copied into target repo、observation over-generalized as product requirement。 |
| Source trust / budget feed | Useful as measurement input for #151, not a trusted implementation source by itself。 |

Example: a report saying "tachigo output missed `apps/extension/src/useTwitch.ts`" can become a dogfood false-negative diagnostic, not permission to edit tachigo.

### 6. Future input: AI-generated partial plan

| Field | Design |
| --- | --- |
| Source category | AI-generated partial plan / assistant output; future input only。 |
| Trust level | Low-trust / advisory / diagnostics-only unless human explicitly confirms specific parts。 |
| Extraction rules | Parse declared assumptions, proposed files, claims, validation suggestions, non-goals, open questions。 |
| Allowed extracted signals | Advisory candidate files、questions to ask human、claimed assumptions, proposed validation commands。 |
| Diagnostics-only signals | Unsupported repo behavior claims、invented files、scope expansion、model confidence language、hidden reasoning artifacts。 |
| Human confirmation requirements | Any file scope, requirement, design decision, validation claim, or target repo mutation derived only from AI output。 |
| Failure modes | AI plan treated as source of truth、hallucinated file accepted、hint rendered as confirmed scope、automatic scope inference without source trust labels。 |
| Source trust / budget feed | May enter diagnostics as `ai-plan-advisory`; cannot drive confirmed references or task package requirements without human confirmation。 |

Example: an AI plan listing `src/runtime/planner.ts` must stay advisory. If that file does not exist, diagnostics should say unsupported claim / missing file, not create a planner design.

## Deterministic Parsing Strategy

Adapters may use only deterministic extraction:

- YAML frontmatter keys with allowlisted names such as `title`, `issue`, `labels`, `milestone`, `scope`, `validation`。
- Markdown headings such as `Goal`, `Motivation`, `Scope`, `Non-goals`, `Validation`, `Acceptance criteria`。
- Bullet and checklist patterns including `-`, `*`, `1.`, `- [ ]`, `- [x]`。
- Inline code spans and fenced command blocks。
- Explicit repo-relative file paths, with path normalization and repo-boundary checks。
- GitHub issue references like `#129` and full issue URLs。
- GitHub PR references like `PR #156` and full PR URLs。
- Labels and milestones when present as metadata, not inferred from prose。
- Raw prose hints preserved as low-confidence hints with exact reason。

Adapters must not use:

- Semantic inference from vague wording。
- Hidden LLM / external AI API / local model interpretation。
- Embeddings、semantic RAG、vector search、model confidence。
- Automatic expansion from one mentioned file to neighboring files as confirmed scope。
- Rewriting vague language into confirmed requirements。

Fuzzy hints should be represented with fields like:

```text
signal: auth
source_category: raw_text_request
trust_level: weak / hint
confidence: low
reason: raw prose used vague marker "可能"
budget_policy: diagnostics-only
```

## Source Trust Mapping

| Input signal | Source category | Trust level | Include behavior | Caveat |
| --- | --- | --- | --- | --- |
| GitHub issue title / body | human-authored issue | strong request source | full input context / high-priority summary | Strong request source does not equal edit approval for every mentioned file。 |
| GitHub issue-mentioned found path | issue-mentioned | strong / confirmed | full-include or reference-only by budget | Mentioned path is context / candidate scope, not automatic modification approval。 |
| GitHub issue-mentioned missing path | diagnostics / missing files | diagnostic | diagnostics-only plus optional hint-only alias | Do not silently replace original path。 |
| Raw pasted human request | human pasted request | strong for current human instruction | input context / summary | Repo facts inside paste remain unconfirmed until validated。 |
| Raw request mentioned path | raw-request-mentioned | weak to medium; confirmed only if path exists | reference-only by default; full include only if policy allows | Avoid presenting as repo-confirmed fact。 |
| Local markdown brief | local markdown brief | medium / strong if human-authored and confirmed | brief summary or full include if small | Track generated / untracked / malformed status。 |
| Local brief reference | local-brief-mentioned | weak to medium; found path can become confirmed path existence | reference-only by default | Mention does not prove the brief is authoritative。 |
| Repo docs / always_read | repo always_read / configured docs | strong / confirmed when found | high-priority full-include or reference-only | Repo docs constrain work but do not expand issue scope。 |
| Auto-discovered repo reference | auto-discovered | medium candidate | reference-only or budgeted full-include | Candidate, not human-requested scope。 |
| AI-generated partial plan | ai-plan-advisory | untrusted / external | diagnostics-only unless human confirms | Never trust unsupported claims by default。 |

## Context Budget Behavior

Input adapters should keep fuzzy request handling bounded:

- Human request text, issue body, and local brief summary are primary input context。
- Explicit found paths can feed reference discovery, but their source label determines priority。
- Missing, unreadable, ambiguous, unsupported, conflicting, and over-budget signals remain diagnostics-visible。
- Fuzzy prose hints may feed classifier diagnostics or low-confidence domain hints, but not confirmed requirements。
- AI-generated partial plan content is advisory and diagnostics-only until human confirmation。
- Large local briefs should be summarized structurally by deterministic sections, not hidden model summarization。
- Reference discovery should be limited by explicit paths, labels, known configured roots, deterministic max counts, and source trust priority。
- Guardrail matching may use deterministic keywords from request text, but guardrails remain constraints / reminders, not scope expansion。
- Prompt compact mode should prefer reference-only + diagnostics summary; full task package can include more detail within deterministic limits。

Budget pressure handling:

- Preserve issue / human request intent before auto-discovered references。
- Preserve explicit non-goals and forbidden changes before optional examples。
- Degrade lower-trust sources to reference-only or diagnostics-only before dropping strong request context。
- If many paths are mentioned, include a bounded selected list and report omitted count / reason。
- Do not fetch or inline broad glob matches from fuzzy text such as `src/**` without explicit future implementation policy。

## Example Inputs / Outputs

### Example A: GitHub issue

Input:

```markdown
Title: docs(context): clarify source trust labels

## Scope
- Update `docs/source-trust.md`
- Mention relationship to #107

## Non-goals
- No runtime changes
- No config schema changes
```

Adapter output sketch:

```yaml
input_kind: github_issue
source_category: human-authored issue
trust_level: strong
extracted_intent: clarify source trust labels
extracted_references:
  - path: docs/source-trust.md
    source_category: issue-mentioned
    trust_level: strong / confirmed if found
    reason: inline code path in Scope section
  - issue: 107
    source_category: issue-reference
    trust_level: weak / hint
    reason: mentioned as relationship, not implementation scope
diagnostics: []
budget_policy:
  docs/source-trust.md: high-priority reference; full-include if budget allows
must_not_infer:
  - runtime source trust implementation
  - config schema changes
  - implementation of #107
```

### Example B: Raw pasted request

Input:

```markdown
幫我設計 raw request input，可能會碰 `src/cli/plan.ts`。
只做文件，不要新增 command。
Validation: pnpm test
```

Adapter output sketch:

```yaml
input_kind: raw_text_request
source_category: human pasted request
trust_level: strong for instruction; external for repo facts
extracted_intent: design raw request input
extracted_references:
  - path: src/cli/plan.ts
    source_category: raw-request-mentioned
    trust_level: weak / hint
    confidence: low
    reason: vague marker "可能會碰"
diagnostics:
  - runtime path mentioned while request says docs-only; require human confirmation before code changes
budget_policy:
  raw request: primary input context
  src/cli/plan.ts: diagnostics-only unless human confirms runtime scope
must_not_infer:
  - CLI implementation is allowed
  - new command is allowed
  - mentioned path is confirmed edit scope
```

### Example C: Local markdown brief

Input file: `docs/briefs/input-adapters.md`

```markdown
---
title: Input adapter proposal
issue: 129
milestone: Layer 3 — Protocolization
---

## Scope
- Add `docs/input-adapters.md`
- Link from `docs/product-moat.md`

## Future
- PR review comments
- dogfood reports
- AI-generated partial plans
```

Adapter output sketch:

```yaml
input_kind: local_markdown_brief
source_category: local markdown brief
trust_level: medium pending human confirmation
extracted_intent: Input adapter proposal
extracted_references:
  - path: docs/input-adapters.md
    source_category: local-brief-mentioned
    trust_level: medium / confirmed path intent if output path is approved
  - path: docs/product-moat.md
    source_category: local-brief-mentioned
    trust_level: medium / confirmed if found
diagnostics:
  - future inputs listed; mark as future-only, not near-term implementation targets
budget_policy:
  brief frontmatter and Scope: high priority
  Future section: diagnostics / roadmap relationship only
must_not_infer:
  - PR review comment adapter implementation now
  - dogfood parser implementation now
  - AI-generated plan as trusted source
```

## Failure Modes And Diagnostics

| Failure mode | Diagnostic behavior | Required boundary |
| --- | --- | --- |
| Missing file path | Show original repo-relative path, source category, and `not found`; optional alias stays hint-only. | Do not replace with a guessed path。 |
| Unreadable file path | Show `unreadable` or `read failed` with stable reason and source metadata。 | Do not call it missing; do not hide read issue。 |
| Ambiguous request | Mark extracted intent as low confidence and require human confirmation。 | Do not invent allowed files or requirements。 |
| Conflicting hints | Surface conflict between sections, labels, comments, or pasted text。 | Do not silently choose the broader scope。 |
| AI-generated plan with unsupported claim | Mark as `ai-plan-advisory` and diagnostics-only; list unsupported claim / missing path。 | Do not treat model claim as repo fact。 |
| Target repo dirty / unsafe mutation risk | Emit stop-and-report diagnostic before dogfood / target repo action。 | Do not stash, clean, reset, branch, commit, PR, or edit target repo。 |
| Vague scope | Keep vague words as raw hint with reason and confidence。 | Do not turn vague prose into confirmed requirement。 |
| Too many references / budget pressure | Apply deterministic limit, preserve stronger sources, report omitted count / reason。 | Do not expand fuzzy request into repo dump。 |
| Broad glob or directory mention | Treat as hint / bounded discovery seed only if future policy allows。 | Do not full-include entire directory by default。 |
| PR review bot suggestion | Classify as automated review signal needing assessment。 | Do not adopt or resolve without written rationale。 |

## Relationship To Follow-up Issues

- `#107` catalog / protocol design should reuse the vocabulary defined here: `input_kind`, `source_category`, `trust_level`, `budget_policy`, `diagnostic`, `confidence`, `reason`, `confirmation_required`, and budget fallback metadata。It should encode stable names only after `#129` / `#130` vocabulary is accepted。
- `#147` internal workflow contract should consume only stable internal workflow vocabulary after `#107` / `#130` are settled。It may check that task package / prompt context has evidence and trust labels, but it should not turn Harness-inspired discipline into a product control plane。
- `#151` second brownfield dogfood can use this design as a measuring ruler: were input signals source-labeled, were hints separated from confirmed references, did diagnostics catch missing / ambiguous paths, and did context budget stay bounded without target repo mutation。
- `#130` remains the source trust / context budget base layer. This document extends it at the input boundary rather than replacing it。

Suggested implementation issue split after this design:

1. Add internal adapter data types and tests for GitHub issue normalization only, preserving current CLI behavior。
2. Add deterministic raw text extraction helpers behind tests, without exposing a CLI command。
3. Add deterministic local markdown brief parser behind tests, without changing config schema。
4. Add task package / prompt rendering labels for input provenance once #107 protocol names are stable。
5. Add bounded diagnostics for raw-request-mentioned and local-brief-mentioned references。
6. Add docs / fixtures for future PR review comment, dogfood report, and AI-generated partial plan as non-implementation examples。

Things not to implement in #129:

- Runtime parser。
- CLI command or flag。
- Config schema change。
- Target repo dogfood mutation。
- Prompt output behavior change。
- JSON / machine-readable protocol runtime。
- Hidden LLM / semantic RAG / vector search。
- PR review comment, dogfood report, or AI-generated plan adapter implementation。

## Non-goals / Product Boundary

This design explicitly does not build:

- hidden LLM
- external AI API dependency
- local model parser
- semantic RAG
- vector DB / vector search
- hosted control plane
- agent orchestration
- merge bot
- remediation loop
- target repo automation
- automatic target repo branch / commit / PR
- automatic target repo `.spec-injector/` creation or mutation
- automatic scope inference without source trust labels
- AI-generated partial plan as trusted source
- generic prompt generator
- runtime implementation in this PR
- CLI command / flag changes in this PR
- config schema changes in this PR
- parser implementation in this PR
- dependency changes in this PR

## Decision Summary

- Primary input adapters to design first: GitHub issue, raw text request / pasted human request, local markdown brief。
- Future inputs only: PR review comment, dogfood report, AI-generated partial plan。
- Canonical adapter output: trust-labeled request signals before context compilation。
- Canonical rule: hint / mention / AI claim is not confirmed scope。
- Canonical boundary: deterministic extraction only; no hidden model, no RAG, no vector search, no target repo mutation。
