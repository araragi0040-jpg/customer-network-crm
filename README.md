# Connect CRM v001

個人事業主向けの「人脈管理 × 見込み顧客管理」モックです。

## v001でできること

- 人物の登録・編集・削除
- 出会った日、出会いのきっかけの記録
- 紹介元の記録
- 人物メモ
- 1人に複数サービス候補を設定
- サービスごとに「高 / 中 / 低」の優先度を設定
- 次回アクションと日付の登録
- 次回アクションの完了チェック
- ダッシュボード表示
- 人物検索・出会いのきっかけ絞り込み
- サービス・優先度別のクライアント候補表示
- ブラウザの `localStorage` にデータ保存

## GitHub Pagesで公開する方法

1. このフォルダ内のファイルをGitHubリポジトリへアップロード
2. GitHubのリポジトリで `Settings`
3. `Pages`
4. `Build and deployment` の `Source` を `Deploy from a branch`
5. Branchを `main`、Folderを `/(root)` に設定
6. `Save`

数分後、GitHub PagesのURLでそのまま表示できます。

## ローカルで確認する方法

`index.html` をブラウザで直接開いても基本動作します。

VS Codeを使う場合は、Live Serverなどの簡易サーバーで開くと確認しやすいです。

## データについて

v001はDBを使わず、ブラウザの `localStorage` に保存します。

そのため、

- 同じブラウザ・同じ端末では保存される
- 別端末とは同期されない
- ブラウザデータを削除すると消える可能性がある
- ログイン機能はまだない

というモック仕様です。

## 今後の本番化候補

サブスク型で複数の事業主へ提供する場合は、次のような構成へ拡張できます。

- 認証：Supabase Auth / Firebase Auth
- DB：Supabase / Firebase
- ユーザーごとのデータ分離
- サービスマスタ
- 人物同士の紹介ネットワーク可視化
- 接触履歴の時系列管理
- 次回アクション通知
- CSVインポート / エクスポート
- LINEやGoogle Calendarとの連携
- 見込み度の自動スコアリング
- スマホPWA化

## ファイル構成

```text
customer-network-crm-v001/
├─ index.html
├─ styles.css
├─ app.js
└─ README.md
```
