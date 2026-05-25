import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDomainsWithEvidence } from '../../dist/classifier/domain.js';

function issue(overrides: {
  number?: number;
  title: string;
  body: string;
  labels?: string[];
}) {
  return {
    number: overrides.number ?? 71,
    title: overrides.title,
    body: overrides.body,
    labels: overrides.labels ?? [],
    url: `https://github.com/Erick52106/spec-injector/issues/${overrides.number ?? 71}`,
    state: 'open' as const,
  };
}

test('generic transaction wording stays out of wallet blockchain and database domains', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Transaction endpoint API contract',
    body: [
      'Align backend route handler behavior for product transaction details.',
      'Document request and response examples for the dashboard transaction API.',
      'Keep support workflow copy aligned without payment-network-specific wording.',
    ].join('\n'),
    labels: ['api', 'backend'],
  }));

  assert.ok(result.domains.includes('api'), `Expected api in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('backend'), `Expected backend in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('wallet'), `Expected wallet to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('blockchain'), `Expected blockchain to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('database'), `Expected database to be absent from ${result.domains.join(', ')}`);
  assert.ok(result.rejected.some((r) =>
    r.domain === 'wallet' &&
    r.signal === 'transaction' &&
    r.source === 'title' &&
    r.reason === 'generic product transaction wording'
  ));
  assert.ok(result.rejected.some((r) =>
    r.domain === 'database' &&
    r.signal === 'transaction' &&
    r.source === 'title' &&
    r.reason === 'generic transaction wording'
  ));
});

test('generic API contract wording stays out of blockchain and smart-contract domains', () => {
  const first = classifyDomainsWithEvidence(issue({
    title: 'Settings endpoint contract alignment',
    body: [
      'Review the backend route handler contract.',
      'Keep the API request and response contract stable for dashboard settings.',
    ].join('\n'),
    labels: ['api', 'backend'],
  }));
  const second = classifyDomainsWithEvidence(issue({
    title: 'Settings endpoint contract alignment',
    body: [
      'Review the backend route handler contract.',
      'Keep the API request and response contract stable for dashboard settings.',
    ].join('\n'),
    labels: ['api', 'backend'],
  }));

  assert.deepEqual(first, second);
  assert.ok(!first.domains.includes('blockchain'), `Expected blockchain to be absent from ${first.domains.join(', ')}`);
  assert.ok(!first.domains.includes('smart-contract'), `Expected smart-contract to be absent from ${first.domains.join(', ')}`);
  assert.deepEqual(first.rejected, [{
    domain: 'smart-contract',
    signal: 'contract',
    source: 'title',
    reason: 'generic API contract wording',
  }]);
});

test('generic spec and specification wording do not imply testing', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Product spec for OpenAPI specification planning',
    body: [
      'Write the product spec and API specification for deterministic compiler behavior.',
      'Keep the design spec focused on API docs and route behavior.',
      'This is documentation and API planning work only.',
    ].join('\n'),
    labels: ['api', 'docs'],
  }));

  assert.ok(result.domains.includes('api'), `Expected api in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('docs'), `Expected docs in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('testing'), `Expected testing to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.evidence.some((e) => e.domain === 'testing'), `Expected no testing evidence, got ${JSON.stringify(result.evidence)}`);
});

test('legitimate testing evidence still triggers testing domain', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Add regression test coverage for classifier helpers',
    body: [
      'Add unit test and integration test cases for deterministic classifier behavior.',
      'Use node --test with fixture data so the behavior stays offline.',
    ].join('\n'),
    labels: ['type:test'],
  }));

  assert.ok(result.domains.includes('testing'), `Expected testing in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'testing' && e.term === 'test' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'testing' && e.term === 'fixture' && e.source === 'body'
  ));
});

test('authentication wording still triggers auth after boundary matching', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Fix authentication callback flow',
    body: [
      'Users can fail after completing the authentication callback.',
      'Keep credential behavior stable.',
    ].join('\n'),
    labels: [],
  }));

  assert.ok(result.domains.includes('auth'), `Expected auth in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'auth' && e.term === 'authentication' && e.source === 'title'
  ));
});

test('authorization wording still triggers auth after boundary matching', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Fix authorization policy flow',
    body: [
      'Users can fail authorization after role changes.',
      'Keep access behavior stable.',
    ].join('\n'),
    labels: [],
  }));

  assert.ok(result.domains.includes('auth'), `Expected auth in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'auth' && e.term === 'authorization' && e.source === 'title'
  ));
});

test('explicit auth signals still trigger auth after boundary matching', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Fix login token session handling',
    body: [
      'Keep oauth credential and password behavior stable.',
      'Do not change unrelated frontend copy.',
    ].join('\n'),
    labels: ['auth'],
  }));

  assert.ok(result.domains.includes('auth'), `Expected auth in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'auth' && e.term === 'login' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'auth' && e.term === 'auth' && e.source === 'labels'
  ));
});

test('legitimate database evidence still triggers database domain', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Add migration SQL schema and table indexes',
    body: [
      'Create database migration coverage for persisted records.',
      'Update repository layer query behavior for PostgreSQL.',
    ].join('\n'),
    labels: ['backend'],
  }));

  assert.ok(result.domains.includes('database'), `Expected database in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'database' && e.term === 'migration' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'database' && e.term === 'postgresql' && e.source === 'body'
  ));
});

test('frontend form-action wording does not match database from FormData or form alone', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Fix add-to-cart server action silent fail on PDP',
    body: [
      'The frontend add-to-cart flow uses a server action with FormData from a product form.',
      'The client component renders useFormStatus and useActionState while the action silently fails.',
      'Keep the fix focused on UI feedback and form-action behavior.',
    ].join('\n'),
    labels: ['frontend'],
  }));

  assert.ok(result.domains.includes('frontend'), `Expected frontend in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('database'), `Expected database to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.evidence.some((e) => e.domain === 'database'), `Expected no database evidence, got ${JSON.stringify(result.evidence)}`);
});

test('hyphenated frontend form-action wording still matches frontend', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Fix server-action form-action add-to-cart flow',
    body: [
      'The client-component renders PDP UI feedback.',
      'Keep FormData handling deterministic.',
    ].join('\n'),
    labels: [],
  }));

  assert.ok(result.domains.includes('frontend'), `Expected frontend in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'frontend' && e.term === 'server action' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'frontend' && e.term === 'form action' && e.source === 'title'
  ));
});

test('FormData alone does not match orm or database by substring', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Handle FormData payload in server action',
    body: [
      'Parse FormData fields from a frontend form action.',
      'Keep the UI response deterministic.',
    ].join('\n'),
    labels: ['frontend'],
  }));

  assert.ok(result.domains.includes('frontend'), `Expected frontend in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('database'), `Expected database to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.evidence.some((e) => e.domain === 'database' && e.term === 'orm'), `Expected no orm evidence, got ${JSON.stringify(result.evidence)}`);
});

test('actual database issue still matches database after form-action suppression', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Add database migration for cart item table schema',
    body: [
      'Create SQL migration coverage for cart item records.',
      'Update ORM transaction handling for the checkout table.',
    ].join('\n'),
    labels: ['backend'],
  }));

  assert.ok(result.domains.includes('database'), `Expected database in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'database' && e.term === 'migration' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'database' && e.term === 'orm' && e.source === 'body'
  ));
});

test('pnpm validation and client wording do not alone make a tooling task', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Fix client add-to-cart form feedback',
    body: [
      'The client component should show an error when the server action returns a silent failure.',
      'Validation commands: pnpm build and pnpm test.',
      'Do not change package scripts or build tooling.',
    ].join('\n'),
    labels: ['frontend'],
  }));

  assert.ok(result.domains.includes('frontend'), `Expected frontend in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('tooling'), `Expected tooling to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.evidence.some((e) => e.domain === 'tooling'), `Expected no tooling evidence, got ${JSON.stringify(result.evidence)}`);
});

test('client wording alone does not match cli or tooling by substring', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Fix client component form feedback',
    body: [
      'The client component should render clear UI feedback.',
      'Keep the server action response visible to the page.',
    ].join('\n'),
    labels: ['frontend'],
  }));

  assert.ok(result.domains.includes('frontend'), `Expected frontend in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('tooling'), `Expected tooling to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.evidence.some((e) => e.domain === 'tooling' && e.term === 'cli'), `Expected no cli evidence, got ${JSON.stringify(result.evidence)}`);
});

test('run pnpm build validation wording alone does not match tooling', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Fix frontend form feedback',
    body: [
      'Run pnpm build and pnpm test as validation.',
      'Keep the change focused on UI behavior.',
    ].join('\n'),
    labels: ['frontend'],
  }));

  assert.ok(result.domains.includes('frontend'), `Expected frontend in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('tooling'), `Expected tooling to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.evidence.some((e) => e.domain === 'tooling'), `Expected no tooling evidence, got ${JSON.stringify(result.evidence)}`);
});

test('package manager maintenance still matches tooling when package manager is the task', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Upgrade pnpm package manager version',
    body: [
      'Update the package manager config for the repository.',
      'Keep lockfile behavior stable.',
    ].join('\n'),
    labels: [],
  }));

  assert.ok(result.domains.includes('tooling'), `Expected tooling in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'tooling' && e.term === 'pnpm' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'tooling' && e.term === 'package manager' && e.source === 'title'
  ));
});

test('body-only package manager maintenance still matches tooling', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Dependency maintenance',
    body: [
      'Upgrade pnpm to 10.35.',
      'Keep the lockfile stable after the package manager version bump.',
    ].join('\n'),
    labels: [],
  }));

  assert.ok(result.domains.includes('tooling'), `Expected tooling in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'tooling' && e.term === 'pnpm' && e.source === 'body'
  ));
});

test('body-only upgrade pnpm wording still matches tooling without exact version hard-coding', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Dependency maintenance',
    body: [
      'Upgrade pnpm to 10.35.',
      'Keep lockfile behavior stable after the version bump.',
    ].join('\n'),
    labels: [],
  }));

  assert.ok(result.domains.includes('tooling'), `Expected tooling in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'tooling' && e.term === 'pnpm' && e.source === 'body'
  ));
});

test('package manager version wording matches tooling without a concrete manager name', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Update package manager version',
    body: [
      'Keep workspace install behavior stable.',
      'Do not change runtime features.',
    ].join('\n'),
    labels: [],
  }));

  assert.ok(result.domains.includes('tooling'), `Expected tooling in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'tooling' && e.term === 'package manager' && e.source === 'title'
  ));
});

test('hyphenated package-manager wording matches tooling', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Update package-manager version',
    body: [
      'Keep workspace install behavior stable.',
      'Do not change runtime features.',
    ].join('\n'),
    labels: [],
  }));

  assert.ok(result.domains.includes('tooling'), `Expected tooling in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'tooling' && e.term === 'package manager' && e.source === 'title'
  ));
});

test('actual tooling issue still matches tooling', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Update build script lint config and test runner',
    body: [
      'Adjust the package manager config for CI workflow setup.',
      'Keep the pnpm script and eslint config aligned with the test runner.',
    ].join('\n'),
    labels: ['area:tooling'],
  }));

  assert.ok(result.domains.includes('tooling'), `Expected tooling in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'tooling' && e.term === 'script' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'tooling' && e.term === 'config' && e.source === 'body'
  ));
});

test('dogfood-shaped add-to-cart issue keeps frontend signal without database or tooling noise', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Storefront add-to-cart fails from product page server action',
    body: [
      'Implement the PDP add-to-cart form action for a storefront product page.',
      'The React client component passes FormData into a server action and uses useFormStatus / useActionState.',
      'The current UI can silently fail when cart state is not updated.',
      'Suggested validation: pnpm build and pnpm test.',
      'Do not mutate checkout, payment, package scripts, or target repo configuration.',
    ].join('\n'),
    labels: ['frontend'],
  }));

  assert.ok(result.domains.includes('frontend'), `Expected frontend in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('database'), `Expected database to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('tooling'), `Expected tooling to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.evidence.some((e) => e.domain === 'database'), `Expected no database evidence, got ${JSON.stringify(result.evidence)}`);
  assert.ok(!result.evidence.some((e) => e.domain === 'tooling'), `Expected no tooling evidence, got ${JSON.stringify(result.evidence)}`);
});

test('zh-TW auth database docs and ci keywords classify with deterministic evidence', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: '補齊登入權限與資料庫遷移文件',
    body: [
      '新增說明文件，記錄資料表欄位和查詢行為。',
      '修正 GitHub Actions 持續整合的建置步驟。',
      '登入、授權、角色和憑證行為都要保留。',
    ].join('\n'),
    labels: [],
  }));

  assert.ok(result.domains.includes('auth'), `Expected auth in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('database'), `Expected database in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('docs'), `Expected docs in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('ci'), `Expected ci in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'auth' && e.term === '登入' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'database' && e.term === '資料庫' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'docs' && e.term === '說明文件' && e.source === 'body'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'ci' && e.term === '持續整合' && e.source === 'body'
  ));
});

test('zh-TW frontend backend api and i18n keywords classify without semantic matching', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: '前端畫面串接後端端點與多語系翻譯',
    body: [
      '使用者介面元件需要呼叫後端服務的路由。',
      '請求與回應格式要穩定，語系切換和在地化文案也要保留。',
    ].join('\n'),
    labels: [],
  }));

  assert.ok(result.domains.includes('frontend'), `Expected frontend in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('backend'), `Expected backend in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('api'), `Expected api in ${result.domains.join(', ')}`);
  assert.ok(result.domains.includes('i18n'), `Expected i18n in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'frontend' && e.term === '前端' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'backend' && e.term === '後端' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'api' && e.term === '端點' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'i18n' && e.term === '多語系' && e.source === 'title'
  ));
});

test('zh-TW workflow metadata stays out of runtime domains without explicit signals', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: '整理 PR body 與 issue evidence comment',
    body: [
      '請使用繁體中文回覆，保留 commands、file paths 和 raw output。',
      '更新 closeout 紀錄並確認 reviewers 已讀回最新狀態。',
      '這是流程紀錄，不是功能修正。',
    ].join('\n'),
    labels: ['area:workflow'],
  }));

  assert.ok(!result.domains.includes('auth'), `Expected auth to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('database'), `Expected database to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('frontend'), `Expected frontend to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('backend'), `Expected backend to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('api'), `Expected api to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('i18n'), `Expected i18n to be absent from ${result.domains.join(', ')}`);
});

test('AWP workflow worker wording does not imply backend domain', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Clarify Autonomous Worker Profiles routing evidence',
    body: [
      'Document Hybrid AWP worker dispatch and controller-direct fallback evidence.',
      'Keep the workflow-governance wording focused on routing_mode and delegation_outcome.',
      'This is workflow evidence documentation, not runtime product code.',
    ].join('\n'),
    labels: ['area:workflow', 'type:docs'],
  }));

  assert.ok(result.domains.includes('docs'), `Expected docs in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('backend'), `Expected backend to be absent from ${result.domains.join(', ')}`);
  assert.ok(!result.evidence.some((e) => e.domain === 'backend'), `Expected no backend evidence, got ${JSON.stringify(result.evidence)}`);
  assert.ok(result.rejected.some((r) =>
    r.domain === 'backend' &&
    r.signal === 'worker' &&
    r.source === 'title' &&
    r.reason === 'AWP workflow worker wording'
  ));
});

test('runtime backend worker wording still triggers backend domain', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Add queue worker handler for scheduled jobs',
    body: [
      'Implement the backend worker runtime for cron-triggered queue processing.',
      'Keep the server handler deterministic and covered by offline tests.',
    ].join('\n'),
    labels: ['backend'],
  }));

  assert.ok(result.domains.includes('backend'), `Expected backend in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'backend' && e.term === 'worker' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'backend' && e.term === 'queue' && e.source === 'title'
  ));
  assert.ok(result.evidence.some((e) =>
    e.domain === 'backend' && e.term === 'cron' && e.source === 'body'
  ));
});

test('backend controller wording stays backend even with AWP closeout evidence', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: 'Fix checkout controller behavior',
    body: [
      'Update the checkout controller implementation.',
      'Keep routing_mode and controller-direct fallback evidence in the PR body after implementation.',
    ].join('\n'),
    labels: ['area:backend'],
  }));

  assert.ok(result.domains.includes('backend'), `Expected backend in ${result.domains.join(', ')}`);
  assert.ok(result.evidence.some((e) =>
    e.domain === 'backend' && e.term === 'controller' && e.source === 'title'
  ));
});

test('zh-TW generic model and file wording does not imply database', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: '整理 AI 模型回覆文件',
    body: [
      '調整本機檔案說明，只處理提示文字和工作紀錄。',
      '模型這個詞指的是 AI 回覆設定，不是產品資料設計。',
    ].join('\n'),
    labels: ['docs'],
  }));

  assert.ok(result.domains.includes('docs'), `Expected docs in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('database'), `Expected database to be absent from ${result.domains.join(', ')}`);
});

test('zh-TW generic service wording does not imply backend', () => {
  const result = classifyDomainsWithEvidence(issue({
    title: '更新客服服務品質與服務條款文件',
    body: [
      '這是產品文案和支援流程調整。',
      '沒有 runtime 程式碼或部署設定變更。',
    ].join('\n'),
    labels: ['docs'],
  }));

  assert.ok(result.domains.includes('docs'), `Expected docs in ${result.domains.join(', ')}`);
  assert.ok(!result.domains.includes('backend'), `Expected backend to be absent from ${result.domains.join(', ')}`);
});

test('classification evidence and rejected reasons keep deterministic shape and ordering', () => {
  const sampleIssue = issue({
    title: 'Dashboard endpoint route transaction review',
    body: [
      'Update backend handler behavior for product transaction records.',
      'Keep frontend dashboard response rendering stable.',
    ].join('\n'),
    labels: ['api', 'backend'],
  });

  const first = classifyDomainsWithEvidence(sampleIssue);
  const second = classifyDomainsWithEvidence(sampleIssue);

  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first).sort(), ['domains', 'evidence', 'rejected']);
  assert.ok(!Object.prototype.hasOwnProperty.call(first, 'score'));
  assert.ok(!Object.prototype.hasOwnProperty.call(first, 'scores'));
  assert.ok(first.evidence.some((e) =>
    e.domain === 'api' && e.term === 'endpoint' && e.source === 'title'
  ));
  assert.deepEqual(first.rejected, [
    {
      domain: 'wallet',
      signal: 'transaction',
      source: 'title',
      reason: 'generic product transaction wording',
    },
    {
      domain: 'database',
      signal: 'transaction',
      source: 'title',
      reason: 'generic transaction wording',
    },
  ]);
});
