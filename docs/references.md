# References

## Purpose

References 是 task package 中提供給 AI implementer 的 repo context。它們用來降低開工前的脈絡缺口，但不會取代 issue scope、repo instructions 或 human approval。

Reference collection 是 deterministic context selection，不是 general-purpose RAG system。

## Reference Taxonomy

目前與 intended taxonomy 可分成四類：

1. built-in preset references
2. repo `always_read` references
3. issue-mentioned references
4. auto-discovered references

部分 taxonomy 已在目前 CLI 中實作；與 future classifier evidence visibility、custom domains、agent output 相關的延伸能力仍是 planned / future-facing。

## Built-in Preset References

Built-in preset references 來自 `spec-injector` package 本身。

目前 core preset：

- `presets/core/ai-collaboration.md`

它會被加入 always-read context，提供 AI collaboration baseline，例如 scope control、issue / PR rules 與 evidence expectations。

Built-in preset 不代表 target repo 可以被自動修改。它只是 task package 的固定 context。

## Repo Always-read References

Repo `always_read` references 由 target repo 的 `.spec-injector/config.json` 明確設定。

適合放入 `always_read` 的文件通常是：

- repo-level AI instructions
- architecture overview
- security guidelines
- coding standards
- release or validation rules

`spec config suggest always-read --repo .` 可以 deterministic 掃描候選文件，但只會建議，不會自動修改 config。

Missing `always_read` files 會在 task package 的 Missing Files 中呈現。這是 config health signal，不一定是 fatal plan error。

## Issue-mentioned References

Issue-mentioned references 是 issue body 中明確提到的 repo-relative file paths。

目前 parser 會辨識常見形式，例如：

- inline code path：``docs/architecture.md``
- bullet path：`- src/cli/plan.ts`

Issue-mentioned references 會被標示 reason，例如 `mentioned in issue`。若檔案不存在，會進入 Missing Files。

這類 references 通常是 strongest issue-local signal，但仍應遵守 scope guard：被提到不代表一定要修改。

## Auto-discovered References

Auto-discovered references 由 deterministic scan / scoring 產生。

目前 auto-discovery 包含：

- docs scan：固定 high-value files 與 `docs/**/*.md`
- source scan：依 config `discovery.source` 指定的 directories
- keyword scoring：issue title / body tokens 對 path、filename、file sample 的命中
- max limits：`discovery.max_docs` 與 `discovery.max_source_files`

Auto-discovered references 是 context candidates。它們可能有 false positives / false negatives，因此不應被視為完整 dependency graph。

## Configured Discovery Docs

`.spec-injector/config.json` 的 `discovery.docs` 可列出固定納入的 documentation paths。

目前 task package 中這些 docs 會出現在 rule-matched / explicit documentation 相關區塊。它們是 config-driven references，不是 classifier 自動推論出的 approval。

## Reference Ordering Principles

實務上，AI implementer 應以以下優先順序理解 references：

1. Issue body 與 human instructions
2. Built-in preset 與 repo `always_read`
3. Issue-mentioned references
4. Configured discovery docs
5. Auto-discovered docs / source candidates

優先順序不等於修改權限。任何修改仍需符合 issue scope 與 approved plan。

## Planned / Future-facing Ideas

以下概念可以作為 future work，但目前不應假裝已完整實作：

- classifier evidence driving visible reference reasons
- custom domain path signals
- richer reference scoring explanations
- JSON / agent-oriented structured references
- review UI for false positives / false negatives

這些方向若要實作，應另開 issue，並包含 tests 與 docs update。

## Non-goals

References 不代表：

- semantic embedding search
- hidden model retrieval
- target repo dependency graph
- automatic file edit list
- approval to modify referenced files
- custom domains runtime
