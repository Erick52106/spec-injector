# CLI Help and UX Audit

## Purpose

This document audits Layer 1 CLI help text and command UX so that both human operators and AI implementers can understand `spec` usage without guessing.

## Scope

- `spec --help`
- `spec init --help`
- `spec validate --help`
- `spec plan --help`
- `spec config --help`
- `spec clean --help`
- common invalid command / argument cases
- config missing / invalid config behavior
- command safety wording

## Findings

### `spec --help`

Current state after this pass:
- clearly describes `spec-injector` as a deterministic CLI
- lists `init`, `validate`, `plan`, `config`, and `clean`
- points users to `spec <command> --help` for command-specific guidance

Finding:
- the command list was already visible before this pass, but the root help did not explicitly guide users toward subcommand help

### `spec init --help`

Current state after this pass:
- states that `init` creates `.spec-injector/config.json`
- states that `init` creates `.spec-injector/.gitignore`
- states that it does not create GitHub Actions workflow files
- states that it does not modify runtime code
- keeps `--repo` scoped to selecting the target repo

Finding:
- prior help text only mentioned scaffolding `config.json`, which left `.gitignore` and non-goals implicit

### `spec validate --help`

Current state after this pass:
- states that `validate` checks `.spec-injector/config.json`
- states that invalid config exits non-zero
- states that missing config should be resolved by running `spec init`

Finding:
- runtime validation errors were already reasonably clear, but help text did not explain the missing-config path up front

### `spec plan --help`

Current state after this pass:
- states that `plan` reads a GitHub issue via `gh` CLI
- states that `gh` authentication is required
- states that `--dry-run` prints output without writing a task package
- states that `--format prompt` emits a compact AI planning prompt
- states that `--verbose` shows pipeline steps
- states that non-dry-run output is written to `.spec-injector/out/issue-<number>-task-package.md`

Finding:
- this command had the largest UX gap before the pass because the help text did not explain `gh` dependency, prompt-mode intent, or output location

### `spec config --help`

Current state after this pass:
- states that the command currently supports only `always-read`
- explains the difference between `list`, `add`, `remove`, and `suggest`
- states that `suggest` does not modify config
- states that `add` and `remove` modify config

Finding:
- the original signature was technically correct but too terse for AI tools to infer mutation behavior safely

### `spec clean --help`

Current state after this pass:
- states that `clean` removes only generated task package files
- states the exact generated file pattern: `.spec-injector/out/issue-<number>-task-package.md`
- states that it does not remove `.spec-injector/config.json`
- states that it does not remove `.spec-injector/.gitignore`
- states that it does not remove unrelated files
- keeps `--issue` clearly scoped to a single generated task package

Finding:
- the runtime behavior was already safe, but the help text did not make the safety boundary explicit enough

### Invalid command / argument cases

Current state after this pass:
- unknown root commands now show Commander error output plus post-error help guidance
- invalid config subcommands and missing path cases still exit non-zero with explicit usage-oriented wording
- invalid `clean --issue` input still exits non-zero with a direct issue-number message

Finding:
- unsupported top-level commands were previously terse and did not point users back to help

### Config missing / invalid config behavior

Current state:
- missing `.spec-injector/` already reports that `spec init` should be run
- invalid JSON and schema violations already exit non-zero and avoid raw stack traces in tested paths

Finding:
- this area was already acceptable for Layer 1 and did not require runtime behavior changes in this pass

### Command safety wording

Current state after this pass:
- `clean` help makes destructive scope explicit
- `config suggest` help makes non-mutation explicit
- `init` help makes non-goals explicit

Finding:
- safety boundaries existed in implementation but were under-documented in terminal help

## Changes made

- improved root help text so it identifies `spec` as a deterministic CLI and points to subcommand help
- improved `plan` help text for `gh` dependency, `--dry-run`, `--format prompt`, `--verbose`, and output path
- improved `config` help text so `always-read` support and mutation behavior are explicit
- improved `clean` help text so generated-file-only scope and safety boundaries are explicit
- improved `init` help text so created files and non-goals are explicit
- improved `validate` help text so non-zero behavior and missing-config next step are explicit
- improved unsupported root command UX by showing help guidance after errors

## AI implementer notes

- Prefer `spec <command> --help` before guessing command syntax.
- Treat command error output as source of truth.
- Do not assume `spec config suggest always-read` mutates config.
- Do not assume `spec init` creates CI workflow files.
- Use `spec plan --dry-run --format prompt --verbose` before implementation planning.
- Do not run destructive commands unless the user asked for them.
- `spec clean` only cleans generated task packages, but still confirm intent before running it.

## Follow-up candidates

- addressed: add help text tests
- addressed: add examples to high-value subcommand help
- add command UX docs
- add shell completion
- improve error message consistency
- add optional `spec doctor`

## Non-goals

- do not add CLI commands
- do not add shell completion
- do not add manpage
- do not modify config schema
- do not modify classifier behavior
- do not modify the plan template
- do not modify GitHub workflow
- do not change runtime behavior except for minimal help and error wording clarification
