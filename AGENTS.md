# AGENTS.md

## Review guidelines

- This repository is for Zenn articles managed through GitHub PRs and synced to Zenn after merge to `main`.
- Treat mistakes in article front matter as high priority.
- Treat incorrect `published` state as high priority. Default expectation is `published: false` unless the PR clearly intends public release.
- Prioritize factual correctness, broken commands, wrong file paths, wrong version numbers, unsafe claims, and misleading conclusions over style preferences.
- For article reviews, pay special attention to:
  - title specificity
  - conclusion-first structure
  - explicit prerequisites
  - concrete code, commands, outputs, dates, versions, and caveats
  - at least one section covering pitfalls, trade-offs, or lessons learned
- Treat confidential information leaks, unverified claims presented as fact, and accidental publication risk as P1.
- Treat obvious typos, broken Japanese, or malformed Markdown in article content as review-worthy.
- When asked to fix article feedback, preserve the author's intent and shorten or clarify prose instead of expanding it with generic filler.

## PR comment workflow

- `@codex review` should review the article draft and comment on important issues.
- `@codex` comments that request revisions should update only the PR branch, never `main`.
- After changes are pushed, the PR should remain unmerged until a human explicitly approves merge.
