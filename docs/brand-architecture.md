# Brand Architecture Decision Record

## Purpose

本文件是 `spec-injector` 的 naming / brand architecture decision record。

它用來回答 `spec-injector`、`Spec Cat`、`spec-cat` 與其他候選名稱在產品架構中的角色，避免 roadmap、README 與 future docs 在產品 proof 尚未成熟前過早品牌漂移。

本文件不會 rename repo、package 或 CLI command。它不是 README rewrite，不是 visual asset plan，也不是 mascot / companion runtime implementation。

## Decision Summary

- Main product / CLI core name: `spec-injector`
- Mascot / companion character name: `Spec Cat`
- `spec-cat` 不作為主產品名，除非未來重新評估且通過本文件的 rename criteria。
- `Spec Cat` 可以作為 mascot、companion、future workflow observability character，但 companion layer 是 optional future layer，不是 CLI core。

## Brand Architecture

`spec-injector` 是 deterministic request-to-context compiler / CLI core / task package compiler。

它負責把 GitHub issue、future request input、repo docs、source references、guardrails、validation hints 與 source trust metadata 編譯成 bounded、reviewable、agent-ready task package / prompt。

`Spec Cat` 是 mascot / companion / future workflow observability character。

它可以出現在 roadmap、companion UX、status visualization、docs illustration 或 future visual asset work 中，但不應讓 `spec-injector` 變成 companion-first product。Companion layer 若未來成立，應消費 deterministic compiler output，而不是污染 CLI core 或改變 core product category。

## Why Keep `spec-injector`

`spec-injector` 目前仍是最準確的主產品名稱，原因是：

- 它描述產品的核心行為：把 request / issue context 注入 agent handoff 前的 bounded task package。
- 它符合 deterministic compiler positioning，而不是暗示 hidden planner、runtime agent 或 autonomous workflow。
- 它能容納 brownfield repo、existing GitHub issue、source trust、context budget 與 validation / evidence workflow。
- 它保留 agent-agnostic handoff 空間，不綁定特定 AI coding agent、hosted platform 或 companion UI。
- 它降低 cat-themed spec workflow 與 adjacent SDD platform 的命名碰撞。

品牌語言可以逐步改善，但主產品名不應在產品 proof、distribution path 與 migration plan 未成熟前被快速替換。

## Why Not Use `spec-cat` As Main Product Name Now

`spec-cat` 不適合作為目前主產品名：

- 它與 Spec Kitty、Spec Kit / SDD lifecycle 及 cat-themed spec workflow tools 有 adjacent naming collision risk。
- 它過度 mascot-forward，容易讓產品被理解成 companion-first product，而不是 deterministic request-to-context compiler。
- 它可能弱化 source trust、context budget、repo-safe no target mutation 與 bounded task package 這些核心差異。
- 它會增加 repo、package、CLI command、docs、install instructions 與 external references 的 rename 成本。
- 它可能讓 future README 或 visual asset work 提前承諾尚未實作的 companion / observability layer。

`Spec Cat` 仍然是好的 character name，但目前應放在 mascot / companion architecture 中，而不是取代主產品名。

## Adjacent Naming Risks

相鄰命名風險主要來自：

- Spec Kit / Spec-Driven Development lifecycle adjacency。
- Spec Kitty / cat-themed spec workflow adjacency。
- `spec-cat` 可能被誤讀為 Spec Kitty lite。
- `Spec Cat` 若放在主產品位置，可能暗示 workflow platform、agent loop、status dashboard 或 companion runtime 已是 core product。

`spec-injector` 不應宣稱自己全面優於 adjacent tools。它應清楚說明自己的窄定位：deterministic request-to-context compiler for AI coding agents，特別適合 brownfield repos、existing GitHub issues、source trust、context budget、repo-safe handoff 與 validation / evidence workflow。

避免策略：

- README / future docs 使用 `spec-injector` 作為 product name。
- `Spec Cat` 只在 mascot、companion UX、status visualization 或 future visual asset context 出現。
- 不把 `Spec Cat` 當成 rename shortcut。
- 不把 companion / daemon / runtime language 放進 CLI core positioning。

## Alternative Names Considered

| Name | Pros | Cons | Decision / current status |
| --- | --- | --- | --- |
| `Context Preflight` | 清楚傳達開工前 context 檢查；符合 safety / workflow guardrail 語意。 | 容易被理解成單一 preflight checker，而不是 compiler / task package generator；品牌辨識度較弱。 | 不採用為主產品名；可作 future feature / workflow phrasing。 |
| `Issue Preflight` | 強調 existing GitHub issue friendliness；很直覺。 | 過度綁定 issue input，無法容納 future fuzzy request / markdown brief input；也偏 checker 而非 compiler。 | 不採用為主產品名；可用於 issue-centric docs 說明。 |
| `Spec Marshal` | 有整理、編隊、handoff 的語感；比 cat naming 更嚴肅。 | `Marshal` 可能暗示 orchestration / command authority；也容易和 broader spec workflow platform 混淆。 | 暫不採用；除非未來 product category 改變才重新評估。 |
| `Context Marshal` | 強調 context organization / handoff；可涵蓋 issue 與 request。 | 仍可能暗示 agent orchestration；不如 `spec-injector` 精準描述現有 CLI。 | 暫不採用；可作 future internal metaphor，但不作 product name。 |
| `Spec Cat` / `spec-cat` | 親切、有 mascot potential，適合 companion / observability character。 | Collision risk 高；太 mascot-forward；可能誤導成 Spec Kitty lite 或 companion-first product。 | `Spec Cat` 保留為 mascot / companion name；`spec-cat` 不作主產品名。 |
| `spec-injector` | 描述現有 deterministic context compilation；已累積 repo / CLI / docs recognition；保留 agent-agnostic handoff。 | 名稱較工具感，不像 consumer-facing brand；對新使用者可能需要一句定位補充。 | 維持主產品 / CLI core name。 |

## Rename Criteria

只有在以下條件成立時，才重新考慮 product rename：

- Product scope materially changes，且 deterministic request-to-context compiler 不再是主產品類別。
- User research 顯示 `spec-injector` 持續造成錯誤理解，且 docs / tagline 無法修正。
- Package / CLI distribution 需要更友善或更可搜尋的名稱，且 migration cost 可控。
- Brand risk 明確高於已累積的 repo、CLI、docs 與 user recognition。
- Companion / mascot 成為 central product，且該方向經 human 明確批准。
- 已有 repo、package、CLI command、docs、GitHub references 與 migration messaging 的完整計畫。

在上述條件成立前，rename 不是 roadmap shortcut，也不是 visual asset 或 README refresh 的前置條件。

## Relationship To Roadmap Issues

- #100 companion mascot：應消費本 brand architecture，將 `Spec Cat` 定位為 mascot / companion character，而不是主產品 rename。
- #111 status event schema：若未來需要 workflow observability vocabulary，應讓 status layer 消費 deterministic compiler / workflow events，不應把 `Spec Cat` 塞進 CLI core semantics。
- #112 daemon / runtime evaluation：若評估 companion daemon 或 runtime，必須先維持 core boundary；daemon / runtime 不得 retroactively redefine `spec-injector` as companion-first product。
- #133 visual assets workflow：visual asset work 可以使用 `Spec Cat` 作 mascot direction，但應遵守 [visual-asset-workflow.md](visual-asset-workflow.md) 的 tool fit、storage、timing 與 overclaim boundaries；本文件不產生 logo、image 或 mascot implementation。
- #120 README showcase：future README showcase 應引用本 decision record，使用 `spec-injector` 作 product name，並把 `Spec Cat` 放在 roadmap / companion context。

這些 issues 應消費本 brand architecture；它們都不應強迫立即 product rename。

## Non-goals

本 decision record 不做：

- repo rename
- package rename
- CLI command rename
- README rewrite
- mascot implementation
- companion runtime
- daemon / status runtime
- visual asset generation
- logo / image work
- runtime code changes
- tests changes
- CI changes
- config schema changes
- GitHub metadata mutation beyond this PR evidence workflow
- target repo mutation

## Follow-up Guidance

Future README、product docs 與 PR bodies 應以 `spec-injector` 作為 product name，並用一句定位補足：

> `spec-injector` is a deterministic request-to-context compiler for AI coding agents.

`Spec Cat` 可以出現在 roadmap、companion UX、status visualization 或 visual asset planning 中，但應清楚標示為 mascot / companion character。它不應在 docs 中取代 `spec-injector`，也不應被用來暗示 companion runtime、daemon、workflow dashboard 或 visual assets 已經存在。

Visual asset work 應等待 #133。Full README showcase 應等待 #120，或在 #132 merge 後只做小幅 cross-link / wording update，避免與 concurrent README product narrative refresh 互相覆蓋。
