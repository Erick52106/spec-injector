# Workflow

## Purpose

本文件說明 `spec-injector` 在 issue-to-PR 流程中的位置。`spec-injector` 負責產生 deterministic task package；AI implementer 與 human review process 負責實作、驗證與 merge decision。

## Standard Flow

```text
GitHub issue
  -> spec plan / task package
  -> AI implementation plan
  -> human approval
  -> AI implementation
  -> validation
  -> PR
  -> source issue implementation evidence
  -> PR body backfill
  -> review / merge decision
```

## Step-by-step

1. 確認 source issue。
2. 同步 target repo branch state。
3. 執行 `spec plan <issue> --repo . --dry-run --format prompt --verbose`。
4. AI 依 task package 草擬 implementation plan。
5. Human approve plan。
6. AI 建立 feature branch。
7. AI 只修改 approved scope 內檔案。
8. AI 執行必要 validation。
9. AI commit，commit message 包含 `refs #<issue-number>`。
10. AI push feature branch。
11. AI 建立 ready-for-review PR。
12. AI 在 source issue 留下 implementation evidence comment。
13. AI 將 evidence comment URL 回填 PR body。
14. AI 用 `gh pr view` 或等價方式重新讀取 PR body，確認內容完整。
15. Human / reviewer 決定 review、merge 或要求修改。

## PR Requirements

PR 應為 ready for review。除非 issue 特別要求，不要建立 draft PR。

PR body 應包含：

- `Closes #<issue-number>`
- Summary
- Docs / validation
- Implementation Evidence section
- issue evidence comment URL
- commit hash
- scope guard / non-goals confirmation

若 PR template 有 checklist，且相關項目已驗證通過，應勾選，不要留下已完成項目的空 checkbox。

## Implementation Evidence

Implementation evidence comment 應寫回 source issue，讓 issue 讀者不用只靠 PR diff 才能知道實作結果。

Evidence comment 應包含：

- Summary
- Files changed
- Docs / validation
- Commit hash
- PR URL
- Scope boundaries
- explicit non-goals confirmations

## PR Body Backfill

取得 issue evidence comment 的永久連結後，應回填 PR body 的 Implementation Evidence section。

回填後必須重新讀取 PR body，確認：

- PR body 不是空的
- 包含 `Closes #<issue-number>`
- 包含 Implementation Evidence
- 包含 issue evidence comment URL
- 包含 commit hash
- 包含 docs / validation

## Scope Guard

Workflow 中每一步都應維持 issue scope：

- 不處理相鄰 issue
- 不修改 runtime code，除非 issue 明確要求
- 不修改 classifier behavior，除非 issue 明確要求
- 不修改 task package output，除非 issue 明確要求
- 不修改 config schema，除非 issue 明確要求
- 不新增 CLI command，除非 issue 明確要求
- 不新增 LLM / API / local model integration
- 不自行 merge PR

## Relationship To `spec-injector`

`spec-injector` 只負責 deterministic context compiler 的部分。Branch、commit、PR、evidence comment、PR body backfill 與 merge decision 是 surrounding workflow，不是 CLI core 自動執行的 runtime behavior。

## Non-goals

本 workflow doc 不實作：

- new CLI command
- GitHub bot
- PR automation daemon
- hidden model integration
- target repo auto-editing
- CI workflow
