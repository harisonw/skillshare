---
sidebar_position: 7
---

# status

skillshare の現在の状態（source、tracked repositories、targets、バージョン）を表示します。

```bash
skillshare status
```

## 使うタイミング

- 変更を加えた後、すべての targets が sync 済みか確認する
- どの targets に `sync` の実行が必要か確認する
- tracked repos が最新かどうか確認する
- 有効な audit ポリシー（profile、threshold、dedupe mode）を確認する
- CLI や skill の更新を確認する

## 出力例

```
Source
─────────────────────────────────────────
✓ ~/.config/skillshare/skills (43 skills, 2026-09-28 12:52)
✓ ~/.config/skillshare/agents (2 agents, 2026-09-28 12:39)

Tracked Repositories
─────────────────────────────────────────
_superpowers ✓            15 skills, up-to-date

Targets
─────────────────────────────────────────
claude
  skills   merged       [merge] ~/.claude/skills (43 shared, 0 local)
  agents   merged       [merge] 2/2 linked
cursor
  skills   merged       [merge] ~/.cursor/skills (43 shared, 1 local)
  agents   merged       [merge] 2/2 linked
gemini
  skills   merged       [merge] ~/.gemini/skills (43 shared, 0 local)
…
universal
  skills   merged       [merge] ~/.agents/skills (43 shared, 0 local)

Extras
─────────────────────────────────────────
rules        has files    [merge] ~/.claude/rules (2 files)
rules        has files    [merge] ~/.cursor/rules (2 files)
commands     has files    [merge] ~/.claude/commands (1 files)
team         has files    [symlink] ~/.codex (1 files)
team         has files    [import] ~/.claude (1 files)
…

Audit
─────────────────────────────────────────
→ Profile:    DEFAULT
→ Block:      severity >= CRITICAL
→ Dedupe:     GLOBAL
→ Analyzers:  ALL

Version
─────────────────────────────────────────
! Skill: 0.21.12 (update available: 0.21.13)
→   Run: skillshare upgrade --skill && skillshare sync
```

## セクション

### Source

source ディレクトリの場所、skill 数、最終更新時刻を表示します。agents が設定されている場合、agents source は別の行に表示されます。

### Tracked Repositories

`--track` でインストールされた git リポジトリを一覧表示します。以下を表示します:
- リポジトリごとの skill 数
- Git の状態（up-to-date または変更あり）

### Targets

各 target は **skills** と **agents** のサブ項目を持つヘッダーとして表示されます。

```
claude
  skills   merged       [merge] ~/.claude/skills (8 shared, 2 local)
  agents   merged       [merge] 8/8 linked
```

**Skills サブ項目**が表示するもの:
- **Sync mode**: `merge`、`copy`、または `symlink`
- **Path**: target ディレクトリの場所
- **Status**: `merged`、`copied`、`linked`、`has files`、または `needs sync`
- **Shared/local の件数**: merge および copy mode では、その target の期待セット（`include`/`exclude` フィルター適用後）でカウントされます。Copy mode では "shared" の代わりに "managed" と表示されます。

**Agents サブ項目**が表示するもの:
- **Sync mode**: agents が実際に sync されるモード。Developer Mode がオフの Windows では、agent ファイルはリンクではなくコピーされるため、`merge` が `[copy]` と表示されます
- **Status**: `merged`、`copied`、`linked`、または `drift`
- **Linked count**: 例 `8/8 linked`（最新のコピーはリンク済みとして数えられます）。copy fallback では、skillshare が所有していない内容が同じローカルファイルは保持され、別に表示されます（例：`0/1 linked, 1 local preserved`）

agents source が存在しない、または target に agent path が設定されていない場合、agents サブ項目は省略されます。

| Status | 意味 |
|--------|---------|
| `merged` | Skills/agents が個別にシンボリックリンクされている |
| `copied` | Skills が実体ファイルとしてコピーされている（manifest 付き） |
| `linked` | ディレクトリ全体がシンボリックリンクされている |
| `has files` | まだ sync されていない |
| `needs sync` | mode が変更された、適用するには `sync` を実行 |
| `drift` | 一部の agents が欠落している — `sync agents` を実行 |

### Extras

extras が設定されている場合、各 extra の sync 状態を表示します。

```
Extras
rules        has files  [merge] .cursor/rules (4 files)
commands     has files  [merge] .claude/commands (3 files)
```

各エントリには名前、状態、sync mode、target のパス、ファイル数が表示されます。

### Audit

有効な audit ポリシー設定（CLI フラグ、project config、または global config から解決されたもの）を表示します。

- **Profile**: `DEFAULT`、`STRICT`、または `PERMISSIVE`
- **Block**: ブロックする severity のしきい値（デフォルトは `CRITICAL`）
- **Dedupe**: 重複排除モード（`GLOBAL` または `LEGACY`）
- **Analyzers**: 有効な analyzers（`ALL` またはフィルターされたリスト）

### Version

CLI と skill のバージョンを最新リリースと比較します。（global mode のみ）

## オプション

| フラグ | 説明 |
|------|-------------|
| `--json` | JSON として出力（スクリプト/CI 用） |
| `--project, -p` | project mode を使用 |
| `--global, -g` | global mode を使用 |
| `--help, -h` | ヘルプを表示 |

## JSON 出力

```bash
skillshare status --json
```

```json
{
  "source": {
    "path": "~/.config/skillshare/skills",
    "exists": true,
    "skillignore": {
      "active": true,
      "files": [".skillignore", "_team-skills/.skillignore"],
      "patterns": ["test-*", "vendor/"],
      "ignored_count": 2,
      "ignored_skills": ["test-draft", "vendor/lib"]
    }
  },
  "skill_count": 12,
  "tracked_repos": [
    {"name": "_team-skills", "skill_count": 5, "dirty": false},
    {"name": "_personal-repo", "skill_count": 3, "dirty": true}
  ],
  "targets": [
    {
      "name": "claude",
      "path": "~/.claude/skills",
      "mode": "merge",
      "status": "merged",
      "synced_count": 8,
      "include": [],
      "exclude": []
    }
  ],
  "agents": {
    "source": "~/.config/skillshare/agents",
    "exists": true,
    "count": 8,
    "targets": [
      {"name": "claude", "path": "~/.claude/agents", "expected": 8, "linked": 8, "drift": false}
    ]
  },
  "audit": {
    "profile": "DEFAULT",
    "threshold": "CRITICAL",
    "dedupe": "GLOBAL",
    "analyzers": []
  },
  "version": "0.17.0"
}
```

`source.skillignore` フィールドは、少なくとも 1 つの `.skillignore` または `.skillignore.local` ファイルが存在する場合にのみ存在します。存在しない場合: `"skillignore": { "active": false }`。`files` 配列には、存在する場合 `.skillignore.local` のパスも含まれます。テキストモードでは、`.skillignore.local` が有効な場合、source の行に `.local active` と表示されます。

JSON 出力は global mode と project mode の両方でサポートされています。

## Project Mode

project ディレクトリでは、status は project 固有の情報を表示します。最初のセクションヘッダーには `Source (project)` が表示され、project mode であることを示します。

```bash
skillshare status        # .skillshare/ が存在する場合は自動検出
skillshare status -p     # 明示的な project mode
```

### 出力例

```
Source (project)
✓ .skillshare/skills/ (3 skills, 2026-04-08 12:43)
→ .skillignore: 3 patterns, 0 skills ignored
✓ .skillshare/agents/ (4 agents, 2026-04-08 12:43)

Targets
claude
  skills   merged       [merge] .claude/skills (3 shared, 0 local)
  agents   merged       [merge] 4/4 linked
cursor
  skills   merged       [merge] .cursor/skills (3 shared, 0 local)
  agents   merged       [merge] 4/4 linked

Extras
rules        has files  [merge] .cursor/rules (4 files)
commands     has files  [merge] .claude/commands (3 files)

Audit
→ Profile:    DEFAULT
→ Block:      severity >= CRITICAL
→ Dedupe:     GLOBAL
→ Analyzers:  ALL
```

Project status では Tracked Repositories と Version のセクションは表示されません（これらは global 専用の機能です）。

## 関連項目

- [sync](/docs/reference/commands/sync) — Skill を targets に sync
- [diff](/docs/reference/commands/diff) — 詳細な差分を表示
- [doctor](/docs/reference/commands/doctor) — 問題を診断
- [Project Skills](/docs/understand/project-skills) — Project mode の概念
