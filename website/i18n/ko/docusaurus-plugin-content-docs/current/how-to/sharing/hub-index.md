---
sidebar_position: 4
---

# Hub Index 가이드

GitHub API나 토큰 없이 조직을 위한 중앙 집중식 Skill 카탈로그를 구축합니다.

## Hub Index를 사용하는 이유

Hub index는 Skill의 이름, 설명, Source를 나열하는 JSON 파일(`skillshare-hub.json`)입니다. 내부적으로 호스팅하면 모든 팀원이 여기서 Skill을 검색하고 설치할 수 있습니다.

| 사용 사례 | GitHub 검색 | Hub Index |
|----------|--------------|-----------|
| 조직 전체 Skill 카탈로그 | 아니오 | **예** |
| 비공개/내부 Skill | 아니오 | **예** |
| 에어갭 / VPN 전용 환경 | 아니오 | **예** |
| 큐레이션된, 승인된 Skill 세트 | 아니오 | **예** |
| GitHub 토큰 불필요 | 아니오 | **예** |

실제 사례는 [Public Hub](#public-hub) 섹션을 참고하세요.

## 빠른 시작

### 1. Index 생성

```bash
# Global Skill로부터
skillshare hub index

# Project로부터
skillshare hub index -p

# 출력: <source>/skillshare-hub.json
```

### 2. Index 검색

```bash
# 로컬 파일
skillshare search react --hub ./skillshare-hub.json

# 원격 URL
skillshare search react --hub https://internal.corp/skills/skillshare-hub.json

# 모든 Skill 둘러보기 (쿼리 없음)
skillshare search --hub ./skillshare-hub.json --json
```

### 3. 결과에서 설치

대화형 검색 흐름은 GitHub 검색과 동일하게 동작합니다 — Skill을 선택하면 설치됩니다.

## Audit 정보 추가

팀원이 한눈에 Skill의 안전성을 확인할 수 있도록 index에 보안 위험 점수를 추가하세요:

```bash
# Audit 점수와 함께 index 생성
skillshare hub index --audit

# 전체 메타데이터와 결합
skillshare hub index --full --audit
```

`--audit`을 사용하면 각 Skill이 `skillshare audit` 규칙으로 스캔되며, index에는 `riskScore`(0~100), `riskLabel`(clean/low/medium/high/critical), `auditedAt` 타임스탬프가 포함됩니다. 스캔에 실패한 Skill은 위험 필드 없이 포함됩니다.

Audit된 index에서 나온 검색 결과에는 위험 배지가 표시됩니다:

```
  1. safe-skill               owner/repo/safe-skill         [clean]
  2. risky-skill              owner/repo/risky-skill        [high]
```

## 공유 전략

### 파일 공유 (가장 간단함)

Index 파일을 공유 위치에 복사하세요:

```bash
skillshare hub index -o /shared/team/skillshare-hub.json
```

팀원은 다음으로 검색합니다:
```bash
skillshare search --hub /shared/team/skillshare-hub.json
```

### HTTP 서버

로컬에서 index를 생성한 다음 호스팅에 업로드하세요:

```bash
# 1단계: 생성
skillshare hub index -o ./skillshare-hub.json

# 2단계: 업로드 (원하는 방법 사용)
scp ./skillshare-hub.json server:/var/www/skills/
# 또는: aws s3 cp ./skillshare-hub.json s3://my-bucket/
# 또는: rsync, FTP 등
```

팀원은 다음으로 검색합니다:
```bash
skillshare search --hub https://skills.company.com/skillshare-hub.json
```

### Git 저장소

Index를 공유 저장소에 커밋하여 팀원이 pull할 수 있도록 하세요:

```bash
skillshare hub index -o ./skillshare-hub.json
git add skillshare-hub.json && git commit -m "Update skill index"
git push
```

팀원은 raw URL, SSH, 또는 로컬 clone을 통해 검색할 수 있습니다:
```bash
# raw URL을 통해
skillshare search --hub https://raw.githubusercontent.com/team/skills/main/skillshare-hub.json

# SSH를 통해 — 저장소를 clone하고 index를 읽습니다 (수동 clone 불필요)
skillshare search --hub git@github.com:team/skills.git
skillshare search --hub git@ghe.corp.com:team/skills.git//hubs/team.json

# 또는 clone 후 로컬에서 검색
git pull
skillshare search --hub ./skillshare-hub.json
```

:::tip 비공개 및 GitHub Enterprise 저장소
SSH Hub Source는 여러분의 SSH 에이전트/키로 clone되므로, raw HTTPS URL이 로그인 페이지로 리디렉션되는 비공개 저장소나 GitHub Enterprise(GHE) 호스트에서도 동작합니다. 저장소 내부의 index 경로는 `//path` 접미사에서 가져오며, 기본값은 저장소 루트의 `skillshare-hub.json`입니다. scp 스타일(`git@host:org/repo.git`)과 scheme 스타일(`ssh://git@host/org/repo.git`) URL 모두 동작합니다. [`hub add`](/docs/reference/commands/hub#hub-add)로 한 번 저장해 두면 라벨로 검색할 수 있습니다.

GitHub/GHE Hub가 SSH로 로드되면, 동일한 호스트의 도메인 접두사가 붙은 Skill Source는 Hub의 SSH ID를 상속받습니다. 예를 들어 `acme@acme.ghe.com:Org/skills.git//hubs/team.json`이라는 Hub URL을 사용하면 `acme.ghe.com/Org/skills/skills/reviewer`라는 항목 Source가 SSH로 설치될 수 있습니다. Hub가 HTTP, 로컬 파일, 또는 다른 호스트로 로드된 경우 도메인 접두사가 붙은 Source는 HTTPS Source로 남습니다.
:::

## 웹 대시보드

### JSON을 작성하지 않고 Hub 만들기

대시보드(`skillshare ui`)에서 **Skills → Hubs → My hubs → New Hub**를 여세요.

1. 초안에 이름과 선택적 설명을 지정하세요. 이는 로컬에서 초안을 식별하는 용도이며 내보낸 index에는 포함되지 않습니다.
2. **Choose installed skills**를 선택하고 공유할 Skill을 선택해 추가하세요. 또는 **Add source manually**를 사용하세요.
3. 각 Skill의 표시 이름, 설명, 태그, 설치 Source를 편집하세요. 예를 들어 `runkids/demo-skills/skills/pdf`는 원격 저장소 내부의 Skill을 식별합니다. **Advanced** 섹션은 여러 Skill을 포함하는 저장소를 위한 선택적 `skill` 셀렉터를 유지합니다.
4. **Save draft**를 선택하세요. 페이지가 모든 항목을 검사하고 내보내기를 막는 문제가 있으면 표시합니다.
5. **Download index**를 선택해 `skillshare-hub.json`을 받으세요.
6. 다운로드한 파일을 자신의 Git 저장소에 커밋하거나 HTTP 서버에 업로드하세요. 페이지에 해당 위치를 입력하면 수신자를 위한 `skillshare hub add` 명령을 복사할 수 있습니다.

아래 초안에서는 한 Skill의 Source가 로컬뿐이라 원격 Source를 지정하기 전까지 내보낼 수 없습니다.

![My hubs: 한 항목이 내보내기에서 막힌 Hub 초안](/img/hub-builder-draft.png)

다운로드는 아무것도 게시하지 **않습니다**. 카탈로그는 Skill을 참조할 뿐 파일을 번들로 포함하지 않습니다. Source 검증은 문법만 확인하며, 저장소가 실제로 존재하는지 또는 수신자가 권한을 가지고 있는지는 확인하지 않습니다. 비공개 저장소는 여전히 접근 권한이 필요합니다.

:::tip 로컬 Skill도 초안에 유지할 수 있습니다
원격 origin을 알 수 없는 설치된 Skill은 로컬 Source와 함께 계속 표시됩니다. 이를 초안에 저장할 수 있습니다. 원격 설치 Source를 제공하거나 해당 항목을 제거할 때까지 내보내기가 차단됩니다. 빌더는 이를 조용히 누락시키지 않습니다.
:::

### 카탈로그 재개 또는 가져오기

초안은 대시보드를 실행하는 머신에서 활성 설정 파일 옆의 `hub-drafts/`에 저장됩니다. Global 및 Project 설정은 별도의 초안을 가집니다. 다시 로드하기 전에 **Save draft**를 사용하세요. 저장하지 않은 변경 사항이 있는 채로 나가면 변경 사항을 버릴지 묻는 메시지가 표시되며, 오래된 창에서의 저장은 최신 리비전을 덮어쓰지 못하도록 거부됩니다. **Reload saved draft**는 최신 버전을 가져옵니다.

기존 v1 `skillshare-hub.json`(최대 4MB)을 가져오려면 **Import JSON**을 사용하세요. 지원되지 않는 버전과 잘못된 필드 유형은 오류를 발생시킵니다. 표시 이름이 같은 항목도 별도로 유지됩니다. 추가 JSON 필드와 `skill` 셀렉터는 보존됩니다. 이전 index에 `sourcePath`가 포함되어 있다면, 기존 index 리더와 마찬가지로 상대 Source가 로컬 경로로 해석됩니다. 내보내기 전에 원격 Source로 변경해야 합니다.

이식 가능한 내보내기는 작성자의 `sourcePath`와 알려진 로컬 메타데이터(`relPath`, `flatName`, `installedAt`, `isInRepo`)를 제거합니다. 여기에는 초안의 이름, 설명, ID, 리비전이 아니라 index만 포함됩니다. 항목의 Source나 skill 셀렉터를 변경하면 이전의 audit 점수, 라벨, 타임스탬프가 지워집니다. URL 자격 증명, 쿼리 문자열, 프래그먼트는 거부됩니다. 저장소 인증은 별도로 구성하세요.

**Delete draft**는 확인을 요청하며 해당 초안만 삭제합니다. Skill을 제거하거나, 호스팅된 index를 삭제하거나, 구독한 Hub를 제거하지 않습니다.

### 공유된 Hub 검색

1. **Skills → Install**을 여세요.
2. 검색 소스 선택기에서 Hub를 선택하세요. 설치 대화상자의 Hub manager를 사용해 URL, SSH 저장소, 또는 로컬 index 경로를 추가하세요.
3. Skill을 검색, 미리보기, 설치하세요.

구독한 Hub Source는 활성 skillshare 설정에 저장되며 CLI와 공유됩니다. 이는 **My hubs**의 초안과는 별개입니다.

기존의 `skillshare hub index` 명령과 `/api/hub/index` 엔드포인트는 로컬 Source 지원을 포함해 이전과 동일하게 index를 생성합니다. 위의 이식 가능한 내보내기 규칙은 대시보드 빌더에도 적용됩니다.

## Index 스키마

Index는 Schema v1을 따릅니다:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-02-12T10:00:00Z",
  "sourcePath": "/home/user/.config/skillshare/skills",
  "skills": [
    {
      "name": "my-skill",
      "description": "Does something useful",
      "source": "owner/repo/.claude/skills/my-skill",
      "tags": ["workflow", "productivity"]
    }
  ]
}
```

### 필수 필드 (소비자 계약)

| 필드 | 필수 | 설명 |
|-------|----------|-------------|
| `name` | 예 | Skill 표시 이름 |
| `source` | 예 | 설치 Source (GitHub 축약형, URL, 또는 로컬 경로) |
| `description` | 권장 | 검색 매칭을 위한 짧은 설명 |
| `skill` | 아니오 | 여러 Skill을 포함하는 저장소 내의 특정 Skill 이름 (`install -s`와 함께 사용) |
| `tags` | 아니오 | 필터링과 그룹화를 위한 분류 태그 |

### 문서 수준 필드

| 필드 | 설명 |
|-------|-------------|
| `schemaVersion` | 항상 `1` |
| `generatedAt` | RFC 3339 타임스탬프 |
| `sourcePath` | 상대 Source를 해석하기 위한 기준 경로 |

### Source 경로 해석

`sourcePath`가 설정되어 있고 Skill의 `source`가 상대 경로인 경우, 검색 소비자가 이를 결합합니다:

```
sourcePath: /home/user/.config/skillshare/skills
source:     _team/frontend-skill
→ resolved: /home/user/.config/skillshare/skills/_team/frontend-skill
```

이렇게 하면 상대 경로가 GitHub 축약형(`owner/repo`)으로 잘못 해석되는 것을 방지합니다.

절대 경로, URL, 도메인 접두사가 붙은 경로는 절대 결합되지 않습니다:

| Source 패턴 | 결합됨? |
|----------------|---------|
| `_team/my-skill` | 예 |
| `subdir/skill` | 예 |
| `/absolute/path` | 아니오 |
| `github.com/owner/repo/skill` | 아니오 |
| `https://...` | 아니오 |

## 수동 작성 Index

`hub index`를 사용하지 않고도 수동으로 index를 만들 수 있습니다. 이는 GitHub 검색과 공개 도구가 도달할 수 없는 Source인, 비공개 인프라에서 호스팅되는 내부 Skill에 특히 유용합니다:

```json
{
  "schemaVersion": 1,
  "skills": [
    {
      "name": "company-style",
      "description": "Company coding standards and review checklist",
      "source": "ghe.internal.company.com/platform/ai-skills/company-style",
      "tags": ["quality", "workflow"]
    },
    {
      "name": "deploy-helper",
      "description": "Internal deployment automation",
      "source": "gitlab.internal.company.com/ops/skills/deploy-helper",
      "tags": ["devops"]
    },
    {
      "name": "onboarding",
      "description": "New hire onboarding skill for AI assistants",
      "source": "ghe.internal.company.com/hr/ai-skills/onboarding",
      "tags": ["workflow"]
    }
  ]
}
```

:::tip GitHub 검색만 사용하면 안 되나요?
`skillshare search`는 github.com의 공개 저장소만 찾습니다. Hub index는 GitHub Enterprise, 비공개 GitLab, 내부 서버 등 **모든** Source를 가리킬 수 있습니다 — VPN 뒤에 있는 직원만 접근할 수 있는 것들입니다. 이것이 Hub가 조직 전체 Skill 배포의 최선책이 되는 이유입니다.
:::

수동 작성 index를 위한 팁:
- `sourcePath`는 선택 사항입니다 — 모든 Source가 절대 경로라면 생략하세요
- `tags`는 선택 사항입니다 — 웹사이트나 검색에서 필터링에 유용합니다
- `name`이 비어 있는 Skill은 건너뜁니다
- 결과는 이름 알파벳순으로 정렬됩니다
- SSH 전용 GitHub Enterprise 설치의 경우, 명시적인 SSH Source(`user@host:owner/repo.git//path`)를 사용하거나 Hub 자체를 SSH로 로드하여 동일 호스트의 GitHub/GHE 도메인 접두사 항목이 해당 SSH ID를 상속받도록 하세요

## 조직 배포

조직 전체에 Hub를 배포하는 일반적인 end-to-end 워크플로:

```bash
# 1. Skill 관리자가 내부 저장소에서 Skill을 큐레이션합니다
skillshare install ghe.internal.company.com/platform/ai-skills/coding-standards
skillshare install ghe.internal.company.com/platform/ai-skills/review-checklist
skillshare install ghe.internal.company.com/security/ai-skills/threat-model

# 2. Hub index를 생성합니다 (선택적으로 audit 점수 포함)
skillshare hub index --audit -o ./skillshare-hub.json

# 3. 호스팅합니다 (하나를 선택하세요)
#    - 내부 Git 저장소: 커밋 후 push
#    - S3/CDN: aws s3 cp ./skillshare-hub.json s3://skills-bucket/
#    - 인트라넷 서버: 호스팅에 scp

# 4. 팀원이 Hub를 한 번 추가합니다
skillshare hub add https://skills.internal.company.com/skillshare-hub.json --label company

# 5. 검색하고 설치합니다 — VPN 뒤에서만 접근 가능
skillshare search coding --hub company
```

Index를 최신 상태로 유지하려면 Skill이 변경된 후 실행되는 CI 파이프라인에 `skillshare hub index`를 추가하세요.

## Public Hub

[skillshare-hub](https://github.com/runkids/skillshare-hub)는 엄선된 양질의 Skill 카탈로그입니다. 이는 **기본 Hub**로, Source를 지정하지 않고 `search --hub`를 실행하면 여기에서 검색합니다:

```bash
skillshare search --hub              # Public Hub의 모든 Skill 둘러보기
skillshare search react --hub        # "react" Skill 검색
```

이는 또한 조직 고유의 Hub를 구축하기 위한 참고 자료 역할도 합니다:

- **Index 구조** — 이름, 설명, Source, 태그로 `skillshare-hub.json`을 구성하는 방법
- **CI 검증** — 모든 PR에서 자동화된 JSON 형식 검사와 `skillshare audit` 보안 스캔
- **기여 워크플로** — Fork → 항목 추가 → PR, CI 게이트 포함

팀을 위한 내부 Hub를 구축하고 싶으신가요? 저장소를 Fork하고, Skill을 조직의 카탈로그로 교체한 다음, 보안 정책에 맞게 CI 파이프라인을 커스터마이즈하세요.

## 팁

- **Index 생성 자동화** — Skill 변경 후 CI 파이프라인에 `skillshare hub index`를 추가하세요
- **Audit에는 `--full`을 사용하세요** — 전체 모드에는 버전, 설치 날짜, 유형 정보가 포함됩니다
- **Project mode와 결합** — `skillshare hub index -p`는 Project 레벨 Skill만 index합니다

---

## 참고 자료

- [search](/docs/reference/commands/search) — Hub에서 Skill 검색
- [hub](/docs/reference/commands/hub) — Hub Source 관리
- [install](/docs/reference/commands/install) — 발견된 Skill 설치
