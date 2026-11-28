# マスタ更新運用

## データの分離
- `data/game-master.json`: kcwiki/kancolle-data の api_start2 から抽出する正規化データ。
- `data/game-master.js`: 同じ内容のブラウザ用生成バンドル。実行時の外部通信は不要。
- `data/manifest.json`: スキーマ、取得元、元ファイルのGit blob SHA、件数。
- `data/expedition-rules.js`: 手動管理する遠征報酬・補足情報。APIの時刻・消費率・名称・月次区分は実行時に結合する。APIに新遠征が追加されても報酬未調査の場合は計算器に自動登録しない。
- `data/equipment-rules.js`: 手動管理する装備補正・大成功判定のルール。
- `data/legacy-ship-baseline.js`: v1.7で使用したマスタの固定スナップショット。旧保存データの自動補完値と手動値を区別するため更新しない。

## 改造段階
艦娘マスタの各行の第6要素に改造段階を保持する。`api_aftershipid` と `api_mst_shipupgrade` の改造元・改造先を有向グラフとして扱う。改造元なしは未改造、途中は中間改造、外に改造先のない強連結成分は最終改装（コンバートの全形態を含む）。改造元も改造先もない艦は未改造・最終改装の両方で表示する。定期更新のたびに再分類する。第7要素には `api_slot_num` から取得した通常装備枠数を保持する。第8要素には上陸用舟艇の搭載可否を保持する（schema 4）。艦別の装備可能カテゴリ表があればそれを使い、なければ艦種表を使う。特型内火艇のみ搭載可能な艦は対象外。

## 更新方法
Node.js 24を使用する。外部npm依存なし。

```sh
node scripts/update-master.cjs
node scripts/update-master.cjs --check
node scripts/test-master.cjs
```

取得元が停止した場合、必須項目欠損・不正値・重複・既存ID削除・独自遠征IDの参照不整合がある場合、更新は停止する。抽出データに変化がなければファイルは変更しない。別の取得済みAPIデータを検証する場合は `--input /path/to/api_start2.json` を指定できる。更新で作成される master-diff.json はレビュー用で、コミット対象ではない。

## 定期更新
毎日12:00 JST（GitHub ActionsのcronはUTC、実行時刻は前後する場合あり）にdevelopを取得して検証し、変化があれば自動更新PRを開く。自動マージしない。既存の更新PRが開いている場合は新規作成しない。Actionsの手動実行にも対応。

リポジトリの Settings > Actions > General > Workflow permissions にて GitHub Actions にPR作成を許可する必要がある（Allow GitHub Actions to create and approve pull requests）。組織設定が優先される場合もある。PRをレビューしてdevelopへマージし、通常の公開手順でmainへマージする。上流の取得失敗や検証失敗では現行公開データを変更しない。

## 旧編成の移行
艦娘ID、レベル、ケッコン、キラ、装備はそのまま保持。旧マスタと一致する艦名・艦種・燃料・弾薬は参照値とみなし、差のある値は overrides に保存。旧マスタと同じ値を意図して手動指定していた場合は区別できない。未知IDの手動値は保持。編集欄を空にするか「マスタ値に戻す」で上書きを解除できる。JSONインポートと一時保存復元も同じ移行処理を通す。

## 出典
https://github.com/kcwiki/kancolle-data
取得したのはゲームAPI由来のマスタの必要項目のみ。装備補正・成功条件等の正しさは別途検証する。
