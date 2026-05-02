# Validation Matrix And Quality Gates

## Purpose

本文件定義 `spec-injector` 不同 change type 對應的 validation matrix 與 merge-readiness quality gates。目標是讓 Codex、Claude Code 與 human reviewer 在每張 PR 都能看到至少要跑哪些檢查、哪些檢查只是建議，以及何時必須 stop-and-report。

本文件是 workflow 規範，不是 automated checker。若某張 issue 需要新增 CI、script、runtime behavior、CLI command、config schema 或測試，該 scope 必須由 source issue 明確授權。

## General Rules

- Required validation 是 merge readiness 的最低門檻；若無法執行，必須在 PR body、issue evidence 與 final report 說明原因。
- Recommended validation 應在成本低或變更風險較高時執行；若 reviewer 要求，應視為該 PR 的 required validation。
- 若 PR 跨多個 change type，必須執行所有相關類型的 required validation；若 requirements 衝突、重疊或不確定，採較嚴格的 validation set，並在 PR body 說明實際採用的 validation 與原因。若無法執行任一 required validation，必須 stop-and-report 或清楚寫明 skipped reason。
- Feature tests 與 implementation 不應依賴真實 GitHub API 或 network。若測試需要 GitHub output，應使用 fixture、fake `gh`、mocked process 或等價 isolation。
- Package installation 與 normal `gh` workflow 是允許的 workflow I/O，例如 `pnpm install --frozen-lockfile`、`gh pr view`、`gh pr checks`、`gh issue comment`、push branch、create PR。這些不是 feature test dependency。
- `gh pr view`、`gh pr checks`、`gh issue comment`、push branch、create PR 是 issue / PR workflow 操作，不代表 runtime 或 tests 可以打真 GitHub API。
- 若 validation 被略過，必須寫明 skipped reason，而不是只寫未執行。
- 若發現需要超出 source issue scope 的修正，停下回報，不要把 validation failure 變成 scope creep。

## Change Type Taxonomy

| Change type | Examples | Default validation stance |
| --- | --- | --- |
| Docs-only changes | README、`docs/**` prose、examples | Markdown and whitespace checks are required; tests are recommended when docs include commands or behavior examples. |
| AGENTS / CLAUDE / workflow rules changes | `AGENTS.md`、`CLAUDE.md`、`docs/workflow.md` | Treat as workflow-affecting; run tests and check instruction consistency. |
| Classifier changes | domain keyword scoring、evidence handling | Full build/test plus targeted classifier regression is required. |
| References / discovery changes | always-read handling、auto-discovery、source taxonomy | Full build/test plus targeted plan output regression is required. |
| Template / task package output changes | prompt output、full task package sections、rendering | Deterministic output and human output review are required. |
| CLI behavior changes | flags、commands、stdout/stderr/exit codes | Build/test plus CLI smoke checks are required. |
| Tooling / package manager / Node changes | `package.json`、lockfile、engines、package manager | Frozen install, build, tests, and CI consistency review are required. |
| CI / automation changes | `.github/**`、check jobs、release automation | Local equivalent validation and CI run inspection are required. |
| Workflow metadata-only changes | issue labels、issue closing、planning issue creation、evidence comments | Confirm no repo file changes and list exact GitHub mutations. |
| Dogfood / target repo evaluation | running `spec plan` against another repo | Report-only, target repo clean check, no target repo implementation. |
| Companion / mascot / future runtime planning | design docs for companion, daemon, UI, agent runtime | Docs / issue planning only unless explicit implementation issue exists. |

## Validation Matrix

### 1. Docs-only changes

Required:

- `git diff --check`
- Markdown sanity check, including code fence parity and heading sanity.

Recommended:

- `pnpm test` when cheap, or when docs include commands, output examples, workflow examples, or user-visible behavior claims.

Review checks:

- Links point to existing docs when possible.
- Docs do not describe future behavior as implemented.
- README changes stay small unless source issue explicitly scopes product narrative rewrite.

### 2. AGENTS / CLAUDE / workflow rules changes

Required:

- `git diff --check`
- Markdown sanity check.
- Verify `AGENTS.md`, `CLAUDE.md`, and `docs/workflow.md` consistency.
- `pnpm test`

Recommended:

- Review for tool-specific instruction drift between Codex, Claude Code, GitHub workflow, and human review expectations.

Review checks:

- `CLAUDE.md` remains an adapter to `AGENTS.md` unless the issue explicitly scopes a Claude-specific delta.
- Startup, worktree, evidence, PR, validation, and stop-and-report rules are not contradictory.
- Workflow rules do not imply hidden runtime automation in `spec-injector`.

### 3. Classifier changes

Required:

- `pnpm build`
- `pnpm test`
- Targeted classifier regression tests.

Required review checks:

- False positives and false negatives are considered and documented when relevant.
- Output remains deterministic.
- No classifier rewrite unless the issue explicitly approves it.
- Generic wording does not become strong domain evidence without explicit test coverage.

### 4. References / discovery changes

Required:

- `pnpm build`
- `pnpm test`
- Targeted references / plan output regression.

Required review checks:

- Source taxonomy remains clear, including built-in preset, repo `always_read`, issue-mentioned, configured docs, and auto-discovered references.
- No regression for previously fixed reference issues, including #82 and #84.
- `docs/superpowers` exclusion does not regress when relevant.
- Auto-discovered references remain context candidates, not edit approvals.

### 5. Template / task package output changes

Required:

- `pnpm build`
- `pnpm test`
- Deterministic output checks.
- Prompt / full output review.

Required review checks:

- Intentional output change is documented in the PR body.
- No unexplained snapshot or assertion churn.
- Prompt output and full output remain clearly separated.
- Task package output does not become an autonomous execution plan.

### 6. CLI behavior changes

Required:

- `pnpm build`
- `pnpm test`
- CLI smoke checks, such as `node bin/spec.js --help` or relevant command help.

Required review checks:

- No hidden behavior change.
- Exit code, stderr, and stdout behavior are documented when changed.
- New command or flag exists only when explicitly scoped by the issue.
- Runtime behavior remains deterministic and inspectable.

### 7. Tooling / package manager / Node changes

Required:

- `pnpm install --frozen-lockfile`
- `pnpm build`
- `pnpm test`
- CI check review.

Required review checks:

- Lockfile changes are intentional and explained.
- `packageManager`, Node version, and engines expectations are consistent.
- GitHub Actions configuration remains consistent with local tooling.
- No new dependency is added without explicit issue scope.

### 8. CI / automation changes

Required:

- Local validation matching the changed job where possible.
- CI run inspection.
- PR body documents workflow impact.

Required review checks:

- No unrelated CI expansion.
- No hidden network dependency in tests.
- Secrets, permissions, triggers, and branch filters are intentionally scoped.
- Any required CI addition outside current issue scope becomes a follow-up issue.

### 9. Workflow metadata-only changes

Examples:

- Issue labels.
- Issue closing or reopening.
- Planning issue creation.
- Evidence comments.

Required:

- Confirm no repo file changes.
- Verify GitHub issue, label, and PR state with `gh issue view`, `gh pr view`, or equivalent commands.
- Final report lists exact GitHub mutations.

Required review checks:

- No issue title or body mutation unless explicitly requested.
- No unintended PR changes.
- No non-target issue close.
- Status labels do not conflict, for example `status:ready` and `status:implemented` on the same open implementation issue.

### 10. Dogfood / target repo evaluation

Required:

- Target repo clean check.
- No target repo implementation.
- Report-only output.
- No automatic `stash`, `clean`, or `reset`.

Required review checks:

- Distinguish observations, false positives, false negatives, and follow-up issues.
- Dogfood does not become target repo implementation.
- Target repo state is reported if dirty, and work stops before running destructive cleanup.
- Follow-up issues are separate from target repo code changes.

### 11. Companion / mascot / future runtime planning

Required:

- Docs / issue planning only unless an implementation issue explicitly exists.
- No daemon, runtime, or UI implementation.
- No CLI core pollution.

Required review checks:

- Future-facing language is clear.
- Low-resource constraints are documented when relevant.
- No hidden LLM or autonomous agent behavior is implied.
- Layer boundaries remain consistent with `docs/design/layers.md`.

## When To Add CI Or A Follow-up Issue

Create or propose a follow-up issue instead of expanding the current PR when:

- Required validation would be valuable as CI, but the current issue does not scope CI.
- Manual regression checks are becoming repetitive, high-risk, or easy to forget.
- A validation failure reveals missing test coverage outside the current issue.
- A docs-only or workflow issue discovers the need for runtime, config schema, CLI, package, or CI changes.

Only add or change CI in the current PR when the source issue explicitly scopes CI / automation work.

## PR Body Validation Reporting

Every implementation PR should report validation in a way reviewer can verify without reconstructing the session.

PR body must include:

- `Closes #<issue-number>`.
- Summary.
- Tests / validation with exact commands and pass / fail result.
- Implementation Evidence.
- Source issue evidence comment URL after backfill.
- Commit hash.
- Scope guard / non-goals confirmation.
- CI checks status or an explicit note that CI was not available / not applicable.
- Explicit skipped reason for any required validation that could not run.

After backfill, use `gh pr view` or equivalent to confirm the PR body is non-empty and contains the evidence URL and commit hash.

## Issue Evidence Validation Reporting

The source issue implementation evidence comment must include:

- Summary.
- Files changed.
- Tests / validation with exact commands.
- Commit hash.
- PR URL.
- Scope boundaries.
- Confirmation of important non-goals, especially runtime code, tests, package files, CI, CLI behavior, and config schema when those are out of scope.

Issue evidence should be posted after the PR exists, then its permanent comment URL should be backfilled into the PR body.

## Merge-readiness Quality Gates

A PR is ready for human review only when:

- PR is ready for review, not draft, unless the issue explicitly says draft.
- PR body includes `Closes #<issue-number>`.
- PR body includes Summary.
- PR body includes Tests / validation with exact commands.
- PR body includes Implementation Evidence.
- Source issue has implementation evidence comment.
- PR body is backfilled with issue evidence URL.
- PR body includes commit hash.
- `gh pr view` confirms PR body is non-empty and contains evidence URL and commit hash.
- CI checks are reported.
- Scope guard confirms non-goals.
- Skipped validation, if any, has an explicit reason.
- If CI should be added or changed, a follow-up issue exists unless the current issue explicitly scopes CI.

Passing tests alone is not enough if evidence, PR body, scope guard, or CI reporting is missing.

## Stop-and-report Conditions

Stop and report instead of continuing when:

- Required validation cannot run.
- Validation fails and the fix would expand scope.
- CI change appears necessary but the issue does not scope CI.
- Tests unexpectedly require real GitHub API or network.
- Main repo or implementation worktree is dirty before starting the relevant phase.
- Main is not synced or cannot be pulled cleanly.
- The change appears to require modifying `package.json`, CI, config schema, or CLI command / flag outside scope.
- The change appears to require runtime code, classifier behavior, task package output, or tests outside scope.
- Target repo is dirty during dogfood.
- Worktree path or branch does not match the source issue plan.
- GitHub permission is insufficient to create the required issue, PR, labels, evidence comment, or PR body backfill.

Stop-and-report should include current branch, worktree path, failed command or blocker, and the smallest clear decision needed from the human.
