# MOBILE-WRITING.md — iPhone で記事を書く（GitHub Web エディタ・無料）

出先で iPhone だけを使い、md をタイプして **commit → PR 作成まで完結**させる手順です。
手書きは使わず、通常の Markdown をタイプして書きます。
**追加アプリ・追加課金は不要**で、Safari から github.com を開くだけで使えます。

- PC での書き方 → [`WRITING.md`](./WRITING.md)
- このリポジトリの運用・仕組み → [`README.md`](./README.md)

> README の「スマホ確認フロー」は **PR をレビューする**話です。このファイルは **iPhone で記事を書く**話で、役割が違います。

## なぜ GitHub Web エディタか

- **無料**。アプリのインストールも買い切り課金も不要（Working Copy の push アンロックは約4,500円かかる）。
- Safari で github.com を開くだけで、ファイル作成 → commit → **PR 作成まで iPhone 完結**できる。
- リポジトリは Git + OneDrive 上にあるが、iPhone からは **GitHub 上で直接編集**するので OneDrive 同期の競合を気にしなくてよい。

> GitHub 公式モバイルアプリでは**ファイルの作成・編集はできません**（レビュー/コメント/merge 用）。執筆は下記の Web エディタ、レビューは公式アプリ、と役割分担すると綺麗です。

## A. 一度きりの準備

1. GitHub に Safari でログインできるようにしておく（パスワード or パスキー）。
2. Safari でこのリポジトリ（`zenn`）を開けることを確認する。
3. ボタンが出にくいときのために「**デスクトップ用 Web サイトを表示**」の切り替え方を覚えておく（アドレスバーの「ぁあ」→ デスクトップ用 Web サイトを表示）。
4. `zenn:draft` ラベルの意味を把握しておく（下書きのまま残したいとき merge 前に付ける）。

## B. 出先での執筆フロー（PR 作成まで iPhone 完結）

1. Safari で github.com の `zenn` リポジトリ → `articles/` フォルダを開く。
2. 「**Add file**」→「**Create new file**」。
   - ボタンが見当たらなければ「デスクトップ用 Web サイトを表示」に切り替える。
3. ファイル名を **`<slug>.md`** にする。
   `<slug>` は `YYYYMMDD-kebab-title` 形式で、`a-z 0-9 - _` のみ・**12〜50字**。
   - 例: `20260628-zenn-mobile-writing.md`
4. 本文欄に [`templates/article-template.md`](./templates/article-template.md) の中身を貼り付け、front matter と本文を埋める。
   - `title` / `topics` / `emoji` を記入。`published: false` のまま。
   - `topics` は必ずインライン配列: `topics: ["codex", "zenn"]`
5. 下部の「**Commit changes**」を開き、
   - 「**Create a new branch for this commit and start a pull request**」を選ぶ（ブランチ名は `article/<slug>` にしておくと PC 側の慣習と揃う）。
   - 「Propose changes」→「Create pull request」で **PR 作成まで完了**。
6. `validate-zenn` が走るので **green を待つ**。
7. 落ちたら、同じファイルを GitHub 上で開いて鉛筆アイコン（Edit）→ 直して **PR ブランチに commit** → 再チェック。
8. 公開してよければ **merge**（`published: true` に自動昇格して Zenn 同期）。
   下書きで残すなら merge 前に **`zenn:draft` ラベル**を付ける。

> 既存記事を直すときも同じ: 対象ファイルを開く → 鉛筆（Edit）→ 編集 → 新しいブランチに commit → PR。

## C. iPhone 特有の注意

- **`npm run check` は iPhone では実行できない**。だから「テンプレ貼り付け + slug 命名規則の順守」で事前に整え、最終検証は PR の `validate-zenn` に任せる。
- 一番やりがちなのは **ファイル名（slug）の違反**。命名例:
  - OK: `20260628-zenn-mobile-writing`, `20260628-codex-automation-note`
  - NG: `記事`（全角）, `My_Note`（大文字）, `note`（12字未満）, `20260628 zenn`（スペース）
- `topics` は `["a", "b"]` のインライン配列。`- a` の縦並びにしない。
- `type` は `tech` か `idea`。`published` は `true`/`false`。
- 迷ったら `published: false` のまま PR を作る。公開トリガーは merge。
- Safari で「Add file」やコミット用ボタンが反応しない/見えないときは「デスクトップ用 Web サイトを表示」を試す。

## front matter の最小形（テンプレと同じ）

```yaml
---
title: "記事タイトル"
emoji: "📝"
type: "tech"
topics: ["codex", "zenn"]
published: false
---
```

## もっと書き心地が欲しくなったら（任意・無料）

- **github.dev**: リポジトリ画面で `.`（ピリオド）を押すか、URL の `github.com` を `github.dev` に変える。ブラウザ版 VS Code が開く。複数ファイルを扱いやすいが、iPhone では画面が小さめで、PR 作成は github.com 側で行う流れになる。
