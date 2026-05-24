# Dogfood

## Purpose

Dogfood 是用 `spec-injector` 處理真實 target repo issue，以驗證 context selection、classifier domains、references 與 guardrails 是否對實際工作有幫助。

Dogfood 不等於直接實作 target repo issue。它是一種觀察與校準流程。

AWP / `spec workflow-check` target PR outcome 的跨 repo 回收欄位與 #258 freeze gate，請見 [AWP Dogfood Outcome Ledger](awp-dogfood-outcome-ledger.md)。該 ledger 用於累積至少 5 張真實 PR outcome 後再調整核心 AWP baseline；它不是 merge approval，也不要求 target repo PR body 塞完整 metrics。

## Reports

- [Hono 2026-05-14 third brownfield dogfood](dogfood/hono-2026-05-14.md): read-only WARN evidence for `honojs/hono#4916`, with strong issue-mentioned source capture but caveated auto-discovery / classifier precision.
- [Vitest 2026-05-09 second brownfield dogfood](dogfood/vitest-2026-05-09.md): read-only WARN evidence for `vitest-dev/vitest#10280`, with monorepo/path-shape caveats.

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
5. 若 clean target repo 沒有 `.spec-injector/config.json`，準備 target repo 外部的 config file path。
6. 執行 `spec plan <issue> --repo <target-repo> --config <external-config.json> --dry-run --format prompt --verbose`。
   - 若 target repo 已有可使用的 `.spec-injector/config.json`，可省略 `--config`，維持預設讀取行為。
   - `--config` 只讀取指定檔案；不要把 `.spec-injector/` 複製或建立到 target repo。
   - Read-only dogfood 應保留 `--dry-run`，避免產生 task package output。
7. 保存或摘要 output。
8. 分析 observations、false positives、false negatives、follow-up issues。
9. 不直接修改 target repo code，除非另有 approved implementation plan。

## Reviewed External Config Snapshot Workflow

### Purpose

Reviewed external config snapshot workflow 的用途，是讓 dogfood 可以在 clean target worktree 上執行，同時不要求 target repo 已經 commit `.spec-injector/config.json`。

這個 workflow 讓 `spec plan` 透過 `--config <external-config-path>` 讀取 target repo 外部的 current v2 config snapshot。它不修改 target repo，不建立 target repo config，也不把 `.spec-injector/` 複製到 target repo。

### When To Use

適用情境：

- target repo 尚未 committed `.spec-injector/config.json`
- target repo 只有 legacy `rules.json`、local config 或未 review 的設定，但 dogfood 不能污染 clean target worktree
- 需要 repeatable read-only dogfood，而不是一次性口頭流程
- target repo dirty，必須改用 clean dogfood worktree 搭配 external config snapshot

若 target repo 已有 committed 且可使用的 `.spec-injector/config.json`，可以維持預設 config 讀取行為，不一定需要 external config snapshot。

### Required Safety Rules

Reviewed external config snapshot dogfood 必須遵守：

- 不要修改 target repo
- 不要複製 `.spec-injector/` 到 target repo
- 不要在 target repo 建立 config
- 不要 stash / clean / reset / checkout target repo
- 不要在 target repo 建 branch / commit / PR
- 如果 dogfood 需要修改 target repo 才能跑，必須停下回報

這些規則同時適用 original target repo 與 clean dogfood worktree。Clean dogfood worktree 是 read-only input，不是用來承載臨時 config 的位置。

### Snapshot Location

External config snapshot 應放在 target repo 之外。路徑可以是 temporary location，也可以是明確的 external config snapshots 目錄，例如：

```text
/tmp/spec-injector-dogfood/<project>-<issue>.config.json
```

或：

```text
<outside-target-repos>/spec-injector-config-snapshots/<project>/<issue>.config.json
```

Temporary snapshot 可用於一次性 dogfood，重點是清楚記錄檔案位置與來源，並確認路徑不在 target repo 內。

Reviewed snapshot 則應額外記錄來源、用途、config schema version、derive 依據與 review 說明。Reviewed snapshot 適合需要重跑、交接或後續比較的 dogfood。無論 temporary 或 reviewed，都不要把 snapshot 存進 target repo。

### Snapshot Derivation

Derive external v2 config 時，應只讀 inspect 現有資料：

- 只讀 inspect target repo legacy rules、repo docs 或 local config
- 只讀 inspect `spec-injector` config schema、examples 或已 review 的 v2 config pattern
- 將必要設定轉成 current v2 config snapshot
- 不得把 legacy config 原地修改
- 不得自動轉換後寫回 target repo
- 如果無法安全轉換，停下回報，不要猜測或寫入 target repo

Derivation 的輸出應是 target repo 外部的 snapshot file。Derivation 過程不代表 target repo 已接受該 config，也不代表應把該 config commit 回 target repo。

### Required Command Shape

Read-only dogfood 應保留 `--dry-run`，並明確指定 clean target worktree 與 external config path：

```bash
spec plan <issue-number-or-url> \
  --repo <clean-target-worktree> \
  --config <external-config-path> \
  --dry-run \
  --verbose
```

若要產生 prompt-oriented output，可加上：

```bash
--format prompt
```

範例使用 placeholder，實際執行時不要假設某個 local target repo path 固定存在。`--config` 的值必須指向 target repo 外部檔案。

### What To Record In Dogfood Report

Dogfood report 應記錄：

- external config path
- snapshot 如何 derived
- confirmation path is outside target repo
- target repo preflight
- dogfood worktree preflight
- confirmation no target repo modifications
- snapshot 是 temporary 或 reviewed
- follow-up recommendations

若使用 reviewed snapshot，也應記錄 review 依據、適用 issue / project、版本或 schema version，以及任何不確定或需要 human review 的 mapping。

### Relationship To #78

[#78 tachigo #467 dogfood report](https://github.com/Erick52106/spec-injector/issues/78#issuecomment-4364891628) 是 first successful proof：external config snapshot 可以 unblock clean target dogfood，並讓 target repo 維持 unmodified。

#78 驗證了這個 practice 對該次 dogfood 有效。本文件將該 practice formalize 成可重複的 workflow guardrail，但不宣稱 #78 的 findings 永遠適用所有 repos。

### Non-goals

本 workflow 不代表：

- config schema change
- committing config into target repo
- automatic config migration
- daemon / runtime
- hidden LLM / API / local model calls
- target repo automation

### Future Follow-ups

未來可能另行設計：

- reviewed config snapshot registry
- v1 `rules.json` migration design
- external config validation helper
- config snapshot provenance metadata

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

Dogfood finding 何時應轉成 bounded follow-up issue、何時只需 report / docs / metadata evidence，見 [harness-gap-loop.md](harness-gap-loop.md)。

## Non-goals

Dogfood 不是：

- target repo auto-editing
- GitHub automation bot
- hidden LLM evaluation
- full correctness proof
- replacement for tests
- merge approval
