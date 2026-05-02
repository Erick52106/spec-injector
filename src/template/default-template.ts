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

## 4. Issue-Mentioned Documentation

{{issue_docs}}

---

## 5. Issue-Mentioned Source Files

{{issue_sources}}

---

## 6. Auto-Discovered Documentation

{{discovered_docs}}

---

## 7. Auto-Discovered Source Files

{{discovered_sources}}

---

## 8. Matched Guardrails

{{matched_guardrails}}

### Rule-Matched Documentation

{{rule_docs}}

---

## 9. Missing Files

{{missing_docs}}

---

## 10. Suggested Verification Checklist

> Auto-extracted from issue body (edit as needed)

{{issue_checklist}}
`;
