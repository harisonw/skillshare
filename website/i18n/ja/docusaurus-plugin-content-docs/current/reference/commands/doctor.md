---
sidebar_position: 1
---

# doctor

環境をチェックし、skillshare のセットアップに関する問題を診断します。

```bash
skillshare doctor
skillshare doctor -p        # Project mode（.skillshare/config.yaml）
skillshare doctor -g        # グローバルモードを強制
skillshare doctor --json    # CI 向けの構造化された JSON 出力
```

```text
skillshare doctor

Checking environment
─────────────────────────────────────────
✓ Config: ~/.config/skillshare/config.yaml
→ Config directory: ~/.config/skillshare
→ Data directory:   ~/.local/share/skillshare
→ State directory:  ~/.local/state/skillshare

✓ Source: ~/.config/skillshare/skills (43 skills)
✓ Agents source: ~/.config/skillshare/agents (2 agents)
→ Skillignore: not configured
✓ Link support: OK
! Git: not initialized (recommended for backup)

✓ Skill integrity: 27/27 verified

Checking targets
─────────────────────────────────────────
claude
  skills   [merge] merged (43 shared, 0 local)
  agents   [merge] synced (2/2 linked)
cursor
  skills   [merge] merged (43 shared, 1 local)
  agents   [merge] synced (2/2 linked)
gemini
  skills   [merge] merged (43 shared, 0 local)
…
! gemini will see content from: universal
    ~/.agents/skills ← universal
…
✗ claude: 1 broken symlink(s): frontend__css-review
…

Extras
─────────────────────────────────────────
✓ rules: 2 files, 2/2 targets OK
✓ commands: 1 files, 1/1 targets OK
✓ team: 1 files, 4/4 targets OK

Storage
─────────────────────────────────────────
→ Backups: last backup 2026-09-28_12-41-50 (10 minutes ago)
→ Trash: 1 item(s) (247 B), oldest <1 day

Summary
─────────────────────────────────────────
✗ 6 error(s), 4 warning(s)
```

## 使うタイミング

- 何かがうまく動かないが、原因がわからないとき
- skillshare や OS をアップグレードした後
- すべての Target、git、シンボリックリンクが健全かを確認したいとき
- バグ報告をする前の最初の診断ステップとして

## チェック内容

```text
skillshare doctor

Checking environment
✓ Config: ~/.config/skillshare/config.yaml
→ Config directory: ~/.config/skillshare
→ Data directory:   ~/.local/share/skillshare
→ State directory:  ~/.local/state/skillshare

✓ Source: ~/.config/skillshare/skills (12 skills)
✓ Agents source: ~/.config/skillshare/agents (8 agents)
✓ Skillignore: 2 patterns, 1 skills ignored
✓ Link support: OK
✓ Git: initialized with remote

✓ Skill integrity: 12/12 verified

Checking targets
claude
  skills   [merge] merged (8 shared, 2 local)
  agents   [merge] synced (8/8 linked)
cursor
  skills   [copy] copied (8 managed, 0 local)
  agents   [merge] synced (8/8 linked)
codex
  skills   [merge] needs sync

Extras
✓ rules: 4 files, 1/1 targets OK
✓ commands: 3 files, 1/1 targets OK

Version
✓ CLI: 0.17.0
✓ Skill: 0.17.0

Summary
✓ All checks passed!
```

## 実行されるチェック

### 環境

| チェック項目 | 検証内容 |
|-------|-----------------|
| Config | 設定ファイルが存在し、有効であること |
| Source | Source ディレクトリが存在し、読み取り可能であること |
| Agents source | Agents source ディレクトリが存在すること（設定されている場合） |
| Skillignore | `.skillignore`（および `.skillignore.local`）の有効なパターンと、無視されている Skill 数 |
| Link support | システムがシンボリックリンクを作成できること |
| Git | リポジトリの状態と remote の設定 |

### Targets

各 Target には **skills** と **agents**（Agent が設定されている場合）のサブ項目が表示されます。
- Skills: パス、sync モード、sync 状態、共有/ローカルの件数
- Agents: sync モード、リンク済み件数、drift の検出。Developer Mode がオフの Windows では `merge` が `[copy]` と表示され、最新の管理対象コピーはリンク済みとして数えられます。skillshare が所有していない、内容が同じローカルファイルは保持されます。copy fallback では agent の件数に `local preserved` として別に表示されます（例：`0/1 linked, 1 local preserved`）。
- 壊れたシンボリックリンクがないこと
- 意図しないローカルの衝突を検出する Skill 重複チェック:
  - `merge` モード: スキップ（ローカルの Skill は想定内のため）
  - `copy` モード: マニフェストで管理されているコピーは無視され、ローカルで衝突しているコピーのみ警告
- 有効な include/exclude glob パターン
- 該当する場合、Target ごとの情報レベルの互換性ヒント（Target の優先順位の例: `cursor` → `antigravity` → `copilot` → `opencode`。これらの Target が存在しない場合はヒントなし）

### パスの重複

Doctor は、ランタイムのピッカーに到達する前に、Skill 重複のリスクを 2 種類のクラスとしてフラグ付けします。

**`shared_target_paths`** — 2 つ以上の有効な Target が同じプライマリパスに解決される場合に発生します。よくある原因: `universal` と、`~/.agents/skills` に書き込むツール（例: `warp`、`witsy`）の両方を有効にしている場合。

```text
! Shared path ~/.agents/skills ← universal, warp
```

解決方法: 重複している Target のいずれかを無効化するか、`skillshare target <name> --path <dir>` で別のパスを設定してください。

**`cross_target_discovery`** — ある有効な Target のランタイムが、別の有効な Target が書き込むディレクトリもスキャンすると文書化されている場合に発生します。例えば、以前のセットアップから残った設定では `codex` がレガシーな `~/.codex/skills` を指したままになっている一方、`universal` は `~/.agents/skills` に書き込みます — このディレクトリは Codex も読み込みます。両方を有効にすると、Codex は自身のコンテンツに加えて universal のコンテンツも見ることになります。

```text
! codex will see content from: universal
    ~/.agents/skills ← universal
```

解決方法: まずスキャンする側の Target（上の例では `codex`）を削除してください。そのランタイムは共有ディレクトリをすでに読み込んでおり、他のツールには影響しません。`skillshare target remove codex --dry-run` でプレビューできます。代わりに書き込み元（`universal`）を削除すると、`~/.agents/skills` を読み込む他のツールからもそれらの skill が見えなくなります。スキャンする側の Target が、書き込み元でフィルタされている skill を持つ場合に限り両方を残し、ランタイムのピッカーでの重複表示を受け入れてください。

どちらのチェックも純粋なメタデータのみを扱います — 設定済みのパスと組み込みの `also_scans` テーブルを読み取るだけで、ファイルシステムへの実際の探査は行いません。

### バージョン

- CLI のバージョン
- skillshare skill のバージョン
- 利用可能な更新のチェック

### Skill の整合性

ファイルハッシュのメタデータを持つインストール済み Skill について、doctor はインストール以降にファイルが改ざんされていないかを検証します。

- 現在の SHA-256 ハッシュを保存されているハッシュと比較
- Skill ごとに変更・欠落・追加されたファイルを報告
- `.metadata.json` に含まれないローカルの Skill は静かにスキップされます — これは想定内の挙動です
- メタデータはあるが `file_hashes` が欠落しているインストール済み Skill は、その名前とともにフラグ付けされます

```text
⚠ _team-repo__api-helper: 1 modified, 1 missing
✓ Skill integrity: 5/6 verified
⚠ Skill integrity: 1 skill(s) missing file hashes: _old-repo__legacy-skill
```

### Extras

Extras が設定されている場合、以下を検証します。
- 各 Extras の Source ディレクトリが存在すること
- Target ディレクトリに到達可能であること
- 存在しない Source ディレクトリや到達不能な Target を報告

### その他

- `SKILL.md` ファイルがない Skill
- Skill レベルの `targets:` フィールド検証（未知の Target 名について警告）
- 最後のバックアップのタイムスタンプ（グローバルモード）
- Trash の状態（アイテム数、合計サイズ、最も古いアイテムの経過日数）
- Target 内の壊れたシンボリックリンク

:::note Project mode
プロジェクトに `.skillshare/config.yaml` がある場合、`skillshare doctor` は自動的に Project mode で実行されます。

Project mode では:
- Config/Source のチェックには `.skillshare/config.yaml` と `.skillshare/skills` が使用されます
- Trash の状態には `.skillshare/trash` が使用されます
- バックアップは `not used in project mode` と表示されます
:::

## よくある問題

### "Needs sync"

Target のモードは変更されたものの、まだ適用されていません。

```bash
skillshare sync
```

### "Not synced"

Target のリンク済み Skill が Source より少ない状態です（新しい Skill をインストールした後など）。

```bash
skillshare sync
```

### "Has uncommitted changes"

トラッキング対象のリポジトリにローカルの変更があります。

```bash
cd ~/.config/skillshare/skills/_team-repo
git status
# 変更をコミットするか破棄する
```

### "Broken symlink"

Skill が Source から削除されたのに、シンボリックリンクが残っています。

```bash
skillshare sync  # 孤立したシンボリックリンクを削除します
```

### "Skills without SKILL.md"

必須ファイルがない Skill フォルダです。

```bash
# 各 Skill に SKILL.md を追加するか、フォルダを削除する
skillshare new my-skill  # 正しい構造を作成
```

### "Link not supported"

`doctor` はシステムの一時ディレクトリ（Windows では `%TEMP%`、それ以外では `$TMPDIR` または `/tmp`）にテスト用フォルダーのリンクを作成します。Windows ではこのリンクは NTFS ジャンクションで、管理者権限も Developer Mode も不要なため、Developer Mode を有効にしてもこのエラーは解決しません。メッセージ内の `junction error:` の行に、Windows が拒否した理由が表示されます。一時ディレクトリについて次を確認してください:

1. FAT32、exFAT、ネットワーク共有ではなく、ローカルの NTFS ドライブ上にあること（ジャンクションは NTFS でのみ動作します）
2. 自分のアカウントで書き込みができ、ウイルス対策ソフトやセキュリティソフトにブロックされていないこと

このチェックはファイルのリンクをテストしません。Developer Mode がない場合、単一ファイルをリンクする agents と extras は代わりにコピーされます。詳しくは [Windows のトラブルシューティング](../../troubleshooting/windows.md#file-links-need-windows-developer-mode-copying-instead) を参照してください。

## 問題がある場合の出力例

```
Checking environment
✓ Config: ~/.config/skillshare/config.yaml
✓ Source: ~/.config/skillshare/skills (12 skills)
✓ Agents source: ~/.config/skillshare/agents (8 agents)
✓ Link support: OK
⚠ Git: 3 uncommitted change(s)

⚠ Skills without SKILL.md: test-dir, temp
⚠ _team-repo__api-helper: 1 modified
✓ Skill integrity: 5/6 verified

Checking targets
claude
  skills   [merge] merged (8 shared, 2 local)
  agents   [merge] synced (8/8 linked)
cursor
  skills   [merge] 2 broken symlink(s): old-skill, removed-skill
codex
  skills   [merge] needs sync
⚠ claude: 1 skill(s) not synced (2/3 linked)

Version
✓ CLI: 0.17.0
⚠ Skill: 0.16.0 (update available: 0.17.0)
  Run: skillshare upgrade --skill && skillshare sync

Backups: last backup 2026-01-18_09-00-00 (3 days ago)
ℹ Trash: 2 item(s) (45.2 KB), oldest 3 day(s)

ℹ Update available: 1.2.0 -> 1.3.0
  brew upgrade skillshare  OR  curl -fsSL .../install.sh | sh

Summary
  ✗ 1 error(s), 4 warning(s)
```

## JSON 出力

CI パイプラインや自動化のために、機械可読な出力には `--json` を使用します。

```bash
skillshare doctor --json
```

```json
{
  "checks": [
    { "name": "source", "status": "pass", "message": "Source: ~/.config/skillshare/skills (12 skills)" },
    { "name": "skillignore", "status": "pass", "message": ".skillignore: 3 patterns, 2 skills ignored", "details": ["test-*", "vendor/", "!important", "---", "test-draft", "vendor/lib"] },
    { "name": "sync_drift", "status": "warning", "message": "claude: 1 skill(s) not synced (7/8 linked)", "details": ["new-skill"] },
    { "name": "shared_target_paths", "status": "warning", "message": "1 shared target path(s) — enabled targets writing to the same directory may produce duplicate skills in runtime pickers", "details": ["~/.agents/skills ← universal, warp"], "suggestions": ["Choose one authoritative target for ~/.agents/skills and disable or reconfigure the rest (currently: universal, warp)"] },
    { "name": "broken_symlinks", "status": "error", "message": "cursor: 1 broken symlink(s)", "details": ["old-skill"] }
  ],
  "summary": { "total": 14, "pass": 12, "warnings": 1, "errors": 1, "info": 0 },
  "version": { "current": "0.17.4", "latest": "0.18.0", "update_available": true }
}
```

チェックのステータス: `pass`、`warning`、`error`、`info`。`info` ステータスは、合格でも失敗でもない情報提供のみのチェック（例: `.skillignore` が見つからない場合）に使われます。Info チェックは `total` にはカウントされますが、`pass`、`warnings`、`errors` にはカウントされません。

一部の warning チェック（例: `shared_target_paths`、`cross_target_discovery`）には、実行可能な改善手順を示す任意の `suggestions` 配列も含まれます。提案することがない場合、このフィールドは省略されます。

### 終了コード

| 状態 | 終了コード |
|-----------|-----------|
| すべてのチェックが合格（または警告のみ） | `0` |
| いずれかのチェックが `error` ステータス | `1` |

### CI での例

```bash
# doctor がエラーを検出した場合にパイプラインを失敗させる
skillshare doctor --json | jq -e '.summary.errors == 0'

# 通知用に警告を抽出する
skillshare doctor --json | jq '[.checks[] | select(.status == "warning")]'
```

:::tip Web Dashboard
Web ダッシュボードの **Health Check** ページ（`skillshare ui`）は、`doctor --json` のビジュアル版で、フィルタの切り替えと展開可能な詳細を提供します。
:::

## 関連項目

- [status](/docs/reference/commands/status) — クイックステータスチェック
- [sync](/docs/reference/commands/sync) — sync の問題を修正
- [upgrade](/docs/reference/commands/upgrade) — CLI と Skill を更新
