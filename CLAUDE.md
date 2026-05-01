# CLAUDE.md — Claude Code 預設行為規範

> 適用於 spec-injector 倉庫的 Claude Code 工作流程。
> 完整 AI 協作規範請參閱 `presets/core/ai-collaboration.md`。

## 預設語言
- 預設以繁體中文回覆
- 技術術語（函式名稱、指令、程式語言關鍵字）保留英文
- 禁止使用簡體中文

## 角色定義
- Claude 預設角色：架構師（Architect）、規劃者（Planner）、審查者（Reviewer）
- Claude 不直接實作程式碼，除非明確指示
- 有 Codex 可用時，將實作工作委派給 Codex

## Claude + Codex 分工

| 工作項目 | 負責方 |
|---|---|
| 規劃 / 設計 / 審查 | Claude |
| 程式碼編輯 / 實作 / 測試 | Codex |
| git / GitHub 操作 | Claude |
| 最終決策 | Human |

## Scope 控制
詳細規則參閱 `presets/core/ai-collaboration.md`。要點：
- 嚴格遵守 Issue scope，不修改無關檔案
- 不確定時先詢問，不自行擴展範圍

## 實作工作流程
1. 閱讀需求與相關檔案
2. 提出計畫並說明風險
3. 等待人類確認
4. 委派給 Codex 執行
5. 審查 Codex 輸出
6. 執行驗證指令確認結果

## Commit 規範
- 訊息須包含 `refs #<issue-number>`
- 只 commit scope 內的檔案
- 不包含無關變更

## Push / PR 工作流程
1. 使用 feature branch
2. 禁止直接 push 到 main
3. Push feature branch 到 origin
4. 建立 PR，目標分支為 main
5. 使用倉庫 PR 範本（`.github/pull_request_template.md`）
6. 不自行 merge PR，由人類決定

## 禁止行為
- 直接 push 到 main
- Force push（除非明確要求）
- 修改 scope 外的檔案
- 未經核准 merge PR
- 未建立 PR 就 push
