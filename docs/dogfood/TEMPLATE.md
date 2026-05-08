# Dogfood Report Template (Read-Only)

> 只做第二階段 Brownfield dogfood 的 read-only report，`spec-injector` 仍維持 deterministic issue-to-context compiler 的定位，不承諾自動修復或 remediation。

## Goal
- 明確記錄指定 issue / request 在目標 repo 的 read-only 驗證結果
- 識別 `spec plan` 與人工作業交界處的真實資訊缺口
- 釐清 true positives、false positives、false negatives，並給出 follow-up 建議

## Target repository
- Name:
- URL:
- Branch / ref tested:
- Commit / HEAD under test:
- Target repo status (clean/dirty):

## Safety checklist
- ☐ target repo remains read-only
- ☐ do not run `spec init` in target repo
- ☐ do not create `.spec-injector/` in target repo
- ☐ do not commit / push / branch in target repo
- ☐ do not modify target repo files
- ☐ do not paste sensitive source content or large private snippets
- ☐ stop if target repo is dirty or uncertain
- ☐ use external config path if repo-specific config is needed
- ☐ record commands run
- ☐ record no target repo mutation

## Inputs
- Source issue / request under test:
- Target repo context snapshot (docs / files opened / constraints):
- Dogfood run arguments or command intent:
- Local constraints (monorepo / permissions / access):

## Commands run
### Preconditions
- `git status` (target repo)
- `pwd` and workspace path

### Commands
- List each command exactly once, preserving redaction for tokens or private paths.

## Environment / tool versions, if known
- Node:
- pnpm:
- OS / shell:
- Runtime env vars:
- External config path (if used):

## Issue / request under test
- Request title:
- Request owner / link:
- Expected evidence scope:
- Linked issue / PR context:

## Expected behavior
- Expected `spec plan` behavior:
- Expected confidence / determinism expectations:
- Expected review thread / findings state assumptions:

## Observed output summary
- Command outputs (sanitized):
- Exit code summary:
- Major observations:
- Confidence flags (if any):

## Source reference precision
- 目標參考是否被成功收斂：
  - 主要參考是否被識別
  - 來源鏈是否有落空
  - 參考順序是否穩定
- 參考 precision / recall 問題摘要：

## Diagnostics quality
- Reported diagnostics 是否具體可操作：
- 失真或過度含糊處：
- 輸出中缺少的關鍵欄位：

## True positives
- 可被實際採納的發現：
- 為何可採納（含證據）：

## False positives
- 可能為誤報的發現：
- 為何判斷為 FP：

## False negatives
- 可能漏掉但重要的現象：
- 漏掉原因（權限、截斷、噪音、流程限制）：

## Scope gaps
- 本次 dogfood 未覆蓋但屬於流程或實作界外的項目：
- 建議拆 issue 的 follow-up：

## Monorepo / brownfield friction
- Monorepo 導覽成本與障礙：
- Brownfield 文件/設定噪音：
- 權限與讀取邊界限制：

## zh-TW / language friction, if any
- 用詞/命名歧義：
- 需求與 CLI output 的語言對齊問題：
- 需要補齊的中英對照：

## Context boundary / truncation / omission observations
- 觀測到截斷 / 省略：
- 忽略區段可能影響判斷的原因：
- 輸出省略的可補充方式：

## AI usability notes
- 對 AI 實作者最有價值的資訊：
- 易讓 AI 進入錯誤假設的段落：
- 可加入的可讀性強化建議：

## Follow-up recommendations
- 建議的新 issue / follow-up:
- 建議修正流程順序：
- 是否建議再跑一次 dogfood（可選）：

## Final verdict
- Verdict: PASS / WARN / FAIL
- Rationale:
- Next action:
- Re-test condition:
- `spec-injector` 影響範圍（僅 workflow insight / 無 runtime mutation）:
