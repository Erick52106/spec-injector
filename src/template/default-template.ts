export const DEFAULT_TEMPLATE: string = `# Task Package — Issue #{{issue.number}}: {{issue.title}}

Generated: {{generatedAt}}
Issue URL: {{issue.url}}

## Issue Body

{{issue.body}}

## Matched Rules

{{matches}}

## Relevant Docs

{{docs}}
`;
