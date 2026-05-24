# AWP Dogfood Outcome Ledger

本文件定義 tachigo / tachiya 等 target repo 使用 AWP + `spec-injector` workflow 後，回收 PR outcome evidence 的最小紀錄 contract。

目的不是把每張 target repo PR 變成 metrics report，也不是把 dogfood ledger 當成 merge approval。它只用來累積真實 PR 樣本，讓下一輪 workflow baseline 調整有 evidence，而不是被單一 PR 的小摩擦牽著走。

## When To Record

只在同時滿足以下條件時記錄：

- PR 是 AWP / autonomous-worker-profile 流程，或明確使用 `spec workflow-check` 作為 start / commit / merge evidence。
- PR 已完成一輪 review closeout，或因 workflow blocker 停在可描述的狀態。
- 紀錄位置在 `spec-injector` 端或 target repo 已核可的 ledger / issue comment；不要把完整 metrics 塞進每張 target repo PR body。

非 AWP PR 不需要填這份 ledger。普通 manual PR 可以只保留原 repo 的 PR evidence。

## Sample Threshold

在調整核心 AWP baseline 前，應先累積至少 5 張 target repo PR outcome sample。

## #258 Freeze Gate

freeze status: active.

Issue #258 freezes the current AWP baseline after #246, #247, and #249. Until the ledger has 至少 5 張真實 AWP PR samples, do not change baseline AWP workflow fields, Worker Profiles tables, `spec workflow-check` CLI flags, JSON schema, exit-code semantics, target repo PR templates, target repo Scope Police rules, or target repo AWP AGENTS sections for non-P0 reasons.

P0 break-glass can bypass the sample gate only when a safety or correctness issue would otherwise mislead merge closeout or block all acceptable workarounds. Ordinary naming preferences, PR body formatting, single-PR review nits, theoretical session security models, or one-off workflow friction should stay in the ledger or a bounded follow-up issue.

Freeze re-evaluation should use ledger data, including:

- `false_blocker_count`
- `evidence_missing_count`
- `review_round_count`
- `ci_rerun_count`
- `total_diff_lines`
- repeated workflow friction across repo / issue type
- any real evidence of forged or misleading session / delegation evidence

Do not change `spec workflow-check` CLI flags, JSON schema, or exit-code meaning from this freeze issue.

Do not implement `spec session`, `workflow-check --session`, hooks, HMAC, external witness, GitHub App bot witness, branch protection required checks, hosted control plane, daemon, dashboard, auto-comment, or auto-merge from this freeze issue. If future evidence supports a v0.2 session artifact, open a separate implementation issue with target repo thin wiring, rollback criteria, migration notes, and explicit non-goals.

未達樣本門檻前：

- P0 blocker 可以立刻修。
- P1 / P2 workflow friction 應先進 follow-up ledger 或 bounded issue。
- 單一 PR 的 nitpick、局部 CI noise、或 reviewer preference 不應直接改核心 baseline。
- 如果樣本都來自同一 repo、同一 issue type、或同一人為操作模式，應標記 sample bias，不要當成跨 repo 結論。

## Minimal Fields

每筆 outcome sample 應保留下列欄位：

```markdown
## AWP dogfood outcome sample

- Target repo:
- Target issue:
- Target PR:
- PR head SHA:
- Workflow date:
- Workflow mode: hybrid_awp / strict_awp / controller_fallback / manual
- `spec-injector` version or commit:
- `spec workflow-check` evidence refs:
  - start:
  - commit:
  - merge:
- Worker routing:
  - expected worker split:
  - actual worker split:
  - missed worker: yes / no / unclear
  - over-delegated worker: yes / no / unclear
  - explicit fallback used: yes / no
- Gate outcomes:
  - workflow-check caught real issue: yes / no / unclear
  - workflow-check false positive: yes / no / unclear
  - workflow-check false negative: yes / no / unclear
  - CI false positive / false negative:
  - Scope Police false positive / false negative:
- Review loop:
  - review rounds:
  - actionable findings count:
  - adopted findings:
  - not-adopted findings with rationale:
  - main rework reason:
- Friction classification:
  - infra complexity:
  - workflow-created friction:
  - model/tool limitation:
  - human policy ambiguity:
- Severity:
  - P0 must-fix:
  - follow-up ledger only:
- Final outcome:
  - merged / closed / blocked / superseded:
  - merge commit or blocker ref:
```

`status/ref` evidence is enough. Downstream Scope Police should not parse full `spec plan` output, task packages, or private AWP ledgers.

## Friction Classification

Outcome analysis must separate the source of friction:

| Classification | Meaning | Example |
| --- | --- | --- |
| Infra complexity | Target repo or CI is inherently complex. | flaky external service, monorepo package boundary, required generated file mismatch |
| Workflow-created friction | AWP / `spec-injector` policy caused extra work. | worker split required when direct controller fix was enough |
| Model/tool limitation | Agent, `gh`, or local tool output was incomplete or unstable. | `gh pr checks` schema drift causing manual fallback |
| Human policy ambiguity | Repo rule or review expectation was not precise enough. | unclear whether Scope Police should accept manual fallback wording |

不要把所有問題都歸咎於模型，也不要把 target repo 本身的複雜度誤算成 workflow baseline failure。

## P0 Must-Fix Signals

下列情況可以在未達至少 5 張 sample threshold 前建立或處理 P0/P1 fix issue：

- `spec workflow-check` 產生 false pass，導致 unsafe merge gate evidence。
- 工具嘗試 GitHub mutation、target repo mutation、auto-merge、auto-comment、或寫入 private/generated output。
- Evidence freshness 無法判斷，且 checker 仍回報 pass。
- Downstream repo 被要求解析 full task package / private context 才能通過 Scope Police。
- AWP routing 明顯漏派必要 worker，且造成 production-facing 或 merge-gate blocker。

這些是 safety / correctness 問題，不需要等樣本數夠才修。

## Follow-Up Ledger Signals

下列情況通常先進 follow-up ledger，不直接改核心 baseline：

- 單一 reviewer preference 或 wording nit。
- 某 repo 的 CI / Scope Police local convention 尚未穩定。
- Worker routing 有輕微 over-delegation，但沒有造成錯誤或重大延遲。
- Manual fallback wording 可以更清楚，但沒有 false pass。
- AWP ledgers 太長、太短、或欄位命名不順，但 downstream 仍能完成 closeout。

這些可以累積至少 5 張 sample 後一起校準。

## Baseline Change Gate

提出 AWP baseline 變更前，應在 issue 或 PR body 中回答：

- 已累積幾張 PR outcome sample？
- 樣本分布在哪些 repo / issue type？
- 觀測到的是 P0 safety issue，還是可累積的 workflow friction？
- 變更是否會讓 downstream repo Scope Police 需要解析更多 evidence？
- 是否能用 docs / template / checker warning 解決，而不用改 CLI behavior？

若答案不足，先保留為 follow-up ledger，不修改核心 AWP baseline。

## Non-Goals

- 不要求每張 target repo PR body 填完整 metrics。
- 不要求非 AWP PR 填 ledger。
- 不把 ledger 當 merge approval。
- 不在 target repo commit `.spec-injector/`、generated output、private context 或 local dogfood notes。
- 不新增 hosted control plane、daemon、dashboard、auto-merge 或 auto-comment。
