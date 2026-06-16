# Zenn Repository

このリポジトリは、`Zenn CLI + GitHub連携` で Zenn 記事を管理するためのルートです。

```txt
feature branch で記事を作る
-> PR を作る
-> レビューして main に merge する
-> Zenn が main ブランチを自動同期する
```

## セットアップ

```bash
npm install
```

PowerShell の実行ポリシーで `npm` が止まる環境では `npm.cmd` を使います。

## よく使うコマンド

```bash
npm run article:new -- --title "記事タイトル" --topics aws,bedrock,lambda
npm run article:pr -- --title "記事タイトル" --topics aws,bedrock,lambda
npm run check
npm run preview
```

## おすすめフロー

### 1. 記事を作って PR を作成する

```bash
npm run article:pr -- --title "記事タイトル" --topics aws,bedrock,lambda
```

このコマンドで次をまとめて実行します。

1. `articles/<slug>.md` を作成
2. `article/<slug>` ブランチを作成
3. commit
4. `origin` へ push
5. GitHub PR を作成

### 2. PR 上でレビューする

- GitHub Actions の `validate-zenn` が走る
- Front Matter や本文を確認する
- 必要ならローカルで `npm run preview` を確認する

### 3. `main` にマージする

`main` は Zenn の同期対象ブランチです。PR をマージすると、その push をきっかけに Zenn 側が同期します。

`published: true` の記事:

- マージ後に公開記事として同期される

`published: false` の記事:

- マージ後に下書きとして同期される

## 運用ルール

- 初期値は `published: false`
- まずは PR でレビューする
- 下書き運用なら `published: false` のままマージする
- 公開したい場合は `published: true` にしてマージする
- 誤公開を防ぐため、Zenn の同期対象は `main` のみにする

## GitHub 連携

1. GitHub 上のこのリポジトリを Zenn に連携する
2. 同期対象ブランチを `main` に設定する
3. feature branch ではなく、`main` にマージされた変更だけが同期される運用にする
4. `articles/` や `books/` の変更が `main` に入ると自動同期される

## 補足

- `validate-zenn` ワークフローは PR と `main` push の両方で動く
- `main` への直接 push を強く防ぎたい場合は GitHub の branch protection を有効化する
- 今回の `private` リポジトリでは、branch protection API は GitHub 側のプラン制約で有効化できなかった

公式ドキュメント:

- https://zenn.dev/zenn/articles/connect-to-github
- https://zenn.dev/zenn/articles/install-zenn-cli
- https://zenn.dev/zenn/articles/zenn-cli-guide
