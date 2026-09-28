---
sidebar_position: 4
---

# Hub Index ガイド

組織のための集中管理された Skill カタログを構築します — GitHub API もトークンも不要です。

## なぜ Hub Index を使うのか？

Hub index は、Skill の名前、説明、Source を列挙した JSON ファイル（`skillshare-hub.json`）です。
社内でホストすれば、すべてのチームメンバーがそこから Skill を検索・インストールできます。

| ユースケース | GitHub 検索 | Hub Index |
|----------|--------------|-----------|
| 組織全体の Skill カタログ | いいえ | **はい** |
| プライベート/社内の Skill | いいえ | **はい** |
| エアギャップ / VPN 専用の環境 | いいえ | **はい** |
| 厳選・承認済みの Skill セット | いいえ | **はい** |
| GitHub トークン不要 | いいえ | **はい** |

実例については [Public Hub](#public-hub) セクションを参照してください。

## クイックスタート

### 1. インデックスを構築する

```bash
# Global の Skill から
skillshare hub index

# プロジェクトから
skillshare hub index -p

# 出力: <source>/skillshare-hub.json
```

### 2. インデックスを検索する

```bash
# ローカルファイル
skillshare search react --hub ./skillshare-hub.json

# リモート URL
skillshare search react --hub https://internal.corp/skills/skillshare-hub.json

# すべての Skill を閲覧する（クエリなし）
skillshare search --hub ./skillshare-hub.json --json
```

### 3. 結果からインストールする

インタラクティブな検索フローは GitHub 検索と同じように動作します — Skill を選択するとインストール
されます。

## 監査の充実

Skill の安全性を一目で確認できるよう、インデックスにセキュリティのリスクスコアを追加します。

```bash
# 監査スコア付きでインデックスを構築する
skillshare hub index --audit

# 完全なメタデータと組み合わせる
skillshare hub index --full --audit
```

`--audit` を使うと、各 Skill は `skillshare audit` のルールでスキャンされ、インデックスには
`riskScore`（0〜100）、`riskLabel`（clean/low/medium/high/critical）、`auditedAt` タイムスタンプが
含まれます。スキャンに失敗した Skill はリスクフィールドなしで含まれます。

監査済みインデックスからの検索結果にはリスクバッジが表示されます。

```
  1. safe-skill               owner/repo/safe-skill         [clean]
  2. risky-skill              owner/repo/risky-skill        [high]
```

## 共有戦略

### ファイル共有（最もシンプル）

インデックスファイルを共有場所にコピーします。

```bash
skillshare hub index -o /shared/team/skillshare-hub.json
```

チームメンバーは以下で検索します。
```bash
skillshare search --hub /shared/team/skillshare-hub.json
```

### HTTP サーバー

インデックスをローカルで生成してからホスティングにアップロードします。

```bash
# ステップ 1: 生成する
skillshare hub index -o ./skillshare-hub.json

# ステップ 2: アップロードする（お好みの方法で）
scp ./skillshare-hub.json server:/var/www/skills/
# または: aws s3 cp ./skillshare-hub.json s3://my-bucket/
# または: rsync、FTP など
```

チームメンバーは以下で検索します。
```bash
skillshare search --hub https://skills.company.com/skillshare-hub.json
```

### Git リポジトリ

チームメンバーが pull できるよう、インデックスを共有リポジトリにコミットします。

```bash
skillshare hub index -o ./skillshare-hub.json
git add skillshare-hub.json && git commit -m "Update skill index"
git push
```

チームメンバーは raw URL 経由、SSH 経由、またはローカルに clone して検索できます。
```bash
# raw URL 経由
skillshare search --hub https://raw.githubusercontent.com/team/skills/main/skillshare-hub.json

# SSH 経由 — リポジトリを clone してインデックスを読む（手動 clone 不要）
skillshare search --hub git@github.com:team/skills.git
skillshare search --hub git@ghe.corp.com:team/skills.git//hubs/team.json

# または clone してローカルで検索する
git pull
skillshare search --hub ./skillshare-hub.json
```

:::tip プライベートリポジトリと GitHub Enterprise
SSH の Hub Source は自分の SSH エージェント/キーで clone されるため、プライベートリポジトリや、
raw HTTPS URL がログインページにリダイレクトされる GitHub Enterprise（GHE）ホストでも動作します。
リポジトリ内のインデックスのパスは `//path` サフィックスから取得され、デフォルトはリポジトリルートの
`skillshare-hub.json` です。scp スタイル（`git@host:org/repo.git`）とスキームスタイル
（`ssh://git@host/org/repo.git`）の URL のどちらも動作します。ラベルで検索するには
[`hub add`](/docs/reference/commands/hub#hub-add) で一度保存しておいてください。

GitHub/GHE の Hub が SSH 経由で読み込まれた場合、同一ホストのドメインプレフィックス付き Skill
Source は、その Hub の SSH アイデンティティを継承します。例えば `acme@acme.ghe.com:Org/skills.git//hubs/team.json`
という Hub URL があれば、`acme.ghe.com/Org/skills/skills/reviewer` というエントリの Source は
SSH 経由でインストールできます。Hub が HTTP、ローカルファイル、または別のホスト経由で読み込まれた
場合、ドメインプレフィックス付き Source は HTTPS の Source のままです。
:::

## Web ダッシュボード

### JSON を書かずに Hub を作成する

ダッシュボード（`skillshare ui`）で **Skills → Hubs → My hubs → New Hub** を開きます。

1. ドラフトに名前と任意の説明を付けます。これらはローカルでドラフトを識別するためのもので、
   エクスポートされたインデックスには含まれません。
2. **Choose installed skills** を選び、共有する Skill を選択して追加します。または
   **Add source manually** を使います。
3. 各 Skill の表示名、説明、タグ、インストール Source を編集します。例えば、
   `runkids/demo-skills/skills/pdf` はリモートリポジトリ内の Skill を識別します。
   **Advanced** セクションでは、複数の Skill を含むリポジトリ用の任意の `skill` セレクターを
   保持します。
4. **Save draft** を選びます。ページはすべてのエントリをチェックし、エクスポートを妨げるものが
   あれば表示します。
5. `skillshare-hub.json` を取得するには **Download index** を選びます。
6. ダウンロードしたファイルを自分の Git リポジトリにコミットするか、HTTP サーバーにアップロード
   します。受け取り側のための `skillshare hub add` コマンドをコピーするには、そのロケーションを
   ページに入力します。

次のドラフトでは 1 つの Skill の Source がローカルのみのため、リモートの Source を指定するまでエクスポートできません。

![My hubs：1 つのエントリがエクスポートできない Hub のドラフト](/img/hub-builder-draft.png)

ダウンロードは何も公開する**わけではありません**。カタログは Skill を参照するだけで、そのファイルを
バンドルするわけではありません。Source の検証は構文をチェックするだけで、リポジトリが存在するか、
受け取り側に権限があるかは確認しません。プライベートリポジトリには引き続きアクセス権が必要です。

:::tip ローカルの Skill もドラフトに残せる
既知のリモート由来を持たないインストール済みの Skill も、そのローカル Source と共に表示され続けます。
それをドラフトに保存できます。リモートのインストール Source を指定するかそのエントリを削除するまで
エクスポートはブロックされます。ビルダーがそれを黙って除外することはありません。
:::

### カタログを再開またはインポートする

ドラフトは、ダッシュボードを実行しているマシン上の、有効な設定ファイルの隣にある `hub-drafts/` に
保存されます。Global と Project の設定は別々のドラフトを持ちます。再読み込みする前に **Save draft**
を使ってください。未保存の変更を残したまま離れると破棄するか確認されます。古くなったウィンドウからの
保存は拒否されるため、より新しいリビジョンを上書きすることはできません。**Reload saved draft** は
最新版を取得します。

既存の v1 `skillshare-hub.json`（4 MB まで）には **Import JSON** を使います。非対応のバージョンや
無効なフィールド型はエラーになります。同じ表示名を持つエントリは別々のまま残ります。追加の JSON
フィールドや `skill` セレクターは保持されます。古いインデックスに `sourcePath` が含まれる場合、
相対 Source は既存のインデックスリーダーと同様にローカルパスとして解決されます。エクスポート前に
リモート Source に変更する必要があります。

ポータブルなエクスポートは、作者の `sourcePath` と既知のローカルメタデータ（`relPath`、`flatName`、
`installedAt`、`isInRepo`）を取り除きます。それにはインデックスが含まれ、ドラフトの名前、説明、
ID、リビジョンは含まれません。エントリの Source や skill セレクターを変更すると、その前の監査
スコア、ラベル、タイムスタンプはクリアされます。URL の認証情報、クエリ文字列、フラグメントは
拒否されます。リポジトリの認証は別途設定してください。

**Delete draft** は確認を求め、そのドラフトのみを削除します。Skill をアンインストールしたり、
ホストされているインデックスを削除したり、サブスクライブ済みの Hub を削除したりすることはありません。

### 共有された Hub を検索する

1. **Skills → Install** を開きます。
2. 検索 Source セレクターから Hub を選びます。install ダイアログの Hub マネージャーを使って、
   URL、SSH リポジトリ、またはローカルのインデックスパスを追加できます。
3. Skill を検索、プレビュー、インストールします。

サブスクライブ済みの Hub Source は有効な skillshare 設定に保存され、CLI と共有されます。これらは
**My hubs** のドラフトとは別物です。

既存の `skillshare hub index` コマンドと `/api/hub/index` エンドポイントは、ローカル Source の
対応を含め、これまで通りインデックスを生成し続けます。上記のポータブルエクスポートのルールは
ダッシュボードのビルダーにも適用されます。

## インデックスのスキーマ

インデックスは Schema v1 に従います。

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

### 必須フィールド（コンシューマー契約）

| フィールド | 必須 | 説明 |
|-------|----------|-------------|
| `name` | はい | Skill の表示名 |
| `source` | はい | インストール Source（GitHub の省略形、URL、またはローカルパス） |
| `description` | 推奨 | 検索マッチング用の短い説明 |
| `skill` | いいえ | 複数の Skill を含むリポジトリ内の特定の Skill 名（`install -s` と共に使用） |
| `tags` | いいえ | フィルタリングとグループ化のための分類タグ |

### ドキュメントレベルのフィールド

| フィールド | 説明 |
|-------|-------------|
| `schemaVersion` | 常に `1` |
| `generatedAt` | RFC 3339 タイムスタンプ |
| `sourcePath` | 相対 Source を解決するためのベースパス |

### Source パスの解決

`sourcePath` が設定されていて、Skill の `source` が相対パスの場合、検索側のコンシューマーはそれらを
結合します。

```
sourcePath: /home/user/.config/skillshare/skills
source:     _team/frontend-skill
→ resolved: /home/user/.config/skillshare/skills/_team/frontend-skill
```

これにより、相対パスが GitHub の省略形（`owner/repo`）と誤解釈されるのを防ぎます。

絶対パス、URL、ドメインプレフィックス付きのパスは決して結合されません。

| Source パターン | 結合されるか？ |
|----------------|---------|
| `_team/my-skill` | はい |
| `subdir/skill` | はい |
| `/absolute/path` | いいえ |
| `github.com/owner/repo/skill` | いいえ |
| `https://...` | いいえ |

## 手書きのインデックス

`hub index` を使わずに手動でインデックスを作成することもできます。これは特に、GitHub 検索や公開
ツールが決して到達できない Source であるプライベートインフラでホストされている社内 Skill に有用です。

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

:::tip なぜ GitHub 検索だけではだめなのか？
`skillshare search` は github.com 上の公開リポジトリしか見つけられません。Hub index は
**あらゆる** Source を指すことができます — GitHub Enterprise、プライベートな GitLab、社内サーバーなど、
VPN の背後にいる自社の従業員だけがアクセスできるものです。これが Hub を組織全体の Skill 配布の
定番ソリューションにしている理由です。
:::

手書きインデックスのヒント:
- `sourcePath` は任意です — すべての Source が絶対パスなら省略してください
- `tags` は任意です — Web サイトや検索でのフィルタリングに便利です
- `name` が空の Skill はスキップされます
- 結果は名前のアルファベット順にソートされます
- SSH 専用の GitHub Enterprise インストールでは、明示的な SSH Source
  （`user@host:owner/repo.git//path`）を優先するか、Hub 自体を SSH 経由で読み込んで、同一ホストの
  GitHub/GHE ドメインプレフィックス付きエントリがその SSH アイデンティティを継承するようにして
  ください

## 組織へのデプロイ

組織全体に Hub を展開する典型的なエンドツーエンドのワークフローです。

```bash
# 1. Skill 管理者が社内リポジトリから Skill を厳選する
skillshare install ghe.internal.company.com/platform/ai-skills/coding-standards
skillshare install ghe.internal.company.com/platform/ai-skills/review-checklist
skillshare install ghe.internal.company.com/security/ai-skills/threat-model

# 2. Hub インデックスを生成する（任意で監査スコア付き）
skillshare hub index --audit -o ./skillshare-hub.json

# 3. ホストする（いずれか1つを選ぶ）
#    - 社内 Git リポジトリ: commit して push
#    - S3/CDN: aws s3 cp ./skillshare-hub.json s3://skills-bucket/
#    - イントラネットサーバー: 自分のホスティングに scp する

# 4. チームメンバーは一度だけ Hub を追加する
skillshare hub add https://skills.internal.company.com/skillshare-hub.json --label company

# 5. 検索してインストールする — VPN の背後でのみアクセス可能
skillshare search coding --hub company
```

インデックスを最新に保つには、Skill の変更後に実行される CI パイプラインに `skillshare hub index`
を追加してください。

## Public Hub

[skillshare-hub](https://github.com/runkids/skillshare-hub) は、質の高い Skill の厳選されたカタログ
です。これは**デフォルトの Hub**です — Source を指定せずに `search --hub` を実行すると、ここが検索
されます。

```bash
skillshare search --hub              # public hub のすべての Skill を閲覧する
skillshare search react --hub        # "react" の Skill を検索する
```

また、自分の組織の Hub を構築するためのリファレンスとしても機能します。

- **インデックス構造** — 名前、説明、Source、タグを使って `skillshare-hub.json` をどう整理するか
- **CI 検証** — すべての PR での自動 JSON フォーマットチェックと `skillshare audit` セキュリティスキャン
- **コントリビューションワークフロー** — Fork → エントリ追加 → PR、CI ゲート付き

自分のチーム用の社内 Hub を構築したいですか？リポジトリを fork し、Skill を自分の組織のカタログに
置き換え、自分たちのセキュリティポリシーに合わせて CI パイプラインをカスタマイズしてください。

## ヒント

- **インデックス生成を自動化する** — Skill の変更後、CI パイプラインに `skillshare hub index` を追加する
- **監査には `--full` を使う** — Full モードにはバージョン、インストール日、種類の情報が含まれる
- **Project mode と組み合わせる** — `skillshare hub index -p` はプロジェクトレベルの Skill のみを
  インデックス化する

---

## 関連項目

- [search](/docs/reference/commands/search) — Hub から Skill を検索する
- [hub](/docs/reference/commands/hub) — Hub Source を管理する
- [install](/docs/reference/commands/install) — 発見された Skill をインストールする
