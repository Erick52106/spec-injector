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

Boundary note (current implementation):
- source-trust aware / context-budget aware is current guidance plus partial runtime support.
- Current runtime emits source labels / source categories, bounded snippets / item-count limits, and visible diagnostics.
- Current runtime does not ship a full trust-policy engine or a full token/byte context-budget algorithm.

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
- read-only workflow guardrails (including `spec evidence-check` / `spec label-audit`) are report/check only; `PASS` is not approval, and they do not auto-create/edit/delete metadata or merge
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

## Roadmap boundaries

This table keeps future docs and parked designs from being mistaken for current capability:

| Lane | Status | What it means | What it does not mean |
| --- | --- | --- | --- |
| Current | Implemented / documented today | deterministic GitHub issue-to-context compiler; bounded task package / prompt output; source labels / source categories; missing / unreadable / read failed diagnostics; visible truncation metadata; read-only `spec evidence-check` / `spec label-audit`; opt-in live `gh` smoke. | Not a hosted control plane, agent orchestration platform, merge bot, hidden LLM planner, semantic RAG / vector search, or target repo mutation system. |
| Current with caveat | Supported wording, partial runtime, or auxiliary report | source-trust vocabulary has partial runtime support, but is not a full policy engine; boundedness currently relies on item-count limits / truncation metadata, not a token / byte budget algorithm; monorepo support is guidance, not a full resolver; dogfood evidence is WARN / caveated; evidence-check / label-audit are auxiliary reports. | Does not mean approval authority, unconditional PASS, a complete monorepo package export resolver, or fully implemented future trust / budget policy. |
| Future / design-only | Direction only until separate implementation exists | catalog / protocol direction; stronger trust policy design; future budget policy design; companion / Spec Cat / status UX; more dogfood evidence; #206 zh-TW classifier work only if evidence supports it. | Does not mean Layer 3 / Layer 4 runtime exists, and does not mean #206 has shipped. |
| Parked | Explicitly not active implementation | #149 supervised remediation loop remains parked; thread-level review remediation must wait until safety prerequisites exist before it can be reconsidered. | Does not mean the remediation loop is current capability, and does not mean auto-fix / auto-resolve / auto-close / auto-merge can start. |
| Explicit non-goals / must not claim | Must stay out of README claims | Do not claim a hosted control plane, agent orchestration platform, merge bot, companion runtime, hidden LLM planner, RAG / vector search, target repo auto-editing, automatic monorepo package export resolver, or shipped zh-TW classifier. | Future docs, design records, and parked issues must not be packaged as current product behavior. |

## Current pipeline and documentation map

The current safe path is: a `request / GitHub issue` enters a deterministic issue parser / classifier, gathers repo docs, source references, and guardrails, preserves diagnostics such as missing / unreadable / alias hints, and emits a bounded task package / prompt for an AI coding agent to use inside a human-reviewed workflow. This current pipeline is a deterministic handoff context, not a hidden planner, target-repo mutation system, or merge automation path; implementation and merge decisions still stay with humans and repo workflow rules.

Key documentation map:

- [docs/issue-to-context-pipeline.md](docs/issue-to-context-pipeline.md): current pipeline and future-lane separation
- [docs/source-trust.md](docs/source-trust.md): source-trust vocabulary and bounded-context caveats
- [docs/validation.md](docs/validation.md): validation matrix and quality gates
- [docs/workflow.md](docs/workflow.md): issue-to-PR workflow guardrails
- [docs/cheatsheet.md](docs/cheatsheet.md): happy-path quick reference
- [docs/dogfood/vitest-2026-05-09.md](docs/dogfood/vitest-2026-05-09.md): caveated dogfood evidence
- [docs/design/layers.md](docs/design/layers.md): Layer 1-4 boundary model

At the boundary level, current capability includes the deterministic compiler, source labels/categories, diagnostics, visible truncation metadata, and read-only `spec evidence-check` / `spec label-audit` guardrails. Caveated areas include source-trust vocabulary as partial runtime support rather than a full policy engine, context budget as bounded snippets / item limits rather than a full token/byte algorithm, dogfood evidence as cautious progress, and monorepo support as documentation guidance rather than a resolver. Future / design-only work remains with #206 zh-TW classifier support, #149 supervised remediation-loop evaluation, and companion/status, full trust-policy, and full budget-algorithm directions.

## Dogfood evidence and limitations

[docs/dogfood/vitest-2026-05-09.md](docs/dogfood/vitest-2026-05-09.md) captures the second brownfield dogfood against the public monorepo target `vitest-dev/vitest`, pinned to commit `d77e93659d1703f9d96b58373b38738bf190289e`, and executed in read-only mode. The run shows the deterministic issue-to-context flow can produce useful planning context while keeping diagnostics, truncation metadata, and path caveats visible, so it supports cautious README progress.
However, the Vitest report is a WARN / caveated evidence result, not an unconditional PASS. It does not justify claims such as “production-ready for all brownfield repos,” and it does not claim a shipped monorepo resolver. Monorepo support remains #205 documentation guidance, not runtime resolver behavior.
Boundary status is unchanged: #206 Traditional Chinese classifier support remains evidence-gated, #149 supervised remediation remains parked/design-only, and `spec-injector` does not perform target repo mutation or automatic remediation/merge actions.

## Current capabilities

- Compiles GitHub issues into bounded, agent-ready task context; see [issue-to-context pipeline](docs/issue-to-context-pipeline.md).
- Surfaces references and diagnostics so missing or unreadable context remains visible; see [workflow](docs/workflow.md) and [validation](docs/validation.md).
- Uses source trust and context-budget design to keep task packages bounded; see [source trust](docs/source-trust.md).
- Supports human-reviewed validation, evidence, readback, and finding-assessment workflows; see [workflow](docs/workflow.md) and [validation](docs/validation.md).
- Includes read-only `spec evidence-check` / `spec label-audit` guardrails that report workflow risk only and do not provide approval, merge authority, or metadata mutation; see [label taxonomy](docs/label-taxonomy.md).
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
spec workflow-check --repo . --phase start --issue <issue-number-or-url>
spec workflow-check --repo . --phase commit --pr-body /path/to/pr-body.md
spec workflow-check --repo . --phase merge --pr-body /path/to/pr-body.md --head-sha <sha>
spec workflow-check --repo . --phase commit --pr-body /path/to/pr-body.md --routing-evidence /path/to/start-gate.json
spec awp-review-check --repo . --evidence /path/to/awp-review-evidence.json
spec workflow-check --repo . --phase merge --pr-body /path/to/pr-body.md --finding-disposition /path/to/findings.json
spec workflow-check --repo . --phase merge --pr-body /path/to/pr-body.md --threshold-evidence /path/to/threshold.json
spec workflow-check --repo . --phase merge --pr <number-or-url> --format json
```

Notes:

- `spec init --repo .` creates `.spec-injector/config.json` and `.spec-injector/.gitignore`.
- `spec validate --repo .` validates config schema v2 and reports configured discovery / guardrails.
- `spec config suggest always-read --repo .` prints deterministic suggestions only; it does not modify config.
- `spec plan ... --dry-run --format prompt --verbose` is the recommended pre-implementation command for AI planning.
- For a full generated task package file, omit `--dry-run`; output is written under `.spec-injector/out/`.
- `spec workflow-check` is a local-only, stdout-first workflow gate for autonomous PR evidence. It does not edit GitHub, add/commit files, write task packages, comment, merge, or mutate downstream repos.
- Autonomous worker-routing flows can use the [Hybrid AWP routing policy](docs/hybrid-awp-routing-policy.md) as the start-gate source of truth before implementation begins.
- `spec workflow-check --format json` emits the same stable fields as text output: `phase`, `status`, `repo`, `head_sha`, `checked_at`, `missing_fields`, `warnings`, and `evidence_summary`.
- Hybrid AWP checks add optional JSON/text fields such as `routing_mode`, `routing_task_class`, `spark_required`, `worker_5_4_required`, `controller_role`, `controller_fallback`, `controller_fallback_reason`, `fallback_status`, `fallback_reason_quality`, and `routing_mismatch`.
- Downstream repos such as `tachigo` / `tachiya` only need to copy or reference the workflow-check `status` and evidence `ref` in their PR body / ledger. Their Scope Police workflows should not parse full `spec plan` or task-package evidence. See the [target repo adoption contract](docs/target-repo-adoption-contract.md).
- AWP review follow-up can use [AWP review triage gates](docs/awp-review-triage-gates.md) and `spec awp-review-check --repo . --evidence <path>` to check review batch freshness, duplicate collapse, root-cause gates, patch budget, and closeout ledger evidence. This checker reads local JSON only; it does not read or write GitHub, resolve threads, auto-fix, or merge.

`spec workflow-check` phases:

- `start`: validates repo config. With `--issue`, it performs a dry-run bounded context check through `spec plan --dry-run --format prompt --verbose` without writing a task package. If the issue has an AWP / Codex autonomous routing signal, it also emits a deterministic Hybrid AWP routing plan; if no autonomous signal is present, routing fields are `n/a` and ordinary workflows do not fail.
- `commit`: checks staged files for `.spec-injector/`, generated task packages / spec output, and private context artifacts. With `--pr-body`, it also checks for spec gate status/ref or manual fallback evidence. With `--routing-evidence`, it checks local PR body routing status/ref, delegation log, Spark / ops evidence, 5.4 worker evidence, and explicit fallback quality.
- `merge`: checks a local PR body for final merge gate evidence, spec gate status/ref, and latest HEAD SHA. With `--head-sha`, stale or mismatched evidence fails. With `--routing-evidence`, stale start-gate routing evidence or routing/PR-body mismatch fails.

## Optional live gh smoke test

`spec plan` reads GitHub issues through the real `gh` CLI, so the repo keeps an optional live smoke test:

```bash
pnpm test:gh
```

This test is intentionally `opt-in`; it does not run automatically in `pnpm test` or CI. It verifies:

- `gh --version`
- `gh auth status --active --hostname github.com`
- `spec plan https://github.com/Erick52106/spec-injector/issues/61 --dry-run --format prompt`

The result must include the basic prompt sections, confirming issue URL parsing and the minimal live `spec plan` read path. This is a read-only smoke path, not a default CI gate and not an approval authority. If the environment does not have `gh` installed or authenticated, this test is not a default regression blocker; set up the environment first, then run it explicitly.

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

Monorepo/discovery caveat:

- `discovery.docs` and `discovery.source` are bounded, heuristic discovery inputs and are **not** a complete monorepo / workspace resolver.
- For monorepo repos, prefer explicit package-level paths (for example):
  - `packages/<name>/README.md`
  - `packages/<name>/docs/...`
  - `packages/<name>/package.json`
  - `apps/<name>/README.md`
  - `apps/<name>/docs/...`
- If a configured path is a directory but expected as a file, `read failed (EISDIR)` can appear; treat it as a directory-vs-file input issue and adjust config explicitly.
- `path alias hints` are diagnostic only and are not confirmed issue references; virtual import paths are not guaranteed to be automatically mapped to package internals by runtime today.
- For stronger monorepo context, keep discovery explicit and consult [docs/source-trust.md](docs/source-trust.md) and [docs/issue-to-context-pipeline.md](docs/issue-to-context-pipeline.md).

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

- **Layer 2 — Workflow Guardrails**: AI tool uses task package to draft an implementation plan, then waits for human approval before implementation.
- **Layer 3 Protocolization**: richer evidence and protocol alignment for deterministic context handoff, while preserving deterministic and reviewable boundaries.
- **Layer 4 Companion UX**: consistent human-facing guidance, boundary statements, and support for handoff quality, still design-oriented.

Future docs and design candidates include custom domains, richer classifier evidence visibility, JSON output, and optional user repo CI scaffolding. They are not part of the current runtime unless a later issue implements them explicitly.

## Current canonical layer model

The current canonical model is the 4-layer roadmap:

- Layer 1 — Core Compiler
- Layer 2 — Workflow Guardrails
- Layer 3 — Protocolization
- Layer 4 — Companion UX

If the repository still contains older 3-layer references, keep them as terminology history / previous framing only, not as current canonical positioning.

Issue #149 remains parked / design-only and is not a current capability. It requires separate design gates before implementation and should not be represented as auto-fix, auto-resolve, auto-merge, auto-close, or target-repo mutation behavior.
