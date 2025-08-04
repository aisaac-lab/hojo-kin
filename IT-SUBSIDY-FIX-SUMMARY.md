# IT企業向け補助金検索問題の修正内容

## 問題の概要
「IT企業が申請できる補助金を全て列挙してください」という質問に対して、実際には10件以上存在するにも関わらず、5件しか提示されない問題が発生していました。

## 原因分析

### 1. データの分散
- IT関連補助金が複数のカテゴリーに分散していた
  - `digitalization`カテゴリー: 10件
  - `startup`カテゴリー: ホームページ作成支援事業補助金など
  - その他のカテゴリーにもIT企業が活用できる補助金が存在

### 2. 検索指示の矛盾
- IT専用ファイル（`it-subsidies-count.txt`等）のみを参照する指示
- 全体データ（`subsidies-master.json`）を参照する指示
- 両方が混在して混乱を招いていた

### 3. 検索範囲の狭さ
- IT専用ファイルのみを検索すると、他カテゴリーのIT関連補助金を見逃す

## 実施した修正

### 1. api.chat.tsxの修正
**ファイル**: `/app/routes/api.chat.tsx`

#### 変更前（264-276行目）:
```typescript
【IT関連補助金の検索手順】
1. 「it-subsidies-count.txt」ファイルを検索 → IT関連補助金の総件数を確認
2. 「it-subsidies-searchable.txt」ファイルを検索 → 全IT関連補助金の詳細を取得
3. 「it-subsidies-summary.txt」ファイルを検索 → 補助金一覧を確認
4. 取得した総件数を「申請可能な補助金は○○件です」に記載
```

#### 変更後:
```typescript
【IT関連補助金の検索キーワード】
IT企業向けの補助金を検索する場合は、以下の複数のキーワードで包括的に検索：
- 基本キーワード: "IT", "DX", "デジタル", "システム", "IoT", "AI", "IT導入"
- 追加キーワード: "ソフトウェア", "ホームページ", "EC", "オンライン", "クラウド", "セキュリティ"
- カテゴリー横断: digitalizationカテゴリーだけでなく、startup、expansionカテゴリーも検索

【全て列挙の場合の対応】
「全て」「すべて」「全部」「一覧」という要求の場合：
- 最低でも20件以上の補助金を検索・提示することを目標とする
- 複数のカテゴリーを横断的に検索
- 見つかった件数が少ない場合は、さらに関連キーワードで再検索
```

### 2. レビューエージェントの強化
**ファイル**: `/app/services/review-agent.server.ts`

#### 追加した特別チェック項目（89-122行目）:
```typescript
// 特別チェック項目の実装
const subsidyCountMatch = assistantResponse.match(/申請可能な補助金は(\d+)件です/);
const proposedCount = subsidyCountMatch ? parseInt(subsidyCountMatch[1]) : extractedSubsidies.length;

// 「全て」「すべて」「一覧」などの要求チェック
const isAllRequest = /全て|すべて|全部|一覧|列挙/.test(userQuestion);
const isITRequest = /IT|デジタル|DX|システム|ソフトウェア/.test(userQuestion);

if (isAllRequest && proposedCount < 10) {
    parsedResult.scores.dataAccuracy = Math.min(parsedResult.scores.dataAccuracy || 0, 25);
    parsedResult.action = 'regenerate';
    // 全て列挙の要求に対して提案件数が少なすぎるエラー
}

// IT関連の質問チェック
if (isITRequest && proposedCount <= 5) {
    parsedResult.scores.dataAccuracy = Math.min(parsedResult.scores.dataAccuracy || 0, 35);
    parsedResult.action = 'regenerate';
    // IT関連補助金の提案件数が少なすぎるエラー
}
```

#### レビュー基準の更新（317-325行目）:
```typescript
- 「全て」「すべて」「全部」「一覧」「列挙」を含む質問に対して、提案件数が10件未満の場合
  → dataAccuracyを25点以下にして、action: "regenerate"
  → issuesに「全て列挙の要求に対して提案件数が少なすぎます（10件未満）」を追加
  → regenerationHintsに「最低でも20件以上の補助金を検索・提示してください。複数のカテゴリーを横断的に検索してください」を追加
  
- IT関連の質問で提案件数が5件以下の場合
  → dataAccuracyを35点以下にして、action: "regenerate"
  → issuesに「IT関連補助金の提案件数が少なすぎます」を追加
  → regenerationHintsに「digitalization以外のカテゴリー（startup、expansion等）からもIT企業が活用できる補助金を探してください」を追加
```

### 3. 型定義の更新
**ファイル**: `/app/types/review.ts`

- `ReviewResult`インターフェースに`presentationQuality`を追加
- `ReviewIssue`の`type`に`'presentation'`を追加
- `ReviewContext`に`filters`プロパティを追加
- `ReviewMessage`インターフェースを新規追加

## 期待される効果

1. **検索範囲の拡大**
   - IT専用ファイルに限定せず、全データから横断的に検索
   - 複数のキーワードで包括的に検索することで見逃しを防ぐ

2. **品質保証の強化**
   - レビューエージェントが自動的に件数をチェック
   - 少なすぎる場合は再生成を要求
   - 「全て列挙」の要求には最低20件以上を目標

3. **ユーザー体験の向上**
   - より多くの選択肢を提示
   - IT企業が実際に活用できる補助金を網羅的に提案

## テスト方法

`test-review-agent.ts`ファイルを作成し、以下のテストケースを実装：

1. IT関連の質問で5件以下の場合 → 再生成要求
2. 「全て列挙」で10件未満の場合 → 再生成要求
3. 十分な件数の正常ケース → 通常の評価

## 今後の改善案

1. **データ構造の改善**
   - IT企業向け補助金の横断的なインデックスを作成
   - カテゴリーを跨いだ検索を効率化

2. **検索ロジックの最適化**
   - 関連性の高いキーワードの自動展開
   - 機械学習による補助金分類の改善

3. **ユーザーフィードバックの活用**
   - 実際の利用状況をモニタリング
   - 不足している補助金の特定と追加