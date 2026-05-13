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
  frontend: ['frontend', 'ui', 'component', 'client component', 'server action', 'add-to-cart', 'form action', 'pdp', 'render', 'css', 'style', 'react', 'vue', 'angular', 'svelte', 'button', 'form', 'page', 'layout', 'responsive', 'animation', 'dom', 'html', 'tailwind', 'visual', 'design', '前端', '使用者介面', '畫面', '元件', '表單', '樣式', '版面', '響應式'],
  backend: ['server', 'service', 'handler', 'controller', 'middleware', 'worker', 'daemon', 'queue', 'job', 'cron', 'scheduler', 'grpc', 'rpc', '後端', '伺服器', '後端服務', '處理器', '控制器', '中介層', '排程'],
  api: ['api', 'endpoint', 'rest', 'graphql', 'http', 'route', 'swagger', 'openapi', 'webhook', 'request', 'response', '端點', '路由', '請求', '回應', '介接'],
  auth: ['auth', 'authentication', 'authorization', 'authorize', 'authorized', 'login', 'logout', 'token', 'jwt', 'oauth', 'session', 'password', 'credential', 'permission', 'role', 'access', 'signup', 'register', '登入', '登出', '授權', '權限', '角色', '憑證', '密碼', '權杖', '存取控制'],
  database: ['database', 'db', 'sql', 'query', 'queries', 'migration', 'schema', 'table', 'column', 'model', 'data model', 'orm', 'repository layer', 'persistence', 'persisted', 'record storage', 'postgres', 'postgresql', 'mysql', 'sqlite', 'mongo', 'redis', 'index', 'prisma', 'drizzle', 'gorm', '資料庫', '資料表', '欄位', '查詢', '遷移', '結構描述', '索引', '持久化'],
  infra: ['infra', 'deploy', 'docker', 'kubernetes', 'k8s', 'terraform', 'helm', 'nginx', 'network', 'devops', 'provision', 'cloud', 'vm', 'container'],
  'cloud-storage': ['s3', 'gcs', 'storage', 'bucket', 'upload', 'download', 'blob', 'cdn', 'file upload', 'asset', 'object storage'],
  blockchain: ['blockchain', 'on-chain', 'transaction hash', 'tx hash', 'block height', 'contract address', 'token transfer', 'gas', 'nonce', 'ethereum', 'evm', 'solana', 'polygon', 'web3', 'nft', 'defi', 'ledger', 'consensus', 'miner'],
  'smart-contract': ['smart contract', 'contract address', 'solidity', 'abi', 'evm', 'vyper', 'bytecode', 'deploy contract'],
  wallet: ['wallet', 'connect wallet', 'wallet address', 'private key', 'public key', 'address', 'signature', 'signing', 'transaction hash', 'tx hash', 'token transfer', 'on-chain', 'send', 'receive', 'balance', 'seed phrase', 'mnemonic'],
  i18n: ['i18n', 'l10n', 'locale', 'translation', 'lang', 'language', 'localize', 'multilang', '多語系', '翻譯', '在地化', '語系', '語言切換'],
  testing: ['.spec.ts', '.spec.tsx', '.spec.js', '.spec.jsx', '.spec.mts', '.spec.mjs', '.spec.cts', '.spec.cjs', '.test.ts', '.test.tsx', '.test.js', '.test.jsx', '.test.mts', '.test.mjs', '.test.cts', '.test.cjs', 'test', 'unit', 'integration', 'e2e', 'mock', 'stub', 'coverage', 'jest', 'vitest', 'playwright', 'cypress', 'assert', 'fixture'],
  docs: ['docs', 'documentation', 'readme', 'guide', 'changelog', 'wiki', 'jsdoc', 'typedoc', '文件', '說明文件', '操作指南', '變更紀錄'],
  ci: ['ci', 'cd', 'pipeline', 'workflow', 'github action', 'jenkins', 'travis', 'circleci', 'build step', 'artifact', 'badge', '持續整合', '部署流程', '建置步驟', '建置失敗'],
  tooling: ['lint', 'eslint', 'prettier', 'config', 'setup', 'cli', 'script', 'generator', 'plugin', 'package manager', 'npm', 'yarn', 'pnpm', 'bun'],
};

const MAX_DOMAINS = 5;
const WEAK_TOOLING_SIGNALS = ['npm', 'yarn', 'pnpm', 'bun'];
const PACKAGE_MANAGER_PATTERN = '(?:npm|yarn|pnpm|bun)';
const STRONG_PACKAGE_MANAGER_CONTEXT_PATTERNS = [
  new RegExp(`\\b(?:upgrade|update|bump|configure|configured|configuring|migrate|switch)\\s+${PACKAGE_MANAGER_PATTERN}\\b`, 'i'),
  new RegExp(`\\b${PACKAGE_MANAGER_PATTERN}\\s+(?:version|workspace|lockfile|config|configuration)\\b`, 'i'),
  /\bpackage[\s-]+manager\b/i,
  /\b(?:lockfile|workspace)\b/i,
];
const GENERIC_WALLET_SIGNALS = ['transactions', 'transaction'];
const GENERIC_WALLET_REASON = 'generic product transaction wording';
const GENERIC_API_CONTRACT_SIGNALS = ['contract'];
const GENERIC_API_CONTRACT_CONTEXT = ['api', 'endpoint', 'route', 'request', 'response', 'backend', 'frontend', 'dashboard', 'settings'];
const GENERIC_API_CONTRACT_REASON = 'generic API contract wording';
const GENERIC_DATABASE_TRANSACTION_SIGNALS = ['transactions', 'transaction'];
const GENERIC_DATABASE_TRANSACTION_CONTEXT = ['api', 'backend', 'billing', 'contract', 'dashboard', 'details', 'endpoint', 'frontend', 'history', 'list', 'page', 'product', 'record', 'records', 'request', 'response', 'route', 'settings', 'support', 'user'];
const GENERIC_DATABASE_TRANSACTION_REASON = 'generic transaction wording';

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
      if (matchesTerm(title, kw)) score += 3;
      if (matchesTerm(labels, kw)) score += 2;
      if (matchesTerm(body, kw)) score += 1;
    }
    if (score > 0) {
      scores[domain] = score;
      evidenceByDomain.set(domain, collectEvidence(domain, keywords, fields));
    }
  }

  suppressWeakToolingEvidence(scores, evidenceByDomain, fields);

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
      if (matchesTerm(value, term)) evidence.push({ domain, term, source });
    }
  }

  return evidence;
}

function buildRejectedDomainReasons(
  fields: Array<{ source: DomainEvidenceSource; value: string }>,
  detected: Set<string>
): RejectedDomainReason[] {
  const rejected: RejectedDomainReason[] = [];

  if (!detected.has('wallet')) {
    const reason = findRejectedSignal(fields, GENERIC_WALLET_SIGNALS, GENERIC_WALLET_REASON, 'wallet');
    if (reason) rejected.push(reason);
  }

  if (!detected.has('smart-contract') && hasGenericApiContractContext(fields)) {
    const reason = findRejectedSignal(fields, GENERIC_API_CONTRACT_SIGNALS, GENERIC_API_CONTRACT_REASON, 'smart-contract');
    if (reason) rejected.push(reason);
  }

  if (!detected.has('database') && hasGenericDatabaseTransactionContext(fields)) {
    const reason = findRejectedSignal(fields, GENERIC_DATABASE_TRANSACTION_SIGNALS, GENERIC_DATABASE_TRANSACTION_REASON, 'database');
    if (reason) rejected.push(reason);
  }

  return rejected;
}

function findRejectedSignal(
  fields: Array<{ source: DomainEvidenceSource; value: string }>,
  signals: string[],
  reason: string,
  domain: string
): RejectedDomainReason | undefined {
  for (const { source, value } of fields) {
    for (const signal of signals) {
      if (matchesTerm(value, signal)) {
        return {
          domain,
          signal,
          source,
          reason,
        };
      }
    }
  }

  return undefined;
}

function suppressWeakToolingEvidence(
  scores: Record<string, number>,
  evidenceByDomain: Map<string, DomainEvidence[]>,
  fields: Array<{ source: DomainEvidenceSource; value: string }>
): void {
  const evidence = evidenceByDomain.get('tooling') ?? [];
  if (evidence.length === 0) return;

  const hasOnlyWeakToolingSignals = evidence.every((entry) => WEAK_TOOLING_SIGNALS.includes(entry.term));
  if (!hasOnlyWeakToolingSignals) return;

  const hasTitleOrLabelSignal = evidence.some((entry) => entry.source === 'title' || entry.source === 'labels');
  if (hasTitleOrLabelSignal) return;

  if (hasStrongPackageManagerContext(fields)) return;

  delete scores.tooling;
  evidenceByDomain.delete('tooling');
}

function hasStrongPackageManagerContext(fields: Array<{ source: DomainEvidenceSource; value: string }>): boolean {
  const text = fields.map(({ value }) => value).join(' ');
  return STRONG_PACKAGE_MANAGER_CONTEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function matchesTerm(value: string, term: string): boolean {
  if (term.startsWith('.')) {
    return value.includes(term);
  }

  const escaped = term.trim().split(/\s+/).map(escapeRegExp).join('[\\s-]+');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasGenericApiContractContext(fields: Array<{ source: DomainEvidenceSource; value: string }>): boolean {
  const text = fields.map(({ value }) => value).join(' ');
  return GENERIC_API_CONTRACT_CONTEXT.some((term) => matchesTerm(text, term));
}

function hasGenericDatabaseTransactionContext(fields: Array<{ source: DomainEvidenceSource; value: string }>): boolean {
  const text = fields.map(({ value }) => value).join(' ');
  return GENERIC_DATABASE_TRANSACTION_CONTEXT.some((term) => matchesTerm(text, term));
}
