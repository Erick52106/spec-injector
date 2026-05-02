import type { Issue } from '../github/types.js';

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  frontend: ['ui', 'component', 'render', 'css', 'style', 'react', 'vue', 'angular', 'svelte', 'button', 'form', 'page', 'layout', 'responsive', 'animation', 'dom', 'html', 'tailwind', 'visual', 'design'],
  backend: ['server', 'service', 'handler', 'controller', 'middleware', 'worker', 'daemon', 'queue', 'job', 'cron', 'scheduler', 'grpc', 'rpc'],
  api: ['api', 'endpoint', 'rest', 'graphql', 'http', 'route', 'swagger', 'openapi', 'webhook', 'request', 'response'],
  auth: ['auth', 'login', 'logout', 'token', 'jwt', 'oauth', 'session', 'password', 'credential', 'permission', 'role', 'access', 'signup', 'register'],
  database: ['database', 'db', 'sql', 'query', 'migration', 'schema', 'table', 'model', 'orm', 'postgres', 'mysql', 'mongo', 'redis', 'index', 'transaction'],
  infra: ['infra', 'deploy', 'docker', 'kubernetes', 'k8s', 'terraform', 'helm', 'nginx', 'network', 'devops', 'provision', 'cloud', 'vm', 'container'],
  'cloud-storage': ['s3', 'gcs', 'storage', 'bucket', 'upload', 'download', 'blob', 'cdn', 'file upload', 'asset', 'object storage'],
  blockchain: ['blockchain', 'chain', 'block', 'hash', 'ledger', 'consensus', 'miner', 'ethereum', 'solana', 'web3', 'nft', 'defi'],
  'smart-contract': ['smart contract', 'contract', 'solidity', 'abi', 'evm', 'vyper', 'bytecode', 'deploy contract'],
  wallet: ['wallet', 'connect wallet', 'wallet address', 'private key', 'public key', 'address', 'signature', 'signing', 'transaction hash', 'tx hash', 'token transfer', 'on-chain', 'send', 'receive', 'balance', 'seed phrase', 'mnemonic'],
  i18n: ['i18n', 'l10n', 'locale', 'translation', 'lang', 'language', 'localize', 'multilang'],
  testing: ['test', 'spec', 'unit', 'integration', 'e2e', 'mock', 'stub', 'coverage', 'jest', 'vitest', 'playwright', 'cypress', 'assert', 'fixture'],
  docs: ['docs', 'documentation', 'readme', 'guide', 'changelog', 'wiki', 'jsdoc', 'typedoc'],
  ci: ['ci', 'cd', 'pipeline', 'workflow', 'github action', 'jenkins', 'travis', 'circleci', 'build step', 'artifact', 'badge'],
  tooling: ['lint', 'eslint', 'prettier', 'config', 'setup', 'cli', 'script', 'generator', 'plugin', 'npm', 'yarn', 'pnpm', 'bun'],
};

const MAX_DOMAINS = 5;

export function classifyDomains(issue: Issue): string[] {
  const title = issue.title.toLowerCase();
  const body = issue.body.toLowerCase();
  const labels = issue.labels.join(' ').toLowerCase();

  const scores: Record<string, number> = {};

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (title.includes(kw)) score += 3;
      if (labels.includes(kw)) score += 2;
      if (body.includes(kw)) score += 1;
    }
    if (score > 0) scores[domain] = score;
  }

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_DOMAINS)
    .map(([domain]) => domain);
}
