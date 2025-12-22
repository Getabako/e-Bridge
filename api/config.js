/**
 * Vercel Serverless Function - API設定確認
 * APIキーが設定されているかを確認（キー自体は返さない）
 */

export default async function handler(req, res) {
    // CORSヘッダー設定
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONSリクエスト（プリフライト）への対応
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // GETメソッドのみ許可
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 環境変数の設定状況を確認（キー自体は返さない）
    const geminiConfigured = !!process.env.GEMINI_API_KEY;
    const openaiConfigured = !!process.env.OPENAI_API_KEY;

    return res.status(200).json({
        configured: geminiConfigured && openaiConfigured,
        gemini: geminiConfigured,
        openai: openaiConfigured,
        message: geminiConfigured && openaiConfigured
            ? 'すべてのAPIキーが設定されています'
            : '一部のAPIキーが未設定です。Vercelの環境変数を確認してください。'
    });
}
