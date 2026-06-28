---
title: "iPhoneだけ・無料でZenn記事をPRまで書く環境を作った（OneDriveのCRLFで一度詰まった）"
emoji: "📝"
type: "tech"
topics: ["zenn", "github", "iphone", "onedrive", "git"]
published: false
---
## はじめに

出先の iPhone で Zenn 記事を書きたくなりました。手書きではなく Markdown をタイプして、最終的に PR 作成まで終わらせたい。

ついでに「このPCでどう書いているか」も文章として残っていなかったので、PC用とiPhone用の執筆手順を整えました。その過程で、OneDrive 配下のリポジトリ特有の CRLF 問題を踏んだので、そこも含めて書きます。

環境:

- Windows 11 / PowerShell
- Zenn CLI + GitHub連携（main に merge で同期）
- リポジトリは OneDrive 配下
- 日付: 2026-06-29 時点

## この記事でわかること

- iPhone だけ・追加課金なしで Zenn 記事を PR まで書く方法
- なぜ GitHub 公式モバイルアプリでは書けないのか
- Zenn リポジトリの slug / front matter の落とし穴
- OneDrive 配下のリポジトリで `npm run check` が CRLF で落ちる現象と直し方

## 結論

- iPhone 執筆は **Safari で GitHub の Web エディタ** を使えば無料で PR 作成まで完結する。専用 Git アプリ（Working Copy など）の課金は不要だった。
- ただしテンプレ必須。slug（ファイル名）と front matter のルールを外すと CI で落ちるので、貼るだけで通る雛形を用意した。
- OneDrive 配下だと作業ツリーが勝手に CRLF 化して、ローカルの検証スクリプトだけが落ちることがある。`.gitattributes` で LF 固定 + 検証側を CRLF 許容にして両対応した。

## 前提: このリポジトリの運用

feature branch → PR → main に merge → Zenn 同期、という構成です。merge をトリガーに GitHub Actions が `published: false` を `true` に昇格させます（`zenn:draft` ラベルがあれば下書きのまま）。

記事ファイルは `articles/<slug>.md`。検証スクリプト `scripts/check-zenn-articles.mjs` が次を強制します。

- slug（= ファイル名から `.md` を除いた部分）: `^[a-z0-9_-]{12,50}$`
- front matter 必須キー: `title` / `emoji` / `type`(tech|idea) / `topics` / `published`
- topics はインライン配列: `["codex", "zenn"]`

PR と main push で `validate-zenn`（中身は `npm run check`）が走ります。これが後で効いてきます。

## iPhoneで書く方法: 最初は Working Copy を考えた

最初の案は Working Copy（iOS の本格 Git クライアント）でした。clone・編集・commit・push が手元で完結します。

ただし **push は買い切りアンロックが必要で約4,500円**。出先で Markdown を書くためだけに払うのはためらいました。

そこで無料の選択肢を洗い直しました。

- GitHub 公式モバイルアプリ → **ファイルの作成・編集ができない**（レビュー / コメント / merge 用）。執筆には使えない。
- a-Shell / iSH（無料ターミナル）+ PAT → 手順が技術的すぎる
- **GitHub の Web エディタ（Safari）→ 無料・アプリ不要・PR 作成まで完結** ← これにした

## 採用: GitHub Webエディタだけで書く

Safari で github.com を開き、リポジトリ上で直接ファイルを作ります。下のスクリーンショットは PC の Chrome ですが、流れは Safari でも同じです。

1. `articles/` で「Add file」→「Create new file」（画面幅によっては右上の `+` メニューに折りたたまれます）
2. ファイル名を `20260629-xxx.md`（slug ルールを守る）
3. テンプレの中身を貼り付け、front matter と本文を埋める
4. 下部の「Commit changes」で **「Create a new branch for this commit and start a pull request」** を選ぶ
5. そのまま PR 作成まで完了

`articles/` を開いたら、Add file メニューから新規ファイル作成に入ります。

![articles ディレクトリで Add file メニューを開いた画面](/images/articles/20260629-iphone-free-zenn-writing/01-add-file.png)

ファイル名はそのまま slug になります。ここで `20260629-xxx.md` の形にして、テンプレ本文を貼り付けます。

![Create new file 画面でファイル名とテンプレ本文を入力した画面](/images/articles/20260629-iphone-free-zenn-writing/02-new-file-editor.png)

Commit 時は main へ直接入れず、新しいブランチを作って PR を開始します。

![Commit changes ダイアログで新しいブランチから PR を開始する選択をした画面](/images/articles/20260629-iphone-free-zenn-writing/03-commit-dialog.png)

次の画面で PR タイトルと説明を確認し、「Create pull request」を押せば PR になります。

![Open a pull request 画面で PR タイトルと説明を確認している画面](/images/articles/20260629-iphone-free-zenn-writing/04-create-pr.png)

PR を作ると `validate-zenn` が走ります。ここが緑なら、少なくとも slug / front matter / `published` の基本形は通っています。

![PR 画面で validate-zenn チェックが成功している画面](/images/articles/20260629-iphone-free-zenn-writing/05-pr-checks.png)

修正は同じファイルを開いて鉛筆アイコン（Edit）→ PR ブランチに commit。これで **iPhone だけで PR まで完結** します。

注意: Safari でボタンが出ないときは「デスクトップ用 Web サイトを表示」に切り替えると出てきます。

## 貼るだけで通るテンプレを用意した

iPhone では `npm run check` を実行できません。だから「書く前に正しい形」を保証するテンプレが要ります。

`templates/article-template.md` を、書く場所が一目でわかる穴埋め式にしました（ガイド用のコメントは Zenn には表示されません）。

```md
---
title: "ここにタイトルを書く"
emoji: "📝"
type: "tech"
topics: ["codex", "zenn"]
published: false
---

## はじめに
<!-- ここに導入を書く -->
...
```

ポイントは、**テンプレを `articles/` の外に置く**こと。`articles/` 内の `.md` は全部 check の対象で、`article-template` のような名前は slug ルール（12〜50字・英小文字）に引っかかって CI が落ちるためです。

## ハマりどころ: OneDriveのCRLFで `npm run check` が落ちた

ここが本題です。テンプレ検証のため `npm run check` を回したら、既存記事 4 本だけが落ちました。

```text
Zenn article validation failed:

- 20260618-codex-hooks-dreaming.md: front matter is missing.
- 20260618-codex-hooks-pitfalls.md: front matter is missing.
...
```

front matter はちゃんと書いてあります。なぜ「missing」なのか。先頭バイトを見ました。

```text
$ head -c 8 articles/20260618-codex-hooks-dreaming.md | xxd
00000000: 2d2d 2d0d 0a74 6974 6c  ---..titl   # ---\r\n = CRLF
```

一方、落ちない記事は LF（`---\n`）でした。検証スクリプトの正規表現が `^---\n` で LF 固定だったため、CRLF ファイルだけ front matter を認識できていなかったわけです。

さらに調べると、**git HEAD は LF で保存されている**。

```text
$ git show HEAD:articles/20260618-codex-hooks-dreaming.md | head -c 8 | xxd
00000000: 2d2d 2d0a 7469 746c  ---.titl    # LF

$ git status --short   # → 変更なし扱い
```

つまり、リポジトリ（と CI）は LF なのに、**OneDrive が作業ツリーを非決定的に CRLF へ書き換えている**。実際、別のタイミングで見ると同じファイルが LF に戻っていたりしました。だから CI は通るのに、ローカルの `npm run check` だけがたまに落ちる、という分かりにくい状態でした。

## 解決: LF固定 + 検証側をCRLF許容

両側から対処しました。

1. `.gitattributes` でリポジトリを LF に固定する。OneDrive が何をしても、git が保存する内容と CI は LF になります。

```text
* text=auto eol=lf
*.md   text eol=lf
```

2. 検証スクリプトを CRLF 許容にする。これで OneDrive が作業ツリーを CRLF にしても、ローカルの `npm run check` が落ちません。

```diff
- const frontMatterMatch = raw.match(/^---\n([\s\S]*?)\n---/u);
+ const frontMatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/u);
```

結果、`npm run check` は `Validated 6 article(s).` で安定しました。

## まとめ

- iPhone 執筆は **GitHub Web エディタ（Safari）** で無料・PR 完結。Git アプリ課金は要らなかった。
- GitHub 公式モバイルアプリはファイル作成不可。執筆 = Web エディタ、レビュー = 公式アプリ、と役割分担すると綺麗。
- iPhone では事前検証できないので、貼るだけで通る穴埋めテンプレを用意し、最終チェックは PR の `validate-zenn` に任せる。
- OneDrive 配下のリポジトリは CRLF churn が起きる。`.gitattributes` で LF 固定 + 検証側を CRLF 許容にすると、CI もローカルも安定する。
