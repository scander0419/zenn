## Summary

- add or update Zenn content
- if needed, request Codex review with `@codex review`

## Review Checklist

- [ ] front matter is correct
- [ ] `npm run check` passed
- [ ] local preview was checked when layout changed
- [ ] no confidential or unverified content is included
- [ ] merging this PR into `main` is safe for Zenn sync

## Mobile Review Notes

- Use PR comments for structural or wording changes
- Use `@codex review` for an AI review pass
- Use `@codex` with a concrete instruction to update the PR branch

Example:

```text
@codex
- タイトルをもっと具体化
- 結論を先に出す
- ハマりどころを短く整理
- published は false のまま
```
