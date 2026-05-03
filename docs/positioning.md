# Positioning and adjacent workflows

## Purpose

這份文件是 `spec-injector` 的 roadmap guardrail。

它不是競品攻擊、不是 marketing claim，也不是要證明 `spec-injector` 全面優於其他工具。它的目的，是讓後續 issue / PR 在參考 Spec Kit、Spec Kitty、open-design、GitHub / platform agent workflow 類工具時，能清楚知道哪些能力值得借鏡，哪些產品邊界不應照抄進 `spec-injector` core。

核心提醒：相鄰工具可以啟發 artifact discipline、workflow clarity、review handoff 與產品呈現，但不應把 `spec-injector` 推向 another Spec Kit、Spec Kitty lite，或 generic agent workflow platform。

產品護城河、non-moat risk register、do-not-build list 與 roadmap ordering 的 source of truth 見 [docs/product-moat.md](product-moat.md)。
Source trust taxonomy、include modes 與 context budget vocabulary 見 [docs/source-trust.md](source-trust.md)。

## spec-injector positioning

`spec-injector` is a deterministic issue/request-to-context compiler for AI coding agents.

它的主要責任是把 implementation 開始前需要的脈絡，整理成可檢查、可重複、受 repo 設定約束的 task package / prompt。它主要處理：

- existing GitHub issues
- fuzzy requests / future input direction
- brownfield repos
- repo docs
- source references
- guardrails
- validation hints
- bounded task package / prompt

`spec-injector` 應守住的定位：

- deterministic issue/request-to-context compiler
- existing GitHub issue / fuzzy request / brownfield repo friendly
- repo-safe / no target repo mutation
- source trust taxonomy
- bounded task package
- validation / evidence workflow
- agent-agnostic handoff
- token / context budget efficiency
- machine-checkable guardrails

`spec-injector` 明確不是：

- not an autonomous agent
- not a spec lifecycle platform
- not an agent loop
- not a merge bot
- not a hidden LLM planner
- not target repo auto-editing

換句話說，`spec-injector` 應把「任務開始前的可信 context」做得準、窄、透明，而不是接管後續 implementation runtime。

## Adjacent tool categories

### A. Spec Kit / Spec-Driven Development toolkits

Spec Kit / SDD toolkits 通常從 requirements / spec 開始，把 product intent 轉成 specs、plans、tasks，再接到 implementation workflow。它們適合願意採用 spec-driven development lifecycle 的團隊，尤其是希望用 structured specs 來驅動 greenfield、brownfield enhancement 或 multi-step refinement 的場景。

這類工具值得 `spec-injector` 借鏡的是 artifact boundary、staged workflow clarity、spec / plan / task 的分層語言，以及對人類 review gate 的重視。

差異在於：`spec-injector` 不應把自身變成完整 SDD lifecycle。它不負責生成完整 spec lifecycle，也不負責將 specs 推進到 implementation / merge。它應專注在 existing issue / request / repo evidence 到 bounded context package 的 deterministic compilation。

### B. Spec Kitty 類 workflow platform

Spec Kitty 類工具看起來更偏完整 spec-driven development workflow platform：它以 spec / plan / tasks、work packages、agent loop、review、merge、dashboard / status 等方向組織 feature delivery。這類工具適合想把 feature delivery 流程交給 SDD workflow，並接受 repo-native workflow artifacts、worktree lanes、agent-facing commands 或 merge / review discipline 的團隊。

這類工具值得借鏡的是 work package handoff、lane / worktree isolation、review discipline、status visibility 與 artifact lifecycle。

差異在於：`spec-injector` 不應複製 agent loop、dashboard runtime、merge automation 或 workflow platform scope。若未來需要更好的 handoff，應把它轉化為 deterministic task package contract、machine-checkable guardrails、validation / evidence hints，而不是把 companion / daemon / runtime 塞進 CLI core。

### C. open-design

open-design 更偏 design workflow、product assets、prototypes、visual artifacts 與 skill / design-system catalog。它的官方 repo 將自己定位為 local-first design artifact workflow，透過現有 coding agents、skills、design systems、sandboxed preview 與 export pipeline 來產生 web / desktop / mobile prototypes、slides、images、videos 等 artifacts。

這類工具值得借鏡的是 README product quality、visual asset pipeline、product showcase、design system discipline、artifact-first docs，以及 companion UI prototype / status layer 的呈現方式。

差異在於：`spec-injector` 不應把 daemon、design platform、skill marketplace 或 visual artifact runtime 照搬進 core。若要借鏡 open-design，應轉化為 docs / README 品質、可視化 workflow evidence、future companion status layer inspiration，而不是改變 CLI core 的 deterministic compiler positioning。

### D. GitHub / platform agent workflow

GitHub / platform agent workflow 更偏平台級 agent orchestration、tracking 與 GitHub integrated workflows。以 GitHub Copilot cloud agent 為例，官方 docs 描述它可以研究 repo、建立 implementation plan、在 branch 上修改 code，並與 issue / PR workflow 整合。這類工具適合把 coding task 交給平台 agent，在 GitHub-hosted workflow 中追蹤 branch、commit、PR、review 與 agent iteration。

這類工具值得借鏡的是 PR / issue integration、status visibility、review handoff、workflow logs 與 human review checkpoint。

差異在於：`spec-injector` 不應正面硬撞平台級 agent workflow，也不應假設自己是 hosted orchestration layer。它應保持 transparent、deterministic、repo-safe context compiler：產出 agent-ready context，讓人或任意 agent 決定如何實作。

### E. Harness Engineering as internal workflow inspiration

Harness Engineering 可以作為 `spec-injector` repo 自身 AI-assisted development workflow 的借鏡，例如 commit-bound evidence、SHA / HEAD discipline、preflight checks、review freshness 與 dogfood-to-regression loop。

差異在於：這是 internal workflow inspiration，不是產品主軸。`spec-injector` 不應因此成為 hosted control-plane platform、agent orchestration platform、remediation bot 或 merge bot。#108 / #109 / #110 / #148 / #147 應優先服務 repo-local workflow guardrails，而不是把 CLI core 轉成 Harness platform。

## Differentiation table

| Comparison object | Primary input | Main artifact | Runtime model | Target mutation behavior | Agent dependency | Best-fit use case | What spec-injector should borrow | What spec-injector should avoid copying |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| spec-injector | GitHub issue, future fuzzy request, repo docs, source references, guardrails | Bounded task package / prompt | Deterministic CLI compiler | Repo-safe; does not mutate target repo code | Agent-agnostic handoff | Brownfield repo issue planning, safe pre-implementation context, evidence-aware handoff | Keep deterministic artifact boundaries, source trust taxonomy, validation hints, machine-checkable guardrails | Hidden LLM planner, agent loop, merge automation, target repo auto-editing |
| Spec Kit / SDD toolkit | Requirements, product intent, specs | Spec / plan / tasks and related workflow artifacts | CLI / templates / agent-integrated SDD workflow | May generate or update project workflow artifacts; implementation depends on chosen agent workflow | Usually paired with supported AI coding agents | Teams adopting spec-driven development lifecycle | Staged artifact clarity, spec / plan / task language, review gates, worktree isolation ideas | Full SDD lifecycle ownership, broad spec platform scope, implementation workflow takeover |
| Spec Kitty style workflow platform | Mission / feature specs, work packages, agent commands | Work packages, mission / feature artifacts, workflow state | Repository-native workflow platform with agent-facing commands and status flows | Appears designed to manage workflow artifacts and may drive review / merge flows depending on command usage | Designed around AI coding agents and automation tooling | Teams that want structured SDD feature delivery with work packages and agent loops | Work package handoff, lane / worktree discipline, status visibility, review / merge discipline | Agent loop, dashboard/runtime platform, auto-merge behavior, Spec Kitty lite scope |
| open-design | Design prompt, skill, design system, product artifact intent | Prototype, visual asset, deck, document, exportable design artifact | Local-first design workflow with daemon / app / skill catalog | Mutates design project artifacts, not a target repo context package by default | Uses existing coding agents as design engines | Product showcase, prototypes, design docs, visual asset pipelines | README quality, visual artifact discipline, companion UI/status inspiration, product showcase craft | Daemon or design platform in CLI core, skill marketplace as core requirement, visual runtime scope |
| GitHub / platform agent workflows | GitHub issue, chat prompt, PR comment, platform task | Branch, commits, PR, agent logs, review loop | Hosted or platform-integrated agent orchestration | Agent can make code changes on a branch and open or update PRs | Platform-specific agent dependency | Delegating implementation work inside GitHub / platform workflow | Issue / PR integration, review handoff, workflow transparency, status tracking | Hosted orchestration layer, platform lock-in, branch/PR automation as core compiler behavior |

## Moat-relevant differentiators

`spec-injector` 應累積的差異化能力：

- deterministic context compilation
- existing issue / brownfield repo support
- fuzzy request-to-context future direction
- source trust taxonomy
- repo-safe no target mutation
- external config for read-only dogfood
- validation / evidence workflow
- agent-agnostic handoff
- context budget / token efficiency
- machine-checkable guardrails

這些能力的共同點是：它們強化 compile-time trust、scope control、handoff quality 與 reviewability，而不是讓 `spec-injector` 變成另一個 implementation runtime。

## Do-not-build warnings

`spec-injector` 不應往下列方向漂移：

- 不要做完整 Spec-Driven Development lifecycle platform
- 不要做 agent loop / merge automation
- 不要做 hidden LLM planner
- 不要做 target repo auto-editing
- 不要做 custom domains runtime 太早實作
- 不要把 companion / daemon runtime 塞進 CLI core
- 不要把 spec-injector 變成 Spec Kitty lite

若某個 future issue 需要碰到上述方向，應先明確回答：這是 deterministic compiler 的 contract 擴充，還是 runtime / platform scope creep。後者預設不是 Layer 1 / CLI core 的工作。

## Borrowing map

From Spec Kit / Spec Kitty:

- artifact boundaries
- staged workflow clarity
- work package handoff
- review / merge discipline
- worktree isolation ideas

轉化方式：只吸收 artifact / handoff / review discipline，轉成 deterministic task package sections、validation hints、issue evidence workflow 與 worktree-first agent instructions。

From open-design:

- README product quality
- visual asset pipeline
- product showcase
- companion UI prototype / status layer inspiration
- design system / artifact discipline

轉化方式：優先改善 docs、examples、visual explanation、future companion UX research；不要把 daemon / design platform runtime 放進 compiler core。

From GitHub / platform tools:

- PR / issue integration
- status visibility
- review handoff
- but not hidden platform dependency

轉化方式：讓 task package 更適合被任意 agent、GitHub issue workflow 或 PR evidence workflow 消費；不要要求使用特定 hosted agent 或平台 runtime。

## Relationship to existing issues

這份 positioning doc 是下列後續工作的 guardrail，不是它們的 implementation：

- #127 product moat thesis
- #129 fuzzy request-to-context
- #130 source trust and context budget
- #107 catalog / protocol design
- #131 agent handoff patterns
- #132 naming / brand architecture
- #133 open-design-assisted visual assets

特別是 #129 / #130 / #107 / #131 可以擴充 compiler contract，但仍應維持 deterministic、repo-safe、agent-agnostic。#132 / #133 可改善產品語言與 visual assets，但不應變成產品 rename 或 runtime scope 的捷徑。

## Recommended near-term stance

Keep spec-injector focused on deterministic issue/request-to-context compilation.

Do not chase full SDD platform scope. Use adjacent tools as inspiration, not as roadmap to copy. Adjacent tools在各自領域有合理優勢：Spec Kit / Spec Kitty 在 SDD lifecycle 與 workflow artifacts 上更完整，open-design 在 product / visual artifact pipeline 上更強，GitHub / platform agents 在 hosted orchestration 與 issue-to-PR execution 上更直接。

`spec-injector` 的 near-term claim 應由 #78 dogfood 與 future implementation evidence 驅動。產品語言應描述已驗證的 compiler / handoff / evidence 能力，不應用未實作的 companion、daemon、catalog protocol、fuzzy request 或 platform automation 來提前包裝。

## References

- GitHub Spec Kit official repository: https://github.com/github/spec-kit
- Spec Kitty official repository: https://github.com/Priivacy-ai/spec-kitty
- Spec Kitty official documentation: https://docs.spec-kitty.ai/
- open-design official repository: https://github.com/nexu-io/open-design
- GitHub Copilot cloud agent official documentation: https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-cloud-agent
