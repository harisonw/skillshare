---
sidebar_position: 1
---

# target

同期 Target（AI CLI の Skill ディレクトリ）を管理します。

```bash
skillshare target add <name> <path>    # Target を追加
skillshare target remove <name>        # Target を削除
skillshare target list                 # すべての Target を一覧表示
skillshare target <name>               # Target の情報を表示
skillshare target <name> --mode merge  # sync モードを変更
skillshare target <name> --target-naming standard  # 命名方式を変更
```

## 使うタイミング

- 新しい AI CLI ツールをインストールした後に新しい Target を追加する
- 使わなくなった Target を削除する
- Target の sync モード（merge、copy、または symlink）を変更する
- Target の命名方式（flat または standard）を変更する
- 1 つのグローバルモードを強制するのではなく、Target ごとに互換性を調整する
- 選択的な Skill 同期のための include/exclude フィルタを設定する

## サブコマンド

### target add

Skill 同期のための新しい Target を追加します。

```bash
skillshare target add windsurf ~/.windsurf/skills
```

このコマンドは以下を検証します。
- パスが存在するか、親ディレクトリが存在すること
- パスが Skill ディレクトリらしいこと
- Target 名が一意であること

#### Agent の別のアカウント {#another-account}

Agent の 2 つ目のアカウントを専用の config ディレクトリで動かしている場合（例: Claude Code を `CLAUDE_CONFIG_DIR=~/.claude-work` で、Codex を `CODEX_HOME` で、Pi を `PI_CODING_AGENT_DIR` で起動している場合）、そのディレクトリを Target として追加します。Skillshare はそこから skills と agents のパスを導き出します。

```bash
skillshare target add claude-work --agent claude --config-dir ~/.claude-work
# Added target: claude-work -> ~/.claude-work/skills
```

アカウントの数だけ、それぞれ別の名前で追加できます。この名前は [MCP Target](./mcp.md#accounts) としても使えるため、1 回の sync ですべてのアカウントの Skill、Agent、MCP サーバーに反映されます。

`--agent` は `claude`（`CLAUDE_CONFIG_DIR`）、`codex`（`CODEX_HOME`）、`pi`（`PI_CODING_AGENT_DIR`）を受け付けます。Codex や Pi のアカウントは Skill を `<config_dir>/skills` に sync します。agents ディレクトリを持つのは Claude だけです。ディレクトリは絶対パスか `~` で始まる必要があり、Agent のデフォルトのディレクトリであってはならず、2 つの Target で共有することもできません。

この種の Target の削除が MCP を理由に失敗することはありません。`mcp.targets` やサーバーの `targets` にまだその名前が残っていても、`skillshare target remove` は Target を削除し、そちらからも名前を取り除くよう警告します。

### target remove

Target を削除し、その Skill を通常のディレクトリに復元します。

```bash
skillshare target remove cursor           # 単一の Target を削除
skillshare target remove --all            # すべての Target を削除
skillshare target remove cursor --dry-run # プレビュー
```

**実行される内容:**
1. Target のバックアップを作成
2. sync モードを検出:
   - **Symlink モード:** ディレクトリのシンボリックリンクを削除し、source の内容を実ディレクトリとしてコピーし直す
   - **Merge モード:** source を指すシンボリックリンクのみを（パスのプレフィックスで）削除し、各 Skill を実ファイルとしてコピーし直す。ローカル（非シンボリックリンク）の Skill は保持される
   - **Copy モード:** `.skillshare-manifest.json` を削除する。管理対象のコピーとローカルの Skill は通常のディレクトリとして保持される
3. Target を config から削除

同じ skills フォルダーに書き込む別の Target がある場合（たとえば `codex` と `universal` はどちらも `~/.agents/skills` を使う）、手順 2 はスキップされます。skills はその Target 用にリンクされたまま残り、削除した Target だけが config から外れます。

### target list

設定済みのすべての Target を一覧表示します。

```bash
skillshare target list                 # インタラクティブ TUI（TTY 上のデフォルト）
skillshare target list --no-tui        # プレーンテキスト出力
skillshare target list --json          # CI／スクリプト向けの JSON 出力
```

#### インタラクティブ TUI

TTY 上では、`target list` は以下を備えたインタラクティブなターミナル UI を起動します。

- **分割レイアウト** — 左側に Target 一覧、右側に詳細パネル（狭いターミナルでは縦レイアウトにフォールバック）
- **ファジーフィルタ** — `/` を押すと名前で Target を絞り込む
- **モードピッカー** — `M` を押すと、選択中の Target の sync モード（merge、copy、symlink）を変更する
- **命名ピッカー** — `N` を押すと、選択中の Target の命名方式（flat、standard）を変更する
- **Include/Exclude エディタ** — `I` または `E` を押すと、選択中の Target のフィルタパターンエディタを開く。`a` でパターンを追加、`d` で削除
- **Target の削除** — `R` を押すと選択中の Target を削除する。実行前に確認プロンプトが表示される（`target remove` と同様にバックアップしてから unlink する）
- **キーボードナビゲーション** — `↑`/`↓` で移動、`Ctrl+d`/`Ctrl+u` で詳細パネルをスクロール、`q` で終了

TUI を通じて行った変更（モード、include/exclude）は即座に config に保存されます。適用するには `skillshare sync` を実行してください。

`--no-tui` を使うと TUI をスキップし、代わりにプレーンテキストを出力します。

```
Configured Targets
  claude       ~/.claude/skills (merge)
  cursor       ~/.cursor/skills (merge)
  codex        ~/.openai-codex/skills (symlink)
```

#### JSON 出力

```bash
skillshare target list --json
```

```json
{
  "targets": [
    {
      "name": "claude",
      "path": "~/.claude/skills",
      "mode": "merge",
      "targetNaming": "flat",
      "include": [],
      "exclude": []
    },
    {
      "name": "cursor",
      "path": "~/.cursor/skills",
      "mode": "merge",
      "targetNaming": "standard",
      "include": [],
      "exclude": []
    }
  ]
}
```

### target info / settings

Target の詳細を表示、または設定を変更します。

```bash
# 情報を表示
skillshare target claude

# モードを変更
skillshare target claude --mode symlink
skillshare target claude --mode merge

# 命名方式を変更
skillshare target claude --target-naming standard
skillshare target claude --target-naming flat

skillshare sync  # 変更を適用
```

## Sync モード

| モード | 動作 |
|------|------|
| `merge` | 各 Skill を個別にシンボリックリンク。ローカルの Skill を保持する。**デフォルト。** |
| `copy` | 各 Skill を実ファイルとしてコピーする。シンボリックリンクを辿れない AI CLI 向け。 |
| `symlink` | ディレクトリ全体を 1 つのシンボリックリンクにする。どこでも完全な複製になる。 |

`target --mode` は主要な互換性制御の窓口です。グローバルなデフォルトはシンプルに保ち、必要な箇所だけ上書きしてください。

## Target の命名方式

| 命名方式 | 動作 |
|--------|--------|
| `flat` | ネストした Skill を `__` 区切りでフラット化する（例: `frontend__dev`）。**デフォルト。** |
| `standard` | SKILL.md の `name` フィールドをそのまま使用する（例: `dev`）。[Agent Skills spec](https://agentskills.io/specification) に準拠する。 |

`target --target-naming` は Target 内で Skill ディレクトリがどのように命名されるかを制御します。`standard` モードでは、無効または衝突する名前を持つ Skill は警告付きでスキップされます。symlink モードでは無視されます。

```bash
# Target を copy モードに設定する（Cursor、Copilot CLI などに向けて）
skillshare target cursor --mode copy
skillshare sync  # 変更を適用
```

### 混在戦略の例

```bash
# ほとんどの Target ではデフォルトの merge の動作を維持する
skillshare target claude --mode merge

# 1 つの Target には互換性優先の設定を行う
skillshare target cursor --mode copy

# 別の Target には完全なミラーリングを行う
skillshare target codex --mode symlink

skillshare sync
```

## Target フィルタ（include/exclude）{#target-filters-includeexclude}

CLI から、Skill と agent の両方について Target ごとの include/exclude フィルタを管理できます。

```bash
# Skill
skillshare target claude --add-include "team-*"
skillshare target claude --add-exclude "_legacy*"
skillshare target claude --remove-include "team-*"
skillshare target claude --remove-exclude "_legacy*"

# Agent
skillshare target claude --add-agent-include "team-*"
skillshare target claude --add-agent-exclude "draft-*"
skillshare target claude --remove-agent-include "team-*"
skillshare target claude --remove-agent-exclude "draft-*"
```

フィルタを変更した後は、`skillshare sync` を実行して適用してください。

フィルタは **merge モードと copy モード**で機能します。パターンは Go の `filepath.Match` の構文（`*`, `?`, `[...]`）を使用します。symlink モードではフィルタは無視されます。

Agent フィルタは、組み込みの Target 定義、または config の明示的な `agents.path` オーバーライドのいずれかによって agents パスを持つ Target でのみ利用できます。

パターンのチートシートとシナリオについては、[Configuration](/docs/reference/targets/configuration#include--exclude-target-filters) を参照してください。

:::tip
Target フィルタは 3 つのフィルタリング階層の 1 つです。`.skillignore` や SKILL.md の `targets` とどのように連携するかは [Filtering Reference](/docs/reference/filtering) を参照してください。
:::

## オプション

### target add

| フラグ | 説明 |
|------|-------------|
| `--agent <agent>` | パスの代わりに、この Agent の[別のアカウント](#another-account)を追加する。`--config-dir` と併用 |
| `--config-dir <dir>` | そのアカウントが使う config ディレクトリ |

### target remove

| フラグ | 説明 |
|------|-------------|
| `--all, -a` | すべての Target を削除 |
| `--dry-run, -n` | 変更を加えずにプレビュー |

### target list

| フラグ | 説明 |
|------|-------------|
| `--json` | JSON として出力 |
| `--no-tui` | インタラクティブ TUI を無効化し、プレーンテキスト出力を使用 |

### target info / settings

| フラグ | 説明 |
|------|-------------|
| `--mode, -m <mode>` | sync モードを設定（merge、copy、または symlink） |
| `--agent-mode <mode>` | agent の sync モードを設定（merge、copy、または symlink） |
| `--target-naming <naming>` | Target の命名方式を設定（flat または standard） |
| `--add-include <pattern>` | include フィルタパターンを追加 |
| `--add-exclude <pattern>` | exclude フィルタパターンを追加 |
| `--remove-include <pattern>` | include フィルタパターンを削除 |
| `--remove-exclude <pattern>` | exclude フィルタパターンを削除 |
| `--add-agent-include <pattern>` | agent の include フィルタパターンを追加 |
| `--add-agent-exclude <pattern>` | agent の exclude フィルタパターンを追加 |
| `--remove-agent-include <pattern>` | agent の include フィルタパターンを削除 |
| `--remove-agent-exclude <pattern>` | agent の exclude フィルタパターンを削除 |

## サポートされる AI CLI

skillshare は `init` の際に以下を自動検出します。

| CLI | デフォルトパス |
|-----|-------------|
| Claude Code | `~/.claude/skills` |
| Cursor | `~/.cursor/skills` |
| OpenCode | `~/.opencode/skills` |
| Windsurf | `~/.windsurf/skills` |
| Codex | `~/.openai-codex/skills` |
| Antigravity（アプリ） | `~/.gemini/config/skills` |
| Antigravity CLI | `~/.gemini/antigravity-cli/skills` |
| Gemini CLI | `~/.gemini/skills` |
| Amp | `~/.amp/skills` |
| ... その他 45 種類以上 | [supported targets](/docs/reference/targets/supported-targets) を参照 |

## 例

```bash
# カスタム Target を追加
skillshare target add my-tool ~/my-tool/skills

# Target の状態を確認
skillshare target claude

# copy モードに切り替える（symlink を読めない AI CLI 向け）
skillshare target cursor --mode copy
skillshare sync

# symlink モードに切り替える
skillshare target claude --mode symlink
skillshare sync

# agent の sync モードを設定する
skillshare target claude --agent-mode copy
skillshare sync

# Skill フィルタを追加／削除する
skillshare target claude --add-include "team-*"
skillshare target claude --add-exclude "_legacy*"
skillshare target claude --remove-include "team-*"
skillshare sync

# agent フィルタを追加／削除する
skillshare target claude --add-agent-include "team-*"
skillshare target claude --add-agent-exclude "draft-*"
skillshare sync

# Target を削除する（Skill を復元する）
skillshare target remove cursor
```

## Project モード

現在の project の Target を管理します。

```bash
skillshare target add windsurf -p                                # 既知の Target を追加
skillshare target add custom ./tools/ai/skills -p                # カスタムパスを追加
skillshare target remove cursor -p                                # Target を削除
skillshare target list -p                                         # project の Target を一覧表示
skillshare target claude -p                                  # Target の情報を表示
skillshare target claude --add-include "team-*" -p          # フィルタを追加
skillshare target claude --add-agent-include "team-*" -p    # agent フィルタを追加
```

### 違いについて

| | グローバル | Project（`-p`） |
|---|---|---|
| Config | `~/.config/skillshare/config.yaml` | `.skillshare/config.yaml` |
| パス | 絶対パス（例: `~/.claude/skills`） | 相対パスまたは絶対パス（例: `.claude/skills`） |
| Sync モード | merge、copy、または symlink | merge、copy、または symlink（デフォルト merge） |
| モードの変更 | `--mode` フラグ | `--mode` フラグ |

### Project の Target 一覧の例

```
Project Targets
  claude    .claude/skills (merge)
  cursor         .cursor/skills (merge)
  custom-tool    ./tools/ai/skills (merge)
```

project モードでの Target は以下をサポートします。
- **既知の Target 名**（例: `claude`, `cursor`） — project ローカルのパスに解決される
- **カスタムパス** — project ルートからの相対パス、または `~` 展開を伴う絶対パス

## 関連項目

- [sync](/docs/reference/commands/sync) — Skill を Target に同期
- [status](/docs/reference/commands/status) — Target の状態を表示
- [Targets](/docs/reference/targets) — Target 管理ガイド
- [Project Skills](/docs/understand/project-skills) — project モードの概念
