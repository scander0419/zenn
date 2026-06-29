# WRITING.md — この PC で記事を書く手順

PC（Windows / PowerShell）で Zenn 記事を書くときの手順書です。

- **運用・仕組み**の説明 → [`README.md`](./README.md)
- **PC での書き方** → このファイル
- **iPhone で出先で書く** → [`MOBILE-WRITING.md`](./MOBILE-WRITING.md)

PowerShell では `npm` が実行ポリシーで止まることがあるので、`npm.cmd` を使います。

## 全体の流れ

```txt
feature branch で記事を書く
-> PR を作る
-> レビューする（必要なら @codex review）
-> main に merge する
-> merge をトリガーに Zenn が同期 & published に昇格
```

## 記事の始め方は2系統

### A. スクリプトで一気に PR まで作る（おすすめ）

branch 作成 → commit → push → PR 作成 までを1コマンドでやります。

```powershell
npm.cmd run article:pr -- --title "記事タイトル" --topics codex,zenn --type tech --draft true
```

よく使うオプション（`scripts/create-article-pr.mjs` の help と同じ）:

| オプション | 説明 |
| --- | --- |
| `--title` | 必須。記事タイトル |
| `--topics` | カンマ区切り。例 `aws,bedrock,lambda` |
| `--type` | `tech` か `idea`。既定 `tech` |
| `--emoji` | 既定 `📝` |
| `--slug` | 12〜50字 / `a-z0-9-_`。省略時は自動生成 |
| `--published` | `true`/`false`。既定 `false` |
| `--draft` | `true` でドラフト PR にする（レビュー先行） |
| `--body-file` | 本文 md ファイルのパス |

記事ファイルだけ先に作りたいときは `npm.cmd run article:new -- --title "..."`。

### B. AI（Claude / Codex）に下書きから書かせる

メモ・箇条書き・学習ログを渡して、`zenn-pr-writer` skill に記事化させます。

- skill 定義: [`skills/zenn-pr-writer/SKILL.md`](./skills/zenn-pr-writer/SKILL.md)
- 文体・構成の指針: [`skills/zenn-pr-writer/references/zenn-writing-signals.md`](./skills/zenn-pr-writer/references/zenn-writing-signals.md)

この skill は本文を一時ファイルに書いてから `npm.cmd run article:pr -- ... --body-file <tmp> --draft true` を呼ぶので、出力は A と同じ PR フローに乗ります。**自動 merge はしません**。PR ができたらタイトル・パス・PR URL・`published` 状態を報告して止まります。

### ネタ元: Obsidian のダンピングから記事化する

普段のジャーナリング（Obsidian で自由に書き散らしたメモ）を記事のネタ元にできます。流れは [`articles/20260621-obsidian-codex-journaling.md`](./articles/20260621-obsidian-codex-journaling.md) を参照。要点は「書くときは自由にダンプ、構造化は後から AI」。ダンプから記事化したいときは、その内容を B の skill に渡すのが早いです。

## 書く前後のチェック

```powershell
npm.cmd run check      # front matter / slug を検証（CI と同じ）
npm.cmd run preview    # ローカルプレビュー（--open でブラウザ表示）
```

`check` は `.github/workflows/validate-zenn.yml` で PR / main push 時にも走ります。手元で通しておけば PR で落ちません。

## front matter と slug のルール

`articles/<slug>.md` の `<slug>` と front matter は次を満たす必要があります（`scripts/check-zenn-articles.mjs` が検証）。

- **slug**（= ファイル名から `.md` を除いた部分）: `^[a-z0-9_-]{12,50}$`。慣習は `YYYYMMDD-kebab-title`。
  - OK: `20260628-zenn-mobile-writing`
  - NG: `My_Article`（大文字）, `記事`（全角）, `short`（12字未満）
- **必須キー**: `title` / `emoji` / `type`(=`tech` か `idea`) / `topics` / `published`
- **topics** はインライン配列: `topics: ["codex", "zenn"]`
- **published** は `true` か `false`

```yaml
---
title: "記事タイトル"
emoji: "📝"
type: "tech"
topics: ["codex", "zenn"]
published: false
---
```

## レビュー → 公開

1. PR を作る（通常は `published: false` のまま）。
2. `validate-zenn` の green を確認。
3. 必要なら PR コメントで `@codex review` / 具体的な修正指示。修正は **PR ブランチだけ**に入る（`AGENTS.md` 参照）。
4. `main` に merge する。
   - `publish-zenn-on-merge.yml` が `published: false → true` に**自動昇格**し、Zenn が同期する。
   - **下書きのまま残したい場合**は、merge 前に PR へ `zenn:draft` ラベルを付ける。

> 公開トリガーは「merge」です。`published: false` のままでも、ラベルを付けずに merge すると公開されます。

## 詰まったとき

- `npm` が実行ポリシーで止まる → `npm.cmd` を使う。
- `check` が slug で落ちる → ファイル名を `YYYYMMDD-kebab` の英小文字に直す。
- `topics` で落ちる → `["a", "b"]` のインライン配列にする。
