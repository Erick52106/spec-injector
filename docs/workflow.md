# Workflow

## Purpose

本文件說明 `spec-injector` 在 issue-to-PR 流程中的位置，以及 AI agent 應如何使用 isolated git worktree、issue / PR structure、labels、validation matrix、implementation evidence、PR body backfill、review / merge / cleanup rules。

`spec-injector` 負責產生 deterministic task package。AI implementer 與 human review process 負責實作、驗證與 merge decision。Root `AGENTS.md` 是 AI agent 進入 repo 的第一層規範入口；本文件提供詳細流程。

相鄰工具與 roadmap 邊界請見 [docs/positioning.md](positioning.md)。

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

## GitHub language rules

GitHub issue body、PR body、implementation evidence comment、review note 與 final report 預設使用繁體中文。

技術名詞、CLI commands、file paths、raw errors、raw command output、external API names、labels、milestones、commit hash 與必要的英文片段可保留英文。英文應用於精準表達技術內容，不應讓整份 issue / PR / evidence / report 預設變成英文。

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

Issue body 預設使用繁體中文。技術名詞、commands、file paths 與 raw errors 可保留英文。

Issue 應有合適 labels、roadmap milestone 與 primary layer label。Open implementation issue 進 PR review 後可用 `status:in-review`。Merge / complete 後可用 `status:implemented`。Ambiguous planning issue 應保留 `status:needs-design`，不要把 needs-design 當成 implementation approval。

## PR workflow

PR 必須 ready for review，不要 draft，除非 issue 特別要求。

PR body 預設使用繁體中文。技術名詞、commands、file paths、raw errors、external API names 與必要的英文片段可保留英文。

PR 原則上沿用 linked issue 的 roadmap milestone、primary layer label 與合理 area / type labels。若 linked issue 缺少 metadata，PR 作者應在 final report 標記 follow-up；若目前 scope 明確允許 metadata 修正，才可補上。若 PR 對應多個 issues，選擇主要 milestone / layer，並在 PR body 說明判斷。若 PR 沒有 linked issue，但 scope 可高信心分類，依實際變更套用 metadata；無法高信心判斷時列入 needs human review，不要硬套。

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

## Validation matrix

不同 change type 的 required validation、recommended validation、quality gates 與 stop-and-report conditions 見 `docs/validation.md`。

Implementation prompt、PR body 與 issue evidence 應依該 matrix 回報實際執行的命令、結果、skipped reason 與 scope guard。

## Labels workflow

Issue 應至少有合理 area / type / status labels，依 repo taxonomy。Label taxonomy 見 `docs/conventions.md`。

Rules:

- 不要隨意建立新 labels。
- 若缺 label taxonomy，先開 label taxonomy issue。
- PR 應有合理 area / type labels；若 linked issue 有可沿用的 area / type labels，原則上沿用。
- PR review 階段可使用 `status:in-review`。
- Completed issue 可使用 `status:implemented`。
- Closed as `NOT_PLANNED` 不應硬加 `status:implemented`。
- 避免 status labels 衝突，例如 `status:ready` 與 `status:implemented` 同時存在。
- Labels 不取代 issue body，也不授權擴 scope。

## Roadmap milestones and layer labels

Roadmap milestone 表示主要 roadmap phase。Primary layer label 表示主要系統層。每個 issue / PR 原則上只使用一個 roadmap milestone 與一個 primary layer label；跨層工作應選主要責任層，並在 PR body 說明判斷。

Fixed roadmap milestones:

- `Layer 1 — Core Compiler`
- `Layer 2 — Workflow Guardrails`
- `Layer 3 — Protocolization`
- `Layer 4 — Companion UX`

Fixed layer labels:

- `layer1 : Core Compiler`
- `layer2 : Workflow Guardrails`
- `layer3 : Protocolization`
- `layer4 : Companion UX`

Layer definitions:

- `Layer 1 — Core Compiler` / `layer1 : Core Compiler`: 核心 deterministic issue-to-context compiler。包含 issue parsing、domain classifier、references / discovery core behavior、guardrails、safeReadFile、template rendering、task package output、CLI plan output、output correctness、core tests supporting compiler correctness。
- `Layer 2 — Workflow Guardrails` / `layer2 : Workflow Guardrails`: 讓 core compiler 能安全、高速、可併發使用的 workflow / validation / evidence / worktree guardrails。包含 AGENTS.md / CLAUDE.md、isolated worktree workflow、validation matrix / quality gates、dirty target repo warning、dogfood、PR evidence workflow、issue label audit、worktree preflight checks、PR / evidence consistency checker、workflow metadata cleanup、CI / automation if primary goal is workflow guardrail。
- `Layer 3 — Protocolization` / `layer3 : Protocolization`: 把 taxonomy / workflow 規則升級為穩定 catalog / protocol / machine-checkable contract。包含 catalog / protocol design、domain catalog、reference source catalog、guardrail catalog、task package section catalog、schema / compatibility rules、machine-checkable contract design、stable type naming、public vs internal contract boundaries。
- `Layer 4 — Companion UX` / `layer4 : Companion UX`: Companion mascot / status layer / workflow observability UX。包含 companion mascot design、workflow status event schema、daemon / status runtime exploration、local status watcher、Tauri / browser overlay / local widget exploration、low-resource companion runtime、visual / mascot status layer planning。

Rules:

- Issue 建立時，若 high-confidence classification 可行，應套用合理 roadmap milestone 與一個 primary layer label。
- PR 原則上沿用 linked issue 的 roadmap milestone 與 primary layer label。
- 若 linked issue 缺 milestone、primary layer label 或合理 area / type labels，PR 作者應在 final report 標記 follow-up；若 scope 明確允許 metadata 修正，才可補上。
- 若 PR 對應多個 issues，選擇主要 milestone / layer，並在 PR body 說明。
- 若 PR 沒有 linked issue，依實際 scope 高信心套用；無法判斷則列入 human review。
- 不要同時套多個 layer labels，除非 human 明確要求。
- Layer label 不是 area label 的替代品；area / type / status labels 仍應維持。
- Milestone 不是 status label 的替代品；workflow state 仍由 status labels 與 PR state 表示。
- 不要建立或提倡 `L1.5`、`Layer 1.5`、`layer1.5`、`layer:1`、`layer:1-core`、`layer:core` 或其他語意模糊 layer labels。
- Closed as `NOT_PLANNED` 的 issue 仍可有 milestone / layer label 方便查詢，但不應硬套 `status:implemented`。

## Evidence workflow

Implementation evidence comment 應寫回 source issue，讓 issue 讀者不用只靠 PR diff 才能知道實作結果。

Implementation evidence comment 預設使用繁體中文。技術名詞、commands、file paths、raw errors、raw command output、commit hash 與 PR URL 可保留英文。

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
