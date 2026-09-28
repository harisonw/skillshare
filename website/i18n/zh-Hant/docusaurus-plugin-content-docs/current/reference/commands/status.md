---
sidebar_position: 7
---

# status

顯示 skillshare 目前的狀態：source、tracked 儲存庫、targets 與版本資訊。

```bash
skillshare status
```

## 使用時機

- 變更之後檢查所有 targets 是否已同步
- 查看哪些 targets 需要執行 `sync`
- 確認 tracked 儲存庫是否為最新
- 確認目前生效的 audit 政策（profile、threshold、dedupe 模式）
- 檢查 CLI 或 skill 是否有更新

## 輸出範例

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

## 各區段說明

### Source

顯示 source 目錄位置、skill 數量與最後修改時間。若有設定 agents，agents source 會另外顯示一行。

### Tracked Repositories

列出以 `--track` 安裝的 git 儲存庫，顯示：
- 每個儲存庫的 skill 數量
- Git 狀態（已是最新或有變更）

### Targets

每個 target 顯示為一個標題，底下有 **skills** 與 **agents** 兩個子項目：

```
claude
  skills   merged       [merge] ~/.claude/skills (8 shared, 2 local)
  agents   merged       [merge] 8/8 linked
```

**skills 子項目**顯示：
- **Sync 模式**：`merge`、`copy` 或 `symlink`
- **路徑**：target 目錄位置
- **狀態**：`merged`、`copied`、`linked`、`has files` 或 `needs sync`
- **shared/local 數量**：在 merge 與 copy 模式下，數量以該 target 經過 `include`/`exclude` 過濾後的預期集合為準。copy 模式會顯示「managed」而非「shared」。

**agents 子項目**顯示：
- **Sync 模式**：agents 實際使用的同步模式。在沒有開啟開發人員模式的 Windows 上，`merge` 會顯示為 `[copy]`，因為 agent 檔案是被複製而不是連結
- **狀態**：`merged`、`copied`、`linked` 或 `drift`
- **連結數量**：例如 `8/8 linked`（最新的副本也算作已連結）。在 copy fallback 中，skillshare 不擁有但內容相同的本機檔案會被保留並分開顯示，例如 `0/1 linked, 1 local preserved`

若 agents source 不存在，或該 target 沒有設定 agent 路徑，則會省略 agents 子項目。

| 狀態 | 意義 |
|--------|---------|
| `merged` | skills/agents 各自以 symlink 連結 |
| `copied` | skills 以實際檔案複製（含 manifest） |
| `linked` | 整個目錄以單一 symlink 連結 |
| `has files` | 尚未同步 |
| `needs sync` | 模式已變更，需執行 `sync` 套用 |
| `drift` | 部分 agents 缺失 — 執行 `sync agents` |

### Extras

當設定了 extras，會顯示各個 extra 的同步狀態：

```
Extras
rules        has files  [merge] .cursor/rules (4 files)
commands     has files  [merge] .claude/commands (3 files)
```

每個項目顯示名稱、狀態、sync 模式、target 路徑與檔案數量。Sync 模式是檔案實際使用的同步模式：在沒有開啟開發人員模式的 Windows 上，連結檔案的 target 會顯示 `[copy]`。

### Audit

顯示目前生效的 audit 政策設定（由 CLI flags、專案設定或全域設定解析而來）：

- **Profile**：`DEFAULT`、`STRICT` 或 `PERMISSIVE`
- **Block**：觸發封鎖的嚴重程度門檻（預設為 `CRITICAL`）
- **Dedupe**：去重模式（`GLOBAL` 或 `LEGACY`）
- **Analyzers**：已啟用的分析器（`ALL` 或篩選後的清單）

### Version

比較你的 CLI 與 skill 版本與最新版本。（僅限 global 模式）

## 選項

| Flag | 說明 |
|------|-------------|
| `--json` | 以 JSON 輸出（供 scripting/CI 使用） |
| `--project, -p` | 使用 project 模式 |
| `--global, -g` | 使用 global 模式 |
| `--help, -h` | 顯示說明 |

## JSON 輸出

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

`source.skillignore` 欄位只有在至少存在一個 `.skillignore` 或 `.skillignore.local` 檔案時才會出現。若不存在則為：`"skillignore": { "active": false }`。`files` 陣列在有 `.skillignore.local` 時也會包含其路徑。在文字模式下，若有任何 `.skillignore.local` 生效，source 那一行會顯示 `.local active`。

JSON 輸出在 global 與 project 模式下皆支援。

## Project 模式

在專案目錄中，status 會顯示專案專屬的資訊。第一個區段標題會顯示 `Source (project)` 以表示目前為 project 模式：

```bash
skillshare status        # 若 .skillshare/ 存在則自動偵測
skillshare status -p     # 明確指定 project 模式
```

### 輸出範例

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

Project 模式的 status 不會顯示 Tracked Repositories 或 Version 區段（這些是僅限 global 的功能）。

## 另請參閱

- [sync](/docs/reference/commands/sync) — 將 skills 同步到 targets
- [diff](/docs/reference/commands/diff) — 顯示詳細差異
- [doctor](/docs/reference/commands/doctor) — 診斷問題
- [Project Skills](/docs/understand/project-skills) — Project 模式概念
