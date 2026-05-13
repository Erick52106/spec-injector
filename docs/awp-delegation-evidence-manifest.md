# Optional AWP Delegation Evidence Manifest

This document defines a design-only, optional manifest for recording delegation evidence in Autonomous Worker Profiles (AWP) workflows.

The manifest can help a controller audit whether a worker profile was assigned, what scope it owned, what it returned, and why controller fallback was used. It is not a worker runtime, not a hosted control plane, and not proof that a subagent truly executed. It is local evidence shape that `spec workflow-check` may read in a future implementation issue.

## Applicability

The manifest applies only when a workflow has an explicit AWP / Hybrid AWP / autonomous PR signal.

Non-AWP users and ordinary human PRs must not be required to provide this manifest. If no autonomous signal is present, future checker behavior should report `skipped`, `manual`, or `n/a` for delegation-manifest checks rather than failing a normal PR.

## Minimal Schema

The first schema should be small enough for a controller, wrapper, or target repo script to produce without storing private transcripts.

```json
{
  "schema_version": 1,
  "manifest_id": "awp-delegation:<stable-id>",
  "repo": "owner/name or local repo path",
  "issue_ref": "https://github.com/owner/repo/issues/123",
  "pr_ref": "https://github.com/owner/repo/pull/456",
  "head_sha": "40-character-sha",
  "created_at": "2026-05-13T00:00:00Z",
  "autonomous_signal": "present",
  "routing_evidence_ref": "workflow-check:start:<id>",
  "controller": {
    "role": "scope|architecture|review|merge_gate|fallback_executor",
    "fallback_used": false,
    "fallback_reason": "n/a"
  },
  "workers": [
    {
      "worker_id": "worker-1",
      "profile": "spark|ops_readback|implementation_5_4|review_5_5|custom",
      "model": "gpt-5.4",
      "reasoning": "low|medium|high|xhigh|unknown",
      "assigned_scope": [
        "docs/foo.md",
        "tests/foo.test.ts"
      ],
      "forbidden_scope": [
        "src/runtime/**"
      ],
      "task_summary": "short bounded assignment",
      "result_summary": "short result or blocker summary",
      "evidence_ref": "PR comment, local path, or issue comment URL",
      "closeout_status": "completed|blocked|superseded|not_started",
      "blocker_reason": "n/a"
    }
  ]
}
```

Required top-level fields:

- `schema_version`
- `manifest_id`
- `repo`
- `head_sha`
- `created_at`
- `autonomous_signal`
- `routing_evidence_ref`
- `controller.role`
- `controller.fallback_used`
- `controller.fallback_reason`
- `workers`

Each worker entry should include:

- `worker_id`
- `profile`
- `model`
- `reasoning`
- `assigned_scope`
- `result_summary`
- `evidence_ref`
- `closeout_status`

`assigned_scope` should be paths, modules, or bounded responsibilities. It should not contain private transcript text or full model logs.

## Producer Options

The manifest may be produced by one of three actors:

| Producer | Good fit | Risk |
| --- | --- | --- |
| AI controller manual entry | Works in any local environment and preserves human-readable judgment. | Self-reported; easy to forget fields or overstate delegation. |
| Agent wrapper / local runner | Can record worker profile, model, reasoning, and closeout consistently. | Wrapper-specific; must not become a required runtime or hidden control plane. |
| Target repo local script | Can normalize repo-specific worker evidence into a stable JSON shape. | Target repo maintenance burden; must not force Scope Police to parse full private evidence. |

All producer modes are optional. The target repo may keep only a `status/ref` in the PR body and store richer evidence in an approved local or issue-comment location.

## Future `workflow-check` Boundary

A future `spec workflow-check` implementation may read this manifest as an explicit local input, for example:

```bash
spec workflow-check --repo . --phase commit --delegation-manifest /tmp/awp-delegation.json
spec workflow-check --repo . --phase merge --delegation-manifest /tmp/awp-delegation.json --head-sha <sha>
```

If implemented, the checker should only validate shape and readback consistency:

- valid JSON
- supported `schema_version`
- required fields present
- `autonomous_signal=present` only affects autonomous workflows
- `head_sha` matches current or provided head SHA
- worker `closeout_status` is not `not_started` for required workers
- controller fallback has an explicit reason when `fallback_used=true`
- assigned scope is bounded and does not claim forbidden/private paths

The checker must not:

- spawn, close, or manage subagents
- call model providers
- read private session transcripts
- mutate GitHub issues, PRs, labels, comments, reviews, or threads
- write task packages, manifests, or output files by default
- require downstream Scope Police to parse the full manifest
- treat manifest pass as human merge approval

## Trust Boundary

The manifest improves auditability but cannot prove all runtime facts.

It can improve confidence that:

- routing evidence has a concrete worker assignment record
- controller fallback was explicit
- assigned scope and closeout status are reviewable
- worker evidence can be compared with PR body `status/ref` fields
- missing or stale worker evidence can produce `manual` or `fail` instead of silent pass

It still cannot prove:

- a model actually executed the work
- the worker used the claimed model or reasoning effort
- private context was not seen by another process
- the result summary is semantically correct
- the controller did not rewrite worker output
- the PR is safe to merge without human review

For this reason, the manifest should be evidence for review, not an authority layer.

## Implementation Decision

This issue defines the design and trust boundary only. It should not add runtime schema validation, new CLI flags, config schema changes, or target repo enforcement.

If the team wants runtime support, open a separate implementation issue for:

- CLI flag design
- JSON validation behavior
- fixture coverage
- interaction with `--routing-evidence`, `--finding-disposition`, and `--threshold-evidence`
- target repo compatibility expectations for tachigo / tachiya

## Non-Goals

- Do not turn `spec-injector` into a subagent runtime or orchestration platform.
- Do not require `spec-injector` to spawn, monitor, or close subagents.
- Do not commit private session transcripts into target repos.
- Do not require target repos to commit `.spec-injector/` output.
- Do not require non-AWP users to adopt this manifest.
- Do not make this manifest a merge approval gate by itself.
