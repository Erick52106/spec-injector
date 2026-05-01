export interface Rule {
  id: string;
  description: string;
  match: {
    title_contains?: string[];
    label_contains?: string[];
    body_contains?: string[];
  };
  docs: string[];
  hints: string[];
}

export interface RulesFile {
  version: 1;
  always_read?: string[];   // included in every task package regardless of rule match
  rules: Rule[];
  defaults?: {
    docs?: string[];
    hints?: string[];
  };
}

export interface Config {
  repoPath: string;           // absolute path to the target repo root
  specAgentDir: string;       // absolute path to .spec-injector/
  rulesFile: RulesFile;
}
