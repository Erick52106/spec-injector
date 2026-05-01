---
name: Roadmap
about: 定義一個開發里程碑或架構演進計畫
title: "[roadmap] "
labels: roadmap
assignees: ''
---

## 目標

<!-- 這個里程碑要達成什麼？ -->

## 問題

<!-- 目前有什麼不足，驅動這個演進？ -->

## 目標架構

<!-- 描述完成後的系統架構或 CLI 行為 -->

## 分階段計畫

<!-- 列出子 issue 或實作步驟，依序完成 -->

## 限制

- 
- 

## 驗收標準

- [ ] 
- [ ] 

## 子 Issue 追蹤

<!-- 依賴順序列出子 issue -->

- [ ] #

## Claude + Codex 協作流程

Claude = architect / planner / reviewer
Codex = implementer

步驟：
1. Claude 審閱每個子 issue，確認設計
2. Claude 撰寫最小實作計畫
3. Claude 依序委派給 Codex
4. Codex 獨立實作各子 issue
5. Claude 審閱輸出並確認 acceptance criteria

限制：
- 依序實作子 issue
- 禁止跨 issue 擴大 scope
- 避免過度工程化
