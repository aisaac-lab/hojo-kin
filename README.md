# 補助金検索システム (Subsidy Search MVP)

OpenAI Assistants APIのFile Search機能を使用した補助金検索システムです。

## 機能

- 🤖 AIアシスタントによる自然な対話形式での補助金検索
- 📄 構造化されたMarkdownファイルによるデータ管理
- 🔍 OpenAI File Searchによる高精度な検索
- 💬 会話履歴の保持（Thread機能）
- 🚀 インフラ管理不要（ベクターDBなし）

## セットアップ

### 1. 環境変数の設定

`.env.example`を`.env`にコピーして、必要な値を設定します：

```bash
cp .env.example .env
```

### 2. 依存関係のインストール

```bash
npm install
```

### 3. データベースのセットアップ

```bash
npm run db:push
```

### 4. OpenAI Assistantの作成

```bash
npm run assistant:create
```

このコマンドを実行すると：
- 新しいAssistantが作成されます
- Vector Storeが作成されます
- 作成されたIDが表示されるので、`.env`ファイルに追加してください

### 5. 補助金データの同期

```bash
npm run sync:subsidies
```

### 6. アプリケーションの起動

```bash
npm run dev
```

## 使用方法

1. ブラウザで`http://localhost:3000`にアクセス
2. チャットインターフェースで補助金について質問
3. AIアシスタントが最適な補助金を提案

## プロジェクト構造

```
subsidy-search-mvp/
├── app/
│   ├── routes/
│   │   ├── _index.tsx         # メインページ
│   │   ├── api.chat.tsx       # チャットAPI
│   │   └── api.thread.tsx     # スレッド管理API
│   ├── components/
│   │   └── ChatInterface.tsx  # チャットUI
│   ├── services/
│   │   ├── assistant.server.ts # Assistants API管理
│   │   └── filestore.server.ts # ファイル管理
│   └── db.server.ts           # dbクライアント
├── scripts/
│   ├── create-assistant.ts    # Assistant作成スクリプト
│   └── sync-subsidies.ts      # データ同期スクリプト
└── data/
    └── subsidies/             # Markdownファイル保存先
```

## 技術スタック

- **フロントエンド**: Remix, React, TypeScript, Tailwind CSS
- **バックエンド**: Remix (Node.js)
- **データベース**: SQLite (db ORM)
- **AI/検索**: OpenAI Assistants API (File Search)
- **ファイル管理**: ローカルファイルシステム + OpenAI Files API

## デプロイメント

### Renderへのデプロイ

本プロジェクトはRenderへのデプロイに対応しています。詳細な手順は以下のドキュメントを参照してください：

- [Tursoセットアップガイド](./docs/TURSO_SETUP.md) - Tursoデータベースの設定
- [Renderデプロイメントガイド](./docs/RENDER_DEPLOYMENT.md) - Renderへのデプロイ手順

簡易手順：
1. Tursoアカウントを作成してデータベースをセットアップ
2. Renderでリポジトリを接続
3. 環境変数を設定
4. デプロイ！

## 注意事項

- OpenAI APIキーが必要です
- 本番環境では適切なセキュリティ対策を実施してください
- 補助金情報は定期的に更新が必要です
