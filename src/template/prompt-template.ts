export const PROMPT_TEMPLATE = `# Implementation Plan Prompt: {{issue_title}}

## 1. Source Issue

- Issue: #{{issue_number}}
- Title: {{issue_title}}
- URL: {{issue_url}}
- Labels: {{issue_labels}}

## 2. Detected Domains

{{detected_domains}}

## 3. Matched Guardrails

{{matched_guardrails}}

## 4. Relevant File References

### Always-Read Files

{{prompt_always_files}}

### Discovered Docs

{{prompt_discovered_docs}}

### Rule-Matched Docs

{{prompt_rule_docs}}

### Discovered Source Files

{{prompt_discovered_sources}}

## 5. Missing Files

{{missing_docs}}

## 6. Implementation Constraints

{{prompt_implementation_constraints}}

## 7. Suggested Verification Checklist

{{issue_checklist}}

## 8. Final Implementation Prompt

Read the referenced files as needed, then propose an implementation plan for this issue. List the files you intend to modify, wait for human approval before editing, and do not modify out-of-scope files.
`;
