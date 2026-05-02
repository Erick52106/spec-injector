# Workflow

## Purpose

本文件說明 `spec-injector` 在 issue-to-PR 流程中的位置，以及 AI agent 應如何使用 isolated git worktree、issue / PR structure、labels、implementation evidence、PR body backfill、review / merge / cleanup rules。

`spec-injector` 負責產生 deterministic task package。AI implementer 與 human review process 負責實作、驗證與 merge decision。Root `AGENTS.md` 是 AI agent 進入 repo 的第一層規範入口；本文件提供詳細流程。

## Worktree-first workflow

Main repo 是 control plane，應保持 clean / synced。Code/docs implementation 不直接在 main repo worktree 做。

每張 code/docs issue / PR 應建立 dedicated git worktree。每個 worktree 對應一條 branch。這讓不同 issue 可以獨立 checkout、test、commit 與 push，而不會互相污染 working tree 狀態。

不同 issue 若檔案範圍不重疊，可以在不同 worktree 併發。共用同一 working tree 時不應併發 code 任務。

Metadata-only 任務原則上不需要 worktree，但 metadata 任務不得依賴切換 dirty repo，也不得自動 stash / clean / reset main repo。

## Standard startup sequence

Code/docs implementation 的標準啟動流程：

```bash
git checkout main
git pull
git status
```

若 main repo worktree dirty，必須 stop-and-report，不自動 `stash`、`clean`、`reset` 或 checkout 覆蓋 local changes。

Main repo clean 且 synced 後，建立 dedicated worktree：

```bash
ROOT=$(git rev-parse --show-toplevel)
mkdir -p "$ROOT/../spec-injector-worktrees"
git worktree add -b <branch-name> "$ROOT/../spec-injector-worktrees/<worktree-name>" main
cd "$ROOT/../spec-injector-worktrees/<worktree-name>"
git status
```

Worktree 狀態必須 clean 才能實作。之後的 edit / test / commit / push / PR 都在該 worktree 內完成。

## Worktree naming

建議命名：

- worktree parent: `../spec-injector-worktrees`
- worktree path: `issue-<number>-<slug>`
- branch name: `<type>/<issue-number>-<slug>`

Examples:

- `docs/123-agent-worktree-workflow`
- `codex/81-dirty-worktree-warning`
- `fix/84-separate-issue-mentioned-auto-discovered-references`

Slug 應短、可讀，並對應 source issue。不要為同一 issue 建立多個語意重複的 worktree。

## Prompt requirements

交給 Codex / Claude Code / 其他 AI agent 的 implementation prompt 應包含：

- issue URL
- branch name
- worktree path or naming rule
- scope
- allowed files
- forbidden changes
- stop-and-report conditions
- validation commands
- PR requirements
- issue evidence comment requirement
- PR body backfill requirement
- final report format
- no branch cleanup during implementation

Prompt 中的 suggestions 不等於 approval。若 prompt、issue、repo instructions 或 human message 互相衝突，停下回報並請 human 決定。

## Issue workflow

標準順序：

```text
GitHub issue
  -> branch / dedicated worktree
  -> implementation
  -> validation
  -> PR
  -> source issue implementation evidence
  -> PR body backfill
  -> review / merge decision
```

Issue body 應包含：

- Goal
- Motivation
- Scope
- Non-goals
- Validation
- Completion criteria

Issue 應有合適 labels。Open implementation issue 進 PR review 後可用 `status:in-review`。Merge / complete 後可用 `status:implemented`。Ambiguous planning issue 應保留 `status:needs-design`，不要把 needs-design 當成 implementation approval。

## PR workflow

PR 必須 ready for review，不要 draft，除非 issue 特別要求。

PR body 必須包含：

- `Closes #<issue-number>`
- Summary
- Tests / validation
- Implementation Evidence
- issue evidence comment URL
- commit hash
- scope guard / non-goals confirmation

PR 建立後要在 source issue 留 implementation evidence comment，再把 issue evidence comment URL 回填 PR body。

回填後必須用 `gh pr view` 或等價方式反查 PR body，確認：

- PR body 非空
- 包含 `Closes #<issue-number>`
- 包含 issue evidence comment URL
- 包含 commit hash
- 包含 validation 結果
- 包含 scope guard / non-goals confirmation

CI 通過後，若 PR checklist 有 CI item，應勾選。AI agent 不自行 merge PR。

## Labels workflow

Issue 應至少有合理 area / type / status labels，依 repo taxonomy。Label taxonomy 見 `docs/conventions.md`。

Rules:

- 不要隨意建立新 labels。
- 若缺 label taxonomy，先開 label taxonomy issue。
- PR review 階段可使用 `status:in-review`。
- Completed issue 可使用 `status:implemented`。
- Closed as `NOT_PLANNED` 不應硬加 `status:implemented`。
- 避免 status labels 衝突，例如 `status:ready` 與 `status:implemented` 同時存在。
- Labels 不取代 issue body，也不授權擴 scope。

## Evidence workflow

Implementation evidence comment 應寫回 source issue，讓 issue 讀者不用只靠 PR diff 才能知道實作結果。

Evidence comment 應包含：

- Summary
- Files changed
- Tests / validation
- Commit hash
- PR URL
- Scope boundaries
- Non-goals confirmation

若 evidence comment URL 需要回填 PR body，先建立 PR，再貼 issue comment，取得永久 comment URL 後更新 PR body，最後反查 PR body。

## Concurrency rules

可併發：

- 不同 worktree。
- 檔案範圍不重疊。
- Metadata-only 任務與 code 任務，但 metadata 任務不應依賴切換 dirty repo。
- Docs planning 與 code implementation，若不碰同檔案。

不可併發：

- 同一 worktree 中多個 code 任務。
- 兩張 PR 都會碰同一批 files，例如 `tests/cli.integration.test.ts`、`src/cli/plan.ts`、`templates`。
- 後一張依賴前一張 merge 的任務。
- Dogfood 依賴安全護欄尚未 merge 時。

若不確定是否會碰同一批 files，先停下回報並等 human 決定。

## Cleanup workflow

不要每張 PR merge 後立刻刪 branch。

每個較大工作階段結束後做 branch / worktree cleanup audit：

1. 列出 local branches、remote branches 與 worktrees。
2. 確認哪些 branch 已 merged。
3. 確認哪些 worktree clean 且不再需要。
4. 向 human 回報 cleanup candidates。
5. 取得 human confirmation 後才刪。

`git worktree remove` 與 `git branch -D` 應只針對已 merge 且確認 safe 的 branch。Remote branch deletion 也應先 audit。不要自動刪不明狀態 branch。

## Safety rules

- 不自動 `stash` / `clean` / `reset`。
- 不自動修改 target repo code，除非 issue 明確要求。
- 不把 suggestion 當 approval。
- 不在 dirty worktree 上開工。
- 不把 GitHub workflow 操作誤認為測試打真 GitHub API。
- Tests / implementation 不應依賴真實 GitHub API 或 network。
- Package install / normal `gh` workflow 操作是 workflow I/O，不是 feature tests 打真 API。
- 不直接 push 到 `main`。
- 不 force push，除非明確要求。
- 不 merge PR。

## Scope guard

Workflow 中每一步都應維持 issue scope：

- 不處理相鄰 issue。
- 不修改 runtime code，除非 issue 明確要求。
- 不修改 classifier behavior，除非 issue 明確要求。
- 不修改 task package output，除非 issue 明確要求。
- 不修改 config schema，除非 issue 明確要求。
- 不新增 CLI command，除非 issue 明確要求。
- 不新增 CLI flag，除非 issue 明確要求。
- 不新增 dependency，除非 issue 明確要求。
- 不新增 LLM / API / local model integration。
- 不自行 merge PR。

若發現需要修改 forbidden files 或擴 scope，停下回報。

## Relationship to `spec-injector`

`spec-injector` 只負責 deterministic context compiler 的部分。Branch、commit、PR、evidence comment、PR body backfill、review、merge 與 cleanup 是 surrounding workflow，不是 CLI core 自動執行的 runtime behavior。

CLI core 不應被 daemon、companion runtime、custom runtime 或 hidden LLM wrapper 污染。Future-facing runtime ideas 應先以 design issue 討論，不應順手塞進 implementation PR。

## Non-goals

本 workflow doc 不實作：

- new CLI command
- new CLI flag
- GitHub bot
- PR automation daemon
- companion runtime
- hidden model integration
- target repo auto-editing
- status JSON runtime
- CI workflow
