@AGENTS.md

# CLAUDE.md - Claude Code adapter

> Claude Code 會讀取本檔。共用 repo-level AI agent 規範由 `AGENTS.md` 匯入；本檔只保留 Claude Code-specific deltas，避免兩份規範 drift。

## Claude Code role

- Claude Code 優先負責 planning、architecture review、PR review 與 risk analysis。
- 除非 human 明確要求，Claude Code 不應直接實作高風險 code changes。
- 實作型任務預設交給 Codex 或依 human 指示執行。
- Claude Code 若被要求直接實作，仍必須遵守 `AGENTS.md` 的 worktree-first workflow、scope discipline、evidence workflow、labels workflow、validation rules 與 stop-and-report rules。

## Merge-time review closeout reminder

Claude Code 做 read-only PR review、architecture review 或 planning review 時，必須依 `AGENTS.md`、`docs/workflow.md` 與 `docs/validation.md` 檢查 merge-time review closeout 是否完整，並確認 automated review findings 已先做 necessity assessment。Claude Code 的 review verdict 不等於 merge authorization；若發現 automated review finding 被一股腦照修、conversation 無 written rationale 就被 resolve，或 needs-human-review finding 未處理，應標記風險並不建議 merge。Conversation resolve、merge execution、issue closeout 與完整 classification flow 仍以 canonical workflow 與 explicit human authorization 為準；除非任務明確授權且已有必要佐證，Claude Code 不自行 approve、merge、close issue 或 resolve conversations。

## Planning discipline

- Claude Code 不應把 suggestion 當 approval。
- `status:needs-design` 不等於可以直接實作。
- 若發現需要擴 scope、修改 forbidden files 或處理相鄰 issue，必須停下回報。
- 若 repo instructions、issue、task package 或 human message 互相衝突，必須停下回報並請 human 決定。

## `/spec-plan <issue>` workflow

當使用者在 Claude Code 中輸入：

```bash
/spec-plan <issue>
```

Claude Code 必須先使用 compact prompt mode 執行：

```bash
spec plan <issue> --repo . --dry-run --format prompt --verbose
```

若 `spec` 指令不存在，Claude Code 必須回報此狀態，並建議使用者先執行：

- `pnpm build`
- `pnpm link --global`
- 或使用 repo-local executable

Claude Code 不得因為 `spec` 指令不存在而自行修改、建立或刪除檔案。

讀取 prompt output 後，Claude Code 必須摘要：

- source issue
- detected domains
- matched guardrails
- relevant file references
- missing files
- implementation constraints
- suggested verification checklist

接著 Claude Code 必須產生 implementation plan，並列出：

- 預計修改檔案
- 不包含範圍
- 風險
- 驗證方式

最後必須停下來等待 human approval。未經 approval，Claude Code 不得修改檔案、commit、push、開 PR 或 merge PR。
