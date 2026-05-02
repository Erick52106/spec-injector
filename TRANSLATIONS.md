# Translation Maintenance

`README.md` remains the GitHub default entrypoint. Keep `README.md` and translated README files synchronized when README content changes.

Language switchers in all README files should keep the same wording and order:

```markdown
Language: 繁體中文 | English
```

Use static Markdown links for the language switcher. Do not add interactive UI.

When updating README content:

- Update the other language version in the same PR, or explain in the PR body why it was not synchronized.
- Do not add product claims to a translation that are not present in the source README.
- Keep command examples consistent across language versions, including command names, flags, arguments, and output paths.
- Keep language switcher wording and order consistent across all README files.
