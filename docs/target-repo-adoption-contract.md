# Target Repo Adoption Contract for workflow-check

This contract describes how downstream repos such as `tachigo` and `tachiya` can adopt `spec workflow-check` evidence without turning their local Scope Police into a full spec parser.

## Direct Benefits

Target repos can use the published CLI behavior directly when `spec-injector` is installed or invoked from a tooling environment:

- `spec workflow-check --phase start` can emit local Hybrid AWP routing evidence.
- `spec workflow-check --phase commit` can validate staged-state safety plus PR body status/ref evidence.
- `spec workflow-check --phase merge` can validate final merge gate evidence, HEAD freshness, finding disposition evidence, threshold calibration evidence, and optional read-only closeout readback.
- Text output is human-readable; `--format json` emits machine-readable status fields for downstream ledgers.
- Local JSON inputs such as `--routing-evidence`, `--finding-disposition`, and `--threshold-evidence` stay stdout-first and local-only.
- Offline/manual checklist fallback remains valid for repos that have not fully adopted `spec-injector`.
- Target repo PR bodies only need stable status/ref evidence, not full task packages or full AWP review ledgers.

## When Target Repo PRs Are Still Needed

Downstream repos still need their own PR when they want to change repo-local policy or enforcement:

- Add new commands to `AGENTS.md`, `CLAUDE.md`, repo docs, or local runbooks.
- Make CI, Scope Police, or PR Scope Police require new fields.
- Rename PR template fields or move evidence sections.
- Add repo-specific fixtures, workflow tests, or target repo parser compatibility coverage.
- Change labels, branch policy, merge policy, or review ownership.

`spec-injector` can provide the checker behavior and fixture examples, but it does not mutate downstream repos.

## Non-Negotiable Boundaries

- Do not commit `.spec-injector/out/`, generated task packages, local routing JSON, private context, or private ledgers into target repos.
- Do not make target repo Scope Police parse full `spec plan` output, full task packages, or full AWP review ledgers.
- Do not use `spec-injector` as a hosted control plane, daemon, dashboard, merge bot, auto-commenter, or hidden LLM wrapper.
- Do not treat checker `pass` as human approval.
- Do not let `spec-injector` mutate target repo GitHub state. Readback helpers are read-only, and mutation remains a human-authorized workflow action outside the checker.

## Tachigo Example

A `tachigo` autonomous PR body can keep a thin evidence section:

```markdown
## Spec gate evidence
- spec gate status: pass
- spec evidence ref: https://github.com/<owner>/<repo>/issues/<n>#issuecomment-...

## Delegation Execution Log
- routing evidence status: pass
- routing evidence ref: workflow-check:start:<id>
- threshold evidence status: pass
- threshold ledger ref: workflow-check:threshold:<id>
- worker_5_4 evidence: https://github.com/<owner>/<repo>/pull/<n>#issuecomment-...
- controller_fallback: denied

## Finding disposition evidence
- finding disposition status: pass
- finding disposition ref: workflow-check:finding-disposition:<id>
```

The target repo gate only needs the `status` / `ref` fields. The full routing plan, threshold ledger, and finding disposition ledger can remain behind the referenced evidence.

## Tachiya Example

A `tachiya` PR can use the same status/ref shape even if the repository keeps a different PR template:

```markdown
## Spec gate evidence
- spec gate status: pass
- spec evidence ref: workflow-check:commit:tachiya

## Delegation Execution Log
- routing evidence status: pass
- routing evidence ref: workflow-check:start:tachiya
- threshold evidence status: pass
- threshold ledger ref: workflow-check:threshold:tachiya

## Final merge gate
- latest head SHA: <head-sha>
- ready_to_merge: yes
```

If `tachiya` only has manual checklist fallback for a small change, the checker may return `manual`; that is explicit evidence for human review, not a fake pass.

## Adoption Checklist

- Keep generated outputs and private context out of git.
- Store only status/ref evidence in PR bodies unless a repo explicitly wants more detail.
- Run `spec workflow-check --format json` locally or in a trusted tooling step.
- Use target repo PRs only when changing repo-local docs, templates, CI, or Scope Police enforcement.
- Preserve human merge authorization as the final gate.
