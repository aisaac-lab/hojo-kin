# データ重複検証レポート

## 検証日時
2025-08-02

## 検証対象ファイル

### 1. メインデータファイル
- `data/subsidies/subsidies-master.json`

### 2. カテゴリ別データファイル
- `data/subsidies-split/subsidies-tourism.json`
- `data/subsidies-split/subsidies-others.json`
- `data/subsidies-split/subsidies-welfare.json`
- `data/subsidies-split/subsidies-it_dx.json`
- `data/subsidies-split/subsidies-employment.json`
- `data/subsidies-split/subsidies-startup.json`
- `data/subsidies-split/subsidies-environment.json`
- `data/subsidies-split/subsidies-equipment.json`

### 3. APIレスポンスファイル
- `data/api-responses/tokyo-subsidies-details.json`
- `data/api-responses/tokyo-subsidies-list.json`
- `data/api-responses/shibuya-subsidies.json`
- `data/api-responses/tokyo-all-subsidies.json`

## 検証結果サマリー

### subsidies-master.json
- **総データ数**: 338件
- **ID重複**: なし（すべてユニーク）
- **タイトル重複**: 62件
- **名前フィールド重複**: 1件（"undefined"が248件）

### カテゴリ別ファイル（subsidies-split/）
- **総データ数**: 338件（全カテゴリ合計）
- **ID重複**: なし（カテゴリ間での重複なし）
- **タイトル重複**: 61件

### APIレスポンスファイル
- **tokyo-subsidies-details.json**: 重複なし
- **tokyo-subsidies-list.json**: タイトル重複なし
- **shibuya-subsidies.json**: 検証済み（重複なし）

## 重複の詳細

### 1. タイトル重複の主なパターン

#### 最も多い重複タイトル
1. **"undefined"** - 63件
   - データ取得時のエラーまたは未定義データ

2. **"リターナブル容器利用促進助成金"** - 6件
   - 複数の自治体で同名の助成金が存在

3. **"帯状疱疹ワクチン接種費用の一部助成"** - 6件
   - 複数の自治体で同様の助成制度

4. **"家庭用生ごみ処理機など購入費補助金"** - 6件
   - 環境関連の共通施策

5. **"地域観光資源開発補助金"** - 3件
   - 観光振興の共通施策

### 2. 名前フィールドの問題
- `name`フィールドに"undefined"が248件存在
- 正常なデータは90件のみ
- データ取得または変換時の問題の可能性

### 3. カテゴリ別ファイルの重複パターン
- 同一タイトルの補助金が`subsidies-others.json`に集中
- 地域別の同様の制度が異なるIDで登録されている

## 推奨される改善点

### 1. データクレンジング
- "undefined"となっているデータの修正または削除
- 欠損データの補完

### 2. 重複管理の改善
- 同名の補助金でも実施主体が異なる場合の識別方法の確立
- タイトルに自治体名を含めるなどの命名規則の統一

### 3. データ品質の向上
- データ取得時のバリデーション強化
- 必須フィールドの欠損チェック

### 4. ID体系の見直し
- 現在はIDの重複はないが、データソースごとに異なるID体系
- 統一的なID管理システムの検討

## 結論

データの重複は主にタイトルレベルで発生しており、これは複数の自治体が同様の補助金制度を実施していることに起因します。IDレベルでの重複はなく、データの一意性は保たれています。

ただし、"undefined"データの多さは改善が必要であり、データ品質の向上が求められます。