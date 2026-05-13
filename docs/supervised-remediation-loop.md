# Supervised Remediation Loop Design

## Purpose

This document evaluates #149: whether `spec-injector` should support a supervised remediation loop for review findings.

The answer is narrow: `spec-injector` may document and check evidence for human-supervised review follow-up, but it must not become a remediation bot. The loop described here is a design contract for future guarded work, not current runtime automation.

## Positioning

`spec-injector` remains a deterministic issue-to-context compiler and local workflow guardrail tool.

The remediation loop is only a disciplined handoff pattern:

```text
review finding
  -> human or controller triage
  -> bounded remediation prompt
  -> scoped implementation commit
  -> refreshed validation
  -> review finding disposition
  -> human merge decision
```

The loop must not skip human decision points. It must not mutate target repos, resolve review threads, comment on GitHub, push fixes, merge, close issues, or run as a daemon unless a future issue explicitly designs and implements a separately approved local-only checker.

## Inputs A Remediation Prompt May Consume

A supervised remediation prompt may consume only bounded, auditable inputs:

- source issue URL and current PR URL
- latest PR head SHA
- review finding URL, review thread URL, or CI run URL
- review finding body, normalized finding fingerprint, and source
- current PR diff or specific file ranges needed for the finding
- current PR body evidence and issue evidence comment URL
- existing repo instructions: `AGENTS.md`, `CLAUDE.md`, `docs/workflow.md`, and `docs/validation.md`
- relevant `spec evidence-check`, `spec workflow-check`, or `spec awp-review-check` output
- explicit human instruction authorizing the remediation scope

The prompt must not consume broad private context, unbounded chat history, unrelated target repo files, or hidden model/router state. If additional context is needed, the controller must ask for explicit approval or split a follow-up issue.

## Finding To Commit Traceability

Each remediation commit should be traceable to the finding it addresses.

Minimum trace:

- finding source: `coderabbit`, `codex`, `human`, or `ci`
- finding URL or stable local evidence ref
- reviewed head SHA
- current head SHA before patching
- disposition: `adopted`, `not adopted`, `optional polish`, `noise / not applicable`, or `needs human review`
- remediation commit SHA, if adopted
- validation command(s) run after the patch
- issue or PR evidence comment URL updated after the patch

If a finding is adopted, the PR body or issue evidence must explain the patch. If a finding is not adopted or treated as noise, the rationale must be written before resolving a review thread.

## Stale Finding Prevention

Review findings are head-specific. A remediation loop must stop or return manual fallback when:

- the finding reviewed head does not match the current PR head
- the finding is outdated and no longer applies
- the current PR body evidence references an older head SHA
- validation evidence predates the remediation commit
- review thread state cannot be read reliably
- the finding requires a scope expansion not authorized by the source issue

Stale findings may be recorded as `superseded` or `noise / not applicable`, but only with written rationale.

## Validation Refresh

Every adopted remediation patch requires fresh validation after the patch lands.

Validation must be proportional to the change:

- docs-only clarification: focused docs/link test when available, `pnpm test`, `pnpm build`, `git diff --check`
- classifier, parser, evidence, or gate behavior: focused regression plus full test/build/diff check
- CI failure follow-up: the failing command or job-equivalent local command plus full validation where feasible
- metadata-only evidence refresh: readback of PR body, issue comment, latest head SHA, checks, and review threads

Validation evidence must be copied or referenced in PR body / issue evidence. A checker PASS is evidence shape, not merge approval.

## Relationship To Existing Guardrails

#109 introduced `spec evidence-check` as a read-only consistency checker. Later workflow gates added `spec workflow-check` and `spec awp-review-check` evidence surfaces for autonomous or AWP-flavored flows.

This design depends on those guardrails rather than replacing them:

- `spec evidence-check` checks PR body, issue evidence, HEAD freshness, CI summary, and review finding assessment shape.
- `spec awp-review-check` checks local review batch evidence, duplicate collapse, root-cause gates, patch budget, and closeout ledgers for autonomous flows.
- `spec workflow-check --phase merge --pr <number-or-url>` can provide read-only merge closeout readback when the local workflow has that evidence.

None of these tools owns approval authority. They should report `manual`, `fail`, or `needs-human-review` when evidence is stale, missing, or ambiguous.

## Future Local Checker Gate

A future implementation issue may add a local-only remediation evidence checker if it remains bounded to read-only validation.

Possible input:

```json
{
  "source_issue": 149,
  "pr": "https://github.com/owner/repo/pull/123",
  "review_head_sha": "abc123",
  "current_head_sha": "def456",
  "findings": [
    {
      "id": "review-thread-url-or-local-id",
      "source": "codex",
      "disposition": "adopted",
      "rationale": "Broad keyword caused deterministic false positives.",
      "commit": "def456",
      "validation": ["pnpm test", "pnpm build"],
      "evidence_ref": "issue-comment-url"
    }
  ]
}
```

Possible output status should stay aligned with existing workflow-check contracts: `pass`, `fail`, `manual`, or `skipped`.

That checker must be stdout-first and local-only. It must not call GitHub mutation APIs, post comments, push commits, resolve threads, merge PRs, close issues, create target repo files, or start a hosted control plane.

## Do Not Automate

The supervised remediation loop must not automate:

- choosing to adopt a human review blocker without human approval
- expanding source issue scope
- editing target repo code
- creating `.spec-injector/` or generated output in a target repo
- `git add`, `git commit`, or `git push` in downstream repos
- GitHub issue / PR / label / milestone mutation from a checker
- review thread resolution without written rationale
- auto-commenting closeout evidence
- auto-merging or auto-closing
- daemon, hosted control plane, dashboard, or hidden LLM routing

## Example: Adopted Automated Finding

```text
Finding:
- source: codex
- reviewed head: af64715
- current head before patch: af64715
- finding: zh-TW backend keyword `服務` can false-positive on service terms

Disposition:
- adopted
- rationale: deterministic CJK boundary matching makes broad short terms risky
- patch: replace `服務` with `後端服務`; add false-positive regression
- validation: focused classifier test, pnpm test, pnpm build, git diff --check
- evidence: PR body and issue comment updated to latest head
```

This is acceptable because the finding is in scope, the patch is bounded, and validation is refreshed.

## Example: Needs Human Review

```text
Finding:
- source: human
- reviewed head: abc123
- finding: redesign PR workflow around automated remediation batches

Disposition:
- needs human review
- rationale: requires product/workflow approval and may change automation boundary
- action: stop-and-report; open or update design issue
```

This must not become an implementation patch in the current PR.

## Acceptance Boundary

Completing #149 means the supervised remediation model, prerequisites, safety boundaries, examples, do-not-automate list, and relationship to existing guardrails are documented.

It does not mean remediation automation is shipped. Any future CLI behavior requires a new issue, dedicated design approval, local-only scope, tests, and explicit non-goals preserving human merge authority.
