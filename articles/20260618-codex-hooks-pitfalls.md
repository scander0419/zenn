---
title: "Codex hooks のハマりどころ6つと「再trust地獄」の回避"
emoji: "🪝"
type: "tech"
topics: ["codex", "openai", "windows", "ai"]
published: false
---
:::message
個人の実験ログです。OpenAI Codex の hooks は版による挙動差が大きく、観測は **Codex CLI 0.139.0 / Codex app 26.609.71450 / Windows 11** での結果です。版が違うと挙動も変わります。
:::

[:contents]

## はじめに

OpenAI Codex の hooks を自動化に使おうとして、想像以上に落とし穴を踏みました。この記事はその**ハマりどころ集**です。`additionalContext` がモデルに届かない、`approval_policy="never"` でゲート系 hook が無効になる、trust の単位が直感と違う——といった、ドキュメントだけだと気づきにくい点を、実際のエラー文つきでまとめます。

背景として「Anthropic の Dreaming を Codex で再現する」過程で触り倒したのですが、Dreaming 本編は別記事にしました。この記事は **Codex hooks 単体の知見**として読めます。

## この記事でわかること

- Codex hooks の非自明な挙動6つ（実測）
- 新しい hook を増やすたびの「再 trust 地獄」を**ディスパッチャ方式**で回避する方法
- 全自動運用と表裏一体の**セキュリティ上のトレードオフ**

## 前提

- OpenAI Codex CLI 0.139.0 / Codex app 26.609.71450
- Windows 11、Codex は VSCode 拡張・CLI・アプリのいずれからも起動
- 全自動寄りの設定（`approval_policy = "never"` など）で検証

## ハマりどころ

### 1. SessionStart hook の `additionalContext` はモデルに届かない

「起動時にコンテキストを注入する」典型用途として SessionStart hook を試しました。結果、**コマンド自体は実行される**のに、返した `additionalContext` がモデルに渡りませんでした（exec / 対話の両方で、エージェントは注入内容を「NONE」と回答。`--json` イベントにも hook 由来の context は出ない）。trust 済みでも同じ。

→ 起動時の常時注入を hook でやるのは諦め、`AGENTS.md` に直書きする方式（毎セッション確実に注入される）に切り替えました。

### 2. `approval_policy = "never"` はゲート系 hook を無効化する

`PreToolUse` / `PermissionRequest` のような**承認パイプラインに乗る hook は `never` だと発火しません**。`untrusted` などゲートが有効な設定にすると、同じ hook が発火してツールをブロックし、deny 理由までエージェントに渡りました。

一方で **`PostToolUse` のような非ゲート hook は `never` でも発火**します。「ツール実行後に黙って何かする」用途を選ぶならこちら。

### 3. hook trust はスクリプトではなく config エントリ単位

新しい hook は**一度だけ対話で trust（信頼登録）**が必要で、`codex exec` は未 trust の hook を黙ってスキップします。ここで実測すると、**trust の対象は config のエントリ**でした。

- hook スクリプトの中身を編集しても**再 trust は不要**
- config の `command` を変えた瞬間に**再 trust を要求**

この性質が、後述のディスパッチャ方式の土台になります。

### 4. `command` は配列ではなく文字列

直感で配列にすると、config 全体が読み込めなくなります。

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

### 5. Windows サンドボックスの初期化失敗（hook と無関係なのに紛らわしい）

hook をいじっている最中に突然これが出て、Codex が起動しなくなりました。

```text
非管理者用サンドボックスを設定できませんでした
続行するには、セットアップを再試行してください
```

切り分けると **Codex アプリの自動アップデート後**に起きた既知の Windows サンドボックス問題で、`[windows] sandbox = "elevated"`（管理者昇格が必要）の初期化失敗でした。hook とは別レイヤー。

```toml
[windows]
sandbox = "unelevated"   # elevated から変更（管理者昇格不要の公式フォールバック）
```

教訓：「直前に触った場所」と「実際の原因レイヤー」は分けて切り分ける。hook を疑って無駄に往復しました。

### 6. payload の作業ディレクトリ解決（cwd だけ見るとズレる）

hook には JSON payload が stdin で渡りますが、**作業ディレクトリがどのキーに入るかは状況で変わります**。`cwd` だけ見ているとズレるので、`cwd` / `workdir` / `working_dir` や `tool_input.workdir` などを順に解決するようにしました。

```python
def resolve_root(payload):
    keys = ("cwd", "workdir", "working_dir", "workingDirectory")
    for k in keys:
        v = payload.get(k)
        if isinstance(v, str) and v and Path(v).is_dir():
            return Path(v).resolve()
    for c in (payload.get("tool_input"), payload.get("input"), payload.get("arguments")):
        if isinstance(c, dict):
            for k in keys:
                v = c.get(k)
                if isinstance(v, str) and v and Path(v).is_dir():
                    return Path(v).resolve()
    return Path.cwd().resolve()
```

## 「再 trust 地獄」をディスパッチャ方式で回避する

ハマりどころ3の裏返しで、**hook を増やすたびに対話 trust が要る**と、自動化（夜間バッチが hook を作る等）が成立しません。そこで trust の性質を逆手に取ります。

```
~/.codex/config.toml ──(trust 1回だけ)──▶ dispatch_posttooluse.py
                                              └─ 実行時に correctors/*.py を動的ロードして全部実行
```

- config に登録するのは**安定したディスパッチャ1個だけ**（trust も1回だけ）
- 実際のロジックは `correctors/*.py` という**別ファイル**に置く
- ディスパッチャは起動のたびに `correctors/` を走査して動的読み込み

ディスパッチャの中身は概念的にこれだけ。

```python
def main():
    payload = json.loads(sys.stdin.read() or "{}")
    root = resolve_root(payload)
    audit = make_audit(root)
    for name, module in load_correctors():      # correctors/*.py を動的ロード
        try:
            module.run(payload, root, audit)
        except Exception as e:
            audit({"hook": name, "action": "error", "error": repr(e)})
    return 0                                      # エージェントには何も返さない
```

これで **`correctors/` に `.py` を置くだけ**で hook を増やせます。config もディスパッチャも変えないので**再 trust は発生しません**。各 corrector に `selftest()` を持たせ、追加直後に起動確認すれば、壊れたものを動かさずに済みます。

## セキュリティのトレードオフ（重要）

便利な反面、これは**正直に書くと危ない**仕組みです。

ディスパッチャは `correctors/*.py` を**動的に読み込んで実行**します。つまり**そこに `.py` を書ける経路があれば、次のツール実行であなたのユーザー権限で任意コードが走り得ます**。`approval_policy="never"` / `sandbox_mode="danger-full-access"` / `--dangerously-bypass-hook-trust` を足すほど、安全弁が外れます。

想定すべきリスク：

- 自動生成スクリプトの**誤生成**（壊れた／暴走するコード）
- 記憶やセッションログ起点の**プロンプトインジェクション**による生成
- 書き込み可能パス経由の `correctors/` の**汚染**

緩和の方向性：

- 生成物の**人間レビュー / allowlist / 署名**を活性化のゲートにする
- 実行を**より狭いサンドボックス**に閉じる
- バッチ runner の sandbox を絞る（例：`workspace-write`）、活動を監査ログに残して後から点検できるようにする
- 機密マシンでは `--dangerously-bypass-hook-trust` を**使わない**

つまり「自動化の気持ちよさ」と「自己生成コードをどこまで信頼するか」を引き換えにしています。実験としては面白いですが、**そのまま本番や機密マシンに入れる形ではありません**。

## まとめ

- SessionStart の `additionalContext` は（この版では）モデルに届かない。常時注入は AGENTS.md 経由が確実。
- `approval_policy="never"` はゲート系 hook を無効化、`PostToolUse` は発火する。
- **hook trust は config エントリ単位**。スクリプト変更は自由、`command` 変更で要 trust。
- これを使った**ディスパッチャ＋動的ロード**で、再 trust なしに hook を増やせる。
- ただし**自己生成コードを実行する設計**なので、レビュー/allowlist/署名/狭いサンドボックスのゲートを足してから使うこと。

`command` は文字列、`timeout` は秒、Windows サンドボックスの初期化失敗は別レイヤー——細かいですが、どれも一度はハマる地雷でした。同じところで詰まっている人の役に立てば。
