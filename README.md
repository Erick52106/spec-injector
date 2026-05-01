# spec-injector

A deterministic CLI that turns a GitHub issue into a ready-to-use task package before any coding starts. It reads the issue via `gh`, classifies domains using keyword matching, loads relevant docs, and writes a structured markdown file — no AI, no LLM, no network calls beyond `gh`.

## 中文說明（繁體）

一個確定性的 CLI 工具，在開始寫程式前，將 GitHub Issue 轉換成可立即使用的任務包。它透過 `gh` 讀取 Issue，以關鍵字比對進行 domain 分類，載入相關文件，並輸出結構化的 Markdown 檔案。不呼叫任何 AI / LLM / 外部模型。

---

## Install

```bash
npm install -g spec-injector
# or link locally during development
npm link
```

Requires: Node.js 20+, [`gh`](https://cli.github.com/) authenticated.

---

## Usage

### 1. Initialize a repo

```bash
spec init
spec init --repo /path/to/repo
```

Creates `.spec-injector/config.json` and `.spec-injector/.gitignore` (which ignores `out/`) in the target repo.

### 2. Generate a task package

```bash
spec plan <issue-url>
spec plan <issue-number> --repo /path/to/repo
spec plan <issue-url> --dry-run    # print to stdout, don't write file
spec plan <issue-url> --verbose    # show pipeline steps
```

Output: `.spec-injector/out/issue-<number>-task-package.md`

**What `spec plan` does (pipeline):**

1. Fetches issue content via `gh` (title, body, labels)
2. Classifies detected domains — deterministic keyword matching, no LLM (see [Domain Classification](#domain-classification))
3. Matches guardrails by detected domains
4. Loads `always_read` files into the task package
5. Loads explicit `discovery.docs` paths
6. Auto-discovers relevant docs (keyword match in filenames, up to `max_docs`)
7. Auto-discovers source files from `discovery.source` dirs (up to `max_source_files`)
8. Reports missing files (those listed in `always_read` / `discovery.docs` that don't exist)
9. Renders the task package (detected domains / always-read files / auto-discovered docs / source files / matched guardrails / missing files / implementation constraints / suggested verification checklist)

Console output example:
```
✓ Issue #42 fetched: [backend] Add rate limiting
✓ Detected domains: backend, api
✓ Guardrails matched: database-change
✓ Docs — always: 2, discovered: 3, explicit: 1, missing: 0, sources: 4
✓ Task package written: .spec-injector/out/issue-42-task-package.md
```

### 3. Validate config

```bash
spec validate
spec validate --repo /path/to/repo
```

Loads and validates `.spec-injector/config.json` against the v2 schema. Prints version, project metadata, `always_read` count, discovery stats, and each guardrail with its `when_detected` triggers and risk message.

### 使用方式（中文）

1. **初始化**：在目標 repo 執行 `spec init`，建立 `.spec-injector/config.json` 設定檔。
2. **產生任務包**：執行 `spec plan <issue-url>`，工具會自動分類 domain、比對 guardrails、載入文件，並將結果寫入 `.spec-injector/out/issue-<number>-task-package.md`。
3. **驗證設定**：執行 `spec validate` 確認 `config.json` 格式正確，並顯示目前設定摘要。

---

## Configuration

Edit `.spec-injector/config.json` in your target repo:

```json
{
  "version": 2,
  "project": {
    "name": "example",
    "type": "fullstack"
  },
  "always_read": [
    "CLAUDE.md",
    "AGENTS.md"
  ],
  "discovery": {
    "docs": [
      "docs/architecture.md"
    ],
    "source": [
      "src"
    ],
    "exclude": [
      "node_modules",
      "dist"
    ],
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

### Field reference

| Field | Type | Description |
|---|---|---|
| `version` | `2` | Must be `2`. Older v1 `rules.json` is not supported. |
| `project.name` | string | Project display name (metadata only) |
| `project.type` | string | Project type, e.g. `fullstack`, `backend` (metadata only) |
| `always_read` | string[] | Files loaded into every task package regardless of issue content |
| `discovery.docs` | string[] | Explicit doc paths always included in the task package |
| `discovery.source` | string[] | Directories searched for auto-discovered source files |
| `discovery.exclude` | string[] | Paths/directories skipped during auto-discovery |
| `discovery.max_docs` | number | Cap for auto-discovered docs (default: `5`) |
| `discovery.max_source_files` | number | Cap for auto-discovered source files (default: `5`) |
| `guardrails[].id` | string | Identifier shown in task package and console output |
| `guardrails[].when_detected` | string[] | Domain names that trigger this guardrail |
| `guardrails[].risk` | string | Risk message included in the task package |

All file paths in `always_read`, `discovery.docs`, and `discovery.source` must be relative paths inside the target repo.

### 設定說明（中文）

- `always_read`：無論 Issue 內容為何，每次都會載入這些檔案（例如 `CLAUDE.md`、`AGENTS.md`）
- `discovery.docs`：明確指定要納入任務包的文件路徑
- `discovery.source`：指定 source code 目錄，供 `spec plan` 自動探索相關原始碼
- `discovery.exclude`：自動探索時排除的路徑（例如 `node_modules`、`dist`）
- `guardrails`：當偵測到對應 domain 時，將風險說明注入任務包

---

## Domain Classification

`spec plan` classifies an issue into domains by matching keywords in the issue **title** (weight 3), **labels** (weight 2), and **body** (weight 1). Up to 5 domains are returned, ranked by total score.

This is **entirely deterministic** — no LLM, no API call, no local model. The same issue always produces the same domain list.

Available domains and example trigger keywords:

| Domain | Example keywords |
|---|---|
| `frontend` | ui, component, react, css, form, layout |
| `backend` | server, service, handler, middleware, worker |
| `api` | api, endpoint, rest, graphql, route, webhook |
| `auth` | auth, login, token, jwt, oauth, permission |
| `database` | database, migration, schema, query, orm |
| `infra` | deploy, docker, kubernetes, terraform, nginx |
| `cloud-storage` | s3, gcs, bucket, upload, cdn |
| `blockchain` | blockchain, ethereum, solana, web3 |
| `smart-contract` | solidity, contract, abi, evm |
| `wallet` | wallet, private key, sign, transaction |
| `i18n` | i18n, locale, translation, language |
| `testing` | test, unit, integration, e2e, mock, coverage |
| `docs` | docs, readme, guide, changelog |
| `ci` | ci, cd, pipeline, github action, workflow |
| `tooling` | lint, eslint, cli, config, npm |

Guardrails are matched when any value in `when_detected` appears in the detected domain list.

### Domain 分類說明（中文）

`spec plan` 以關鍵字比對方式分析 Issue 的標題（權重 3）、標籤（2）、內文（1），最多輸出 5 個 domain。整個流程為確定性計算，不使用任何 AI / LLM / 外部 API。Guardrails 的觸發條件即為 `when_detected` 中的 domain 名稱。

---

## What this is not

spec-injector is a **deterministic workflow tool**, not an autonomous agent. It makes no AI or API calls beyond `gh`. Given the same issue and the same `config.json`, it always produces the same output.

### 設計理念（中文）

spec-injector **不是** AI agent，也不會自動決策或呼叫任何模型。它是一個確定性工具：給定相同的 Issue 與 `config.json`，永遠產生相同的輸出。設計目標是讓開發者在動手寫程式前，先有一份明確的任務說明，而不是讓工具代替開發者思考。
