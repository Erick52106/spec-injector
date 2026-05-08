# Source Trust And Context Budget

## Purpose

本文件定義 `spec-injector` 如何描述 context source 的 trust label、include mode 與 context budget policy。

它的用途是讓 task package / prompt 在未來演進時，能清楚區分：

- 哪些 source 是 confirmed reference。
- 哪些 source 只是 hint。
- 哪些 source 可 full include。
- 哪些 source 只能 reference-only。
- 哪些 source 只能 diagnostics-only。
- 哪些 evidence 可以支援 validation hints。
- 哪些 output 不應給 AI 錯誤信任訊號。

本文件是 #129 input adapters、#107 catalog / protocol、#147 internal workflow contract 的設計基礎。#129 的 canonical input adapter proposal 見 [docs/input-adapters.md](input-adapters.md)；#107 的 catalog / protocol vocabulary 見 [docs/catalog-protocol.md](catalog-protocol.md)。它不是 runtime implementation，不改現有 task package / prompt output，不是 hidden LLM、RAG、semantic search 或 vector DB design。

## Source Categories

| Source category | How it is produced | Trust implication | Common failure mode | Expected output treatment | Full include? | Caveat needed? |
| --- | --- | --- | --- | --- | --- | --- |
| repo `always_read` | target repo `.spec-injector/config.json` 明確列入 | repo author / maintainer 明確要求的 baseline context | path stale、檔案不存在、permission / encoding read issue、內容過大 | 高優先 reference；read issue 進 diagnostics | Yes, if budget allows | 若 missing / unreadable / read failed 必須清楚標示 |
| built-in preset | `spec-injector` package 內建 preset，例如 core AI collaboration guidance | tool-defined baseline，不是 target repo config | 被誤讀成 repo `always_read`、內容與 target repo policy 衝突 | 與 repo `always_read` 分開標示 source | Yes, if budget allows | 需標示 built-in preset，不代表 target repo approval |
| issue-mentioned | issue body 明確提到 repo-relative path | issue-local 強訊號；通常最接近 source issue intent | stale path、renamed path、typo、read issue | found 時高優先；missing / read issue 進 diagnostics，保留 source metadata | Yes, high priority | 被提到不等於修改授權；missing 不可靜默忽略 |
| configured discovery docs | `.spec-injector/config.json` 的 discovery docs / rule-matched docs | config-driven context，不是 classifier 自動 approval | config 過廣、path stale、read issue | reference list 或 budgeted full include；read issue 進 diagnostics | Yes, if budget allows | 應說明 config/rule reason |
| auto-discovered | deterministic docs/source scan 與 keyword scoring | inferred candidate，輔助理解，不是 human-approved scope | false positive、false negative、generic wording overmatch、too many candidates | reference-only by default 或低優先 budgeted full include | Maybe, after stronger sources | 必須標示 auto-discovered / inferred |
| diagnostics / missing files | safe read / path resolution / discovery failure | source health signal，不是 reference content | hidden read error、raw stack trace、absolute path leakage | diagnostics-only；不可混入 normal confirmed references | No | 必須可見且語意明確 |
| path alias hints | missing issue-mentioned path 的 deterministic basename candidate | weak hint；不是 confirmed source | candidate ambiguous、stale issue path、basename coincidence | hint-only in diagnostics near original missing path | No | 必須標示 not confirmed |
| future raw request / markdown brief inputs | future #129 deterministic input adapter 解析 | external / untrusted until repo confirmation exists | AI-generated partial plan 被誤當 source of truth、paste 內容缺 repo evidence | input provenance + extracted candidates；需 attached trust labels | No by default | 必須清楚標示 external / unconfirmed |

## Trust Levels

以下 trust levels 是 design vocabulary，不代表目前 runtime 已經完整實作。

### confirmed

Source exists and was explicitly required or deterministically selected with a stable reason. `confirmed` 表示 path / content 可讀且 source metadata 可追蹤，但不等於 human approval to edit。

### strong

Repo `always_read`、built-in preset、found issue-mentioned source 屬於 strong signal。它們通常應優先被保留，並在 budget 壓力下優先於 auto-discovered candidates。

### medium

Auto-discovered 或 configured discovery source 若有 deterministic reason，可視為 medium。它有助於 AI understanding，但仍可能是 false positive，不應被寫成 issue author 明確指定。

### weak / hint

Path alias hint、ambiguous candidate、inferred relation 屬於 weak / hint。它只能提醒 human / AI 檢查可能的 renamed path 或相關 candidate，不能升格成 confirmed reference。

### diagnostic

Missing、unreadable、read failed、rejected classifier evidence、omitted due to budget 都是 diagnostic signal。它們應可見、可審查，但不提供 reference content。

### untrusted / external

Future raw request、markdown brief、AI-generated partial plan、external pasted text 在 repo confirmation 前應視為 untrusted / external。它可以提供 request intent，但不應直接驅動 confirmed references 或 validation hints。

## Include Modes

### full-include

Reference content included in the full task package. AI 可以讀到內容，但仍需遵守 issue scope、repo instructions 與 human approval。

Prompt compact output 應只包含 path / source label，而不是無限制塞入全文。Full include 不應用於 hint、diagnostic 或 untrusted external input。

### reference-only

Output lists path、source label、reason，content not included。適合 prompt compact output、large files、低優先 auto-discovered candidates，或 budget 壓力下仍需保留可見性的位置。

### diagnostics-only

Output surfaces warning / missing / unreadable / read failed / rejected / omitted reason。它可以進 full task package 與 prompt compact output 的 diagnostics section，但不應進 normal reference list。

### hint-only

Displayed as possible path / candidate near the diagnostic that caused it. Alias hints 必須保留 "not confirmed" 語意，不可被 normal reference rendering 或 future protocol 當成 found reference。

### excluded

Source intentionally omitted due to budget, safety, irrelevance, duplicate coverage, or exclusion rules。若 omitted source 來自 strong / explicit signal，應留下 visible reason；低價值 auto-discovered candidate 可被 deterministic limits 排除，但不能影響 diagnostics visibility。

## Context Budget Policy

Context budget 應先採 rule-based priority order，不設計 complex scoring algorithm。

### Priority Order

1. Issue body、human prompt、repo instructions。
2. Issue-mentioned found references。
3. Repo `always_read` and built-in preset baseline context。
4. Configured discovery docs / rule-matched docs。
5. Auto-discovered docs。
6. Auto-discovered source candidates。
7. Weak hints and diagnostics, displayed outside normal references。

優先順序不等於修改權限。它只決定 context visibility 與 budget retention。

### Full Include Limit

Full include 應保守，優先給 explicit / strong sources。若 strong sources 已經填滿 budget，auto-discovered sources 應降級為 reference-only，而不是擠掉 issue-mentioned content。

未來 implementation 可以用固定 item count、固定 byte / token estimate、或 config-driven limit，但必須 deterministic、可測試，且不可依賴 model confidence。

### Reference-only Fallback

當檔案太大、candidate 太多、或 priority 較低時，降級為 reference-only。Reference-only output 應保留 path、source category、reason、以及必要 caveat，避免 silent omission。

### Diagnostics Always Visible

Missing、unreadable、read failed、ambiguous alias candidates、important budget omissions 應保持 visible。Prompt compact mode 不應因為省 token 而隱藏 critical diagnostics。

### Large Files

Large files 不應被無限制 full include。設計上可採：

- strong / explicit large file: reference-only plus "omitted or truncated due to budget" reason。
- auto-discovered large file: reference-only by default。
- diagnostics for read issues remain visible。

不要用 hidden summarization 假裝 full include。若未來要做 summary，必須另有 deterministic / inspectable design issue。

### Too Many Auto-discovered Docs

Auto-discovered docs 應受 deterministic max limit。當 candidates 過多：

- 先保留 path / reason 排序穩定。
- 讓 lower-ranked candidates excluded 或 reference-only。
- 不得擠掉 issue-mentioned / always_read。
- 若 output 暗示 "complete relevant docs"，必須避免；應稱為 candidates。

### Ambiguous Alias Candidates

Ambiguous alias candidates 只能 hint-only。它們應出現在 original missing issue-mentioned path 附近，顯示有限候選清單與 candidate count。不得把任一 candidate 升級成 confirmed reference。

### Avoiding Prompt Bloat

Prompt compact output 應偏向 reference-only + diagnostics summary。Full content 應留在 full task package，且受 budget limit。Prompt 的目標是讓 AI 產生 plan，不是把 repo dump 進聊天上下文。

### Avoiding Silent Omission

Strong / explicit source 被降級或 omitted 時，應留下 visible reason。Low-priority auto-discovered candidate 因 max limit 未出現時，可以依 deterministic limit 處理，但若它曾進入 selected set 又被 budget trim，應記錄 reason。

## Trust x Include Matrix

| Source state | Design trust level | Preferred include mode | Current behavior note | Proposed interpretation |
| --- | --- | --- | --- | --- |
| repo `always_read` + found | strong / confirmed | full-include if budget allows; otherwise high-priority reference-only | Currently included with source label | Treat as baseline context, not edit approval |
| repo `always_read` + missing / read issue | diagnostic | diagnostics-only | Currently appears in Missing Files with read status | Keep visible as config health signal |
| built-in preset + found | strong / confirmed | full-include or reference-only depending budget | Currently included with `built-in preset` source label | Keep separate from repo `always_read` |
| issue-mentioned + found | strong / confirmed | full-include or highest-priority reference-only | Currently separate issue-mentioned docs/source sections | Preserve before auto-discovered sources |
| issue-mentioned + missing | diagnostic | diagnostics-only plus optional hint-only alias hint | Currently Missing Files keeps source metadata and alias hints | Never silently drop original missing path |
| path alias hint | weak / hint | hint-only | Currently says not a confirmed issue reference | Never enter normal reference list |
| configured discovery doc + found | medium / confirmed by config | full-include if budget allows; otherwise reference-only | Currently rule/config docs are distinct | Show config/rule reason |
| auto-discovered doc/source + found | medium | reference-only or low-priority budgeted full-include | Currently auto-discovered sections are separate | Treat as candidate, not issue author signal |
| auto-discovered + read failed | diagnostic | diagnostics-only | Currently can appear as missing/read issue if selected | Keep source reason, no raw stack trace |
| rejected classifier evidence | diagnostic | diagnostics-only | Currently verbose diagnostics can show rejected signals | Use for explainability, not reference selection by itself |
| future raw request / AI partial plan | untrusted / external | input provenance; no full include until repo-confirmed | Not implemented | Adapter must attach trust labels before compilation |

## Failure And Diagnostic Vocabulary

Diagnostics should be visible, short, and safe to show in task package / prompt.

### not found

The repo-relative path was requested or selected, but no file exists at that path. Use for true missing paths, not permission or read failures.

### unreadable

The path exists or was discovered, but the file cannot be read due to permission or access constraints. Show the stable error code when useful; do not show raw stack trace.

### read failed

The path exists or was selected, but reading failed for an IO / encoding / unexpected read reason. Preserve source metadata and avoid treating it as missing.

### ambiguous alias candidates

The original path is missing and deterministic matching found multiple same-basename candidates. Show limited candidates and total count; label them as not confirmed.

### rejected classifier evidence

A classifier signal was observed but suppressed because it was too generic or lower-confidence than stronger evidence. This is diagnostic context, not a source reference.

### source omitted due to budget

A selected source was not full-included because of budget, size, priority, safety, or duplicate coverage. Strong / explicit sources should leave a visible reason.

### source included as hint, not confirmed

The output contains a candidate path or relation for human review only. It must not be rendered as a normal reference or used as edit scope.

Diagnostics should not expose raw stack traces or unnecessary local absolute paths. Repo-relative paths and stable error labels are preferred.

## Relationship To Existing Behavior

The current codebase already contains pieces that support this design:

- #74 distinguished `not found`, `unreadable`, and `read failed`, which makes diagnostic trust possible.
- #75 added unreplaced placeholder detection, reducing the risk that task package output silently carries invalid template state.
- #73 and #137 tuned classifier false positives, showing why rejected / weak evidence must stay separate from strong source trust.
- #82 separated built-in preset from repo `always_read`, preventing tool baseline context from being mistaken for repo config.
- #84 separated issue-mentioned references from auto-discovered references, preserving stronger issue-local signals.
- #113 external config support lets dogfood run read-only without mutating target repos, reinforcing source provenance and repo-safe diagnostics.
- #135 path alias hints prove that missing issue-mentioned paths can produce deterministic hints without pretending the hinted path is confirmed.
- #151 second brownfield dogfood should validate whether this trust / budget vocabulary is useful outside the first target repo sample.

These are existing supports, not proof that the full trust / budget model is implemented.

## Relationship To Future Issues

- #129 input adapters must attach trust labels before raw request, markdown brief, PR note, dogfood report, or AI-generated partial plan enters context compilation; see [docs/input-adapters.md](input-adapters.md) for the design-only adapter model.
- #107 catalog / protocol should encode source category, trust level, include mode, diagnostic vocabulary, and compatibility rules.
- #147 internal workflow contract may consume source trust metadata for repo workflow checks, but source trust remains product/compiler design, not a harness platform.
- #151 second dogfood should measure whether trust labels, diagnostics, alias hints, and budget fallback help real brownfield planning.
- #108 / #109 / #110 workflow guardrails may check evidence completeness or workflow consistency, but they should not define source trust semantics.

## Do-not-build / Non-goals

Do not build:

- hidden LLM / RAG / semantic search
- vector DB
- source trust by model confidence
- target repo auto-editing
- alias hint as confirmed reference
- future AI-generated partial plan as trusted source
- runtime source trust implementation in this PR
- context budget algorithm implementation in this PR
- task package / prompt output changes in this PR
- config schema changes
- new CLI command / flag
- JSON / machine-readable output runtime

## Acceptance Criteria For Future Implementation

These criteria are for future implementation issues, not this PR's runtime behavior.

- Task package clearly labels confirmed, hint, diagnostic, and external sources.
- Prompt compact mode does not hide critical diagnostics.
- Issue-mentioned references outrank auto-discovered references.
- Budget trimming is deterministic and test-covered.
- Important omitted sources leave visible reasons.
- Alias hints never enter normal references as confirmed files.
- Large files degrade to reference-only or deterministic truncation with visible reason.
- Tests cover trust label ordering, include mode selection, diagnostics visibility, and budget fallback.
- Future structured output uses stable names that align with #107 catalog / protocol.
- Future input adapters from #129 mark external / untrusted text before reference extraction.

## Decision Summary

- Canonical vocabulary: source category, trust level, include mode, diagnostics, budget fallback.
- Canonical trust distinction: confirmed / strong / medium / weak hint / diagnostic / untrusted external.
- Canonical include distinction: full-include / reference-only / diagnostics-only / hint-only / excluded.
- Deferred: runtime implementation, context budget algorithm, structured output, input adapters, catalog protocol, workflow contract consumers.
- Must not be built: hidden LLM, RAG, vector DB, source trust by model confidence, target repo auto-editing, or hint-to-reference promotion.
## Implemented today vs design future

| Scope | Status | Notes |
| --- | --- | --- |
| Implemented today | Implemented | source labels / source categories；bounded snippets / item-count limits；visible missing / unreadable / read failed / alias diagnostics |
| Partial / design direction | Design | trust levels as design vocabulary；include modes as design vocabulary；context budget policy beyond item-count caps |
| Not implemented | Not implemented | full trust-level runtime policy engine；token / byte budget algorithm；hidden scoring；semantic RAG / vector search；hidden summarization；LLM confidence |

Issue `#149` remains parked / design-only. It is not current behavior and must not be implemented as auto-fix / auto-resolve / auto-merge / auto-close or target-repo mutation.

## Monorepo discovery behavior and path-shape guidance

### Current behavior (docs-only interpretation)

Current auto-discovery 的定位是 deterministic 且 bounded；它能提供 bounded initial context，但不是完整 monorepo/package/workspace resolver。

- `issue-mentioned paths` 與 `auto-discovered references` 的處理順序不同：issue 明確提到的 path 仍保有較高權重；alias hint 仍是診斷訊號。
- `path alias hints` 不會被提升為 confirmed source；它們是 `diagnostic` / `ambiguous` 的輔助線索。
- `missing` / `unreadable` / `read failed`（含 `read failed (EISDIR)`）是預期 diagnostic 輸出的一部份，需納入排錯流程。
- source snippet 可能被截斷，且會保留截斷原因與 trust label，避免誤以為完整讀取。
- `discovery.docs` / `discovery.source` 的目錄項目不一定會被視為遞迴套件級 discover；若未明確支援，請用更明確的 file/path pattern 設定。

### Monorepo docs/source 設定建議（current docs）

- Brownfield monorepo 請優先使用 package / app 層級路徑：
  - `packages/<name>/README.md`
  - `packages/<name>/docs/...`
  - `packages/<name>/package.json`
  - `apps/<name>/README.md`
  - `apps/<name>/docs/...`
- 虛擬/匯出路徑示例：
  - issue 可能提到 `vitest/browser/context.d.ts`
  - 實際檔案可能位於 `packages/vitest/browser/context.d.ts`
  - 當你已知 package 實體位置，請直接把實體檔放進 `discovery.source`，不要假設 runtime 一定自動映射 alias。

```json
{
  "discovery": {
    "docs": [
      "packages/<name>/README.md",
      "packages/<name>/docs"
    ],
    "source": [
      "packages/<name>/package.json",
      "packages/<name>/src/index.ts"
    ]
  }
}
```

### Directory input 與 `EISDIR` 的排障

- 若看到 `read failed (EISDIR)`，先確認該路徑在設定上是否是「應為檔案卻填了目錄」。
- 建議改為明確 file path，或先縮小到更小 scope 的目錄（例如 `packages/<name>/docs`）再逐步擴展。
- 若仍需要更完整套件推斷，請以 follow-up issue 紀錄，保持 runtime 行為不變（避免超出 #205 non-goals）。

### 狗食報告依據

- `#202` 的 `docs/dogfood/vitest-2026-05-09.md` 顯示 monorepo 中 path inference / directory input 的 friction，並且驗證到 `EISDIR` 類 read-failed 狀況。
- 這支持本次以 docs/guidance-first 為第一步，不在 #205 內實作 monorepo walker 或 workspace parser。
- 目前不表示可以直接將 `#206`（zh-TW classifier）或其他 runtime 行為納入同一版實作。
