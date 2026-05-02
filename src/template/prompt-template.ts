export const PROMPT_TEMPLATE = `# Implementation Plan Prompt: {{issue_title}}

## 1. Issue Summary

- Issue: #{{issue_number}}
- Title: {{issue_title}}
- URL: {{issue_url}}
- Labels: {{issue_labels}}

## 2. Detected Domains

{{detected_domains}}

## 3. Guardrails

{{matched_guardrails}}

## 4. Relevant File References

### Always-Read Files

{{prompt_always_files}}

### Issue-Mentioned Docs

{{prompt_issue_docs}}

### Issue-Mentioned Source Files

{{prompt_issue_sources}}

### Auto-Discovered Docs

{{prompt_discovered_docs}}

### Rule-Matched Docs

{{prompt_rule_docs}}

### Auto-Discovered Source Files

{{prompt_discovered_sources}}

## 5. Missing Files

{{missing_docs}}

## 6. Instructions

{{prompt_implementation_constraints}}

Suggested verification checklist:

{{issue_checklist}}

Read the referenced files as needed, then propose an implementation plan for this issue. List the files you intend to modify, wait for human approval before editing, and do not modify out-of-scope files.
`;
