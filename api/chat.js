/**
 * Vercel Serverless Function - Gemini Chat API
 * 環境変数: GEMINI_API_KEY
 */

export default async function handler(req, res) {
    // CORSヘッダー設定
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // OPTIONSリクエスト（プリフライト）への対応
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // POSTメソッドのみ許可
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 環境変数からAPIキーを取得
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: 'GEMINI_API_KEY is not configured',
            message: 'Vercel環境変数にGEMINI_API_KEYを設定してください'
        });
    }

    try {
        const { messages, model = 'gemini-2.5-flash', generationConfig } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages is required and must be an array' });
        }

        // Gemini API URLを構築（v1betaで新しいモデルをサポート）
        const baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
        const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

        // リクエストボディを構築
        const requestBody = {
            contents: messages,
            generationConfig: generationConfig || {
                temperature: 0.7,
                maxOutputTokens: 8192,
                topP: 0.9,
                topK: 40
            }
        };

        // Gemini APIを呼び出し
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Gemini API error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Gemini API error',
                details: data
            });
        }

        // 成功レスポンスを返す
        return res.status(200).json(data);

    } catch (error) {
        console.error('Chat API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
