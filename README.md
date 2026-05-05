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
- read-only workflow guardrails 可以檢查 label / milestone taxonomy、PR evidence readback 與 optional live `gh` smoke path，但不自動修 metadata 或 merge
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
```

Notes:

- `spec init --repo .` creates `.spec-injector/config.json` and `.spec-injector/.gitignore`.
- `spec validate --repo .` validates config schema v2 and reports configured discovery / guardrails.
- `spec config suggest always-read --repo .` prints deterministic suggestions only; it does not modify config.
- `spec plan ... --dry-run --format prompt --verbose` is the recommended pre-implementation command for AI planning.
- For a full generated task package file, omit `--dry-run`; output is written under `.spec-injector/out/`.

## Optional live gh smoke test

`spec plan` 本身會透過真實的 `gh` CLI 讀取 GitHub issue，因此保留一個可選擇性的 live smoke test：

```bash
pnpm test:gh
```

此測試刻意是 `opt-in`，不會在 `pnpm test` / CI 中自動執行。它會驗證：

- `gh --version`
- `gh auth status --active --hostname github.com`
- `spec plan https://github.com/Erick52106/spec-injector/issues/61 --dry-run --format prompt`

執行結果會要求至少包含基本 prompt sections，確認 issue URL 解析與 `spec plan` 最小 live 讀取鏈路。若環境未安裝 `gh` 或未登入，測試不會作為預設 regressions 阻擋；請先補齊環境後再執行。

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

- **Layer 2 AI workflow**：AI tool uses task package to draft an implementation plan, then waits for human approval before implementation.
- **Layer 3 future agent interface**：possible structured outputs or richer agent-facing integrations, while preserving deterministic and reviewable boundaries.

Future docs and design candidates include custom domains, richer classifier evidence visibility, JSON output, and optional user repo CI scaffolding. They are not part of the current runtime unless a later issue implements them explicitly.
