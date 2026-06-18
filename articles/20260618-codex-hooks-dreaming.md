---
title: "Anthropic の Dreaming を Codex で再現する：hooks でコンテキストを増やさず精度を上げる"
emoji: "🌙"
type: "tech"
topics: ["codex", "openai", "claude", "anthropic", "ai"]
published: true
---
:::message
個人の実験ログです。**全自動（人間承認なし）で記憶とフックを書き換える**構成を含みます。観測は **Codex CLI 0.139.0 / Codex app 26.609.71450 / Windows 11** での結果で、版が違うと挙動も変わります。
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

この記事は **Dreaming の工夫点と実装**に絞ります。実装中に踏んだ **Codex hooks 自体の落とし穴**（SessionStart が届かない、`never` でゲート hook が無効、trust の単位、Windows サンドボックス等）は、別記事『Codex hooks のハマりどころ6つと「再trust地獄」の回避』に切り出しました。

## この記事でわかること

- Anthropic Dreaming を Codex で外付け再現する構成（常時参照する最小メモリ ＋ 夜間の重い統合、**人間承認なしの自動反映**）
- 独自要素：**hooks でコンテキストを増やさず精度を上げる**設計と、「何を hook にするか」の選定ロジック
- 夜間 Dreaming が hook を自律生成・自己改善する仕組み（再 trust なしで増やす）

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
- 夜間バッチ（dream runner）は **`--sandbox workspace-write`** に絞って起動
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

最初は「SessionStart hook で記憶の索引をモデルに注入する」案を試しましたが、これは失敗しました（この版の Codex では注入がモデルに届かない。詳細は別記事）。そこで方針を変えました。

- hook は**メインエージェントのプロンプトに知識を注入しない**
- 問題が起きたら**適切なトリガで黙って補正する**
- エージェントには**戻り値を返さない**（コンテキストコスト0）
- 痕跡は監査ログにだけ残し、**翌日の dream が「その hook は効いているか」を点検**する

`approval_policy = "never"`（この設定ではゲート系 hook が無効になる。`PostToolUse` は発火する）とも相性が良く、コンテキストも汚しません。

## 実装：夜間 Dreaming が hook を自律生成する

「黙って補正する hook」を、夜間 dream が自分で増やせるようにしました。ここで効いたのが**ディスパッチャ方式**です。

Codex の hook は新規登録に一度きりの trust が要りますが、**trust の対象は config のエントリ単位**で、スクリプト本体を変えても再 trust は不要でした（この trust 挙動の詳細は別記事）。そこで、

```
~/.codex/config.toml ──(trust 1回だけ)──▶ dispatch_posttooluse.py
                                              └─ 実行時に correctors/*.py を動的ロードして全部実行
```

- config に登録するのは**安定したディスパッチャ1個だけ**（trust も1回だけ）
- 実際の補正ロジックは `correctors/fix_encoding.py` のような**別ファイル**
- ディスパッチャは起動のたびに `correctors/` を走査して動的読み込み

ディスパッチャの中身は概念的にこれだけ。

```python
def main():
    payload = json.loads(sys.stdin.read() or "{}")
    root = resolve_root(payload)                   # 作業ディレクトリを解決
    audit = make_audit(root)
    for name, module in load_correctors():         # correctors/*.py を動的ロード
        try:
            module.run(payload, root, audit)        # 各 corrector が黙って補正
        except Exception as e:
            audit({"hook": name, "action": "error", "error": repr(e)})
    return 0                                         # エージェントには何も返さない
```

こうすると、**夜間の dream は `correctors/` に新しい `.py` を置くだけ**で hook を増やせます。config もディスパッチャも変えないので**再 trust は発生しません**。各 corrector は `selftest()` を実装し、dream が作成直後に起動確認、結果を人間向けの `STATUS.md` に書き出します。実際に cp932 ファイルを書かせて、黙って UTF-8 に直る（エージェントには何も返らない）ところまでライブで確認しました。

さらに、**dream が自己改善できる範囲を広げました**。`correctors/*.py` に加え、Dreaming 管理下の `dispatch_posttooluse.py` / `hooks_status.py` / `REGISTRY.md` も自動改善対象です（変更後は `py_compile` と合成 payload で検査）。ただし**`~/.codex/config.toml` と Dreaming ルート外の hook/config は絶対に触らない**——ここが信頼境界です。夜間 runner には `--dangerously-bypass-hook-trust` を付け、hook 整備が承認待ちで止まらないようにしています。

## 毎晩動かす：Codex Automations

`#2`（夜間 dream）は、Codex アプリの **Automations**（スケジュール実行）で毎晩回しています。ここまでの「記憶の自動統合」「hook の自律生成・自己改善」を、人間が何もしなくても毎晩走らせている実体がこれです。

設定はだいたい次のようにしました（UI ラベルは変わりうるので公式で要確認）。

- **スケジュール**：daily（例：`30 23 * * *`）。母艦 PC が起動して Codex アプリが動いている時刻に。ローカル実行。
- **実行場所**：プロジェクトを**直接更新**。worktree は使わない（全自動適用した `memory/` が canonical な本文パスへ届かないため）。
- **Sandbox / Approval**：`workspace-write`、approval は挟まない（可能なら `approval_policy="never"`）。full access は不要。
- **プロンプト**：`automations/dream.md` を読んで実行させるだけ（4操作＋フック監査＋自動反映を内部で指示）。

ポイントは **approve 待ちを一切作らない**こと。`dream` が `memory.next/` を staging として検証し、問題なければ同じ run で `memory/` とグローバル索引へ反映し、`STATUS.md` まで更新して終わります。スケジュール前に通常スレッドで1回手動実行して、レポートと反映結果を確認してから有効化するのがおすすめです（自前 cron / Task Scheduler から `scripts/run-dream.*` を叩く形でも可）。

## 全自動の代償（安全性）

この構成は便利な反面、正直に書くと危ない側面があります。memory も hook も**人間承認なしで書き換わり**、しかもディスパッチャは `correctors/*.py` を**動的に実行**します。`approval_policy="never"` / `danger-full-access` / `--dangerously-bypass-hook-trust` と組み合わせると、誤生成やプロンプトインジェクション起点の生成が、ユーザー権限で実行され得ます。

このリポジトリにある緩和は実験レベルです（runner の sandbox を `workspace-write` に絞る、`selftest`/`py_compile` を通す、全活動を監査ログ＋ `STATUS.md` に残す、信頼境界を固定）。本番に向けては、生成物のレビュー / allowlist / 署名や、より狭いサンドボックスをゲートに足すべきです。**そのまま機密マシンに入れる形ではありません。** hook 側のリスクの詳細は別記事のセキュリティ節にまとめました。

## 使ってみた感想

実験ベースの率直な所感です。

- **「黙って直す hook」は体験が良い。** プロンプトに注意書きを積むより、問題を機械的に消す方がコンテキストもクリーンで出力もぶれません。全自動運用と特に相性が良い。
- **記憶の自動反映は速いが怖い。** memory も hook も人間承認なしで書き換わるのは速い反面、上の安全性のとおり「自己生成物をどこまで信頼するか」が常につきまといます。
- **hook 化できる範囲は思ったより狭い。** 「汎用＋決定的＋誤補正リスク低」を満たすものだけ。判断依存は memory に残すのが妥当でした。
- **クロスツールでやる意義。** 「Anthropic の概念（Dreaming）を OpenAI Codex で再現する」は遠回りに見えて、記憶設計と hook 設計を一段抽象化して考える良い訓練になりました。

## すぐ試せるようにした（GitHub）

この記事で書いた最小セットを、すぐ試せる形でまとめて公開しました。

https://github.com/scander0419/codex-dreaming

- `config.example.toml`（PostToolUse hook の登録）と `AGENTS.example.md`（#1 索引）をコピーして使う
- `.codex/hooks/`（ディスパッチャ＋サンプル corrector＋`hooks_status.py`）、`automations/dream.md` / `grade.md`、`memory/`、`outcomes/schema.json`、`scripts/run-dream.*` を同梱
- `AUTOMATION-SETUP.md` に **Codex Automations の設定手順と貼り付け用プロンプト**も入れてあります
- 個人パスは除去済み（監査ログの出力先は `CODEX_DREAMING_AUDIT` で上書き可）

ただし**全自動モードは自己生成コードを full 権限で実行する設計**なので、必ずリポジトリの `SECURITY.md` を読んでから、隔離環境で試してください。機密マシンには入れないこと。

## 関連記事

- [Codex hooks のハマりどころ6つと「再trust地獄」の回避](https://zenn.dev/kakecake/articles/20260618-codex-hooks-pitfalls) ── 本記事で使った Codex hooks 自体の落とし穴・詰まった点はこちらにまとめました。

## まとめ

- 軸は **Anthropic Dreaming の外付け再現**：常時参照する最小索引 ＋ 夜間の重い統合（人間承認なしの自動反映）。
- 独自要素は **hooks でコンテキストを増やさず精度を上げる**こと。プロンプト注入ではなく**黙って補正して戻り値を返さない**（Design 1）。
- 「何を hook にするか」は **汎用＋決定的＋誤補正リスク低**で選ぶ。判断依存は memory へ。これが Code With Claude の「hooks がスケールする」を実装に落とした形。
- **ディスパッチャ＋動的ロード**で再 trust なしに hook を増やし、夜間 Dreaming が自己改善する。
- ただしそれは **自己生成コードを信頼すること**と引き換え。実験としては有効だが、本番にはレビュー/allowlist/署名/狭いサンドボックスのゲートが要る。

記憶の整理をエージェントにやらせたい人の参考になれば。間違いやもっと良いやり方があればコメントで教えてください。
