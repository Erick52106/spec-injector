# Classifier

## Purpose

Classifier 的責任是用 deterministic signals 從 issue 中選出 likely relevant domains，讓後續 guardrail matching 與 reference collection 更有方向。

Classifier 不是 LLM、不是 architecture reviewer，也不是最終決策者。

## Current Model

目前 classifier 是 keyword-based scoring：

- title keyword 命中權重最高
- label keyword 命中次之
- body keyword 命中提供輔助 evidence
- 最多回傳 5 個 domains

支援的 domains 由 runtime 內建，例如 `frontend`、`backend`、`api`、`auth`、`database`、`infra`、`cloud-storage`、`blockchain`、`smart-contract`、`wallet`、`i18n`、`testing`、`docs`、`ci`、`tooling`。

目前沒有 repo-local custom domains runtime，也沒有 hidden LLM / API / local model classifier。

## What Counts As Evidence

Classifier evidence 是 deterministic signal，不是 model reasoning。常見 evidence 來源包含：

- issue title 中的 domain keyword
- GitHub labels 中的 domain keyword
- issue body 中的 domain keyword
- future-facing config-defined signals
- future-facing path-based signals

目前 task package 只列出 detected domains；detailed evidence visibility 尚未完整輸出。未來可以增加 visibility，但不應改變 classifier 的 deterministic core。

## Generic Wording

Generic product wording 需要小心處理。某些字在不同 domain 中都可能出現，不能單獨作為強 evidence。

例如：

- `transaction` 可以是 database transaction，也可以是 product wording。
- `address` 可以是 wallet address，也可以是 shipping address、email address 或 UI copy。
- `send` / `receive` 可以是 wallet 動作，也可以是 messaging 或 notification。

原則是：generic wording 應弱於 legitimate domain evidence。

## Wallet / Blockchain Evidence

`wallet` / `blockchain` domain 應依賴更明確的 evidence，例如：

- `wallet`
- `connect wallet`
- `wallet address`
- `private key`
- `public key`
- `signature`
- `seed phrase`
- `mnemonic`
- `on-chain`
- `transaction hash` / `tx hash`
- `token transfer`
- `ethereum`
- `solana`
- `web3`

Generic `transaction` 不應單獨代表 wallet。Legitimate wallet / blockchain evidence 應比 generic product wording 更強。

## Classifier Output Is Advisory

Detected domains 主要用於：

- 選出 relevant guardrails
- 協助 references selection
- 提醒 AI implementer 可能涉及的風險區域

Detected domains 不代表：

- AI 可以修改該 domain 的所有檔案
- issue scope 自動擴大
- human approval 已經存在
- classifier 做了 architecture decision

## Future-facing Boundaries

以下方向可以在未來設計，但目前不應被文件描述成已實作：

- detailed classifier evidence section in task package
- `spec classify --explain`
- repo-local custom domains runtime
- config-defined domain keywords
- path-based classifier signals
- JSON / agent-oriented classifier output

任何 future classifier enhancement 都應維持 deterministic、testable、reviewable，且不應引入 hidden LLM calls。

## Non-goals

Classifier 不負責：

- 自動產生 implementation plan
- 自動選擇要修改的檔案
- 自動判斷 PR 是否可 merge
- 呼叫 LLM / API / local model
- 取代 human review
- 實作 custom domains runtime
