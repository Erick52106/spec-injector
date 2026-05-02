import type { Issue } from '../github/types.js';

export type DomainEvidenceSource = 'title' | 'labels' | 'body';

export interface DomainEvidence {
  domain: string;
  term: string;
  source: DomainEvidenceSource;
}

export interface RejectedDomainReason {
  domain: string;
  signal: string;
  source: DomainEvidenceSource;
  reason: string;
}

export interface DomainClassificationResult {
  domains: string[];
  evidence: DomainEvidence[];
  rejected: RejectedDomainReason[];
}

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
const GENERIC_WALLET_SIGNALS = ['transactions', 'transaction'];
const GENERIC_WALLET_REASON = 'generic product transaction wording';

export function classifyDomains(issue: Issue): string[] {
  return classifyDomainsWithEvidence(issue).domains;
}

export function classifyDomainsWithEvidence(issue: Issue): DomainClassificationResult {
  const title = issue.title.toLowerCase();
  const body = issue.body.toLowerCase();
  const labels = issue.labels.join(' ').toLowerCase();
  const fields: Array<{ source: DomainEvidenceSource; value: string }> = [
    { source: 'title', value: title },
    { source: 'labels', value: labels },
    { source: 'body', value: body },
  ];

  const scores: Record<string, number> = {};
  const evidenceByDomain = new Map<string, DomainEvidence[]>();

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (title.includes(kw)) score += 3;
      if (labels.includes(kw)) score += 2;
      if (body.includes(kw)) score += 1;
    }
    if (score > 0) {
      scores[domain] = score;
      evidenceByDomain.set(domain, collectEvidence(domain, keywords, fields));
    }
  }

  const domains = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_DOMAINS)
    .map(([domain]) => domain);

  const detected = new Set(domains);
  const evidence = domains.flatMap((domain) => evidenceByDomain.get(domain) ?? []);
  const rejected = buildRejectedDomainReasons(fields, detected);

  return { domains, evidence, rejected };
}

function collectEvidence(
  domain: string,
  keywords: string[],
  fields: Array<{ source: DomainEvidenceSource; value: string }>
): DomainEvidence[] {
  const evidence: DomainEvidence[] = [];

  for (const { source, value } of fields) {
    for (const term of keywords) {
      if (value.includes(term)) evidence.push({ domain, term, source });
    }
  }

  return evidence;
}

function buildRejectedDomainReasons(
  fields: Array<{ source: DomainEvidenceSource; value: string }>,
  detected: Set<string>
): RejectedDomainReason[] {
  if (detected.has('wallet')) return [];

  for (const { source, value } of fields) {
    for (const signal of GENERIC_WALLET_SIGNALS) {
      if (value.includes(signal)) {
        return [{
          domain: 'wallet',
          signal,
          source,
          reason: GENERIC_WALLET_REASON,
        }];
      }
    }
  }

  return [];
}
