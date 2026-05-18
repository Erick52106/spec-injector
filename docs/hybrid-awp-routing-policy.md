# Hybrid Autonomous Worker Profiles routing policy

## Purpose

Hybrid Autonomous Worker Profiles (Hybrid AWP) is a Layer 2 workflow guardrail for autonomous AI-assisted PR work. It defines how a controller decides, before implementation starts, whether a task should be handled by an ops / readback worker, a bounded implementation worker, or the controller itself.

This policy is a source of truth for `spec plan` and `spec workflow-check --phase start` design. It is not a hosted control plane, worker runtime, daemon, dashboard, merge bot, or GitHub mutation system.

## Applicability

Hybrid AWP applies only when the target workflow has an explicit autonomous routing signal, such as:

- an Autonomous Worker Profiles (AWP) instruction
- a Codex autonomous PR workflow
- an equivalent repo-local worker-routing contract

Absence of autonomous routing signal must not fail ordinary human PRs or non-autonomous AI-assisted work. In that case, workflow gates should report `skipped`, `manual`, or `n/a` for AWP-only checks instead of failing solely because routing evidence is absent.

Downstream Scope Police workflows should not enforce AWP routing sections for general human PRs.

## Start gate

Routing is decided at the start gate, before implementation starts and before the controller commits to a plan. The start gate should classify the task, decide which worker class is required, and record the controller's retained role.

The required policy output fields are:

- `routing_mode=hybrid_awp|strict_awp|controller_fallback`
- `task_class=<class>`
- `spark_required=yes|no`
- `worker_5_4_required=yes|no`
- `controller_role=<scope|architecture|review|merge_gate|fallback_executor>`
- `controller_fallback=allowed|denied`
- `controller_fallback_reason=<reason or n/a>`
- `delegation_threshold=<short explanation>`

`spec workflow-check --phase start --format json` renders these fields as local-only start-gate evidence when an autonomous routing signal is present. Downstream repos only need to reference the resulting routing status and evidence ref; they do not need to parse the full routing plan.

## Routing decision vs delegation outcome

Start-gate routing fields describe the intended route before implementation begins. They answer "what should happen?" and must stay separate from execution/readback evidence.

`delegation_outcome` records what actually happened after the controller attempted or skipped delegation:

- `n/a`: start phase, non-AWP PRs, or evidence without autonomous routing context
- `skipped`: worker dispatch was not needed or was explicitly not attempted
- `completed`: a worker was dispatched and completed the assigned scope
- `fell_through`: a worker was dispatched but did not fully complete, so the controller finished the scope
- `unavailable`: routing expected a worker, but the worker/subagent facility was unavailable and the controller used fallback

`controller_fallback` keeps its policy meaning: whether controller fallback is allowed by the routing decision. It must not be repurposed as execution outcome. For example, `delegation_outcome=skipped` and `delegation_outcome=fell_through` both involve controller work, but they have opposite dogfood implications: skipped suggests routing may be too eager to delegate, while fell-through suggests worker reliability or task slicing needs attention.

## Task classes

| Task class | Default route | Controller role | Delegation threshold |
| --- | --- | --- | --- |
| `trivial_readonly` | Controller fallback may be allowed. | `fallback_executor` or `review` | Only for 0-3 minute read-only checks with no repo mutation and no GitHub mutation. Record why delegation would add more overhead than value. |
| `metadata_readback` | Ops / readback worker required when workers are available. | `review` | GitHub issue / PR / CI / review-thread / connector readback should be delegated because it is routine, bounded, and independently verifiable. |
| `small_docs_template_test` | Bounded implementation worker preferred when workers are available. | `scope` and `review` | Narrow docs, template, fixture, or workflow-test patches can be delegated once allowed files and non-goals are clear. |
| `workflow_policy` | Bounded implementation worker may edit; controller keeps final policy decision. | `scope`, `architecture`, and `review` | Scope Police, CI, evidence, workflow governance, or policy docs need controller ownership for scope and review, even when edits are delegated. |
| `product_behavior` | Controller owns architecture; bounded implementation worker may handle slices. | `architecture` and `review` | Backend, frontend, runtime, auth, data, or user-visible behavior needs controller design ownership before any worker implementation slice. |
| `merge_gate` | Controller-owned. | `merge_gate` | Review finding adoption, exact head SHA decisions, CI / review-thread closeout, and merge readiness stay with the controller. Routine readback can still be delegated. |

## Fallback rules

`controller_fallback=allowed` is acceptable only when the reason is explicit and bounded. Good reasons include:

- no subagent or worker facility is available in the current environment
- the task is `trivial_readonly` and delegation overhead exceeds the work
- the human explicitly requested controller-only execution
- an implementation worker is unavailable, but the controller can keep the change narrow and record the fallback

`controller_fallback=denied` should be used when the task requires independent readback, bounded implementation, or merge-time evidence separation. Missing, vague, or self-justifying reasons should not be treated as meaningful fallback evidence.

Controller fallback must not be used to bypass scope review, avoid tests, skip evidence freshness, or turn the CLI into an autonomous executor.

`spec workflow-check` reports fallback checks with:

- `fallback_status=pass|fail|manual|n/a`
- `fallback_reason_quality=strong|weak|missing|n/a`
- `routing_mismatch=<comma-separated list or none>`

Weak fallback reasons include empty values and low-signal text such as `n/a`, `none`, `small`, `done`, `ok`, or `trivial` without bounded context.

## Downstream evidence contract

Downstream repos such as `tachigo` and `tachiya` may keep their PR templates and Scope Police thin. They should reference:

- routing status
- routing evidence ref
- delegation outcome
- spec gate status / ref
- final merge gate status / ref

They should not parse full `spec plan` output, task packages, worker transcripts, or private context. If richer routing evidence is needed, it should be linked as a local or PR-body evidence ref rather than expanded into downstream policy parsers.

Commit and merge gates may receive local start-gate routing evidence through:

```bash
spec workflow-check --repo . --phase commit --pr-body /tmp/pr.md --routing-evidence /tmp/start-gate.json
spec workflow-check --repo . --phase merge --pr-body /tmp/pr.md --routing-evidence /tmp/start-gate.json --head-sha <sha>
```

The routing evidence file is local input only. The CLI does not fetch or mutate GitHub to resolve routing evidence refs.

If a workflow needs stronger auditability for whether delegation actually occurred, use the design-only [optional AWP delegation evidence manifest](awp-delegation-evidence-manifest.md). That manifest records worker profile, model, reasoning, assigned scope, result summary, closeout status, and controller fallback reason as local evidence shape. It remains optional, does not apply to non-AWP PRs, and does not make `spec-injector` spawn or orchestrate workers.

## Non-goals

This policy does not:

- spawn workers
- call model providers
- mutate GitHub issues, PRs, labels, comments, or reviews
- write task packages or routing files by default
- require non-autonomous users to provide routing plans
- define a hosted control plane, daemon, dashboard, merge bot, or auto-commenter
