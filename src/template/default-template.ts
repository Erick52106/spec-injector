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

## Always-Read Documentation

{{always_docs}}

---

## Auto-Discovered Documentation

{{discovered_docs}}

---

## Auto-Discovered Source Files

{{discovered_sources}}

---

## Rule-Matched Documentation

{{rule_docs}}

---

## Missing Files

{{missing_docs}}

---

## Acceptance Checklist

> Auto-extracted from issue body (edit as needed)

{{issue_checklist}}
`;
