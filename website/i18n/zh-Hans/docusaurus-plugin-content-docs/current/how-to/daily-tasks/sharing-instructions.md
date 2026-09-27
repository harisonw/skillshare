---
sidebar_position: 11
---

# 让多个工具共用一份 AGENTS.md

每个 AI 工具都从自己的文件读取常驻指令。Claude Code 读取 `CLAUDE.md`，Gemini CLI
读取 `GEMINI.md`，Codex 和大多数其他工具读取 `AGENTS.md`，各自放在自己的文件夹中。
网页控制台（`skillshare ui`）会显示这些文件，让你编辑它们，还能让多个工具共用一份
`AGENTS.md`。

这是控制台功能，没有单独的 CLI 命令。共享 `AGENTS.md` 以
[extra](../../reference/commands/extras.md#single-file-extras) 的形式存储，因此
`skillshare sync extras` 也会让它保持就位。

## 查看 target 读取什么 {#see-what-a-target-reads}

在 **目标** 中打开一个 target。它的页面有一个以该 target 读取的文件命名的标签页：
claude 是 **CLAUDE.md**，gemini 是 **GEMINI.md**，codex 是 **AGENTS.md**。
这个标签页会显示：

- **读取顺序**：该工具加载的文件，按加载顺序编号，并标记为 `loaded`、`skipped` 或
  `missing`。对 claude 来说，这包括 `~/.claude/rules/` 中的 Markdown 文件，以及一行
  `AGENTS.md`，说明 claude 不读取用户级的 `AGENTS.md`。
- 该文件的编辑器。**保存** 会先备份当前文件；如果文件还不存在，则会创建它。
- 警告。以 `@` 开头的行是 import，只有部分工具会展开它们；其他工具会把它们当作纯文本
  读取。Windsurf 只读取其全局 rules 文件的前 6,000 个字符。
- **共享 AGENTS.md**（global mode）：这个 target 使用的共享文件，以及选择它们的链接。

如果该文件是指向共享 `AGENTS.md` 的链接，编辑器就是只读的。编辑它会改变所有使用该共享
文件的 target，所以请改到那份文件自己的页面上编辑。你自己建立的链接（例如指向你的
dotfiles 的链接）仍然可以编辑，保存时会写入它所指向的文件。

skillshare 知道以下指示文件：

| Target | 用户级文件 | 项目文件 | 会展开 `@` import |
|--------|-----------------|--------------|---------------------|
| amp | `~/.config/amp/AGENTS.md` | `AGENTS.md` | 否 |
| antigravity | `~/.gemini/GEMINI.md`（与 gemini 是同一个文件） | `AGENTS.md` | 否 |
| claude | `~/.claude/CLAUDE.md`，以及 `~/.claude/rules/` | `CLAUDE.md`，没有 `CLAUDE.md` 时则为 `AGENTS.md`，以及 `.claude/rules/` | 是 |
| codex | `~/.codex/AGENTS.md` | `AGENTS.md` | 否 |
| cursor | 无：User Rules 存在 Cursor 的设置里 | `AGENTS.md` | 否 |
| gemini | `~/.gemini/GEMINI.md` | `GEMINI.md` | 否 |
| goose | `~/.config/goose/.goosehints` | `AGENTS.md` | 否 |
| kiro | `~/.kiro/steering/AGENTS.md` | `AGENTS.md` | 否 |
| opencode | `~/.config/opencode/AGENTS.md` | `AGENTS.md` | 否 |
| roo | `~/.roo/rules/AGENTS.md` | `AGENTS.md` | 否 |
| windsurf | `~/.codeium/windsurf/memories/global_rules.md`（前 6,000 个字符） | `AGENTS.md` | 否 |

Claude 或 Codex 的[第二个账号](../../reference/targets/configuration.md#agent-config-dir)
读取的是其自身配置目录中的同一个文件，例如 `~/.claude-work/CLAUDE.md`。对于其他
target，你可以[告诉 skillshare 它读取哪个文件](#tools-skillshare-doesnt-know)。

## 将 CLAUDE.md 转换为 AGENTS.md {#convert-claudemd-to-agentsmd}

在 target 的标签页上点击 **转换…**，让它的内容也能被其他工具读取。当文件有可移动的
内容、且本身还不是 `AGENTS.md` 时，这个按钮才会出现。对话框会在写入任何内容之前预览
所有变更，被它修改或移除的每个文件都会先备份。

| 方式 | 结果 | 适用 |
|--------|--------|-----------|
| **移到 AGENTS.md，CLAUDE.md 改为导入它**（推荐） | 内容移到 `AGENTS.md`。`CLAUDE.md` 只保留一行 `@AGENTS.md` 以及只有 claude 能理解的行 | 会展开 `@` import 的工具（claude） |
| **将 CLAUDE.md 重命名为 AGENTS.md** | `CLAUDE.md` 被移除，claude 改为读取 `AGENTS.md` | 仅限项目，且工具在自己的文件不存在时会读取 `AGENTS.md`。存在 `CLAUDE.local.md` 时，或 `CLAUDE.md` 正在使用共享 `AGENTS.md` 时会被拒绝（下次 sync 会把 `CLAUDE.md` 重新建出来） |
| **复制为 AGENTS.md** | 两个文件都保留并各自编辑，之后内容会逐渐不一致 | 始终可用 |

文件名随 target 而定：对于 gemini，对话框只提供 **复制为 AGENTS.md**。使用第一种方式时，
**将 … 行 @import 保留在 CLAUDE.md** 默认开启，因为其他工具会把这些行当作纯文本读取。

在用户级，没有其他工具会读取 `~/.claude` 中的 `AGENTS.md`。因此在 global mode 下，
第一种方式还提供 **转换为共享 AGENTS.md，让其他目标也能接**，默认开启：

- **新建一份…**：为新的共享 `AGENTS.md` 命名。内容会移进去，`CLAUDE.md` 改为导入它。
- 已有的共享文件：内容会接在该文件的最后面，`CLAUDE.md` 随后导入它。

关闭共享时，内容会移到 `~/.claude/AGENTS.md`，`CLAUDE.md` 则得到一行 `@AGENTS.md`。

## 在 global mode 下共享一份 AGENTS.md {#share-one-agentsmd-in-global-mode}

前往 **Extras** 并打开 **AGENTS.md** 标签页。**新建共享 AGENTS.md** 会要求输入名称
（英文字母、数字、`-` 和 `_`）以及起始内容：

- **空白文件**：在对话框中编写第一版内容。
- **把 claude 的文件移进来**（或任何其他有文件、且尚未使用共享文件的 target）：该 target
  当前的文件会移进这份共享文件，之后该 target 就改用共享文件。原文件会先备份。

每份共享文件存储在 `<extras source>/<name>/AGENTS.md`，默认为
`~/.config/skillshare/extras/<name>/AGENTS.md`。

target 如何使用共享文件，取决于它是否会展开 `@` import：

- **Import target**（claude，以及你标记为支持 `@import` 的工具）保留自己的内容，并且可以
  同时使用多份共享文件。skillshare 会在文件顶部的受管区块中为每份共享文件加入一行，
  从不改动区块以外的任何内容。Claude 没有用户级的 `AGENTS.md`，所以它是通过这个区块
  读取共享文件的：

  ```markdown title="~/.claude/CLAUDE.md"
  <!-- skillshare:instructions:begin -->
  @/Users/you/.config/skillshare/extras/personal/AGENTS.md
  <!-- skillshare:instructions:end -->

  Your own Claude-only instructions stay here.
  ```

- **其他 target**（codex、gemini 等）使用一份共享文件。它们的文件会先备份，然后被替换为
  指向共享文件的链接（symlink）。

标签页左侧列出共享文件，每份都附上连接到它的 target。点击其中一份，右侧就会显示它的路径、
内容预览，以及每个 target 和对应的开关。选中的文件会写进 URL
（`/extras?tab=instructions&file=<name>`），因此通过链接可以直接打开那份文件。

- 打开某个 target 的开关即可连接它。import target 会多一行 import，并保留它的其他共享文件。
  已经在使用另一份共享文件的 target 会先询问，因为它只能使用一份。
- 关闭开关会[还原](#restore-and-delete)该 target，并且会先要求确认。对于 import target，
  只会去掉这份文件的 import 行，其他共享文件保留。
- **全部连接** 和 **全部还原** 在执行任何操作之前，会列出所有将被修改的 target，并说明每个
  target 会发生什么。只想修改部分 target 时，勾选它们的行，然后使用选择栏中的 **连接** 或
  **还原**。

有两个 target 比较特殊：

- antigravity 与 gemini 读取同一个 `~/.gemini/GEMINI.md`。当两者都是 target 时，antigravity
  的行会跟随 gemini，不能单独修改。
- cursor 不会出现在列表中：它的 User Rules 存在 Cursor 的设置里，而不是文件中。

## 管理一份共享文件 {#manage-one-shared-file}

每个已连接的 target 都会显示它的 mode（`import` 或 `symlink`）和状态：

| 状态 | 含义 |
|--------|---------|
| `synced` | 链接或 import 行已就位 |
| `modified` | 链接被替换成了内容不同的普通文件（[见下文](#when-a-linked-file-is-edited)） |
| `drift` | target 文件存在，但没有链接到共享文件，或不再有 import 行 |
| `not synced` | target 文件还不存在 |
| `no source` | 共享文件本身不存在 |

当有已连接的 target 处于 `drift` 或 `not synced` 时，标题会显示有多少个需要 sync，并提供
**同步** 按钮，把这份文件的链接和 import 行放回原位。

**编辑** 会在大尺寸编辑器中打开文件。侧边栏列出保存后会立即读到这份文件的 target，并对只
读取长文件前一部分的 target 给出警告。按 ⌘S（Ctrl+S）保存。上一个版本会被备份。

**⋯** 菜单可以复制文件路径，或删除这份共享文件。

### 还原与删除 {#restore-and-delete}

还原 target 会让它回到接上共享文件之前的状态。原本的文件或 symlink 会被放回；如果原本
没有文件，则删除该文件。对于 import target，只会移除 skillshare 的 import 行；skillshare
仅为该区块而创建的 `CLAUDE.md`，在变空后会被删除。共享文件本身会保留。如果 target 仍处于
`modified`，编辑过的文件会先保留为 [drift 备份](#backups)。

删除共享文件会将它从配置中移除，并还原所有使用它的 target。文件本身会保留在 extras
文件夹中。

## 当链接的文件被编辑时 {#when-a-linked-file-is-edited}

如果你或某个工具直接编辑了 target 的文件，链接被替换为内容不同的普通文件，其状态就会
变为 `modified`，该行会显示一条提示，提供两个选择：

- **收进**共享文件：修改写回共享文件，所有使用它的 target 都会获得这些修改。当前的共享
  文件会先备份。
- **用**共享文件**覆盖**：编辑过的文件会保留为 [drift 备份](#backups)，链接恢复。其他
  target 不受影响。

无论哪种方式，之后的还原仍会让 target 回到使用共享文件之前的状态，而不是编辑后的
版本。

`skillshare sync extras` 和 **同步** 也会不经询问地用链接替换 `modified` 的文件。修改会先
保留为 drift 备份，所以如果共享文件应该获得这些修改，请在同步之前选择 **收进**。

## skillshare 不认识的工具 {#tools-skillshare-doesnt-know}

对于没有已知指示文件的 target（例如
[自定义 target](../../reference/targets/adding-custom-targets.md)），标签页会询问
**这个工具读哪个文件**：

- 在 global mode 下，输入完整路径或以 `~/` 开头的路径。
- 在项目中，输入相对于项目根目录的路径。

如果该工具会展开 `@` 行，请勾选 **这个工具支持 @import**。这样它就能像 claude 一样同时
使用多份共享文件。该设置会以
[`instructions`](../../reference/targets/configuration.md#target-instructions) 保存在 target 上。添加工具时，也可以直接在 **添加目标** → **自定义目标** 中填写。

之后可以使用读取顺序下方的 **更改** 或 **移除设置** 来更新它。移除设置不会删除文件。
当 target 正在使用共享文件时，skillshare 会拒绝更改或移除该位置；请先把它切回自己的文件。

## 项目 {#projects}

在项目中运行 `skillshare ui -p`。在项目中，每个 target 都读取随 repo 纳入版本控制的同一个
`./AGENTS.md`，因此没有什么需要共享或 sync。**Extras** 下的 **AGENTS.md** 标签页会创建或
编辑该文件，并显示每个 target 能否读取它：

| 读取方式 | 含义 |
|-------------------|---------|
| 直接读取 | 该工具的项目文件就是 `AGENTS.md` |
| 没有 CLAUDE.md，所以会读取 AGENTS.md | claude 回退到读取 `AGENTS.md` |
| CLAUDE.md 导入了它 | 该工具自己的文件中有一行 `@AGENTS.md` |
| GEMINI.md 链接到它 | 该工具自己的文件是指向 `AGENTS.md` 的 symlink |
| 已有 CLAUDE.md，所以 claude 不会读取 AGENTS.md | 该工具自己的文件遮住了 `AGENTS.md` |
| 默认只读取 GEMINI.md | 该工具读取自己的文件，而该文件不存在 |

只读取自己文件的工具可以一键修正：**添加 @AGENTS.md** 会在 `CLAUDE.md` 顶部加入 import 行
（先备份），**添加 GEMINI.md** 会创建指向 `AGENTS.md` 的链接 `GEMINI.md`。

一个项目只有一份 `AGENTS.md`，因此无法分组。要把个人和工作的指令分开，请在 global mode
下使用共享文件。

target 标签页在项目中同样可用。此时读取顺序显示的是项目文件，而 **转换…** 还会为 claude
提供 **重命名**。

## 备份 {#backups}

skillshare 在替换、移除文件，或修改你写的内容之前，都会先备份该文件。添加或移除它自己的
import 行则不需要备份。每个文件最近的 10 个版本保存在 skillshare 的 state 目录中，在
macOS 和 Linux 上位于 `~/.local/state/skillshare/extras/backups/`（设置了
`$XDG_STATE_HOME` 时为 `$XDG_STATE_HOME/skillshare/extras/backups/`）。

还原使用的是接上共享文件时原本存在的内容，而不是最新的备份。被同步、覆盖或还原替换
掉的修改会进入单独的 `drift/` 文件夹，即 `extras/backups/<id>/drift/`，其中 `<id>` 由
target 文件的路径推导而来。还原从不会把这些放回去；如有需要，请手动复制回来。

关于共享文件背后的配置，以及同样能处理它们的 CLI 命令，请参见
[单文件 extras](../../reference/commands/extras.md#single-file-extras)。
