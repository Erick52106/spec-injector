# Agent handoff patterns

## Purpose

本文件定義 `spec-injector` 在 human、ChatGPT、Codex、Claude Code 與其他 AI coding agents 之間的 handoff patterns。

目標是讓多 agent / vibe coding / AI 自動化多工協作保持清楚邊界：

- 避免不同 agent 互相覆蓋、重工或擴 scope。
- 避免把 suggestion 當成 approval。
- 避免把 planning output 誤當 implementation permission。
- 讓 `spec-injector` 產出的 deterministic task package / prompt / workflow context 成為 agent handoff 的共同語言。

本文件是 workflow 規範，不是 runtime design。它不實作 agent orchestrator、daemon、自動分派、merge automation、hidden LLM routing、CLI command、CI 或 target repo mutation。

## Roles and responsibilities

### Human

Human 擁有產品與交付責任：

- scope decision
- product direction
- merge decision
- high-risk approval
- final responsibility

當 repo instructions、issue、task package、review suggestion 或 agent 意見互相衝突時，human decision 是最終 gate。

### ChatGPT

ChatGPT 適合負責前段思考與 review synthesis：

- task decomposition
- prompt design
- review synthesis
- roadmap / issue prioritization
- risk analysis

ChatGPT 預設不直接操作 repo、不修改檔案、不 push branch、不建立 PR，也不把自己的建議視為 implementation approval。

### Codex

Codex 適合負責 focused implementation：

- 在 dedicated worktree 中工作
- 依 source issue 與 task package 做小範圍實作
- 執行 tests / validation
- 建立 ready-for-review PR
- 在 source issue 留 implementation evidence comment
- 將 issue evidence comment URL 回填 PR body

Codex 不應把 guardrails、review suggestion 或其他 agent 建議當作擴 scope approval。需要修改 forbidden files、處理相鄰 issue 或碰高風險變更時，必須 stop-and-report。

### Claude Code

Claude Code 優先負責 planning / review 類工作：

- read-only architecture review
- planning review
- PR review
- risk analysis
- design critique

除非 human 明確要求，Claude Code 不預設做高風險 implementation。若被要求實作，仍必須遵守 `AGENTS.md`、`CLAUDE.md`、`docs/workflow.md` 與 `docs/validation.md` 的 worktree-first、scope、evidence、metadata 與 validation 規則。

### Other agents

其他 AI coding agents 可以接收 `spec-injector` task package / prompt 作為 handoff input，但必須：

- 遵守 `AGENTS.md`、`CLAUDE.md`、`docs/workflow.md`、`docs/validation.md` 與 task package 中的 constraints。
- 不把其他 agent 的建議當成 human approval。
- 不自行擴 scope、merge PR、刪 branch、修改 target repo 或加入 hidden runtime。
- 若工具能力、repo 狀態或 instruction priority 不明確，先 stop-and-report。

## Standard handoff flow

標準 handoff 以 source issue 為 scope source of truth：

1. Human 或 ChatGPT 選定 issue，整理 goal、scope、non-goals、allowed files、forbidden changes 與 validation expectation。
2. `spec-injector` 產出 deterministic task package / prompt / workflow context。
3. Codex 讀取 issue、task package 與 repo instructions，從 clean main 建立 dedicated worktree。
4. Codex 在 worktree 中做 issue-scoped implementation，不碰相鄰 issue。
5. Codex 執行 required validation，commit 並 push feature branch。
6. Codex 建立 ready-for-review PR，不使用 draft，除非 issue 明確要求。
7. Codex 在 source issue 留 implementation evidence comment。
8. Codex 將 permanent issue evidence comment URL 回填 PR body，並反查 PR body。
9. Claude Code 或 ChatGPT 可做 read-only review / risk synthesis / PR review。
10. Review agent 提出的 finding 不等於命令；Implementation agent 應先評估 finding necessity，再決定是否修正。
11. Implementation agent 回覆 / 佐證 review findings，並將 adopted、not adopted、optional polish、noise / not applicable 或 needs human review 的分類留下可追查紀錄。
12. Human 做 merge decision；review agent findings、CodeRabbit 或 Codex auto review 不等於 approval。
13. Merge executor 必須在 merge 前執行 `docs/workflow.md` 的 merge-time review closeout，確認 automated review findings 已分類並有佐證。
14. Merge 後進行 metadata closeout；branch / worktree cleanup 需經 audit 與 human confirmation。

`spec-injector` 只產出 handoff artifact。Branch、commit、PR、evidence comment、review、merge 與 cleanup 是 surrounding workflow，不是 CLI core 自動執行的 runtime behavior。

## AWP controller / worker handoff

當 human、source issue 或 repo instruction 明確要求 AWP / Autonomous Worker Profiles / autonomous worker routing 時，standard handoff flow 前要先做 AWP start-gate handoff。repo-native workflow compliance is not delegation proof：issue-first、dedicated worktree、validation、PR body、implementation evidence comment 與 merge closeout 只能證明一般 repo workflow，不代表真的發生 worker routing。

AWP controller 必須在 implementation 前二選一：

- `dispatch worker`：派出 bounded worker / subagent 做 exploration、implementation slice 或 readback，並保存 assigned scope、result summary、closeout status 與 `delegation_outcome=completed|fell_through`。
- `controller-direct fallback`：不派 worker，但在 issue / PR / closeout evidence 中明確記錄 `controller_fallback=allowed`、bounded `controller_fallback_reason` 與 `delegation_outcome=skipped|unavailable`。

Controller 保留 scope、architecture、review 與 merge-gate responsibility。Worker output 是 input，不是 approval；controller 必須獨立 readback diff、tests、GitHub state 與 review findings，才能進入 PR / merge closeout。

這個 handoff 不讓 `spec-injector` 變成 agent orchestrator。它只要求 repo-local AWP work 誠實記錄「有派工」或「明確 fallback」，不得把 ordinary controller-only run 包裝成 AWP。

## Planning vs implementation

Read-only planning 適用於：

- issue 還是 `status:needs-design`
- scope、allowed files、non-goals 或 validation 還不清楚
- 需要 architecture review、risk analysis、roadmap ordering 或 task decomposition
- 需要 human decision 才能選 implementation path
- 發現 repo instructions、issue、task package 或 agent 建議互相衝突

Implementation 適用於：

- human 明確要求實作指定 issue
- branch / worktree / allowed files / forbidden changes 已清楚
- source issue scope 足以支持變更
- main repo 已 clean / synced
- dedicated worktree 已建立且 clean
- validation 與 PR evidence requirements 已明確

`status:needs-design` 不等於可以直接實作。Suggestion 不是 approval。Guardrails 是 constraints / reminders，不是擴 scope permission。

若 implementation 途中需要擴 scope、修改 forbidden files、處理相鄰 issue、修改 runtime / CLI behavior、加入 hidden LLM / API / local model，或改動 target repo code，必須 stop-and-report，等待 human decision。

## Review handoff

PR review agent 應優先檢查：

- Scope 是否只處理 source issue。
- Files changed 是否符合 allowed files / forbidden changes。
- Tests / validation 是否符合 `docs/validation.md`，且 PR body 有 exact commands 與結果。
- Source issue 是否有 implementation evidence comment。
- PR body 是否包含 `Closes #<issue-number>`、evidence URL、commit hash、validation 與 scope guard。
- Labels / milestone / primary layer label 是否合理，且沒有 conflicting status labels。
- GitHub issue / PR body / evidence comment / final report 是否以繁體中文為主。
- 是否維持 target repo safety，沒有自動修改 target repo。
- 是否沒有 hidden LLM / external AI API / local model integration。
- 是否沒有 agent orchestrator、daemon、自動分派、merge automation、CLI behavior change、CI change 或 dependency change，除非 source issue 明確授權。

Review agent 不應直接修改 PR 或 push fix，除非 human 明確要求。Review suggestion / finding 不等於命令，需要 implementation agent 或 human 明確接手，不會自動變成 approval。

Review agent 可以提出 findings、風險與 blocking concerns，但不擁有 merge approval。Implementation agent 必須先評估 finding necessity，再回覆、佐證或修正 review findings；若 finding 需要 human decision，必須 stop-and-report。Human owns merge decision，負責 merge 的 executor 必須先確認 findings 已分類並有佐證，完成 merge-time review closeout，不能把 review summary 或 bot approval 當作 merge authorization。

## Concurrency rules

可併發：

- 不同 dedicated worktree。
- 檔案範圍不重疊。
- Metadata-only 任務與 code 任務，但 metadata-only 任務不得修改 repo files。
- Docs planning 與 code implementation，前提是不碰同一批文件或 source files。

通常不應併發：

- 兩個 code 任務都會碰 `tests/cli.integration.test.ts`。
- 兩個任務都會碰 `src/cli/plan.ts`、templates、classifier、references 或 task package output。
- 兩個 PR 都會改同一批 workflow docs，例如 `AGENTS.md`、`CLAUDE.md`、`docs/workflow.md`、`docs/validation.md`。
- 後一張任務依賴前一張 PR merge。
- Dogfood 任務依賴尚未 merge 的 safety guard、external config、classifier fix 或 references fix。

若不確定是否會重疊，先 stop-and-report，讓 human 決定排序。

## Agent-to-agent communication rules

Codex final report 應整理成 reviewer 可直接接手的格式：

- issue
- branch
- PR
- commit
- validation
- implementation evidence URL
- scope guard / non-goals confirmation
- skipped validation reason, if any

Planning agent 不應把自己的建議當成 implementation approval。Implementation agent 不應把 review suggestion 當成 approval。Review agent 不應把「看起來合理」當成 merge decision。

若多 agent 意見衝突，回到 human decision。Agent 可以整理 tradeoffs、risks 與 recommended option，但不能替 human 做高風險 approval 或 merge decision。

## Language and metadata expectations

GitHub issue body、PR body、implementation evidence comment、review note 與 final report 預設使用繁體中文。

技術名詞、file paths、CLI commands、raw output、error message、commit hash、labels、milestones 與必要的英文片段可保留英文。

PR 原則上沿用 linked issue 的 roadmap milestone、primary layer label 與合理 area / type labels。缺 metadata 時：

- 若 scope 明確允許 metadata 修正，且 repo 已有對應 taxonomy，可以補上。
- 不要建立新 labels 或 milestones。
- 若無法高信心分類或 scope 不允許修正，PR body / final report 應列為 follow-up 或 needs human review。

Status labels 不應衝突。PR review 階段可使用 `status:in-review`；完成後可使用 `status:implemented`。`status:needs-design`、`status:ready`、`status:blocked` 與 `status:implemented` 不應和 review / complete 狀態混用。

## Safety boundaries

Agent handoff 不授權下列行為：

- 不自動 `stash`、`clean`、`reset`。
- 不自動 merge PR。
- 不自動 close ambiguous issue。
- 不自動刪 branch / worktree。
- 不自動修改 target repo。
- 不在 target repo dirty 時繼續 dogfood，也不自動清理 target repo。
- 不把 hidden LLM / API / local model 放進 core workflow。
- 不把 companion、daemon、background worker、自動分派、多 agent runtime 或 merge automation 塞進 CLI core。
- 不新增 CLI command / flag、CI、dependency、config schema 或 classifier behavior，除非 source issue 明確授權。

特別是 tachigo 或其他 target repo dogfood 只能作為 report-only evaluation。除非 source issue 明確要求 target repo implementation，agent 不得修改 target repo code。

## Relationship to existing docs

本文件補充既有規範，不取代它們：

- `AGENTS.md` 是所有 AI agent 進入 repo 的第一層 repo rules。
- `CLAUDE.md` 是 Claude Code adapter，保留 Claude Code-specific deltas。
- `docs/workflow.md` 定義 issue-to-PR、worktree、evidence、metadata、cleanup 與 safety workflow。
- `docs/validation.md` 定義不同 change type 的 validation matrix 與 quality gates。
- `docs/positioning.md` 定義 `spec-injector` 與 adjacent workflows 的產品邊界。

#127、#128、#129、#130、#107 等 positioning / protocol 相關 issue 可作為背景，但不代表 automated orchestration、companion / daemon runtime、Gemma / local small model、JSON agent protocol 或 catalog protocol 已完成。

## Examples

### Codex implementation handoff

Human 指定 issue、branch name、allowed files、forbidden changes 與 validation。Codex 從 clean main 建立 dedicated worktree，實作 docs 或 code 變更，執行 validation，建立 ready-for-review PR，在 source issue 留 implementation evidence comment，回填 PR body，最後回報 issue / branch / PR / commit / validation / evidence / scope guard。

### Claude Code read-only review handoff

Human 請 Claude Code review PR。Claude Code 讀 issue、PR body、diff、validation output 與 evidence URL，檢查 scope、metadata、language、target repo safety 與 non-goals。Claude Code 回報 findings / risks / questions，不直接 push fix，也不把 review suggestion 當成 approval。

### Metadata-only task handoff

Human 指定只調整 issue labels / milestone。Agent 先確認 main repo 狀態，不修改 repo files，使用 existing label taxonomy 更新指定 issue，反查 `gh issue view`，final report 列出 exact GitHub metadata mutations。若需要新 label 或 milestone，停下回報。

### Dogfood report handoff

Human 指定用 `spec plan` 評估 target repo。Agent 先確認 target repo clean，只產出 report-only observation，不修改 target repo code、不修 target repo tests、不自動清理 dirty files。若 dogfood 發現需要 safety guard、external config、classifier fix 或 references fix，另開 follow-up issue 或回報 human decision。
