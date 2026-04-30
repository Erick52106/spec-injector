export interface Rule {
  id: string;
  match: {
    labels?: string[];
    title?: string[];
    body?: string[];
  };
  docs?: string[];
  template?: string;
}

export interface RulesFile {
  version: string;
  rules: Rule[];
}

export interface Config {
  rulesFile: RulesFile;
  repoPath: string;
  specAgentDir: string;
}
