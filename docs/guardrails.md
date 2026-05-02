# Guardrails

## Purpose

Guardrails 是 repo-defined constraints / reminders。它們在 task package 中提醒 AI implementer：這個 issue 可能觸及某些高風險區域，開始實作前需要保守處理。

Guardrails 不應被當成 approval，也不應讓 AI 自行擴大 scope。

## Configuration

Guardrails 設定於 target repo 的 `.spec-injector/config.json`：

```json
{
  "guardrails": [
    {
      "id": "database-change",
      "when_detected": ["database"],
      "risk": "Database/schema changes require explicit issue scope and migration review."
    }
  ]
}
```

欄位意義：

- `id`: stable guardrail identifier
- `when_detected`: detected domains 中任一 domain 命中時觸發
- `risk`: 顯示在 task package 的 reminder

## Matching Model

目前 matching model 很單純：

1. Domain Classifier 從 issue 取得 detected domains。
2. Guardrail Matcher 讀取 repo config。
3. 若 guardrail 的 `when_detected` 包含 detected domain，就加入 task package。

這是 deterministic matching，不是 policy engine，也不是 LLM review。

## How AI Implementers Should Use Guardrails

AI implementer 應把 guardrails 視為開工前的風險提醒：

- 檢查 issue 是否真的授權相關修改。
- 若需要 migration、security review、breaking change 或 data handling change，先回報。
- 在 implementation plan 中列出 guardrail impact。
- 在 PR body / implementation evidence 中說明 scope boundaries。

Guardrails 不應被解讀為：

- 可以修改相關 domain 的所有檔案
- human 已批准 risky change
- 可以跳過 tests 或 review
- 可以處理相鄰 issue

## Examples

Database guardrail：

```json
{
  "id": "database-change",
  "when_detected": ["database"],
  "risk": "Database/schema changes require explicit issue scope and migration review."
}
```

Auth guardrail：

```json
{
  "id": "auth-sensitive",
  "when_detected": ["auth"],
  "risk": "Auth changes must preserve session and permission boundaries."
}
```

Docs guardrail：

```json
{
  "id": "docs-only",
  "when_detected": ["docs"],
  "risk": "Docs issues should not modify runtime behavior unless explicitly approved."
}
```

## Relationship To Classifier

Guardrails depend on detected domains, so classifier false positives can create extra reminders and false negatives can miss reminders.

Extra guardrails should usually be treated as harmless caution. Missing guardrails should be handled through better issue wording, config updates, classifier improvements, or follow-up issues.

## Non-goals

Guardrails are not:

- approval workflow
- blocking policy engine
- runtime permission system
- replacement for code review
- custom domains runtime
- automatic task planner
