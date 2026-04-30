export const DEFAULT_TEMPLATE = `# Task Package: {{issue_title}}

**Issue:** [#{{issue_number}}]({{issue_url}})
**Generated:** {{generated_at}}
**Matched rules:** {{matched_rule_ids}}
**Repo:** \`{{repo_path}}\`

---

## Issue Description

{{issue_body}}

---

## Labels

{{issue_labels}}

---

## Implementation Scope

Based on matched rules: **{{matched_rule_descriptions}}**

{{matched_hints}}

---

## Relevant Documentation

{{doc_sections}}

---

## Acceptance Checklist

> Auto-extracted from issue body (edit as needed)

{{issue_checklist}}
`;
