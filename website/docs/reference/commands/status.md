---
sidebar_position: 7
---

# status

Show the current state of skillshare: source, tracked repositories, targets, and versions.

```bash
skillshare status
```

## When to Use

- Check if all targets are in sync after making changes
- See which targets need a `sync` run
- Verify tracked repos are up to date
- Verify the active audit policy (profile, threshold, dedupe mode)
- Check for CLI or skill updates

## Example Output

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

## Sections

### Source

Shows the source directory location, skill count, and last modified time. When agents are configured, the agents source is shown on a separate line.

### Tracked Repositories

Lists git repositories installed with `--track`. Shows:
- Skill count per repository
- Git status (up-to-date or has changes)

### Targets

Each target is shown as a header with sub-items for **skills** and **agents**:

```
claude
  skills   merged       [merge] ~/.claude/skills (8 shared, 2 local)
  agents   merged       [merge] 8/8 linked
```

**Skills sub-item** shows:
- **Sync mode**: `merge`, `copy`, or `symlink`
- **Path**: Target directory location
- **Status**: `merged`, `copied`, `linked`, `has files`, or `needs sync`
- **Shared/local counts**: In merge and copy modes, counts use that target's expected set (after `include`/`exclude` filters). Copy mode shows "managed" instead of "shared".

**Agents sub-item** shows:
- **Sync mode**: the mode agents actually sync with. On Windows without Developer Mode, `merge` shows as `[copy]` because agent files are copied instead of linked
- **Status**: `merged`, `copied`, `linked`, or `drift`
- **Linked count**: e.g. `8/8 linked` (up-to-date copies count as linked). In copy fallback, identical local files that skillshare does not own are kept and shown separately, e.g. `0/1 linked, 1 local preserved`

If agents source does not exist or the target has no agent path configured, the agents sub-item is omitted.

| Status | Meaning |
|--------|---------|
| `merged` | Skills/agents are symlinked individually |
| `copied` | Skills are copied as real files (with manifest) |
| `linked` | Entire directory is symlinked |
| `has files` | Not yet synced |
| `needs sync` | Mode changed, run `sync` to apply |
| `drift` | Some agents are missing — run `sync agents` |

### Extras

When extras are configured, shows each extra's sync status:

```
Extras
rules        has files  [merge] .cursor/rules (4 files)
commands     has files  [merge] .claude/commands (3 files)
```

Each entry shows the name, status, sync mode, target path, and file count. The sync mode is the one files are actually synced with: on Windows without Developer Mode, a target that links files shows `[copy]`.

### Audit

Shows the active audit policy configuration (resolved from CLI flags, project config, or global config):

- **Profile**: `DEFAULT`, `STRICT`, or `PERMISSIVE`
- **Block**: severity threshold for blocking (`CRITICAL` by default)
- **Dedupe**: deduplication mode (`GLOBAL` or `LEGACY`)
- **Analyzers**: enabled analyzers (`ALL` or a filtered list)

### Version

Compares your CLI and skill versions against the latest releases. (Global mode only.)

## Options

| Flag | Description |
|------|-------------|
| `--json` | Output as JSON (for scripting/CI) |
| `--project, -p` | Use project mode |
| `--global, -g` | Use global mode |
| `--help, -h` | Show help |

## JSON Output

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

The `source.skillignore` field is present only when at least one `.skillignore` or `.skillignore.local` file exists. When absent: `"skillignore": { "active": false }`. The `files` array includes `.skillignore.local` paths when present. In text mode, the source line shows `.local active` when any `.skillignore.local` is in effect.

JSON output is supported in both global and project mode.

## Project Mode

In a project directory, status shows project-specific information. The first section header shows `Source (project)` to indicate project mode:

```bash
skillshare status        # Auto-detected if .skillshare/ exists
skillshare status -p     # Explicit project mode
```

### Example Output

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

Project status does not show Tracked Repositories or Version sections (these are global-only features).

## See Also

- [sync](/docs/reference/commands/sync) — Sync skills to targets
- [diff](/docs/reference/commands/diff) — Show detailed differences
- [doctor](/docs/reference/commands/doctor) — Diagnose issues
- [Project Skills](/docs/understand/project-skills) — Project mode concepts
