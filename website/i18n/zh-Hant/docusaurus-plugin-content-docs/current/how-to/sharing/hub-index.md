---
sidebar_position: 4
---

# Hub Index 指南

為你的組織建立一個集中式的 skill 目錄 — 不需要 GitHub API 或 token。

## 為什麼要使用 Hub Index？

Hub index 是一個 JSON 檔案（`skillshare-hub.json`），列出 skills 的名稱、描述與 source。將它架設在內部，每位團隊成員都能從中搜尋並安裝 skills。

| 使用情境 | GitHub Search | Hub Index |
|----------|--------------|-----------|
| 全組織的 skill 目錄 | 否 | **是** |
| 私有／內部 skills | 否 | **是** |
| 實體隔離／僅限 VPN 的環境 | 否 | **是** |
| 經過篩選、核准的 skill 集合 | 否 | **是** |
| 不需要 GitHub token | 否 | **是** |

真實案例請參閱 [Public Hub](#public-hub) 一節。

## 快速開始

### 1. 建立索引

```bash
# 從你的 global skills
skillshare hub index

# 從某個 project
skillshare hub index -p

# 輸出：<source>/skillshare-hub.json
```

### 2. 搜尋索引

```bash
# 本機檔案
skillshare search react --hub ./skillshare-hub.json

# 遠端 URL
skillshare search react --hub https://internal.corp/skills/skillshare-hub.json

# 瀏覽所有 skills（不帶查詢字串）
skillshare search --hub ./skillshare-hub.json --json
```

### 3. 從搜尋結果安裝

互動式搜尋流程與 GitHub search 的運作方式相同 — 選取一個 skill 就會將它安裝。

## Audit 強化

為你的索引加上安全風險分數，讓隊友一眼就能看出 skill 的安全性：

```bash
# 建立含有 audit 分數的索引
skillshare hub index --audit

# 搭配完整 metadata
skillshare hub index --full --audit
```

使用 `--audit` 時，每個 skill 都會以 `skillshare audit` 的規則掃描，索引會包含 `riskScore`（0–100）、`riskLabel`（clean/low/medium/high/critical）與 `auditedAt` 時間戳記。掃描失敗的 skills 仍會被納入，但不含風險欄位。

來自已稽核索引的搜尋結果會顯示風險徽章：

```
  1. safe-skill               owner/repo/safe-skill         [clean]
  2. risky-skill              owner/repo/risky-skill        [high]
```

## 分享策略

### 檔案分享（最簡單）

將索引檔複製到共用位置：

```bash
skillshare hub index -o /shared/team/skillshare-hub.json
```

隊友可以這樣搜尋：
```bash
skillshare search --hub /shared/team/skillshare-hub.json
```

### HTTP 伺服器

在本機產生索引，再上傳到你的主機：

```bash
# 步驟 1：產生
skillshare hub index -o ./skillshare-hub.json

# 步驟 2：上傳（使用你偏好的方式）
scp ./skillshare-hub.json server:/var/www/skills/
# 或者：aws s3 cp ./skillshare-hub.json s3://my-bucket/
# 或者：rsync、FTP 等
```

隊友可以這樣搜尋：
```bash
skillshare search --hub https://skills.company.com/skillshare-hub.json
```

### Git Repository

將索引提交到共用的 repo，讓隊友可以 pull：

```bash
skillshare hub index -o ./skillshare-hub.json
git add skillshare-hub.json && git commit -m "Update skill index"
git push
```

隊友可以透過 raw URL、SSH，或是複製到本機後搜尋：
```bash
# 透過 raw URL
skillshare search --hub https://raw.githubusercontent.com/team/skills/main/skillshare-hub.json

# 透過 SSH — 會 clone repo 並讀取索引（不需要手動 clone）
skillshare search --hub git@github.com:team/skills.git
skillshare search --hub git@ghe.corp.com:team/skills.git//hubs/team.json

# 或者 clone 後在本機搜尋
git pull
skillshare search --hub ./skillshare-hub.json
```

:::tip 私有與 GitHub Enterprise repos
SSH hub source 會使用你的 SSH agent/金鑰進行 clone，因此適用於私有 repo，以及 raw HTTPS URL 會被重新導向到登入頁面的 GitHub Enterprise（GHE）主機。repo 內的索引路徑來自 `//path` 後綴，預設為 repo 根目錄下的 `skillshare-hub.json`。scp 風格（`git@host:org/repo.git`）與 scheme 風格（`ssh://git@host/org/repo.git`）的 URL 都可以使用。使用 [`hub add`](/docs/reference/commands/hub#hub-add) 儲存一次，之後就能用標籤搜尋。

當一個 GitHub/GHE hub 是透過 SSH 載入時，同一 host、帶有網域前綴的 skill source 會繼承該 hub 的 SSH 身分。舉例來說，hub URL 為 `acme@acme.ghe.com:Org/skills.git//hubs/team.json` 時，項目 source `acme.ghe.com/Org/skills/skills/reviewer` 就能透過 SSH 安裝。如果 hub 是透過 HTTP、本機檔案，或不同的 host 載入，帶有網域前綴的 source 仍會維持 HTTPS source。
:::

## Web Dashboard

### 不寫 JSON 也能建立 Hub

在 dashboard（`skillshare ui`）中開啟 **Skills → Hubs → My hubs → New Hub**。

1. 為草稿命名並填寫（選用的）描述。這些資訊僅用於在本機識別草稿；不會包含在匯出的索引中。
2. 選擇 **Choose installed skills**，挑選要分享的 skills 並新增。或使用 **Add source manually**。
3. 編輯每個 skill 的顯示名稱、描述、標籤與安裝 source。例如，`runkids/demo-skills/skills/pdf` 用來識別遠端 repository 中的某個 skill。**Advanced** 區塊保留了一個選用的 `skill` 選擇器，供包含多個 skills 的 repository 使用。
4. 選擇 **Save draft**。頁面會檢查每個項目，並顯示任何阻擋匯出的問題。
5. 選擇 **Download index** 以取得 `skillshare-hub.json`。
6. 將下載的檔案提交到你自己的 Git repository，或上傳到 HTTP 伺服器。在頁面中輸入該位置，即可複製一段供接收者使用的 `skillshare hub add` 指令。

下圖的草稿中，有一個 skill 只有本機 source，因此在補上遠端 source 之前無法匯出：

![My hubs：一份 hub 草稿，其中一個項目無法匯出](/img/hub-builder-draft.png)

下載動作**不會**發布任何東西。目錄只是參照 skills，並不會打包它們的檔案。Source 驗證只會檢查語法，不會確認 repository 是否存在，或接收者是否有權限。私有 repositories 仍然需要存取權限。

:::tip 本機的 skills 可以留在草稿中
沒有已知遠端來源的已安裝 skill，仍會以其本機 source 顯示。你可以將它儲存在草稿中。在你提供遠端安裝 source 或移除該項目之前，匯出會被阻擋；建構工具絕不會默默地將它排除。
:::

### 繼續編輯或匯入目錄

草稿會儲存在執行 dashboard 的機器上，位於目前使用中設定檔旁邊的 `hub-drafts/` 目錄。Global 與 project 設定各自擁有獨立的草稿。重新載入前請先使用 **Save draft**。若帶著未儲存的變更離開，系統會提示你捨棄它們；來自過期視窗的儲存動作會被拒絕，以避免覆寫較新的修訂版本。**Reload saved draft** 會取得最新版本。

對於既有的 v1 `skillshare-hub.json`（上限 4 MB），請使用 **Import JSON**。不支援的版本與無效的欄位類型會產生錯誤。顯示名稱相同的項目仍會各自獨立。額外的 JSON 欄位與 `skill` 選擇器會被保留。如果較舊的索引包含 `sourcePath`，相對 source 會被解析為本機路徑，與現有的索引讀取器行為一致；在匯出前必須將它們改為遠端 source。

可攜式匯出會移除作者的 `sourcePath` 與已知的本機 metadata（`relPath`、`flatName`、`installedAt`、`isInRepo`）。它只包含索引本身，不含草稿的名稱、描述、ID 或修訂版本。變更項目的 source 或 skill 選擇器，會清除它先前的 audit 分數、標籤與時間戳記。URL 中的憑證、查詢字串與片段會被拒絕；請另外設定 repository 的驗證方式。

**Delete draft** 會要求確認，並只會刪除該份草稿。它不會解除安裝 skills、刪除已架設的索引，或移除已訂閱的 Hub。

### 搜尋已分享的 Hub

1. 開啟 **Skills → Install**。
2. 從搜尋 source 選擇器中選擇一個 Hub。使用安裝對話框中的 Hub manager 新增 URL、SSH repository，或本機索引路徑。
3. 搜尋、預覽並安裝 skills。

已訂閱的 Hub source 會儲存在目前使用中的 skillshare 設定中，並與 CLI 共用。它們與 **My hubs** 中的草稿是分開的。

既有的 `skillshare hub index` 指令與 `/api/hub/index` 端點仍會如往常一樣產生索引，包括支援本機 source。上述的可攜式匯出規則同樣適用於 dashboard 的建構工具。

## 索引結構描述

索引遵循 Schema v1：

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

### 必要欄位（消費端契約）

| 欄位 | 是否必要 | 說明 |
|-------|----------|------|
| `name` | 是 | Skill 顯示名稱 |
| `source` | 是 | 安裝 source（GitHub 簡寫、URL，或本機路徑） |
| `description` | 建議 | 用於搜尋比對的簡短描述 |
| `skill` | 否 | 多 skill repo 中特定 skill 的名稱（搭配 `install -s` 使用） |
| `tags` | 否 | 用於篩選與分組的分類標籤 |

### 文件層級欄位

| 欄位 | 說明 |
|-------|-------------|
| `schemaVersion` | 恆為 `1` |
| `generatedAt` | RFC 3339 時間戳記 |
| `sourcePath` | 用於解析相對 source 的基準路徑 |

### Source 路徑解析

當設定了 `sourcePath`，且某個 skill 的 `source` 是相對路徑時，搜尋端會將兩者結合：

```
sourcePath: /home/user/.config/skillshare/skills
source:     _team/frontend-skill
→ resolved: /home/user/.config/skillshare/skills/_team/frontend-skill
```

這可以避免相對路徑被誤判為 GitHub 簡寫（`owner/repo`）。

絕對路徑、URL，以及帶有網域前綴的路徑絕對不會被結合：

| Source 模式 | 是否結合？ |
|----------------|---------|
| `_team/my-skill` | 是 |
| `subdir/skill` | 是 |
| `/absolute/path` | 否 |
| `github.com/owner/repo/skill` | 否 |
| `https://...` | 否 |

## 手寫索引

你可以不使用 `hub index`，手動建立一份索引。這對架設在私有基礎設施上的內部 skills 特別有用 — 這些 source 是 GitHub Search 與公開工具永遠無法觸及的：

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

:::tip 為什麼不直接用 GitHub Search？
`skillshare search` 只能找到 github.com 上的公開 repo。Hub index 則能指向**任何** source — GitHub Enterprise、私有 GitLab、內部伺服器 — 這些都只有在 VPN 後方的員工才能存取。這正是 hub 成為全組織 skill 發佈首選方案的原因。
:::

手寫索引的小技巧：
- `sourcePath` 是選用的 — 如果所有 source 都是絕對路徑就可以省略
- `tags` 是選用的 — 有助於在網站或搜尋中進行篩選
- `name` 為空的 skills 會被略過
- 結果會依名稱按字母順序排序
- 若是僅支援 SSH 的 GitHub Enterprise 安裝，建議使用明確的 SSH source（`user@host:owner/repo.git//path`），或透過 SSH 載入 hub 本身，讓同一 host 的 GitHub/GHE 網域前綴項目繼承該 SSH 身分

## Organization Deployment

在組織中推行 hub 的典型端對端工作流程：

```bash
# 1. Skill 管理員從內部 repo 中篩選 skills
skillshare install ghe.internal.company.com/platform/ai-skills/coding-standards
skillshare install ghe.internal.company.com/platform/ai-skills/review-checklist
skillshare install ghe.internal.company.com/security/ai-skills/threat-model

# 2. 產生 hub index（可選擇附上 audit 分數）
skillshare hub index --audit -o ./skillshare-hub.json

# 3. 架設它（擇一）
#    - 內部 Git repo：commit 並 push
#    - S3/CDN：aws s3 cp ./skillshare-hub.json s3://skills-bucket/
#    - Intranet 伺服器：scp 到你的主機

# 4. 團隊成員新增此 hub 一次
skillshare hub add https://skills.internal.company.com/skillshare-hub.json --label company

# 5. 搜尋並安裝 — 僅能在 VPN 後方存取
skillshare search coding --hub company
```

若要讓索引保持最新，可以將 `skillshare hub index` 加入在 skill 變更後執行的 CI pipeline。

## Public Hub

[skillshare-hub](https://github.com/runkids/skillshare-hub) 是一個經過篩選的優質 skill 目錄。它是**預設的 hub** — 當你執行 `search --hub` 而未指定 source 時，就會搜尋這裡：

```bash
skillshare search --hub              # Browse all skills in the public hub
skillshare search react --hub        # Search for "react" skills
```

它也可以作為建立你自己組織 hub 的參考：

- **索引結構** — 如何用名稱、描述、source 與標籤組織 `skillshare-hub.json`
- **CI 驗證** — 在每個 PR 上自動進行 JSON 格式檢查與 `skillshare audit` 安全掃描
- **貢獻工作流程** — Fork → 新增項目 → PR，並附帶 CI 關卡

想為你的團隊建立內部 hub？Fork 這個 repo，將 skills 換成你組織的目錄，並自訂 CI pipeline 以符合你的安全政策。

## 小技巧

- **自動化索引產生** — 在 skill 變更後，將 `skillshare hub index` 加入你的 CI pipeline
- **稽核時使用 `--full`** — Full 模式會包含版本、安裝日期與類型資訊
- **搭配 project mode 使用** — `skillshare hub index -p` 只會索引 project 層級的 skills

---

## 參見

- [search](/docs/reference/commands/search) — 從 hubs 搜尋 skills
- [hub](/docs/reference/commands/hub) — 管理 hub sources
- [install](/docs/reference/commands/install) — 安裝找到的 skills
