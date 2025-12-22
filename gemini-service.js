// gemini-service.js - Gemini API統合サービス（Vercel Serverless対応版）
class GeminiService {
    constructor() {
        // Vercel Serverless Function経由でAPIを呼び出す
        this.apiEndpoint = '/api/chat';
        this.configEndpoint = '/api/config';
        this.chatModel = 'gemini-3-flash-preview';
        this.chatHistory = [];
        this.retryDelay = 2000;
        this.maxRetries = 5;
        this._isConfigured = null; // キャッシュ

        // Gemini 3 Flash Preview用の最適化されたパラメータ
        this.chatParams = {
            temperature: 0.7,
            maxOutputTokens: 8192,
            topP: 0.9,
            topK: 40
        };

        // グラウンディング設定
        this.groundingConfig = {
            enableWebSearch: false,
            enableDynamicRetrieval: false,
            searchQueries: {
                valorant: 'VALORANT',
                tactics: 'VALORANT tactics strategies',
                meta: 'VALORANT tournament meta analysis agents'
            }
        };

        // サーバー状態監視
        this.serverStatus = {
            isAvailable: true,
            lastError: null,
            overloadDetectedAt: null,
            nextRetryAfter: null
        };

        // 初期化時に設定を確認
        this.checkConfiguration();
    }

    // ブラウザ環境でのデバッグモード判定
    isDebugMode() {
        try {
            return (typeof window !== 'undefined' &&
                   (window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1' ||
                    window.location.protocol === 'file:' ||
                    window.location.search.includes('debug=true')));
        } catch (error) {
            return false;
        }
    }

    // サーバー側の設定を確認
    async checkConfiguration() {
        try {
            const response = await fetch(this.configEndpoint);
            const data = await response.json();
            this._isConfigured = data.gemini === true;
            console.log('🔍 API設定状況:', data);
            return this._isConfigured;
        } catch (error) {
            console.warn('設定確認に失敗:', error.message);
            // ローカル開発時はtrueとして扱う
            if (this.isDebugMode()) {
                this._isConfigured = true;
            }
            return this._isConfigured;
        }
    }

    // APIキーが設定されているかチェック（サーバー側で管理）
    isConfigured() {
        // キャッシュがあればそれを返す
        if (this._isConfigured !== null) {
            return this._isConfigured;
        }
        // 初回はtrueとして扱い、実際のAPI呼び出し時にエラーになれば通知
        return true;
    }

    // 以下のメソッドは互換性のため残すが、実質的には何もしない
    setApiKey(apiKey) {
        console.log('APIキーはVercel環境変数で管理されます');
    }

    getApiKey() {
        return '***server-managed***';
    }

    clearApiKey() {
        console.log('APIキーはVercel環境変数で管理されます');
    }

    // 接続テスト（サーバーレス関数経由）
    async testConnection() {
        try {
            console.log('🔄 Gemini API接続テスト中（サーバー経由）...');

            // サーバーの設定を確認
            const configResponse = await fetch(this.configEndpoint);
            const configData = await configResponse.json();

            if (!configData.gemini) {
                throw new Error('Vercel環境変数にGEMINI_API_KEYが設定されていません');
            }

            // シンプルなリクエストでテスト
            const testMessages = [{
                role: 'user',
                parts: [{ text: 'Hello' }]
            }];

            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: testMessages,
                    model: this.chatModel,
                    generationConfig: { maxOutputTokens: 100 }
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API接続エラー');
            }

            console.log('✅ Gemini API接続テスト成功!');
            this._isConfigured = true;

            return {
                success: true,
                message: '接続に成功しました',
                model: this.chatModel,
                usage: data.usageMetadata || {}
            };

        } catch (error) {
            console.error('❌ Gemini API接続テスト失敗:', error.message);
            this._isConfigured = false;
            throw new Error(`接続テストに失敗しました: ${error.message}`);
        }
    }

    // サーバー状態チェック（リクエスト前に呼び出し）- 診断モード用に無効化
    checkServerStatus() {
        console.log('🔍 診断モード: サーバー状態チェックをスキップ');
        return true;
    }

    // サーバー過負荷状態を記録（診断モード用に無効化）
    recordServerOverload() {
        console.log('� 診断モード: 過負荷状態の記録をスキップ');
    }

    // サーバー状態をリセット（成功時）
    resetServerStatus() {
        console.log('🔍 診断モード: サーバー状態リセットをスキップ');
    }

    // ゲームコンテキスト情報を取得
    getGameContext() {
        try {
            // アプリケーションはVALORANT専用のため、ゲーム情報を固定
            const currentGame = {
                name: 'VALORANT',
                category: 'FPS'
            };

            // プレイヤー統計を取得
            const playerStats = {
                winRate: document.getElementById('win-rate')?.textContent || '0%',
                // VALORANT用に統計フィールドを調整（将来的にUI側のIDも合わせるべきだが、まずはフォールバック値として）
                driveRushSuccess: document.getElementById('drive-rush-success')?.textContent || '0.0', // ヘッドショット率などに相当するプレースホルダー
                antiAirAccuracy: document.getElementById('anti-air-accuracy')?.textContent || '0.0%',
                rank: document.getElementById('player-rank')?.textContent || 'Unranked',
                gamesPlayed: document.getElementById('games-played')?.textContent || '0'
            };

            // 目標リストを取得
            const goals = this.getCurrentGoals();

            return {
                game: currentGame,
                stats: playerStats,
                goals: goals
            };
        } catch (error) {
            console.warn('Failed to get game context:', error);
            return {
                game: { name: 'VALORANT', category: 'FPS' },
                stats: { winRate: '0%', rank: 'Unranked', gamesPlayed: '0' },
                goals: []
            };
        }
    }

    // 現在の目標を取得
    getCurrentGoals() {
        try {
            const goalElements = document.querySelectorAll('#goals-list .goal-item');
            const goals = [];
            goalElements.forEach(element => {
                const title = element.querySelector('.goal-title')?.textContent;
                const deadline = element.querySelector('.goal-deadline')?.textContent;
                if (title) {
                    goals.push({ title, deadline });
                }
            });
            return goals;
        } catch (error) {
            console.warn('Failed to get goals:', error);
            return [];
        }
    }

    // Gemini 2.5 Flash用の高度なシステムプロンプトを生成
    generateSystemPrompt(context) {
        const { game, stats, goals } = context;

        return `あなたは${game.name}専門のAIコーチです。

【プレイヤー情報】
- ランク: ${stats.rank}
- 勝率: ${stats.winRate}

【重要な回答ルール】
1. **回答は必ず200字以内**に収めてください
2. まず相手の発言に**共感や要約**を1文で示す
3. 具体的なアドバイスを**1-2点だけ**簡潔に伝える
4. 最後に**質問で終わる**（次のアクションを聞く）
5. 絵文字は使わない
6. 日本語で回答

【回答例】
「エイムが安定しないんですね。練習の成果は必ず出ますよ。まずはデスマッチで15分ウォームアップを試してみては？どのマップで特に苦戦していますか？」

会話のキャッチボールを意識し、相手が話しやすい雰囲気を作ってください。`;
    }

    // エラーハンドリングとリトライロジック（サーバーレス関数経由）
    async makeAPIRequest(messages, generationConfig = null, retryCount = 0) {
        // ローディング開始（初回のみ表示）
        try { window.app?.showLoading(retryCount === 0 ? 'AIに問い合わせ中...' : '再試行中...'); } catch {}

        console.log(`🔍 API Request Details:`, {
            endpoint: this.apiEndpoint,
            method: 'POST',
            messagesCount: messages.length,
            retryCount: retryCount
        });

        try {
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: messages,
                    model: this.chatModel,
                    generationConfig: generationConfig || this.chatParams
                })
            });

            console.log(`📡 API Response:`, {
                status: response.status,
                statusText: response.statusText
            });

            // 503エラーの場合、指数バックオフでリトライ
            if (response.status === 503) {
                const errorData = await response.json().catch(() => null);
                console.error(`🔍 503エラーの詳細:`, errorData);

                // サーバー過負荷状態を記録
                this.serverStatus.isAvailable = false;
                this.serverStatus.lastError = new Date();
                this.serverStatus.overloadDetectedAt = Date.now();

                // 最大リトライ回数をチェック
                if (retryCount < this.maxRetries) {
                    const waitMs = this.retryDelay * Math.pow(2, retryCount);
                    const waitSeconds = (waitMs / 1000).toFixed(1);

                    console.log(`⏳ 503エラー（サーバー過負荷）: ${retryCount + 1}/${this.maxRetries}回目のリトライを${waitSeconds}秒後に実行します...`);

                    if (retryCount === 0 && window.app) {
                        try {
                            window.app.showToast(`AIサーバーが混雑しています。自動的に再試行します...`, 'warning');
                        } catch (e) {}
                    }

                    await this.delay(waitMs);
                    return await this.makeAPIRequest(messages, generationConfig, retryCount + 1);
                }

                this.serverStatus.nextRetryAfter = Date.now() + 60000;
                const detailMessage = errorData?.error?.message || 'Service Unavailable';
                console.warn(`⚠️ 最大リトライ回数(${this.maxRetries})に達しました。`);
                
                if (detailMessage.includes('quota') || detailMessage.includes('exceeded')) {
                    throw new Error(`APIクォータまたは制限に達しています。しばらく待ってから再試行してください。`);
                } else if (detailMessage.includes('billing') || detailMessage.includes('payment')) {
                    throw new Error(`課金またはAPIキーの問題があります。Google Cloudコンソールで設定を確認してください。`);
                } else if (detailMessage.includes('region') || detailMessage.includes('location')) {
                    throw new Error(`地域制限またはアクセス制限があります。お住まいの地域での利用可能性を確認してください。`);
                } else if (detailMessage.includes('overloaded') || detailMessage.includes('Overloaded')) {
                    throw new Error(`Gemini AIサービスが混雑しています（${this.maxRetries}回試行済み）。1分後に再度お試しください。`);
                } else {
                    throw new Error(`Gemini AIサービスが一時的に利用できません (503)。${this.maxRetries}回の再試行後も接続できませんでした。1分後に再度お試しください。`);
                }
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const errorMessage = errorData?.error || `HTTP ${response.status}: ${response.statusText}`;

                console.error(`❌ API Error:`, {
                    status: response.status,
                    errorData: errorData
                });

                if (response.status === 500 && errorMessage.includes('GEMINI_API_KEY')) {
                    throw new Error('Vercel環境変数にGEMINI_API_KEYを設定してください');
                } else if (response.status === 401 || response.status === 403) {
                    throw new Error('APIキーが無効か、権限がありません');
                } else if (response.status === 429) {
                    throw new Error('レート制限に達しました。しばらく待ってから再試行してください');
                } else {
                    throw new Error(errorMessage);
                }
            }

            const data = await response.json();
            console.log(`✅ API Request successful`);
            try { window.app?.hideLoading(); } catch {}
            return data;
        } catch (error) {
            console.error(`💥 API Request failed:`, error);

            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('ネットワーク接続に失敗しました。インターネット接続を確認してください');
            }
            try { window.app?.hideLoading(); } catch {}
            throw error;
        }
    }

    // 遅延処理
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // チャットメッセージ送信（サーバーレス関数経由）
    async sendChatMessage(message, includeHistory = true, showOverlay = true) {
        try {
            if (showOverlay) {
                try { window.app?.showLoading('AIが考え中...'); } catch {}
            }
            const context = this.getGameContext();
            const systemPrompt = this.generateSystemPrompt(context);

            // メッセージ履歴を構築
            const messages = [];

            // システムプロンプトを追加
            messages.push({
                role: 'user',
                parts: [{ text: systemPrompt }]
            });

            messages.push({
                role: 'model',
                parts: [{ text: 'コーチとしてサポートします。何でも聞いてください！' }]
            });

            // 履歴を含める場合は追加
            if (includeHistory && this.chatHistory.length > 0) {
                this.chatHistory.forEach(item => {
                    messages.push({
                        role: 'user',
                        parts: [{ text: item.user }]
                    });

                    messages.push({
                        role: 'model',
                        parts: [{ text: item.assistant }]
                    });
                });
            }

            // 現在のメッセージを追加
            messages.push({
                role: 'user',
                parts: [{ text: message }]
            });

            // サーバーレス関数経由でリクエスト
            const data = await this.makeAPIRequest(messages, this.chatParams);

            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('APIから有効な応答が得られませんでした');
            }

            const candidate = data.candidates[0];

            // MAX_TOKENSエラーのチェック（警告のみで処理継続）
            if (candidate.finishReason === 'MAX_TOKENS') {
                console.warn('⚠️ Response truncated due to token limit');
            }

            if (!candidate || !candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
                console.error('Invalid API response structure:', data);
                throw new Error('APIレスポンスの形式が無効です');
            }

            if (!candidate.content.parts[0].text) {
                console.error('No text in response part:', candidate.content.parts[0]);
                throw new Error('AIからのテキスト応答がありません');
            }

            const aiResponse = candidate.content.parts[0].text;

            // チャット履歴を更新（最新20件まで保持）
            this.chatHistory.push({
                user: message,
                assistant: aiResponse
            });

            if (this.chatHistory.length > 20) {
                this.chatHistory = this.chatHistory.slice(-20);
            }

            const result = {
                response: aiResponse,
                usage: data.usageMetadata || {}
            };

            if (showOverlay) {
                try { window.app?.hideLoading(); } catch {}
            }
            return result;

        } catch (error) {
            if (showOverlay) {
                try { window.app?.hideLoading(); } catch {}
            }
            console.error('Gemini chat error:', error);
            throw error;
        }
    }







    // 気づきタグ生成 (3ステップ版)
    async generateInsightTags(feelings, analysisMode = 'browsing', fileContent = null) {
        if (!this.isConfigured()) {
            throw new Error('Gemini APIキーが設定されていません');
        }

        try {
            // Step 1: 入力文の推敲
            console.log('📝 Step 1: 入力文を推敲・構造化中...');
            const refinedResult = await this.refineInputContent(feelings);
            const refinedQuery = refinedResult.structuredContent;
            console.log('✅ Step 1完了 - 推敲されたクエリ:', refinedQuery);

            let context = '';
            let processingSteps = ['推敲'];

            // Step 2: モードに応じてコンテキストを取得
            if (analysisMode === 'file' && fileContent) {
                context = await this.findRelevantContextInFile(refinedQuery, fileContent);
                processingSteps.push('コンテキスト検索');
            } else {
                // ブラウジングモードまたはファイルがない場合は、推敲されたクエリをそのままコンテキストとして扱う
                context = refinedQuery;
            }

            // コンテキストがない場合は、元の入力でフォールバック
            if (!context) {
                console.warn('⚠️ 関連コンテキストが見つからなかったため、元の入力を使用します。');
                context = feelings;
            }

            // Step 3: コンテキストからタグ生成
            console.log('🏷️ Step 3: コンテキストからタグ生成中...');
            processingSteps.push('タグ生成');

            // コンテキストを短縮してトークンエラーを回避
            const truncatedContext = context.length > 200 ? context.substring(0, 200) : context;

            let tagPrompt = `VALORANTの戦術分析用タグを3～5個生成。必ず#で始めてください。

分析内容: "${truncatedContext}"

例: #エイム練習 #スキル管理 #立ち回り改善 #チーム連携

タグのみ出力:`;

            const useGrounding = analysisMode === 'browsing';
            const requestBody = this.createGroundedRequest(tagPrompt, truncatedContext, useGrounding);
            requestBody.generationConfig.maxOutputTokens = 8192; // APIの最大値
            requestBody.generationConfig.temperature = 0.7;
            requestBody.generationConfig.topK = 40;
            requestBody.generationConfig.topP = 0.95;

            const url = `${this.baseUrl}/models/${this.chatModel}:generateContent?key=${this.apiKey}`;
            const response = await this.makeAPIRequest(url, requestBody);
            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('タグ生成の応答が得られませんでした');
            }

            const candidate = data.candidates[0];
            const aiResponse = candidate.content?.parts?.[0]?.text || '';

            // デバッグログを追加
            console.log('🔍 Step 3 レスポンス詳細:', {
                finishReason: candidate.finishReason,
                hasResponse: !!aiResponse,
                responseLength: aiResponse.length,
                responsePreview: aiResponse.substring(0, 200)
            });

            // SAFETYエラーの場合
            if (candidate.finishReason === 'SAFETY') {
                console.error('❌ Step 3: 安全性フィルタによりブロックされました。');
                throw new Error('AIの安全性フィルタにより、この内容は処理できませんでした。入力内容を確認してください。');
            }

            if (candidate.finishReason === 'RECITATION') {
                console.warn('⚠️ Step 3: RECITATION検出。部分応答を使用します。');
            }

            if (candidate.finishReason === 'MAX_TOKENS') {
                console.warn('⚠️ Step 3: トークン制限。部分応答を使用します。');
            }

            // 応答がない場合はエラー
            if (!aiResponse) {
                console.error('❌ Step 3: AIからテキスト応答がありません。');
                throw new Error('AIから応答が得られませんでした。時間をおいて再試行してください。');
            }

            const tags = this.extractTags(aiResponse);
            console.log('✅ Step 3完了 - 生成されたタグ:', tags);
            
            // タグが生成できなかった場合はエラー
            if (!tags || tags.length === 0) {
                console.error('❌ タグ抽出失敗。AI応答:', aiResponse);
                throw new Error('タグを抽出できませんでした。AIの応答: ' + aiResponse.substring(0, 100));
            }

            return {
                tags: tags,
                originalResponse: aiResponse,
                refinedContent: refinedResult,
                groundingSources: candidate.groundingMetadata ? this.processGroundingMetadata(candidate.groundingMetadata) : null,
                usage: data.usageMetadata || {},
                processingSteps: processingSteps,
            };

        } catch (error) {
            console.error('❌ 気づきタグ生成エラー:', error);
            throw new Error('タグの生成に失敗しました: ' + error.message);
        }
    }

    // Step 2: ファイルから関連コンテキストを検索
    async findRelevantContextInFile(query, fileContent) {
        if (!fileContent) {
            return ''; // ファイル内容がなければ空文字を返す
        }

        console.log('🔎 Step 2: ファイルから関連コンテキストを検索中...');
        const MAX_FILE_CHUNK_SIZE = 6000; // APIに渡すファイル内容を削減してトークンエラーを回避
        const truncatedFileContent = fileContent.length > MAX_FILE_CHUNK_SIZE
            ? fileContent.substring(0, MAX_FILE_CHUNK_SIZE) + '\n...(以下省略)'
            : fileContent;

        const searchPrompt = `クエリに関連する情報を文書から200文字以内で抽出。なければ「関連情報なし」とだけ返答。

クエリ: "${query}"

文書:
${truncatedFileContent}

抽出結果:`;

        const requestBody = {
            contents: [{ parts: [{ text: searchPrompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 8192, // APIの最大値
                topK: 1,
                topP: 0.8,
            }
        };

        const url = `${this.baseUrl}/models/${this.chatModel}:generateContent?key=${this.apiKey}`;
        const response = await this.makeAPIRequest(url, requestBody);
        const data = await response.json();

        const relevantText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        if (relevantText.trim() === '関連情報なし') {
            console.log('✅ Step 2完了 - 関連情報なし');
            return '';
        }

        console.log('✅ Step 2完了 - 抽出されたコンテキスト:', relevantText);
        return relevantText;
    }

    // グラウンディング対応の検索クエリ生成
    generateSearchQueries(rawInput) {
        const queries = [];

        // エージェント名を検出して検索クエリを生成
        const agents = ['ジェット', 'レイナ', 'セージ', 'ソーヴァ', 'ブリムストーン', 'フェニックス', 'ヴァイパー', 'サイファー', 'レイズ', 'キルジョイ', 'スカイ', 'ヨル', 'アストラ', 'KAY/O', 'チェンバー', 'ネオン', 'フェイド', 'ハーバー', 'ゲッコー', 'デッドロック', 'クローヴ'];
        const foundAgents = agents.filter(agent => rawInput.includes(agent));

        foundAgents.forEach(agent => {
            queries.push(`VALORANT ${agent} 立ち回り 攻略`);
            queries.push(`VALORANT ${agent} アビリティ 使い方`);
        });

        // マップ戦略の検出
        const maps = ['バインド', 'ヘイヴン', 'スプリット', 'アセント', 'アイスボックス', 'ブリーズ', 'フラクチャー', 'パール', 'ロータス', 'サンセット'];
        const foundMaps = maps.filter(map => rawInput.includes(map));

        foundMaps.forEach(map => {
            queries.push(`VALORANT ${map} 戦略 攻略`);
        });

        // 技術的要素の検出
        if (rawInput.includes('エイム')) {
            queries.push('VALORANT エイム練習 上達方法');
        }
        if (rawInput.includes('スキル')) {
            queries.push('VALORANT スキル管理 タイミング');
        }
        if (rawInput.includes('立ち回り')) {
            queries.push('VALORANT 立ち回り ポジショニング 戦術');
        }

        // 最新メタ情報
        queries.push('VALORANT 最新 メタ 大会結果 2024');
        queries.push('VALORANT プロ選手 戦術 解説');

        return queries.slice(0, 5); // 最大5つのクエリに制限
    }

    // グラウンディング設定を含むリクエストボディ生成（フォールバック対応）
    createGroundedRequest(prompt, rawInput, useGrounding = true) {
        const baseRequest = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.3,
                maxOutputTokens: 1000,
                topP: 0.8,
                topK: 20
            }
        };

        // グラウンディングが有効な場合は正しいAPI構造でツール設定
        if (useGrounding && this.groundingConfig.enableWebSearch) {
            const searchQueries = this.generateSearchQueries(rawInput);

            if (searchQueries.length > 0) {
                // Python例に基づく正しいGoogle Search Tool構造
                baseRequest.tools = [{
                    googleSearch: {}  // Python例: google_search=types.GoogleSearch()
                }];

                // 検索を活用するよう指示を追加
                const enhancedPrompt = `${prompt}

【重要指示】
以下のキーワードについて最新の情報を検索して参考にしてください:
${searchQueries.map(query => `- ${query}`).join('\n')}

検索結果を踏まえて、最新で正確な情報に基づいた分析を行ってください。`;

                baseRequest.contents[0].parts[0].text = enhancedPrompt;

                console.log('🔍 グラウンディング有効化:', {
                    searchQueries: searchQueries,
                    toolsEnabled: true
                });
            }
        }

        return baseRequest;
    }


    // グラウンディングメタデータ処理
    processGroundingMetadata(metadata) {
        if (!metadata || !metadata.groundingChunks) {
            return null;
        }

        const sources = [];
        metadata.groundingChunks.forEach(chunk => {
            if (chunk.web) {
                sources.push({
                    title: chunk.web.title || 'タイトル不明',
                    url: chunk.web.uri || '#',
                    snippet: chunk.web.snippet || ''
                });
            }
        });

        return {
            searchPerformed: metadata.searchQueries || [],
            sources: sources,
            totalSources: sources.length
        };
    }

    // 入力文の推敲・構造化
    async refineInputContent(rawInput) {
        try {
            // 入力を制限して、トークン制限エラーを回避
            const truncatedInput = rawInput.length > 300 ? rawInput.substring(0, 300) + '...' : rawInput;
            
            let refinePrompt = `試合感想を分析用に要約してください。

入力: "${truncatedInput}"

指示:
- 感情表現を具体的な状況に変換
- VALORANTのエージェント名、マップ名、戦術用語を抽出
- 150字以内で要約

出力形式(JSON):
{"structuredContent":"要約文","extractedElements":["キーワード1","キーワード2"]}`;

            // ブラウジングモードは推敲では使用しないため、useGroundingは常にfalse
            const requestBody = this.createGroundedRequest(refinePrompt, truncatedInput, false);
            requestBody.generationConfig.maxOutputTokens = 8192; // APIの最大値
            requestBody.generationConfig.temperature = 0.3;

            const url = `${this.baseUrl}/models/${this.chatModel}:generateContent?key=${this.apiKey}`;
            const response = await this.makeAPIRequest(url, requestBody);
            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('入力文推敲の応答が得られませんでした');
            }

            const candidate = data.candidates[0];

            // デバッグログを追加
            console.log('🔍 推敲レスポンス詳細:', {
                finishReason: candidate.finishReason,
                hasContent: !!candidate.content?.parts?.[0]?.text,
                contentLength: candidate.content?.parts?.[0]?.text?.length || 0
            });

            if (candidate.finishReason === 'SAFETY') {
                console.warn('⚠️ 推敲: 安全性フィルタによってブロックされました。フォールバック実行。');
                return this.createFallbackRefinement(rawInput);
            }
            
            if (candidate.finishReason === 'MAX_TOKENS') {
                console.warn('⚠️ 推敲: 応答がトークン制限で切り詰められました。部分応答を使用します。');
            }

            let aiResponse = candidate.content?.parts?.[0]?.text || '';

            if (!aiResponse) {
                console.warn('⚠️ 推敲: AIからのテキスト応答がありません。フォールバック実行。');
                return this.createFallbackRefinement(rawInput);
            }

            try {
                const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log('✅ 推敲: JSON解析成功');
                    return parsed;
                }
                console.warn('⚠️ 推敲: 応答がJSON形式でないため、フォールバックします。');
            } catch (parseError) {
                console.warn('⚠️ 推敲: JSON解析失敗、フォールバック実行:', parseError);
            }

            return this.createFallbackRefinement(rawInput, aiResponse);

        } catch (error) {
            console.warn('入力文推敲でエラー、フォールバック実行:', error);
            return this.createFallbackRefinement(rawInput);
        }
    }

    // フォールバック用の推敲
    createFallbackRefinement(rawInput, aiResponse = '') {
        return {
            structuredContent: rawInput, // 元の入力をそのまま使用
            extractedElements: this.extractBasicElements(rawInput),
            keyPoints: this.identifyKeyPoints(rawInput)
        };
    }

    // 基本要素抽出
    extractBasicElements(text) {
        const elements = [];

        // 技術面の要素（VALORANT用）
        const techKeywords = ['エイム', 'スキル', 'アビリティ', 'ウルト', 'ピーク'];
        const foundTech = techKeywords.filter(keyword => text.includes(keyword));
        if (foundTech.length > 0) {
            elements.push(`技術面: ${foundTech.join('、')}に関する課題`);
        }

        // エージェント要素
        const agentKeywords = ['ジェット', 'レイナ', 'セージ', 'ソーヴァ', 'ブリムストーン', 'フェニックス'];
        const foundAgents = agentKeywords.filter(keyword => text.includes(keyword));
        if (foundAgents.length > 0) {
            elements.push(`エージェント対策: ${foundAgents.join('、')}戦での課題`);
        }

        // 戦術面
        const tacticKeywords = ['立ち回り', 'ポジション', '連携', 'マップコントロール'];
        const foundTactics = tacticKeywords.filter(keyword => text.includes(keyword));
        if (foundTactics.length > 0) {
            elements.push(`戦術面: ${foundTactics.join('、')}の調整が必要`);
        }

        return elements.length > 0 ? elements : ['一般的な試合振り返り'];
    }

    // キーポイント特定
    identifyKeyPoints(text) {
        const points = [];

        // ネガティブな表現から改善点を抽出
        if (text.includes('できなかった') || text.includes('失敗') || text.includes('やられた')) {
            points.push('技術精度の向上が必要');
        }

        if (text.includes('勝てた') || text.includes('成功') || text.includes('良かった')) {
            points.push('成功した戦術を継続');
        }

        if (text.includes('焦り') || text.includes('判断')) {
            points.push('メンタル管理の改善');
        }

        return points.length > 0 ? points : ['総合的な実力向上'];
    }

    // テキストからハッシュタグを抽出（改良版）
    extractTags(text) {
        console.log('🔍 タグ抽出開始:', { inputText: text.substring(0, 200), textLength: text.length });
        
        // ハッシュタグの正規表現を拡張（英数字、ひらがな、カタカナ、漢字、アンダースコア、ハイフンに対応）
        const tagRegex = /#[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\w\-_]+/g;
        const matches = text.match(tagRegex);

        console.log('🔍 正規表現マッチ結果:', matches);

        if (matches) {
            // タグをクリーンアップし、重複削除
            const cleanTags = matches
                .map(tag => tag.trim())
                .filter(tag => tag.length > 2) // 短すぎるタグを除外
                .filter(tag => !tag.includes('例')) // 「例」を含むタグを除外
                .slice(0, 5); // 最大5個

            console.log('🔍 クリーンアップ後のタグ:', cleanTags);

            if (cleanTags.length > 0) {
                return [...new Set(cleanTags)];
            }
        }

        // ハッシュタグが見つからない場合は空配列を返す
        console.warn('⚠️ ハッシュタグが見つかりませんでした');
        return [];
    }

    // チャット履歴クリア
    clearChatHistory() {
        this.chatHistory = [];
        console.log('チャット履歴をクリアしました');
    }

    // 画像から試合データを分析（VALORANT専用 - 現在無効化中）
    async analyzeMatchImage(imageFile) {
        // この機能は現在VALORANTでは利用できません
        throw new Error('画像分析機能は現在VALORANTでは利用できません。個別入力をご利用ください。');
        
        /*
        if (!this.isConfigured()) {
            throw new Error('Gemini APIキーが設定されていません');
        }

        try {
            console.log('📸 画像分析開始:', imageFile.name, imageFile.size);
            
            // 画像をBase64に変換
            const base64Image = await this.fileToBase64(imageFile);
            const imageData = base64Image.split(',')[1]; // data:image/png;base64, を除去
            
            // 画像の形式を判定
            const mimeType = imageFile.type || 'image/png';
            
            const analysisPrompt = `あなたは画像認識の専門家です。この画像はVALORANTの戦績統計画面のスクリーンショットです。
以下の詳細な手順に従って、画像から正確にデータを抽出し、JSON形式で出力してください。

═══════════════════════════════════════════════════════
📋 ステップ1: 画像形式の判定
═══════════════════════════════════════════════════════
まず、この画像が以下のどちらの形式かを判定してください：

【形式A: 使用キャラクター別成績】
- 画面上部に「FIGHTERS PROFILE」タブが表示
- ユーザーコードとSteam IDが表示されている
- 「絞り込み」オプションと「Act 5 モード すべて」などのフィルタ
- 「ALL」行に総合成績が表示
- キャラクター名(LUKE, JAMIE, MANON等)とその戦績が一覧表示
- 各行の形式: キャラクター名 | 試合数(例: 14勝/23戦) | 勝率%(例: 60.87%)

【形式B: 対戦相手別成績】  
- 画面上部に「FIGHTERS PROFILE」タブが表示
- ユーザーコードが表示されている(Steam IDは隠されている場合あり)
- 「キャラクター別対戦数」セクション
- 「絞り込み」オプションと「Act 0 モード ランクマッチ」などのフィルタ
- 使用キャラクター名(MARISA等)が大きく表示
- 対戦相手キャラクター(KIMBERLY, ZANGIEF, LILY等)とその戦績
- 各行の形式: 対戦相手名 | 試合数(例: 33戦) | 勝率%(例: 54.55%)

═══════════════════════════════════════════════════════
📋 ステップ2: データ抽出の具体的手順
═══════════════════════════════════════════════════════

【形式A: 使用キャラクター別成績の場合】
1. 「ALL」行を見つけ、総合戦績を抽出
   - 「14勝/23戦」のような表記から勝利数と試合数を分離
   - 「60.87%」のような表記から勝率を抽出
   
2. 各キャラクター行を処理（LUKE, JAMIE, MANON, KIMBERLY, MARISA等）
   - キャラクター名: 画像表示通りに抽出（LUKE, JAMIE等）
   - 「14勝/23戦」形式の場合:
     * wins = 14, totalMatches = 23
     * winRate = (14/23)*100 = 60.87
   - 勝率が直接表示されている場合はその値を使用
   
3. 試合数が0のキャラクター（0勝/0戦, 0.00%）も含める

【形式B: 対戦相手別成績の場合】
1. 使用キャラクター名を抽出（画面に大きく表示されているキャラ名）
   - この情報はメタデータとして使用可能
   
2. 各対戦相手行を処理（KIMBERLY, ZANGIEF, LILY, GUILE, JP等）
   - キャラクター名: 画像表示通りに抽出
   - 試合数: 「33戦」→ totalMatches = 33
   - 勝率: 「54.55%」→ winRate = 54.55
   - 勝利数を計算: wins = Math.round(33 × 54.55 / 100) = 18
   
3. 試合数が0の対戦相手も含める

═══════════════════════════════════════════════════════
📋 ステップ3: データの計算と検証
═══════════════════════════════════════════════════════

すべてのエントリーに対して以下を実行：
1. **必須値の確保**
   - character: 画像表示通りのキャラクター名（例: LUKE, KIMBERLY）
   - totalMatches: 試合数（整数）
   - winRate: 勝率（小数、0-100）
   - wins: 勝利数（整数）

2. **不足データの計算**
   - 勝利数が不明な場合: wins = Math.round(totalMatches × winRate / 100)
   - 勝率が不明な場合: winRate = (wins / totalMatches) × 100
   
3. **データの妥当性チェック**
   - totalMatches >= wins であることを確認
   - winRate は 0 から 100 の範囲内
   - 小数点以下は2桁まで

═══════════════════════════════════════════════════════
📋 ステップ4: JSON出力形式
═══════════════════════════════════════════════════════

以下の形式で、抽出したすべてのデータを出力してください：

{
  "dataType": "player_characters" または "opponent_characters",
  "matches": [
    {
      "character": "LUKE",
      "totalMatches": 23,
      "winRate": 60.87,
      "wins": 14
    }
  ]
}

**dataTypeの値:**
- "player_characters": 形式A（使用キャラクター別成績）の場合
- "opponent_characters": 形式B（対戦相手別成績）の場合

═══════════════════════════════════════════════════════
📋 出力例
═══════════════════════════════════════════════════════

【形式A: 使用キャラクター別成績の出力例】
{
  "dataType": "player_characters",
  "matches": [
    {"character": "ALL", "totalMatches": 23, "winRate": 60.87, "wins": 14},
    {"character": "LUKE", "totalMatches": 23, "winRate": 60.87, "wins": 14},
    {"character": "JAMIE", "totalMatches": 0, "winRate": 0.00, "wins": 0},
    {"character": "MANON", "totalMatches": 0, "winRate": 0.00, "wins": 0}
  ]
}

【形式B: 対戦相手別成績の出力例】
{
  "dataType": "opponent_characters",
  "matches": [
    {"character": "KIMBERLY", "totalMatches": 33, "winRate": 54.55, "wins": 18},
    {"character": "ZANGIEF", "totalMatches": 33, "winRate": 69.70, "wins": 23},
    {"character": "LILY", "totalMatches": 25, "winRate": 76.00, "wins": 19},
    {"character": "GUILE", "totalMatches": 25, "winRate": 52.00, "wins": 13},
    {"character": "JP", "totalMatches": 23, "winRate": 47.83, "wins": 11}
  ]
}

═══════════════════════════════════════════════════════
⚠️ 重要な注意事項
═══════════════════════════════════════════════════════
1. **出力形式**: JSON形式のみ。説明文や追加コメント不要
2. **キャラクター名**: 画像に表示されている通りの大文字英語をそのまま使用（例: LUKE, KIMBERLY, ZANGIEF）
3. **数値精度**: 画像から読み取った数値を正確に抽出・計算
4. **完全性**: 試合数0のキャラクターも含める
5. **ALL扱い**: 「ALL」は形式Aでのみ出現（総合成績）
6. **不明瞭な場合**: 画像が不鮮明でも推測せず、読み取れる範囲で正確に抽出

それでは、画像を分析して上記の手順に従ってJSON出力を生成してください。`;

            const requestBody = {
                contents: [{
                    parts: [
                        { text: analysisPrompt },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: imageData
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1, // 低い温度で正確性を優先
                    maxOutputTokens: 2048,
                    topP: 0.8,
                    topK: 10
                }
            };

            const url = `${this.baseUrl}/models/${this.chatModel}:generateContent?key=${this.apiKey}`;
            const response = await this.makeAPIRequest(url, requestBody);
            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('画像分析の応答が得られませんでした');
            }

            const candidate = data.candidates[0];
            
            if (candidate.finishReason === 'SAFETY') {
                throw new Error('画像の内容が安全性フィルタによりブロックされました');
            }

            const aiResponse = candidate.content?.parts?.[0]?.text || '';
            
            if (!aiResponse) {
                throw new Error('画像分析の応答が空です');
            }

            console.log('🔍 AI応答:', aiResponse);

            // JSONを抽出
            const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('JSONデータを抽出できませんでした: ' + aiResponse.substring(0, 200));
            }

            const parsedData = JSON.parse(jsonMatch[0]);
            
            // データ検証
            if (!parsedData.matches || !Array.isArray(parsedData.matches)) {
                throw new Error('不正なデータ形式です');
            }

            // dataTypeの検証（オプショナル）
            const dataType = parsedData.dataType || 'unknown';
            const validDataTypes = ['player_characters', 'opponent_characters'];
            if (!validDataTypes.includes(dataType)) {
                console.warn('⚠️ 不明なdataType:', dataType, '- デフォルト値を使用します');
            }

            // 各マッチデータの検証と補完
            const validatedMatches = parsedData.matches.map(match => {
                // 勝利数が未設定の場合は計算
                if (match.wins === undefined && match.totalMatches && match.winRate !== undefined) {
                    match.wins = Math.round(match.totalMatches * match.winRate / 100);
                }
                
                // 勝率が未設定の場合は計算
                if (match.winRate === undefined && match.wins !== undefined && match.totalMatches) {
                    match.winRate = (match.wins / match.totalMatches) * 100;
                }
                
                return {
                    character: match.character || 'Unknown',
                    totalMatches: parseInt(match.totalMatches) || 0,
                    winRate: parseFloat(match.winRate) || 0,
                    wins: parseInt(match.wins) || 0
                };
            });

            console.log('✅ 画像分析完了:', {
                dataType: dataType,
                matchCount: validatedMatches.length,
                matches: validatedMatches
            });

            return {
                dataType: dataType,
                matches: validatedMatches,
                rawResponse: aiResponse,
                usage: data.usageMetadata || {}
            };

        } catch (error) {
            console.error('❌ 画像分析エラー:', error);
            throw new Error('画像の分析に失敗しました: ' + error.message);
        }
        */
    }

    // ファイルをBase64に変換
    async fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // デバッグ情報取得（グラウンディング情報追加）
    getDebugInfo() {
        return {
            isConfigured: this.isConfigured(),
            chatModel: this.chatModel,
            baseUrl: this.baseUrl,
            chatHistoryLength: this.chatHistory.length,
            retrySettings: {
                maxRetries: this.maxRetries,
                retryDelay: this.retryDelay
            },
            grounding: {
                webSearchEnabled: this.groundingConfig.enableWebSearch,
                dynamicRetrievalEnabled: this.groundingConfig.enableDynamicRetrieval,
                availableSearchQueries: Object.keys(this.groundingConfig.searchQueries),
                status: this.groundingConfig.enableWebSearch ? 'enabled' : 'disabled (API不支持)'
            },
            apiKeyLength: this.apiKey ? this.apiKey.length : 0,
            apiKeyPrefix: this.apiKey ? this.apiKey.substring(0, 10) + '...' : 'なし'
        };
    }

    // 設定リセット
    reset() {
        this.clearApiKey();
        this.clearChatHistory();
        console.log('Gemini Serviceの設定をリセットしました');
    }
}

// グローバルインスタンス
window.geminiService = new GeminiService();