# spec-injector

A deterministic CLI that turns a GitHub issue into a ready-to-use task package before any coding starts. It reads the issue via `gh`, classifies it into domains via keyword matching, matches it against guardrails you define in your repo, auto-discovers relevant docs and source files, and writes a structured markdown file — no AI, no network calls beyond `gh`.

## 中文說明（繁體）

一個確定性的 CLI 工具，在開始寫程式前，將 GitHub Issue 轉換成可立即使用的任務包。它透過 `gh` 讀取 Issue，透過關鍵字比對進行領域分類，對應你在 repo 裡定義的風險護欄 (Guardrails)，自動探索相關文件與原始碼，並輸出一份結構化的 Markdown 檔案 — 無須 AI，除 `gh` 外無其他網路請求。

---

## Install

For the current local development install and release strategy, see [docs/release.md](docs/release.md).

```bash
npm install
npm run build
npm test
npm link
spec --help
```

Requires: Node.js 20+, [`gh`](https://cli.github.com/) authenticated.

---

## Design Docs

- Layer model: [docs/design/layers.md](docs/design/layers.md)
- Custom domains and AI-assisted suggestions: [docs/design/custom-domains.md](docs/design/custom-domains.md)
- Optional user repo CI scaffold: [docs/design/user-repo-ci-scaffold.md](docs/design/user-repo-ci-scaffold.md)
- CLI help and UX audit: [docs/cli-help-ux-audit.md](docs/cli-help-ux-audit.md)
- Conventions: [docs/conventions.md](docs/conventions.md)
- Release strategy: [docs/release.md](docs/release.md)
- `always_read` suggestions: [docs/always-read-suggestions.md](docs/always-read-suggestions.md)
- AI workflow guides: [docs/workflows/README.md](docs/workflows/README.md)

---

## Usage

### AI Workflow Usage

人類可在 Claude Code 中輸入 `/spec-plan <issue>`，讓 AI 先執行：

```bash
spec plan <issue> --repo . --dry-run --format prompt --verbose
```

AI 會先產生 implementation plan，並在人類批准後才進入實作。這是 repo-level instruction，不是 spec-injector runtime CLI command；真正的 CLI command 仍是 `spec plan`。

### 1. Initialize a repo

```bash
spec init
spec init --repo /path/to/repo
```

Creates `.spec-injector/config.json` and `.spec-injector/.gitignore` (ignores `out/`) in the target repo.

### 2. Generate a task package

```bash
spec plan <issue-url>
spec plan <issue-number> --repo /path/to/repo
spec plan <issue-url> --dry-run    # print to stdout, don't write file
spec plan <issue-url> --verbose    # show detailed pipeline steps
spec plan <issue-url> --format prompt  # short AI planning prompt
```

The pipeline:
1. **Fetch**: Retrieves issue title, labels, and body via `gh` CLI.
2. **Classify & Match**: Keyword-based domain detection; matched domains trigger `guardrails`.
3. **Load Docs & Source**: Loads `always_read` and `discovery.docs`; auto-discovers docs and source files; reports missing files.
4. **Render**: Writes task package to `.spec-injector/out/issue-<number>-task-package.md` (or prints with `--dry-run`).

By default, `spec plan` renders the full task package with inline context. Use `--format prompt` when a Layer 2 workflow or another AI should draft an implementation plan first: prompt output lists relevant references only, without inlining always-read docs, README content, discovered docs, or source snippets.

### 3. Validate config

```bash
spec validate
spec validate --repo /path/to/repo
```

Validates `.spec-injector/config.json` against the v2 schema and prints project metadata, always-read counts, discovery stats, and configured guardrails.

### 4. Manage always_read files

```bash
spec config list --repo .
spec config suggest always-read --repo .
spec config add always-read docs/security.md --repo .
spec config remove always-read AGENTS.md --repo .
```

The `suggest always-read` helper scans repo-level and common docs locations, then uses deterministic scoring to print candidate files with reasons. It does not modify `.spec-injector/config.json`; to add a suggestion, run `spec config add always-read <path> --repo .`. See [docs/always-read-suggestions.md](docs/always-read-suggestions.md) for the scan scope, exclusions, and confidence guidance.

The `spec config` command currently manages the `always_read` list in `.spec-injector/config.json` and can suggest likely `always_read` candidates.

### 5. Clean generated task packages

```bash
spec clean --repo /path/to/repo
spec clean --repo /path/to/repo --issue 21
```

Removes only generated task package files matching `.spec-injector/out/issue-<number>-task-package.md`. Other files in `out/`, `.spec-injector/config.json`, `.spec-injector/.gitignore`, and repo docs are left untouched.

### 使用方式（中文）

1. **初始化**：在目標 repo 執行 `spec init`，建立 `.spec-injector/config.json` 設定檔與 `.gitignore`（自動忽略 `out/` 目錄）。
2. **產生任務包**：執行 `spec plan <issue-url>`。工具會依序執行：抓取 Issue、關鍵字領域分類、比對風險護欄、載入文件（固定載入與自動探索）、探索相關原始碼，最後將結果寫入 `.spec-injector/out/issue-<number>-task-package.md`。
3. **驗證設定**：執行 `spec validate` 確認 `config.json` 格式正確，並查看專案資訊、探索設定與護欄清單。
4. **管理 always_read**：執行 `spec config list --repo .` 查看必讀文件，或用 `spec config suggest always-read --repo .` 以 deterministic scoring 掃描候選文件與 reasons；suggest 不會修改 config，若要加入請再執行 `spec config add always-read <path> --repo .`。也可用 `spec config add always-read docs/security.md --repo .` 與 `spec config remove always-read AGENTS.md --repo .` 更新清單。目前只支援管理與建議 `always_read`；掃描範圍與 confidence 說明請見 `docs/always-read-suggestions.md`。
5. **清理任務包**：執行 `spec clean --repo .` 清理 `.spec-injector/out/` 中符合 `issue-<number>-task-package.md` 命名的 generated task packages；也可用 `--issue <number>` 只清理單一 issue。

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
  "always_read": [],
  "discovery": {
    "docs": [],
    "source": [
      "src"
    ],
    "exclude": [
      "node_modules",
      "dist",
      "docs/superpowers"
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

### Field Descriptions

- **version**: Must be `2`.
- **project.name / project.type**: Metadata for display in validation and reports.
- **always_read**: Team-defined files that should always be checked for every task package. The default is empty; teams can add their own workflow, security, or architecture docs.
  - Examples include `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `CURSOR.md`, `WINDSURF.md`, `docs/ai-guidelines.md`, `docs/security.md`, or `docs/architecture.md`.
  - Missing `always_read` files are reported under **Missing Files** by `spec plan`; this warning means the config should be checked and is not necessarily a tool failure. Missing `always_read` files are not treated as fatal plan errors.
  - In prompt mode, found `always_read` files are listed as references; their full contents are not inlined.
- **discovery.docs**: Explicit paths to documentation files to always include.
- **discovery.source**: Directories to scan for auto-discovered source files.
- **discovery.exclude**: Paths or directories to skip during auto-discovery. Use it to keep generated planning docs, AI scratch docs, and temporary agent notes out of task packages; for example, add a repo-local scratch directory such as `docs/superpowers` when you use one.
- **discovery.max_docs**: Maximum number of auto-discovered docs (default: 5).
- **discovery.max_source_files**: Maximum number of auto-discovered source files (default: 5).
- **guardrails**:
  - `id`: Unique identifier for the guardrail.
  - `when_detected`: List of domains that trigger this guardrail.
  - `risk`: Warning message included in the task package when triggered.

---

## Conventions

For issue labels and issue/PR title conventions, see [docs/conventions.md](docs/conventions.md).

---

## Domain Classification

Domain classification is entirely deterministic and keyword-based. No LLMs or external APIs are used. Keywords found in the issue title (weight 3), labels (weight 2), and body (weight 1) are scored, and the top 5 domains are returned.

Supported domains: `frontend`, `backend`, `api`, `auth`, `database`, `infra`, `cloud-storage`, `blockchain`, `smart-contract`, `wallet`, `i18n`, `testing`, `docs`, `ci`, `tooling`.

---

## What this is not

spec-injector is a **deterministic workflow tool**, not an autonomous agent. It makes no AI or API calls. Given the same issue and the same `config.json`, it always produces the same output.

### 設計理念（中文）

spec-injector **不是** AI agent，也不會自動決策或呼叫任何模型。它是一個確定性工具：給定相同的 Issue 與 `config.json`，永遠產生相同的輸出。設計目標是藉由領域識別、風險護欄提醒、以及文件與程式碼的自動匯整，讓開發者在動手寫程式前，先有一份高品質且脈絡完整的任務說明，而不是讓工具代替開發者思考。
