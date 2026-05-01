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

## Checklist

- [ ] PR 只處理一個明確 scope
- [ ] 已對應 issue（`refs #<issue-number>` 已加入 commit message）
- [ ] 已遵守 `presets/core/ai-collaboration.md`
- [ ] 已執行必要 build/test
- [ ] 沒有混入 unrelated refactor
- [ ] 若有 breaking change，已明確標示
- [ ] 若有 config/schema/CLI 行為變更，已更新文件
