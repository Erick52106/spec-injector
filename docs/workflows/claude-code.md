# Claude Code Workflow

## Purpose

This guide defines how Claude Code should use `spec-injector` without guessing scope directly from conversation context. Claude Code should call the deterministic Layer 1 CLI, use generated prompt output as planning context, and preserve approval and evidence workflows.

## Recommended usage

- Use `spec plan` dry-run prompt mode before implementation.
- Read [docs/conventions.md](../conventions.md).
- Read [docs/design/layers.md](../design/layers.md).
- Use [docs/release.md](../release.md) if the `spec` CLI is missing.
- Ask before `spec init`.
- Ask before adding `always_read` suggestions.

## Standard flow

1. Confirm repo and branch state.
2. Check `spec` CLI availability.
3. If `spec` is unavailable, follow [docs/release.md](../release.md) local install.
4. Check `.spec-injector/config.json`.
5. Ask before `spec init` if config is missing.
6. Do not rely only on `CLAUDE.md` or `AGENTS.md`.
7. If the repo has no `CLAUDE.md`, this is not an error.
8. Use `spec config suggest always-read --repo .` to discover likely instruction docs.
9. Do not auto-add suggestions without user approval.
10. Run `spec plan <issue> --repo . --dry-run --format prompt --verbose`.
11. Summarize the plan and wait for user approval when requested.
12. If asked to use `/spec-plan <issue>`, interpret it as workflow shorthand, not a literal CLI slash command unless implemented later.
13. Create a branch from latest `main`.
14. Implement only issue scope.
15. Run build/test.
16. Leave implementation evidence on the source issue.
17. Create a ready-for-review PR.
18. Update the PR body and verify it after writing.
19. Do not merge unless explicitly asked.

## Safeguards

- Do not edit config automatically.
- Do not perform broad refactors unless the issue says so.
- Do not merge PR.
- Do not skip evidence comment.
- Do not update PR body without verifying it.
