export interface TemplateVars {
  issue_title: string;
  issue_number: string;
  issue_url: string;
  issue_body: string;
  issue_labels: string;
  issue_checklist: string;
  matched_rule_ids: string;
  matched_rule_descriptions: string;
  matched_hints: string;
  always_docs: string;       // docs from always_read that were found
  discovered_docs: string;   // auto-discovered docs (keyword-scored)
  rule_docs: string;         // docs from matched rules
  missing_docs: string;      // files listed in always_read or rules that were not found
  repo_path: string;
  generated_at: string;
}
