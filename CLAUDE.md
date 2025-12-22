# e-Bridge プロジェクト設定

## 重要な注意事項

### APIモデルについて
- **Claudeの知識は古い可能性がある**: 新しいAPIモデルがリリースされていても、Claudeは知らない場合がある
- **ユーザーが指定したモデル名を勝手に変更しない**: 「存在しない」と思っても、新しくリリースされた可能性がある
- **現在使用中のGeminiモデル**: `gemini-3-flash-preview`
- **Gemini APIバージョン**: `v1beta`（新しいモデルはv1betaでのみサポート）
- **参考ドキュメント**: https://ai.google.dev/gemini-api/docs/models?hl=ja

### バージョン管理
- **現在のバージョン**: `v1.0.1`
- **バージョン表示場所**: index.html 58行目 `<div class="app-version" id="app-version">`
- **更新ルール**: 修正・更新のたびにバージョン番号を上げる
  - バグ修正: パッチ番号を上げる (例: v1.0.0 → v1.0.1)
  - 機能追加: マイナー番号を上げる (例: v1.0.1 → v1.1.0)
  - 大きな変更: メジャー番号を上げる (例: v1.1.0 → v2.0.0)

### 技術スタック
- フロントエンド: Vanilla JS, HTML, CSS
- バックエンド: Vercel Serverless Functions
- AI API: Google Gemini API, OpenAI Whisper API
- デプロイ: Vercel (GitHub連携)

### デプロイ先
- 本番URL: https://e-bridge.if-juku.net/
- Vercel URL: https://e-bridge.vercel.app/
- GitHubリポジトリ: https://github.com/Getabako/e-Bridge

### 環境変数（Vercel）
- `GEMINI_API_KEY`: Google Gemini APIキー
- `OPENAI_API_KEY`: OpenAI APIキー（Whisper用）
