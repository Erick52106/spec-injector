# Core Concepts

## Purpose

本文件定義 `spec-injector` 文件與 issue 討論中常用的核心概念。目標是讓 contributor 與 AI coding agent 使用同一套語彙，避免把 deterministic context compiler 誤解成 autonomous agent。

## Issue

Issue 是 GitHub issue，也是 `spec plan <issue>` 的主要輸入。Issue title、labels、body 會提供 scope、keywords、file references、constraints 與 validation hints。

Issue body 是 source of truth。若 conversation、labels 或 generated context 與 issue body 衝突，應回到 issue body 與 human decision。

## Issue-scoped Context

Issue-scoped context 是為單一 issue 收集的最小必要背景。它應幫助 AI implementer 開工前理解 scope，而不是替 issue 以外的工作創造理由。

Issue-scoped context 可能包含：

- issue summary
- detected domains
- guardrails
- references
- missing files
- suggested validation checklist

## Deterministic Compiler

Deterministic compiler 指 `spec-injector` 的核心定位：把 issue 與 repo-defined context 編譯成 structured Markdown output。

它的重點是 repeatable、config-driven、repo-safe：

- 不呼叫 hidden LLM / API / local model
- 不做 autonomous execution
- 不修改 target repo code
- 不把 suggestions 當成 approvals

## Domain

Domain 是 issue 可能涉及的技術或產品區域，例如 `frontend`、`backend`、`database`、`wallet`、`docs`、`ci`。

目前 runtime 使用 built-in domains。Repo-local custom domains 是 future-facing design，尚未作為 runtime schema / classifier behavior 實作。

## Domain Classifier

Domain classifier 是 deterministic keyword / evidence based classifier。它根據 issue title、labels、body 中的 signals 選出 relevant domains。

Classifier 的目標是協助 context selection 與 guardrail matching，不是替 human 或 architect 做最終設計決策。

## Classifier Evidence

Classifier evidence 指讓某個 domain 被判定 relevant 的 deterministic signals，例如：

- title keyword
- label keyword
- body keyword
- future path / config signals

目前 CLI 會輸出 detected domains，但尚未在 task package 中完整揭露 detailed classifier evidence。更完整的 evidence visibility 屬於 future-facing work，不能在目前文件中假裝已完成。

## Guardrail

Guardrail 是 repo-defined constraint / reminder，設定於 `.spec-injector/config.json`。當 detected domains 命中 `when_detected`，相關 risk message 會進入 task package。

Guardrail 不是 approval，也不授權 AI 擴大 scope。它的作用是提醒 implementer 在修改前注意風險。

## Reference

Reference 是 task package 中列出的 repo context。Reference 可以是 docs、source files、built-in preset 或 issue 明確提到的檔案。

Reference 是 context，不是指令本身。AI implementer 仍必須遵守 issue scope、repo instructions 與 human approval。

## Built-in Preset Reference

Built-in preset reference 是 `spec-injector` package 內建的固定文件。目前 core preset 是 `presets/core/ai-collaboration.md`，會被加入 always-read context。

Built-in preset 用來提供 AI collaboration baseline，不代表 target repo 可以被自動修改。

## Repo Always-read Reference

Repo `always_read` reference 是 target repo 在 `.spec-injector/config.json` 中明確設定每次都應讀取的文件。

常見例子包含 `AGENTS.md`、`CLAUDE.md`、security docs、architecture docs 或 team workflow docs。

## Issue-mentioned Reference

Issue-mentioned reference 是 issue body 中明確提到的 repo-relative path，例如 ``src/cli/plan.ts`` 或 ``docs/security.md``。

這類 references 通常比 auto-discovered references 更接近 issue intent，但仍不代表可以修改 scope 外檔案。

## Auto-discovered Reference

Auto-discovered reference 是 CLI 依 issue keywords 與 repo scan deterministic scoring 找到的 docs 或 source files。

它是候選 context，不是完整 dependency graph，也不是 semantic RAG result。False positives / false negatives 應透過 follow-up issue 或 config 調整處理。

## Task Package

Task package 是 AI 開工前的 structured context。它可以包含 issue、classification、references、guardrails、missing files 與 validation hints。

Task package 不是 autonomous execution plan，也不包含 hidden LLM reasoning。詳見 [task-package.md](task-package.md)。

## Plan Output

Plan output 是 `spec plan` 產生的 Markdown output。Full output 可寫入 `.spec-injector/out/issue-<number>-task-package.md`；prompt output 可用於 AI 先產生 implementation plan。

Prompt output 不是 `/spec-plan` CLI command；`/spec-plan` 是 Layer 2 AI workflow shorthand。

## Dogfood

Dogfood 指用 `spec-injector` 處理真實 target repo issue，觀察 context selection 是否準確。

Dogfood 不等於直接實作 target repo issue。若 target repo worktree dirty，應停下回報，不應自動 stash / clean / reset。

## Target Repo

Target repo 是 `spec plan --repo <path>` 指定要讀取 config、docs 與 source references 的 repository。

`spec-injector` 可以讀取 target repo context，但不應自動修改 target repo code。

## Implementation Evidence

Implementation evidence 是 PR 開出後寫回 source issue 的 structured comment。它應記錄 summary、files changed、validation、commit hash、PR URL 與 scope boundaries。

Evidence 讓 reviewer 能追蹤 issue 到 PR 的實作結果。

## PR Body Backfill

PR body backfill 指取得 issue implementation evidence comment 的永久連結後，回填到 PR body 的 Implementation Evidence section。

PR body 必須重新讀取確認不是空的，且包含 issue link、evidence URL、commit hash 與 validation。

## Scope Guard

Scope guard 是 human、repo instructions、issue body、guardrails 與 PR process 共同形成的邊界。

Scope guard 的核心原則：

- 只處理 source issue
- 不處理相鄰 issue
- 不重構無關程式碼
- 不修改未核准檔案
- 發現需要擴 scope 時停下回報

## Non-goals

`spec-injector` 不是：

- autonomous agent
- daemon
- hidden LLM wrapper
- GitHub automation bot
- custom domain runtime
- general-purpose RAG system
- target repo auto-editing system
- multi-agent runtime
