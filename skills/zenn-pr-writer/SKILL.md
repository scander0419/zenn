---
name: zenn-pr-writer
description: Draft and publish Zenn articles from a user's notes, bullets, learning log, or rough topic idea, then open a GitHub PR in a Zenn CLI repository without merging it. Use when the user wants Codex to turn technical input into a Zenn-ready article, shape it to fit current high-performing Zenn writing patterns, save it under articles/, and create a reviewable PR that still requires explicit user approval before merge or publication.
---

# Zenn PR Writer

Turn user input into a Zenn-ready article, write it in a style that matches recent strong Zenn posts, and create a draft PR in the publishing repository.

## Workflow

1. Confirm that the current repository is a Zenn CLI publishing repo.
Check for `package.json`, `articles/`, and either `npm run article:pr` or `scripts/create-article-pr.mjs`.
If the repo does not look publishable, explain the missing prerequisite and stop.

2. Read [references/zenn-writing-signals.md](references/zenn-writing-signals.md).
Use it to decide article angle, title style, section order, and how much concrete evidence to include.

3. Build the article plan from the user's input.
Extract:
- the core problem or claim
- who the article helps
- what the reader can do after reading
- the author's first-hand evidence, steps, mistakes, trade-offs, or metrics

If the topic is current, version-sensitive, or factual enough to drift, browse primary sources before writing.

4. Write for Zenn, not for a generic blog.
Optimize for:
- a specific title with a concrete promise or failure mode
- an early payoff section that gives the answer first
- short, skimmable sections
- concrete examples, code, commands, outputs, versions, dates, and caveats
- real decisions and real failure points

Avoid:
- vague motivational filler
- generic AI phrasing
- claims that could have been answered by "just ask AI"
- invented numbers, invented incidents, or unsupported certainty

5. Use this default article shape unless the topic clearly needs another shape.
- `## はじめに`
- `## この記事でわかること` or `## 結論`
- `## 前提`
- `## 作ったもの` or `## 仕組み`
- `## 実装`
- `## ハマりどころ`
- `## まとめ`

Add `[:contents]` near the top for medium-to-long articles.

6. Default to safe publication settings.
Set `published: false` unless the user explicitly asks for public publication in the generated article file.
Prefer `type: tech` unless the article is clearly opinion or concept driven.
Choose 3-5 topics that match the article and are recognizable on Zenn.

7. Create the article through the repo workflow instead of hand-waving the result.
Write the article body to a temporary markdown file, then run the repository flow with `npm.cmd` on Windows:

```powershell
npm.cmd run article:pr -- --title "..." --topics topic1,topic2 --type tech --published false --body-file <temp-file> --draft true
```

Use `--draft true` by default so the PR is review-first.

8. Never merge automatically.
After the PR is created, report:
- article title
- article file path
- PR URL
- whether the article is `published: false` or `published: true`

Then stop and ask for explicit approval before any merge or publication step.

## Writing Rules

- Write in Japanese unless the user explicitly asks for another language.
- Use exact dates, versions, file paths, and commands when they matter.
- Mark assumptions clearly.
- If the article is based on personal notes that are thin, say what is confirmed and what still needs verification.
- Keep paragraphs short and headings informative.
- Prefer one strong article over a padded long article.

## Repo Integration

When working in `C:\Users\scand\OneDrive\ドキュメント\zenn`, prefer these local commands:

```powershell
npm.cmd run check
npm.cmd run preview
npm.cmd run article:pr -- --title "..." --topics ...
```

If `article:pr` does not exist but `article:new` does, create the article file and PR manually with `git switch -c`, `git add`, `git commit`, `git push`, and `gh pr create`.

## Output Expectations

Before creating the PR, ensure the article includes:
- a useful title
- valid Zenn front matter
- content that reflects the user's actual experience or verified sources
- at least one section that surfaces pitfalls, trade-offs, or lessons learned

After creating the PR, do not continue to merge. Ask the user whether they want to review, revise, or approve the merge.
