# Layer Model

## Purpose

This document is the canonical layer model for `spec-injector`. It defines the boundaries between the deterministic CLI, AI workflow usage, and future agent interfaces.

The goals are to:

- Help humans and AI implementers understand which features belong in which layer.
- Prevent `spec-injector` from becoming an uncontrolled autonomous agent.
- Preserve the deterministic core.
- Support future skill-like workflows and agent/subagent integration.

## Summary

| Layer | Name | Role |
| --- | --- | --- |
| Layer 1 | Deterministic CLI | Current core: stable, scriptable, debuggable commands with repeatable outputs. It does not call an LLM, API, or local model unless that behavior is explicitly part of a command design. |
| Layer 2 | AI workflow / slash-command-like usage | AI-friendly workflow instructions built on top of Layer 1. For example, `/spec-plan <issue>` or an AI running `spec plan --dry-run --format prompt`. The AI may install, initialize, run commands, and draft implementation plans, but must stop for human approval before modifying a target repo when the workflow requires it. |
| Layer 3 | Agent / subagent / multi-agent interface | A structured interface for planner, implementer, reviewer, and verifier agents. Future candidates include `--format json` or `--format agent`. `spec-injector` acts as a deterministic context compiler so agents consume normalized context instead of independently guessing repo context. |

## Layer 1: Deterministic CLI

Layer 1 is the foundation of `spec-injector`.

Current examples:

- `spec init`
- `spec validate`
- `spec config list/add/remove always-read`
- `spec config suggest always-read`
- `spec plan <issue> --dry-run --format prompt`
- `spec clean`

Layer 1 principles:

- Deterministic by default.
- No hidden LLM calls.
- No automatic mutation unless a command explicitly says it mutates.
- Provide dry-run behavior where appropriate.
- Output should be suitable for humans and AI tools.
- Config and issue body remain the source of truth.
- Build and test coverage should protect behavior.

Mutation boundaries:

- `spec init` writes `.spec-injector/config.json` and `.spec-injector/.gitignore`.
- `spec config add/remove` mutates `always_read` only when explicitly called.
- `spec clean` removes only generated task packages matching `issue-<number>-task-package.md`.
- `spec config suggest` only suggests and does not write config.
- `spec plan --dry-run` does not write a task package.
- `spec plan` without `--dry-run` may write a generated task package under `.spec-injector/out`.

## Layer 2: AI workflow / slash-command-like usage

Layer 2 makes Layer 1 easier for AI tools to use. It does not replace Layer 1.

Examples:

- `/spec-plan <issue>`
- "Use spec-injector to prepare implementation context for issue #123"
- "Install spec-injector and initialize this repo after I approve"

Expected AI flow:

1. Check whether the `spec` CLI is installed.
2. If missing, follow the local install guidance in [docs/release.md](../release.md).
3. Check whether the target repo has `.spec-injector/config.json`.
4. If missing, ask before running `spec init`.
5. Run `spec config suggest always-read --repo .` when onboarding or when the user asks for a rescan.
6. Do not add suggestions automatically unless the user approves.
7. Run `spec plan <issue> --repo . --dry-run --format prompt --verbose`.
8. Present an implementation plan.
9. Wait for human approval before code changes when requested.
10. Implement within issue scope.
11. Run build/test.
12. Leave implementation evidence.
13. Open a ready-for-review PR.

Layer 2 principles:

- AI should call Layer 1 commands, not invent parallel behavior.
- AI should not expand scope because labels are missing.
- AI should treat the issue body as the source of truth.
- AI should preserve the evidence workflow.
- AI should ask before mutating target repo config or initializing a repo.
- AI should prefer dry-run prompt generation before implementation.

Possible future artifacts:

- `docs/workflows/claude-code.md`
- `docs/workflows/codex.md`
- `docs/workflows/cursor.md`
- `spec workflow install claude --repo .`
- `spec workflow install codex --repo .`
- `spec workflow install cursor --repo .`
- Skill-like package such as `skills/spec-injector/SKILL.md`

These are future candidates. They are not implemented by this issue.

## Layer 3: Agent / subagent / multi-agent interface

Layer 3 is a future structured-context interface for multi-agent workflows.

Use cases:

- Planner agent consumes issue and normalized repo context.
- Implementer agent receives a constrained task package.
- Reviewer agent checks scope, risk, and tests.
- Verifier agent runs the build/test checklist.
- Agents share one deterministic context instead of each scanning the repo differently.

Possible future outputs:

- `spec plan <issue> --format json`
- `spec plan <issue> --format agent`
- Normalized fields such as `issue`, `domains`, `guardrails`, `alwaysRead`, `relevantDocs`, `relevantSources`, `missingFiles`, and `verificationChecklist`
- MCP or other agent runtime integration

Layer 3 principles:

- Prefer structured data over prose where possible.
- Act as a deterministic context compiler, not an autonomous decision maker.
- Keep human approval required for risky mutations.
- Reuse Layer 1 behavior instead of creating separate logic.
- Do not require an LLM inside the `spec-injector` core.

`--format json`, MCP, and subagent orchestration are future candidates. They are not implemented by this issue.

## Boundary rules

- Layer 1 must remain deterministic and scriptable.
- Layer 2 may use AI, but AI behavior should be documented and reviewable.
- Layer 3 may support agents, but should not make `spec-injector` an autonomous coding agent by itself.
- CLI should not silently call external LLMs.
- Suggestions are not approvals.
- Missing labels are not permission to expand scope.
- Generated task packages are disposable artifacts.
- Issue body and repo config are source of truth.
- Risky mutations should require explicit user or workflow approval.

## Relationship to existing docs

- [docs/release.md](../release.md) defines the current local install strategy and future release phases.
- [docs/conventions.md](../conventions.md) defines labels, issue titles, PR titles, and AI implementer conventions.
- [docs/always-read-suggestions.md](../always-read-suggestions.md) defines deterministic `always_read` suggestion behavior.

## Follow-up candidates

- Workflow docs for Claude/Codex/Cursor.
- Skill-like package.
- `spec workflow install`.
- `--format json`.
- Custom domain schema.
- AI-assisted domain setup.
- User repo CI scaffold.

## Non-goals

- Do not implement workflow scaffold.
- Do not implement a slash command plugin.
- Do not implement a skill package.
- Do not implement an MCP server.
- Do not implement `--format json`.
- Do not modify CLI runtime.
- Do not modify the config schema.
- Do not call an LLM, API, or local model.

## Current canonical layer model

Canonical model is now 4 layers:

- Layer 1 — Core Compiler
- Layer 2 — Workflow Guardrails
- Layer 3 — Protocolization
- Layer 4 — Companion UX

Legacy wording that describes only 3 layers should be kept only as terminology history / previous framing and is no longer the current canonical model.
