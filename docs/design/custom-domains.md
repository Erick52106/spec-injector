# Custom Domains and AI-assisted Domain Suggestions

## Purpose

This document defines how `spec-injector` may evolve from its built-in keyword-based domain classifier toward repo-local custom domains and AI-assisted domain suggestions.

The goals are to:

- Keep the core deterministic.
- Allow different repos to define their own domain vocabulary.
- Let AI assist with domain suggestions without automatically persisting them.
- Avoid tool behavior that becomes noisy, unreviewable, or dependent on hidden learning state.
- Support future Layer 2 and Layer 3 workflows.

## Current state

Domain classification is deterministic and keyword-based. Built-in domains cover general areas such as frontend, backend, api, auth, database, infra, docs, ci, tooling, testing, i18n, and blockchain.

The classifier scores issue title, labels, and body. No LLM, API, or local model is used. Repo-local custom domains are not currently implemented.

This document is design-only and does not change runtime behavior.

## Problem

Different repos have their own product, business, and architecture vocabulary. Examples include:

- payment
- video-access
- entitlement
- creator-dashboard
- reward-ledger
- inventory
- fulfillment
- streamer-console
- marketplace
- token-claim
- mining-loop

Built-in keywords cannot cover every repo. If the tool only relies on fixed domains, an AI implementer may misclassify scope, miss important guardrails, or underweight repo-specific risk.

## Proposed model

The proposed model has three layers.

### Layer A: Built-in generic domains

Built-in domains are the baseline:

- stable
- deterministic
- shipped with the tool
- useful across many repos
- does not require repo setup

Examples:

- frontend
- backend
- api
- auth
- database
- infra
- docs
- ci
- tooling
- testing
- i18n
- blockchain

### Layer B: Repo-local custom domains

A future implementation may allow repo-specific domains to be defined in `.spec-injector/config.json`.

Future candidate schema, not implemented:

```json
{
  "domains": {
    "custom": [
      {
        "id": "payment",
        "description": "Payment, checkout, invoices, and transaction state",
        "keywords": ["payment", "checkout", "invoice", "transaction"],
        "paths": ["src/payment/**", "docs/payment/**"],
        "labels": ["area:payment"],
        "guardrails": [
          "Do not change payment state transitions without review.",
          "Verify idempotency for payment webhooks."
        ]
      }
    ]
  }
}
```

Candidate fields:

- `id`: stable domain identifier
- `description`: human-readable explanation
- `keywords`: deterministic text signals
- `paths`: repo path signals
- `labels`: GitHub label signals
- `guardrails`: domain-specific implementation cautions

This schema is not implemented yet. The exact shape may change. Any future implementation must include validation and tests.

### Layer C: AI-assisted domain setup

AI may assist with domain suggestions, but the CLI core should not directly call an LLM.

Recommended flow:

1. CLI exports repo facts or a prompt-friendly summary.
2. AI reviews repo structure, docs, labels, and existing issue patterns.
3. AI proposes custom domain candidates.
4. Human reviews suggestions.
5. Approved suggestions are written to config by explicit command or manual edit.
6. Rejected suggestions are not persisted unless a future design explicitly supports it.

Approved learning principle:

```text
observe -> suggest -> review -> approve -> persist
```

Rules for AI-assisted setup:

- no automatic learning
- no silent persistence
- no hidden memory
- no background mutation
- no auto-writing based only on AI judgment

## Candidate future commands

The following commands are future candidates and are not implemented:

- `spec classify --explain <issue>`: show why an issue matched domains.
- `spec classify suggest-domains --repo . --format prompt`: output an AI-friendly prompt or deterministic repo facts.
- `spec config add domain <id> --repo .`: add an approved custom domain to repo config.
- `spec config remove domain <id> --repo .`: remove an approved custom domain from repo config.
- `spec config list domains --repo .`: list built-in and repo-local domains.
- `spec plan <issue> --format json`: support Layer 3 agent consumption.

## Scoring model considerations

A future classifier may combine:

- issue title keywords
- issue body keywords
- GitHub labels
- file paths
- config-defined keywords
- config-defined paths
- domain guardrails
- `always_read` suggestions and docs signals

Scoring should remain deterministic. AI may propose config, but the classifier should not depend on an LLM. Explainability is required, and tests should cover scoring behavior.

## Safety and governance

Rules:

- Human approval required before persisting custom domains.
- AI suggestions are not approvals.
- Custom domain config should be reviewable in PRs.
- Domain guardrails should be treated as cautions, not automatic blockers unless a future design says so.
- Invalid domain config should fail validation clearly.
- Missing custom domains should not block basic CLI usage.
- Built-in domains should continue working without custom setup.
- Domain changes should include tests once runtime is implemented.

## Relationship to existing layers

This design builds on [docs/design/layers.md](layers.md).

Layer 1 remains the deterministic CLI. Layer 2 may help propose domain config through documented AI workflows. Layer 3 may consume structured domain output later, such as a future JSON or agent-oriented format.

## Relationship to existing docs

Related docs:

- [docs/conventions.md](../conventions.md) for labels.
- [docs/always-read-suggestions.md](../always-read-suggestions.md) for deterministic doc suggestions.
- [docs/workflows/README.md](../workflows/README.md) for AI workflow behavior.

## Open questions

- Should custom domains live under `domains.custom` or another config key?
- Should built-in domains be overrideable?
- Should repo-local domains add to or replace built-ins?
- Should rejected suggestions be recorded?
- Should domain guardrails be printable in `spec plan` output?
- How should conflicts between domains be resolved?
- What score threshold should classify a domain?
- Should path signals require changed files, mentioned files, or both?
- Should AI-assisted setup be a separate command or workflow doc first?

## Follow-up candidates

- implement custom domain schema validation
- add classify explain command
- add domain config commands
- add AI-assisted domain suggestion prompt output
- add JSON output for agent consumption
- add tests for domain scoring
- add docs for domain guardrails

## Non-goals

- Do not implement custom domains.
- Do not modify the classifier.
- Do not modify the config schema.
- Do not add a CLI command.
- Do not add a database.
- Do not call an LLM, API, or local model.
- Do not automatically write config.
- Do not implement approved learning persistence.
- Do not implement `--format json`.
- Do not modify `spec plan`.
