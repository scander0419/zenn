---
title: "Anthropic の Dreaming を Codex で再現する：hooks でコンテキストを増やさず精度を上げる"
emoji: "🌙"
type: "tech"
topics: ["codex", "openai", "claude", "anthropic", "ai"]
published: false
---
:::message
個人の実験ログです。**全自動（人間承認なし）で記憶とフックを書き換える**構成を含み、後述のセキュリティ上のトレードオフがあります。そのまま本番や機密マシンに入れないでください。観測は **Codex CLI 0.139.0 / Codex app 26.609.71450 / Windows 11** での結果で、版が違うと挙動も変わります。
:::

[:contents]

## はじめに

Anthropic が提案している **Dreaming** を、普段使っている OpenAI Codex で再現してみました。

Dreaming は私の理解では、エージェントが空き時間（オフライン）に過去の記憶とセッション履歴を読み直し、**モデルの重みは更新せずに、記憶ストアだけを整理・統合する**仕組みです。やることは大きく4つ。

- 重複した記憶のマージ
- 矛盾の解決（新しい根拠を優先）
- 陳腐化した記憶の prune
- 繰り返し出るパターンの抽出

これを Codex で「外付け」再現するのが軸です。そこに**独自要素**として、

> **hooks を使って、コンテキスト量を増やさずに精度を上げる。**

を足しました。記憶を増やすと普通はコンテキストを食うし、プロンプトに「こうして」と書いても無視されることがあります。そこで「**汎用かつ決定的に強制できる知見は、プロンプトに載せず hook で黙って補正する**」方針にしました。

この「何を hook に寄せるか」の判断ロジックは、Code With Claude で聞いた「**これからは hooks が自動化のスケール基盤になる**」という視点を下敷きにしています。スケールするのは、決定的・コンテキスト0・合成可能なもの＝hook 向きのクラスで、判断が要るものは記憶側に残す、という切り分けです。

結論から言うと、動くものはできました。そして Codex hooks の落とし穴をほぼ全部踏みました。

## この記事でわかること

- Anthropic Dreaming を Codex で外付け再現する構成（常時参照する最小メモリ ＋ 夜間の重い統合、**人間承認なしの自動反映**）
- 独自要素：**hooks でコンテキストを増やさず精度を上げる**設計と、「何を hook にするか」の選定ロジック
- 「再 trust 地獄」を**ディスパッチャ方式**で回避し、夜間 Dreaming が hook を自律生成・自己改善する方法
- それと表裏一体の**セキュリティ上のトレードオフ**（自動生成コードが full 権限で動く問題）
- Codex hooks の実測でわかった非自明な挙動（ハマりどころ）

## Dreaming とは（前提の整理）

私の理解の範囲で書きます（一次情報は版で変わるので、概念として捉えてください）。

- オフラインの**記憶整理**であって、学習（重み更新）ではない。
- 入力は「既存の記憶ストア＋過去セッション」、出力は整理後の記憶。
- 狙いは *記憶は量が増えると質が落ちる* の防止。量を増やすのではなく、**ノイズを削って洗練させる**。

この「量を増やさず質を上げる」という思想が、後半の hooks の話ともつながります。

## 前提

- OpenAI Codex CLI 0.139.0 / Codex app 26.609.71450
- Windows 11、Codex は VSCode 拡張・CLI・アプリのいずれからも起動
- 全自動で回したいので Codex 本体は `approval_policy = "never"` / `sandbox_mode = "danger-full-access"`
- 夜間バッチ（dream runner）は **`--sandbox workspace-write`** に絞って起動（後述のセキュリティ節）
- 記憶・フックは Codex の個人設定（`~/.codex/`）とプロジェクト配下に置く

## 作ったもの

記憶側は二層に分けました。

```
#1 常時参照（最小）   グローバル ~/.codex/AGENTS.md に「索引（タイトルだけ）」と
                      「必要時に本文を読む」指示。全セッションで注入される。
                      本文は memory/<id>.md を just-in-time で読む = コンテキスト最小。

#2 夜間の統合（厚い）  毎晩 dream を起動。memory + outcomes + 直近セッション(最大100件)を
                      読み、4操作で memory.next/ に「staging」として統合。
                      検証が通ったら同じ run で memory/ と #1 の索引へ自動反映。
```

`#1` を「最小の索引」にしているのが肝で、常時ロードはタイトルだけ、本文は必要時だけ読みます。これで「記憶を増やしてもコンテキストは増えない」を実現します。

`#2` は当初「`memory.next/` を作って人間が確認してから入れ替える」設計でしたが、**全自動運用に振り切って、`memory.next/` を staging として作り→検証→同じ run で `memory/` と `~/.codex/AGENTS.md` の索引へ自動反映**するようにしました（承認待ちをなくした）。

## 独自要素：hooks でコンテキストを増やさず精度を上げる

ここが Dreaming にかぶせた今回の独自部分です。

たとえば「PowerShell が cp932 でファイルを書いてしまい文字化けする」という失敗。これを毎回プロンプトで「UTF-8 で書いてね」と注意するのは、

- 毎セッション**コンテキストを消費**する
- それでも**モデルが従うとは限らない**（精度が安定しない）

のが弱点です。代わりに、**ファイルが書かれた直後に hook が黙って UTF-8 に直す**。すると、

- プロンプトに何も足さない＝**コンテキスト0**
- 機械的に必ず直る＝**精度が決定的**

という二兎が取れます。これが「コンテキストを増やさず精度を上げる」の中身です。

### 何を hook にするか（選定ロジック）

全部を hook にはできません。基準はこの3つを**すべて**満たすもの。

1. **汎用的**（特定タスク依存でない）
2. **決定的に強制できる**（明確なトリガ＋機械的な補正手順）
3. **誤補正リスクが低い**（黙って直して安全）

エンコード補正はこれに当てはまります。逆に「この API は非推奨だから別を使え」のような**判断が要る知見**は、hook にすると誤補正が怖いので**記憶（memory）側に残す**。この切り分けが、Code With Claude の「hooks がスケールする」を実運用に落とした形です。

## 設計：プロンプト注入をやめ、黙って補正する（Design 1）

最初は「SessionStart hook で記憶の索引をモデルに注入する」案を試しましたが、これは**失敗**しました（後述のハマりどころ1）。そこで方針を変えました。

- hook は**メインエージェントのプロンプトに知識を注入しない**
- 問題が起きたら**適切なトリガで黙って補正する**
- エージェントには**戻り値を返さない**（コンテキストコスト0）
- 痕跡は監査ログにだけ残し、**翌日の dream が「その hook は効いているか」を点検**する

`approval_policy = "never"`（ゲート系 hook が無効になる。ハマりどころ2）とも相性が良く、コンテキストも汚しません。

## 実装：ディスパッチャ方式で再 trust なしに hook を増やす

今回いちばんの学びです。

Codex の hook は、**新しく登録すると一度だけ対話で trust（信頼登録）が必要**で、`codex exec` は未 trust の hook を黙ってスキップします。「夜間の dream が新しい hook を勝手に作っても、人間が trust するまで動かない」——全自動と真っ向からぶつかります。

実測すると、**trust の対象は config のエントリ単位**でした。スクリプト本体を編集しても再 trust は不要で、**config の `command` を変えたときだけ**再 trust を求められます。これを使ってこう組みました。

```
~/.codex/config.toml ──(trust 1回だけ)──▶ dispatch_posttooluse.py
                                              └─ 実行時に correctors/*.py を動的ロードして全部実行
```

- config に登録するのは**安定したディスパッチャ1個だけ**（trust も1回だけ）
- 実際の補正ロジックは `correctors/fix_encoding.py` のような**別ファイル**
- ディスパッチャは起動のたびに `correctors/` を走査して動的読み込み

config 側はこれだけ。

```toml
[[hooks.PostToolUse]]
matcher = ".*"
[[hooks.PostToolUse.hooks]]
type = "command"
command = 'python "...\\.codex\\hooks\\dispatch_posttooluse.py"'
command_windows = 'python "...\\.codex\\hooks\\dispatch_posttooluse.py"'
statusMessage = "hooks dispatcher"
timeout = 30
```

ディスパッチャの中身は概念的にこれだけ。

```python
def main():
    payload = json.loads(sys.stdin.read() or "{}")
    root = resolve_root(payload)                   # cwd / tool_input.workdir 等から作業先を解決
    audit = make_audit(root)
    for name, module in load_correctors():         # correctors/*.py を動的ロード
        try:
            module.run(payload, root, audit)        # 各 corrector が黙って補正
        except Exception as e:
            audit({"hook": name, "action": "error", "error": repr(e)})
    return 0                                         # エージェントには何も返さない
```

こうすると、**夜間の dream は `correctors/` に新しい `.py` を置くだけ**で hook を増やせます。config もディスパッチャも変えないので**再 trust は発生しません**。各 corrector は `selftest()` を実装し、dream が作成直後に起動確認、結果を人間向けの `STATUS.md` に書き出します。

さらに今回、**dream が自己改善できる範囲を広げました**。以前は `correctors/*.py` だけでしたが、今は Dreaming 管理下の `dispatch_posttooluse.py` / `hooks_status.py` / `REGISTRY.md` も自動改善対象です（変更後は `py_compile` と合成 payload で検査）。ただし**`~/.codex/config.toml` と Dreaming ルート外の hook/config は絶対に触らない**——ここが信頼境界です。夜間 runner には `--dangerously-bypass-hook-trust` を付け、hook 整備が承認待ちで止まらないようにしています。

実環境でのライブ発火も確認しました（cwd はホームだった例）。

```text
fix_encoding | scan | examined=6 | cwd=C:\Users\scand | tool=Bash
fix_encoding | skip | cwd=C:\Users\scand        ← 安全に直せないファイルは壊さず見送る
```

cp932 ファイルを書かせて、黙って UTF-8 に直る（エージェントには何も返らない）ところまで通りました。

## セキュリティのトレードオフ（重要）

この構成は便利な反面、**正直に書くと危ない**部分があります。PR の自動レビュー（Codex）でも同じ点を指摘されました。

問題はこうです。`approval_policy = "never"` / `sandbox_mode = "danger-full-access"` の環境で、夜間 dream が**再 trust なしに任意の `correctors/*.py` を生成し、それが後で full 権限で実行される**。すると、

- dream の**誤生成**（壊れた・暴走する corrector）
- **プロンプトインジェクション**された記憶やセッションログ起点の生成
- 書き込み可能なパスを経由した**汚染**

のいずれかが起きると、ユーザー権限で Python が走ります。`--dangerously-bypass-hook-trust` はその名のとおり安全弁を外す操作です。

今あるガード（実験レベル）と、本番に向けて足すべきものを分けて書きます。

**今あるもの**

- 夜間 dream runner は `--sandbox workspace-write` に絞って起動（dream 自身の書き込み範囲を限定）
- corrector は活性化前に `selftest` / `py_compile` を通す
- 全発火を中央監査ログ＋ `STATUS.md` に残し、人間が後から点検できる
- 信頼境界を固定（`~/.codex/config.toml` と Dreaming 外は触らない）

**本番に向けて足すべき（未実装）**

- 生成 corrector の**人間レビュー or allowlist or 署名**を活性化のゲートにする
- corrector の実行を**もっと狭いサンドボックス**に閉じる
- 機密マシンでは `--dangerously-bypass-hook-trust` を**使わない**

つまり現状は「全自動の気持ちよさ」と「自己生成コードを信頼してよいのか」を引き換えにしています。**実験としては面白いが、そのまま勧められる形ではない**——ここは強調しておきます。

## ハマりどころ

Codex hooks を触る人の地雷回避にどうぞ。

### 1. SessionStart hook の `additionalContext` はモデルに届かない

hook の**コマンド自体は実行される**のに、返した `additionalContext` がモデルに渡りませんでした（exec / 対話の両方で、エージェントは注入内容を「NONE」と回答）。「起動時に記憶の索引を注入する」案はこれで頓挫。**常時注入は素直に `AGENTS.md` 経由**に。

### 2. `approval_policy = "never"` はゲート系 hook を無効化する

PreToolUse / PermissionRequest のような**承認パイプラインに乗る hook は `never` だと発火しません**。一方 **PostToolUse のような非ゲート hook は `never` でも発火**します。「ツール実行後に黙って補正」を選んだ理由です。

### 3. hook trust はスクリプトではなく config エントリ単位

スクリプトをいくら直しても再 trust は要らず、`command` を変えた瞬間に要求されます。ディスパッチャ方式が成立する根拠でもあります。

### 4. `command` は配列ではなく文字列

最初こう書いて config 全体が読めなくなりました。

```toml
command = ["python", "...script.py"]   # ✗
```

```text
Error loading config.toml: invalid type: sequence, expected a string in `hooks`
```

正しくは文字列。Windows は `command_windows` で上書き。`timeout` は秒（公式例も `timeout = 30`）。

```toml
command = 'python "...script.py"'      # ○
```

### 5. Windows サンドボックスの初期化失敗（hook と無関係だった）

作業中に突然これが出て Codex が起動しなくなりました。

```text
非管理者用サンドボックスを設定できませんでした
続行するには、セットアップを再試行してください
```

切り分けると **Codex アプリの自動アップデート後**に起きた既知の Windows サンドボックス問題で、`[windows] sandbox = "elevated"`（管理者昇格が要る）が失敗していました。**`unelevated` に切り替えて回避**。

```toml
[windows]
sandbox = "unelevated"   # elevated から変更（管理者昇格不要の公式フォールバック）
```

hook を疑って無駄に往復したので、「直前に触った場所」と「実際の原因レイヤー」は分けて切り分けるべきでした。

### 6. 監査ログの cwd ずれ（payload の作業先解決）

hook は受け取った作業先を基準に動きますが、payload のどのキーに作業ディレクトリが入るかは状況で変わります。`cwd` だけ見ているとズレるので、**`cwd` / `workdir` / `working_dir` や `tool_input.workdir` などを順に解決**するようにしました。さらに、補正対象はセッションの作業先依存でも、**監査ログだけは固定の中央パスに集約**して、夜間 dream が一箇所を読めばよいようにしています。

## 使ってみた感想

実験ベースの率直な所感です。

- **「黙って直す hook」は体験が良い。** プロンプトに注意書きを積むより、問題を機械的に消す方がコンテキストもクリーンで出力もぶれません。`approval_policy = "never"` の全自動運用と特に相性が良い。
- **ディスパッチャ方式は効く。** 「trust は config 単位／スクリプト変更は自由」に乗ると、自動生成 hook を再 trust なしで増やせます。ここがいちばん「hooks がスケールする」を実感した部分。
- **全自動の自動反映は気持ちいいが怖い。** memory も hook も人間承認なしで書き換わるのは速い反面、上のセキュリティ節のとおり信頼の問題が常につきまといます。
- **hook 化できる範囲は思ったより狭い。** 「汎用＋決定的＋誤補正リスク低」を満たすものだけ。判断依存は memory に残すのが妥当でした。
- **クロスツールでやる意義。** 「Anthropic の概念（Dreaming）を OpenAI Codex で再現する」は遠回りに見えて、記憶設計と hook 設計を一段抽象化して考える良い訓練になりました。

## まとめ

- 軸は **Anthropic Dreaming の外付け再現**：常時参照する最小索引 ＋ 夜間の重い統合（人間承認なしの自動反映）。
- 独自要素は **hooks でコンテキストを増やさず精度を上げる**こと。プロンプト注入ではなく**黙って補正して戻り値を返さない**（Design 1）。
- 「何を hook にするか」は **汎用＋決定的＋誤補正リスク低**で選ぶ。判断依存は memory へ。これが Code With Claude の「hooks がスケールする」を実装に落とした形。
- **trust は config 単位**を使い、**ディスパッチャ＋動的ロード**で再 trust なしに hook を増やし、夜間 Dreaming が自己改善する。
- ただしそれは **自己生成コードを full 権限で信頼すること**と引き換え。実験としては有効だが、本番にはレビュー/allowlist/署名/狭いサンドボックスのゲートが要る。

同じく Codex の hooks を触っている人、記憶の整理をエージェントにやらせたい人の参考になれば。間違いやもっと良いやり方があればコメントで教えてください。
