# AI Workflow Guides

## Purpose

These guides define how AI coding tools should use `spec-injector` when preparing and implementing GitHub issue work.

The goals are to make sure:

- AI tools do not need to remember every CLI detail.
- AI tools can install, initialize, and generate implementation prompts consistently.
- AI tools preserve human approval and implementation evidence workflows.
- AI tools call the Layer 1 CLI instead of inventing a parallel workflow.

## Available guides

- Codex: [docs/workflows/codex.md](codex.md)
- Claude Code: [docs/workflows/claude-code.md](claude-code.md)
- Cursor: [docs/workflows/cursor.md](cursor.md)

## Shared workflow

1. Check whether the `spec` CLI is installed.
2. If missing, follow [docs/release.md](../release.md) local install guidance.
3. Confirm the target repo path.
4. Check whether `.spec-injector/config.json` exists.
5. If missing, ask before running `spec init`.
6. Run `spec config suggest always-read --repo .` when onboarding or when the user asks for a rescan.
7. Do not add suggestions automatically unless the user approves.
8. Run `spec plan <issue> --repo . --dry-run --format prompt --verbose`.
9. Present the implementation plan.
10. Wait for human approval before implementation when requested.
11. Implement within issue scope.
12. Run build/test.
13. Leave implementation evidence on the source issue.
14. Open a ready-for-review PR.
15. Do not merge unless the user explicitly asks.

## Shared rules

- The issue body is the source of truth.
- The repo config is the source of truth.
- Suggestions are not approvals.
- Missing labels are not permission to expand scope.
- Use Conventional Commits PR titles.
- Use labels according to [docs/conventions.md](../conventions.md).
- Prefer dry-run prompt generation before implementation.
- Do not call an LLM/API from `spec-injector` core.
- Do not modify target repo config without approval.
- Do not open a draft PR unless explicitly asked.
- Verify the PR body after writing it.
- Verify CI result before asking the user to merge.

## Non-goals

These documents do not implement:

- CLI commands.
- Slash command plugins.
- Skill packages.
- MCP.
- Subagent orchestration.
