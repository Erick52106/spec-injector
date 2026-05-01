# AI Collaboration Rules

## Language

- Default to Traditional Chinese (zh-TW)
- Keep English for technical terms when necessary
- Do not use Simplified Chinese

## Scope Control

- Strictly follow issue scope
- Do not modify unrelated modules
- Do not expand scope without confirmation
- If unclear, ask instead of assuming

## Issue / PR Rules

### Issue

- Title must clearly describe the problem or task
- Body should include:
  - problem description
  - root cause (if known)
  - proposed fix (if available)
  - verification steps

### PR

- One PR = one problem
- Must reference an issue
- Commit message must include: `refs #<issue-number>`
- Must explicitly state:
  - what is included
  - what is NOT included

## Output Format (for AI)

When responding:

1. Problem understanding
2. Proposed solution
3. Files to modify
4. Risks
5. Verification steps

When providing code:

- Only include necessary changes
- Avoid dumping full files
- Prefer diff-style or partial snippets
