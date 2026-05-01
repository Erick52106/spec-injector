# spec-injector

A deterministic CLI that turns a GitHub issue into a ready-to-use task package before any coding starts. It reads the issue via `gh`, matches it against rules you define in your repo, loads the relevant docs, and writes a structured markdown file — no AI, no network calls beyond `gh`.

## 中文說明（繁體）

一個確定性的 CLI 工具，在開始寫程式前，將 GitHub Issue 轉換成可立即使用的任務包。它透過 `gh` 讀取 Issue，依照你在 repo 裡定義的規則進行比對，載入相關文件，並輸出一份結構化的 Markdown 檔案。

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

Creates `.spec-injector/rules.json` and `.spec-injector/.gitignore` in the target repo.

### 2. Generate a task package

```bash
spec plan <issue-url>
spec plan <issue-number> --repo /path/to/repo
spec plan <issue-url> --dry-run    # print to stdout, don't write file
spec plan <issue-url> --verbose    # show matching steps
```

Output: `.spec-injector/out/issue-<number>-task-package.md`

### 3. Validate config

```bash
spec validate
spec validate --repo /path/to/repo
```

### 使用方式（中文）

1. **初始化**：在目標 repo 執行 `spec init`，建立 `.spec-injector/rules.json` 設定檔。
2. **產生任務包**：執行 `spec plan <issue-url>`，工具會自動比對規則、載入文件，並將結果寫入 `.spec-injector/out/issue-<number>-task-package.md`。
3. **驗證設定**：執行 `spec validate` 確認 `rules.json` 格式正確。

---

## Configuration

Edit `.spec-injector/rules.json` in your target repo:

```json
{
  "version": 1,
  "rules": [
    {
      "id": "backend",
      "description": "Backend changes",
      "match": {
        "title_contains": ["[backend]"],
        "label_contains": ["backend"],
        "body_contains": []
      },
      "docs": ["docs/architecture.md"],
      "hints": ["Follow existing patterns in the codebase"]
    }
  ],
  "defaults": {
    "docs": ["README.md"],
    "hints": ["Check existing patterns before implementing"]
  }
}
```

Rules are matched against issue title, labels, and body (case-insensitive, OR logic). All matching rules are merged. If nothing matches, `defaults` is used.

Doc paths must be relative and stay inside the target repo.

---

## What this is not

spec-injector is a **deterministic workflow tool**, not an autonomous agent. It makes no AI or API calls. Given the same issue and the same `rules.json`, it always produces the same output.

### 設計理念（中文）

spec-injector **不是** AI agent，也不會自動決策或呼叫任何模型。它是一個確定性工具：給定相同的 Issue 與 `rules.json`，永遠產生相同的輸出。設計目標是讓開發者在動手寫程式前，先有一份明確的任務說明，而不是讓工具代替開發者思考。
