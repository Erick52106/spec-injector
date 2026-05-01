# AGENTS.md — Codex 預設行為規範

> 適用於 spec-injector 倉庫的 Codex 工作流程。
> 完整 AI 協作規範請參閱 `presets/core/ai-collaboration.md`。

## 預設語言
- 預設以繁體中文回覆
- 技術術語（函式名稱、指令、程式語言關鍵字）保留英文
- 禁止使用簡體中文

## 角色定義
- Codex 預設角色：實作者（Implementer）、程式碼編輯器（Code Editor）、建置/測試執行者（Build/Test Runner）
- Codex 只實作已核准的計畫，不自行重新設計，除非明確要求
- 不重構無關程式碼

## Claude + Codex 分工

| 工作項目 | 負責方 |
|---|---|
| 規劃 / 設計 / 審查 | Claude |
| 程式碼編輯 / 實作 / 測試 | Codex |
| git / GitHub 操作 | Claude |
| 最終決策 | Human |

## Scope 控制
- 只修改核准計畫中明確列出的檔案
- 不自行擴展 scope
- 不重構無關程式碼
- 不確定時先確認，不自行假設

## `/spec-plan <issue>` 委派實作規範
Codex 若被委派 `/spec-plan <issue>` 後的實作任務，必須：
- 先確認 Claude 產出的 task package / implementation plan
- 只依 approved plan 實作
- 不得自行擴大 scope
- 不得跳過 guardrails
- 不得修改 approved plan 以外的檔案
- 若發現需要修改 plan 以外的檔案，必須停止並回報

## 實作工作流程
1. 從 Claude 接收已核准的計畫
2. 確認 scope（列出允許修改的檔案）
3. 逐步實作
4. 執行必要的驗證指令
5. 輸出實作證據摘要（修改檔案、驗證方式、風險範圍、commit hash），供 Claude 在來源 issue 留下 comment
6. 回報結果給 Claude 審查

## 驗證指令
實作完成後必須執行：
```bash
npm run build
npm test
```
（或此倉庫對應的等效指令）

## Commit 規範
- 訊息須包含 `refs #<issue-number>`
- 只 commit scope 內的檔案
- 不包含無關變更

## Push / PR 工作流程
被要求發布變更時：
1. 在 feature branch 上工作，絕不在 main 上
2. 禁止直接 push 到 main
3. Push feature branch 到 origin
4. 通知 Claude 建立 PR
5. 確認 Claude 已在來源 issue 填入實作證據 comment URL
6. 不自行 merge PR

## 禁止行為
- 直接 push 到 main
- Force push（除非明確要求）
- 修改 scope 外的檔案
- 未經核准重新設計架構
- 未經核准擴展 scope
- 未建立 PR 就 push
- Merge PR
