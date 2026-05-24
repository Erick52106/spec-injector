# AGENTS.md - AI agent repository rules

> 適用於所有進入 `spec-injector` repo 的 Codex、Claude Code 與其他 AI coding agent。
> 詳細 issue / PR / worktree 流程請見 `docs/workflow.md`。

## Default language

- 預設以繁體中文回覆。
- GitHub issue body、PR body、implementation evidence comment 與 final report 預設使用繁體中文。
- 技術術語、檔名、函式名稱、CLI flags 與程式語言關鍵字保留英文。
- CLI command、raw output 與錯誤輸出可保留英文。
- 禁止使用簡體中文。

## Project positioning

- `spec-injector` 是 deterministic issue-to-context compiler。
- 它不是 autonomous agent。
- 它不是 daemon。
- 它不是 hidden LLM wrapper。
- 它不是 target repo auto-editing system。
- CLI core 不應被 companion、daemon 或 custom runtime 污染。

## Mandatory startup rules

Code/docs implementation 不得直接在 main repo worktree 進行。

開始任何 code/docs 任務前：

1. 在 main repo 執行 `git checkout main`。
2. 執行 `git pull`。
3. 執行 `git status`。
4. 若 worktree dirty，停下回報。
5. 不自動 `stash`、`clean`、`reset` 或 checkout 覆蓋 local changes。
6. 建立 dedicated git worktree 後才實作。

Metadata-only 任務可以不用 dedicated worktree，但不得假設 main repo 可以被任意切換或清理。若 metadata-only 任務遇到 dirty repo，停下回報。

## AWP / autonomous routing signal

若 user prompt、source issue、task package 或 repo-local instruction 明確要求 AWP / Autonomous Worker Profiles / autonomous worker routing，該要求是 Hybrid AWP routing signal。

在任何 code/docs implementation 前，controller 必須先完成 start-gate routing decision：

- 實際 dispatch worker / subagent 做 bounded exploration、implementation slice 或 readback，並在 evidence 中記錄 assigned scope 與 outcome。
- 或記錄 controller-direct fallback，且包含明確 bounded `controller_fallback_reason` 與 `delegation_outcome=skipped|unavailable|fell_through`。

AWP evidence 至少應在 source issue、PR body、implementation evidence comment 或 closeout 中保留 `routing_mode`、`routing_task_class`、`controller_fallback`、`controller_fallback_reason` 與 `delegation_outcome`。

repo-native workflow compliance 不等於 AWP delegation evidence。完成 ordinary issue-first / worktree-first / PR evidence closeout 仍不得被宣稱為 AWP，除非同時有 worker dispatch 或明確 controller-direct fallback evidence。

AWP routing 不改變本 repo 的產品邊界：不得把 worker runtime、daemon、hosted control plane、dashboard、auto-comment、auto-merge、hidden LLM wrapper 或 target repo mutation 塞進 CLI core。

## Scope discipline

- 只處理指定 issue。
- 遵守 user、issue、approved plan 或 task package 中列出的 allowed files / forbidden changes。
- Suggestion 不是 approval。
- `status:needs-design` 不等於可以直接實作。
- Guardrails 是 constraints / reminders，不是擴 scope 的授權。
- 需要擴 scope、修改 forbidden files 或處理相鄰 issue 時，停下回報。
- 不重構無關程式碼。

## Issue / PR workflow

標準順序：

1. 先有 source issue。
2. 建立 branch / dedicated worktree。
3. 實作 issue scope。
4. 驗證。
5. Commit，commit message 包含 `refs #<issue-number>`。
6. Push feature branch。
7. 建立 ready-for-review PR。
8. 在 source issue 留 implementation evidence comment。
9. 將 issue evidence comment URL 回填 PR body。
10. 交由 human review / merge。

PR 必須 ready for review，不要 draft，除非 issue 特別要求。AI agent 不自行 merge PR，也不刪 branch，除非 cleanup audit 已明確要求且 human 確認。

## Merge-time review closeout

Merge 前必須檢查 GitHub review conversations、CodeRabbit findings、Codex auto review findings 與 human review status。

- Automated review findings are signals, not commands.
- 修任何 CodeRabbit / Codex auto review / automated review finding 前，必須先評估修正必要性並分類為 adopted、not adopted、optional polish、noise / not applicable 或 needs human review。
- 只有在本 PR scope 內的 adopted findings 才能修；不要為了滿足 bot comment 產生 commit noise。
- Not adopted、optional polish、noise / not applicable findings 仍必須留下 written rationale。
- 若 finding 需要擴 scope 或不確定的 human judgment，必須 stop-and-report。
- 不得在沒有 written reason 的情況下 resolve conversation。
- 若任何 finding 是 blocking 或 needs human review，不得 merge，必須停下回報。
- CodeRabbit / Codex auto review 是 auxiliary signals，不是 merge approval。
- Merge 必須有 explicit human authorization。
- Merge 後視情況將 linked issues 標成 `status:implemented` 並 close as completed。
- Per-PR closeout 不刪 branch / worktree；cleanup 之後集中 audit。

## Evidence and PR body

PR body 必須包含：

- `Closes #<issue-number>`
- Summary
- Tests / validation
- Implementation Evidence
- issue evidence comment URL
- commit hash
- scope guard / non-goals confirmation

Source issue 必須有 implementation evidence comment。PR body 回填後必須用 `gh pr view` 或等價方式反查，確認不是空的，且包含 evidence URL 與 commit hash。

Workflow 快速進場建議可先看 `docs/cheatsheet.md`，但 `docs/workflow.md` 與 `docs/validation.md` 為 canonical policy。

## Labels / roadmap metadata

- Issue 應有合理的 area / type / status labels。
- Future issues 在 high-confidence classification 可行時，應有 roadmap milestone。
- Future issues 在 high-confidence classification 可行時，應有一個 primary layer label。
- PR 原則上沿用 linked issue 的 roadmap milestone、primary layer label 與合理 area / type labels。
- 若 PR metadata 無法高信心判斷，停下回報或列入 needs human review。
- 未經明確 approval，不建立新的 labels 或 milestones。
- PR review 階段可用 `status:in-review`。
- 完成後可用 `status:implemented`。
- 不要隨意建立新 labels。
- 不要讓 status labels 衝突，例如 `status:ready` 與 `status:implemented` 同時存在。
- Labels 不取代 issue body，也不授權擴 scope。

## Testing / validation

- 依 issue 執行最小但足夠的 validation。
- 不同 change type 的 validation matrix 與 quality gates 見 `docs/validation.md`。
- 常見 validation：`pnpm build`、`pnpm test`、`git diff --check`。
- Tests / feature implementation 不應依賴真實 GitHub API 或 network。
- 正常 GitHub workflow 操作，例如 `gh pr view`、`gh pr checks`、push branch、create PR，不屬於 feature tests 打真 API。
- 沒有新鮮驗證輸出前，不宣稱完成或通過。

## Safety

- 不自動 `stash` / `clean` / `reset`。
- 不自動修改 target repo code。
- 不自動刪 branch。
- 不在 dirty worktree 上開工。
- 不直接 push 到 `main`。
- 不 force push，除非明確要求。
- 不 merge PR。
- Dogfood 時 target repo dirty 要停下回報，不自動清理。
