# AWP Review Triage and Root-Cause Gates

## Purpose

AWP review triage gates are local-only evidence checks for autonomous PR review follow-up. They help a controller batch review findings by the reviewed head SHA, collapse duplicates, decide whether to adopt or reject findings, stop repeated local patch loops, and record final closeout evidence.

This is an evidence contract, not an autonomous remediation system. It does not call GitHub by default, resolve review threads, comment, auto-fix, merge, close issues, generate state machines, or replace human review.

## Applicability

These gates apply only when the workflow has an explicit Autonomous Worker Profiles (AWP), Codex autonomous PR, or equivalent autonomous worker-routing signal.

Non-autonomous and ordinary human PRs must not be required to provide review batch records, root-cause gates, patch budgets, or closeout ledgers. `spec awp-review-check` reports `skipped` when local evidence says the autonomous signal is absent.

## Review Triage Record

Each review finding should normalize to a small local evidence record:

```text
finding_id=<stable id or source/url>
source=coderabbit|codex|human|ci
head_sha=<sha reviewed>
finding_fingerprint=<stable normalized key>
category=correctness|normalization_gap|docs_contract|test_gap|nit|noise
is_outdated=yes|no
duplicate_of=<finding_id or n/a>
adoption_decision=adopt|partial|reject|defer
fix_strategy=local_patch|normalize_state_model|docs_only|test_only|no_change|split_followup
risk_if_local_patch=low|medium|high
validation_required=<commands or n/a>
```

Review batches must include `batch_id`, `review_head_sha`, and `current_head_sha`. Missing head SHA evidence returns `manual`. Stale review evidence fails before patching so the controller can re-verify the finding against the current head.

Duplicate findings should share `finding_fingerprint` and set `duplicate_of=<finding_id>`. Duplicates collapse into one actionable root cause instead of creating multiple patch obligations.

## Root-Cause Gate

When the same file, function, or concept receives a second active edge-case finding, local patching should stop until root cause is explicit.

Required root-cause fields:

```text
module=<path/module or n/a>
concept_key=<normalized concept or n/a>
finding_count_for_concept=<number>
root_cause_assessment=<summary or n/a>
state_model_required=yes|no
matrix_tests_required=yes|no
```

For repeated correctness, normalization, docs-contract, or test-gap findings, a passing gate needs a root-cause assessment and matrix/table-driven test evidence. This prevents repeated parser/gate patches that only satisfy the latest comment.

## Patch Budget

Review follow-up patches should stay proportional to the original PR. The default local patch budget is 30%.

Required patch budget fields:

```text
base_changed_lines=<number>
followup_changed_lines=<number>
budget_ratio=<number>
split_assessment=<summary or n/a>
```

If `budget_ratio` is above `0.30`, `split_assessment` must explain why the current PR should continue or why a follow-up split is needed. Missing diff stats return `manual`.

## Closeout Ledger

Final AWP closeout needs one ledger entry per actionable finding:

```text
finding_id=<stable id or source/url>
source=coderabbit|codex|human|ci
head_sha=<sha reviewed>
disposition=adopted|partial|rejected|deferred|superseded
rationale=<reason or n/a>
validation=<command/ref or n/a>
evidence_ref=<url/path/summary>
```

`partial`, `rejected`, `deferred`, and `superseded` require a rationale. Missing disposition for an actionable finding fails or returns manual depending on the available evidence.

Downstream PR bodies do not need to inline the full ledger. They can reference a stable local, PR-body, or issue-comment evidence ref.

## CLI Usage

```bash
spec awp-review-check --repo . --evidence /tmp/awp-review-evidence.json
spec awp-review-check --repo . --evidence /tmp/awp-review-evidence.json --format json
```

The JSON and text outputs include:

- `status=pass|fail|manual|skipped`
- `repo`
- `head_sha`
- `checked_at`
- `missing_fields`
- `warnings`
- `evidence_summary`
- `batch_id`
- `autonomous_signal=present|absent`
- `review_head_sha`
- `current_head_sha`
- `head_freshness=fresh|stale|missing|n/a`
- `actionable_findings`
- `duplicate_findings`
- `manual_findings`
- `review_batch_status`
- `root_cause_status`
- `patch_budget_status`
- `closeout_ledger_status`
- `evidence_ref`

## Non-goals

This gate does not:

- read live GitHub APIs by default
- auto-fix review comments
- auto-resolve review threads
- auto-merge or auto-close
- decide semantic correctness of a patch
- auto-split PRs
- require downstream Scope Police workflows to parse the full ledger
- duplicate tachigo or tachiya repo-specific policy
