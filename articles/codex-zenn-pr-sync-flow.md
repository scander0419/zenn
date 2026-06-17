---
title: "CodexでZenn記事をPR化し、スマホレビュー後にmergeで同期する仕組みを作った"
emoji: "📝"
type: "tech"
topics: ["zenn", "codex", "github", "githubactions"]
published: true
---
[:contents]

## はじめに

Zenn の GitHub 連携自体はシンプルですが、実運用では「AI が草案を書く」だけでは足りませんでした。

私が欲しかったのは、次の流れです。

1. Codex で記事草案を PR 化する
2. スマホの GitHub アプリで読む
3. PR コメントで `@codex` に修正を指示する
4. PR ブランチだけ更新させる
5. チェックが通ったら merge する
6. `main` 更新をきっかけに Zenn へ同期する

この流れを回せるように、Zenn 用の GitHub リポジトリと Codex 用のスキルを整備しました。

リポジトリはこれです。

https://github.com/scander0419/zenn

## この記事でわかること

- Zenn 投稿を PR ベースで安全に運用する構成
- Codex で記事草案を作って PR まで出す方法
- スマホレビューを前提にした `@codex` コメント運用
- 実際に詰まった点と、2026-06-17 時点の注意点

## 結論

先に結論を書くと、Zenn 投稿の自動化は API 直叩きではなく、**Zenn 公式の GitHub 連携を土台にして、AI は PR 作成と PR 更新側に寄せる**のが扱いやすかったです。

今回の構成はこうです。

```txt
Codex で記事草案を作る
-> articles/*.md を作る
-> feature branch を push して PR を作る
-> GitHub Actions でチェックする
-> スマホで PR を読む
-> 必要なら @codex コメントで PR ブランチを更新する
-> merge
-> main を Zenn が自動同期する
```

特に大事だったのは次の 2 点です。

- Zenn の同期対象ブランチを `main` に固定する
- 記事ファイルの `published` は初期値を `false` にする

これで AI の誤記や未確認情報が混ざっても、いきなり公開されにくくなります。

## 前提

この構成は、次の前提で組んでいます。

- Zenn と GitHub リポジトリを連携済み
- Zenn 側の同期ブランチは `main`
- 記事は `articles/` 配下で管理
- Codex が使える
- GitHub CLI `gh` が使える

また、`@codex` コメントで PR を更新する運用は、**Codex の GitHub 連携が有効であること**が前提です。  
repo 側のファイルだけでは完結せず、アカウント側の連携設定も必要です。

## 作ったもの

今回 public にしたのは、Zenn 投稿のための中身そのものです。

- PR 作成スクリプト: `scripts/create-article-pr.mjs`
- 記事検証スクリプト: `scripts/check-zenn-articles.mjs`
- PR テンプレート: `.github/pull_request_template.md`
- GitHub Actions: `.github/workflows/validate-zenn.yml`
- Codex 用ルール: `AGENTS.md`
- 記事作成スキル: `skills/zenn-pr-writer/`

`zenn-pr-writer` スキルには、次の役割を持たせました。

- Zenn 向けの見出し構成で書く
- 結論を先に出す
- 具体的なコマンドや前提を書く
- `published: false` をデフォルトにする
- 記事を作るだけで終わらず、PR まで作る

スキル自体も public repo に含めたのは、**Codex でやった作業をそのまま記事に寄せやすくするため**です。  
単に「記事を書くプロンプト」ではなく、記事の書きぶり、PR 生成、レビュー前提の安全側設定まで含めて共有できます。

## 実装

### `npm run article:pr` で PR までまとめて作る

このリポジトリでは、記事草案の作成から PR 作成までを 1 コマンドにまとめました。

```bash
npm run article:pr -- --title "CodexでZenn記事をPR運用する仕組み" --topics zenn,github,codex
```

PowerShell では `npm.cmd` を使う運用にしています。

```powershell
npm.cmd run article:pr -- --title "CodexでZenn記事をPR運用する仕組み" --topics zenn,github,codex --draft true
```

このコマンドで、次をまとめて実行します。

1. `articles/<slug>.md` を作成
2. `article/<slug>` ブランチを作成
3. commit
4. push
5. draft PR を作成

### PR 本文にレビュー導線を埋め込む

最初は PR テンプレートだけ整えればよいと思っていました。  
ただ、`gh pr create --body ...` を使うと、PR テンプレートの内容がそのままは使われません。

そのため、`scripts/create-article-pr.mjs` 側で PR 本文も生成し、次を含めるようにしました。

- `@codex review` の案内
- スマホレビューの手順
- `@codex` コメント例
- `published: false` を維持する注意

ここを入れておくと、PR を開いた時点で「どうレビューするか」が分かります。

### `validate-zenn` で最低限の事故を止める

GitHub Actions では、PR と `main` push の両方で次を実行しています。

```yaml
- run: npm ci
- run: npm run check
```

`npm run check` では、少なくとも次を見ています。

- front matter の必須項目
- `type` が `tech` か `idea` か
- `published` が `true` か `false` か
- `topics` の形式
- slug の形式

見た目の良し悪しまでは自動判定しませんが、**同期してはいけない壊れた記事**は PR 段階で止めやすくなります。

### Codex にレビュー観点を渡す

`AGENTS.md` には、Zenn 記事レビュー用のルールを書きました。

- `published: true` の誤設定は優先的に見る
- 結論先出し、前提、ハマりどころを重視する
- 機密情報や未確認情報の混入を強く警戒する
- `@codex` での修正は PR ブランチだけを更新する

これで、単に「日本語を整える AI」ではなく、**Zenn 運用に沿ってレビューする AI** に寄せられます。

### スキルを公開しておくと再利用しやすい

今回の `skills/zenn-pr-writer/` は、個人用のローカル設定に閉じず、repo に含めて公開しました。

これで次のような使い方がしやすくなります。

- 別マシンに同じ運用を持っていく
- チームに「どういう方針で記事を書かせるか」を共有する
- Codex にさせた作業を、同じ方針で Zenn 記事へ変換する
- 記事本文と自動化の実装を同じ repo で追う

「作った仕組み」と「その仕組みを説明する記事」の距離が近いので、あとで読み返したときも意図を保ちやすいです。

## スマホレビューの流れ

実運用フローは次の形です。

1. Codex に記事作成を依頼する
2. Codex が draft PR を作る
3. GitHub アプリで PR を読む
4. 修正したい点を PR コメントで書く
5. `@codex` に直してほしい内容を渡す
6. PR ブランチが更新されたら再確認する
7. Actions が通ったら merge する
8. `main` 更新で Zenn が同期する

コメントはこのように書く想定です。

```text
@codex
- タイトルをもっと具体化
- 結論を先に出す
- 3つ目の段落を短くする
- published は false のまま
```

この流れにすると、PC の前にいなくてもレビューを回しやすくなります。

## ハマりどころ

### PR テンプレートだけでは足りなかった

前述の通り、`gh pr create --body` を使う構成では PR テンプレートだけ整えても反映されません。  
ここは実際に触ってから気づいた点でした。

### `@codex` は repo だけでは動かない

`@codex` コメントで PR ブランチを更新する仕組みは便利ですが、repo 側にテンプレートやルールを書くだけでは動きません。  
Codex 側の GitHub 連携が有効であることが前提です。

つまり、repo の整備とアカウント連携の両方が必要です。

### private repo だと周辺設定に制約が出ることがある

今回、private repo で branch protection API を有効化しようとして、GitHub 側プラン制約に引っかかりました。  
そのため、再利用したいなら public repo にしておく方が扱いやすい場面があります。

### `published: true` は最後まで慎重に扱う

AI が書いた記事は、内容がかなり自然でも、事実確認が甘いことがあります。  
そのため、この構成では `published: false` を基本にして、merge 前に人が確認する前提にしています。

## まとめ

Zenn 投稿を自動化したいときは、公開そのものを AI に丸投げするより、**AI は PR 作成と修正に使い、公開の判断は人が持つ**形がかなり相性がよかったです。

今回の仕組みでできるようになったのは、次の流れです。

```txt
Codexで草案作成
-> draft PR
-> スマホレビュー
-> @codex コメントで修正
-> Actions 再チェック
-> merge
-> Zenn 同期
```

個人的には、「記事を書く」より「レビューと公開判断をしやすくする」方に自動化の価値がありました。

同じように、Zenn を PR ベースで安全に回したい人の参考になればうれしいです。
