# Zenn Repository

このリポジトリは、`Zenn CLI + GitHub連携` で Zenn 記事を管理するためのルートです。

```txt
feature branch で記事を作る
-> PR を作る
-> レビューして main に merge する
-> Zenn が main ブランチを自動同期する
```

## 記事の書き方ガイド

- PC で書く → [`WRITING.md`](./WRITING.md)
- iPhone で出先で書く（GitHub Web エディタ・無料）→ [`MOBILE-WRITING.md`](./MOBILE-WRITING.md)
- 記事の雛形 → [`templates/article-template.md`](./templates/article-template.md)

このファイル（README）は運用と仕組みの説明です。具体的な執筆手順は上のガイドを参照してください。

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
- 必要なら `@codex review` で Codex にレビューさせる
- 修正依頼は PR コメントで `@codex` 宛に具体的に書く

### 3. `main` にマージする

`main` は Zenn の同期対象ブランチです。PR をマージすると、その push をきっかけに Zenn 側が同期します。

このリポジトリでは、`articles/*.md` を含む PR が `main` に merge されると、GitHub Actions が `published: false` を `published: true` に引き上げて `main` に push します。つまり、通常の運用では **merge が公開トリガー** です。

`published: true` の記事:

- マージ後に公開記事として同期される

`published: false` の記事:

- 通常の article PR では merge 後に Actions が `published: true` に更新し、公開記事として同期される
- 下書きのまま残したい場合は PR に `zenn:draft` ラベルを付けて merge する

## 運用ルール

- 初期値は `published: false`
- まずは PR でレビューする
- 通常は `published: false` のまま PR を作り、merge 時に自動公開する
- 下書き運用にしたい PR は `zenn:draft` ラベルを付けて merge する
- 誤公開を防ぐため、Zenn の同期対象は `main` のみにする

## GitHub 連携

1. GitHub 上のこのリポジトリを Zenn に連携する
2. 同期対象ブランチを `main` に設定する
3. feature branch ではなく、`main` にマージされた変更だけが同期される運用にする
4. `articles/` や `books/` の変更が `main` に入ると自動同期される

## 補足

- `validate-zenn` ワークフローは PR と `main` push の両方で動く
- `publish-zenn-on-merge` は article PR の merge を検知して公開コミットを追加する
- `main` への直接 push を強く防ぎたい場合は GitHub の branch protection を有効化する
- 今回の `private` リポジトリでは、branch protection API は GitHub 側のプラン制約で有効化できなかった
- Codex の GitHub 連携が有効なら、PR コメントで `@codex review` や `@codex` 指示を使える

## 含まれているもの

- `scripts/`: Zenn 記事の作成、PR 化、検証
- `.github/`: PR テンプレートと GitHub Actions
- `AGENTS.md`: Codex が記事レビュー時に守る運用ルール
- `skills/zenn-pr-writer/`: Zenn 記事草案を PR まで進めるためのスキル定義

## スマホ確認フロー

これは PR を**レビュー**する流れです。iPhone で記事を**書く**手順は [`MOBILE-WRITING.md`](./MOBILE-WRITING.md) を参照してください。

1. Codex で記事草案を PR 化する
2. GitHub アプリで PR を読む
3. 軽微な修正は GitHub 上で直接直すか、PR コメントで指示する
4. 構成や文言の修正は `@codex` コメントで PR ブランチに反映させる
5. `validate-zenn` の再チェックが通ったら merge する
6. `main` 反映で Zenn が同期する

PR コメントの例:

```text
@codex
- タイトルをもっと具体化
- 結論を先に出す
- この段落を 2 段落に分ける
- published は false のまま
```

公式ドキュメント:

- https://zenn.dev/zenn/articles/connect-to-github
- https://zenn.dev/zenn/articles/install-zenn-cli
- https://zenn.dev/zenn/articles/zenn-cli-guide
