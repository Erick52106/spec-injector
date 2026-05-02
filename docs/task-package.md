# Task Package

## Purpose

Task package 是 AI 開工前使用的 structured context。它把 issue、classification、references、guardrails、constraints 與 validation hints 放在同一份 Markdown output 中，讓 Codex / Claude Code 等 AI coding tools 可以先理解工作邊界。

Task package 不是 autonomous execution plan，也不包含 hidden LLM reasoning。

## Current Outputs

目前 `spec plan` 支援兩種主要輸出：

- full task package：預設 Markdown output，可寫入 `.spec-injector/out/issue-<number>-task-package.md`
- prompt output：`--format prompt`，用於 AI 先產生 implementation plan

`--dry-run` 會把 output 印到 stdout，不寫檔。

## Expected Sections

Full task package 目前包含：

- Issue metadata and body
- Classification / detected domains
- Always-Read Files
- Auto-Discovered Documentation
- Auto-Discovered Source Files
- Matched Guardrails
- Rule-Matched Documentation
- Missing Files
- Suggested Verification Checklist

Prompt output 目前包含：

- Issue Summary
- Detected Domains
- Guardrails
- Relevant File References
- Missing Files
- Instructions
- Suggested verification checklist

## Deterministic Output

Task package 應是 deterministic output。給定相同 issue、target repo files 與 `.spec-injector/config.json`，pipeline 應產生穩定的 context selection 與 Markdown structure。

時間戳等 metadata 可能反映當次生成時間；核心 classification、guardrail matching 與 reference selection 應保持 deterministic。

## What It Is For

Task package 適合用於：

- AI implementation planning
- human review of issue scope and context
- identifying missing files
- seeing matched guardrails
- listing relevant references before coding
- preserving repo-defined workflow constraints

## What It Is Not

Task package 不是：

- autonomous execution plan
- approval record
- hidden LLM reasoning
- target repo edit script
- complete dependency graph
- PR body replacement
- CI result
- custom domain runtime output

## Plan Output And Human Approval

在 Layer 2 AI workflow 中，常見流程是：

1. AI 執行 `spec plan <issue> --repo . --dry-run --format prompt --verbose`。
2. AI 根據 prompt output 草擬 implementation plan。
3. Human review / approve plan。
4. AI 才開始修改 target repo。

這個 approval gate 不屬於 Layer 1 CLI 自動執行；它是 AI workflow 的 process rule。

## Hidden Reasoning Boundary

`spec-injector` core 不應把 hidden LLM reasoning 寫進 task package。若 AI 使用 task package 產生 plan，該 reasoning 屬於 AI tool 的 workflow，不是 `spec-injector` runtime output。

未來若增加 JSON / agent-oriented output，也應保持 deterministic、inspectable、reviewable。

## Non-goals

Task package 不應：

- 自動執行 issue
- 自動建立 branch / commit / PR
- 自動修改 source code
- 自動補 labels
- 自動新增 config schema
- 自動呼叫 LLM / API / local model
