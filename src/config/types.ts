export interface ProjectConfig {
  name?: string;
  type?: string;
}

export interface DiscoveryConfig {
  docs?: string[];
  source?: string[];
  exclude?: string[];
  max_docs?: number;
  max_source_files?: number;
}

export interface Guardrail {
  id: string;
  when_detected: string[];
  risk: string;
}

export interface SpecConfig {
  version: 2;
  project?: ProjectConfig;
  always_read?: string[];
  discovery?: DiscoveryConfig;
  guardrails?: Guardrail[];
}

export interface Config {
  repoPath: string;
  specAgentDir: string;
  specConfig: SpecConfig;
}
