# Workflow

## Purpose

本文件說明 `spec-injector` 在 issue-to-PR 流程中的位置，以及 AI agent 應如何使用 isolated git worktree、issue / PR structure、labels、validation matrix、implementation evidence、PR body backfill、review / merge / cleanup rules。

`spec-injector` 負責產生 deterministic task package。AI implementer 與 human review process 負責實作、驗證與 merge decision。Root `AGENTS.md` 是 AI agent 進入 repo 的第一層規範入口；本文件提供詳細流程。

Internal machine-readable workflow contract 的 design-only vocabulary 見 [internal-workflow-contract.md](internal-workflow-contract.md)。該 contract 只描述 repo-local workflow expectations，不代表 CLI runtime、checker、merge bot 或 PR automation 已實作。

Dogfood finding、review blocker、CI failure、evidence freshness gap 與 repeated workflow failure 如何轉成 bounded follow-up issue，見 [harness-gap-loop.md](harness-gap-loop.md)。該 loop 是 repo-local workflow discipline，不是 hosted harness platform 或 remediation automation。

Issue / PR label taxonomy、visual hierarchy、combination rules、migration staging 與 #110 label / milestone audit checker rules 見 [label-taxonomy.md](label-taxonomy.md)。

Autonomous Worker Profiles / Codex autonomous PR work 的 start-gate routing source of truth 見 [Hybrid AWP routing policy](hybrid-awp-routing-policy.md)。該 policy 只適用於有明確 autonomous routing signal 的 workflow；一般 human PR 或非 autonomous work 不應因缺少 AWP routing evidence 而 fail。

若 autonomous workflow 有 start-gate routing evidence，可在 commit / merge 階段用 local file 傳入 `spec workflow-check --routing-evidence <path>`。該檢查只讀本地 PR body 與本地 routing JSON，驗證 status/ref、delegation log、Spark / ops evidence、5.4 worker evidence、explicit fallback reason 與 merge HEAD freshness；它不讀取或修改 GitHub remote state，也不要求 downstream Scope Police 解析完整 routing plan。

Autonomous review follow-up 的 batching、freshness、duplicate collapse、root-cause escalation、patch budget 與 final closeout ledger source of truth 見 [AWP review triage gates](awp-review-triage-gates.md)。可用 `spec awp-review-check --repo . --evidence <path>` 檢查 local JSON evidence；該 checker 不讀寫 GitHub、不 resolve review threads、不 auto-fix、不 merge，也不要求 downstream Scope Police 解析完整 ledger。

Supervised remediation loop 的 #149 design 見 [supervised-remediation-loop.md](supervised-remediation-loop.md)。該文件只定義 human-supervised review finding follow-up、finding-to-commit traceability、stale finding prevention、validation refresh 與 do-not-automate boundaries；它不是 current remediation bot，也不授權 auto-fix、auto-resolve、auto-merge、auto-close 或 target repo mutation。

Downstream target repo 如何採用 `spec workflow-check` status/ref evidence、何時仍需要 target repo PR、以及 tachigo / tachiya thin-wiring examples，見 [target repo adoption contract](target-repo-adoption-contract.md)。該 contract 明確保留 local-only、read-only、no target repo mutation 邊界。

Downstream AI entrypoints 若需要安裝、更新或檢查 `spec-injector` AWP capability，請引用 [AI bootstrap install contract](ai-bootstrap-install-contract.md)。該 contract 定義 canonical repo URL、`SPEC_INJECTOR_DIR` local runner fallback、`spec doctor --workflow awp --format json` readiness check，以及 no generated output / no target repo mutation 邊界。

Future companion / workflow observability status vocabulary 見 [status-event-schema.md](status-event-schema.md)。該 schema 是 Layer 4 design proposal，不代表 daemon、companion UI、CLI JSON output、watcher、merge bot 或 target repo automation 已實作。

`spec label-audit` 是 repo-local、human-readable 的 read-only guardrail。它讀取 accepted taxonomy 與 `gh issue list` / `gh pr list` metadata，輸出 `PASS` / `WARNING` / `NEEDS-HUMAN-REVIEW`；它只 report，不建立 labels、不修改 labels、不修改 milestones、不修改 issue / PR metadata。`needs human review` 代表 stop-and-report，不代表 checker 自動替 human 做 metadata 決策。

相鄰工具與 roadmap 邊界請見 [docs/positioning.md](positioning.md)。多 agent / Codex / Claude Code / ChatGPT / other agents 的分工與 handoff patterns 請見 [docs/agent-handoff.md](agent-handoff.md)。

## Autonomous / AWP start-gate overlay

若 user prompt、source issue、task package 或 repo-local instruction 明確要求 AWP、Autonomous Worker Profiles、autonomous worker routing 或等價 worker-routing contract，controller 必須把它視為 `autonomous routing signal`。Signal detection 可以發生在 prompt reading / issue triage 階段；但 worker dispatch、implementation slice 或 controller-direct fallback evidence 必須 after startup safety checks，也就是完成 main repo status check、dedicated worktree 建立與 worktree clean readback 之後，且 before implementation。這個 overlay 不取代 issue-first、worktree-first、validation、PR evidence 或 review closeout。

有 AWP signal 時，implementation 前必須先留下 start-gate evidence：

- `worker dispatch`：controller 實際派出 bounded worker / subagent 做 exploration、implementation slice 或 readback，並記錄 assigned scope、result summary 與 `delegation_outcome=completed|fell_through`。
- `controller-direct fallback`：controller 不派 worker，但明確記錄 `controller_fallback=allowed`、bounded `controller_fallback_reason` 與 `delegation_outcome=skipped|unavailable`。

AWP closeout 應在 source issue、PR body、implementation evidence comment 或 merge closeout 中能讀回 routing mode、task class、controller fallback decision、fallback reason 與 `delegation_outcome`。repo-native workflow compliance、`spec plan`、dedicated worktree、validation、PR body evidence 與 issue closeout 只證明一般 repo workflow；它們本身不是 AWP delegation evidence。

沒有 autonomous routing signal 的 ordinary human PR / non-AWP AI work 不需要 worker dispatch 或 controller-direct fallback evidence，相關欄位可維持 `n/a`、`manual` 或 `skipped`。

## Worktree-first workflow

Main repo 是 control plane，應保持 clean / synced。Code/docs implementation 不直接在 main repo worktree 做。

每張 code/docs issue / PR 應建立 dedicated git worktree。每個 worktree 對應一條 branch。這讓不同 issue 可以獨立 checkout、test、commit 與 push，而不會互相污染 working tree 狀態。

不同 issue 若檔案範圍不重疊，可以在不同 worktree 併發。共用同一 working tree 時不應併發 code 任務。

Metadata-only 任務原則上不需要 worktree，但 metadata 任務不得依賴切換 dirty repo，也不得自動 stash / clean / reset main repo。

## Standard startup sequence

Code/docs implementation 的標準啟動流程：

```bash
git checkout main
git pull
git status
```

若 main repo worktree dirty，必須 stop-and-report，不自動 `stash`、`clean`、`reset` 或 checkout 覆蓋 local changes。

Main repo clean 且 synced 後，建立 dedicated worktree：

```bash
ROOT=$(git rev-parse --show-toplevel)
mkdir -p "$ROOT/../spec-injector-worktrees"
git worktree add -b <branch-name> "$ROOT/../spec-injector-worktrees/<worktree-name>" main
cd "$ROOT/../spec-injector-worktrees/<worktree-name>"
git status
```

Worktree 狀態必須 clean 才能實作。之後的 edit / test / commit / push / PR 都在該 worktree 內完成。

若本地已安裝 repo-local CLI，可在 dedicated worktree 內先執行 human-readable preflight：

```bash
spec preflight \
  --repo "$PWD" \
  --expected-branch <branch-name> \
  --expected-worktree-root ~/.config/superpowers/worktrees/spec-injector
```

`spec preflight` 是 repo-local workflow guardrail。它只做 deterministic read-only checks，report `pass` / `warning` / `fail` / `needs-human-review` 類結果，不自動 `stash`、`clean`、`reset`、`checkout` 或修復任何狀態。若 main repo dirty、current worktree dirty、current checkout 其實是 main worktree、或 branch / worktree expectation 不符，應 stop-and-report，再由 human / implementer 決定下一步。

若同時需要 read-only target repo safety 提醒，可加上：

```bash
spec preflight --repo "$PWD" --target-repo <target-repo-path>
```

此檢查只回報 target repo 狀態與 safety reminder，不得修改 target repo、不得建立 target repo `.spec-injector/`、不得在 target repo 建 branch / commit / PR。

PR 建立、source issue evidence comment 留下、且 PR body 回填 evidence URL 後，可執行 repo-local evidence consistency checker：

```bash
spec evidence-check \
  --pr <pr-number-or-url> \
  --repo <owner/name> \
  --expected-head <latest-head-sha>
```

`spec evidence-check` 是 read-only workflow guardrail。它只讀取 PR body、source issue comments、latest PR HEAD、review evidence 與 `gh pr checks` summary，report `PASS` / `WARNING` / `FAIL` / `NEEDS-HUMAN-REVIEW` 類結果；它不 auto-fix PR body、不修改 issue comments、不 resolve review threads、不 merge、不 close issue。若 checker 回報 stale HEAD、stale evidence URL、CI failure、或 review finding assessment 缺失，應 stop-and-report，由 human / implementer 決定如何刷新 evidence 或拆 follow-up。

CodeRabbit / Codex auto review findings 只能作為 auxiliary signals。`spec evidence-check` 可提醒 review finding assessment 是否存在，但不代表 approval，也不取代 human merge decision。

Thread-level limitation：`spec evidence-check` 目前只做 read-only 輔助檢核，不會完整 enforce GitHub review thread / conversation closeout。它可提醒 PR body / evidence / HEAD / validation / findings shape，但不能保證每條 CodeRabbit / Codex / human thread 都已關閉。`PASS` 僅表示輔助欄位滿足程度，不是 merge approval。該 checker 不能 auto-comment、auto-resolve、auto-merge、auto-close，也不會 mutate GitHub issue / PR metadata；最終 thread-level closeout 必須由 human 逐條確認與接手。

`spec workflow-check --phase merge --pr <number-or-url>` 可做 local-only merge closeout readback。它會讀取 PR body、draft state、review metadata、`gh pr checks` summary 與 review threads，並把無法可靠判斷的 GitHub / `gh` output drift 回報成 `manual` fallback，而不是把工具層 schema mismatch 誤判成 PR 本身不可 merge。這個 `--pr` readback path 不依賴 target repo `.spec-injector/config.json`；若 local config 不存在，checker 會保留 warning 並繼續 readback，避免 repo-local closeout 被 config bootstrap 狀態誤擋。`start` / `commit` phase 仍需要 local config。若 checks readback 回傳缺欄位、未知 enum、或只有無法歸類的 status shape，controller 應以 PR 頁面、`gh pr checks`、Actions UI、review thread readback 補人工 evidence；不得因 manual fallback 自動 merge，也不得讓 checker auto-comment、auto-resolve 或 mutate GitHub。

## Worktree naming

建議命名：

- worktree parent: `../spec-injector-worktrees`
- worktree path: `issue-<number>-<slug>`
- branch name: `<type>/<issue-number>-<slug>`

Repo-local worktree scratch directories（例如 repo root 的 `.worktrees/`、`worktrees/`、`spec-injector-worktrees/`）已被 root-anchored ignore，避免本機容器變成 commit candidate，也避免隱藏 nested docs / fixtures。除非任務另有要求，canonical shared parent 仍是 `../spec-injector-worktrees`。不要 commit local worktree contents。

Examples:

- `docs/123-agent-worktree-workflow`
- `codex/81-dirty-worktree-warning`
- `fix/84-separate-issue-mentioned-auto-discovered-references`

Slug 應短、可讀，並對應 source issue。不要為同一 issue 建立多個語意重複的 worktree。

## Prompt requirements

交給 Codex / Claude Code / 其他 AI agent 的 implementation prompt 應包含：

- issue URL
- branch name
- worktree path or naming rule
- scope
- allowed files
- forbidden changes
- stop-and-report conditions
- validation commands
- PR requirements
- issue evidence comment requirement
- PR body backfill requirement
- final report format
- no branch cleanup during implementation

Prompt 中的 suggestions 不等於 approval。若 prompt、issue、repo instructions 或 human message 互相衝突，停下回報並請 human 決定。

## GitHub language rules

GitHub issue body、PR body、implementation evidence comment、review note 與 final report 預設使用繁體中文。

技術名詞、CLI commands、file paths、raw errors、raw command output、external API names、labels、milestones、commit hash 與必要的英文片段可保留英文。英文應用於精準表達技術內容，不應讓整份 issue / PR / evidence / report 預設變成英文。

## Issue workflow

標準順序：

```text
GitHub issue
  -> branch / dedicated worktree
  -> implementation
  -> validation
  -> PR
  -> source issue implementation evidence
  -> PR body backfill
  -> review / merge decision
```

Issue body 應包含：

- Goal
- Motivation
- Scope
- Non-goals
- Validation
- Completion criteria

Issue body 預設使用繁體中文。技術名詞、commands、file paths 與 raw errors 可保留英文。

Issue 應有合適 labels、roadmap milestone 與 primary layer label。Open implementation issue 進 PR review 後可用 `status:in-review`。Merge / complete 後可用 `status:implemented`。Ambiguous planning issue 應保留 `status:needs-design`，不要把 needs-design 當成 implementation approval。

## PR workflow

PR 必須 ready for review，不要 draft，除非 issue 特別要求。

PR body 預設使用繁體中文。技術名詞、commands、file paths、raw errors、external API names 與必要的英文片段可保留英文。

PR 原則上沿用 linked issue 的 roadmap milestone、primary layer label 與合理 area / type labels。若 linked issue 缺少 metadata，PR 作者應在 final report 標記 follow-up；若目前 scope 明確允許 metadata 修正，才可補上。若 PR 對應多個 issues，選擇主要 milestone / layer，並在 PR body 說明判斷。若 PR 沒有 linked issue，但 scope 可高信心分類，依實際變更套用 metadata；無法高信心判斷時列入 needs human review，不要硬套。

PR body 必須包含：

- `Closes #<issue-number>`
- Summary
- Tests / validation
- Implementation Evidence
- issue evidence comment URL
- commit hash
- scope guard / non-goals confirmation

PR 建立後要在 source issue 留 implementation evidence comment，再把 issue evidence comment URL 回填 PR body。

write action 後不得只看 exit code。PR body、issue evidence comment、review rationale comment / closeout comment 等 GitHub mutation 都必須立即 readback verify。

PR body 寫入後，必須立即用 `gh pr view <pr-number> --json body,headRefOid`（或等價方式）反查，確認：

- PR body 非空
- 包含 `Closes #<issue-number>`
- 包含 issue evidence comment URL
- 包含 commit hash
- 包含 validation 結果
- 包含 scope guard / non-goals confirmation

Issue evidence comment 新增或更新後，必須用 `gh issue view` / `gh api` 等 readback 方式確認 comment URL 與內容存在；若無法讀回，視為 mismatch 並 stop-and-report 或修正後重試。

Review rationale comment / closeout comment 若作為 merge evidence，也必須能 readback，或在 final report 中提供明確的 URL 與 readback 狀態；若使用 comment 作 evidence，final report 不得只寫「已補齊」。

若 readback 發現以下情況，需 stop-and-report 或先修正後重新 verify 再繼續：

- PR body 未更新
- issue comment 不存在
- evidence URL 缺失
- HEAD hash 過期（與 `gh pr view <pr-number> --json headRefOid` 不一致）
- comment / body 內容不符
- write command exit code 成功但 artifact 實際未變更

Final report 中，驗證結果須明確寫出：

- 已 readback verified
- 無法 readback 的原因
- 或 readback mismatch 的處理結果

CI 通過後，若 PR checklist 有 CI item，應勾選。AI agent 不自行 merge PR。

## Automated review finding assessment

Automated review finding assessment 適用於 CodeRabbit、Codex auto review、other automated review tools 與 GitHub review bot comments。

原則：

- Auto review 是訊號，不是命令。
- 不可一股腦照修 automated review findings。
- 只有分類為 `adopted` 且在本 PR scope 內的 finding 才修。
- 不採納也要留下佐證，讓 reviewer 能追查採納與不採納的理由。
- Summary、walkthrough、no actionable finding 可列為 `noise / not applicable`。
- Finding 需要 human 判斷、scope decision 或風險不確定時，必須 stop-and-report。
- CodeRabbit / Codex auto review 是 auxiliary signals，不是 approval；human merge decision 仍是唯一 merge 授權來源。

分類定義：

- `adopted`：finding 確實是 bug、risk 或 repo convention violation，且在本 PR scope 內。修正後必須留下 implementation evidence、validation evidence、commit hash 或 relevant commit。
- `not adopted`：finding 不適用、會造成反效果，或與 repo design principle / workflow rule 衝突。必須留言說明技術理由，不得用沉默取代決策。
- `optional polish`：finding 合理但非 blocking，不應阻擋 merge，可留待 follow-up 或 future cleanup。必須說明為何本 PR 不處理。
- `noise / not applicable`：finding 是誤判、summary-only、walkthrough-only、已過期、已不成立，或不屬於本 PR scope。必須說明不適用理由。
- `needs human review`：finding 不確定、需要 human decision、需要 scope expansion 或需要風險判斷。必須 stop-and-report，不 merge。

Conversation resolve 規則：

- 只有在留下 written rationale 後才可 resolve conversation。
- `adopted` finding 應回覆修正內容與 validation。
- `not adopted` finding 應回覆技術理由。
- `optional polish` finding 應回覆為何不在本 PR 處理，以及是否需要 follow-up。
- `noise / not applicable` finding 應回覆或記錄為何不適用。
- 不要無說明 resolve conversation。
- 如果 finding 沒有獨立 thread，或只是 summary / walkthrough / no actionable finding，可在 closeout log 記錄為 `noise / not applicable`，不必硬 resolve。

Example:

- PR #156 的 CodeRabbit finding 指出 `docs/source-trust.md` 可能缺 EOF trailing newline。
- Codex 先 readback 檢查最後 byte 為 `0x0a`。
- Finding 已不成立。
- Classification: `noise / not applicable`。
- Codex 留下 comment 佐證。
- 不修改檔案，不產生 commit noise。

本節不是 auto-fix 流程，也不暗示 bot findings 必須全部修正。

## Merge-time review closeout

Merge-time review closeout 發生在 human 已決定可以 merge 之後、真正執行 merge 之前。這不是把 bot review 當 approval，而是確認所有 review 訊號都已被處理、記錄且可追查。

Merge 前必須檢查：

- GitHub review threads / review conversations。
- CodeRabbit findings。
- Codex auto review findings。
- Human review verdict。
- CI / required checks。
- PR body 的 issue evidence URL（readback verified）。
- Source issue implementation evidence comment。
- Latest commit hash。
- Source issue implementation evidence comment readback verified（URL 存在且內容可讀）。
- Review rationale / closeout comment（若有作為 evidence）readback verified 或 final report 註明無法 readback 的原因。
- PR head hash 已比對 `gh pr view <pr-number> --json headRefOid`。

每個 actionable finding 必須分類：

- `adopted`：採納並完成修正；列出對應 implementation、commit hash 或 relevant commit，以及 validation。
- `not adopted`：不採納；留下技術理由，說明為何目前不改。
- `optional polish`：合理但非 blocking；說明為何本 PR 不處理，以及是否需要 follow-up。
- `noise / not applicable`：summary、walkthrough、no actionable finding、誤報或與本 PR scope 無關；說明為何不適用。
- `needs human review`：需要 human decision、scope decision 或風險判斷；stop-and-report，不 merge。

Conversation resolve 規則：

- Resolve conversation 前必須先留下 written rationale。
- 採納的 finding 應回覆修正內容與 validation。
- 不採納的 finding 應回覆技術理由。
- Optional polish finding 應回覆為何不在本 PR 處理，以及是否需要 follow-up。
- Noise / not applicable finding 應說明為何不適用。
- Summary / walkthrough / no actionable finding 可以在 closeout log 中記錄為 `noise / not applicable`，不必硬回覆每一則摘要。
- 不得無說明 resolve review conversation。

Merge authorization 規則：

- CodeRabbit / Codex auto review 是 auxiliary signals，不是 approval。
- AI agent 不得把 bot review、summary 或 green checks 當作 merge approval。
- Merge 需要 explicit human authorization。
- 若存在 valid blocking finding、unresolved actionable finding 或 `needs human review` finding，必須 stop-and-report，不得 merge。

Merge 後 closeout：

- Linked issue 加上 `status:implemented`。
- 移除 active status labels，例如 `status:in-review`、`status:ready` 或 `status:blocked`，避免 status conflict。
- 適用時 close as completed。
- 保留 issue evidence comment、PR body evidence URL、commit hash 與 merge metadata，讓 closeout 可追查。
- 不在 per-PR closeout 刪 branch / worktree；cleanup 之後集中 audit，並需 human confirmation。

PR #153 / issue #127 是此流程的成功試跑範例：先分類並處理 CodeRabbit / Codex auto review / GitHub review findings，確認 CI、PR body、issue evidence 與 commit hash，再依 human authorization merge，merge 後完成 linked issue metadata closeout。此例是參考案例，不代表本流程只適用 #153。

## Validation matrix

不同 change type 的 required validation、recommended validation、quality gates 與 stop-and-report conditions 見 `docs/validation.md`。

Implementation prompt、PR body 與 issue evidence 應依該 matrix 回報實際執行的命令、結果、skipped reason 與 scope guard。

## Labels workflow

Issue 應至少有合理 area / type / status labels，依 repo taxonomy。Label taxonomy proposal 見 [label-taxonomy.md](label-taxonomy.md)；現行 title / PR convention 與既有 label 使用原則見 [conventions.md](conventions.md)。

Rules:

- 不要隨意建立新 labels。
- 若缺 label taxonomy，先開 label taxonomy issue。
- PR 應有合理 area / type labels；若 linked issue 有可沿用的 area / type labels，原則上沿用。
- PR review 階段可使用 `status:in-review`。
- Completed issue 可使用 `status:implemented`。
- Closed as `NOT_PLANNED` 不應硬加 `status:implemented`。
- 避免 status labels 衝突，例如 `status:ready` 與 `status:implemented` 同時存在。
- Labels 不取代 issue body，也不授權擴 scope。

## Roadmap milestones and layer labels

Roadmap milestone 表示主要 roadmap phase。Primary layer label 表示主要系統層。每個 issue / PR 原則上只使用一個 roadmap milestone 與一個 primary layer label；跨層工作應選主要責任層，並在 PR body 說明判斷。

Fixed roadmap milestones:

- `Layer 1 — Core Compiler`
- `Layer 2 — Workflow Guardrails`
- `Layer 3 — Protocolization`
- `Layer 4 — Companion UX`

Fixed layer labels:

- `layer1 : Core Compiler`
- `layer2 : Workflow Guardrails`
- `layer3 : Protocolization`
- `layer4 : Companion UX`

Layer definitions:

- `Layer 1 — Core Compiler` / `layer1 : Core Compiler`: 核心 deterministic issue-to-context compiler。包含 issue parsing、domain classifier、references / discovery core behavior、guardrails、safeReadFile、template rendering、task package output、CLI plan output、output correctness、core tests supporting compiler correctness。
- `Layer 2 — Workflow Guardrails` / `layer2 : Workflow Guardrails`: 讓 core compiler 能安全、高速、可併發使用的 workflow / validation / evidence / worktree guardrails。包含 AGENTS.md / CLAUDE.md、isolated worktree workflow、validation matrix / quality gates、dirty target repo warning、dogfood、PR evidence workflow、issue label audit、worktree preflight checks、PR / evidence consistency checker、workflow metadata cleanup、CI / automation if primary goal is workflow guardrail。
- `Layer 3 — Protocolization` / `layer3 : Protocolization`: 把 taxonomy / workflow 規則升級為穩定 catalog / protocol / machine-checkable contract。包含 catalog / protocol design、domain catalog、reference source catalog、guardrail catalog、task package section catalog、schema / compatibility rules、machine-checkable contract design、stable type naming、public vs internal contract boundaries。
- `Layer 4 — Companion UX` / `layer4 : Companion UX`: Companion mascot / status layer / workflow observability UX。包含 companion mascot design、workflow status event schema、daemon / status runtime exploration、local status watcher、Tauri / browser overlay / local widget exploration、low-resource companion runtime、visual / mascot status layer planning。

Rules:

- Issue 建立時，若 high-confidence classification 可行，應套用合理 roadmap milestone 與一個 primary layer label。
- PR 原則上沿用 linked issue 的 roadmap milestone 與 primary layer label。
- 若 linked issue 缺 milestone、primary layer label 或合理 area / type labels，PR 作者應在 final report 標記 follow-up；若 scope 明確允許 metadata 修正，才可補上。
- 若 PR 對應多個 issues，選擇主要 milestone / layer，並在 PR body 說明。
- 若 PR 沒有 linked issue，依實際 scope 高信心套用；無法判斷則列入 human review。
- 不要同時套多個 layer labels，除非 human 明確要求。
- Layer label 不是 area label 的替代品；area / type / status labels 仍應維持。
- Milestone 不是 status label 的替代品；workflow state 仍由 status labels 與 PR state 表示。
- 不要建立或提倡 `L1.5`、`Layer 1.5`、`layer1.5`、`layer:1`、`layer:1-core`、`layer:core` 或其他語意模糊 layer labels。
- Closed as `NOT_PLANNED` 的 issue 仍可有 milestone / layer label 方便查詢，但不應硬套 `status:implemented`。

## Evidence workflow

Implementation evidence comment 應寫回 source issue，讓 issue 讀者不用只靠 PR diff 才能知道實作結果。

Implementation evidence comment 預設使用繁體中文。技術名詞、commands、file paths、raw errors、raw command output、commit hash 與 PR URL 可保留英文。

Evidence comment 應包含：

- Summary
- Files changed
- Tests / validation
- Commit hash
- PR URL
- Scope boundaries
- Non-goals confirmation

若 evidence comment URL 需要回填 PR body，先建立 PR，再貼 issue comment，取得永久 comment URL 後更新 PR body，最後反查 PR body。

## Compact evidence templates

以下為 compact 版本，保留 evidence-check 所需欄位，但減少重複填寫。實際流程與權限邊界仍以本文件、`docs/validation.md` 與人類 merge 決策為準。

### Implementation evidence comment template

```text
## Implementation evidence

- Source issue URL:
- PR URL:
- Branch:
- HEAD / commit hash:
- Files changed:
  - `path/to/file.md`
- Scope:
  - in-scope: ...
  - out-of-scope: ...
- Non-goals:
  - 不放寬 evidence-check 要求
  - 不代替 human merge decision
  - 不修改 runtime / tests / CI / package script
- Validation:
  - git diff --check
  - pnpm build
  - pnpm test
  - pnpm test:gh: not run / not required
- Readback:
  - PR body readback: VERIFIED
  - Issue evidence readback: VERIFIED
- Protected issue state:
  - #120:
  - #149:
- Target repo safety:
  - target repo mutation: no
  - hidden mutation: no
- Evidence-check boundary:
  - PASS ≠ merge approval
  - human merge approval required
```

### PR body template

```text
## Summary
- compact description
- Closes #<issue-number>

## Scope
- related issue / PR URL:
- files changed:
  - `docs/workflow.md`
  - `docs/cheatsheet.md`
- branch:
- non-goals:
  - 不放寬 evidence-check required section
  - 不移除 readback verification
  - 不移除 human merge authority
  - 不新增 automation

## Non-goals
- 不修改 runtime
- 不修改 tests
- 不修改 CI
- 不 close #120
- 不處理 #149 remediation loop
- 不修改 target repo

## Validation
- git diff --check
- pnpm build
- pnpm test
- pnpm test:gh: not run / not required

## Implementation Evidence
- PR URL:
- Branch:
- Commit hash / HEAD:
- Files changed:
  - `...`
- issue evidence URL:
- PR body readback URL:
- issue evidence readback URL:
- #120 state:
- #149 state:
- target repo mutation confirmation: no

## Review finding assessment
- No automated findings yet.
- If findings exist, add compact matrix below:
  - source: CodeRabbit / Codex / human
  - location: path#Lx (if any)
  - classification: adopted / not adopted / optional polish / noise / not applicable / needs human review
  - action:
    - adopted: fix with evidence
    - not adopted / noise / not applicable / optional polish: leave rationale
    - needs human review: stop-and-report
```

### Review finding assessment template

```text
## Finding assessment

- source:
- location:
- classification: adopted / not adopted / optional polish / noise / not applicable / needs human review
- action:
- rationale:
- validation / evidence:
- blocking?: yes / no
```

### Merge closeout summary template

```text
## Merge closeout summary

- Merge method: squash / merge / rebase
- Merge commit / squash commit:
- Final HEAD:
- PR URL:
- issue URL:
- Files changed:
  - `...`
- Validation / checks:
  - gh pr checks:
  - pnpm build:
  - pnpm test:
- Review closeout:
  - actionable finding count:
  - adopted findings and follow-up status:
  - unresolved human-required finding: none
- Issue state:
  - #120:
  - #149:
- issue evidence URL:
- PR body readback URL:
- closeout comment URL:
- Human merge decision:
  - approved by human: yes / no
  - auto-merge / auto-close: no
- Cleanup:
  - branch/worktree cleanup performed here: no
```

### Human decision boundary

- PR body / issue evidence 寫入後仍需 readback verify。
- `spec evidence-check` PASS 僅代表欄位完整；最終 merge 權限仍屬 human。

## Concurrency rules

可併發：

- 不同 worktree。
- 檔案範圍不重疊。
- Metadata-only 任務與 code 任務，但 metadata 任務不應依賴切換 dirty repo。
- Docs planning 與 code implementation，若不碰同檔案。

不可併發：

- 同一 worktree 中多個 code 任務。
- 兩張 PR 都會碰同一批 files，例如 `tests/cli.integration.test.ts`、`src/cli/plan.ts`、`templates`。
- 後一張依賴前一張 merge 的任務。
- Dogfood 依賴安全護欄尚未 merge 時。

若不確定是否會碰同一批 files，先停下回報並等 human 決定。

## Cleanup workflow

不要每張 PR merge 後立刻刪 branch。

每個較大工作階段結束後做 branch / worktree cleanup audit：

1. 列出 local branches、remote branches 與 worktrees。
2. 確認哪些 branch 已 merged。
3. 確認哪些 worktree clean 且不再需要。
4. 向 human 回報 cleanup candidates。
5. 取得 human confirmation 後才刪。

`git worktree remove` 與 `git branch -D` 應只針對已 merge 且確認 safe 的 branch。Remote branch deletion 也應先 audit。不要自動刪不明狀態 branch。

## Safety rules

- 不自動 `stash` / `clean` / `reset`。
- 不自動修改 target repo code，除非 issue 明確要求。
- 不把 suggestion 當 approval。
- 不在 dirty worktree 上開工。
- 不把 GitHub workflow 操作誤認為測試打真 GitHub API。
- Tests / implementation 不應依賴真實 GitHub API 或 network。
- Package install / normal `gh` workflow 操作是 workflow I/O，不是 feature tests 打真 API。
- 不直接 push 到 `main`。
- 不 force push，除非明確要求。
- 不 merge PR。

## Scope guard

Workflow 中每一步都應維持 issue scope：

- 不處理相鄰 issue。
- 不修改 runtime code，除非 issue 明確要求。
- 不修改 classifier behavior，除非 issue 明確要求。
- 不修改 task package output，除非 issue 明確要求。
- 不修改 config schema，除非 issue 明確要求。
- 不新增 CLI command，除非 issue 明確要求。
- 不新增 CLI flag，除非 issue 明確要求。
- 不新增 dependency，除非 issue 明確要求。
- 不新增 LLM / API / local model integration。
- 不自行 merge PR。

若發現需要修改 forbidden files 或擴 scope，停下回報。

## Relationship to `spec-injector`

`spec-injector` 只負責 deterministic context compiler 的部分。Branch、commit、PR、evidence comment、PR body backfill、review、merge 與 cleanup 是 surrounding workflow，不是 CLI core 自動執行的 runtime behavior。

CLI core 不應被 daemon、companion runtime、custom runtime 或 hidden LLM wrapper 污染。Future-facing runtime ideas 應先以 design issue 討論，不應順手塞進 implementation PR。

## Non-goals

本 workflow doc 不實作：

- new CLI command
- new CLI flag
- GitHub bot
- PR automation daemon
- companion runtime
- hidden model integration
- target repo auto-editing
- status JSON runtime
- CI workflow
