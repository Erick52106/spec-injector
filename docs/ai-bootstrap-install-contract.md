# AI Bootstrap Install Contract

Downstream AI entrypoints for `tachigo`, `tachiya`, and other target repos can reference this contract when they need `spec-injector` before running Hybrid AWP gates. The canonical source repo is:

```text
https://github.com/Erick52106/spec-injector
```

This is an install and capability-readiness contract, not a hosted control plane. It does not authorize target repo mutation, daemon behavior, auto-commenting, auto-merge, or hidden LLM wrapping.

## Capability-First Check

Before cloning or updating anything, prefer the already available `spec` command:

```bash
command -v spec
spec doctor --workflow awp --format json
spec workflow-check --help
```

The AWP workflow requires `workflow-check` support for:

- `--phase start|commit|merge`
- `--finding-disposition`
- `--threshold-evidence`
- `--readback-evidence`
- `--pr`

`spec doctor --workflow awp --format json` is the stable machine-readable readiness check. A `status` of `pass` means the installed CLI exposes the current AWP workflow capabilities. A `status` of `fail` means the bootstrap should use the local runner fallback below or stop for human review.

## Local Runner Fallback

Downstream agents do not need global `pnpm link`. They can keep a local checkout outside the target repo and invoke the built CLI directly:

```bash
export SPEC_INJECTOR_DIR="${SPEC_INJECTOR_DIR:-$HOME/.cache/spec-injector}"

if [ ! -d "$SPEC_INJECTOR_DIR/.git" ]; then
  git clone https://github.com/Erick52106/spec-injector "$SPEC_INJECTOR_DIR"
else
  git -C "$SPEC_INJECTOR_DIR" pull --ff-only
fi

corepack enable
pnpm -C "$SPEC_INJECTOR_DIR" install
pnpm -C "$SPEC_INJECTOR_DIR" build

node "$SPEC_INJECTOR_DIR/dist/cli/index.js" doctor --workflow awp --format json
node "$SPEC_INJECTOR_DIR/dist/cli/index.js" workflow-check --help
```

The target repo should call `node "$SPEC_INJECTOR_DIR/dist/cli/index.js"` when it needs a pinned local runner and should avoid copying generated output back into the target repo.

## Verbatim Downstream Snippet

Target repo AI bootstrap docs may copy this shape:

```bash
if command -v spec >/dev/null 2>&1 && spec doctor --workflow awp --format json >/tmp/spec-doctor.json; then
  SPEC_RUNNER="spec"
else
  export SPEC_INJECTOR_DIR="${SPEC_INJECTOR_DIR:-$HOME/.cache/spec-injector}"
  if [ ! -d "$SPEC_INJECTOR_DIR/.git" ]; then
    git clone https://github.com/Erick52106/spec-injector "$SPEC_INJECTOR_DIR"
  else
    git -C "$SPEC_INJECTOR_DIR" pull --ff-only
  fi
  corepack enable
  pnpm -C "$SPEC_INJECTOR_DIR" install
  pnpm -C "$SPEC_INJECTOR_DIR" build
  node "$SPEC_INJECTOR_DIR/dist/cli/index.js" doctor --workflow awp --format json >/tmp/spec-doctor.json
  SPEC_RUNNER="node $SPEC_INJECTOR_DIR/dist/cli/index.js"
fi
```

Target repo docs can then invoke:

```bash
$SPEC_RUNNER workflow-check --repo . --phase start --issue <number-or-url> --format json
$SPEC_RUNNER workflow-check --repo . --phase commit --pr-body /path/to/pr-body.md --format json
$SPEC_RUNNER workflow-check --repo . --phase merge --pr-body /path/to/pr-body.md --head-sha <sha> --readback-evidence /path/to/readback.json --format json
$SPEC_RUNNER workflow-check --repo . --phase merge --pr <number-or-url> --format json
```

## Boundaries

- Do not commit `.spec-injector/out/`, generated task packages, local doctor output, local routing JSON, private context, or private ledgers into target repos.
- Do not let target repo Scope Police parse full `spec plan` output, full task packages, or full AWP ledgers.
- Do not auto-install into system-wide locations unless a human explicitly chooses that environment.
- Do not use this bootstrap as a daemon, dashboard, hosted control plane, merge bot, auto-commenter, or hidden LLM wrapper.
- Do not treat doctor `pass` as human merge approval.
- Do not mutate target repo GitHub state from `spec doctor`; it is local-only and does not call GitHub.

## When Target Repos Still Need Their Own PRs

`spec-injector` can provide the bootstrap contract and local checker behavior, but `tachigo`, `tachiya`, or any other target repo still need their own PR when they change repo-local docs, `AGENTS.md`, `CLAUDE.md`, PR templates, CI, Scope Police enforcement, labels, or merge policy.

Use target repo PRs for repo policy changes. Use this contract for a stable install/readiness snippet and for the status/ref evidence shape that target repo docs can reference.
