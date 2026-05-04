# Issue Label Taxonomy Proposal

## Purpose

This document is a docs-only taxonomy proposal for Issue `#150`. It defines the `spec-injector` GitHub issue / PR label taxonomy, visual hierarchy, label usage rules, migration staging, and prerequisite rules that a future Issue `#110` label / milestone audit checker should consume.

This proposal does not modify GitHub labels, change label colors, rename / delete labels, mass-edit issues, migrate milestones, or implement the Issue `#110` checker.

`spec-injector` remains a deterministic request-to-context compiler for AI coding agents. The label taxonomy should support repo-local deterministic workflow, source trust, context compilation, and review evidence rather than repositioning the project as a GitHub Projects dashboard, hosted control plane, remediation bot, or roadmap platform.

## Current Snapshot

Snapshot date: 2026-05-04.

Current label inventory from the #150 audit:

- Type labels: `type:chore`, `type:ci`, `type:design`, `type:refactor`, `type:test`.
- Area labels: `area:agent`, `area:ci`, `area:classifier`, `area:cli`, `area:config`, `area:discovery`, `area:docs`, `area:release`, `area:template`, `area:test`, `area:tooling`, `area:workflow`.
- Status labels: `status:blocked`, `status:implemented`, `status:in-review`, `status:needs-design`, `status:ready`.
- Layer labels: `layer1 : Core Compiler`, `layer2 : Workflow Guardrails`, `layer3 : Protocolization`, `layer4 : Companion UX`.
- GitHub default / equivalent labels: `bug`, `documentation`, `duplicate`, `enhancement`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`.

Open issue distribution observed during this proposal:

| Dimension | Observed distribution |
| --- | --- |
| Open issues read | 11 open issues. |
| Most common area | `area:workflow` on 8 open issues, spanning workflow guardrails, companion UX, metadata audit, and taxonomy design. |
| Docs area | `area:docs` on 5 open issues, spanning docs deliverables and design issues whose real problem domain is taxonomy, workflow, or product narrative. |
| Other visible areas | `area:cli` on 2 open issues; `area:test` on 1 open issue. |
| Status | All 11 open issues carry `status:needs-design`, useful for backlog safety but too coarse for future checker behavior if left as the only active state. |
| Roadmap layers | Layer 2 has 5 open issues, Layer 4 has 5 open issues, Layer 3 has 1 open issue, Layer 1 has 0 open issues. |

Issue `#108` (`spec preflight`) and Issue `#109` (`spec evidence-check`) are merged and closed as completed. Issue `#110` remains open and should wait for this taxonomy to be accepted.

## Problem Statement

The current labels work for small repo hygiene, but they are now too broad for the newer roadmap:

- `area:workflow` is overloaded. It can mean AI workflow, worktree guardrails, PR evidence, metadata consistency, checker design, dogfood closeout, or request / protocol-adjacent work.
- `area:docs` can confuse deliverable with problem domain. A docs-only PR does not mean the source issue's actual area is docs.
- Layer 1 / Layer 2 / Layer 3 / Layer 4 grouping is clearer than before, but issue classification still relies on broad area labels that do not separate compiler core, input, context, protocol, workflow guardrails, and companion UX cleanly.
- If #110 implements against the current taxonomy directly, it will freeze temporary workarounds such as `area:cli + area:workflow` for every workflow checker issue.
- Label taxonomy should support deterministic repo workflow and machine-checkable audit, not become a substitute for GitHub Projects, roadmap dashboard, or product control-plane framing.

## Taxonomy Principles

- Labels describe orthogonal dimensions: type, area, status, roadmap layer, and priority / risk when useful.
- The label set should be small enough for humans and #110 to apply consistently.
- Avoid product-misleading labels. Labels must not imply hosted platform, merge bot, remediation automation, or target repo automation.
- Avoid deliverable labels as problem-domain labels. `documentation` can describe work type; `area:docs` should describe docs system / docs content as the problem domain.
- Status labels represent current workflow state, not historical state. Closed / completed state and `status:implemented` are related but not identical.
- Area labels should usually be limited to one or two per issue. More than three usually means the issue is too broad or the taxonomy is missing a better area.
- Layer labels are roadmap grouping, not area labels. A single issue normally has one primary layer.
- #110 should be able to audit against accepted rules without inventing labels or mutating metadata.

## Proposed Label Groups

### Type Labels

Type labels describe the kind of work, not the product area.

| Label | Recommendation | Usage |
| --- | --- | --- |
| `bug` | Keep | Incorrect behavior, regression, or broken expected output. |
| `enhancement` | Keep | New feature or capability request. |
| `documentation` | Keep | Documentation work type, especially docs deliverables. |
| `type:test` | Keep | Tests, fixtures, mocked `gh` output, or regression coverage. |
| `type:design` | Keep | Architecture, product direction, taxonomy, or design-only proposal. |
| `type:workflow` | Add only if humans want a type dimension for workflow-policy docs | Useful only if `enhancement` / `type:design` is not precise enough. Avoid if it duplicates `area:workflow-guardrails`. |
| `type:dogfood` | Add only after repeated dogfood-only issues need filtering | Dogfood evaluation / report work. Do not use it to replace source issue links. |
| `type:metadata` | Add only if metadata-only closeout becomes frequent enough | Label-only, milestone-only, evidence backfill, or closeout work. Do not use it to authorize migration. |
| `type:feat`, `type:fix`, `type:docs` | Avoid | They duplicate `enhancement`, `bug`, and `documentation`. |

Each issue should have one type label or one GitHub default equivalent. A design issue may use `type:design`; a feature issue may use `enhancement`; a docs deliverable may use `documentation`.

Existing snapshot type labels `type:chore`, `type:ci`, and `type:refactor` remain accepted but are not redefined by this docs-only proposal.

### Area Labels

Area labels describe problem domain. They should not describe PR output format alone.

Recommended area taxonomy:

| Label | Meaning |
| --- | --- |
| `area:input` | GitHub issue input, future raw request, local markdown brief, PR review note, dogfood report, or request normalization. |
| `area:context` | Source trust, context budget, reference trust levels, diagnostics, include policy, and context compilation boundaries. |
| `area:protocol` | Catalog / protocol vocabulary, stable section names, schema design, compatibility contracts, and machine-checkable naming. |
| `area:classifier` | Domain scoring, keyword evidence, false positive / false negative behavior. |
| `area:discovery` | Repo-aware docs/source discovery, issue-mentioned references, auto-discovered candidates, alias hints. |
| `area:template` | Task package and prompt rendering templates, output sections, wording, and compatibility. |
| `area:workflow-guardrails` | Worktree-first workflow, validation matrix, evidence backfill, preflight, evidence-check, label audit, merge-time closeout, and repo-local checker design. |
| `area:validation` | Validation matrix, quality gates, build/test expectations, CI-readiness rules when not primarily CI automation. |
| `area:docs` | Documentation system, docs structure, docs content quality, README / docs information architecture. Use only when docs are the problem domain. |
| `area:product` | Product positioning, moat, roadmap boundaries, naming / brand architecture. |
| `area:companion` | Layer 4 companion UX, status surface, mascot, local watcher / UI exploration when separately approved. |
| `area:cli` | CLI commands, flags, command dispatch, stdout / stderr / exit behavior. |
| `area:config` | Config schema, config loading, config commands, repo config behavior. |
| `area:test` | Test infrastructure and fixtures as the affected area. |
| `area:tooling` | Node / pnpm / TypeScript / local developer tooling baseline. |
| `area:ci` | GitHub Actions, CI workflows, CI permissions, CI job behavior. |
| `area:release` | Packaging, install, versioning, release process. |
| `area:agent` | Agent handoff, structured agent interface, MCP / subagent integration, when not just workflow policy. |

`area:workflow` should not remain the umbrella label for all repo guardrails. Recommended direction:

- Short term: keep `area:workflow` as an existing label and avoid mass migration.
- Stage 2 candidate: add `area:workflow-guardrails` after human approval.
- After adoption: gradually move checker / evidence / worktree / metadata contract issues to `area:workflow-guardrails`.
- Long term: narrow `area:workflow` to AI invocation flow or skill-like flow only, or deprecate it if every use has a clearer area.

`area:docs` should be used when the docs themselves are the domain: docs structure, docs convention, README content, product narrative docs, or docs workflow. It should not be used just because a PR is docs-only. For example, this proposal is docs-only, but the problem domain is label taxonomy and workflow guardrails.

`area:control-plane` is not recommended. It would mislead readers toward hosted control-plane product positioning. If the underlying work is repo-local checker / evidence / workflow discipline, `area:workflow-guardrails` is more accurate.

### Status Labels

Status labels describe current lifecycle state. They should be mutually exclusive unless a human explicitly approves an exception.

| Label | Meaning |
| --- | --- |
| `status:needs-design` | Design is not accepted enough for implementation. Suggestions are not approval. |
| `status:ready` | Issue is ready for implementation with clear scope and validation. |
| `status:in-review` | Implementation is in PR review or otherwise awaiting human review. |
| `status:implemented` | Work was implemented / completed and has merge or equivalent closeout evidence. |
| `status:blocked` | Blocked by dependency, decision, missing permission, or external state. |
| `status:needs-human` | Candidate add. Use for issues / PRs requiring explicit human decision before proceeding. Avoid if `status:blocked` already communicates the state. |
| `status:deferred` | Candidate add only if deferred backlog needs filtering. Avoid if milestone / issue body already tracks scheduling clearly. |

Issue / PR relationship:

- Source issues are the main home for status labels.
- PRs should usually use GitHub native state and review state. PR labels may inherit type / area / layer metadata, but status labels on PRs should be conservative.
- During review, the source issue may use `status:in-review`.
- After merge / completion, active status labels such as `status:needs-design`, `status:ready`, `status:blocked`, or `status:in-review` should be removed before adding `status:implemented`.
- Closed completed and `status:implemented` should align when closeout evidence exists. Closed not planned should not receive `status:implemented`.

### Layer Labels

Layer labels describe roadmap grouping. They do not replace area labels.

| Label | Meaning |
| --- | --- |
| `layer1 : Core Compiler` | Compiler core, deterministic CLI behavior, issue parsing, classifier, references, guardrails, template rendering, and output correctness. |
| `layer2 : Workflow Guardrails` | Repo-local workflow safety, worktrees, validation, evidence, PR / issue closeout, dogfood workflow, and checker design. |
| `layer3 : Protocolization` | Catalogs, protocols, source trust vocabulary, input adapter vocabulary, structured contract design, compatibility boundaries. |
| `layer4 : Companion UX` | Companion status UX, mascot / visual layer, future status runtime exploration outside CLI core. |

Each issue should normally have one primary layer label and one matching roadmap milestone when high-confidence classification is possible. Cross-layer work should choose the primary responsibility layer and explain the reason in the issue or PR body.

### Priority / Risk Labels

The current repo does not need a large priority taxonomy.

Conservative candidates:

- `priority:high`: only for work that should be pulled forward relative to nearby backlog.
- `risk:high`: only for changes with high safety, workflow, CI, or product-boundary risk.
- `needs-human-review`: consider only if the team prefers a non-status marker instead of `status:needs-human`.

Do not add priority labels just to rank every issue. Milestones, issue bodies, and human planning comments should remain the main ordering mechanism.

## Keep / Add / Deprecate / Avoid

| Label | Recommendation | Reason | Migration note |
| --- | --- | --- | --- |
| `area:workflow` | Keep short term; deprecate umbrella usage | Existing label is heavily used, but too broad for checker / evidence / metadata / protocol work. | Do not mass-edit. Move only high-confidence issues after `area:workflow-guardrails` is accepted. |
| `area:docs` | Keep, narrow usage | Useful for docs domain, but should not mean "this PR edits docs." | Reclassify only when the issue's problem domain is not docs and a better area exists. |
| `area:input` | Add candidate | Needed for #129-style request input, raw request, markdown brief, review note, and dogfood report adapters. | Add only after human accepts taxonomy. Apply first to future input adapter issues. |
| `area:context` | Add candidate | Needed for #130 source trust, context budget, diagnostics, and reference trust boundaries. | Add after acceptance; likely Layer 3 or Layer 1 depending implementation scope. |
| `area:protocol` | Add candidate | Needed for #107 catalog / protocol vocabulary and future structured contract design. | Add after acceptance; avoid applying to generic docs issues. |
| `area:workflow-guardrails` | Add candidate | More accurate than `area:control-plane` for #108 / #109 / #110 / #147 / #148 workflow discipline. | Apply in small batches after label creation. Start with open workflow checker issues. |
| `area:control-plane` | Avoid | Misleading product framing; suggests hosted platform or orchestration. | Do not create unless human explicitly changes product positioning. |
| `area:classifier` | Keep | Clear domain for deterministic classifier scoring and evidence behavior. | No migration needed except moving classifier-adjacent workflow issues away from `area:workflow`. |
| `area:discovery` | Keep | Clear domain for docs/source discovery and reference candidates. | Pair with `area:context` only when source trust / budget semantics are central. |
| `area:template` | Keep | Clear domain for task package / prompt rendering templates. | Pair with `area:protocol` only for compatibility / section contract work. |
| `area:validation` | Add candidate | Validation matrix / quality gates are not always CI or workflow broadly. | Could reduce `area:workflow` overload for validation-specific issues. |
| `area:product` | Add candidate | Product moat, positioning, roadmap boundaries, and brand architecture need a clearer area than docs/workflow. | Use sparingly; do not turn product docs into marketing showcase. |
| `area:companion` | Add candidate if Layer 4 work resumes | Clearer than `area:workflow` for companion UX and status surface exploration. | Keep Layer 4 deferred; no CLI runtime implication. |
| `status:needs-design` | Keep | Useful stop signal before implementation. | #110 should warn if implementation starts without accepted design. |
| `status:ready` | Keep | Useful implementation-ready state. | Should conflict with `status:implemented` and usually with `status:needs-design`. |
| `status:in-review` | Keep | Useful on source issue during active PR review. | Remove after completion. PR use should be conservative. |
| `status:implemented` | Keep | Useful completed closeout marker. | Add after merge / completion evidence; remove active status labels. |
| `status:blocked` | Keep | Useful dependency / decision blocker. | Should not be combined with ready / implemented without explicit rationale. |
| `status:needs-human` | Optional candidate | More precise than blocked when the only blocker is a human decision. | Avoid if it creates status bloat. |
| `status:deferred` | Optional candidate | Useful only if backlog scheduling needs explicit filtering. | Avoid if milestones and issue body are enough. |
| `layer1 : Core Compiler` | Keep | Existing roadmap grouping. | One primary layer per issue. |
| `layer2 : Workflow Guardrails` | Keep | Existing roadmap grouping for repo-local workflow guardrails. | Does not replace area labels. |
| `layer3 : Protocolization` | Keep | Existing roadmap grouping for catalog / protocol / source trust vocabulary. | Does not imply runtime schema. |
| `layer4 : Companion UX` | Keep | Existing deferred companion UX grouping. | Does not authorize daemon / runtime. |
| `type:workflow` | Optional candidate | May help distinguish workflow-policy work from feature work. | Avoid if `area:workflow-guardrails` is sufficient. |
| `type:dogfood` | Optional candidate | May help dogfood reports and evaluation issues. | Do not replace evidence source links. |
| `type:metadata` | Optional candidate | May help metadata-only closeout work. | Do not imply metadata mutation is approved. |

Labels that appear in the Current Snapshot but are not explicitly listed in this table are intentionally treated as keep-as-is for this docs-only proposal. Do not create, rename, delete, recolor, or migrate those labels until a later human-approved metadata stage.

## Label Combination Rules

- Each issue should have one type label or GitHub default equivalent.
- Each issue should usually have one or two area labels, with three as the normal maximum. More than three should trigger human review.
- Each open issue should have zero or one active status label unless human explicitly records an exception.
- Each issue should usually have one primary layer label.
- Docs-only PR does not mean the source issue must be `area:docs`.
- Workflow checker issues should use `area:workflow-guardrails` after acceptance, not `area:control-plane`.
- Dogfood findings should preserve source / follow-up relationship in issue body, evidence comments, or linked reports; labels cannot carry the full context.
- Labels are classification signals, not scope permission. The issue body, human prompt, and repo instructions remain source of truth.
- Milestone is roadmap phase, not workflow status.
- PR labels should generally inherit linked issue type / area / layer metadata, but PR native state and review state should remain authoritative for review lifecycle.

## Visual Hierarchy / Color Principles

This PR does not change colors. Future color changes should follow principles before touching GitHub UI:

- Type labels should use one color family.
- Area labels should use one color family, with enough contrast between major area clusters if the label count grows.
- Status labels should use high-contrast lifecycle colors so `needs-design`, `ready`, `in-review`, `blocked`, and `implemented` are visually distinct.
- Layer labels should use muted roadmap colors so they do not overpower status / risk labels.
- Priority / risk labels should stand out and be rare.
- Avoid too many visually similar labels, especially among status labels.
- Prefix naming should carry meaning even if colors are unavailable.

## Migration Plan

### Stage 0: Audit Completed

Decision owner: human maintainer.

Already completed by the #150 read-only audit comment.

Automatable:

- Label inventory read.
- Open issue / PR distribution report.
- Current milestone read.

Human-approved only:

- Interpreting product-boundary risk.
- Deciding whether the proposed taxonomy is acceptable.

Safety / rollback:

- No mutation occurred. If the proposal is rejected, stay at current labels.

### Stage 1: Docs-only Taxonomy Proposal

Decision owner: human maintainer and PR reviewer.

This PR documents proposed groups, usage rules, visual hierarchy, migration staging, and #110 dependency.

Automatable:

- Markdown sanity check.
- `git diff --check`.
- Build / test validation if requested by source issue.

Human-approved only:

- Acceptance of label additions / deprecations.
- Whether `area:workflow-guardrails`, `area:input`, `area:context`, `area:protocol`, or optional type / status labels should be created later.

Safety / rollback:

- Docs-only. Revert PR or amend proposal if taxonomy is not accepted.

### Stage 2: Human-approved Label Creation / Color Updates

Decision owner: human maintainer.

After this proposal is accepted, create or update labels in small explicit batches.

Automatable:

- Generate exact proposed `gh label create` / color update commands for human review.
- Read back labels after mutation.

Human-approved only:

- Creating labels.
- Changing colors.
- Renaming or deleting labels.

Safety / rollback:

- Use small batches.
- Record exact before / after label list.
- Avoid rename / delete unless separately approved.

### Stage 3: Limited Issue Metadata Migration

Decision owner: human maintainer.

Apply accepted taxonomy to selected open issues first, especially #110 and future input / context / protocol / workflow guardrail issues.

Automatable:

- Produce proposed per-issue label diffs.
- Detect conflicts such as multiple active status labels.

Human-approved only:

- Applying label changes.
- Moving milestones.
- Changing status labels.

Safety / rollback:

- Do not mass-edit.
- Migrate small batches.
- Read back every affected issue.
- Keep issue body and evidence links unchanged unless separately scoped.

### Stage 4: #110 Label / Milestone Audit Checker

Decision owner: human maintainer and #110 implementer.

Implement #110 only after the accepted taxonomy is stable enough to be machine-checkable.

Automatable:

- Read issue / PR labels and milestones.
- Report missing area / type / status / layer labels.
- Report stale status labels and conflicts.
- Report labels outside accepted taxonomy.

Human-approved only:

- Label mutation.
- Milestone mutation.
- Closing / reopening issues.
- Deciding ambiguous classification.

Safety / rollback:

- #110 should be read-only by default.
- Use mocked `gh` output for feature tests.
- Do not invent labels or auto-remediate metadata.

### Stage 5: Periodic Audit / Cleanup

Decision owner: human maintainer.

Run periodic read-only audits to keep taxonomy from drifting.

Automatable:

- Summary report.
- Conflict detection.
- Candidate cleanup list.

Human-approved only:

- Any metadata mutation.
- Any label creation / rename / delete.

Safety / rollback:

- Keep periodic audit report-only unless a separate cleanup task is explicitly approved.

## Relationship To #110

Issue `#110` should not implement until Issue `#150` taxonomy is accepted.

Issue `#110` should:

- Audit against accepted taxonomy.
- Use issue / PR labels, milestones, layer labels, and status labels as read-only input.
- Report missing labels, mismatches, stale status, conflicting active status, missing primary layer, and milestone / layer mismatch.
- Classify output as pass / warning / needs human review / fail where appropriate.
- Use mocked `gh` output and offline fixtures for tests.

Issue `#110` should not:

- Invent labels.
- Create labels.
- Rename / delete labels.
- Change label colors.
- Mutate issue labels automatically.
- Mutate milestones automatically.
- Close / reopen issues.
- Become a roadmap dashboard.
- Become GitHub Projects replacement.
- Become hosted control plane, merge bot, remediation bot, or metadata auto-fixer.

## Non-goals

- No label mutation in this PR.
- No color change.
- No rename / delete labels.
- No mass-edit issues.
- No milestone migration.
- No #110 implementation.
- No GitHub Projects.
- No hosted control plane framing.
- No product repositioning.
- No automation / remediation bot.
- No target repo mutation.
- No README product showcase.

## Acceptance Criteria

This PR is complete when:

- Docs proposal exists.
- Current taxonomy pain points are documented.
- Proposed label groups and combination rules are documented.
- Keep / add / deprecate / avoid recommendations are documented.
- Visual hierarchy / color principles are documented without applying color changes.
- Migration plan is documented.
- #110 dependency is documented.
- No GitHub metadata changed.
- No label mutation occurred.
- No #110 implementation occurred.

## Decision Summary

- Use labels as small orthogonal classification dimensions: type, area, status, layer, and rare priority / risk.
- Add candidate areas for `area:input`, `area:context`, `area:protocol`, and `area:workflow-guardrails` after human approval.
- Avoid `area:control-plane` because it misleads product positioning.
- Narrow `area:workflow` away from umbrella usage over time.
- Keep #110 read-only and dependent on accepted #150 taxonomy.
