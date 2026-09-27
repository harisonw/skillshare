---
sidebar_position: 11
---

# Share one AGENTS.md across your tools

Each AI tool reads its standing instructions from its own file. Claude Code reads
`CLAUDE.md`, Gemini CLI reads `GEMINI.md`, and Codex and most other tools read
`AGENTS.md`, each in its own folder. The web dashboard (`skillshare ui`) shows these
files, lets you edit them, and can give several tools one shared `AGENTS.md`.

This is a dashboard feature. There is no separate CLI command. A shared `AGENTS.md`
is stored as an [extra](../../reference/commands/extras.md#single-file-extras), so
`skillshare sync extras` also keeps it in place.

## See what a target reads

Open a target from **Targets**. Its page has a tab named after the file that target
reads: **CLAUDE.md** for claude, **GEMINI.md** for gemini, **AGENTS.md** for codex.
The tab shows:

- **Read order**: the files the tool loads, numbered in the order it loads them and
  marked `loaded`, `skipped` or `missing`. For claude this includes the Markdown files
  in `~/.claude/rules/`, plus an `AGENTS.md` row noting that claude doesn't read a
  user-level `AGENTS.md`.
- An editor for the file. **Save** backs up the current file first, and creates the
  file if it doesn't exist yet.
- Warnings. Lines that start with `@` are imports, and only some tools expand them;
  other tools read them as plain text. Windsurf reads only the first 6,000 characters
  of its global rules file.
- **Shared AGENTS.md** (global mode): the shared files this target uses, and a link
  to choose them.

If the file is a link to a shared `AGENTS.md`, the editor is read-only. Editing it
would change every target that uses the shared file, so edit that file on its own
page instead. A link you made yourself, such as one into your dotfiles, stays
editable, and saving writes through to the file it points to.

skillshare knows these instruction files:

| Target | User-level file | Project file | Follows `@` imports |
|--------|-----------------|--------------|---------------------|
| amp | `~/.config/amp/AGENTS.md` | `AGENTS.md` | No |
| antigravity | `~/.gemini/GEMINI.md` (the same file as gemini) | `AGENTS.md` | No |
| claude | `~/.claude/CLAUDE.md`, plus `~/.claude/rules/` | `CLAUDE.md`, or `AGENTS.md` when there is no `CLAUDE.md`, plus `.claude/rules/` | Yes |
| codex | `~/.codex/AGENTS.md` | `AGENTS.md` | No |
| cursor | None: user rules live in Cursor's settings | `AGENTS.md` | No |
| gemini | `~/.gemini/GEMINI.md` | `GEMINI.md` | No |
| goose | `~/.config/goose/.goosehints` | `AGENTS.md` | No |
| kiro | `~/.kiro/steering/AGENTS.md` | `AGENTS.md` | No |
| opencode | `~/.config/opencode/AGENTS.md` | `AGENTS.md` | No |
| roo | `~/.roo/rules/AGENTS.md` | `AGENTS.md` | No |
| windsurf | `~/.codeium/windsurf/memories/global_rules.md` (first 6,000 characters) | `AGENTS.md` | No |

A [second account](../../reference/targets/configuration.md#agent-config-dir) of
Claude or Codex reads the same file inside its own config directory, for example
`~/.claude-work/CLAUDE.md`. For any other target, you
[tell skillshare which file it reads](#tools-skillshare-doesnt-know).

## Convert CLAUDE.md to AGENTS.md

Click **Convert…** on the target's tab to make its content readable by other tools.
The button appears when the file has content to move and isn't already an
`AGENTS.md`. The dialog previews every change before anything is written, and each
file it changes or removes is backed up first.

| Method | Result | Available |
|--------|--------|-----------|
| **Move to AGENTS.md, CLAUDE.md imports it** (recommended) | The content moves to `AGENTS.md`. `CLAUDE.md` keeps only an `@AGENTS.md` line and the lines only claude understands | Tools that follow `@` imports (claude) |
| **Rename CLAUDE.md to AGENTS.md** | `CLAUDE.md` is removed and claude reads `AGENTS.md` in its place | Projects only, for a tool that reads `AGENTS.md` when its own file is missing. Refused while a `CLAUDE.local.md` exists, or while `CLAUDE.md` uses a shared `AGENTS.md` (the next sync would bring `CLAUDE.md` back) |
| **Copy to AGENTS.md** | Both files stay and are edited separately, so they will drift apart | Always |

The file names follow the target: for gemini the dialog offers **Copy to
AGENTS.md** only. With the first method, **Leave the @import lines in CLAUDE.md**
is on by default, because other tools would read those lines as plain text.

At user level, no other tool reads an `AGENTS.md` in `~/.claude`. So in global mode
the first method also offers **Make it a shared AGENTS.md other targets can use**,
which is on by default:

- **New one…**: name a new shared `AGENTS.md`. The content moves into it and
  `CLAUDE.md` imports it.
- An existing shared file: the content goes at the end of that file, and
  `CLAUDE.md` then imports it.

With sharing off, the content goes to `~/.claude/AGENTS.md` and `CLAUDE.md` gets an
`@AGENTS.md` line.

## Share one AGENTS.md in global mode

Go to **Extras** and open the **AGENTS.md** tab. **New shared AGENTS.md** asks for a
name (letters, digits, `-` and `_`) and where to start:

- **Empty file**: write the first version in the dialog.
- **Move claude's file here** (or any other target that has a file and doesn't use a
  shared one yet): the target's current file moves into the shared file, and the
  target uses the shared file from then on. The original is backed up first.

Each shared file is stored at `<extras source>/<name>/AGENTS.md`, by default
`~/.config/skillshare/extras/<name>/AGENTS.md`.

How a target uses a shared file depends on whether it follows `@` imports:

- **Import targets** (claude, and tools you mark as supporting `@import`) keep their
  own content and can use several shared files at once. skillshare adds one line per
  shared file inside a managed block at the top of the file and never changes
  anything outside the block. Claude has no user-level `AGENTS.md`, so this block is
  how it reads a shared one:

  ```markdown title="~/.claude/CLAUDE.md"
  <!-- skillshare:instructions:begin -->
  @/Users/you/.config/skillshare/extras/personal/AGENTS.md
  <!-- skillshare:instructions:end -->

  Your own Claude-only instructions stay here.
  ```

- **Other targets** (codex, gemini and the rest) use one shared file. Their file is
  backed up, then replaced by a link (symlink) to the shared file.

The tab lists the shared files on the left, each with the targets connected to it.
Click one to show it on the right: its path, a preview of its content, and every
target with a switch. The selected file is part of the URL
(`/extras?tab=instructions&file=<name>`), so a link opens that file directly.

- Turn a target's switch on to connect it. An import target gets one more import line
  and keeps its other shared files. A target that already uses another shared file
  asks first, because it can use only one.
- Turn the switch off to [restore](#restore-and-delete) the target. It asks for
  confirmation first. For an import target only this file's import line goes; its
  other shared files stay.
- **Connect all** and **Restore all** list every target they change, with a note on
  what happens to each one, before they do anything. To change only some targets,
  tick their rows and use **Connect** or **Restore** in the selection bar.

Two targets are special:

- antigravity reads the same `~/.gemini/GEMINI.md` as gemini. When both are
  targets, antigravity's row follows gemini and can't be changed on its own.
- cursor isn't listed: its user rules live in Cursor's settings, not in a file.

## Manage one shared file

Each connected target shows its mode (`import` or `symlink`) and its status:

| Status | Meaning |
|--------|---------|
| `synced` | The link or import line is in place |
| `modified` | The link was replaced by a regular file with different content ([see below](#when-a-linked-file-is-edited)) |
| `drift` | The target file exists but isn't linked to the shared file, or no longer has the import line |
| `not synced` | The target file doesn't exist yet |
| `no source` | The shared file itself is missing |

When a connected target is `drift` or `not synced`, the heading shows how many need a
sync and a **Sync** button that puts the links and import lines of this file back in
place.

**Edit** opens the file in a large editor. The side panel lists the targets that read
the saved file right away, and warns about targets that read only part of a long file.
Press ⌘S (Ctrl+S) to save. The previous version is backed up.

The **⋯** menu copies the file's path or deletes the shared file.

### Restore and delete

Restoring a target returns it to how it was before the shared file was attached. The
file or symlink that was there is put back, or the file is removed if there was none.
For an import target, only skillshare's import line is removed; a `CLAUDE.md` that
skillshare created just for the block is removed once it is empty. The shared file
itself is kept. If the target is still `modified`, the edited file is first kept as a
[drift backup](#backups).

Deleting a shared file removes it from the config and restores every target that used
it. The file stays in the extras folder.

## When a linked file is edited

If you or a tool edit a target's file directly and the link is replaced by a regular
file with different content, its status becomes `modified` and the row shows a note
with two choices:

- **Collect into** the shared file: the edit goes into the shared file, and every
  target using it gets the change. The current shared file is backed up first.
- **Overwrite with** the shared file: the edited file is kept as a
  [drift backup](#backups), and the link comes back. Other targets are not affected.

Either way, a later restore still returns the target to how it was before it used the
shared file, not to the edited version.

`skillshare sync extras` and **Sync** also replace a `modified` file with the link
without asking. The edit is kept as a drift backup first, so choose **Collect into**
before syncing if the shared file should get it.

## Tools skillshare doesn't know

For a target without a known instruction file, such as a
[custom target](../../reference/targets/adding-custom-targets.md), the tab asks
**Which instruction file does this tool read?**:

- In global mode, enter a full path or one that starts with `~/`.
- In a project, enter a path relative to the project root.

Tick **This tool supports @import** if the tool follows `@` lines. It can then use
several shared files at once, like claude. The setting is saved on the target as
[`instructions`](../../reference/targets/configuration.md#target-instructions).
You can also fill it in when you add the tool with **Add target** → **Custom target**.

Use **Change** or **Remove setting** under the read order to update it later.
Removing the setting doesn't delete the file. skillshare refuses to change or remove
the location while the target uses shared files; switch it back to its own file
first.

## Projects

Run `skillshare ui -p` in the project. In a project, every target reads the one
`./AGENTS.md` that is tracked with the repository, so there is nothing to share or
sync. The **AGENTS.md** tab under **Extras** creates or edits that file and shows
whether each target can read it:

| How it gets there | Meaning |
|-------------------|---------|
| Reads it directly | The tool's project file is `AGENTS.md` |
| Reads it because there is no `CLAUDE.md` | claude falls back to `AGENTS.md` |
| `CLAUDE.md` imports it | The tool's own file has an `@AGENTS.md` line |
| `GEMINI.md` links to it | The tool's own file is a symlink to `AGENTS.md` |
| `CLAUDE.md` exists, so claude doesn't read `AGENTS.md` | The tool's own file hides `AGENTS.md` |
| Reads only `GEMINI.md` by default | The tool reads its own file, which doesn't exist |

Tools that only read their own file get a one-click fix: **Add @AGENTS.md** adds the
import line at the top of `CLAUDE.md` (backing it up first), and **Add GEMINI.md**
creates `GEMINI.md` as a link to `AGENTS.md`.

A project has one `AGENTS.md`, so it can't be split into groups. To keep personal and
work instructions apart, use shared files in global mode.

The target tabs work in projects too. There the read order shows the project files,
and **Convert…** also offers **Rename** for claude.

## Backups

skillshare backs up a file before it replaces it, removes it, or changes content
you wrote. Adding or removing its own import line needs no backup. The last 10
versions of each file are kept in skillshare's state directory, under
`~/.local/state/skillshare/extras/backups/` on macOS and Linux
(`$XDG_STATE_HOME/skillshare/extras/backups/` when that variable is set).

Restore uses what was there when the shared file was attached, not the newest
backup. Edits that Sync, Overwrite or Restore replace go to a separate `drift/`
folder, `extras/backups/<id>/drift/`, where `<id>` is derived from the target
file's path. Restore never puts those back; copy one back by hand if you need it.

For the configuration behind shared files and the CLI commands that also handle
them, see [single-file extras](../../reference/commands/extras.md#single-file-extras).
