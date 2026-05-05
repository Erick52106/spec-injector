Language: [繁體中文](README.md) | English

# spec-injector

`spec-injector` is currently a deterministic GitHub issue-to-context compiler for AI coding agents.

It compiles GitHub issues, repo docs, source references, source trust direction, guardrails, validation hints, and the target repo's `.spec-injector/config.json` into a bounded task package / prompt that an AI coding agent can use directly before starting work.

Broader deterministic request-to-context adapters for fuzzy requests, markdown briefs, or PR review notes are a future design direction; the implemented and repo-governed path today remains GitHub issue-to-context, not a hidden LLM planner.

Its goal is not to replace humans or AI writing code, but to let Codex, Claude Code, or other implementers obtain checkable, repeatable work context constrained by repo configuration before modifying any files.

Core positioning:

- issue-scoped today: currently uses a single GitHub issue as the scope source of truth, while keeping future request adapters behind deterministic design boundaries
- brownfield-friendly: designed around existing GitHub issues, repo docs, source references, and repo-specific workflow rules
- repo-safe: reads target repo context, but does not automatically modify target repo code
- deterministic: the same issue, repo files, and config should produce stable output
- source-trust aware: distinguishes repo instructions, always-read docs, issue-mentioned paths, auto-discovered references, and diagnostics
- context-budget aware: emits bounded context instead of stuffing the whole repo into a prompt
- guardrails-aware: maps detected domains to repo-defined constraints / reminders
- evidence-oriented: treats validation hints, issue evidence, PR body backfill, and review closeout as part of the handoff workflow
- agent-agnostic: emits Markdown task packages / prompts for Codex, Claude Code, or other AI coding agents
- no hidden LLM: does not call a hidden LLM, external AI API, or local model

## Why this exists

Common AI coding agent failures are usually not about being unable to write code, but about starting work without clear enough boundaries:

- issue body, repo instructions, architecture docs, source references, and validation rules are scattered across different places
- AI may start changing files first and fill in context later, causing scope creep
- reviewers have a hard time tracing whether an implementation really followed the source issue
- repo-specific guardrails are easy to forget, such as database, auth, CI, or docs-only work
- stale paths, renamed files, missing docs, or unreadable source in brownfield repos can become hidden assumptions

`spec-injector` organizes the information that should be read before implementation into one structured Markdown output. It lets an implementer read the task package first, then produce an implementation plan, and start modifying files only after human approval.

## Core guarantees

The Layer 1 CLI of `spec-injector` guarantees these boundaries:

- reads GitHub issues through `gh`; beyond `gh` itself, it makes no other hidden network calls
- classifier uses deterministic keyword scoring, not an LLM classifier
- references selection is deterministic repo scan / scoring, not semantic RAG
- guardrails come from target repo config and are constraints / reminders, not approval
- `spec plan --dry-run` only outputs to stdout and does not write a task package
- non-dry-run output from `spec plan` only writes to `.spec-injector/out/issue-<number>-task-package.md`
- task packages can surface missing files, unreadable files, path alias hints, and validation checklists so context gaps are visible
- read-only workflow guardrails can check label / milestone taxonomy, PR evidence readback, and the optional live `gh` smoke path, but do not auto-fix metadata or merge
- mutating commands must be explicit command behavior, such as `spec init`, `spec config add/remove always-read`, or `spec clean`
- CLI core does not automatically create branches, commits, PRs, issue comments, or modify target repo source code

For more architecture boundaries, see [docs/architecture.md](docs/architecture.md).

## How it works

`spec plan <issue>` runs this pipeline:

1. **Issue Loader**: reads issue title, labels, and body through the authenticated `gh` CLI.
2. **Issue Parser**: extracts issue text, explicitly mentioned repo-relative paths, and checklist items.
3. **Domain Classifier**: detects relevant domains with deterministic keyword scoring.
4. **Guardrail Matcher**: matches detected domains against guardrails in `.spec-injector/config.json`.
5. **Reference Collector**: collects built-in presets, repo `always_read`, configured docs, issue-mentioned files, and auto-discovered docs / source references.
6. **Diagnostics / Validation Direction**: preserves missing / unreadable / alias hints and the suggested verification checklist.
7. **Task Package Renderer**: outputs either the full task package or the compact AI planning prompt for `--format prompt`.

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

The current implemented / documented capabilities can be understood in four stages:

| Stage | What happens | Boundary |
| --- | --- | --- |
| Input | Reads GitHub issues, repo config, repo docs, issue-mentioned paths, and configured discovery sources. | GitHub issue input is implemented today; future fuzzy request input remains a design direction. |
| Compile | Uses deterministic parser / classifier / reference collector behavior to combine guardrails, source references, diagnostics, and validation hints. | No hidden LLM, semantic RAG, or vector DB. |
| Output | Produces a bounded Markdown task package or compact planning prompt for an AI coding agent to read before implementation. | Output is handoff context, not an autonomous execution plan. |
| Verify | Repo workflow docs define validation, implementation evidence comments, PR body evidence URLs, HEAD/readback checks, and review closeout. | Workflow guardrails are read-only / human-reviewed discipline, not a merge bot or remediation automation. |

## Current capabilities

- Compiles GitHub issues into bounded, agent-ready task context; see [issue-to-context pipeline](docs/issue-to-context-pipeline.md).
- Surfaces references and diagnostics so missing or unreadable context remains visible; see [workflow](docs/workflow.md) and [validation](docs/validation.md).
- Uses source trust and context-budget design to keep task packages bounded; see [source trust](docs/source-trust.md).
- Supports human-reviewed validation, evidence, readback, and finding-assessment workflows; see [workflow](docs/workflow.md) and [validation](docs/validation.md).
- Includes read-only workflow guardrails like label/milestone audit; see [label taxonomy](docs/label-taxonomy.md).
- Keeps companion, status, and remediation ideas documented as design-only, not shipped runtime behavior; see [current capability showcase planning doc](docs/readme-current-capability-showcase.md) and [readme showcase readiness](docs/readme-showcase-readiness.md).

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

`spec plan` reads GitHub issues through the real `gh` CLI, so the repo keeps an optional live smoke test:

```bash
pnpm test:gh
```

This test is intentionally `opt-in`; it does not run automatically in `pnpm test` or CI. It verifies:

- `gh --version`
- `gh auth status --active --hostname github.com`
- `spec plan https://github.com/Erick52106/spec-injector/issues/61 --dry-run --format prompt`

The result must include the basic prompt sections, confirming issue URL parsing and the minimal live `spec plan` read path. If the environment does not have `gh` installed or authenticated, this test is not a default regression blocker; set up the environment first, then run it explicitly.

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

- **Issue-scoped context**: the minimum necessary background collected for a single issue; it does not create reasons to do work outside that issue.
- **Deterministic compiler**: compiles an issue and repo-defined context into repeatable Markdown output.
- **Domain classifier**: uses deterministic signals in title, labels, and body to select relevant domains.
- **Guardrail**: repo-defined constraint / reminder; it highlights risk, but does not authorize scope expansion.
- **Reference**: docs, source files, built-in presets, or issue-mentioned files listed in a task package.
- **Source trust**: labels where context came from and how it should be trusted, so auto-discovered references are not mistaken for human-approved scope.
- **Context budget**: constrains task package / prompt size and include mode so output stays bounded.
- **Read diagnostics**: context health signals such as missing files, unreadable files, or alias hints.
- **Task package**: structured context used before AI starts work; it is not an autonomous execution plan.
- **Implementation evidence**: the structured comment written back to the source issue after PR creation.

For the full glossary, see [docs/concepts.md](docs/concepts.md). Classifier, references, and guardrails details are in [docs/classifier.md](docs/classifier.md), [docs/references.md](docs/references.md), and [docs/guardrails.md](docs/guardrails.md). Future request input adapter design is in [docs/input-adapters.md](docs/input-adapters.md), catalog / protocol vocabulary is in [docs/catalog-protocol.md](docs/catalog-protocol.md), and repo-local AI workflow contract design is in [docs/internal-workflow-contract.md](docs/internal-workflow-contract.md).

## Configuration

The target repo's `.spec-injector/config.json` defines project metadata, always-read references, discovery settings, and guardrails:

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

- `always_read`: repo instructions / architecture / security / workflow docs that should be read for every task package.
- `discovery.docs`: documentation paths explicitly included.
- `discovery.source`: source directories scanned by auto-discovery.
- `discovery.exclude`: paths / directories excluded from auto-discovery.
- `guardrails`: when detected domains match `when_detected`, adds the `risk` message to the task package.

## Non-goals

`spec-injector` explicitly is not:

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

It also does not currently claim these are complete:

- detailed classifier evidence visibility in task package
- repo-local custom domains runtime
- semantic embedding retrieval
- JSON / agent-oriented output
- user repo CI scaffold automation
- target repo branch protection setup

These directions should get separate issues, tests, and corresponding docs updates before being implemented.

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

- **Layer 1 deterministic CLI**: issue loading via `gh`, deterministic classifier, guardrail matching, reference collection, task package / prompt rendering, config helpers, clean command.

Documented future-facing layers:

- **Layer 2 AI workflow**: AI tool uses task package to draft an implementation plan, then waits for human approval before implementation.
- **Layer 3 future agent interface**: possible structured outputs or richer agent-facing integrations, while preserving deterministic and reviewable boundaries.

Future docs and design candidates include custom domains, richer classifier evidence visibility, JSON output, and optional user repo CI scaffolding. They are not part of the current runtime unless a later issue implements them explicitly.
