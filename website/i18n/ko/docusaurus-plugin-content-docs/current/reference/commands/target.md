---
sidebar_position: 1
---

# target

sync target(AI CLI skill 디렉터리)을 관리합니다.

```bash
skillshare target add <name> <path>    # Add a target
skillshare target remove <name>        # Remove a target
skillshare target list                 # List all targets
skillshare target <name>               # Show target info
skillshare target <name> --mode merge  # Change sync mode
skillshare target <name> --target-naming standard  # Change naming
```

## 언제 사용하나요

- 새 AI CLI 도구를 설치한 후 새 target을 추가할 때
- 더 이상 사용하지 않는 target을 제거할 때
- target의 sync mode(merge, copy, symlink)를 변경할 때
- target의 naming(flat 또는 standard)을 변경할 때
- 하나의 global mode를 강제하는 대신 target별로 호환성을 조정할 때
- 선택적 skill 동기화를 위한 include/exclude 필터를 설정할 때

## 하위 명령어

### target add

skill 동기화를 위한 새 target을 추가합니다.

```bash
skillshare target add windsurf ~/.windsurf/skills
```

이 명령은 다음을 검증합니다.
- 경로가 존재하거나 상위 디렉터리가 존재함
- 경로가 skill 디렉터리처럼 보임
- target 이름이 고유함

#### Another account of an Agent {#another-account}

`CLAUDE_CONFIG_DIR=~/.claude-work`로 실행하는 Claude Code, `CODEX_HOME`을 쓰는 Codex, `PI_CODING_AGENT_DIR`을 쓰는 Pi처럼 Agent의 두 번째 계정을 별도의 config 디렉터리에서 사용한다면, 그 디렉터리를 target으로 추가하세요. Skillshare가 그 디렉터리에서 skills와 agents 경로를 알아냅니다.

```bash
skillshare target add claude-work --agent claude --config-dir ~/.claude-work
# Added target: claude-work -> ~/.claude-work/skills
```

가지고 있는 계정 수만큼, 각각 고유한 이름으로 추가하세요. 이 이름은 [MCP target](./mcp.md#accounts)으로도 사용할 수 있으므로, 한 번의 sync로 모든 계정의 skill, agent, MCP 서버에 반영됩니다.

`--agent`는 `claude`(`CLAUDE_CONFIG_DIR`), `codex`(`CODEX_HOME`), `pi`(`PI_CODING_AGENT_DIR`)를 받습니다. Codex나 Pi 계정은 skill을 `<config_dir>/skills`로 동기화하며, agents 디렉터리를 함께 가지는 것은 Claude뿐입니다. 디렉터리는 절대 경로이거나 `~`로 시작해야 하고, Agent의 기본 디렉터리여서는 안 되며, 두 target이 함께 사용할 수 없습니다.

이런 target을 제거할 때 MCP 때문에 실패하는 일은 없습니다. `mcp.targets`나 어떤 서버의 `targets`가 여전히 그 이름을 가리키고 있어도, `skillshare target remove`는 target을 제거하고 그쪽에서도 이름을 빼라고 경고합니다.

### target remove

target을 제거하고 해당 skill을 일반 디렉터리로 복원합니다.

```bash
skillshare target remove cursor           # Remove single target
skillshare target remove --all            # Remove all targets
skillshare target remove cursor --dry-run # Preview
```

**진행 과정:**
1. target의 백업을 생성합니다
2. sync mode를 감지합니다.
   - **Symlink mode:** 디렉터리 symlink를 제거하고 source 콘텐츠를 실제 디렉터리로 다시 복사합니다
   - **Merge mode:** source를 가리키는 symlink만(경로 접두사 기준) 제거하고 각 skill을 실제 파일로 다시 복사합니다. 로컬(symlink가 아닌) skill은 보존됩니다.
   - **Copy mode:** `.skillshare-manifest.json`을 제거합니다. 관리되는 복사본과 로컬 skill은 일반 디렉터리로 보존됩니다.
3. config에서 target을 제거합니다

같은 skills 폴더에 쓰는 다른 target이 있으면(예: `codex`와 `universal`은 둘 다 `~/.agents/skills`를 사용) 2단계를 건너뜁니다. skills는 그 target을 위해 링크된 채 남고, 제거한 target만 config에서 빠집니다.

### target list

구성된 모든 target을 나열합니다.

```bash
skillshare target list                 # Interactive TUI (default on TTY)
skillshare target list --no-tui        # Plain text output
skillshare target list --json          # JSON output for CI/scripts
```

#### Interactive TUI

TTY에서 `target list`를 실행하면 다음 기능을 갖춘 대화형 터미널 UI가 실행됩니다.

- **분할 레이아웃** — 왼쪽에 target 목록, 오른쪽에 detail panel(좁은 터미널에서는 세로 레이아웃으로 대체)
- **퍼지 필터** — `/`를 눌러 이름으로 target을 필터링
- **Mode picker** — `M`을 눌러 선택한 target의 sync mode(merge, copy, symlink)를 변경
- **Naming picker** — `N`을 눌러 선택한 target의 naming(flat, standard)을 변경
- **Include/Exclude 편집기** — `I` 또는 `E`를 눌러 선택한 target의 필터 패턴 편집기를 엽니다. `a`로 패턴 추가, `d`로 삭제
- **Remove target** — `R`을 눌러 선택한 target을 제거합니다. 진행 전에 확인 프롬프트를 표시합니다(백업 후 연결 해제, `target remove`와 동일)
- **키보드 탐색** — `↑`/`↓`로 탐색, `Ctrl+d`/`Ctrl+u`로 detail panel 스크롤, `q`로 종료

TUI를 통한 변경 사항(mode, include/exclude)은 즉시 config에 저장됩니다. 적용하려면 `skillshare sync`를 실행하세요.

TUI를 건너뛰고 일반 텍스트를 출력하려면 `--no-tui`를 사용하세요.

```
Configured Targets
  claude       ~/.claude/skills (merge)
  cursor       ~/.cursor/skills (merge)
  codex        ~/.openai-codex/skills (symlink)
```

#### JSON Output

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

target 세부 정보를 표시하거나 설정을 변경합니다.

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

## Sync Modes

| Mode | Behavior |
|------|----------|
| `merge` | 각 skill이 개별적으로 symlink됩니다. 로컬 skill을 보존합니다. **기본값.** |
| `copy` | 각 skill이 실제 파일로 복사됩니다. symlink를 따라갈 수 없는 AI CLI용. |
| `symlink` | 디렉터리 전체가 하나의 symlink입니다. 모든 곳에서 정확히 동일한 복사본. |

`target --mode`는 주된 호환성 제어 수단입니다. global 기본값은 단순하게 유지하고, 필요한 곳에서만 재정의하세요.

## Target Naming

| Naming | Behavior |
|--------|----------|
| `flat` | 중첩된 skill이 `__` 구분자로 평탄화됩니다(예: `frontend__dev`). **기본값.** |
| `standard` | SKILL.md의 `name` 필드를 그대로 사용합니다(예: `dev`). [Agent Skills spec](https://agentskills.io/specification)을 따릅니다. |

`target --target-naming`은 target에서 skill 디렉터리의 이름 지정 방식을 제어합니다. `standard` mode에서는 이름이 유효하지 않거나 충돌하는 skill에 대해 경고가 표시되고 건너뜁니다. symlink mode에서는 무시됩니다.

```bash
# Set target to copy mode (for Cursor, Copilot CLI, etc.)
skillshare target cursor --mode copy
skillshare sync  # Apply the change
```

### 혼합 전략 예시

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

CLI에서 skill과 agent 모두에 대해 target별 include/exclude 필터를 관리합니다.

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

필터를 변경한 후에는 `skillshare sync`를 실행해 적용하세요.

필터는 **merge 및 copy mode**에서 동작합니다. 패턴은 Go `filepath.Match` 문법(`*`, `?`, `[...]`)을 사용합니다. symlink mode에서는 필터가 무시됩니다.

Agent 필터는 빌트인 target 정의 또는 config의 명시적 `agents.path` 재정의를 통해 agents 경로를 가진 target에서만 사용할 수 있습니다.

패턴 치트 시트와 시나리오는 [Configuration](/docs/reference/targets/configuration#include--exclude-target-filters)을 참조하세요.

:::tip
Target 필터는 세 가지 필터링 계층 중 하나입니다. `.skillignore` 및 SKILL.md `targets`와 어떻게 상호작용하는지는 [Filtering Reference](/docs/reference/filtering)를 참조하세요.
:::

## 옵션

### target add

| Flag | Description |
|------|-------------|
| `--agent <agent>` | 경로 대신 이 Agent의 [다른 계정](#another-account)을 추가합니다. `--config-dir`과 함께 사용 |
| `--config-dir <dir>` | 해당 계정이 사용하는 config 디렉터리 |

### target remove

| Flag | Description |
|------|-------------|
| `--all, -a` | 모든 target 제거 |
| `--dry-run, -n` | 변경 없이 미리보기 |

### target list

| Flag | Description |
|------|-------------|
| `--json` | JSON으로 출력 |
| `--no-tui` | 대화형 TUI 비활성화, 일반 텍스트 출력 사용 |

### target info / settings

| Flag | Description |
|------|-------------|
| `--mode, -m <mode>` | sync mode 설정(merge, copy, symlink) |
| `--agent-mode <mode>` | agents sync mode 설정(merge, copy, symlink) |
| `--target-naming <naming>` | target naming 설정(flat 또는 standard) |
| `--add-include <pattern>` | include 필터 패턴 추가 |
| `--add-exclude <pattern>` | exclude 필터 패턴 추가 |
| `--remove-include <pattern>` | include 필터 패턴 제거 |
| `--remove-exclude <pattern>` | exclude 필터 패턴 제거 |
| `--add-agent-include <pattern>` | agent include 필터 패턴 추가 |
| `--add-agent-exclude <pattern>` | agent exclude 필터 패턴 추가 |
| `--remove-agent-include <pattern>` | agent include 필터 패턴 제거 |
| `--remove-agent-exclude <pattern>` | agent exclude 필터 패턴 제거 |

## Supported AI CLIs

skillshare는 `init` 중에 다음을 자동 감지합니다.

| CLI | Default Path |
|-----|-------------|
| Claude Code | `~/.claude/skills` |
| Cursor | `~/.cursor/skills` |
| OpenCode | `~/.opencode/skills` |
| Windsurf | `~/.windsurf/skills` |
| Codex | `~/.openai-codex/skills` |
| Antigravity (앱) | `~/.gemini/config/skills` |
| Antigravity CLI | `~/.gemini/antigravity-cli/skills` |
| Gemini CLI | `~/.gemini/skills` |
| Amp | `~/.amp/skills` |
| ... 그 외 45개 이상 | [지원 target](/docs/reference/targets/supported-targets) 참조 |

## 예시

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

현재 project의 target을 관리합니다.

```bash
skillshare target add windsurf -p                                # Add known target
skillshare target add custom ./tools/ai/skills -p                # Add custom path
skillshare target remove cursor -p                                # Remove target
skillshare target list -p                                         # List project targets
skillshare target claude -p                                  # Show target info
skillshare target claude --add-include "team-*" -p          # Add filter
skillshare target claude --add-agent-include "team-*" -p    # Add agent filter
```

### 차이점

| | Global | Project (`-p`) |
|---|---|---|
| Config | `~/.config/skillshare/config.yaml` | `.skillshare/config.yaml` |
| Paths | 절대 경로(예: `~/.claude/skills`) | 상대 또는 절대 경로(예: `.claude/skills`) |
| Sync mode | Merge, copy, symlink | Merge, copy, symlink(기본값 merge) |
| Mode change | `--mode` flag | `--mode` flag |

### Project Target List 예시

```
Project Targets
  claude    .claude/skills (merge)
  cursor         .cursor/skills (merge)
  custom-tool    ./tools/ai/skills (merge)
```

Project mode의 target은 다음을 지원합니다.
- **알려진 target 이름**(예: `claude`, `cursor`) — project 로컬 경로로 해석됨
- **커스텀 경로** — project 루트 기준 상대 경로 또는 `~` 확장을 포함한 절대 경로

## 참고

- [sync](/docs/reference/commands/sync) — target에 skill 동기화
- [status](/docs/reference/commands/status) — target 상태 표시
- [Targets](/docs/reference/targets) — target 관리 가이드
- [Project Skills](/docs/understand/project-skills) — project mode 개념
