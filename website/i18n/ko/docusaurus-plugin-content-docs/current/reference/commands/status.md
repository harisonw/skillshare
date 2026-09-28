---
sidebar_position: 7
---

# status

skillshare의 현재 상태(source, tracked repository, target, 버전)를 표시합니다.

```bash
skillshare status
```

## 사용 시점

- 변경 사항을 적용한 후 모든 target이 sync 상태인지 확인
- 어떤 target에 `sync` 실행이 필요한지 확인
- tracked repo가 최신 상태인지 확인
- 활성 audit policy(profile, threshold, dedupe mode)를 확인
- CLI 또는 skill 업데이트 여부 확인

## 출력 예시

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

## 섹션

### Source

source 디렉터리 위치, skill 개수, 마지막 수정 시간을 표시합니다. agent가 구성되어 있으면 agent source가 별도 줄에 표시됩니다.

### Tracked Repositories

`--track`으로 설치된 git repository를 나열합니다. 다음을 표시합니다.
- repository별 skill 개수
- git 상태(up-to-date 또는 변경 사항 있음)

### Targets

각 target은 **skills**와 **agents**에 대한 하위 항목을 가진 헤더로 표시됩니다.

```
claude
  skills   merged       [merge] ~/.claude/skills (8 shared, 2 local)
  agents   merged       [merge] 8/8 linked
```

**skills 하위 항목**은 다음을 표시합니다.
- **Sync mode**: `merge`, `copy`, 또는 `symlink`
- **Path**: target 디렉터리 위치
- **Status**: `merged`, `copied`, `linked`, `has files`, 또는 `needs sync`
- **Shared/local 개수**: merge와 copy mode에서는 해당 target의 expected set(`include`/`exclude` filter 적용 후)을 기준으로 개수를 계산합니다. copy mode는 "shared" 대신 "managed"를 표시합니다.

**agents 하위 항목**은 다음을 표시합니다.
- **Sync mode**: agents가 실제로 sync되는 mode. Developer Mode가 없는 Windows에서는 agent 파일을 링크하지 않고 복사하므로 `merge`가 `[copy]`로 표시됩니다
- **Status**: `merged`, `copied`, `linked`, 또는 `drift`
- **Linked 개수**: 예) `8/8 linked` (최신 상태의 복사본도 linked로 집계). copy fallback에서는 skillshare가 소유하지 않는 내용이 같은 로컬 파일을 유지하고 따로 표시합니다(예: `0/1 linked, 1 local preserved`)

agent source가 존재하지 않거나 target에 agent path가 구성되어 있지 않으면 agents 하위 항목은 생략됩니다.

| Status | 의미 |
|--------|---------|
| `merged` | skill/agent가 개별적으로 symlink됨 |
| `copied` | skill이 실제 파일로 복사됨(manifest 포함) |
| `linked` | 전체 디렉터리가 symlink됨 |
| `has files` | 아직 sync되지 않음 |
| `needs sync` | mode가 변경됨, 적용하려면 `sync` 실행 |
| `drift` | 일부 agent가 누락됨 — `sync agents` 실행 |

### Extras

extras가 구성되어 있으면 각 extra의 sync 상태를 표시합니다.

```
Extras
rules        has files  [merge] .cursor/rules (4 files)
commands     has files  [merge] .claude/commands (3 files)
```

각 항목은 이름, 상태, sync mode, target 경로, file 개수를 표시합니다. sync mode는 파일이 실제로 sync되는 mode입니다. Developer Mode가 없는 Windows에서는 파일을 링크하는 target이 `[copy]`로 표시됩니다.

### Audit

활성 audit policy 구성(CLI flag, project config, 또는 global config에서 resolve됨)을 표시합니다.

- **Profile**: `DEFAULT`, `STRICT`, 또는 `PERMISSIVE`
- **Block**: 차단을 위한 severity threshold(기본값 `CRITICAL`)
- **Dedupe**: 중복 제거 mode(`GLOBAL` 또는 `LEGACY`)
- **Analyzers**: 활성화된 analyzer(`ALL` 또는 필터링된 목록)

### Version

CLI와 skill 버전을 최신 릴리스와 비교합니다. (Global mode 전용.)

## 옵션

| Flag | 설명 |
|------|-------------|
| `--json` | JSON으로 출력(scripting/CI용) |
| `--project, -p` | project mode 사용 |
| `--global, -g` | global mode 사용 |
| `--help, -h` | 도움말 표시 |

## JSON 출력

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

`source.skillignore` 필드는 `.skillignore` 또는 `.skillignore.local` file이 하나 이상 존재할 때만 나타납니다. 없을 경우: `"skillignore": { "active": false }`. `files` 배열은 존재하는 경우 `.skillignore.local` 경로를 포함합니다. text mode에서는 `.skillignore.local`이 적용 중이면 source 줄에 `.local active`가 표시됩니다.

JSON 출력은 global mode와 project mode 모두에서 지원됩니다.

## Project Mode

project 디렉터리에서는 status가 project 관련 정보를 표시합니다. 첫 번째 섹션 헤더에 `Source (project)`가 표시되어 project mode임을 나타냅니다.

```bash
skillshare status        # .skillshare/가 존재하면 자동 감지
skillshare status -p     # 명시적 project mode
```

### 출력 예시

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

Project status는 Tracked Repositories나 Version 섹션을 표시하지 않습니다(이들은 global 전용 기능입니다).

## 참고

- [sync](/docs/reference/commands/sync) — target으로 skill sync
- [diff](/docs/reference/commands/diff) — 상세한 차이점 표시
- [doctor](/docs/reference/commands/doctor) — 문제 진단
- [Project Skills](/docs/understand/project-skills) — project mode 개념
