---
sidebar_position: 1
---

# target

管理同步 targets（AI CLI skill 目录）。

```bash
skillshare target add <name> <path>    # Add a target
skillshare target remove <name>        # Remove a target
skillshare target list                 # List all targets
skillshare target <name>               # Show target info
skillshare target <name> --mode merge  # Change sync mode
skillshare target <name> --target-naming standard  # Change naming
```

## 何时使用

- 安装新工具后添加新的 AI CLI target
- 移除不再使用的 target
- 更改某个 target 的同步模式（merge、copy 或 symlink）
- 更改某个 target 的命名方式（flat 或 standard）
- 逐个 target 调整兼容性，而不是强制使用单一全局模式
- 为选择性的 skill 同步设置 include/exclude 过滤器

## 子命令

### target add

添加一个新的 target 用于 skill 同步。

```bash
skillshare target add windsurf ~/.windsurf/skills
```

该命令会验证：
- 路径存在，或父目录存在
- 路径看起来像一个 skills 目录
- Target 名称唯一

#### 某个 Agent 的另一个账号 {#another-account}

如果你用独立的配置目录运行某个 Agent 的第二个账号，例如使用 `CLAUDE_CONFIG_DIR=~/.claude-work` 的 Claude Code、使用 `CODEX_HOME` 的 Codex，或使用 `PI_CODING_AGENT_DIR` 的 Pi，请把该目录添加为一个 target。Skillshare 会据此推导出 skills 和 agents 路径：

```bash
skillshare target add claude-work --agent claude --config-dir ~/.claude-work
# Added target: claude-work -> ~/.claude-work/skills
```

你有多少个账号就可以添加多少个，每个使用各自的名称。这个名称也可以用作 [MCP target](./mcp.md#accounts)，因此一次 sync 就能覆盖每个账号的 skills、agents 和 MCP server。

`--agent` 接受 `claude`（`CLAUDE_CONFIG_DIR`）、`codex`（`CODEX_HOME`）和 `pi`（`PI_CODING_AGENT_DIR`）。Codex 或 Pi 账号会把它的 skills 同步到 `<config_dir>/skills`；只有 Claude 还有 agents 目录。该目录必须是绝对路径或以 `~` 开头，不能是该 Agent 的默认目录，也不能被两个 target 共用。

移除这类 target 不会因为 MCP 而失败：即使 `mcp.targets` 或某个 server 的 `targets` 仍然写着它，`skillshare target remove` 也会移除该 target，并提醒你把那里的名称也一并删掉。

### target remove

移除一个 target，并将其 skills 恢复为普通目录。

```bash
skillshare target remove cursor           # Remove single target
skillshare target remove --all            # Remove all targets
skillshare target remove cursor --dry-run # Preview
```

**会发生什么：**
1. 创建该 target 的备份
2. 检测同步模式：
   - **Symlink 模式：**移除目录 symlink，将 source 内容作为真实目录复制回去
   - **Merge 模式：**只移除指向 source 的 symlinks（按路径前缀判断），将每个 skill 作为真实文件复制回去。本地（非 symlink）skills 会被保留。
   - **Copy 模式：**移除 `.skillshare-manifest.json`。受管理的副本和本地 skills 会作为普通目录保留。
3. 从配置中移除该 target

如果还有其他 target 写入同一个 skills 文件夹（例如 `codex` 和 `universal` 都使用 `~/.agents/skills`），会跳过第 2 步：skills 仍为那个 target 保持链接，只有被移除的 target 从配置中删除。

### target list

列出所有已配置的 targets。

```bash
skillshare target list                 # Interactive TUI (default on TTY)
skillshare target list --no-tui        # Plain text output
skillshare target list --json          # JSON output for CI/scripts
```

#### 交互式 TUI

在 TTY 上，`target list` 会启动一个交互式终端 UI，包含：

- **分栏布局** —— 左侧是 target 列表，右侧是详情面板（在窄终端上会回退为垂直布局）
- **模糊过滤** —— 按 `/` 按名称过滤 targets
- **模式选择器** —— 按 `M` 为选中的 target 更改同步模式（merge、copy、symlink）
- **命名选择器** —— 按 `N` 为选中的 target 更改命名方式（flat、standard）
- **Include/Exclude 编辑器** —— 按 `I` 或 `E` 为选中的 target 打开过滤模式编辑器。使用 `a` 添加模式，`d` 删除
- **移除 target** —— 按 `R` 移除选中的 target。在继续前会显示确认提示（备份并解除链接，与 `target remove` 相同）
- **键盘导航** —— `↑`/`↓` 浏览，`Ctrl+d`/`Ctrl+u` 滚动详情面板，`q` 退出

通过 TUI 所做的更改（模式、include/exclude）会立即保存到配置中。运行 `skillshare sync` 使其生效。

使用 `--no-tui` 跳过 TUI，改为打印纯文本：

```
Configured Targets
  claude       ~/.claude/skills (merge)
  cursor       ~/.cursor/skills (merge)
  codex        ~/.openai-codex/skills (symlink)
```

#### JSON 输出

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

显示 target 详情或更改设置。

```bash
# Show info
skillshare target claude

# Change mode
skillshare target claude --mode symlink
skillshare target claude --mode merge

# Change target naming
skillshare target claude --target-naming standard
skillshare target claude --target-naming flat

skillshare sync  # Apply changes
```

## 同步模式

| Mode | Behavior |
|------|----------|
| `merge` | Each skill symlinked individually. Preserves local skills. **Default.** |
| `copy` | Each skill copied as real files. For AI CLIs that can't follow symlinks. |
| `symlink` | Entire directory is one symlink. Exact copies everywhere. |

`target --mode` 是主要的兼容性控制面。保持全局默认设置简单，只在需要时才覆盖。

## Target 命名

| Naming | Behavior |
|--------|----------|
| `flat` | Nested skills flattened with `__` separators (e.g. `frontend__dev`). **Default.** |
| `standard` | Uses SKILL.md `name` field directly (e.g. `dev`). Follows the [Agent Skills spec](https://agentskills.io/specification). |

`target --target-naming` 控制 skill 目录在 targets 中的命名方式。在 `standard` 模式下，
名称无效或冲突的 skills 会被警告并跳过。在 symlink 模式下会被忽略。

```bash
# Set target to copy mode (for Cursor, Copilot CLI, etc.)
skillshare target cursor --mode copy
skillshare sync  # Apply the change
```

### 混合策略示例

```bash
# Keep default merge behavior for most targets
skillshare target claude --mode merge

# Compatibility-first for one target
skillshare target cursor --mode copy

# Exact mirror for another target
skillshare target codex --mode symlink

skillshare sync
```

## Target Filters (include/exclude) {#target-filters-includeexclude}

通过 CLI 管理每个 target 对于 skills 和 agents 的 include/exclude 过滤器：

```bash
# Skills
skillshare target claude --add-include "team-*"
skillshare target claude --add-exclude "_legacy*"
skillshare target claude --remove-include "team-*"
skillshare target claude --remove-exclude "_legacy*"

# Agents
skillshare target claude --add-agent-include "team-*"
skillshare target claude --add-agent-exclude "draft-*"
skillshare target claude --remove-agent-include "team-*"
skillshare target claude --remove-agent-exclude "draft-*"
```

更改过滤器后，运行 `skillshare sync` 使其生效。

过滤器在 **merge 和 copy 模式**下有效。模式使用 Go 的 `filepath.Match` 语法（`*`、`?`、`[...]`）。
在 symlink 模式下，过滤器会被忽略。

Agent 过滤器仅适用于拥有 agents 路径的 targets，该路径可以来自内置 target 定义，
或来自配置中显式的 `agents.path` 覆盖。

关于模式速查表和使用场景，参见 [Configuration](/docs/reference/targets/configuration#include--exclude-target-filters)。

:::tip
Target filters 是三层过滤机制之一。参见 [Filtering Reference](/docs/reference/filtering) 了解它们如何与 `.skillignore` 及 SKILL.md 的 `targets` 相互作用。
:::

## 选项

### target add

| Flag | Description |
|------|-------------|
| `--agent <agent>` | Add [another account](#another-account) of this Agent instead of a path. Goes with `--config-dir` |
| `--config-dir <dir>` | The config directory that account uses |

### target remove

| Flag | Description |
|------|-------------|
| `--all, -a` | Remove all targets |
| `--dry-run, -n` | Preview without making changes |

### target list

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON |
| `--no-tui` | Disable interactive TUI, use plain text output |

### target info / settings

| Flag | Description |
|------|-------------|
| `--mode, -m <mode>` | Set sync mode (merge, copy, or symlink) |
| `--agent-mode <mode>` | Set agents sync mode (merge, copy, or symlink) |
| `--target-naming <naming>` | Set target naming (flat or standard) |
| `--add-include <pattern>` | Add an include filter pattern |
| `--add-exclude <pattern>` | Add an exclude filter pattern |
| `--remove-include <pattern>` | Remove an include filter pattern |
| `--remove-exclude <pattern>` | Remove an exclude filter pattern |
| `--add-agent-include <pattern>` | Add an agent include filter pattern |
| `--add-agent-exclude <pattern>` | Add an agent exclude filter pattern |
| `--remove-agent-include <pattern>` | Remove an agent include filter pattern |
| `--remove-agent-exclude <pattern>` | Remove an agent exclude filter pattern |

## 支持的 AI CLIs

skillshare 在 `init` 期间会自动检测以下工具：

| CLI | Default Path |
|-----|-------------|
| Claude Code | `~/.claude/skills` |
| Cursor | `~/.cursor/skills` |
| OpenCode | `~/.opencode/skills` |
| Windsurf | `~/.windsurf/skills` |
| Codex | `~/.openai-codex/skills` |
| Antigravity（app） | `~/.gemini/config/skills` |
| Antigravity CLI | `~/.gemini/antigravity-cli/skills` |
| Gemini CLI | `~/.gemini/skills` |
| Amp | `~/.amp/skills` |
| ... and 45+ more | See [supported targets](/docs/reference/targets/supported-targets) |

## 示例

```bash
# Add custom target
skillshare target add my-tool ~/my-tool/skills

# Check target status
skillshare target claude

# Switch to copy mode (for AI CLIs that can't read symlinks)
skillshare target cursor --mode copy
skillshare sync

# Switch to symlink mode
skillshare target claude --mode symlink
skillshare sync

# Configure agent sync mode
skillshare target claude --agent-mode copy
skillshare sync

# Add/remove skill filters
skillshare target claude --add-include "team-*"
skillshare target claude --add-exclude "_legacy*"
skillshare target claude --remove-include "team-*"
skillshare sync

# Add/remove agent filters
skillshare target claude --add-agent-include "team-*"
skillshare target claude --add-agent-exclude "draft-*"
skillshare sync

# Remove target (restores skills)
skillshare target remove cursor
```

## Project Mode

管理当前项目的 targets：

```bash
skillshare target add windsurf -p                                # Add known target
skillshare target add custom ./tools/ai/skills -p                # Add custom path
skillshare target remove cursor -p                                # Remove target
skillshare target list -p                                         # List project targets
skillshare target claude -p                                  # Show target info
skillshare target claude --add-include "team-*" -p          # Add filter
skillshare target claude --add-agent-include "team-*" -p    # Add agent filter
```

### 差异之处

| | Global | Project (`-p`) |
|---|---|---|
| Config | `~/.config/skillshare/config.yaml` | `.skillshare/config.yaml` |
| Paths | Absolute (e.g., `~/.claude/skills`) | Relative or absolute (e.g., `.claude/skills`) |
| Sync mode | Merge, copy, or symlink | Merge, copy, or symlink (default merge) |
| Mode change | `--mode` flag | `--mode` flag |

### Project Target List 示例

```
Project Targets
  claude    .claude/skills (merge)
  cursor         .cursor/skills (merge)
  custom-tool    ./tools/ai/skills (merge)
```

Project mode 下的 targets 支持：
- **已知 target 名称**（如 `claude`、`cursor`）—— 解析为项目本地路径
- **自定义路径** —— 相对于项目根目录，或使用 `~` 展开的绝对路径

## 另请参阅

- [sync](/docs/reference/commands/sync) — 将 skills 同步到 targets
- [status](/docs/reference/commands/status) — 显示 target 状态
- [Targets](/docs/reference/targets) — Target 管理指南
- [Project Skills](/docs/understand/project-skills) — Project mode 概念
