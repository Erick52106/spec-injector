# Product Moat Thesis

## Purpose

本文件是 `spec-injector` 近期 product direction 的 source of truth。

它用來回答一個務實問題：`spec-injector` 是否還值得繼續做，如果值得，真正值得累積的差異化是什麼。

本文件也用來避免 roadmap 漂移成：

- Spec Kitty lite
- Spec Kit clone
- Harness platform
- agent loop
- merge bot
- hosted remediation platform

它不是 marketing page，不是 competitor attack，也不宣稱 `spec-injector` 全面優於其他工具。它是一份 decision record：判斷哪些 issue 是 moat-building，哪些只是 hygiene / polish，哪些方向需要先停下討論。

## Product Thesis

`spec-injector` is a deterministic request-to-context compiler for AI coding agents.

更完整地說，`spec-injector` 將 GitHub issue、fuzzy request、repo docs、source references、source trust、guardrails、validation rules 與 diagnostics 編譯成 bounded、trust-labeled、agent-ready task package / prompt。

### Inputs

主要 input 應包含：

- existing GitHub issue
- future fuzzy request
- markdown task brief
- raw pasted request
- PR review note or partial plan, if later design allows it

GitHub issue 是目前已實作入口。Fuzzy request / markdown brief / raw request 是 future design direction，應先經過 deterministic input adapter design，不應直接加入 hidden LLM / RAG。

### Context

`spec-injector` 應編譯的 context 包含：

- repo docs
- source references
- source trust metadata
- guardrails
- validation rules
- missing / unreadable / alias diagnostics
- relevant workflow constraints

這些 context 的重點不是「越多越好」，而是讓 AI coding agent 開工前拿到可審查、可重複、source-trusted 的最小必要脈絡。

### Outputs

主要 output 是：

- bounded task package
- compact planning prompt
- future structured context contract, if #107 / #130 design proves it is ready

Output 不應變成 autonomous execution plan，也不應假裝已經做完 implementation decision。

### Goals

`spec-injector` 的目標是：

- 在 AI coding agent 修改檔案前，提供可檢查的 repo context。
- 讓 issue scope、repo docs、guardrails、references 與 validation hints 在同一份 handoff artifact 中被看見。
- 讓 source trust 與 context budget 可被設計、審查與測試。
- 支援 brownfield repos 和 existing issues，而不是只服務 greenfield SDD lifecycle。
- 保持 repo-safe，不自動修改 target repo code。

### Non-goals

`spec-injector` 不應成為：

- agent loop
- SDD lifecycle platform
- merge bot
- hidden LLM planner
- semantic RAG / vector search product
- hosted control-plane platform
- target repo auto-editing system
- companion daemon / runtime inside CLI core

## Product Survival Verdict

`spec-injector` 值得繼續做，但 niche 必須收窄。

它不值得被做成 another workflow platform。若產品方向變成 spec lifecycle、agent orchestration、remediation bot 或 merge automation，會直接撞上更大的工具與平台，而且 `spec-injector` 的 deterministic core 會被稀釋。

它值得繼續做的理由是：AI coding agent 的常見 failure mode 仍然不是「不會寫程式」，而是開工前 context 邊界不清、source trust 混在一起、repo-specific guardrails 被漏讀、reviewer 難以追蹤 implementation 是否遵守 source issue。這個問題在 brownfield repos 特別明顯。

真正需要 `spec-injector` 的團隊通常有以下特徵：

- 已有大量 GitHub issues、docs、repo instructions 與 validation rules。
- 使用 Codex、Claude Code 或多種 AI coding agents，但不想鎖死在單一 hosted platform。
- 重視 issue scope、evidence comment、PR body backfill、validation output 與 review freshness。
- 需要 deterministic, inspectable, repo-safe 的 pre-implementation context。
- 不想讓 target repo 被工具自動改寫或被 hidden LLM pipeline 決定 scope。

不太需要 `spec-injector` 的團隊包括：

- 願意全面採用 Spec Kit / SDD lifecycle，且主要需求是從 spec 到 plan 到 tasks 的完整流程。
- 想要 Spec Kitty 類 workflow platform、agent loop、dashboard、review / merge automation。
- 已經把 implementation workflow 交給 GitHub / platform agents，且接受 hosted orchestration 作為主流程。
- 只需要 generic prompt template，不需要 source trust、context budget 或 repo-safe diagnostics。
- repo 很小、docs 很少、issue scope 很直接，AI 自行讀 repo 的成本已經很低。

最可能被取代的方向是 generic prompt output、label audit alone、README showcase、basic issue summarization、general SDD workflow。這些方向不是 moat，平台與競品很容易內建或做得更完整。

`spec-injector` 的最佳 niche 是：brownfield repo 的 deterministic request-to-context compiler，專注 source trust、context budget、repo-safe diagnostics 與 auditable handoff。

## Strong Moat Candidates

### Deterministic request-to-context compilation

Why it matters: 這是產品核心。相同 issue / request、repo files 與 config 應產生可重複 output，讓 reviewer 能追蹤 context selection，而不是猜 AI 讀了什麼。

### Brownfield repo / existing issue support

Why it matters: 很多 AI tooling 偏向從 clean spec 或 greenfield lifecycle 開始。`spec-injector` 的優勢應在 existing GitHub issues、已存在 docs、既有 repo constraints 與 messy brownfield context。

### Source trust taxonomy

Why it matters: `repo always_read`、`built-in preset`、`issue-mentioned`、`auto-discovered` 的 trust level 不同。把它們清楚標出，能避免 inferred context 被誤讀成 human-approved scope。

### Context budget

Why it matters: AI context 不只是 token 成本問題，也是 attention budget 問題。若 `spec-injector` 能清楚定義 full content、summary、reference-only 與 diagnostics 的 include policy，會比 generic prompt collector 更有價值。

### Repo-safe no target mutation

Why it matters: `spec-injector` 讀 target repo context，但不自動修改 target repo code。這讓它可以安全用於 dogfood、planning、review handoff 與 multi-agent workflow，不把 compiler 變成 actor。

### Read diagnostics / missing / unreadable / alias hints

Why it matters: Missing files、unreadable files 與 deterministic alias hints 能揭露 stale docs、renamed paths、config health 與 issue quality 問題。這些 diagnostics 是 source trust 的一部分，不只是錯誤訊息。

### Bounded task package / prompt as auditable handoff

Why it matters: Task package 是 human、Codex、Claude Code、reviewer 之間共同看的 artifact。它讓 handoff 可以被審查、重跑、比較，而不是只靠聊天記憶或 hidden model context。

## Medium Moat Candidates

### Fuzzy request-to-context input

有用原因：能讓產品從 GitHub issue 擴展到 raw request、markdown brief、PR review note、AI-generated partial plan。

為何不是單獨 moat：如果沒有 deterministic parser、source trust 與 context budget，fuzzy input 很容易退化成 hidden LLM planner 或 generic prompt wrapper。

### Classifier domain detection

有用原因：domain detection 可協助 guardrail matching 與 reference discovery。

為何不是單獨 moat：keyword classifier 本身可被複製。真正 moat 在於 classifier evidence 如何接到 source trust、guardrails、diagnostics 與 output contract。

### PR / evidence / HEAD consistency checker

有用原因：能把目前 PR body、issue evidence comment、commit hash、CI / validation 回填流程轉成可檢查 guardrail。

為何不是單獨 moat：這主要服務 repo workflow hygiene。若沒有 source trust / context compiler 主軸，它會變成一般 GitHub workflow checker。

### Preflight checker

有用原因：可降低 AI 在 dirty worktree、錯 branch、錯 worktree path 上開工的風險。

為何不是單獨 moat：preflight 是重要 safety guardrail，但平台與 scripts 都能實作。它應支援 `spec-injector` repo-local workflow，不應變成 hosted harness product。

### Agent handoff docs

有用原因：讓 human、ChatGPT、Codex、Claude Code 與其他 agents 分工清楚，避免 suggestion 被誤當 approval。

為何不是單獨 moat：docs discipline 很重要，但單靠文件很容易被複製。它必須連到 deterministic task package contract 才能累積產品差異。

### Harness gap loop docs

有用原因：dogfood finding -> follow-up issue -> regression test -> evidence closeout 的 loop 能讓 repo 自身快速學習。

為何不是單獨 moat：這是 internal workflow discipline，不是產品主軸。它應改善 `spec-injector` 開發品質，而不是把產品改造成 Harness platform。

## Weak / Non-moat Candidates

### Issue label audit alone

有用但非 moat：label audit 可改善 backlog hygiene，但 taxonomy cleanup 很容易被 GitHub queries、scripts 或 platform tooling 取代。

### Label colors / taxonomy cleanup

有用但非 moat：一致 labels 讓 repo 好維護，但它不解決 request-to-context、source trust 或 context budget 的核心問題。

### README visuals / showcase

有用但非 moat：好的 README 能改善理解與信任，但若產品 proof 不足，showcase 只會放大未完成能力。

### Generic prompt output without source trust

有用但非 moat：prompt template 很容易被複製。沒有 source label、diagnostics、context budget 與 repo-safe boundary，就只是一般 prompt generator。

### Naming / branding alone

有用但非 moat：名稱能降低溝通成本，但不會替代 deterministic compiler 的 product proof。主產品名目前應維持 `spec-injector`；Spec Cat 可作為 future mascot / companion brand，不應變成主產品 rename 捷徑。

### Local small model / report clerk

有用但非 moat：local model 可做摘要或 clerk work，但會破壞 deterministic no hidden LLM boundary，且容易把產品帶向 generic assistant。除非未來有明確 opt-in design，否則不應進 core。

## Dangerous Distractions / Do-not-build List

| Direction | Why not now | When to revisit, if ever | Related issue |
| --- | --- | --- | --- |
| Full SDD lifecycle platform | 會把產品從 context compiler 推向 spec -> plan -> tasks -> implementation lifecycle，直接撞 Spec Kit / SDD tools。 | 只有在 deterministic context compiler 已證明不足，且 human 明確決定改產品類別時才討論。 | #128 |
| Spec Kitty lite | 會複製 workflow platform、agent loop、status / merge discipline，而不是強化 source trust。 | 不建議 revisit；只能借鏡 work package handoff 與 review discipline。 | #128 |
| Agent loop | 會讓 `spec-injector` 從 compiler 變成 actor，模糊 human approval 與 implementation ownership。 | 若未來另有獨立 product，必須在 CLI core 外部討論。 | #147, #149 |
| Merge bot | 會直接進入 high-risk GitHub automation，與 current no-merge policy 衝突。 | 不建議作為 `spec-injector` core。 | #109, #149 |
| Automatic remediation | 會把 review finding 自動轉成 code changes，容易繞過 human scope decision。 | 只可在 #149 做 supervised design，且晚於 #109 成熟。 | #149 |
| Bot thread auto-resolve | 會替 human / reviewer 做 judgment，容易處理 stale or unresolved comments。 | 不建議自動化；最多設計 read-only stale finding diagnostics。 | #149 |
| Hidden LLM planner | 會破壞 deterministic compiler thesis，讓 output source 不可審查。 | 不應進 core；若有 opt-in experiment，必須是外部 workflow 且清楚標示。 | #129, #130 |
| Semantic RAG / vector search | 會引入不可預期 retrieval、index freshness 與 hidden ranking 問題。 | 只有在 source trust / context budget design 後，且 deterministic fallback 成熟時才可研究。 | #130 |
| Target repo auto-editing | 會把 repo-safe compiler 變成 target repo automation tool。 | 不應由 `spec-injector` core 執行。 | #78, #151 |
| Companion daemon / runtime | 會把 CLI core 污染成 background process / observability runtime。 | Layer 4 後期，且只在 status boundary 穩定後，以外部 UI / watcher 探索。 | #100, #111, #112 |
| Product rename to Spec Cat / spec-cat | 會造成 Spec Kitty 語意碰撞，且把 branding 當成 product proof。 | #132 可設計 brand architecture；目前不 rename product / CLI。 | #132 |
| README showcase before product proof | 會展示未完成能力，讓 README 主敘事過度承諾。 | #127 / #130 / #151 或第二 dogfood 有結果後再更新。 | #133, #151 |
| Too many checkers before source trust / context budget is clear | 會把 roadmap 拉向 workflow hygiene，而不是 compiler moat。 | #108 / #109 / #110 應晚於核心 design，或明確服務 repo-local guardrails。 | #108, #109, #110, #130 |
| Machine-readable contract runtime before source trust / catalog design | 會在 taxonomy 未穩時過早固定 protocol，或滑向 product-facing runtime。 | #147 應晚於 #127 / #130 / #107 的核心決策。 | #147, #107, #130 |

## Adjacent Tools Boundary

本節延續 [docs/positioning.md](positioning.md) 與 #128 的結論：adjacent tools 可以借鏡，但不應被複製成 product roadmap。

### Spec Kit / SDD toolkit boundary

Spec Kit / SDD toolkits 適合採用 spec-driven development lifecycle 的團隊。它們的強項是 spec / plan / tasks 的 staged artifact workflow。

`spec-injector` 可借鏡 artifact boundaries、review gates 與 staged language，但不應成為完整 SDD lifecycle owner。它應專注 request / issue / repo evidence -> bounded context package。

### Spec Kitty boundary

Spec Kitty 類工具更像 workflow platform，包含 work packages、agent loop、status / dashboard、review / merge discipline 等方向。

`spec-injector` 可借鏡 work package handoff、lane / worktree discipline 與 status visibility，但不應複製 agent loop、dashboard runtime、merge automation 或 platform scope。

### GitHub / platform agent workflow boundary

GitHub / platform agent workflows 適合把 implementation task 交給 hosted or platform-integrated agent，並由平台追蹤 branch、commit、PR、review 與 logs。

`spec-injector` 不應正面硬撞 hosted orchestration。它應產生 agent-agnostic context，讓人或任意 agent 使用，而不是要求特定 platform runtime。

### Open-design boundary

Open-design 可借鏡 README quality、product artifact discipline、visual workflow 與 future companion prototype approach。

但 open-design 不應讓 `spec-injector` 變成 design platform、asset runtime、skill marketplace 或 daemon。#133 應先做 visual workflow planning，不應直接生成 showcase 或改 CLI core。

### Harness Engineering boundary

Harness Engineering 是 `spec-injector` repo 自身 AI-assisted development workflow 的借鏡，不是產品主軸。

可借鏡的部分包括：

- commit-bound evidence
- SHA / HEAD discipline
- preflight checks
- review freshness
- dogfood-to-regression loop

這不代表 `spec-injector` 要成為 hosted control-plane platform、agent orchestration platform、remediation bot 或 merge bot。

Issues #108 / #109 / #110 / #148 / #147 應優先服務 repo-local workflow guardrails。它們可以改善 `spec-injector` 自己的開發可靠性，但不能把 product thesis 從 deterministic request-to-context compiler 改成 Harness platform。

## Issue Implications

- #130：最重要的 moat design。先定義 source trust / context budget，再談 richer output 或 context protocol。
- #129：保留。先設計 deterministic input adapters，不做 hidden LLM / RAG / semantic search。
- #107：catalog / protocol design，應對齊 #130，避免 taxonomy 散落與過早 custom domains runtime。
- #147：internal workflow contract，晚於 #130 / #107，不 runtime 化，不把 internal harness discipline 當產品主軸。
- #108 / #109 / #110：workflow guardrails，晚於 strategy / design；可服務 repo-local workflow，不做 automation platform。
- #132 / #133 / #100 / #111 / #112：Layer 4 deferred。可以設計 mascot / companion / visual workflow，但不要 rename、不要 runtime、不要 README showcase before proof。
- #149：defer，design only。不得實作 remediation bot、auto-push、auto-resolve、auto-merge。
- #151：在 major product claims 前做 second brownfield dogfood planning，避免只用 tachigo 一個樣本下結論。
- #71：next implementation anchor。它是 Layer 1 test foundation，能讓 core compiler 更可靠，應優先於 speculative runtime。

## Roadmap Recommendation

### Phase 1: near term

Goals:

- 穩住 Layer 1 compiler reliability。
- 完成 product moat thesis。
- 開始 source trust / context budget design。
- 用第二個 brownfield dogfood 或 deterministic input design prep 驗證 product niche。

Issues to do:

- #71
- #127
- #130
- #151 or #129 design prep

Issues to avoid:

- #149 remediation automation
- Layer 4 companion runtime
- README showcase
- broad checker suite without source trust design

Success criteria:

- Core tests 更容易維護。
- Product moat / non-moat / do-not-build list 明確。
- #130 給出 source trust 和 context budget policy。
- 第二 brownfield dogfood plan 或 fuzzy input design 不依賴 hidden LLM / RAG。

### Phase 2: mid term

Goals:

- 擴展 request-to-context design，但維持 deterministic input boundary。
- 將 source trust 與 taxonomy 推進成 catalog / protocol design。
- 把 internal workflow contract 與高價值 guardrails 對齊，不 runtime 化。

Issues to do:

- #129
- #107
- #147
- #109 / #108

Issues to avoid:

- product-facing JSON runtime before catalog is stable
- automatic PR body edits as default
- checker-driven roadmap without compiler improvement
- target repo automation

Success criteria:

- Fuzzy input 有 deterministic parser / trust boundary design。
- Catalog / protocol naming 與 internal vs public contract boundary 清楚。
- Internal workflow contract 只服務 repo-local guardrails。
- Evidence / preflight checkers 若實作，tests 不依賴真 GitHub API。

### Phase 3: later

Goals:

- 在 core compiler、source trust、catalog / protocol 與 dogfood evidence 穩定後，再處理 broader workflow polish 與 Layer 4 presentation。
- 只把 remediation loop 當 risk design，不做 automation default。

Issues to do:

- #110
- #148
- Layer 4 / README showcase / open-design planning
- #149 only as risk design

Issues to avoid:

- companion daemon in CLI core
- Spec Cat product rename
- auto-resolve / auto-merge / remediation bot
- README claims that imply unfinished capabilities

Success criteria:

- Label / workflow hygiene 不破壞 product focus。
- Harness gap loop 成為 repo-local learning discipline。
- README / visuals 只展示已驗證能力。
- Layer 4 仍是 companion UX boundary，不污染 deterministic core。

## README Positioning Policy

README 現在不應大改主產品敘事。

目前 README 應維持 `spec-injector` 是 deterministic issue-to-context compiler 的主敘事。等 #127 / #130 / #151 或第二個 brownfield dogfood 有結果後，才考慮更新 README positioning。

README 不應展示未完成能力，例如 hidden source trust implementation、fuzzy input command、JSON output、companion runtime、remediation loop、open-design showcase 或 platform automation。

若 README 新增 docs link，可以保持短連結，不重寫主敘事。若更新 bilingual docs link，`README.en.md` 也要同步。

## Decision Summary

Do next:

- 完成 #127 product moat thesis。
- 做 #71，強化 Layer 1 compiler tests。
- 做 #130，定義 source trust / context budget。
- 做 #151 或 #129 design prep，避免 product judgment 只依賴單一 dogfood 或 GitHub issue-only input。

Do later:

- #107 catalog / protocol design。
- #147 internal workflow contract design。
- #108 / #109 workflow guardrails。
- #148 harness gap loop docs。

Do not build:

- Spec Kitty lite。
- Full SDD lifecycle platform。
- Agent loop。
- Merge bot。
- Hidden LLM planner。
- Semantic RAG / vector search as core。
- Target repo auto-editing。
- Companion daemon / runtime inside CLI core。

Defer until proof:

- README product showcase。
- Open-design-generated visuals。
- Spec Cat companion UX implementation。
- Status event schema / daemon / overlay runtime。
- Supervised remediation loop。
- Product-facing machine-readable runtime contract。
