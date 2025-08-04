# デプロイ後の確認手順書

## 1. 環境変数の確認

最初に環境変数が正しく設定されているか確認します：

```bash
curl https://hojo-kin.onrender.com/api/health
```

すべての環境変数が "configured" になっていることを確認してください。

必要な環境変数：
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `OPENAI_API_KEY`
- `OPENAI_ASSISTANT_ID`
- `OPENAI_VECTOR_STORE_ID` (オプション)

## 2. サーバーログの確認

Renderダッシュボードで以下を確認：

1. "Logs" タブを開く
2. 起動時のログで環境変数のステータスを確認
3. エラーメッセージがある場合は詳細を確認

確認すべきログ：
- `[DB] Using Turso database with embedded replica`
- `[DB] Turso connection successful`
- `✅ Server ready at http://0.0.0.0:10000`

## 3. エラー発生時のデバッグ

### 500エラーが発生した場合

1. Renderのログを確認
2. 以下のパターンを探す：
   - `[API.CHAT] Error:`
   - `[DB] Failed to connect to Turso:`
   - `[SERVER] Unhandled error:`

### 特定のエラーの対処法

#### データベース接続エラー
```
Database connection error
```
- `TURSO_DATABASE_URL` と `TURSO_AUTH_TOKEN` が正しく設定されているか確認
- Tursoダッシュボードでデータベースがアクティブか確認

#### OpenAI APIエラー
```
Assistant service error
```
- `OPENAI_API_KEY` が正しいか確認
- `OPENAI_ASSISTANT_ID` が存在するか確認
- OpenAIダッシュボードでAPIキーの権限を確認

## 4. テストリクエストの送信

```bash
# ヘルスチェック
curl https://hojo-kin.onrender.com/healthz

# APIヘルスチェック
curl https://hojo-kin.onrender.com/api/health

# チャットAPIテスト
curl -X POST https://hojo-kin.onrender.com/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "テスト", "threadId": "", "userId": "test-user", "filters": {}}'
```

## 5. 本番環境のデバッグモード

現在、エラーの詳細が表示されるように設定されています。
問題が解決したら、以下のファイルで詳細エラーを非表示にしてください：

`app/routes/api.chat.tsx`:
- `details: errorMessage // Show details in production temporarily for debugging`
  を
- `details: process.env.NODE_ENV === 'development' ? errorMessage : 'Please try again later'`
  に戻す

## 6. よくある問題と解決策

### ビルドエラー
- `render-build.sh` のログを確認
- `public/build` ディレクトリが作成されているか確認

### 静的ファイル404エラー
- ビルドプロセスが正常に完了したか確認
- `public/build` ディレクトリにファイルが存在するか確認

### タイムアウトエラー
- Tursoデータベースへの接続が遅い可能性
- OpenAI APIのレスポンスが遅い可能性
- サーバーのメモリ不足の可能性（Renderのメトリクスを確認）

## 7. 修正後の確認

すべての問題が解決したら：
1. 本番環境で正常にチャットが動作するか確認
2. エラーログが出ていないか確認
3. デバッグモードを無効化
4. 再度デプロイして確認