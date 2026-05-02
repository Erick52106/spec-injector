export const DEFAULT_TEMPLATE = `# Task Package: {{issue_title}}

**Issue:** [#{{issue_number}}]({{issue_url}})
**Generated:** {{generated_at}}
**Repo:** \`{{repo_path}}\`

---

## 1. Issue

**Labels:** {{issue_labels}}

{{issue_body}}

---

## 2. Classification

{{detected_domains}}

---

## 3. Always-Read Files

{{always_docs}}

---

## 4. Auto-Discovered Documentation

{{discovered_docs}}

---

## 5. Auto-Discovered Source Files

{{discovered_sources}}

---

## 6. Matched Guardrails

{{matched_guardrails}}

### Rule-Matched Documentation

{{rule_docs}}

---

## 7. Missing Files

{{missing_docs}}

---

## 8. Implementation Constraints

{{matched_hints}}

---

## 9. Suggested Verification Checklist

> Auto-extracted from issue body (edit as needed)

{{issue_checklist}}
`;
