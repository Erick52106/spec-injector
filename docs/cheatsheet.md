# Spec-injector workflow cheatsheet（happy path）

## Purpose
這是一份供執行時快速對照的 happy-path 指南，不取代 `docs/workflow.md` / `docs/validation.md`，也不擴大到新 policy。

## When to use this cheatsheet
- 開始一張 issue/PR 流程前的快速記憶提詞
- review 前確認步驟順序
- 需要提醒 review thread / evidence / PR body readback 的 checkpoint
- merge-time 前最後一次 human-readable 自檢

## Happy path
1. sync main
   - `git checkout main`
   - `git pull --ff-only`
   - `git status --short`（確認 clean）
2. create dedicated worktree
   - `git worktree add -b <branch> <path> main`
   - 進入 worktree 確認 `git status --short` clean
3. run preflight
   - 任務 issue / PR file-scope 檢查
   - target repo 是否清楚、是否仍為 read-only
4. run spec plan
   - 使用 external config（如有需要）
   - 使用只讀方式收斂目標參考
5. implement scoped changes
   - 只改允許的檔案
   - 文件更新以 `docs/**` / `AGENTS.md` / workflow docs 為主
6. run validation
   - `git diff --check`
   - `pnpm build`
   - `pnpm test`（按 issue 要求）
7. commit / push / create PR
   - Commit message 依實際規則
   - Push 目標 branch
   - 建立 ready-for-review PR
8. add issue evidence comment
   - 在 source issue 留 implementation evidence comment（繁中）
9. backfill PR body
   - 填入 `issue evidence URL`、`commit hash`、`validation 結果`
10. readback verify PR body / issue evidence
   - `gh pr view <pr> --json body,headRefOid`
   - `gh issue view <issue> --json comments`
11. check CodeRabbit / Codex / human review findings
   - 不當成 approval
   - 僅做狀態盤點
12. classify findings before changes
   - `adopted` / `not adopted` / `optional polish` / `noise / not applicable` / `needs human review`
13. run evidence-check
   - `spec evidence-check --pr <num> --repo <owner/name> --expected-head <sha>`
   - PASS 僅為輔助結果
14. run label-audit when relevant
   - 對照 issue / PR metadata 與 label 規範
15. wait for human merge decision
   - 不代替 human 做 final decision
16. merge-time closeout
   - readback 所有 evidence
   - 確認 no unresolved human-required block
   - 交由 human 作 merge

## Quick validation matrix
- ordinary docs-only (copy/link or wording adjustments):
  - required: `git diff --check`
  - when doc includes markdown links: manual sanity check for broken/bare URLs, obvious path typo, and section consistency
  - quick test command: optional `pnpm test`（僅當文件明示行為驗證）
- workflow-rule / AGENTS / validation / guardrail docs:
  - required: `git diff --check`
  - markdown/link sanity check（含 `docs/**` 參考鏈）
  - consistency readback vs `docs/workflow.md` and `docs/validation.md`（`git diff` 變更核對）
  - `pnpm build`
  - `pnpm test`
  - if PR touches closeout expectations（issue evidence / PR body readback rules）：extra evidence/readback pass
- tests:
  - required when issue scope includes behavior, command output, or runtime
- metadata-only:
  - required: `gh pr view` / `gh issue view` readback（無 repo file change）

## Do not do
- no stash / clean / reset（除非 human 明確授權）
- no target repo mutation（含 commit / push / branch / file edit / `.spec-injector/` / `spec init`）
- no auto-merge / auto-close
- no auto-resolve without written rationale
- no review finding fix without necessity assessment

## Readback checklist
- PR body contains:
  - `Closes #<issue-number>`
  - validation 命令與結果
  - issue evidence comment URL
  - commit hash
  - scope guard / non-goals
- Issue evidence comment 可讀：
  - PR URL
  - branch / commit / files
  - no target repo mutation
- #120 / #149 preserved state（如需求要求）

## Canonical policy links
- 正規規則入口：`docs/workflow.md`
- 驗證規則入口：`docs/validation.md`
- 這份文件僅作為快速執行時使用的 cheatsheet
- workflow-rule 類別的實際驗證邏輯以 `docs/validation.md` 為準，cheatsheet 只保留快速執行提示
