---
title: "GitHub PRで@codexが反応しないときに見直すこと environment未作成で止まっていた"
emoji: "📝"
type: "tech"
topics: ["codex", "github", "ai", "review"]
published: false
---
[:contents]

## はじめに

Codex と GitHub を連携して、PR コメントから `@codex review` や `@codex ...` でレビューや修正を流したかったのですが、最初はかなり引っかかりました。

やりたかったのは次の流れです。

1. Codex で Zenn 記事草案を PR 化する
2. GitHub で PR を読む
3. コメントで `@codex review` や `@codex` を使う
4. Codex がレビューする、または PR ブランチを更新する

ところが、設定を入れても `@codex` が動いていないように見えました。

この記事では、2026-06-17 時点で私が実際に詰まった点と、その解消手順をまとめます。

## 結論

先に結論を書くと、今回の詰まりは主にこの 2 つでした。

1. Codex の個人コードレビュー設定が OFF だった
2. GitHub App は入っていたが、**対象 repo 用の environment が未作成**だった

特に 2 つ目が大きくて、`@codex` に反応がないように見えても、実際には bot が反応していて、**「この repo 用の environment を作ってください」** で止まっていました。

つまり、次の 3 段階を全部満たす必要があります。

1. GitHub App をつなぐ
2. Codex の Code review を有効にする
3. **その repo 用の environment を作る**

## この記事でわかること

- `@codex` が反応しないときに、どこを見るべきか
- GitHub App 導入済みでも詰まるポイント
- Codex の設定画面で見直す場所
- bot が返してきたメッセージの意味

## 前提

この記事は、次の前提で書いています。

- GitHub 上に対象 repo がある
- Codex を使える
- GitHub に `ChatGPT Codex Connector` をインストールできる
- PR ベースで記事やコードをレビューしたい

今回の対象 repo は、Zenn 投稿用として整備していた `scander0419/zenn` です。

## 起きたこと

最初は、Codex 側の設定画面に repo が見えていたので、「もう使えるはず」と思っていました。

ただ、実際には次のような状態でした。

- GitHub のコメント欄で `@codex` と打っても、補完候補が出ない
- `@codex review` を入れても、すぐにはレビューが付かない
- file コメントだけでは、何が足りないのか分かりにくい

この時点では「GitHub 側の補完が出ないから連携できていないのでは」と思いがちでした。

でも、後から見ると本質はそこではありませんでした。

## まず見直した設定

Codex のコードレビュー設定画面で、個人設定が OFF になっていました。

下のように、まずは個人のコードレビュー設定を ON にしておく必要がありました。

![Codex のコードレビュー設定画面。個人設定まわりを確認したスクリーンショット](/images/articles/codex-github-integration-troubleshooting/codex-code-review-settings.png)

スクリーンショットは、個人情報や不要な周辺情報を避けるためにトリミングしています。

私の環境では、ここで次の状態にしました。

- 個人のコードレビュー設定: ON
- 個人用レビュー トリガー設定: PR のオープン時
- repo ごとの自動コードレビュー: 自分の PR をレビューする

ただ、これだけではまだ足りませんでした。

## 本当の詰まりは environment 未作成だった

PR 全体のコメントで `@codex` を投げてみると、ようやく bot の反応が見えました。

そのときに返ってきたのが、次のメッセージです。

![PR 上で chatgpt-codex-connector Bot が environment 作成を促したスクリーンショット](/images/articles/codex-github-integration-troubleshooting/codex-bot-environment-message.png)

表示されたのは、要するにこういう内容でした。

> To use Codex here, create an environment for this repo.

これで、原因がかなりはっきりしました。

- GitHub App は入っている
- `@codex` コメントの検知もされている
- でも、この repo を実際に Codex が扱うための environment がまだない

つまり、`@codex` が完全に無反応だったのではなく、**起動条件の最後の 1 段が欠けていた** ということです。

## 解消手順

私なら、次の順番で確認します。

### 1. GitHub App が入っているか確認する

まず `ChatGPT Codex Connector` が GitHub に入っていることを確認します。

ここが未導入なら、PR コメントでの連携自体が始まりません。

### 2. Codex の Code review 設定を確認する

Codex の設定画面で、少なくとも次を見ます。

- 個人のコードレビュー設定が ON か
- 対象 repo が一覧に出ているか
- repo ごとの自動コードレビュー設定が無効になっていないか

### 3. environment を作る

今回の本丸はここでした。

repo が見えていても、**environment がないと実作業に進めません**。

bot の案内どおり、Codex の environment 設定画面から対象 repo の environment を作ります。

### 4. そのあとで PR コメントを再送する

environment 作成後に、改めて PR コメントで次を試します。

```text
@codex review
```

レビューではなく修正を依頼したい場合は、次のように書きます。

```text
@codex
- タイトルをもっと具体化
- 結論を先に出す
- この記事で skill を公開した価値も書いて
```

## 補足: file コメントだけで進めるより、まず PR 全体コメントが分かりやすい

今回の体験では、file 単位のコメントだけだと「反応していないのか」「設定不足なのか」が分かりにくかったです。

一方で、PR 全体コメントで `@codex` を送ると、bot の返信が見えたので切り分けしやすくなりました。

少なくとも最初の動作確認は、次の順がおすすめです。

1. PR 全体コメントで `@codex review`
2. bot の反応を見る
3. 問題なければ、その後に file コメントや詳細修正指示を使う

## ハマりどころ

### `@codex` の補完が出ないこと自体は、本質ではない

最初はここに引っ張られました。

でも実際には、補完が出ないことよりも、**bot が反応して何を返してくるか** の方が重要でした。

補完が弱くても、設定が整っていれば起動する可能性があります。

### repo 一覧に見えていても、まだ使えるとは限らない

これも勘違いしやすいポイントでした。

repo が設定画面に出ているだけでは不十分で、environment がなければ「この repo で動く Codex」にはなりません。

### eye のリアクションだけでは完了ではない

目のリアクションや bot の軽い反応が付くと、動いた気になります。

でも、レビュー投稿や PR ブランチ更新まで進んで初めて、実運用としては「使える」と言えます。

## まとめ

Codex と GitHub の連携で `@codex` が動かないように見えたときは、次の順番で見ると切り分けしやすいです。

1. GitHub App は入っているか
2. 個人の Code review 設定は ON か
3. 対象 repo の設定が見えているか
4. **environment を作ったか**
5. PR 全体コメントで `@codex review` を試したか

個人的には、最後の `environment` がいちばん見落としやすいポイントでした。

同じように、「設定したのに `@codex` が動かない」と感じた人は、まずここを見てみると早いと思います。
