# Connect CRM v005

人物マスタと紹介関係を分離した、複数紹介元対応版のモックです。

## データ構造

- `people`：人物そのものの情報
- `relationships`：`紹介元ID → 紹介先ID` の関係

1人に複数の紹介元・紹介先を持たせられるため、網目状の関係マップを表現できます。

## v005の主な変更

- 紹介元を人物データから分離
- 「紹介関係」画面を追加
- 1人に複数紹介元を登録可能
- 人物一覧に紹介元人数・紹介先人数を表示
- 関係マップで全紹介関係を矢印 `紹介元 → 紹介先` として表示
- マップは複数の親から同じ人物へ矢印が入るDAG型ネットワークに対応
- ズーム・全体表示・ドラッグ移動・人物クリックに対応
- 28人 / 36紹介関係のサンプルデータを初期搭載
- 旧 `connect-crm-v001` localStorage が存在する場合は可能な範囲で自動移行

## GitHub Pages

`index.html / styles.css / app.js / data` をリポジトリ直下へ置けば動作します。

## サンプルデータ

- `data/people.csv`
- `data/relationships.csv`
- `data/sample-data.json`
- `data/connect-crm-v005-sample.xlsx`

CSVはGoogleスプレッドシートへそのまま取り込みできます。
