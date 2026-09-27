---
sidebar_position: 11
---

# 讓多個工具共用一份 AGENTS.md

每個 AI 工具都從自己的檔案讀取常設指示。Claude Code 讀 `CLAUDE.md`，Gemini CLI 讀
`GEMINI.md`，Codex 與大多數其他工具則讀 `AGENTS.md`，而且各自放在自己的資料夾裡。網頁
dashboard（`skillshare ui`）會顯示這些檔案、讓你編輯它們，也能讓多個工具共用同一份 `AGENTS.md`。

這是 dashboard 的功能，沒有獨立的 CLI 指令。共用 `AGENTS.md` 是以
[extra](../../reference/commands/extras.md#single-file-extras) 的形式儲存，所以
`skillshare sync extras` 也會讓它維持在正確位置。

## 查看 target 讀哪些檔案 {#see-what-a-target-reads}

從 **Targets** 開啟一個 target。它的頁面有一個以該 target 所讀檔案命名的分頁：claude 是
**CLAUDE.md**，gemini 是 **GEMINI.md**，codex 是 **AGENTS.md**。這個分頁會顯示：

- **讀取順序**：工具會載入的檔案，依載入順序編號，並標示 `loaded`、`skipped` 或 `missing`。
  claude 的讀取順序會包含 `~/.claude/rules/` 中的 Markdown 檔案，另外還有一列 `AGENTS.md`，
  註明 claude 不讀使用者層級的 `AGENTS.md`。
- 該檔案的編輯器。**儲存** 會先備份目前的檔案；若檔案還不存在，則會建立它。
- 警告。以 `@` 開頭的行是 import，只有部分工具會展開它們；其他工具會把它們當成一般文字讀取。
  Windsurf 只會讀取其全域 rules 檔案的前 6,000 個字元。
- **共用 AGENTS.md**（global mode）：這個 target 使用的共用檔案，以及一個用來選擇它們的連結。

如果檔案是指向共用 `AGENTS.md` 的連結，編輯器會是唯讀的。編輯它會改到所有使用該共用檔案的
target，所以請改到該檔案自己的頁面編輯。你自己建立的連結（例如指向你的 dotfiles）仍然可以編輯，
儲存時會寫入它所指向的檔案。

skillshare 知道這些指示檔案：

| Target | 使用者層級的檔案 | 專案檔案 | 會展開 `@` import |
|--------|-----------------|--------------|---------------------|
| amp | `~/.config/amp/AGENTS.md` | `AGENTS.md` | 否 |
| antigravity | `~/.gemini/GEMINI.md`（與 gemini 是同一個檔案） | `AGENTS.md` | 否 |
| claude | `~/.claude/CLAUDE.md`，加上 `~/.claude/rules/` | `CLAUDE.md`，沒有 `CLAUDE.md` 時則為 `AGENTS.md`，加上 `.claude/rules/` | 是 |
| codex | `~/.codex/AGENTS.md` | `AGENTS.md` | 否 |
| cursor | 無：User Rules 存在 Cursor 的設定裡 | `AGENTS.md` | 否 |
| gemini | `~/.gemini/GEMINI.md` | `GEMINI.md` | 否 |
| goose | `~/.config/goose/.goosehints` | `AGENTS.md` | 否 |
| kiro | `~/.kiro/steering/AGENTS.md` | `AGENTS.md` | 否 |
| opencode | `~/.config/opencode/AGENTS.md` | `AGENTS.md` | 否 |
| roo | `~/.roo/rules/AGENTS.md` | `AGENTS.md` | 否 |
| windsurf | `~/.codeium/windsurf/memories/global_rules.md`（前 6,000 個字元） | `AGENTS.md` | 否 |

Claude 或 Codex 的[第二個帳號](../../reference/targets/configuration.md#agent-config-dir)
會讀取自己 config 目錄中的同名檔案，例如 `~/.claude-work/CLAUDE.md`。至於其他 target，你可以
[告訴 skillshare 它讀哪個檔案](#tools-skillshare-doesnt-know)。

## 把 CLAUDE.md 轉換成 AGENTS.md {#convert-claudemd-to-agentsmd}

在 target 的分頁上點 **轉換…**，讓其他工具也能讀到它的內容。當檔案有內容可以搬移、且本身不是
`AGENTS.md` 時，才會出現這個按鈕。對話框會在寫入任何東西之前預覽每一項變更，而它變更或移除的
每個檔案都會先備份。

| 做法 | 結果 | 適用情況 |
|--------|--------|-----------|
| **搬到 AGENTS.md，CLAUDE.md 改成匯入它**（建議） | 內容搬到 `AGENTS.md`。`CLAUDE.md` 只剩一行 `@AGENTS.md`，以及只有 claude 看得懂的行 | 會展開 `@` import 的工具（claude） |
| **把 CLAUDE.md 改名成 AGENTS.md** | `CLAUDE.md` 會被移除，claude 改讀 `AGENTS.md` | 僅限專案，且工具在自己的檔案不存在時會改讀 `AGENTS.md`。當 `CLAUDE.local.md` 存在，或 `CLAUDE.md` 正在使用共用 `AGENTS.md` 時會拒絕執行（下次 sync 會把 `CLAUDE.md` 建回來） |
| **複製一份 AGENTS.md** | 兩個檔案都保留、各自編輯，所以內容之後會分岔 | 一律可用 |

檔名會跟著 target 變：gemini 的對話框只提供 **複製一份 AGENTS.md**。使用第一種做法時，
**把 @import 留在 CLAUDE.md** 預設為開啟，因為其他工具會把那些行當成一般文字讀取。

在使用者層級，沒有其他工具會讀 `~/.claude` 裡的 `AGENTS.md`。因此在 global mode 中，第一種做法
還會提供 **轉換成共用 AGENTS.md，讓其他目標也能接**，且預設為開啟：

- **新增一份…**：為新的共用 `AGENTS.md` 命名。內容會搬進去，`CLAUDE.md` 改成匯入它。
- 既有的共用檔案：內容會接在該檔案的最後面，`CLAUDE.md` 接著改成匯入它。

關閉共用時，內容會放到 `~/.claude/AGENTS.md`，`CLAUDE.md` 則會加上一行 `@AGENTS.md`。

## 在 global mode 共用一份 AGENTS.md {#share-one-agentsmd-in-global-mode}

前往 **Extras**，開啟 **AGENTS.md** 分頁。**新增共用 AGENTS.md** 會詢問名稱（英文字母、數字、
`-` 和 `_`）以及要從哪裡開始：

- **空白檔案**：在對話框中寫第一版內容。
- **把 claude 的檔案移進來**（或任何其他有檔案、且尚未使用共用檔案的 target）：該 target 目前的
  檔案會移進共用檔案，之後這個 target 就改用共用檔案。原檔會先備份。

每份共用檔案都儲存在 `<extras source>/<name>/AGENTS.md`，預設為
`~/.config/skillshare/extras/<name>/AGENTS.md`。

Target 使用共用檔案的方式，取決於它是否會展開 `@` import：

- **Import target**（claude，以及你標記為支援 `@import` 的工具）會保留自己的內容，並可同時使用
  多份共用檔案。skillshare 會在檔案頂端的受管理區塊中，為每份共用檔案加入一行，且絕不更動區塊
  以外的任何內容。Claude 沒有使用者層級的 `AGENTS.md`，所以它是透過這個區塊讀取共用檔案：

  ```markdown title="~/.claude/CLAUDE.md"
  <!-- skillshare:instructions:begin -->
  @/Users/you/.config/skillshare/extras/personal/AGENTS.md
  <!-- skillshare:instructions:end -->

  你自己只給 Claude 的指示留在這裡。
  ```

- **其他 target**（codex、gemini 及其餘工具）只使用一份共用檔案。它們的檔案會先備份，再換成
  指向共用檔案的連結（symlink）。

分頁左側列出共用檔案，每份都附上接上它的 target。點其中一份，右側就會顯示它的路徑、內容預覽，
以及每個 target 和它的開關。選取的檔案會寫進 URL（`/extras?tab=instructions&file=<name>`），
所以用連結就能直接開啟那份檔案。

- 打開 target 的開關就會接上。Import target 會多一行 import，其他共用檔案維持不變。已經在使用
  另一份共用檔案的 target 會先詢問，因為它只能用一份。
- 關掉開關會[還原](#restore-and-delete)該 target，並會先要求確認。對 import target 來說，只會拿掉
  這份檔案的 import 行，其他共用檔案保留。
- **全部接上** 與 **全部還原** 在動手之前，會先列出每個會變動的 target，並註明各自會發生什麼事。
  只想變更部分 target 時，勾選它們的列，再使用選取列上的 **接上** 或 **還原**。

有兩個 target 比較特別：

- antigravity 與 gemini 讀取同一個 `~/.gemini/GEMINI.md`。兩者都是 target 時，antigravity 那一列
  會跟著 gemini，無法單獨變更。
- cursor 不會列出：它的 User Rules 存在 Cursor 的設定裡，不是檔案。

## 管理單一共用檔案 {#manage-one-shared-file}

每個已接上的 target 都會顯示模式（`import` 或 `symlink`）與狀態：

| 狀態 | 意義 |
|--------|---------|
| `synced`（已同步） | 連結或 import 那一行都在正確位置 |
| `modified`（已修改） | 連結被換成內容不同的一般檔案（[見下方](#when-a-linked-file-is-edited)） |
| `drift`（有差異） | Target 檔案存在，但沒有連結到共用檔案，或已經沒有 import 那一行 |
| `not synced`（尚未同步） | Target 檔案還不存在 |
| `no source`（來源不存在） | 共用檔案本身不見了 |

當已接上的 target 是 `drift` 或 `not synced` 時，標題會顯示有幾個需要同步，並出現 **同步** 按鈕，
把這份檔案的連結與 import 行放回正確位置。

**編輯** 會在大型編輯器中開啟檔案。側邊面板會列出存檔後立即讀到新內容的 target，並警告哪些 target
只會讀取長檔案的一部分。按 ⌘S（Ctrl+S）儲存。前一個版本會先備份。

**⋯** 選單可以複製檔案路徑，或刪除這份共用檔案。

### 還原與刪除 {#restore-and-delete}

還原 target 會讓它回到接上共用檔案之前的樣子。原本的檔案或 symlink 會被放回；
若原本沒有檔案，就會刪除該檔案。對 import target 來說，只會移除 skillshare 的 import 行；若
`CLAUDE.md` 是 skillshare 只為了這個區塊而建立的，它在清空後就會被移除。共用檔案本身會保留。
若 target 仍是 `modified`，會先把修改過的檔案保存為 [drift backup](#backups)。

刪除共用檔案會把它從設定中移除，並還原所有使用它的 target。檔案本身會留在 extras 資料夾中。

## 已連結的檔案被修改時 {#when-a-linked-file-is-edited}

如果你或某個工具直接編輯了 target 的檔案，讓連結被換成內容不同的一般檔案，它的狀態就會變成
`modified`，該列會出現一則附有兩個選項的提示：

- **收進** 共用檔案：改動會寫進共用檔案，所有使用它的 target 都會拿到。目前的共用檔案會先備份。
- **用** 共用檔案 **覆蓋**：修改過的檔案會保存為 [drift backup](#backups)，並換回連結。其他 target
  不受影響。

無論選哪一種，之後的還原仍會讓 target 回到使用共用檔案之前的樣子，而不是修改過的版本。

`skillshare sync extras` 與 **同步** 也會不經詢問，直接把 `modified` 的檔案換回連結。改動會先保存為
drift backup，所以如果共用檔案應該拿到這些改動，請在同步之前選擇 **收進**。

## skillshare 不認得的工具 {#tools-skillshare-doesnt-know}

對於沒有已知指示檔案的 target，例如
[自訂 target](../../reference/targets/adding-custom-targets.md)，分頁會詢問
**這個工具讀哪個檔案**：

- 在 global mode 中，輸入完整路徑，或以 `~/` 開頭的路徑。
- 在專案中，輸入相對於專案根目錄的路徑。

如果這個工具會展開 `@` 行，請勾選 **這個工具支援 @import**。這樣它就能像 claude 一樣同時使用多份
共用檔案。這項設定會以 [`instructions`](../../reference/targets/configuration.md#target-instructions)
儲存在 target 上。新增工具時，也可以直接在 **新增目標** → **自訂目標** 裡填好。

之後可以用讀取順序下方的 **變更** 或 **移除設定** 來更新它。移除設定不會刪除檔案。當 target 正在
使用共用檔案時，skillshare 會拒絕變更或移除這個位置；請先把它切回自己的檔案。

## 專案 {#projects}

在專案中執行 `skillshare ui -p`。在專案裡，每個 target 都讀取同一個跟著 repository 進版控的
`./AGENTS.md`，所以沒有東西需要共用或 sync。**Extras** 底下的 **AGENTS.md** 分頁會建立或編輯
這個檔案，並顯示每個 target 能否讀到它：

| 怎麼讀到 | 意義 |
|-------------------|---------|
| 直接讀 | 工具的專案檔案就是 `AGENTS.md` |
| 沒有 CLAUDE.md，所以會讀 AGENTS.md | claude 會改讀 `AGENTS.md` |
| CLAUDE.md 匯入了它 | 工具自己的檔案有一行 `@AGENTS.md` |
| GEMINI.md 連結到它 | 工具自己的檔案是指向 `AGENTS.md` 的 symlink |
| 已有 CLAUDE.md，所以 claude 不會讀 AGENTS.md | 工具自己的檔案蓋過了 `AGENTS.md` |
| 預設只讀 GEMINI.md | 工具只讀自己的檔案，而該檔案不存在 |

只讀自己檔案的工具可以一鍵修正：**補上 @AGENTS.md** 會在 `CLAUDE.md` 頂端加入 import 行（會先備份），
**補上 GEMINI.md** 則會建立一個連結到 `AGENTS.md` 的 `GEMINI.md`。

專案只有一個 `AGENTS.md`，所以不能分組。要把個人和公司的指示分開，請在 global mode 使用共用檔案。

Target 分頁在專案中同樣可用。在那裡，讀取順序會顯示專案檔案，而 claude 的 **轉換…** 還會提供
**改名** 的做法。

## 備份 {#backups}

skillshare 在取代、移除檔案，或更動你寫的內容之前，都會先備份該檔案。加入或移除它自己的 import 行
則不需要備份。每個檔案最近的 10 個版本會保存在 skillshare 的 state 目錄中，在 macOS 與 Linux 上是
`~/.local/state/skillshare/extras/backups/`（有設定 `$XDG_STATE_HOME` 時則為
`$XDG_STATE_HOME/skillshare/extras/backups/`）。

還原使用的是接上共用檔案時原本存在的內容，而不是最新的備份。被同步、覆蓋或還原取代的改動，
會放到另一個 `drift/` 資料夾，也就是 `extras/backups/<id>/drift/`，其中 `<id>` 由 target 檔案的路徑
推導而來。還原絕不會把這些放回去；如果需要，請手動複製回來。

關於共用檔案背後的設定，以及也能處理它們的 CLI 指令，請參閱
[單一檔案 extra](../../reference/commands/extras.md#single-file-extras)。
