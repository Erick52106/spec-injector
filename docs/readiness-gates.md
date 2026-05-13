# 4.6+ / 4.7 Readiness Gates

> Source issue: #222. This is a planning boundary, not runtime implementation. It keeps post-#120 maturity claims evidence-gated and prevents README, visual, Layer 3, Layer 4, #206, or #149 work from expanding without a separate approved issue.

## Baseline

Post-#120 baseline:

- #120 README showcase closeout is complete.
- #223 third brownfield dogfood is complete with WARN / caveated evidence.
- #198 remains open as maturity-plan tracking.
- #206 remains open and evidence-gated.
- #149 remains open, parked, and design-only.

`spec-injector` remains a deterministic request-to-context compiler for AI coding agents. It is not a hosted control plane, agent orchestration platform, merge bot, remediation loop runtime, companion runtime, hidden LLM planner, semantic RAG system, or target repo auto-editing system.

## 4.6+ Readiness

4.6+ means current claims are consistently bounded. It does not add runtime scope.

| Gate | Required evidence |
| --- | --- |
| Claim boundary | README, README.en, workflow docs, validation docs, and design docs distinguish current, caveated, future, parked, and non-goal claims. |
| Evidence baseline | At least two brownfield dogfood reports or an explicitly accepted equivalent evidence set. |
| Regression protection | Diagnostics, evidence, label-audit, or workflow claims have tests or workflow-level evidence. |
| README safety | No README overclaim implies companion runtime, target repo mutation, remediation loop, hidden LLM planner, semantic RAG, or merge authority. |
| Target repo safety | Dogfood and downstream workflows keep target repos read-only unless a separate implementation plan authorizes target repo edits. |
| Deferred work | #206 and #149 stay explicitly deferred / parked unless their separate gates pass. |

4.6+ may support cautious maturity language about deterministic issue-to-context handoff, source references, visible diagnostics, validation evidence, and read-only workflow guardrails. It must not support 4.8+ or broad production-readiness claims.

## 4.7 Readiness

4.7 means the next evidence gates are written and satisfied. It still does not automatically start runtime-adjacent work.

| Gate | Required evidence |
| --- | --- |
| Third dogfood | A third public, non-sensitive, non-forbidden brownfield dogfood report exists and records PASS / WARN / FAIL evidence. |
| #206 decision | #206 either remains deferred with evidence rationale or has real zh-TW evidence that satisfies the un-defer gate. |
| Layer 3 boundary | Catalog / protocol / readiness boundary is written, including current docs-only, design-only, runtime gate, and forbidden overclaims. |
| Layer 4 boundary | Visual / companion / status / Spec Cat boundary is written, including mockup-only and no-runtime rules. |
| README / visual gate | README and visual showcase overclaim checklist exists before future showcase expansion. |
| Runtime restraint | No runtime-adjacent work starts before the relevant gate has written approval and evidence. |
| Claim update discipline | New claims include evidence links, current/future/parked labels, and non-goal confirmation. |

4.7 may support stronger confidence that `spec-injector` works across multiple brownfield samples. It does not support 4.8+ by itself.

## Why 4.8+ Remains Blocked

4.8+ requires broader external validation, not just local confidence.

- Diverse dogfood count is still limited.
- External adoption / validation evidence is not yet broad enough.
- Layer 3 and Layer 4 runtime boundaries remain design-only.
- #206 is not implemented and lacks sufficient zh-TW classifier evidence.
- #149 remains parked until a separate supervised-remediation safety proposal passes human review.
- No product telemetry or real-world adoption metric is defined.

## Third Dogfood Gate

Third dogfood is the primary 4.7 evidence gate, but not sufficient by itself.

### Target Criteria

- Public or otherwise safe to describe without private source leakage.
- Non-sensitive.
- Brownfield: existing issue, docs, and source structure.
- Not `spec-injector`, `tachigo`, `tachiya`, or `storefront`.
- Different enough from prior targets.
- Reproducible through target repo URL, issue URL, and pinned commit SHA.
- Usable through read-only clone / inspect / `spec plan --dry-run`.

### Safety Checklist

- Do not run `spec init` in the target repo.
- Do not create `.spec-injector/` in the target repo.
- Do not create target repo branch, commit, or PR.
- Do not modify target repo source, docs, tests, config, generated output, or private context.
- Do not stash, clean, reset, or checkout over target repo state.
- Use an external config snapshot when target config is needed.
- Stop and report if target repo dirty state or mutation need appears.

### Report Format

The report must include target, target rationale, safety checklist, commands, input summary, output summary, source precision, diagnostics quality, classifier assessment, monorepo/path friction, README claim impact, #206 relation, Layer 3 relation, Layer 4 relation, verdict, and follow-up recommendations.

### PASS / WARN / FAIL

| Verdict | Meaning | Decision effect |
| --- | --- | --- |
| PASS | Useful bounded context, visible diagnostics, no target mutation, and no major misleading references. | Raises 4.7 confidence but does not imply 4.8+. |
| WARN | Useful output with caveats such as classifier noise, false positives / negatives, path friction, or README caveat needs. | Supports bounded current claims only with caveats or follow-ups. |
| FAIL | Misleading context, hidden diagnostics, required target mutation, contradicted README claims, or unsafe workflow. | Blocks 4.7 readiness until follow-up work resolves the risk. |

## #206 zh-TW Classifier Gate

`#206` stays deferred until real zh-TW issue/repo evidence or deterministic fixtures justify it.

### Enough Evidence

- A real zh-TW issue or deterministic fixture shows current classifier under-detection or misclassification.
- Examples cover at least high-frequency domains such as docs, ci, frontend, backend/api, database, auth, or i18n.
- False-positive controls exist for zh-TW and English meta/workflow wording.
- The proposed change can remain a minimal deterministic keyword surface.
- Regression tests can run offline with the existing `node:test` style.

### Not Enough Evidence

- The repo usually uses zh-TW, but no issue text / fixture demonstrates a classifier miss.
- One ambiguous example without false-positive controls.
- A proposal that requires segmentation, jieba, LLM classification, semantic matching, embeddings, new taxonomy, or evidence-format redesign.
- A target repo dogfood that is entirely English.

### Allowed Scope If Un-Deferred

- `src/classifier/domain.ts`
- existing classifier tests / deterministic fixtures
- minimal zh-TW keyword additions
- false-positive regression tests
- small docs note only when behavior changes require documentation

## Layer 3 Protocol Boundary

Layer 3 can be documented now, but runtime protocol work needs a separate gate.

| State | Allowed work | Not allowed |
| --- | --- | --- |
| Current docs-only | Catalog vocabulary, protocol boundary tables, source-trust / validation / evidence schema vocabulary. | Claiming a shipped public protocol or product-facing JSON API. |
| Design-only | Schema sketches, CLI output candidates, checker consumer relationships, migration path notes. | Treating sketches as stable contract. |
| Runtime gate | Requires written boundary, clear consumer, deterministic fixtures, backward-compatibility plan, validation plan, and non-goal review. | Hosted control plane, workflow runtime, agent orchestration, automatic policy enforcement. |

`docs/catalog-protocol.md` remains the design anchor. Current README claims may point to vocabulary and direction, not shipped runtime protocol behavior.

## Layer 4 Visual / Companion / Status Boundary

Layer 4 can explore visuals and mockups without implying runtime existence.

| Concept | Allowed now | Boundary |
| --- | --- | --- |
| Static diagrams | Markdown, Mermaid, Figma, or open-design sketches marked current / future / design-only. | Must not imply shipped UI or daemon. |
| Spec Cat | Mascot / visual metaphor / future companion concept. | Must not appear as autonomous implementer or merge authority. |
| Companion | Design-only concept. | Must not enter CLI core or be described as current runtime. |
| Status emitter | Future design. | Must not imply watcher, daemon, or live repo monitoring. |
| Visual dashboard | Static mockup only. | Must not imply approval, merge, remediation, or hosted control plane. |

`#149` remains parked and is not unblocked by visual design, status vocabulary, or mascot work.

## README / Visual Overclaim Checklist

Before future README / visual / product showcase changes, verify:

- Does the claim describe implemented behavior?
- Is it marked current, caveated, future, design-only, parked, or non-goal?
- Does it imply target repo mutation?
- Does it imply hidden LLM, RAG, planner, hosted control plane, or agent orchestration?
- Does it imply merge authority, remediation loop, auto-review, auto-comment, or auto-close?
- Does it imply companion runtime, status daemon, or shipped UI?
- Does it imply zh-TW classifier support shipped?
- Does it imply a full monorepo resolver?
- Does it cite evidence?
- Does WARN dogfood evidence remain caveated?
- Does it preserve human merge authority?
- Does it avoid 4.8+ readiness language without external validation?

## Follow-Up Issue Routing

| Follow-up | Purpose | Before implementation? |
| --- | --- | --- |
| Third dogfood report | Produce public read-only brownfield evidence with PASS / WARN / FAIL. | Yes; completed by #223. |
| zh-TW classifier evidence | Decide whether #206 can be un-deferred with fixtures / real issue examples. | Yes. |
| Layer 3 protocol boundary | Decide docs-only / design-only / runtime gate before protocol implementation. | Yes. |
| Layer 4 visual boundary | Define visual / companion / Spec Cat / status boundary before showcase visuals. | Yes. |
| README / visual overclaim checklist | Keep future showcase edits evidence-linked and bounded. | Yes. |
| External validation standard | Define what 4.8+ would require. | Before 4.8+ claim. |

## What Not To Do Next

- Do not implement #206 without evidence.
- Do not unpark #149.
- Do not implement remediation runtime.
- Do not implement companion runtime, status daemon, status emitter, RAG, hidden LLM planner, or target repo automation.
- Do not rewrite README from this gate alone.
- Do not create visual assets as shipped product surface.
- Do not start monorepo resolver runtime work from this gate.
- Do not close #198, #206, or #149 from this planning decision.

## Final Recommendation

Treat the post-#120 state as a 4.6+ candidate baseline. Treat #223 as the third dogfood evidence point for 4.7, with WARN caveats. Keep #206 deferred, #149 parked, Layer 3 runtime design-only, and Layer 4 runtime design-only until their separate evidence gates pass.
