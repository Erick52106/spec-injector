# Architecture

## Purpose

本文件說明 `spec-injector` 的核心架構。`spec-injector` 是 deterministic issue-to-context compiler：它把 GitHub issue、repo config、repo docs、source references 與 constraints 編譯成 AI 開工前可直接使用的 task package / prompt。

它不是 autonomous agent、daemon、GitHub automation bot、hidden LLM wrapper、general-purpose RAG system，也不會自動修改 target repo code。

## Pipeline

目前 Layer 1 CLI 的核心 pipeline 是：

```text
GitHub Issue
  -> Issue Loader via gh
  -> Issue Parser
  -> Domain Classifier
  -> Guardrail Matcher
  -> Reference Collector
  -> Task Package Renderer
  -> Markdown task package for Codex / Claude Code
```

### 1. GitHub Issue

Issue 是 pipeline 的主要輸入。issue title、labels、body 會提供 task scope、domain signals、explicit file references、validation hints 與 human constraints。

Issue body 是 source of truth。缺少 labels 不代表可以擴大 scope；labels 只提供輔助分類訊號。

### 2. Issue Loader via gh

`spec plan <issue>` 透過 GitHub CLI `gh` 讀取 issue。除了 `gh` 本身需要連到 GitHub，`spec-injector` core 不會呼叫 LLM、API 或 local model。

這一步的責任是取得 normalized issue data，而不是替使用者做實作決策。

### 3. Issue Parser

Issue Parser 會把 issue 內容轉成後續步驟可使用的 deterministic signals，包括：

- title / labels / body text
- issue body 中明確提到的 repo-relative file paths
- issue checklist 中的 `- [ ]` items

Parser 不會推論 hidden requirements。若 issue 沒有明講，task package 應提醒 implementer 保守處理或回到 human 確認。

### 4. Domain Classifier

Domain Classifier 使用 deterministic keyword scoring 來判斷 issue 可能涉及哪些 built-in domains。它不是 LLM，也不是 architecture decision maker。

目前 classifier 會依 title、labels、body 中的 keyword 命中加權，回傳最多 5 個 domains。詳細原則請見 [classifier.md](classifier.md)。

### 5. Guardrail Matcher

Guardrail Matcher 會依 detected domains 比對 `.spec-injector/config.json` 中 repo-defined guardrails。

Guardrails 是 constraints / reminders，不是 approval。它們提醒 AI implementer 在開始前注意風險，但不授權擴 scope，也不代表可以跳過 human review。

### 6. Reference Collector

Reference Collector 會收集 task package 需要列出的 repo context。Reference taxonomy 詳見 [references.md](references.md)。

目前來源包含：

- built-in core preset reference
- repo `always_read` references
- configured discovery docs
- issue-mentioned references
- auto-discovered docs / source references

Reference collection 是 deterministic context selection，不是 general-purpose RAG，也不會做 embedding search 或 semantic retrieval。

### 7. Task Package Renderer

Renderer 將 normalized issue、detected domains、references、guardrails、missing files 與 validation hints 輸出為 Markdown。

目前支援：

- full task package output
- `--format prompt` 的 implementation plan prompt output

Task package 是 AI 開工前的 structured context，不是 autonomous execution plan，也不包含 hidden LLM reasoning。詳細說明請見 [task-package.md](task-package.md)。

## Determinism Boundaries

Layer 1 deterministic CLI 的邊界：

- 相同 issue content、相同 target repo files、相同 `.spec-injector/config.json`，應產生可重複的分類與 references selection。
- CLI core 不呼叫 LLM / API / local model。
- CLI core 不會自行修改 target repo source code。
- Mutating commands 必須是明確 command 行為，例如 `spec init`、`spec config add/remove always-read`、`spec clean`。
- `spec plan --dry-run` 不寫入 task package。

## Relationship To Layers

這份 architecture doc 聚焦目前可用的 Layer 1 deterministic CLI。

Layer 2 AI workflow 與 Layer 3 future agent interface 的邊界請見 [design/layers.md](design/layers.md)。Layer 2 可以由 AI 使用 task package 產生 implementation plan，但那是 AI workflow，不是 `spec-injector` runtime 自己成為 autonomous agent。

## Non-goals

本 architecture 不包含：

- autonomous code execution
- target repo auto-editing
- custom domains runtime
- hidden LLM / API / local model integration
- daemon / background sync
- GitHub automation bot behavior
- multi-agent runtime
- classifier behavior changes
- task package output behavior changes
- config schema changes
