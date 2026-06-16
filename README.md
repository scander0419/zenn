# Zenn Repository

このリポジトリは、`Zenn CLI + GitHub連携` で Zenn 記事を管理するためのルートです。

```txt
記事を書く or AIで生成する
-> articles/*.md を作る
-> GitHub に push する
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
npm run check
npm run preview
```

## 運用ルール

- 初期値は `published: false`
- 下書きを push して Zenn 側で確認
- 問題なければ `published: true` に変更して再 push

## GitHub 連携

1. GitHub 上のこのリポジトリを Zenn に連携する
2. 同期対象ブランチを `main` に設定する
3. `articles/` や `books/` の変更を push すると自動同期される

公式ドキュメント:

- https://zenn.dev/zenn/articles/connect-to-github
- https://zenn.dev/zenn/articles/install-zenn-cli
- https://zenn.dev/zenn/articles/zenn-cli-guide
