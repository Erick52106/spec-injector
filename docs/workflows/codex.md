# Codex Workflow

## Purpose

This guide defines how Codex should use `spec-injector` when handling GitHub issues. Codex should use the deterministic Layer 1 CLI to produce implementation context, then preserve human approval, issue scope, validation, evidence, and PR review workflows.

## Preconditions

- The user has confirmed the target repo.
- The `gh` CLI is authenticated if issue fetching is needed.
- The `spec` CLI is installed or local install is approved.
- An issue URL or issue number is provided.

## Recommended commands

    spec --help
    spec validate --repo .
    spec config suggest always-read --repo .
    spec plan <issue-number> --repo . --dry-run --format prompt --verbose

## Standard flow

1. Confirm repo and branch state.
2. Check `spec` CLI availability.
3. If `spec` is unavailable, follow [docs/release.md](../release.md) local install.
4. Check `.spec-injector/config.json`.
5. Ask before `spec init` if config is missing.
6. Run `suggest always-read` only as suggestions.
7. Run `spec plan` in dry-run prompt mode.
8. Summarize the plan and wait for user approval when requested.
9. Create a branch from latest `main`.
10. Implement only issue scope.
11. Run `npm run build` and `npm test` when available.
12. Leave implementation evidence comment.
13. Create a ready-for-review PR.
14. Update PR body and verify it with `gh pr view <PR_NUMBER> --json body --jq .body`.
15. Report PR URL, branch, commit hash, test result, CI result, draft state, and uncommitted files.
16. Do not merge unless explicitly asked.

## Required safeguards

- Do not treat missing labels as scope permission.
- Do not modify files outside allowed scope.
- Do not create draft PR unless explicitly asked.
- Do not claim PR body was updated without verifying.
- Do not silently proceed if `gh`, `spec`, `npm`, or repo path fails.
- Stop and report if branch protection or CI required checks are misconfigured.

## Output checklist

Codex final report should include:

- Issue URL.
- PR URL.
- Branch.
- Commit hash.
- Changed files.
- Build result.
- Test result.
- CI result.
- PR body verification result.
- Draft PR state.
- Uncommitted files.
- Explicit out-of-scope confirmation.
