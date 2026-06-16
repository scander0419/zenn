# Zenn Writing Signals

Use this file to shape article tone and structure. These are distilled from recent Zenn pages and articles, plus writing-oriented Zenn posts. Some points below are inferences from examples rather than explicit platform rules.

## Current signals

- Recent trend-oriented commentary says Zenn readers respond to concrete AI implementation stories, process redesign, MCP usage, incidents, and "used it and hit this wall" writeups rather than pure hype.
Source:
  - https://zenn.dev/seyz/articles/20260302-zenn-trend-impressions

- A recent AI workflow article that gained traction leads with a specific achievement, then immediately shows what was built and what happened over a short time window.
Source:
  - https://zenn.dev/tottoko_hamu/articles/2026-04-15-062818

- A recent automation article opens with the problem, then shows the output format, then explains the system split and why the design choices matter.
Source:
  - https://zenn.dev/iineineno03k/articles/20260325-claude-code-daily-feed

- A Zenn writing support retrospective argues against shallow numeric formulas like "5 minutes" or "5 lines of code" and favors asking whether each section and code sample earns its place.
Source:
  - https://zenn.dev/innovation/articles/3daf33da0f3f23

- A writing-technique article highlights five recurring readability patterns: stronger titles, conclusion first, scannability, explicit prerequisites, and a readable tone.
Source:
  - https://zenn.dev/kagan/articles/tech-blog-techniques

- A comparison article argues that Zenn especially rewards technically deep, first-hand, practice-based writing.
Source:
  - https://zenn.dev/soshi1234/articles/note-qiita-zenn-comparison

- Zenn states that Trending is determined by scoring from multiple signals, not by one visible metric alone. Treat usefulness and reader retention as the optimization target, not just Like count.
Source:
  - https://zenn.dev/faq/why-not-in-trending

## Article patterns that fit Zenn well

- Title names a concrete problem, comparison, or result.
Good:
  - `Bedrock AgentがAction Groupを使ってくれない原因`
  - `Claude Codeで日次技術フィードを自動生成した`
Less strong:
  - `AIについて思ったこと`

- Intro quickly answers "why this article exists now".
- Early section gives the takeaway first.
- Reader can skim headings and still understand the story.
- Personal experience is translated into reusable knowledge.
- Failure, workaround, and caveat sections increase credibility.

## Recommended section shapes

### Problem-solving article

- `## はじめに`
- `## 結論`
- `## 前提`
- `## 事象`
- `## 原因`
- `## 解決策`
- `## ハマりどころ`
- `## まとめ`

### Build log or implementation article

- `## はじめに`
- `## この記事でわかること`
- `## 作ったもの`
- `## 設計`
- `## 実装`
- `## 詰まったところ`
- `## 今後の改善`
- `## まとめ`

### Comparison article

- `## はじめに`
- `## 比較観点`
- `## 結論`
- `## 各候補の特徴`
- `## 実際に使って気づいた差`
- `## どれを選ぶべきか`

## Quality bar for AI-assisted articles

- Include something a reader cannot get from a generic chatbot answer alone.
- Prefer verified commands, config, paths, versions, or observed behavior.
- State when examples are simplified or anonymized.
- Do not fabricate measurements or timelines.
- If the evidence is thin, narrow the scope instead of padding.
