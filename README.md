# Connect CRM v006 — Googleスプレッドシート / GAS連携版

v006は、GitHub Pages上の静的Webアプリから **GAS WebアプリをAPIとして利用し、Googleスプレッドシートへ永続保存**する版です。

## データ構造

スプレッドシートは5シート構成です。

1. **人物マスタ** — `id / name / metDate / source / overallPriority / note / createdAt / updatedAt`
2. **紹介関係** — `id / fromId / toId / memo / createdAt / updatedAt`
3. **サービス候補** — `id / personId / serviceName / priority / note / createdAt / updatedAt`
4. **次回アクション** — `id / personId / actionDate / actionText / done / completedAt / createdAt / updatedAt`
5. **設定** — `key / value / description`

人物と紹介関係を分離しているため、**複数紹介元・複数紹介先・網目状の関係マップ**に対応します。サービス候補も1人物に複数行を持てます。

## セットアップ手順

### 1. スプレッドシートを用意

同梱の `data/connect-crm-v006-sample.xlsx` をGoogle DriveへアップロードしてGoogleスプレッドシートとして開くか、空のスプレッドシートでも構いません。

### 2. GASを貼り付け

対象スプレッドシートで **拡張機能 → Apps Script** を開き、`gas` フォルダの以下を作成・貼り付けます。

- `Code.gs`
- `Setup.gs`
- `SampleData.gs`
- `appsscript.json`（プロジェクトのマニフェスト表示をONにして置換）

### 3. 初期設定

Apps Scriptエディタから **`setupConnectCRM()`** を1回実行し、権限を許可します。

これにより、
- 必要な5シートを作成/整備
- 対象スプレッドシートIDをScript Propertiesに保存
- `設定` シートに `connection_key` を生成

します。

サンプルをスプシへ投入する場合は **`seedSampleData()`** を実行します。

### 4. Webアプリとしてデプロイ

Apps Scriptの **デプロイ → 新しいデプロイ → ウェブアプリ** を選びます。

- 実行するユーザー：**自分**
- アクセスできるユーザー：GitHub Pagesからアクセスできる設定（試作では「全員」）

デプロイ後の `/exec` URLをコピーします。

> 注意: 静的GitHub Pagesから直接GASへアクセスする試作構成のため、WebアプリURL自体は公開アクセス可能な設定が必要です。書き込み/読み込みは `connection_key` でも確認していますが、これは本格的な認証の代替ではありません。多人数向けSaaS本番ではFirebase/Supabase等の認証・DB構成を推奨します。

### 5. Connect CRMで接続

Connect CRMの **連携設定** 画面で、
- GAS WebアプリURL
- `設定` シートの `connection_key`

を入力し **設定を保存・接続確認** を押します。

接続後は人物・紹介関係・サービス候補・次回アクションの編集が自動でスプレッドシートへ保存されます。

## 初回データ移行

ブラウザ側にv005以前のデータが残っている場合、v006は可能な範囲でローカルキャッシュへ移行します。

そのデータをスプレッドシートへ入れたい場合は、**連携設定 → この画面 → スプシ → 全データを反映** を一度実行してください。

この操作はスプレッドシート側の4つのデータシートを置き換えるため、初回移行時だけ使用する想定です。

## GitHub Pages

`index.html / styles.css / app.js / data` をリポジトリへアップロードします。GASフォルダはGitHubに保管しても構いませんが、実行はApps Script側です。

## ファイル構成

```text
customer-network-crm-v006/
├─ index.html
├─ styles.css
├─ app.js
├─ README.md
├─ gas/
│  ├─ Code.gs
│  ├─ Setup.gs
│  ├─ SampleData.gs
│  └─ appsscript.json
└─ data/
   ├─ connect-crm-v006-sample.xlsx
   ├─ people.csv
   ├─ relationships.csv
   ├─ services.csv
   ├─ actions.csv
   ├─ sample-data.json
   └─ sample-data-normalized.json
```
