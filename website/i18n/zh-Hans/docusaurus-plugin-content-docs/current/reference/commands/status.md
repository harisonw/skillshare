---
sidebar_position: 7
---

# status

显示 skillshare 的当前状态：source、tracked 仓库、targets 和版本。

```bash
skillshare status
```

## 何时使用

- 在做出变更后检查所有 Target 是否已同步
- 查看哪些 Target 需要运行 `sync`
- 验证 tracked 仓库是否为最新
- 验证当前生效的 audit 策略（profile、threshold、dedupe mode）
- 检查 CLI 或 skill 更新

## 示例输出

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

## 各区块说明

### Source

显示 source 目录位置、skill 数量，以及最后修改时间。当配置了 agents 时，agents source 会显示在单独的一行。

### Tracked Repositories

列出通过 `--track` 安装的 git 仓库。显示：
- 每个仓库的 skill 数量
- Git 状态（up-to-date 或 has changes）

### Targets

每个 target 会显示为一个标题，下面带有 **skills** 和 **agents** 子项：

```
claude
  skills   merged       [merge] ~/.claude/skills (8 shared, 2 local)
  agents   merged       [merge] 8/8 linked
```

**skills 子项** 显示：
- **Sync mode**：`merge`、`copy` 或 `symlink`
- **Path**：Target 目录位置
- **Status**：`merged`、`copied`、`linked`、`has files` 或 `needs sync`
- **Shared/local 计数**：在 merge 和 copy 模式下，计数使用的是该 target 的预期集合（应用 `include`/`exclude` filter 之后）。copy 模式下显示的是 "managed" 而非 "shared"。

**agents 子项** 显示：
- **Sync mode**：agents 实际使用的同步模式。在未开启 Developer Mode 的 Windows 上，`merge` 会显示为 `[copy]`，因为 agent 文件是被复制而不是被链接
- **Status**：`merged`、`copied`、`linked` 或 `drift`
- **Linked 计数**：例如 `8/8 linked`（已是最新的副本也计为 linked）。在 copy fallback 中，skillshare 不拥有但内容相同的本地文件会被保留并单独显示，例如 `0/1 linked, 1 local preserved`

如果 agents source 不存在，或该 target 没有配置 agent path，则 agents 子项会被省略。

| Status | 含义 |
|--------|---------|
| `merged` | skills/agents 被逐个 symlink |
| `copied` | skills 被复制为真实文件（带 manifest） |
| `linked` | 整个目录被 symlink |
| `has files` | 尚未同步 |
| `needs sync` | 模式已变更，运行 `sync` 以应用 |
| `drift` | 部分 agents 缺失——运行 `sync agents` |

### Extras

当配置了 extras 时，会显示每个 extra 的同步状态：

```
Extras
rules        has files  [merge] .cursor/rules (4 files)
commands     has files  [merge] .claude/commands (3 files)
```

每一项显示名称、状态、sync mode、target 路径和文件数量。sync mode 是文件实际同步时使用的模式：在未开启 Developer Mode 的 Windows 上，链接文件的 target 会显示 `[copy]`。

### Audit

显示当前生效的 audit 策略配置（由 CLI flag、project config 或 global config 解析得出）：

- **Profile**：`DEFAULT`、`STRICT` 或 `PERMISSIVE`
- **Block**：触发阻断的严重程度阈值（默认为 `CRITICAL`）
- **Dedupe**：去重模式（`GLOBAL` 或 `LEGACY`）
- **Analyzers**：已启用的 analyzer（`ALL` 或某个过滤后的列表）

### Version

比较你的 CLI 和 skill 版本与最新发布版本。（仅限 global mode。）

## Options

| Flag | 说明 |
|------|------|
| `--json` | 以 JSON 格式输出（用于脚本/CI） |
| `--project, -p` | 使用 project mode |
| `--global, -g` | 使用 global mode |
| `--help, -h` | 显示帮助信息 |

## JSON 输出

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

`source.skillignore` 字段仅在至少存在一个 `.skillignore` 或 `.skillignore.local` 文件时出现。不存在时：`"skillignore": { "active": false }`。`files` 数组在 `.skillignore.local` 存在时会包含其路径。在文本模式下，当任何 `.skillignore.local` 生效时，source 那一行会显示 `.local active`。

JSON 输出在 global mode 和 project mode 下都支持。

## Project Mode

在项目目录中，status 会显示项目专属信息。第一个区块标题会显示 `Source (project)` 以表明处于 project mode：

```bash
skillshare status        # 如果存在 .skillshare/ 则自动检测
skillshare status -p     # 显式指定 project mode
```

### 示例输出

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

Project status 不显示 Tracked Repositories 和 Version 区块（这些是仅限 global 的功能）。

## 另请参阅

- [sync](/docs/reference/commands/sync) —— 把 skills 同步到 Target
- [diff](/docs/reference/commands/diff) —— 显示详细差异
- [doctor](/docs/reference/commands/doctor) —— 诊断问题
- [Project Skills](/docs/understand/project-skills) —— Project mode 概念
