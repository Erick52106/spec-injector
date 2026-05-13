Language: 繁體中文 | [English](README.en.md)

# spec-injector

`spec-injector` 目前是一個 deterministic GitHub issue-to-context compiler for AI coding agents。

它把 GitHub issue、repo docs、source references、source trust direction、guardrails、validation hints 與 target repo 的 `.spec-injector/config.json` 編譯成 AI coding agent 開工前可直接使用的 bounded task package / prompt。

Broader deterministic request-to-context adapters for fuzzy requests、markdown briefs 或 PR review notes 是 future design direction；目前已實作且 repo 規範要求守住的 path 仍是 GitHub issue-to-context，不是 hidden LLM planner。

它的目標不是代替人或 AI 寫程式，而是讓 Codex、Claude Code 或其他 implementer 在修改任何檔案前，先取得可檢查、可重複、受 repo 設定約束的工作脈絡。

核心定位：

- issue-scoped today：目前以單一 GitHub issue 作為 scope source of truth，並保留 future request adapter 的 deterministic design boundary
- brownfield-friendly：面向 existing GitHub issues、既有 repo docs、source references 與 repo-specific workflow rules
- repo-safe：讀取 target repo context，但不自動修改 target repo code
- deterministic：相同 issue、repo files 與 config 應產生穩定 output
- source-trust aware：區分 repo instructions、always-read docs、issue-mentioned paths、auto-discovered references 與 diagnostics 的信任來源
- context-budget aware：輸出 bounded context，而不是把 repo 全部塞進 prompt
- guardrails-aware：把 detected domains 對應到 repo-defined constraints / reminders
- evidence-oriented：把 validation hints、issue evidence、PR body backfill 與 review closeout 視為 handoff workflow 的一部分
- agent-agnostic：輸出 Markdown task package / prompt，供 Codex、Claude Code 或其他 AI coding agent 消費
- no hidden LLM：不呼叫 hidden LLM、external AI API 或 local model

補充（目前實作邊界）：
- source-trust aware / context-budget aware 是 current direction + partial runtime behavior。
- 現況 runtime 已輸出 source labels / source categories、bounded snippets / item-count limits、可視化 diagnostics。
- 現況 runtime 尚未實作完整 trust-level policy engine，也尚未實作 token / byte budget 演算法。

補充（monorepo / discovery）：
- `discovery.docs` 與 `discovery.source` 是 **bounded、啟發式** 的候選來源；目前不保證能完整還原 monorepo package / workspace 解讀。
- Brownfield monorepo 請盡量改用明確 package-level 路徑，例如：
  - `packages/<name>/README.md`
  - `packages/<name>/docs/...`
  - `packages/<name>/package.json`
  - `apps/<name>/README.md`
  - `apps/<name>/docs/...`
- 導入文件路徑時，若出現 `read failed (EISDIR)`，代表可能把資料夾當成檔案 path，需回到 [docs/source-trust.md](docs/source-trust.md) 與 [docs/issue-to-context-pipeline.md](docs/issue-to-context-pipeline.md) 的 directory / file guidance。
- `path alias hints` 僅為診斷訊號，不等於 `issue-mentioned` 確認引用；虛擬 import 路徑也不代表 CLI 已完整映射到實際 package 檔案。

## Why this exists

AI coding agent 常見的失誤不是「不會寫程式」，而是開工前沒有足夠清楚的邊界：

- issue body、repo instructions、architecture docs、source references 與 validation rules 分散在不同地方
- AI 可能先動手再補脈絡，導致 scope creep
- reviewer 難以追蹤某次實作是否真的遵守 source issue
- repo-specific guardrails 容易被忘記，例如 database、auth、CI、docs-only work
- brownfield repo 的 stale path、renamed file、missing doc 或 unreadable source 容易變成隱性假設

`spec-injector` 把這些開工前需要看的資訊整理成一份 structured Markdown output。它讓 implementer 先讀 task package，再產生 implementation plan，經 human approval 後才開始修改檔案。

## Core guarantees

`spec-injector` 的 Layer 1 CLI 保證下列邊界：

- 透過 `gh` 讀取 GitHub issue；除了 `gh` 本身，不做其他 hidden network calls
- classifier 使用 deterministic keyword scoring，不是 LLM classifier
- references selection 是 deterministic repo scan / scoring，不是 semantic RAG
- guardrails 來自 target repo config，是 constraints / reminders，不是 approval
- `spec plan --dry-run` 只輸出到 stdout，不寫入 task package
- `spec plan` 的 non-dry-run output 只寫入 `.spec-injector/out/issue-<number>-task-package.md`
- task package 可以揭露 missing files、unreadable files、path alias hints 與 validation checklist，讓 context gaps 可被看見
- read-only workflow guardrails（含 `spec evidence-check` / `spec label-audit`）只能做 report/check；`PASS` 不是 approval，也不自動建立/修改/刪除 metadata 或 merge
- mutating commands 必須是明確 command 行為，例如 `spec init`、`spec config add/remove always-read`、`spec clean`
- CLI core 不會自動建立 branch、commit、PR、issue comment 或修改 target repo source code

更多架構邊界請見 [docs/architecture.md](docs/architecture.md)。

## How it works

`spec plan <issue>` 會執行下列 pipeline：

1. **Issue Loader**：透過 authenticated `gh` CLI 讀取 issue title、labels 與 body。
2. **Issue Parser**：抽出 issue text、明確提到的 repo-relative paths 與 checklist items。
3. **Domain Classifier**：用 deterministic keyword scoring 偵測 relevant domains。
4. **Guardrail Matcher**：用 detected domains 比對 `.spec-injector/config.json` 中的 guardrails。
5. **Reference Collector**：收集 built-in preset、repo `always_read`、configured docs、issue-mentioned files、auto-discovered docs / source references。
6. **Diagnostics / Validation Direction**：保留 missing / unreadable / alias hints 與 suggested verification checklist。
7. **Task Package Renderer**：輸出 full task package 或 `--format prompt` 的 compact AI planning prompt。

## Pipeline diagram

```text
GitHub Issue
  -> Issue Loader via gh
  -> Issue Parser
  -> Domain Classifier
  -> Guardrail Matcher
  -> Reference Collector
  -> Diagnostics / Validation Direction
  -> Task Package Renderer
  -> Markdown task package / prompt for Codex or Claude Code
```

## Current capability map

目前 `spec-injector` 的已實作 / 已文件化能力可以用四段理解：

| Stage | What happens | Boundary |
| --- | --- | --- |
| Input | 讀取 GitHub issue、repo config、repo docs、issue-mentioned paths 與 configured discovery sources。 | GitHub issue 是目前實作入口；future fuzzy request 仍是 design direction。 |
| Compile | 用 deterministic parser / classifier / reference collector 組合 guardrails、source references、diagnostics 與 validation hints。 | 不呼叫 hidden LLM，不使用 semantic RAG / vector DB。 |
| Output | 產生 bounded Markdown task package 或 compact planning prompt，供 AI coding agent 開工前閱讀。 | Output 是 handoff context，不是 autonomous execution plan。 |
| Verify | Repo workflow docs 規範 validation、implementation evidence comment、PR body evidence URL、HEAD/readback check 與 review closeout。 | Workflow guardrails 是 read-only / human-reviewed discipline，不是 merge bot 或 remediation automation。 |

## Roadmap 邊界

這張表用來避免把 future docs 或 parked designs 誤讀成 current capability：

| Lane | Status | What it means | What it does not mean |
| --- | --- | --- | --- |
| Current | Implemented / documented today | deterministic GitHub issue-to-context compiler；bounded task package / prompt output；source labels / source categories；missing / unreadable / read failed diagnostics；visible truncation metadata；read-only `spec evidence-check` / `spec label-audit`；opt-in live `gh` smoke。 | 不是 hosted control plane、agent orchestration platform、merge bot、hidden LLM planner、semantic RAG / vector search，且不修改 target repo。 |
| Current with caveat | Supported wording, partial runtime, or auxiliary report | source-trust vocabulary 有 partial runtime support，但不是 full policy engine；boundedness 目前以 item-count limits / truncation metadata 為主，不是 token / byte budget algorithm；monorepo 是 guidance，不是 full resolver；dogfood evidence 是 WARN / caveated；evidence-check / label-audit 是 auxiliary reports。 | 不代表 approval authority、unconditional PASS、完整 monorepo package export resolver，或 future trust / budget policy 已全部實作。 |
| Future / design-only | Direction only until separate implementation exists | catalog / protocol direction；stronger trust policy design；future budget policy design；companion / Spec Cat / status UX；更多 dogfood evidence；#206 zh-TW classifier 只有在 evidence 支持後才可能處理。 | 不代表 Layer 3 / Layer 4 runtime 已存在，也不代表 #206 已 shipped。 |
| Parked | Explicitly not active implementation | #149 supervised remediation loop 仍 parked；thread-level review remediation 需等 safety prerequisites 存在後才可重新評估。 | 不代表 remediation loop 是 current capability，也不代表 auto-fix / auto-resolve / auto-close / auto-merge 可以開始做。 |
| Explicit non-goals / must not claim | Must stay out of README claims | 不宣稱 hosted control plane、agent orchestration platform、merge bot、companion runtime、hidden LLM planner、RAG / vector search、target repo auto-editing、automatic monorepo package export resolver、zh-TW classifier shipped。 | 不應用 future docs、design records 或 parked issues 包裝成 current product behavior。 |

## 目前管線與文件地圖

目前可安全描述的主線是：`request / GitHub issue` 進入 deterministic issue parser / classifier，收斂 repo docs、source references 與 guardrails，保留 missing / unreadable / alias hints 等 diagnostics，最後輸出 bounded task package / prompt，交給 AI coding agent 在 human-reviewed workflow 中實作。這條 current pipeline 的重點是 deterministic handoff context，不是 hidden planner、target repo mutation、merge automation，最終實作與 merge decision 仍由人與 repo workflow 決定。

主要文件可對照：

- [docs/issue-to-context-pipeline.md](docs/issue-to-context-pipeline.md)：current pipeline 與 future lane separation
- [docs/source-trust.md](docs/source-trust.md)：source-trust vocabulary 與 bounded context caveats
- [docs/validation.md](docs/validation.md)：validation matrix 與 quality gates
- [docs/workflow.md](docs/workflow.md)：issue-to-PR workflow guardrails
- [docs/cheatsheet.md](docs/cheatsheet.md)：happy-path quick reference
- [docs/dogfood/vitest-2026-05-09.md](docs/dogfood/vitest-2026-05-09.md)：caveated dogfood evidence
- [docs/design/layers.md](docs/design/layers.md)：Layer 1–4 boundary model

邊界上，current 包含 deterministic compiler、source labels/categories、diagnostics、visible truncation metadata、read-only `spec evidence-check` / `spec label-audit` guardrails；caveated 部分包含 source-trust vocabulary 仍是 partial runtime support、context budget 仍以 bounded snippets / item limits 為主、dogfood evidence 是 cautious progress、monorepo 目前只有 docs guidance。future / design-only 則保留給 #206 zh-TW classifier、#149 supervised remediation loop，以及 companion/status、full trust policy engine、full budget algorithm 等後續方向。

## Dogfood 證據與限制

[docs/dogfood/vitest-2026-05-09.md](docs/dogfood/vitest-2026-05-09.md) 記錄了第二個 brownfield dogfood，target 為公開 monorepo `vitest-dev/vitest`，並固定在 commit `d77e93659d1703f9d96b58373b38738bf190289e` 進行 read-only 驗證。這份 evidence 顯示 deterministic issue-to-context flow 已足以產生可用的 planning context，也能看見 diagnostics、truncation metadata 與 path caveats，因此可支持 README 以保守方式前進。
但該次 dogfood 的結論是 WARN / caveated evidence，不是 unconditional PASS：它不支持「所有 brownfield repo 都 production-ready」的宣稱，也不支持 monorepo resolver 已完成的宣稱。對 monorepo 的現況是 #205 提供 docs guidance，而非 runtime resolver。
同時，本 repo 仍維持邊界：#206 傳統中文 classifier 仍是 evidence-gated、#149 supervised remediation 仍是 parked/design-only、`spec-injector` 不做 target repo mutation 或自動修復/合併。

## 目前能力

- 將 GitHub issue 編譯為 bounded、agent-ready 的 task context；可參考 [issue-to-context pipeline](docs/issue-to-context-pipeline.md)。
- 顯示 source references 與診斷資訊，讓缺漏或不可讀 context 保持可見；可參考 [workflow](docs/workflow.md) 與 [validation](docs/validation.md)。
- 以 source trust 與 context-budget 設計約束 task package 邊界；可參考 [source trust](docs/source-trust.md)。
- 支援 human-reviewed 的 validation / evidence / readback 與 review finding 分類流程；可參考 [workflow](docs/workflow.md) 與 [validation](docs/validation.md)。
- 提供 read-only 的 `spec evidence-check` / `spec label-audit` guardrails，僅報告 workflow 風險、不做 approval / merge / metadata mutation；可參考 [label taxonomy](docs/label-taxonomy.md)。
- 將 companion / status / remediation 相關方向保留為 design-only，不視為已實作功能；可參考 [current capability showcase planning doc](docs/readme-current-capability-showcase.md) 與 [readme showcase readiness](docs/readme-showcase-readiness.md)。

## Quickstart

Requirements:

- Node.js 24 LTS
- pnpm via Corepack
- authenticated [`gh`](https://cli.github.com/)

Local development install:

```bash
git clone https://github.com/Erick52106/spec-injector.git
cd spec-injector
corepack enable
pnpm install
pnpm build
pnpm test
pnpm link --global
spec --help
```

Use `spec-injector` in a target repo:

```bash
cd /path/to/target-repo
spec init --repo .
spec validate --repo .
spec config suggest always-read --repo .
spec plan <issue-number-or-url> --repo . --dry-run --format prompt --verbose
spec workflow-check --repo . --phase start --issue <issue-number-or-url>
spec workflow-check --repo . --phase commit --pr-body /path/to/pr-body.md
spec workflow-check --repo . --phase merge --pr-body /path/to/pr-body.md --head-sha <sha>
spec workflow-check --repo . --phase commit --pr-body /path/to/pr-body.md --routing-evidence /path/to/start-gate.json
spec awp-review-check --repo . --evidence /path/to/awp-review-evidence.json
spec workflow-check --repo . --phase merge --pr-body /path/to/pr-body.md --finding-disposition /path/to/findings.json
spec workflow-check --repo . --phase merge --pr-body /path/to/pr-body.md --threshold-evidence /path/to/threshold.json
spec workflow-check --repo . --phase merge --pr <number-or-url> --format json
spec doctor --workflow awp --format json
```

Notes:

- `spec init --repo .` creates `.spec-injector/config.json` and `.spec-injector/.gitignore`.
- `spec validate --repo .` validates config schema v2 and reports configured discovery / guardrails.
- `spec config suggest always-read --repo .` prints deterministic suggestions only; it does not modify config.
- `spec plan ... --dry-run --format prompt --verbose` is the recommended pre-implementation command for AI planning.
- For a full generated task package file, omit `--dry-run`; output is written under `.spec-injector/out/`.
- `spec workflow-check` is a local-only, stdout-first workflow gate for autonomous PR evidence. It does not edit GitHub, add/commit files, write task packages, comment, merge, or mutate downstream repos.
- Autonomous worker-routing flow 可在 implementation 開始前使用 [Hybrid AWP routing policy](docs/hybrid-awp-routing-policy.md) 作為 start-gate source of truth。
- Downstream AI entrypoints 可引用 [AI bootstrap install contract](docs/ai-bootstrap-install-contract.md)，用 `SPEC_INJECTOR_DIR` local runner fallback 與 `spec doctor --workflow awp --format json` 檢查 AWP capability，不需要 global install。
- `spec workflow-check --format json` emits the same stable fields as the text output: `phase`, `status`, `repo`, `head_sha`, `checked_at`, `missing_fields`, `warnings`, and `evidence_summary`.
- Hybrid AWP checks add optional JSON/text fields such as `routing_mode`, `routing_task_class`, `spark_required`, `worker_5_4_required`, `controller_role`, `controller_fallback`, `controller_fallback_reason`, `fallback_status`, `fallback_reason_quality`, `routing_mismatch`, `human_review_status`, and `draft_status`.
- Downstream repos such as `tachigo` / `tachiya` only need to copy or reference the workflow-check `status` and evidence `ref` in their PR body / ledger. Their Scope Police workflows should not parse full `spec plan` or task-package evidence. See the [target repo adoption contract](docs/target-repo-adoption-contract.md).
- AWP review follow-up 可使用 [AWP review triage gates](docs/awp-review-triage-gates.md) 與 `spec awp-review-check --repo . --evidence <path>` 檢查 review batch freshness、duplicate collapse、root-cause gate、patch budget 與 closeout ledger。這個 checker 只讀 local JSON，不讀寫 GitHub、不 resolve thread、不 auto-fix、不 merge。

`spec workflow-check` phases:

- `start`: validates repo config. With `--issue`, it performs a dry-run bounded context check through `spec plan --dry-run --format prompt --verbose` without writing a task package. If the issue has an AWP / Codex autonomous routing signal, it also emits a deterministic Hybrid AWP routing plan; if no autonomous signal is present, routing fields are `n/a` and ordinary workflows do not fail.
- `commit`: checks staged files for `.spec-injector/`, generated task packages / spec output, and private context artifacts. With `--pr-body`, it also checks for spec gate status/ref or manual fallback evidence. With `--routing-evidence`, it checks local PR body routing status/ref, delegation log, Spark / ops evidence, 5.4 worker evidence, and explicit fallback quality.
- `merge`: checks a local PR body for final merge gate evidence, spec gate status/ref, and latest HEAD SHA. With `--head-sha`, stale or mismatched evidence fails. With `--routing-evidence`, stale start-gate routing evidence or routing/PR-body mismatch fails.

## Optional live gh smoke test

`spec plan` 本身會透過真實的 `gh` CLI 讀取 GitHub issue，因此保留一個可選擇性的 live smoke test：

```bash
pnpm test:gh
```

此測試刻意是 `opt-in`，不會在 `pnpm test` / CI 中自動執行。它會驗證：

- `gh --version`
- `gh auth status --active --hostname github.com`
- `spec plan https://github.com/Erick52106/spec-injector/issues/61 --dry-run --format prompt`

執行結果會要求至少包含基本 prompt sections，確認 issue URL 解析與 `spec plan` 最小 live 讀取鏈路。它是 read-only smoke，非預設 CI gate，也不代表 approval authority。若環境未安裝 `gh` 或未登入，測試不會作為預設 regressions 阻擋；請先補齊環境後再執行。

Current local install and release details are documented in [docs/release.md](docs/release.md).

## Example workflow with Codex / Claude Code

`spec-injector` fits before implementation, not after code changes have already started:

```text
GitHub issue
  -> spec plan / task package
  -> AI implementation plan
  -> human approval
  -> AI implementation
  -> validation
  -> PR
  -> source issue implementation evidence
  -> PR body backfill
  -> human review / merge decision
```

For a Codex or Claude Code workflow, an AI implementer can run:

```bash
spec plan <issue-number-or-url> --repo . --dry-run --format prompt --verbose
```

The AI should then use that prompt output to draft an implementation plan. Human approval remains the gate before any repo files are modified.

Some teams may expose a repo-level `/spec-plan <issue>` shorthand in Claude Code or another AI tool. That shorthand is workflow glue, not a `spec-injector` runtime command. The actual CLI command remains `spec plan`.

See [docs/workflow.md](docs/workflow.md), [docs/workflows/README.md](docs/workflows/README.md), [docs/workflows/codex.md](docs/workflows/codex.md), and [docs/workflows/claude-code.md](docs/workflows/claude-code.md).

## Example output / task package overview

Full task package output is Markdown intended for human and AI review. It can include:

- issue metadata and issue body
- detected domains
- always-read references
- auto-discovered documentation
- auto-discovered source files
- source reference direction and trust context
- matched guardrails
- rule-matched documentation
- missing files
- unreadable / alias diagnostics where applicable
- suggested verification checklist and implementation evidence direction

Prompt output with `--format prompt` is shorter and designed for AI planning. It lists relevant references without inlining the full always-read docs, README content, discovered docs, or source snippets.

Task package details are documented in [docs/task-package.md](docs/task-package.md).

## Concepts

Key terms used across this project:

- **Issue-scoped context**：為單一 issue 收集的最小必要背景，不替 issue 以外的工作創造理由。
- **Deterministic compiler**：把 issue 與 repo-defined context 編譯成 repeatable Markdown output。
- **Domain classifier**：用 title、labels、body 中的 deterministic signals 選出 relevant domains。
- **Guardrail**：repo-defined constraint / reminder；提醒風險，但不授權擴 scope。
- **Reference**：task package 中列出的 docs、source files、built-in preset 或 issue-mentioned files。
- **Source trust**：標示 context 來源與信任方向，避免 auto-discovered reference 被誤讀成 human-approved scope。
- **Context budget**：限制 task package / prompt 的內容量與 include mode，讓 output 保持 bounded。
- **Read diagnostics**：missing、unreadable 或 alias hints 等 context health 訊號。
- **Task package**：AI 開工前使用的 structured context，不是 autonomous execution plan。
- **Implementation evidence**：PR 建立後寫回 source issue 的 structured comment。

完整詞彙請見 [docs/concepts.md](docs/concepts.md)。Classifier、references 與 guardrails 的細節分別見 [docs/classifier.md](docs/classifier.md)、[docs/references.md](docs/references.md)、[docs/guardrails.md](docs/guardrails.md)。Future request input adapter design 見 [docs/input-adapters.md](docs/input-adapters.md)，catalog / protocol vocabulary 見 [docs/catalog-protocol.md](docs/catalog-protocol.md)。Repo-local AI workflow contract design 見 [docs/internal-workflow-contract.md](docs/internal-workflow-contract.md)。

## Configuration

Target repo 的 `.spec-injector/config.json` 定義 project metadata、always-read references、discovery settings 與 guardrails：

```json
{
  "version": 2,
  "project": {
    "name": "example",
    "type": "fullstack"
  },
  "always_read": [],
  "discovery": {
    "docs": [],
    "source": ["src"],
    "exclude": ["node_modules", "dist", "docs/superpowers"],
    "max_docs": 5,
    "max_source_files": 5
  },
  "guardrails": [
    {
      "id": "database-change",
      "when_detected": ["database"],
      "risk": "Database/schema changes require explicit issue scope and migration review."
    }
  ]
}
```

Important fields:

- `always_read`：每次 task package 都應讀取的 repo instructions / architecture / security / workflow docs。
- `discovery.docs`：明確納入的 documentation paths。
- `discovery.source`：auto-discovery 掃描的 source directories。
- `discovery.exclude`：auto-discovery 排除的 paths / directories。
- `guardrails`：當 detected domains 命中 `when_detected` 時，將 `risk` message 加入 task package。

## Non-goals

`spec-injector` 明確不是：

- autonomous agent
- daemon
- hidden LLM wrapper
- hosted control-plane platform
- agent orchestration platform
- GitHub automation bot
- GitHub Projects / roadmap dashboard
- custom domain runtime
- full SDD lifecycle platform
- general-purpose RAG system
- semantic RAG / vector search product
- hidden LLM planner
- target repo auto-editing system
- multi-agent runtime
- companion runtime in CLI core
- remediation bot
- PR / merge automation service
- stable npm release promise

目前也不宣稱已完成：

- detailed classifier evidence visibility in task package
- repo-local custom domains runtime
- semantic embedding retrieval
- JSON / agent-oriented output
- user repo CI scaffold automation
- target repo branch protection setup

這些方向若要實作，應另開 issue、加入 tests，並更新對應 docs。

## Documentation links

- Agent instructions: [AGENTS.md](AGENTS.md)
- Agent handoff patterns: [docs/agent-handoff.md](docs/agent-handoff.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Issue-to-context pipeline: [docs/issue-to-context-pipeline.md](docs/issue-to-context-pipeline.md)
- Core concepts: [docs/concepts.md](docs/concepts.md)
- Catalog / protocol model: [docs/catalog-protocol.md](docs/catalog-protocol.md)
- Product moat thesis: [docs/product-moat.md](docs/product-moat.md)
- Brand architecture: [docs/brand-architecture.md](docs/brand-architecture.md)
- Positioning and adjacent workflows: [docs/positioning.md](docs/positioning.md)
- Classifier: [docs/classifier.md](docs/classifier.md)
- References: [docs/references.md](docs/references.md)
- Guardrails: [docs/guardrails.md](docs/guardrails.md)
- Visual asset workflow: [docs/visual-asset-workflow.md](docs/visual-asset-workflow.md)
- Task package: [docs/task-package.md](docs/task-package.md)
- Workflow: [docs/workflow.md](docs/workflow.md)
- Validation matrix and quality gates: [docs/validation.md](docs/validation.md)
- Dogfood: [docs/dogfood.md](docs/dogfood.md)
- Install / release strategy: [docs/release.md](docs/release.md)
- AI workflow guides: [docs/workflows/README.md](docs/workflows/README.md)
- Issue / PR conventions: [docs/conventions.md](docs/conventions.md)
- Layer model and future boundaries: [docs/design/layers.md](docs/design/layers.md)

## Roadmap / next layers

Current implemented layer:

- **Layer 1 deterministic CLI**：issue loading via `gh`, deterministic classifier, guardrail matching, reference collection, task package / prompt rendering, config helpers, clean command.

Documented future-facing layers:

- **Layer 2 Workflow Guardrails**：AI tool uses task package to draft an implementation plan, then waits for human approval before implementation.
- **Layer 3 Protocolization**：possible richer protocolized context handoff, while preserving deterministic and reviewable boundaries.
- **Layer 4 Companion UX**：human-facing summary quality, boundary statements, and handoff alignment, still design-oriented.

Future docs and design candidates include custom domains, richer classifier evidence visibility, JSON output, and optional user repo CI scaffolding. They are not part of the current runtime unless a later issue implements them explicitly.

## Current canonical layer model

`spec-injector` 的目前 canonical model 為 4-layer roadmap：

- Layer 1 — Core Compiler
- Layer 2 — Workflow Guardrails
- Layer 3 — Protocolization
- Layer 4 — Companion UX

若文件中仍存在舊版 3-layer 或其他歷史敘事，僅保留作為 terminology history / previous framing；不表示目前實作定位。

`#149 supervised remediation loop` 目前仍為 parked / design-only，不會被表示為 current capability，不作為 current implementation boundary；它在實作前仍需額外設計核可，且不得自動 auto-fix、auto-resolve、auto-merge、auto-close 或 mutate target repo。
