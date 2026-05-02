# Dogfood

## Purpose

Dogfood 是用 `spec-injector` 處理真實 target repo issue，以驗證 context selection、classifier domains、references 與 guardrails 是否對實際工作有幫助。

Dogfood 不等於直接實作 target repo issue。它是一種觀察與校準流程。

## What Dogfood Checks

Dogfood report 應觀察：

- detected domains 是否合理
- guardrails 是否有幫助
- `always_read` 是否提供必要 repo instructions
- issue-mentioned references 是否被收集
- auto-discovered references 是否 relevant
- missing files 是否揭露 config 或 issue 問題
- prompt output 是否足以支援 implementation planning

## Safe Workflow

建議流程：

1. 確認 target repo。
2. 檢查 target repo branch 與 worktree。
3. 如果 target repo dirty，停下回報。
4. 不自動 stash / clean / reset。
5. 執行 `spec plan <issue> --repo <target-repo> --dry-run --format prompt --verbose`。
6. 保存或摘要 output。
7. 分析 observations、false positives、false negatives、follow-up issues。
8. 不直接修改 target repo code，除非另有 approved implementation plan。

## Dirty Worktree Rule

若 target repo worktree 不是 clean：

- 停下回報 current status。
- 不自動 stash。
- 不自動 clean。
- 不自動 reset。
- 不 checkout 覆蓋 local changes。

這條規則保護 human 或其他 agent 的未提交變更。

## Report Structure

Dogfood report 建議包含：

```markdown
## Observations

- ...

## False positives

- ...

## False negatives

- ...

## Follow-up issues

- ...

## Scope boundary

- This dogfood run did not implement the target repo issue.
- No target repo code was modified.
```

## False Positives

False positives 是 task package 納入了不相關或低價值 context。

常見原因：

- generic wording 命中太多 docs
- filename 與 issue keyword 巧合相同
- auto-discovery scan scope 太廣
- classifier domain 太泛

處理方式可以是調整 issue wording、調整 config exclude、改善 scoring，或開 follow-up issue。

## False Negatives

False negatives 是 task package 遺漏了重要 context。

常見原因：

- issue 沒有提到關鍵 path / domain wording
- `always_read` config 不完整
- discovery source paths 太少
- max docs / max source files 太低
- classifier keyword coverage 不足

處理方式可以是補 issue references、更新 `always_read`、調整 discovery config，或提出 classifier / references follow-up。

## Relationship To Implementation

Dogfood 可以支援 implementation planning，但不取代 approved plan。若 dogfood 發現真正需要修改 runtime code、classifier behavior、task package output、config schema 或 CLI command，應另開或回到對應 issue，不應在 dogfood report 中順手實作。

## Non-goals

Dogfood 不是：

- target repo auto-editing
- GitHub automation bot
- hidden LLM evaluation
- full correctness proof
- replacement for tests
- merge approval
