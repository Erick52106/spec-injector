# Cursor Workflow

## Purpose

This guide defines how Cursor and AI IDE workflows should use `spec-injector`. Cursor should run the deterministic CLI in the terminal, use the generated prompt output as implementation context, and keep code edits scoped to the source issue.

## Recommended usage

- Use the terminal to run the `spec` CLI.
- Use generated prompt output as implementation context.
- Keep edits inside issue scope.
- Use Cursor rules only as additional project guidance, not as a replacement for the issue body.
- If `.cursor/rules` exists, `spec config suggest always-read` may recommend it.

## Standard flow

1. Open the target repo.
2. Confirm terminal cwd.
3. Run `spec validate --repo .`.
4. Run `spec config suggest always-read --repo .`.
5. Ask the user before adding suggested docs.
6. Run `spec plan <issue> --repo . --dry-run --format prompt --verbose`.
7. Use output as the implementation guide.
8. Make scoped edits.
9. Run build/test.
10. Leave evidence comment and open PR.

## Safeguards

- Do not rely on opened editor tabs as full context.
- Do not change unrelated files.
- Do not skip terminal verification.
- Do not use suggestions as automatic approvals.
