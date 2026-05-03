# Internal Workflow Contract

## Purpose

本文件是 #147 的 design-only proposal，定義 `spec-injector` repo 自身使用的 internal machine-readable workflow contract vocabulary。

它的第一用途是維持 `spec-injector` 專案本身的 AI-assisted development workflow consistency，讓未來 #108 / #109 / #110 這類 repo-local workflow guardrail checkers 有共同規格來源。

本文件不是 runtime schema，不是 JSON schema runtime file，不是 product-facing output，也不代表 `spec-injector` 已有 workflow runtime、checker、control plane、merge bot、remediation loop 或 PR automation platform。

`spec-injector` 的產品定位仍是 deterministic request-to-context compiler for AI coding agents。此 contract 只描述 repo-local workflow expectations；branch、PR、issue evidence、metadata closeout 與 review handling 是 surrounding workflow discipline，不是 CLI core 的主要產品輸出。

## Relationship To Prior Designs

本 contract 必須消費既有設計 vocabulary，不重新發明一套 parallel schema：

- #129 / PR #159：deterministic request-to-context input adapter design，canonical doc 見 [input-adapters.md](input-adapters.md)。
- #130 / PR #156：source trust / context budget design，canonical doc 見 [source-trust.md](source-trust.md)。
- #107 / PR #160：catalog / protocol model design，canonical doc 見 [catalog-protocol.md](catalog-protocol.md)。

可沿用的 vocabulary 包含：

- `input_kind`
- `source_category`
- `trust_level`
- `extracted_intent`
- `extracted_references`
- `diagnostics`
- `confirmation_required`
- `budget_policy`
- `confidence`
- domain catalog
- reference source catalog
- guardrail catalog
- task package section catalog
- diagnostic vocabulary
- context budget / include policy vocabulary

在 #147 的語境中，這些 vocabulary 用來描述 repo workflow evidence、validation、metadata 與 risk-tier expectations。它們不把 internal workflow contract 變成 public task package JSON，也不改變 current CLI output。

## Problem Statement

目前 repo workflow 規則分散在 `AGENTS.md`、`CLAUDE.md`、[workflow.md](workflow.md)、[validation.md](validation.md)、issue prompt、PR body 約定與 human review 習慣中。這些 Markdown 規則足以指導 human / AI agent，但會出現幾種 drift：

- 同一個 rule 在不同文件被不同名稱描述，例如 issue evidence、PR body backfill、latest HEAD freshness、review finding assessment。
- Agent 可能記得 workflow prose，卻漏掉 machine-checkable 的欄位，例如 evidence URL、commit hash、validation command result 或 metadata status label。
- Future checker 若各自讀一份 prompt 約定，#108 preflight、#109 PR / evidence / HEAD consistency、#110 metadata audit 會產生三套 partial contract。
- Review / merge closeout 常包含 bot findings、human verdict、CI status、issue evidence、labels 與 milestone；沒有 shared vocabulary 時，很容易把 auxiliary signal 當 approval，或在 PR body / issue evidence 中留下 stale HEAD。

因此需要一份 internal machine-readable workflow contract design，先把 repo-local workflow expectations 轉成穩定 vocabulary。這份設計可讓未來 checker 從同一套欄位與 risk tier 開始，而不是直接從 prose workflow doc 各自推論。

這仍是 repo-local workflow infrastructure，不是 `spec-injector` 對外產品主輸出。避免滑向 hosted control plane / merge bot / remediation platform 的方式是：

- Contract 只描述 expected state、required evidence 與 stop-and-report condition。
- Contract 不執行 GitHub mutation，不 merge，不 auto-resolve conversation，不 auto-fix review findings。
- Contract 不修改 target repo，也不建立 target repo branch / commit / PR。
- Contract 不呼叫 hidden LLM、API、local model、semantic RAG 或 vector DB。
- Contract 不成為 public task package JSON、CLI command、config schema 或 CI workflow。

## Contract Scope And Boundary

此 contract 只描述 `spec-injector` repo 自身 workflow expectations。它可描述：

- changed-file risk tier
- required validation by risk tier
- PR body requirements
- issue evidence requirements
- commit hash / HEAD freshness expectations
- review finding necessity assessment
- CodeRabbit / Codex auto review handling
- label / milestone / status metadata expectations
- target repo safety rules
- dogfood / external config safety rules
- branch / worktree cleanup policy
- #108 / #109 / #110 consumers 的 relationship

此 contract 不描述或不授權：

- runtime behavior
- CLI command / flag
- config schema
- package dependency
- CI workflow
- checker implementation
- JSON schema runtime file
- preflight checker implementation
- PR / evidence consistency checker implementation
- label audit checker implementation
- merge automation
- bot thread auto-resolve
- remediation loop
- hidden LLM / API / local model
- target repo / tachigo mutation
- target repo `.spec-injector/` 建立或修改
- target repo branch / commit / PR

Harness Engineering 只可作為 spec-injector repo 自身 AI-assisted workflow discipline 的借鏡。它不是 product-facing harness runtime，也不是 hosted harness platform、hosted control plane、agent orchestration platform、merge bot、PR automation platform 或 target repo automation tool。

## Contract Shape

以下是 design-only YAML-like shape。

It is design-only, not runtime schema, future implementation candidate only, internal repo-local contract, not product-facing output.

```yaml
contract:
  version: 1
  workflow_scope:
    repo: spec-injector
    purpose: internal repo-local AI-assisted development workflow consistency
    product_boundary:
      positioning: deterministic request-to-context compiler for AI coding agents
      not_product_output: true
      not_hosted_control_plane: true
      not_merge_bot: true
      not_remediation_loop: true
  vocabulary_sources:
    input_adapter_design: docs/input-adapters.md
    source_trust_design: docs/source-trust.md
    catalog_protocol_design: docs/catalog-protocol.md
  risk_tiers:
    docs-only: {}
    workflow-docs: {}
    tests-only: {}
    runtime-low-risk: {}
    runtime-high-risk: {}
    classifier-references-template-behavior: {}
    config-schema: {}
    ci-automation: {}
    target-repo-dogfood: {}
    merge-metadata-closeout: {}
  validation_matrix: {}
  evidence_requirements:
    pr_body: {}
    source_issue_comment: {}
    head_freshness: {}
  review_closeout_requirements: {}
  metadata_requirements: {}
  worktree_requirements: {}
  target_repo_safety: {}
  dogfood_safety: {}
  consumers:
    - issue: 108
      role: preflight checker
    - issue: 109
      role: PR / evidence / HEAD consistency checker
    - issue: 110
      role: label / milestone audit checker
    - issue: 151
      role: second brownfield dogfood checklist alignment
```

Future implementation may encode a subset of this shape in a checker-specific fixture or config, but that requires a separate implementation issue. #147 must not add runtime schema files or checker code.

## Changed-file Risk Tiers

Risk tiers help future checkers choose validation and evidence expectations. A PR may match multiple tiers; future consumers should evaluate every matched tier and apply deterministic merge semantics:

1. Required validation: use the stricter, higher-risk validation set; when unsure, take the union and explain why.
2. Evidence requirement and review requirement: use the union of all matched tier requirements.
3. Stop-and-report: if any matched tier says stop-and-report, it becomes a stop-and-report trigger.
4. Human approval: if any matched tier requires human approval before implementation or merge, human approval is required.

Example: a PR touching `docs/validation.md` and `.github/workflows/ci.yml` matches `workflow-docs` and `ci-automation`; it must satisfy workflow-docs evidence/review requirements, CI automation review requirements, local validation where possible, and CI status before merge.

| Tier | Description | Examples | Required validation | Evidence requirement | Review requirement | Stop-and-report | Human approval |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `docs-only` | Prose-only docs that do not alter workflow rules or runtime behavior. | `docs/concepts.md`, README glossary link, explanatory docs. | `git diff --check`; Markdown sanity check; `pnpm build` / `pnpm test` when cheap or repo baseline expects it. | PR body and issue evidence confirm files changed and docs-only non-goals. | Reviewer checks future behavior is not written as implemented. | Runtime / CLI / config / CI edit appears necessary. | Required before merge; implementation can proceed after source issue scope is clear. |
| `workflow-docs` | Docs that define repo process, evidence, validation, review, worktree, metadata, or AI agent behavior. | `AGENTS.md`, `CLAUDE.md`, `docs/workflow.md`, `docs/validation.md`, this file. | `git diff --check`; Markdown sanity; `pnpm build`; `pnpm test`; instruction consistency review. | Evidence must include scope guard, non-goals, and whether AGENTS / CLAUDE drift was avoided. | Review workflow wording for contradiction and product-boundary drift. | Rule conflicts, broad instruction rewrite, or checker implementation becomes necessary. | Required before merge; high-risk workflow changes may need human approval before implementation if issue is ambiguous. |
| `tests-only` | Test files change without runtime behavior changes. | `tests/**/*.test.ts`, fake `gh` fixtures. | `pnpm build`; `pnpm test`; targeted test command; `git diff --check`. | Evidence explains tested behavior and confirms no runtime source change. | Review avoids brittle snapshots or network-dependent GitHub tests. | Test requires real GitHub API / network or implies runtime change outside scope. | Required before merge. |
| `runtime-low-risk` | Small implementation change with narrow behavior impact. | Safe read handling, localized CLI output fix, small helper. | `pnpm build`; `pnpm test`; targeted regression; `git diff --check`. | Evidence includes files, behavior, validation, commit hash. | Review changed behavior and regression coverage. | Wider refactor, config/schema/CI change, or missing deterministic test appears necessary. | Required before merge; before implementation if issue is `status:needs-design` or scope unclear. |
| `runtime-high-risk` | Runtime change with broad behavior, safety, or user-facing impact. | issue parser, command dispatch, safe file reads, output renderer, error handling. | `pnpm build`; `pnpm test`; targeted regression; CLI smoke if command behavior changes; snapshot/output review if output changes. | Evidence must include exact behavior impact, non-goals, validation, follow-up risks. | Review source trust, deterministic behavior, and output compatibility. | Behavior change lacks issue approval, breaks deterministic boundary, or needs package / CI changes. | Required before implementation when risk is not explicitly scoped; always required before merge. |
| `classifier-references-template-behavior` | Changes affecting domain detection, references, guardrails, task package sections, prompt output, or template rendering. | `src/classifier`, references discovery, `templates`, task package rendering. | `pnpm build`; `pnpm test`; targeted classifier/reference/output regression; mocked `gh` tests when GitHub output is involved; snapshot/output review when output changes. | Evidence identifies output changes and guards against snapshot churn. | Review must distinguish stable contract from incidental wording. | Output semantics change without issue approval or tests become network-dependent. | Required before implementation if design not settled; required before merge. |
| `config-schema` | Config schema, `.spec-injector/config.json` semantics, package metadata, or user-facing config docs. | schema version, `spec validate`, config commands. | `pnpm build`; `pnpm test`; targeted config validation; docs update; `git diff --check`. | Evidence must call out schema compatibility and no hidden target repo mutation. | Review migration / backward compatibility and docs. | New schema, dependency, or command is outside source issue. | Required before implementation and merge. |
| `ci-automation` | GitHub Actions, automation scripts, CI jobs, release workflows, or checker execution in CI. | `.github/**`, package manager setup in CI, future checker job. | Local equivalent validation where possible; `pnpm build`; `pnpm test`; CI status before merge. | Evidence lists workflow impact, permissions, triggers, and skipped local equivalents. | Review secrets, permissions, job names, and network boundaries. | CI change not explicitly scoped, branch protection names drift, or hidden network dependency appears. | Required before implementation and merge. |
| `target-repo-dogfood` | Dogfood, brownfield target repo evaluation, external config snapshot, or target repo safety audit. | tachigo read-only run, external `/tmp` config, dogfood report. | Target repo clean check; report-only output; no target repo implementation; relevant `spec plan` command if scoped. | Evidence separates observations, false positives / negatives, warnings, and follow-up issues. | Review no target repo mutation and no copied `.spec-injector/`. | Target repo dirty, task requires target repo edits, or external config would be copied into target repo. | Required before any target repo mutation; mutation is prohibited unless separately approved. |
| `merge-metadata-closeout` | Metadata-only labels, milestones, evidence closeout, issue close, merge-time review closeout. | `status:implemented`, close completed, PR body backfill, review conversation audit. | Manual / read-only audit; `gh issue view`; `gh pr view`; `gh pr checks`; confirm no repo file changes unless scoped. | Evidence lists exact GitHub mutations and latest HEAD / evidence URL. | Review CodeRabbit / Codex findings classifications, CI, human authorization. | HEAD moved, stale PR body evidence, unresolved needs-human-review finding, missing permission, or label taxonomy unclear. | Explicit human authorization required before merge; issue closeout only after merge / completion evidence. |

## Required Validation By Risk Tier

Future checker vocabulary should encode validation as required, recommended, skipped-with-reason, or not-applicable.

Global rules:

- `git diff --check` is baseline for file-changing PRs.
- Markdown sanity check is required for docs changes.
- `pnpm build` is required for runtime, workflow-docs, and any PR where repo baseline confidence matters.
- `pnpm test` is required for runtime, workflow-docs, classifier/reference/template behavior, config/schema, and generally recommended for docs-only when cheap.
- `pnpm lint` should run only if the script exists.
- `pnpm typecheck` should run only if the script exists.
- A missing script must be reported as skipped with reason; do not claim it passed.
- Mocked `gh` / fake `gh` tests are required when feature tests need GitHub output.
- Snapshot tests are required only when the repo already uses snapshots or an output contract intentionally changes; avoid snapshot churn and document why the output diff is stable contract, not incidental wording.
- Metadata-only work uses manual / read-only audit rather than repo test claims.
- CI status must be inspected before merge, not treated as local validation.

Design-only validation matrix:

```yaml
validation_matrix:
  docs-only:
    required:
      - git diff --check
      - markdown sanity check
    recommended:
      - pnpm build
      - pnpm test
    script_optional:
      - pnpm lint, only if package.json has scripts.lint
      - pnpm typecheck, only if package.json has scripts.typecheck
  workflow-docs:
    required:
      - git diff --check
      - markdown sanity check
      - pnpm build
      - pnpm test
      - instruction consistency review
  tests-only:
    required:
      - pnpm build
      - pnpm test
      - targeted test command
      - git diff --check
  runtime-low-risk:
    required:
      - git diff --check
      - pnpm build
      - pnpm test
      - targeted regression
  runtime-high-risk:
    required:
      - git diff --check
      - pnpm build
      - pnpm test
      - targeted regression
      - CLI smoke checks, when command behavior changes
      - snapshot/output review, when output changes
  classifier-references-template-behavior:
    required:
      - git diff --check
      - pnpm build
      - pnpm test
      - targeted output regression
      - mocked gh tests, when GitHub output is relevant
      - snapshot or ordered-output evidence, when output changes
  config-schema:
    required:
      - git diff --check
      - pnpm build
      - pnpm test
      - targeted config validation
      - docs update
  ci-automation:
    required:
      - local equivalent validation where possible
      - CI status before merge
  target-repo-dogfood:
    required:
      - target repo clean check
      - report-only output
      - no target repo implementation
      - relevant spec plan command, only when scoped
  merge-metadata-closeout:
    required:
      - gh issue view
      - gh pr view
      - gh pr checks
      - manual review conversation audit
      - no repo file changes, unless explicitly scoped
```

Docs-only PRs still should run available baseline validation when cheap, especially in this repo where `pnpm build` and `pnpm test` are lightweight. If a command does not exist, the evidence should say `skipped: package.json has no scripts.lint` or equivalent.

## PR Body Requirements

PR body should be Traditional Chinese by default. Technical terms, commands, file paths, labels, milestones, raw output, external API names and commit hashes may remain English.

Required sections:

- `Closes #<issue-number>` or explicit reason why the PR should not auto-close the issue.
- Summary.
- Scope.
- Non-goals.
- Validation.
- Issue evidence.
- Follow-up issues / recommendations.
- Review notes.
- Latest commit hash / HEAD.

Required fields:

- issue evidence comment URL.
- latest commit hash / HEAD.
- validation command list and result.
- scope guard / non-goals confirmation.
- skipped validation reasons, if any.
- metadata rationale if PR crosses layers or metadata differs from linked issue.

After review follow-up, PR body must be backfilled with latest evidence and latest HEAD. A stale evidence URL or stale commit hash is a merge blocker until updated and re-read.

## Issue Evidence Requirements

The source issue implementation evidence comment should be Traditional Chinese by default. Technical terms, commands, file paths, raw output, raw errors, commit hash, PR URL and labels may remain English.

Required content:

- PR URL.
- Branch.
- Commit hash / HEAD.
- Files changed.
- 變更摘要.
- 設計重點, when design-only.
- Validation commands / results.
- Scope / non-goals.
- Review finding assessment, if applicable.
- Follow-up recommendations.
- 未完成事項 / warnings, if any.

Issue evidence is an audit record, not merge approval. Review follow-up that changes HEAD should either add updated evidence or ensure PR body clearly records the follow-up commit and latest HEAD.

## Commit Hash / HEAD Freshness Expectations

Commit hash / HEAD freshness is a contract requirement because evidence becomes misleading when a PR receives follow-up commits after the issue evidence comment or PR body backfill.

Rules:

- Implementation evidence commit hash must match PR latest HEAD, or explicitly explain which follow-up commit superseded the original evidence.
- PR body latest HEAD must match the current PR head before merge.
- Merge-time closeout must check expected HEAD.
- Merge command must use expected head SHA / match-head-commit when available.
- If HEAD moved after approval, stop-and-report.
- If PR body evidence is stale, backfill it before merge.
- If issue evidence is stale but still useful, PR body must explain the follow-up commit and latest validation.

Design-only example:

```yaml
head_freshness:
  expected_head_sha: <latest PR head sha>
  evidence_comment_sha: <sha recorded in source issue comment>
  pr_body_sha: <sha recorded in PR body>
  merge_policy:
    require_expected_head_match: true
    if_head_moved: stop-and-report
    if_pr_body_stale: backfill before merge
```

## Review Finding Necessity Assessment

Automated review finding assessment applies to CodeRabbit, Codex auto review, other automated review tools, and GitHub review bot comments.

Classification:

- `adopted`: finding is a real bug, risk, or repo convention violation and is inside PR scope. Fix it and record implementation / validation evidence.
- `not adopted`: finding is not applicable, harmful, or conflicts with repo design / workflow rules. Leave written technical rationale.
- `optional polish`: finding is reasonable but non-blocking. Explain why it is deferred and whether a follow-up is needed.
- `noise / not applicable`: finding is summary-only, walkthrough-only, no actionable finding, stale, false positive, or out of PR scope. Record why.
- `needs human review`: finding requires human decision, scope expansion, product judgment, or unclear risk tradeoff. Stop-and-report.

Rules:

- CodeRabbit / Codex auto review are auxiliary signals, not approval.
- Only `adopted` findings should be fixed.
- `not adopted`, `optional polish`, and `noise / not applicable` findings still need written rationale.
- `needs human review` blocks merge until human decision.
- Do not create meaningless commit noise solely to satisfy a bot comment.
- Do not resolve conversation without written rationale.
- Summary / walkthrough / no actionable finding may be recorded as `noise / not applicable`.

## Metadata Requirements

This section describes current expected behavior only. It is not a label migration, not a mass-edit plan, and not a replacement for #150 label taxonomy work.

Expected behavior:

- Open issues should have reasonable area / type / status labels when high-confidence classification is possible.
- PRs should generally inherit linked issue roadmap milestone, primary layer label, and reasonable area / type labels.
- PR review stage may use `status:in-review` if scoped and applicable.
- Completed issue should receive `status:implemented`.
- Active status labels such as `status:needs-design`, `status:ready`, `status:blocked`, or `status:in-review` should be removed when completion status is applied, to avoid status conflict.
- Milestone should not be changed casually.
- Missing labels, missing milestones, or insufficient permission should stop-and-report or be recorded as warning.
- Labels do not replace issue body and do not authorize scope expansion.

Relationship to future issues:

- #150 should stabilize label taxonomy before broad label migration.
- #110 may consume this vocabulary for label / milestone audit, but should not mass-edit issues unless separately scoped and approved.
- #147 only documents expected behavior and future consumer relationship.

## Worktree Requirements

Implementation / docs PRs must be worktree-first.

Main repo startup:

```bash
git rev-parse --show-toplevel
git checkout main
git pull
git status
```

Rules:

- Main must be clean and up-to-date before creating the dedicated worktree.
- If main is dirty, stop-and-report.
- Do not automatically `stash`, `clean`, or `reset`.
- Do not checkout over unconfirmed local changes.
- Create a dedicated worktree before implementation.
- Worktree must be clean before editing.
- Commit, push, PR creation, issue evidence comment, and PR body backfill happen from the dedicated worktree / branch.
- Do not delete branch / worktree immediately after merge; leave cleanup for a later centralized cleanup audit with human confirmation.

Design-only future checker fields:

```yaml
worktree_requirements:
  startup_commands:
    - git rev-parse --show-toplevel
    - git checkout main
    - git pull
    - git status
  require_main_clean: true
  require_dedicated_worktree: true
  forbidden_cleanup:
    - automatic stash
    - automatic clean
    - automatic reset
    - branch deletion without cleanup audit
```

## Target Repo / Dogfood Safety

Target repo safety is part of the internal workflow contract because dogfood can easily blur planning, evidence, and implementation boundaries.

Rules:

- Do not modify target repo / tachigo.
- Do not create target repo branch / commit / PR.
- Do not create, copy, or modify target repo `.spec-injector/`.
- If target repo is dirty, only read-only observation is allowed; do not clean it.
- Dogfood / external config should use safe snapshot / external config strategy.
- Any task that requires target repo mutation must stop-and-report.
- Dogfood observations should become follow-up issues or reports, not target repo patches.

Design-only future checker fields:

```yaml
dogfood_safety:
  target_repo_mutation: prohibited
  target_repo_branch_commit_pr: prohibited
  target_repo_spec_injector_copy: prohibited
  dirty_target_repo_policy: read-only observation then stop-and-report
  preferred_strategy:
    - safe snapshot
    - external config path outside target repo
```

## Consumers

Future consumers should wait for #147 vocabulary to stabilize and then split into small, scoped implementation issues.

- #108 preflight checker: consume worktree, branch, main freshness, dirty-state, and stop-and-report vocabulary.
- #109 PR / evidence / HEAD consistency checker: consume PR body, issue evidence, validation, latest HEAD, CI, and backfill vocabulary.
- #110 label / milestone audit checker: consume metadata expectations, current taxonomy, warning / stop-and-report behavior, and #150 relationship.
- #151 second brownfield dogfood checklist: consume target repo / dogfood safety and source trust vocabulary.
- Future [workflow.md](workflow.md) / [validation.md](validation.md) sync: keep prose rules and contract vocabulary aligned.
- `CLAUDE.md` may remain a thin adapter to `AGENTS.md`; if it references this contract later, it should point rather than duplicate.

\#147 itself does not implement any checker. It only designs shared contract vocabulary.

## Internal-only Vs Public Boundary

Classification:

| Category | Meaning | Examples |
| --- | --- | --- |
| Stable internal workflow vocabulary | Safe to reference in docs and future checker design. | risk tiers, PR body requirements, issue evidence requirements, HEAD freshness, review finding classifications. |
| Implementation candidate | Could become future checker config / fixture after a scoped issue. | YAML-like `validation_matrix`, `worktree_requirements`, `metadata_requirements`. |
| Docs-only guidance | Human / AI workflow prose remains canonical until checker exists. | `docs/workflow.md`, `docs/validation.md`, `AGENTS.md`. |
| Not ready | Requires separate design before implementation. | checker execution UX, CI integration, machine-readable storage location, label taxonomy migration. |
| Explicitly prohibited | Must not be implemented through #147. | product-facing JSON output, hosted control plane, merge bot, remediation loop, agent orchestration, hidden LLM, target repo automation, companion / daemon runtime. |

This contract should not become product-facing JSON output. It should not make users think `spec-injector` has a workflow runtime or checker today. Do not write future candidate fields as completed capability.

## Example Contract Snippets

Each snippet below is design-only, not runtime schema, future implementation candidate only.

### Docs-only PR Example

```yaml
example: docs-only PR
design_only: true
not_runtime_schema: true
future_implementation_candidate_only: true
risk_tier: docs-only
changed_files:
  - docs/internal-workflow-contract.md
  - README.md
required_validation:
  - git diff --check
  - markdown sanity check
recommended_validation:
  - pnpm build
  - pnpm test
evidence:
  pr_body:
    require_issue_evidence_url: true
    require_latest_head: true
  issue_comment:
    require_files_changed: true
    require_non_goals: true
stop_and_report:
  - runtime or CLI change appears necessary
  - README rewrite expands beyond source issue
```

### Runtime Behavior PR Example

```yaml
example: runtime behavior PR
design_only: true
not_runtime_schema: true
future_implementation_candidate_only: true
risk_tier:
  - runtime-high-risk
  - classifier-references-template-behavior
required_validation:
  - pnpm build
  - pnpm test
  - targeted regression
  - mocked gh tests when GitHub output is relevant
  - output review when task package wording changes
evidence:
  require_behavior_summary: true
  require_test_scope: true
  require_snapshot_churn_rationale: true
human_approval:
  before_implementation_if_status_needs_design: true
  before_merge: true
stop_and_report:
  - config schema change required
  - hidden network dependency appears
  - behavior change exceeds source issue
```

### Metadata-only Merge Closeout Example

```yaml
example: metadata-only merge closeout
design_only: true
not_runtime_schema: true
future_implementation_candidate_only: true
risk_tier: merge-metadata-closeout
required_audit:
  - gh pr view
  - gh issue view
  - gh pr checks
  - review conversations
  - CodeRabbit / Codex auto review findings
requirements:
  expected_head_sha: required
  human_merge_authorization: required
  pr_body_evidence_url_current: required
  issue_evidence_comment_exists: required
metadata_after_merge:
  add: status:implemented
  remove_active_status_labels: true
  close_completed_when_applicable: true
stop_and_report:
  - HEAD moved
  - stale PR body evidence
  - needs human review finding remains
  - label or milestone permission missing
```

### Review Finding Follow-up Example

```yaml
example: review finding follow-up
design_only: true
not_runtime_schema: true
future_implementation_candidate_only: true
finding_source:
  - CodeRabbit
  - Codex auto review
classification_allowed:
  - adopted
  - not adopted
  - optional polish
  - noise / not applicable
  - needs human review
rules:
  adopted:
    fix_only_if_in_scope: true
    require_validation: true
    require_written_evidence: true
  not_adopted:
    require_written_rationale: true
  optional_polish:
    require_deferral_reason: true
  noise_not_applicable:
    require_reason: true
  needs_human_review:
    stop_and_report: true
forbidden:
  - resolve conversation without written rationale
  - create commit noise for summary-only bot comments
```

### Dogfood Safety Example

```yaml
example: dogfood safety
design_only: true
not_runtime_schema: true
future_implementation_candidate_only: true
risk_tier: target-repo-dogfood
target_repo: tachigo
required_before_run:
  - target repo status read-only check
allowed:
  - read-only observation
  - external config outside target repo
  - report false positives / false negatives
prohibited:
  - target repo branch
  - target repo commit
  - target repo PR
  - copy .spec-injector/ into target repo
  - mutate target repo files
stop_and_report:
  - target repo dirty
  - dogfood requires target repo mutation
```

## Compatibility / Migration Path

Migration should be incremental:

1. Keep `AGENTS.md`, `CLAUDE.md`, [workflow.md](workflow.md), and [validation.md](validation.md) as human-facing canonical prose.
2. Add this contract as shared vocabulary and cross-link from existing docs.
3. Do not move large workflow sections in #147; cross-link first to avoid a large docs rewrite.
4. Let #108 consume only startup / worktree / dirty-state fields.
5. Let #109 consume only PR body / issue evidence / HEAD freshness / CI fields.
6. Let #110 consume only metadata expectations, and coordinate with #150 before label migration or mass edits.
7. Let #151 dogfood checklist reference target repo safety and external config strategy without changing target repo.
8. Only after checker consumers prove the vocabulary stable should a future issue decide whether to encode a machine-readable file, where it lives, and how it is validated.

Do not turn #147 into checker implementation PR. Do not add CI, package scripts, dependencies, JSON schema files, or runtime code while establishing the vocabulary.

## Risks And Non-goals

Non-goals for this PR:

- no checker implementation
- no runtime implementation
- no CLI/config/schema changes
- no CI changes
- no hidden LLM
- no semantic RAG
- no vector DB
- no hosted control plane
- no agent orchestration
- no merge bot
- no remediation loop
- no target repo automation
- no product-facing JSON output
- no companion / daemon runtime
- no plugin system

Risks:

- Over-specifying a contract before #108 / #109 / #110 prove which fields are actually needed.
- Making internal workflow hygiene look like a product moat or hosted harness direction.
- Duplicating `docs/workflow.md` / `docs/validation.md` instead of linking and stabilizing vocabulary.
- Creating a false impression that checkers already exist.
- Encoding current label taxonomy too strongly before #150 is complete.

Mitigation:

- Keep this document design-only.
- Use cross-links instead of large workflow doc rewrites.
- Mark examples as future implementation candidates only.
- Keep product boundary explicit: deterministic request-to-context compiler, not workflow runtime.
