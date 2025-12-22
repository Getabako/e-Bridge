/**
 * Vercel Serverless Function - OpenAI Whisper API
 * 環境変数: OPENAI_API_KEY
 */

export const config = {
    api: {
        bodyParser: false, // multipart/form-data を処理するため無効化
    },
};

// multipart/form-data パーサー
async function parseMultipartFormData(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
        });
        req.on('error', reject);
    });
}

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
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({
            error: 'OPENAI_API_KEY is not configured',
            message: 'Vercel環境変数にOPENAI_API_KEYを設定してください'
        });
    }

    try {
        // リクエストボディをそのまま転送
        const body = await parseMultipartFormData(req);

        // Content-Typeヘッダーを取得
        const contentType = req.headers['content-type'];

        // OpenAI Whisper APIを呼び出し
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': contentType
            },
            body: body
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Whisper API error:', data);
            return res.status(response.status).json({
                error: data.error?.message || 'Whisper API error',
                details: data
            });
        }

        // 成功レスポンスを返す
        return res.status(200).json(data);

    } catch (error) {
        console.error('Whisper API error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
