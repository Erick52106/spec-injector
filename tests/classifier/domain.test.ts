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
