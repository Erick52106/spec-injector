# Visual Asset Workflow Plan

## Purpose

本文件規劃 future visual asset / product showcase workflow，讓 `spec-injector` 後續可以保守地使用 `nexu-io/open-design` 或相似 design workflow tools 輔助 README hero、workflow diagrams、roadmap diagrams、validation visuals、product showcase assets 與 Spec Cat companion mockups。

本文件不生成素材、不修改 README showcase、不實作 companion UI，也不新增 design dependency、build pipeline、runtime code、tests 或 CI。它只定義 future asset work 的邊界、存放策略、tool fit、visual direction 與 follow-up issue 切分。

## Product Boundary

`spec-injector` 仍是 deterministic issue-to-context compiler / deterministic request-to-context compiler for AI coding agents。Visual assets 應幫助 human 和 AI coding agent 理解 issue scope、source trust、context budget、guardrails、validation hints 與 evidence workflow；它們不應重新定位產品。

Visual language must not imply:

- hosted control plane
- autonomous agent orchestration
- hidden LLM planner / wrapper
- automatic merge or remediation bot
- target repo auto-editing
- companion daemon / runtime as current capability

`Spec Cat` 是 mascot / companion / future workflow observability character。它可以出現在 Layer 4 Companion UX、status visualization、docs illustration 或 future showcase assets 中，但不應取代 `spec-injector` 作為 product name，也不應污染 CLI core positioning。

## Asset Categories

### README Hero / Product Mental Model

Purpose: explain the product in one fast visual pass: issue / request in, trust-labeled bounded context out.

Recommended content:

- GitHub issue / future request input
- repo docs / source references / guardrails
- deterministic context assembly
- bounded task package / prompt output

Avoid showing an agent taking autonomous action after the package is produced.

### Request / Issue-to-context Pipeline Diagram

Purpose: show how `spec-injector` compiles request context before implementation starts.

Recommended content:

- issue body / future request adapter
- repo instructions and source references
- source trust labels
- diagnostics / missing files / alias hints
- output package / compact prompt

Keep future fuzzy request adapters visually distinct from current GitHub issue input.

### Source Trust / Context Budget Diagram

Purpose: explain why selected context is not just "more files".

Recommended content:

- strong signals such as issue-mentioned references and repo `always_read`
- inferred signals such as auto-discovered candidates
- diagnostics-only / hint-only outputs
- full-include vs reference-only vs excluded
- context budget fallback

Canonical vocabulary should follow [source-trust.md](source-trust.md).

### Validation / Evidence Workflow Diagram

Purpose: make the repo-safe implementation workflow easier to audit.

Recommended content:

- validation command selection
- build / test / diff checks
- implementation evidence comment
- PR body backfill
- readback verification

Do not imply validation automatically fixes failures or merges PRs.

### Roadmap-by-layer Diagram

Purpose: show roadmap boundaries without collapsing future layers into current CLI core.

Recommended content:

- Layer 1 / Layer 2 compiler and source trust work
- workflow guardrails and evidence checks
- future input adapters
- Layer 4 Companion UX as optional future layer

Companion UX should consume compiler output; it should not redefine the compiler.

### Label Taxonomy / Workflow Guardrails Visual

Purpose: explain repo workflow discipline around labels, milestones, review state, and scope gates.

Recommended content:

- area / type / status / layer labels
- needs-design vs implementation-ready distinction
- metadata as planning support, not scope authorization
- evidence / readback guardrails

This should remain repo workflow guidance, not hosted dashboard positioning.

### Spec Cat Mascot / Companion State Mockup

Purpose: explore future mascot and companion state language without claiming runtime existence.

Recommended content:

- Spec Cat as warm status / observability character
- possible states such as waiting, context compiled, diagnostics present, validation needed
- clear "future / prototype" labeling
- connection to Layer 4 Companion UX

Avoid making Spec Cat dominate the main product identity or appear as an autonomous implementer.

### Product Deck / Static Showcase Assets

Purpose: support stakeholder review, roadmap discussion, and product narrative without overloading README.

Recommended content:

- problem framing
- deterministic compiler thesis
- source trust and budget examples
- repo-safe handoff workflow
- future roadmap boundaries

Deck assets can be more polished than canonical docs diagrams, but must stay faithful to implemented capability.

## Tool Fit

### open-design

`open-design` or similar design workflow tools are best suited for early layout and static asset exploration:

- workflow diagrams
- roadmap diagrams
- static product mockups
- README hero / layout exploration
- validation matrix visuals
- product showcase composition

Use it to explore structure, hierarchy, spacing, and visual rhythm. Do not treat generated output as canonical truth; the final asset still needs human review against this document, [brand-architecture.md](brand-architecture.md), and implemented product state.

### Figma / FigJam

Figma / FigJam are best suited when the asset must stay editable and reviewable by humans:

- editable diagrams
- design system layout
- product deck / stakeholder review
- bilingual caption review
- companion UI prototype frames
- visual direction boards

Use Figma when future collaborators need to comment, compare variants, or maintain source design files over time.

### Image Generation / Illustrator-like Tools

Image generation, Illustrator, Affinity Designer, or similar tools are best suited for high-polish visual exploration:

- mascot character exploration
- illustration polish
- brand key visual
- textured or expressive hero art
- final export cleanup

These tools are not good sources of canonical product semantics. Mascot and key visual work must be checked against the overclaim checklist before use.

### Hand-authored Markdown / Mermaid

Hand-authored Markdown and Mermaid are best suited for canonical diagrams that must stay diffable and low-maintenance:

- pipeline diagrams that track implementation behavior
- source trust / context budget diagrams
- validation workflow diagrams
- low-churn docs diagrams
- diagrams reviewed primarily in PR diffs

Prefer Mermaid or Markdown when the diagram is part of the product contract or should evolve with code/docs in small PRs.

## Asset Storage Strategy

The repository should distinguish source assets from exported assets.

Suggested paths:

- `docs/assets/` for visual asset documentation and small shared assets.
- `docs/assets/source/` for editable source files such as `.fig`, design exports, design briefs, or layered vector source when committing them is justified.
- `docs/assets/exported/` for README-ready or docs-ready exported images.
- `docs/diagrams/` for hand-authored Mermaid, Markdown diagram notes, or other diffable canonical diagram source.

Recommended naming:

- Use lowercase kebab-case.
- Include the asset purpose: `readme-pipeline-hero`, `source-trust-budget`, `validation-evidence-flow`.
- Include language when text is embedded: `readme-pipeline-hero.en.svg`, `readme-pipeline-hero.zh-TW.svg`.
- Include status for future-only assets: `spec-cat-companion-state-prototype`.

Reviewability rules:

- Avoid committing huge binaries unless the asset has clear documentation value.
- Prefer source files that can be reviewed or regenerated.
- Keep exported assets reasonably small and optimized.
- Include alt text / accessibility notes near the consuming Markdown.
- Avoid hidden proprietary source dependency if the README needs reproducibility.
- Keep generated assets out of the repo until there is a consuming docs / README change and reviewable rationale.

## Visual Direction Constraints

The visual direction should feel precise, bounded, and source-trusted.

Prefer:

- compiler-like context assembly
- trust-labeled inputs and outputs
- brownfield repo safety
- visible diagnostics and caveats
- bounded context instead of token explosion
- current vs future capability separation
- quiet product confidence over platform hype

Avoid:

- cyberpunk hype unless future product docs explicitly ask for it
- cartoon-first positioning for CLI core
- dashboard-first visuals that imply hosted control plane
- agent loop imagery that implies autonomous orchestration
- automatic remediation / merge visuals
- target repo mutation imagery
- hidden LLM or magic black-box metaphors

Spec Cat can make the companion layer warmer, but it should not dominate the main product identity. The main identity remains `spec-injector` as a deterministic context compiler.

## README / Showcase Timing

Conservative README assets can be considered after the README narrative and brand architecture are stable. #119 / #178 and #132 / #179 provide that base, but #133 itself should not ship visual assets.

Recommended timing:

- Minimal README pipeline diagram: after this plan is accepted, in a separate small issue.
- Full product showcase: after #120, or as part of #120 if the scope explicitly includes assets and bilingual alignment.
- Spec Cat visual prototype: after #100, #111, and #112 clarify mascot direction, status event schema, and daemon / runtime boundaries.
- Product deck / static showcase: after the core product narrative and overclaim checklist can be applied to every slide / asset.

Visual assets should not claim unimplemented runtime, companion, hosted platform, automatic remediation, fuzzy request adapter, or merge automation behavior.

## Bilingual README Alignment

README visuals must keep `README.md` and `README.en.md` aligned.

Rules:

- If one README language gets an image, caption, or alt text, the other must get equivalent context.
- Avoid visual-only claims that are not reflected in surrounding text.
- Avoid English-only embedded text in diagrams unless there is an explicit bilingual strategy.
- Prefer short embedded labels and richer Markdown captions when maintaining two image variants would be expensive.
- If separate language exports are needed, keep them visually equivalent and name them clearly.
- Alt text should explain the product claim, not merely describe decoration.

The bilingual requirement applies to captions, alt text, and any text embedded in exported diagrams.

## Overclaim Prevention Checklist

Before adding any visual asset to README, docs, deck, or issue evidence, check:

- [ ] Does this visual imply a hidden LLM planner or wrapper?
- [ ] Does it imply automatic merge, review resolution, or remediation?
- [ ] Does it imply target repo mutation?
- [ ] Does it imply companion runtime already exists?
- [ ] Does it imply hosted dashboard / control plane?
- [ ] Does it show future fuzzy request adapters as current implementation?
- [ ] Does it distinguish current vs future layers?
- [ ] Does it show Spec Cat as mascot / companion layer rather than CLI core?
- [ ] Does it preserve `spec-injector` as the main product name?
- [ ] Does it keep validation and evidence as human-auditable workflow, not automatic success?

If the answer is unclear, stop and treat the asset as needing human review before publication.

## Relationship To Existing Docs / Issues

- #119 README narrative: establishes product narrative that visual assets should support, not replace.
- #120 full product showcase: should consume this plan before producing full README / product showcase assets.
- #132 brand architecture: defines `spec-injector` as main product and `Spec Cat` as mascot / companion character; see [brand-architecture.md](brand-architecture.md).
- #100 companion mascot: should use this plan to keep Spec Cat mascot exploration separate from CLI core.
- #111 status event schema: future companion visuals should consume [status-event-schema.md](status-event-schema.md) only after schema direction is clear.
- #112 daemon / runtime evaluation: companion runtime visuals must not appear as current capability before this evaluation is resolved.
- [product-moat.md](product-moat.md): defines why README visuals / showcase are useful but not moat by themselves.
- [source-trust.md](source-trust.md): provides canonical vocabulary for source trust, include modes, diagnostics, and context budget visuals.
- [workflow.md](workflow.md): provides the issue / PR / evidence workflow that validation and showcase diagrams should respect.
- [validation.md](validation.md): provides validation matrix and quality gates that future validation visuals should summarize without changing.

## Follow-up Issue Recommendations

Recommended small, non-overlapping issues:

- `docs(readme): add minimal pipeline diagram`
  - Add one diffable Mermaid or small exported diagram for the issue-to-context mental model.
- `design(assets): define README hero visual prompt`
  - Write a constrained design brief / prompt for a future README hero; do not generate final assets in the same issue.
- `design(companion): create Spec Cat visual direction board`
  - Explore mascot direction after #100 / #111 / #112 boundaries are clear.
- `docs(showcase): plan product deck outline`
  - Create a deck outline that separates current capability from roadmap.
- `docs(assets): add asset contribution and export guidelines`
  - Formalize file size, source/export, accessibility, naming, and bilingual review rules.
- `docs(validation): draft validation matrix visual`
  - Convert existing validation policy into a reviewable visual without changing validation behavior.

Each follow-up should state whether it creates assets, updates README, or only plans future assets.

## Non-goals

This plan does not:

- generate final assets
- modify README showcase
- add images, diagrams, or binary files
- run open-design / Figma / image generation
- implement companion UI
- implement daemon / status runtime
- add CLI commands or flags
- change runtime code
- change tests
- change package scripts or lockfiles
- change CI
- rename repo, package, CLI, or product
- mutate any target repo
