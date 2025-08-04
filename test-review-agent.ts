import { ReviewAgentService } from './app/services/review-agent.server';
import type { ReviewContext } from './app/types/review';

async function testReviewAgent() {
	console.log('=== Testing Review Agent ===\n');
	
	const reviewAgent = new ReviewAgentService();
	
	// Test Case 1: IT関連の質問で補助金が5件以下の場合
	console.log('Test Case 1: IT関連の質問で少ない件数');
	const test1 = {
		userQuestion: 'IT企業が申請できる補助金を全て列挙してください',
		assistantResponse: `申請可能な補助金は5件です。

【内訳】
- IT・デジタル化関連: 5件

以下に、IT企業が申請可能な補助金を全て列挙します。

1. **IT・IoT導入補助金**（マッチ度: 95点/100点）
   - 対象者：IT企業、中小企業
   - 補助金額：最大150万円
   - [公式サイトで詳細を見る](https://example.com)

2. **商店街活性化事業助成金**（マッチ度: 80点/100点）
   - 対象者：商店街、IT企業
   - 補助金額：最大2000万円
   - [公式サイトで詳細を見る](https://example.com)

3. **高齢者デジタルデバイド解消事業**（マッチ度: 75点/100点）
   - 対象者：IT企業、NPO
   - 補助金額：記載なし
   - [公式サイトで詳細を見る](https://example.com)

4. **オンライン資格確認のシステム導入における助成金制度**（マッチ度: 70点/100点）
   - 対象者：医療機関、IT企業
   - 補助金額：最大10万円
   - [公式サイトで詳細を見る](https://example.com)

5. **ホームページ作成支援事業補助金**（マッチ度: 65点/100点）
   - 対象者：中小企業、IT企業
   - 補助金額：最大75万円
   - [公式サイトで詳細を見る](https://example.com)`
	};
	
	try {
		const result1 = await reviewAgent.reviewResponse(
			test1.userQuestion,
			test1.assistantResponse
		);
		
		console.log('Result:', {
			action: result1.action,
			dataAccuracy: result1.scores.dataAccuracy,
			issues: result1.issues,
			regenerationHints: result1.regenerationHints
		});
		
		console.log('\n期待される結果:');
		console.log('- action: "regenerate"');
		console.log('- dataAccuracy: 35以下');
		console.log('- IT関連補助金が少ないというissue');
		console.log('- カテゴリー横断検索のヒント\n');
	} catch (error) {
		console.error('Test Case 1 Error:', error);
	}
	
	// Test Case 2: 「全て列挙」の要求で10件未満の場合
	console.log('\n\nTest Case 2: 全て列挙の要求で少ない件数');
	const test2 = {
		userQuestion: '補助金を全て列挙してください',
		assistantResponse: `申請可能な補助金は8件です。

以下に、申請可能な補助金を全て列挙します。

1. **研究開発助成事業**（マッチ度: 90点/100点）
2. **ものづくり補助金**（マッチ度: 85点/100点）
3. **小規模事業者持続化補助金**（マッチ度: 80点/100点）
4. **事業再構築補助金**（マッチ度: 75点/100点）
5. **IT導入補助金**（マッチ度: 70点/100点）
6. **創業助成金**（マッチ度: 65点/100点）
7. **販路拡大支援事業**（マッチ度: 60点/100点）
8. **環境対策補助金**（マッチ度: 55点/100点）`
	};
	
	try {
		const result2 = await reviewAgent.reviewResponse(
			test2.userQuestion,
			test2.assistantResponse
		);
		
		console.log('Result:', {
			action: result2.action,
			dataAccuracy: result2.scores.dataAccuracy,
			issues: result2.issues,
			regenerationHints: result2.regenerationHints
		});
		
		console.log('\n期待される結果:');
		console.log('- action: "regenerate"');
		console.log('- dataAccuracy: 25以下');
		console.log('- 提案件数が少ないというissue');
		console.log('- 20件以上検索するヒント\n');
	} catch (error) {
		console.error('Test Case 2 Error:', error);
	}
	
	// Test Case 3: 正常なケース（十分な件数）
	console.log('\n\nTest Case 3: 正常なケース（十分な件数）');
	const test3 = {
		userQuestion: 'IT企業が申請できる補助金を教えてください',
		assistantResponse: `申請可能な補助金は23件です。

補助金の一部として以下のようなものがあります。

1. **IT・IoT導入補助金**（マッチ度: 95点/100点）
   内訳：カテゴリー(25/25)、キーワード(25/25)、その他(45/50)
   - 対象者：IT企業、中小企業
   - 補助金額：最大150万円（補助率2/3）
   - 対象経費：システム開発費、ソフトウェア購入費
   - 申請期限：2025年3月31日
   - なぜ適しているか：IT企業のシステム開発に直接活用できる補助金です
   - [公式サイトで詳細を見る](https://example.com)

2. **DX推進補助金**（マッチ度: 90点/100点）
   内訳：カテゴリー(25/25)、キーワード(20/25)、その他(45/50)
   - 対象者：中小企業、IT企業
   - 補助金額：最大1000万円（補助率1/2）
   - 対象経費：DX推進に係る費用全般
   - 申請期限：2025年6月30日
   - なぜ適しているか：デジタル変革を推進するIT企業に最適です
   - [公式サイトで詳細を見る](https://example.com)

3. **ソフトウェア開発支援事業**（マッチ度: 85点/100点）
   内訳：カテゴリー(25/25)、キーワード(20/25)、その他(40/50)
   - 対象者：ソフトウェア開発企業
   - 補助金額：最大500万円（補助率2/3）
   - 対象経費：開発人件費、外注費
   - 申請期限：2025年9月30日
   - なぜ適しているか：ソフトウェア開発に特化した支援制度です
   - [公式サイトで詳細を見る](https://example.com)

4. **AI・ビッグデータ活用促進事業**（マッチ度: 80点/100点）
   - 省略...

5. **クラウドサービス導入支援金**（マッチ度: 75点/100点）
   - 省略...

より最適な補助金をご提案するため、以下について教えていただけますか？
- 企業規模（従業員数）はどれくらいですか？
- 希望する補助金額の規模は？
- 具体的な事業内容やプロジェクトは？`
	};
	
	try {
		const result3 = await reviewAgent.reviewResponse(
			test3.userQuestion,
			test3.assistantResponse
		);
		
		console.log('Result:', {
			action: result3.action,
			passed: result3.passed,
			scores: result3.scores,
			issues: result3.issues
		});
		
		console.log('\n期待される結果:');
		console.log('- 特別チェック項目に引っかからない');
		console.log('- dataAccuracyが低下しない');
		console.log('- 他の評価項目に基づいて判定される\n');
	} catch (error) {
		console.error('Test Case 3 Error:', error);
	}
}

// 環境変数の設定
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'your-api-key';
process.env.REVIEW_SCORE_THRESHOLD = '85';

// テスト実行
testReviewAgent().catch(console.error);