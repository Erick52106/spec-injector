## Source of truth

- Closes #<issue-number>
- refs #<issue-number>
- Related docs/specs:
  - ...

<!--
請將 `<issue-number>` 替換成來源 issue 編號。
若此 PR merge 後應自動關閉 issue，請保留 `Closes #<issue-number>`。
若此 PR 不應關閉任何 issue，請改成 `Closes: N/A` 並說明原因。
-->

## 修改內容

<!-- 說明這個 PR 做了什麼，以及為什麼 -->

## 不包含範圍

<!-- 明確說明這個 PR 不處理哪些問題，避免誤解 -->

## 風險

<!-- 是否有 breaking change？config/schema/CLI 行為是否改變？ -->

## 驗證方式

<!-- 如何驗證此 PR 的修改是正確的？ -->

```bash
# 執行驗證指令
```

## 實作證據 (Implementation Evidence)

**Merge 前必須完成：** 在來源 issue 留下實作證據 comment，並將永久連結填入下方。

Issue comment URL: <!-- https://github.com/owner/repo/issues/N#issuecomment-XXXXXXX -->

<details>
<summary>實作證據 comment 範本（展開複製至來源 issue）</summary>

```markdown
## 實作摘要

<!-- 一句話說明此 PR 解決了什麼問題 -->

## 修改檔案

| 檔案 | 修改原因 |
|---|---|
| path/to/file | ... |

## 驗證方式

```bash
# 驗證指令與預期輸出
```

## 風險 / 不包含範圍

<!-- 明確說明邊界 -->

## PR URL

<!-- https://github.com/owner/repo/pull/N -->

## Commit hash

<!-- git log --oneline -1 -->
```

</details>

## Checklist

- [ ] PR 只處理一個明確 scope
- [ ] 已對應 issue（`refs #<issue-number>` 已加入 commit message）
- [ ] 已遵守 `presets/core/ai-collaboration.md`
- [ ] 已執行必要 build/test
- [ ] 沒有混入 unrelated refactor
- [ ] 若有 breaking change，已明確標示
- [ ] 若有 config/schema/CLI 行為變更，已更新文件
- [ ] 已在來源 issue 留下實作證據 comment，並將 URL 填入上方「實作證據」欄位
