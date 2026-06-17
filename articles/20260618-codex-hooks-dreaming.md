---
title: "Codexのhooksで Anthropic Dreaming を再現する：自律補正フックの実験ログ"
emoji: "📝"
type: "tech"
topics: ["codex", "openai", "claude", "anthropic", "ai"]
published: false
---
:::message
この記事は個人の実験ログです。OpenAI Codex の hooks は版による挙動差が大きく、ここでの観測は **Codex CLI 0.139.0 / Codex app 26.609.71450 / Windows 11** での結果です。あなたの環境では違う可能性があります。
:::

[:contents]

## はじめに

Code With Claude で「これからは hooks がスケールの鍵になる」という趣旨の話を聞いて、自分の普段の環境（実は OpenAI Codex）でも hooks に寄せた仕組みを作れないか、と思ったのがきっかけです。

題材に選んだのは Anthropic が提案している **Dreaming**。私の理解では、エージェントが空き時間（オフライン）に過去の記憶とセッション履歴を読み直し、**重みは更新せずに記憶ストアだけを整理・統合する**仕組みです。具体的には次の4操作をやると理解しています。

- 重複した記憶のマージ
- 矛盾の解決（新しい根拠を優先）
- 陳腐化した記憶の prune
- 繰り返し出るパターンの抽出

これを Codex で「外付け」再現しつつ、**改善できるものはできるだけ hooks に寄せる**——というのが今回のゴールです。結論から言うと、動くものはできました。そして hooks の落とし穴をほぼ全部踏みました。

## この記事でわかること

- Anthropic Dreaming を Codex で外付け再現するときの構成（常時参照する最小メモリ ＋ 夜間の重い統合）
- 「知識をプロンプトに注入する」のではなく「**問題を黙って補正する hook**」という設計（本記事ではこれを Design 1 と呼ぶ）
- Codex hooks の実測でわかった非自明な挙動（**ここが本題**）
- 新しい hook を増やすたびに発生する「再 trust 地獄」を**ディスパッチャ方式**で回避する方法
- 実験してみた率直な感想と、まだ詰めきれていない点

## 前提

- OpenAI Codex CLI 0.139.0 / Codex app 26.609.71450
- Windows 11、Codex は VSCode 拡張・CLI・アプリのいずれからも起動
- 全自動で回したいので `approval_policy = "never"` / `sandbox_mode = "danger-full-access"`
- 記憶やフックは Codex の個人設定（`~/.codex/`）とプロジェクト配下に置く

## 作ったもの

二層に分けました。

```
#1 常時参照（最小）   グローバル ~/.codex/AGENTS.md に「索引（タイトルだけ）」と
                      「必要時に本文を読む」指示。全セッションで注入される。
                      本文は memory/<id>.md を just-in-time で読む = コンテキスト最小。

#2 夜間の統合（厚い）  Codex Automations で毎晩 dream を起動。
                      memory + outcomes + 直近セッション(最大100件)を読み、
                      4操作で memory.next/ に統合（元の memory/ は壊さない）。
```

`#1` を「最小の索引」にしているのがポイントで、Dreaming の論点である *記憶は量が増えると質が落ちる* に対して、常時ロードするのはタイトルだけにして肥大を防ぎます。

そしてもう一段、**hooks 寄せ**を入れました。

> 改善できる知見のうち「**汎用 ＋ 決定的に強制できる**」ものは hook 化し、判断が要るものだけ memory に残す。

例えば「PowerShell が cp932 でファイルを書いてしまい文字化けする」という失敗は、毎回プロンプトで「UTF-8 で書いてね」と注意するより、**書かれた直後に黙って UTF-8 へ直す hook** にした方が確実でコンテキストも食いません。

## 設計：なぜプロンプト注入をやめたか（Design 1）

最初は「SessionStart hook で記憶の索引をモデルに注入する」案を試しました。これは**失敗**します（後述）。そこで方針を変えました。

- hook は**メインエージェントのプロンプトに知識を注入しない**
- 代わりに、問題が起きたら**適切なトリガで黙って補正する**
- エージェントには**戻り値を返さない**（コンテキストコスト0）
- 何が起きたかは監査ログにだけ残し、**翌日の dream が「その hook は効いているか」を点検**する

この方針なら、`approval_policy = "never"`（ゲート系 hook が無効になる。後述）とも相性が良く、コンテキストも汚しません。

## 実装：ディスパッチャ方式で「再trust地獄」を回避

ここが今回いちばんの学びでした。

Codex の hook は、**新しく登録すると一度だけ対話で trust（信頼登録）が必要**です。`codex exec` は未 trust の hook を黙ってスキップします。つまり「夜間の dream が新しい hook を勝手に作っても、人間が trust するまで動かない」。これは「全自動で hook を増やしたい」という目的と真っ向からぶつかります。

ところが実測すると、**trust の対象は config のエントリ単位**でした。スクリプト本体を編集しても再 trust は不要で、**config の `command` を変えたときだけ**再 trust を求められます。

これを利用して、構成をこうしました。

```
~/.codex/config.toml ──(trust 1回だけ)──▶ dispatch_posttooluse.py
                                              └─ 実行時に correctors/*.py を動的ロードして全部実行
```

- config に登録するのは**安定したディスパッチャ1個だけ**（trust も1回だけ）
- 実際の補正ロジックは `correctors/fix_encoding.py` のような**別ファイル**
- ディスパッチャは起動のたびに `correctors/` を走査して動的に読み込む

config 側はこれだけです。

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

ディスパッチャの中身は概念的にはこれだけ。

```python
def main():
    payload = json.loads(sys.stdin.read() or "{}")
    root = Path(payload.get("cwd") or Path.cwd())
    audit = make_audit(root)
    for name, module in load_correctors():        # correctors/*.py を動的ロード
        try:
            module.run(payload, root, audit)       # 各 corrector が黙って補正
        except Exception as e:
            audit({"hook": name, "action": "error", "error": repr(e)})
    return 0                                        # エージェントには何も返さない
```

こうすると、**夜間の dream は `correctors/` に新しい `.py` を置くだけ**で hook を増やせます。config もディスパッチャも変えないので、**再 trust は一切発生しません**。各 corrector は `selftest()` を実装させ、dream が作成直後に起動確認し、結果を人間向けの `STATUS.md` に書き出します。

実環境でのライブ発火も確認しました（cwd はホームだったので、そこを走査した記録）。

```text
fix_encoding | scan | examined=6 | cwd=C:\Users\scand | tool=Bash
fix_encoding | skip | cwd=C:\Users\scand        ← 安全に直せないファイルは壊さず見送る
```

cp932 ファイルを書かせて、黙って UTF-8 に直る（エージェントには何も返らない）ところまで通りました。

## ハマりどころ

ここが本記事の主目的です。Codex hooks を触る人の地雷回避に使ってください。

### 1. SessionStart hook の `additionalContext` はモデルに届かない

hook の**コマンド自体は実行される**のに、返した `additionalContext` がモデルに渡りませんでした（exec / 対話の両方で、エージェントは注入内容を「NONE」と回答）。「起動時に記憶の索引を注入する」案はこれで頓挫。**常時注入は素直に `AGENTS.md` 経由**にしました。

### 2. `approval_policy = "never"` はゲート系 hook を無効化する

PreToolUse / PermissionRequest のような**承認パイプラインに乗る hook は `never` だと発火しません**。一方で **PostToolUse のような非ゲート hook は `never` でも発火**します。「ツール実行後に黙って補正」を選んだのはこれが理由です。

### 3. hook trust はスクリプトではなく config エントリ単位

前述のとおり。スクリプトをいくら直しても再 trust は要らず、`command` を変えた瞬間に要求されます。ディスパッチャ方式が成立する根拠でもあります。

### 4. `command` は配列ではなく文字列

最初こう書いて、config 全体が読み込めなくなりました。

```toml
command = ["python", "...script.py"]   # ✗
```

```text
Error loading config.toml: invalid type: sequence, expected a string in `hooks`
```

正しくは文字列。Windows は `command_windows` で上書きできます。`timeout` は秒（公式例も `timeout = 30`）。

```toml
command = 'python "...script.py"'      # ○
```

### 5. Windows サンドボックスの初期化失敗（これは hook と無関係だった）

作業中に突然これが出て Codex が起動しなくなりました。

```text
非管理者用サンドボックスを設定できませんでした
続行するには、セットアップを再試行してください
```

切り分けたら **Codex アプリの自動アップデート後**に起きた既知の Windows サンドボックス問題で、`[windows] sandbox = "elevated"`（管理者昇格が要る）が失敗していました。**`unelevated` に切り替えて回避**。

```toml
[windows]
sandbox = "unelevated"   # elevated から変更（管理者昇格不要の公式フォールバック）
```

hook を疑って無駄に往復したので、「直前に触った場所」と「実際の原因レイヤー」は分けて切り分けるべきでした。

### 6. 監査ログは「セッションの cwd」に書かれる

hook は受け取った `cwd` を基準に動くので、補正対象も監査ログの出力先もセッションの作業フォルダ依存になります。プロジェクトをまたいで発火するため、**監査ログだけは固定の中央パスに集約**して、夜間の dream が一箇所を読めばよいようにしました。

## 使ってみた感想

正直な実験ベースの所感です。

- **「黙って直す hook」は体験が良い。** プロンプトに注意書きを積むより、問題を機械的に消す方がコンテキストもクリーンで、エージェントの出力もぶれません。`approval_policy = "never"` の全自動運用と特に相性が良いです。
- **ディスパッチャ方式は効く。** 「trust は config 単位／スクリプト変更は自由」という性質に乗ると、自動生成した hook を再 trust なしで増やせます。ここが今回いちばん「hooks がスケールする」を実感した部分でした。
- **hook 化できる範囲は思ったより狭い。** 「汎用 ＋ 決定的に強制できる」を満たすものだけが hook 向き。エンコード補正はハマりますが、判断が要る知見（例：「この API は非推奨」）は hook にすると誤補正が怖いので memory 側に残すのが妥当でした。
- **まだ詰めきれていない点。** 夜間 dream による hook の自律生成・棚卸しはロジックを組んで selftest まで通しましたが、**長期運用での誤生成・誤 prune の挙動はこれから**です。また各観測は特定の版での結果なので、版が上がれば前提が崩れます。
- **クロスツールでやる意義。** 「Anthropic の概念（Dreaming）を OpenAI Codex で再現する」は遠回りに見えて、記憶設計と hook 設計を一段抽象化して考える良い訓練になりました。

## まとめ

- Anthropic Dreaming を Codex で「常時参照する最小索引 ＋ 夜間の重い統合」として外付け再現した。
- 改善知見は「汎用 ＋ 決定的」なものだけ hook 化し、判断依存は memory に残す切り分けにした。
- hook は**プロンプト注入ではなく、黙って補正して戻り値を返さない**設計（Design 1）が、全自動運用とコンテキスト効率の両面で良かった。
- **trust は config 単位**という性質を使い、**ディスパッチャ＋動的ロード**で「再 trust なしに hook を増やせる」構成にした。これが hooks をスケールさせる肝だった。
- ただしこれは実験段階。版依存・長期運用の検証はこれから。

同じく Codex の hooks を触っている人、あるいは「記憶の整理」をエージェントにやらせたい人の参考になれば。間違いや、もっと良いやり方があればコメントで教えてください。
