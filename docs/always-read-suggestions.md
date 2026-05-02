# always_read suggestions

## Purpose

`spec config suggest always-read --repo .` is an onboarding helper that suggests likely `always_read` candidates for a repository.

It only prints suggestions. It does not modify `.spec-injector/config.json` automatically.

## Deterministic only

The command uses deterministic scoring only.

- No LLM
- No API calls
- No local model inference

Fixed well-known filenames are still checked first, then additional candidates are scanned and scored.

## Scan scope

The first scoring implementation scans a limited set of repository locations:

- repo root `*.md`
- `docs/**/*.md`
- `.github/*.md`
- `.github/**/*.md`
- `.cursor/rules/*`
- `.windsurf/*`

Common instruction paths such as `.github/copilot-instructions.md` are included through those scan rules.

## Exclusions

The scanner excludes locations that are typically generated, archived, or too noisy for `always_read`:

- `node_modules`
- `dist`
- `build`
- `.git`
- `.spec-injector/out`
- `docs/superpowers`
- `docs/archive`
- `archive`

It also ignores obvious low-signal candidates such as changelog, meeting notes, temporary drafts, and unreadable or binary files.

## Confidence meanings

- High confidence: strong repo instruction, architecture, security, or AI workflow candidate
- Medium confidence: likely useful project overview or guideline-like documentation
- Lower-signal files may be skipped to keep output concise

Every printed suggestion includes a short reason. Suggestions are sorted deterministically to keep output stable.

## Adding a suggestion

To add one of the suggested files into `always_read`, run:

```bash
spec config add always-read <path> --repo .
```

## AI implementer guidance

- Do not automatically add suggestions unless the user approves.
- Do not treat suggestions as mandatory.
- Use the issue body and `.spec-injector/config.json` as the source of truth.
