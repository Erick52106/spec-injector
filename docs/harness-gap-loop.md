# Harness Gap Loop

## Purpose

本文件定義 `spec-injector` repo-local 的 harness gap loop policy，用來把 dogfood findings、review blockers、CI failures、production regressions、repeated AI workflow failures、target repo safety near misses 與 evidence freshness gaps，轉成 bounded follow-up issue、narrow fix、validation evidence 與 closeout discipline。

這個 loop 的目的不是把 `spec-injector` 做成 hosted harness platform、remediation bot、merge bot、control plane、daemon、hidden LLM wrapper 或 target repo automation。它只是 `spec-injector` repo 自身的 internal workflow discipline，讓觀察到的缺口不會只留在長對話、PR comment 或一次性狗食報告裡。

相關 vocabulary 與邊界請一併參照：

- [internal-workflow-contract.md](internal-workflow-contract.md)
- [validation.md](validation.md)
- [workflow.md](workflow.md)
- [dogfood.md](dogfood.md)
- [source-trust.md](source-trust.md)
- [input-adapters.md](input-adapters.md)
- [catalog-protocol.md](catalog-protocol.md)
- [product-moat.md](product-moat.md)

## Problem Statement

Dogfood、review、CI、production regression 與 repeated AI workflow failure 會持續產生 findings，但如果 findings 只存在於：

- 長對話
- PR review thread
- CodeRabbit / Codex auto review 摘要
- CI log
- dogfood report
- 臨時 planning note

那它們很容易在 merge 後失去 freshness、失去 evidence link、失去 bounded scope，最後也失去 regression value。

`spec-injector` 需要標準化 gap loop，原因是：

1. finding 需要從一次性 observation 轉成可追蹤的 follow-up issue，而不是留在聊天記憶裡。
2. follow-up issue 需要 bounded scope，避免把「知道有問題」直接膨脹成大改 runtime、CI、automation 或 target repo。
3. follow-up issue 需要 validation / regression evidence，否則同類缺口會反覆出現。
4. closeout 需要 evidence URL、commit hash、PR body backfill 與 freshness discipline，否則 workflow proof 會 stale。
5. 這個 loop 是 repo-local quality discipline，不是產品主軸，不應被描述成 hosted remediation loop。

## Positioning Boundary

Harness gap loop 只描述 `spec-injector` repo 自身如何處理 finding -> follow-up -> evidence 的 discipline。

它不是：

- product-facing harness runtime
- hosted control plane
- remediation automation
- review bot
- merge bot
- issue auto-creation bot
- target repo mutation workflow
- target repo PR generator

它也不授權：

- 自動 push fixes
- 自動 resolve review threads
- 自動 merge
- 自動 close issues
- 自動建立 follow-up issues

## Gap Source Taxonomy

每種 finding source 都應保留 source trust 與 evidence link，並連回 #147 internal workflow contract vocabulary。以下表格中的「blocking / non-blocking」是 default stance；若 issue scope、risk tier 或 human instruction 更嚴格，應採更嚴格判定。

| Source type | Source trust / evidence requirement | Default stance | Regression expectation | Human review | #147 workflow contract connection |
| --- | --- | --- | --- | --- | --- |
| dogfood report | 必須保留 dogfood report URL、target repo snapshot / command、觀察與 false positive / false negative 證據；結論本身最多是 medium / weak，原始觀察比推論更重要。 | 通常 non-blocking；若涉及 repo safety 或 deterministic contract breakage，可升為 blocking。 | 若 finding 指向 repo 內可重現 behavior，預期補 regression；若只是 policy / docs gap，docs evidence 可接受。 | 需要，尤其當 finding 可能擴 scope 或牽涉 target repo safety。 | `target-repo-dogfood` risk tier、target repo safety、diagnostics、follow-up evidence vocabulary。 |
| second brownfield dogfood finding | 必須保留與 #151 checklist 對應的 measurement evidence，標示 `input_kind`、`source_category`、`trust_level`、`budget_policy`、`diagnostics`、`confidence` where relevant。 | non-blocking by default；target repo safety near miss 一律高優先。 | 若 finding 可在 `spec-injector` repo 內重現，預期 regression；否則至少要有 dogfood report / workflow doc update。 | 需要，因為這些 finding 常含 cross-repo judgment。 | #151 consumer path、source trust / budget vocabulary、dogfood safety。 |
| review blocker | 必須保留 PR URL、review thread / review comment URL、具體 blocker 描述。 | blocking。 | 若 blocker 指向 deterministic behavior、validation hole 或 workflow contract hole，通常預期 regression 或 contract evidence。 | 需要；尤其是 needs-human-review blocker。 | review finding assessment、PR body / issue evidence freshness、merge-time closeout。 |
| CodeRabbit / Codex auto review repeated finding | 必須保留 repeated finding 的 thread URL 或至少 PR / commit evidence；不能只憑 bot 摘要推論。 | non-blocking by default；若 repeated finding 指向真 bug 或 safety rule violation，可升為 blocking。 | adopted 且可重現時應補 regression；not adopted / noise 應留下 rationale。 | 需要 necessity assessment。 | `adopted` / `not adopted` / `optional polish` / `noise / not applicable` / `needs human review` vocabulary。 |
| CI failure | 必須保留 run URL、job 名稱、失敗命令、失敗階段與 latest HEAD。 | blocking。 | 若 failure 指向缺 test / matrix gap / stale workflow rule，通常預期 regression test、validation matrix update 或 contract update。 | 通常需要；若只是 flaky / infra，需要 human 判斷是否另開 issue。 | validation state、CI status before merge、HEAD freshness。 |
| production regression | 必須保留 user-visible 或 workflow-visible regression evidence，例如 command、before/after、affected contract。 | blocking。 | 幾乎總是需要 regression test、ordered-output evidence、或 deterministic fixture。 | 需要。 | runtime-high-risk / classifier-references-template-behavior tiers、validation union rules。 |
| repeated prompt / metadata failure | 必須保留實際 prompt / task package / PR body / issue evidence mismatch 的 evidence。 | high priority non-blocking by default；若導致 stale evidence 或 wrong-scope implementation，可 blocking。 | 若 failure 可 deterministic 重演，預期 docs/workflow fix 或 checker follow-up issue；必要時 ordered-output / metadata audit evidence。 | 需要。 | PR body requirements、issue evidence requirements、HEAD freshness、metadata requirements。 |
| target repo safety near miss | 必須保留 dirty repo status、mutation attempt、external config mistake、branch / commit / PR near miss 的 evidence。 | blocking 或至少 high priority non-blocking；默認高優先。 | 通常不需 target repo regression test；需要 workflow / dogfood / safety evidence，必要時 repo-local test or checker follow-up。 | 必須。 | target repo safety、dogfood safety、stop-and-report。 |
| source trust / context budget mismatch | 必須保留具體 source labeling、priority、omitted source、diagnostics、budget downgrade 證據。 | high priority non-blocking by default；若造成錯 scope，可 blocking。 | 若 repo behavior changed or should change, 預期 regression / snapshot / ordered-output evidence；若僅 vocabulary gap，docs update 可接受。 | 需要。 | `source_category`、`trust_level`、`budget_policy`、`diagnostics`、`confirmation_required`。 |
| reference false positive / false negative | 必須保留 issue / request、selected references、missing references 與 deterministic reason。 | high priority non-blocking by default。 | 通常需要 targeted regression，包含 ordered-output、fixture、mocked `gh` test 視情況。 | 需要。 | references / discovery vocabulary、diagnostics、budget handling。 |
| validation matrix gap | 必須保留哪個 change type 缺 rule、哪次 failure 暴露它、目前被漏掉的 command / evidence。 | non-blocking by default；若 gap 導致當前 PR 無法安全 closeout，可 blocking。 | 通常 docs / contract update 即可；若牽涉 runtime output contract，才需要 tests。 | 需要。 | validation matrix、risk tiers、required vs recommended validation。 |
| issue / PR evidence freshness gap | 必須保留 PR body、issue evidence comment、latest HEAD、comment URL、stale commit hash 的 readback 證據。 | blocking for merge closeout；若只是 planning issue，可 follow-up soon。 | 通常 metadata-only closeout 即可；不一定需要 regression test。 | 需要。 | PR body requirements、issue evidence requirements、HEAD freshness expectations。 |

## Severity / Priority Model

Gap loop 使用以下 classification。這是 finding 處理優先級，不等於 GitHub labels taxonomy，也不等於 roadmap milestone。

| Classification | Meaning | Required action |
| --- | --- | --- |
| `blocking` | 若不處理，當前 PR / merge / dogfood / closeout 不應繼續。 | 立即 stop-and-report；只有在 scope 明確且已授權時才直接修。 |
| `high priority non-blocking` | 不一定阻擋當前 merge，但應盡快轉 follow-up issue，避免再次發生。 | 在 evidence 中記錄，通常建立 follow-up issue。 |
| `follow-up soon` | 有明確價值，但不要求同 PR 立即處理。 | 記錄 evidence 與建議 issue split。 |
| `optional polish` | 合理但非必要，不應阻擋 merge。 | 可留 rationale，不一定開 issue。 |
| `noise / not applicable` | 誤報、過期、summary-only、不可採用或不屬 scope。 | 必須留下 rationale，避免無意義 follow-up issue。 |

### Stop-and-report Rules

以下情況至少應列為 `blocking` 並 stop-and-report：

- target repo safety near miss
- unresolved review blocker
- CI failure on required checks
- stale PR body / issue evidence 導致 merge proof 不可靠
- finding 需要擴 scope、改 runtime / CI / config schema / target repo，但 source issue 未授權
- finding 屬於 `needs human review`

以下情況通常可先記錄為 non-blocking follow-up：

- repeated docs vocabulary drift
- validation matrix 少一條文件規範
- dogfood report 的非 safety 類 false positive / false negative
- repeated metadata omission，但已不影響當前 merge

`optional polish` 不應阻擋 merge。`noise / not applicable` 也不應形成 follow-up issue，除非之後累積成 repeated pattern。

## When A Finding Should Become A Follow-up Issue

### Open a Follow-up Issue When

符合越多條件，越適合建立 bounded follow-up issue：

- 有 reproducible behavior、repro command、或明確 stale evidence pattern
- 有 clear source evidence，例如 dogfood report、review thread、CI run、PR body readback、issue evidence comment URL
- scope 可被 bounded 定義，不需要大範圍探索
- 可定義 validation / regression evidence
- 修正後可降低 recurrence
- 不需要修改 target repo 才能驗證
- 屬於 `spec-injector` repo scope，而不是 target repo implementation

常見適合開 issue 的 finding：

- repeated source trust mismatch
- repeated reference false positive / false negative
- validation matrix 漏規範
- PR body / issue evidence / HEAD freshness drift
- target repo safety near miss
- repeated CodeRabbit / Codex docs vocabulary finding with clear repo-local fix

### Do Not Open a Follow-up Issue When

以下情況通常不應開 issue：

- vague preference，沒有可驗證 defect 或 bounded change
- one-off bot noise
- 不可重現 finding
- 超出 `spec-injector` scope
- 需要 target repo mutation 才能完成且未授權
- 提前把 repo-local discipline 想像成 hidden LLM / hosted platform / remediation automation

## Follow-up Issue Template Outline

以下是建議 outline。這是 issue 結構，不是 runtime schema，也不是自動 issue creation contract。

```markdown
## Source finding
- source type:
- source URL:
- observed at:
- current impact:

## Evidence links
- dogfood report / review thread / CI run / PR / comment URL:
- relevant commit / HEAD:
- additional readback:

## Classification
- severity:
- blocking or non-blocking:
- requires human review: yes / no

## Scope
- in scope:
- allowed files or docs:
- explicit boundaries:

## Non-goals
- ...

## Expected fix type
- docs / test / runtime / workflow / metadata

## Expected validation
- commands:
- expected evidence:
- skipped conditions:

## Regression expectation
- regression required: yes / no
- if yes, what kind:
- if no, why docs / metadata evidence is sufficient:

## Target repo safety note
- no target repo mutation required:
- no `.spec-injector/` writes to target repo:

## Related contract / catalog vocabulary
- input_kind:
- source_category:
- trust_level:
- budget_policy:
- diagnostics:
- confidence:
- risk tier:

## Acceptance criteria
- ...
```

## Regression / Evidence Expectation

Gap loop 的重點不是「所有 finding 都要補測試」，而是「每個 finding 都要有對等的 closeout evidence」。

| Situation | Expected evidence |
| --- | --- |
| Repo-local deterministic behavior regression | 應補 regression test，並跑對應 validation。 |
| Docs / workflow policy clarification | docs change + Markdown sanity + relevant validation readback 即可。 |
| Metadata-only freshness gap | 可只做 metadata-only comment / PR body backfill / `gh pr view` readback。 |
| Output wording / section order / contract rendering drift | 視 repo 現有模式補 snapshot 或 ordered-output evidence；避免整份脆弱 snapshot churn。 |
| GitHub issue / PR output related behavior | 若 feature tests 需要 GitHub output，應用 fake `gh` / mocked `gh`，不要打真 GitHub API。 |
| Dogfood observation only | 應更新 dogfood report 或 follow-up issue evidence，不應直接改 target repo。 |
| Target repo safety finding | 不得修改 target repo；用 workflow / docs / follow-up issue closeout。 |

### When Regression Test Is Required

通常需要 regression test：

- production regression
- repeated false positive / false negative with deterministic repro
- repeated output contract bug
- repeated metadata rendering or validation hint bug that can be tested repo-locally
- review blocker 指向實際 behavior defect

### When Docs / Workflow Evidence Is Enough

以下情況 docs / workflow evidence 即可：

- 純 policy / wording / taxonomy clarification
- validation matrix gap
- follow-up issue template refinement
- merge-time closeout rule clarification
- dogfood report interpretation rule clarification

### When Metadata-only Comment Is Enough

以下情況不一定要開 code/docs PR：

- PR body 少 issue evidence URL
- issue evidence comment 缺 latest HEAD 補充
- stale commit hash 需要 backfill
- labels / milestone / status closeout correction

### When Snapshot / Ordered-output Evidence Is Appropriate

以下情況適合：

- task package wording / ordering / section presence 改變
- deterministic output formatting 差異
- prompt / full output contract regression

若只是 docs-only policy PR，通常不需要新增 snapshot；但文件內應清楚指出 future implementation issue 何時需要這類 evidence。

### When Mocked `gh` Tests Are Required

若 follow-up issue 的修正會影響：

- GitHub issue parsing
- PR / issue evidence extraction
- workflow checker future implementation
- output rendering that depends on GitHub payload

則 feature tests 應採 fake `gh` / mocked `gh` output，避免 network dependency。

### When Dogfood Report Update Is Expected

來自 dogfood 的 finding 若被證明有效，至少應：

- 在 dogfood report 中標示 follow-up issue candidate，或
- 在 follow-up issue 中回鏈 dogfood report

如果同時影響 #151 measurement vocabulary，也應在 dogfood report 或 planning note 中標示相關欄位。

## Standard Harness Gap Loop Flow

1. capture finding source
   - 記錄 source type、URL、command、latest HEAD、相關 comment / run link。
2. classify severity
   - 判斷 `blocking`、`high priority non-blocking`、`follow-up soon`、`optional polish`、`noise / not applicable`。
3. decide issue / no issue
   - 套用 follow-up issue criteria；不可因為 bot 發現就自動開 issue。
4. create bounded follow-up issue
   - 只有在明確授權的 normal workflow 下建立；issue 要有 evidence links、scope、non-goals、validation expectation。
5. implement with worktree-first workflow
   - 回到標準 `git checkout main` / `git pull` / `git status` / dedicated worktree 流程。
6. validate
   - 依 [validation.md](validation.md) 與 [internal-workflow-contract.md](internal-workflow-contract.md) 的 risk tier 跑最小但足夠的驗證。
7. add issue evidence comment
   - 留下 PR URL、branch、HEAD、validation 結果、non-goals、follow-up split 說明。
8. PR body backfill
   - 回填 issue evidence comment URL、latest commit hash、validation、scope guard。
9. review finding necessity assessment
   - 對 CodeRabbit / Codex auto review / human review findings 做 `adopted` / `not adopted` / `optional polish` / `noise / not applicable` / `needs human review` assessment。
10. merge-time closeout
   - 檢查 CI、review threads、PR body freshness、issue evidence freshness、human authorization。
11. close source / follow-up relationship
   - 在 source finding、follow-up issue、PR body 或 final report 之間保留可追溯連結。
12. update dogfood / workflow docs if needed
   - 若 finding 暴露 workflow rule、validation matrix、source trust vocabulary 或 dogfood checklist 缺口，再做最小 docs follow-up。

## Relationship To #151 Second Brownfield Dogfood

`#151` 的 dogfood findings 應直接使用本 loop：

- dogfood report 應把每個 finding 標成 follow-up issue candidate，而不是停在 narrative observation。
- findings 應在適用時標示：
  - `input_kind`
  - `source_category`
  - `trust_level`
  - `budget_policy`
  - `diagnostics`
  - `confidence`
- target repo safety near miss 一律高優先。
- dogfood 不應自動開 target repo PR，不應污染 target repo，也不應把 `.spec-injector/` 寫進 target repo。

這代表 #151 的輸出不只是「這次 dogfood 好不好用」，還要回答：

- 哪些 finding 值得轉成 repo-local follow-up issue
- 哪些只是 noise / sample-specific observation
- 哪些與 source trust / context budget vocabulary 有關
- 哪些是 target repo safety signal

## Relationship To #108 / #109 / #110

`#148` 本身不實作 checker；它只定義 findings 如何轉成 bounded issues 與 evidence closeout。

- `#108` 可把 recurring worktree / preflight / stop-and-report failures 視為 checker input。
- `#109` 可把 issue evidence / PR body / latest HEAD freshness gaps 視為 checker input。
- `#110` 可把 repeated metadata label / milestone / status closeout gaps 視為 checker input。

這些 future checker 只能消費本 loop 與 #147 contract 的 vocabulary；它們不是本 PR scope。

## Review Findings And Automation Boundary

CodeRabbit / Codex auto review finding 不是命令。

處理規則：

- findings 必須先做 necessity assessment
- 只有 `adopted` 才修
- `not adopted`、`optional polish`、`noise / not applicable` 都需要 written rationale
- `needs human review` 必須 stop-and-report

本文件也明確保留 automation boundary：

- supervised remediation loop `#149` 仍暫緩，不在本 PR 實作
- 不自動 push fixes
- 不自動 resolve review threads
- 不自動 merge
- 不自動 close issues
- 不自動建立 issues，除非 future issue 明確授權

## Examples

### Example 1: dogfood finding -> follow-up issue -> regression test

- finding source: `#78` tachigo dogfood report 發現 missing path / path mismatch 類問題
- classification: `high priority non-blocking`
- follow-up decision: 轉成 bounded follow-up issues，例如 `#135`、`#137`
- expected evidence: source report URL、follow-up issue URL、後續 regression / validation evidence
- non-goals: 不修改 target repo、不把 dogfood 直接變成 target repo implementation

### Example 2: CodeRabbit repeated docs vocabulary finding -> docs/workflow follow-up

- finding source: CodeRabbit / Codex auto review repeated 指出 workflow wording 容易被誤讀成 automation approval
- classification: `follow-up soon`；若當前 PR wording 造成 merge risk，可升 `blocking`
- follow-up decision: 建 repo-local docs/workflow follow-up，對齊 vocabulary 與 non-goals
- expected evidence: review thread URL、follow-up PR、Markdown sanity、`pnpm build` / `pnpm test` if applicable
- non-goals: 不把 bot finding 直接當命令、不實作 remediation bot

### Example 3: CI failure caused by missing validation matrix entry -> contract update

- finding source: required validation 在某 change type 未被明確列出，導致 CI / review closeout 反覆漏檢
- classification: `blocking` for current PR closeout，或 `high priority non-blocking` if current PR already safely closed
- follow-up decision: 建 docs/workflow or validation follow-up issue，補 validation matrix / risk-tier wording
- expected evidence: failed job URL、漏掉的 command、更新後的 docs evidence
- non-goals: 不在未授權 issue 內順手新增 CI job 或 checker implementation

### Example 4: target repo safety near miss -> high-priority safety issue

- finding source: dogfood 或 planning 過程差點在 target repo 建 `.spec-injector/`、branch、commit 或 PR
- classification: `blocking` 或至少 `high priority non-blocking`
- follow-up decision: 開 repo-local safety issue，修 workflow docs、dogfood docs、future checker input vocabulary
- expected evidence: target repo status、attempted command / decision point、updated safety wording
- non-goals: 不修改 target repo、不把 safety fix 做成 hidden automation

## Non-goals

本文件與 follow-up issue policy 不做：

- automation implementation
- remediation bot
- hosted harness platform
- control plane
- merge bot
- daemon
- hidden LLM
- target repo automation
- target repo mutation
- CI changes
- CLI changes
- checker implementation
- issue auto-creation in this PR

## Decision Summary

- Harness gap loop 是 `spec-injector` repo-local workflow discipline。
- 它把 finding 轉成 bounded follow-up issue、narrow fix、validation evidence 與 closeout。
- 它沿用 #147 workflow contract 與 #129 / #130 / #107 vocabulary，不再發明第二套語言。
- 它強化 second brownfield dogfood、review closeout 與 future checker 的 evidence discipline。
- 它不把 `spec-injector` 重新定義成 hosted harness、remediation loop 或 target repo automation product。
