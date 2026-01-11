// coaching-service.js - 日替わりコーチングアドバイス管理（Gemini API動的生成版）
class CoachingService {
    constructor() {
        this.fallbackData = COACHING_ADVICE_DATABASE;
        this.userProgress = this.loadUserProgress();
        this.feedbackHistory = this.loadFeedbackHistory();
        this.geminiService = null;

        // Gemini APIサービスの初期化
        this.initializeGeminiService();
    }

    // Gemini APIサービスを初期化
    initializeGeminiService() {
        if (typeof GeminiService !== 'undefined' && window.unifiedApiManager?.isConfigured()) {
            try {
                this.geminiService = new GeminiService();
                console.log('CoachingService: Gemini API initialized');
            } catch (error) {
                console.warn('CoachingService: Failed to initialize Gemini API:', error);
            }
        }
    }

    // 本日のコーチングアドバイスを取得
    async getDailyCoaching(userProfile) {
        const today = new Date().toDateString();
        const cachedAdvice = this.getCachedAdvice(today);

        if (cachedAdvice) {
            // キャッシュから取得した場合も履歴に追加（重複チェック付き）
            this.ensureInHistory(cachedAdvice);
            return cachedAdvice;
        }

        try {
            // Gemini APIで動的生成を試行
            if (this.geminiService) {
                // レート制限をチェック
                this.checkApiRateLimit();

                const generatedAdvice = await this.generateAdviceWithGemini(userProfile);
                if (generatedAdvice) {
                    generatedAdvice.date = today;
                    generatedAdvice.source = 'gemini';
                    this.cacheAdvice(today, generatedAdvice);
                    return generatedAdvice;
                }
            }
        } catch (error) {
            if (error.message.includes('Rate limit')) {
                console.warn('CoachingService: Rate limit reached:', error.message);
                // レート制限の場合はキャッシュされたアドバイスがあれば使用
                const fallbackFromCache = this.getRecentCachedAdvice();
                if (fallbackFromCache) {
                    console.log('CoachingService: Using recent cached advice due to rate limit');
                    const advice = { ...fallbackFromCache, date: today, source: 'cached_fallback' };
                    this.ensureInHistory(advice);
                    return advice;
                }
            }
            console.warn('CoachingService: Gemini API generation failed, falling back to static data:', error);
        }

        // フォールバック: 目標達成向けの静的データから選択
        const fallbackAdvice = this.selectGoalOrientedAdvice(userProfile);
        fallbackAdvice.date = today;
        fallbackAdvice.source = 'fallback';
        this.cacheAdvice(today, fallbackAdvice);
        return fallbackAdvice;
    }

    // Gemini APIでアドバイスを動的生成
    async generateAdviceWithGemini(userProfile) {
        if (!this.geminiService) {
            throw new Error('Gemini API service not available');
        }

        const prompt = this.buildCoachingPrompt(userProfile);

        try {
            const response = await this.geminiService.sendChatMessage(prompt, false);

            let responseText = null;
            if (response && response.response) {
                responseText = response.response;
            } else if (response && response.text) {
                responseText = response.text;
            } else {
                console.error('CoachingService: Invalid API response:', response);
                throw new Error('Invalid response from Gemini API');
            }

            return this.parseGeminiResponse(responseText);
        } catch (error) {
            console.error('CoachingService: Gemini API error:', error);
            throw error;
        }
    }

    // Gemini API用のプロンプトを構築
    buildCoachingPrompt(userProfile) {
        const { gameGenre, skillLevel, currentGoals = [], weeklyGoals = [] } = userProfile;
        const recentFeedback = this.getRecentFeedbackAnalysis();
        const progressStats = this.getProgressStats();
        const goalProgress = this.getGoalProgress(userProfile);

        // 攻略ガイドを取得
        const strategyGuideText = this.getStrategyGuideContext();

        return `あなたは経験豊富なVALORANTコーチです。以下のプレイヤーの【現在の目標達成】に最適化されたコーチングアドバイスを作成してください。

## プレイヤー情報
- ゲームジャンル: ${this.getGameGenreDescription(gameGenre)}
- スキルレベル: ${this.getSkillLevelDescription(skillLevel)}
- 学習継続日数: ${progressStats.continuousLearningDays}日
- 完了レッスン数: ${progressStats.totalLessons}個

## 現在の目標と進捗
${goalProgress}

## 最近のフィードバック傾向
${recentFeedback}

${strategyGuideText}

## 重要：攻略知識を活用したアドバイス作成
今日のアドバイスは以下を意識してください：
1. 上記の攻略知識ベースの内容を参考に、具体的で実践的なアドバイスを提供
2. エージェントの役割、戦術セオリー、撃ち合いのコツなど攻略に基づいた内容
3. プレイヤーの目標に直接貢献する具体的なアクション
4. 進捗を測定可能な具体的な指標

## 出力形式
以下のJSON形式で回答してください：

\`\`\`json
{
  "id": "gemini_${Date.now()}",
  "category": "${gameGenre}",
  "skillLevels": ["${skillLevel}"],
  "headline": "目標達成に直結する魅力的なタイトル（35文字以内）",
  "coreContent": "攻略知識ベースを参考にした具体的な戦略とその理由（250-350文字程度）。エージェントの使い方、戦術、撃ち合いのコツなど具体的な攻略情報を含めてください。",
  "practicalStep": "今日実行すべき目標達成のための具体的なアクション（120文字以内）。測定可能で目標に直結する達成可能なタスクを設定してください。",
  "goalConnection": "このアドバイスが目標達成にどう貢献するかの説明（80文字以内）"
}
\`\`\`

## 注意事項
- 攻略知識ベースの内容を積極的に活用してください
- 必ず設定された目標に関連付けたアドバイスにしてください
- 目標がない場合は、スキル向上につながる新しい目標設定を提案してください
- プレイヤーのスキルレベルに適した難易度で目標達成をサポートしてください
- フィードバック履歴を考慮して目標達成の難易度を調整してください
- 具体的で実行可能、かつ目標達成に直結するアドバイスにしてください
- 日本語で分かりやすく書いてください`;
    }

    // 攻略ガイドのコンテキストを取得
    getStrategyGuideContext() {
        try {
            if (window.strategyGuideService) {
                const guideText = window.strategyGuideService.getGuidesForCoaching(6000);
                if (guideText && guideText.length > 0) {
                    return `## VALORANT攻略知識ベース（以下の知識を参考にアドバイスを作成）
${guideText}`;
                }
            }
        } catch (error) {
            console.warn('CoachingService: Failed to get strategy guide context:', error);
        }
        return '';
    }

    // ゲームジャンルの説明を取得
    getGameGenreDescription(gameGenre) {
        const descriptions = {
            'fps': 'FPS（First Person Shooter）',
            'moba': 'MOBA（Multiplayer Online Battle Arena）',
            'fighting': '対戦格闘ゲーム',
            'strategy': 'RTS（Real-Time Strategy）',
            'universal': '全般的なゲーミングスキル'
        };
        return descriptions[gameGenre] || 'ゲーム全般';
    }

    // スキルレベルの説明を取得
    getSkillLevelDescription(skillLevel) {
        const descriptions = {
            'beginner': '初心者（基本的なゲームメカニクスを学習中）',
            'intermediate': '中級者（ゲームの基本は理解し、上達を目指している）',
            'advanced': '上級者（高度な戦略と技術を身につけている）'
        };
        return descriptions[skillLevel] || '中級者';
    }

    // 最近のフィードバック分析を取得（コメント機能拡張版）
    getRecentFeedbackAnalysis() {
        const today = new Date().toDateString();
        const recentFeedback = this.feedbackHistory.slice(-10);
        const todayFeedbacks = this.getNextDayFeedbacks(today);

        if (recentFeedback.length === 0 && todayFeedbacks.length === 0) {
            return '- フィードバック履歴なし（初回利用者向けの基本的なアドバイスを提供してください）';
        }

        const feedbackCounts = {
            helpful: 0,
            too_easy: 0,
            too_hard: 0
        };

        recentFeedback.forEach(feedback => {
            feedbackCounts[feedback.feedbackType]++;
        });

        let analysis = '- 最近10件のフィードバック：\n';
        analysis += `  - 役に立った: ${feedbackCounts.helpful}件\n`;
        analysis += `  - 簡単すぎた: ${feedbackCounts.too_easy}件\n`;
        analysis += `  - 難しすぎた: ${feedbackCounts.too_hard}件\n`;

        if (feedbackCounts.too_easy > feedbackCounts.too_hard) {
            analysis += '- 調整指示: より挑戦的で高度な内容にしてください\n';
        } else if (feedbackCounts.too_hard > feedbackCounts.too_easy) {
            analysis += '- 調整指示: より基本的で理解しやすい内容にしてください\n';
        } else {
            analysis += '- 調整指示: 現在の難易度レベルを維持してください\n';
        }

        // 昨日のコメントフィードバックを追加
        if (todayFeedbacks.length > 0) {
            analysis += '\n## 昨日のフィードバックコメント（重要）：\n';
            todayFeedbacks.forEach((feedback, index) => {
                if (feedback.comment && feedback.comment.trim().length > 0) {
                    analysis += `${index + 1}. ${feedback.comment}\n`;
                }
            });
            analysis += '\n重要：上記のコメントを今日のアドバイスに具体的に反映してください。\n';
        }

        return analysis;
    }

    // Gemini APIのレスポンスをパース
    parseGeminiResponse(responseText) {
        try {
            // JSONブロックを抽出
            const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/);

            if (jsonMatch) {
                const jsonText = jsonMatch[1];
                const parsed = JSON.parse(jsonText);

                // 必要なフィールドの検証（目標達成向けの新フィールドを含む）
                if (parsed.headline && parsed.coreContent && parsed.practicalStep) {
                    // goalConnectionフィールドがない場合はデフォルト値を設定
                    if (!parsed.goalConnection) {
                        parsed.goalConnection = "今日のスキル向上を通じて全体的な目標達成をサポートします";
                    }
                    return parsed;
                } else {
                    throw new Error('Missing required fields in response');
                }
            } else {
                // JSONブロックがない場合、全体をJSONとして解析を試行
                const parsed = JSON.parse(responseText);

                if (parsed.headline && parsed.coreContent && parsed.practicalStep) {
                    // goalConnectionフィールドがない場合はデフォルト値を設定
                    if (!parsed.goalConnection) {
                        parsed.goalConnection = "今日のスキル向上を通じて全体的な目標達成をサポートします";
                    }
                    return parsed;
                } else {
                    throw new Error('Missing required fields in response');
                }
            }
        } catch (error) {
            console.error('CoachingService: Failed to parse Gemini response:', error);
            console.error('Response text:', responseText);
            throw new Error('Failed to parse Gemini API response');
        }
    }

    // ユーザープロファイルに基づいてパーソナライズされたアドバイスを選択（フォールバック用）
    selectPersonalizedAdvice(userProfile) {
        // 最初にアクティブなコーチングプランをチェック
        const planBasedAdvice = this.getPlanBasedAdvice(userProfile);
        if (planBasedAdvice) {
            return planBasedAdvice;
        }

        const { gameGenre, skillLevel } = userProfile;

        // フィードバック履歴に基づく優先度計算
        const categoryPriorities = this.calculateCategoryPriorities(userProfile);

        // 適切なカテゴリからアドバイスを選択
        const selectedCategory = this.selectCategory(gameGenre, categoryPriorities);
        const availableAdvice = this.getAdviceByCategory(selectedCategory, skillLevel);

        // 最近表示されていないアドバイスを優先
        const filteredAdvice = this.filterRecentAdvice(availableAdvice);

        // ランダムに選択
        const selectedAdvice = this.selectRandomAdvice(filteredAdvice);

        return {
            ...selectedAdvice,
            category: selectedCategory
        };
    }

    // カテゴリの優先度を計算
    calculateCategoryPriorities(userProfile) {
        const { gameGenre } = userProfile;
        const basePriorities = {
            universal: 0.3,    // 普遍的原則
            gameSpecific: 0.4, // ゲーム固有
            wellness: 0.3      // ウェルネス
        };

        // フィードバック履歴を反映
        const feedbackAdjustments = this.getFeedbackAdjustments();

        return this.adjustPriorities(basePriorities, feedbackAdjustments);
    }

    // カテゴリを選択
    selectCategory(gameGenre, priorities) {
        const random = Math.random();

        if (random < priorities.gameSpecific) {
            return this.getGameSpecificCategory(gameGenre);
        } else if (random < priorities.gameSpecific + priorities.wellness) {
            return 'wellness';
        } else {
            return 'universal';
        }
    }

    // ゲーム固有カテゴリを取得
    getGameSpecificCategory(gameGenre) {
        const gameGenreMap = {
            'fps': 'fps',
            'moba': 'moba',
            'fighting': 'fighting',
            'strategy': 'rts'
        };
        return gameGenreMap[gameGenre] || 'universal';
    }

    // カテゴリとスキルレベルでアドバイスをフィルタ
    getAdviceByCategory(category, skillLevel) {
        return this.fallbackData.filter(advice =>
            advice.category === category &&
            advice.skillLevels.includes(skillLevel)
        );
    }

    // 最近表示されたアドバイスを除外
    filterRecentAdvice(adviceList) {
        const recentAdvice = this.getRecentAdvice();
        return adviceList.filter(advice =>
            !recentAdvice.includes(advice.id)
        );
    }

    // ランダムにアドバイスを選択
    selectRandomAdvice(adviceList) {
        if (adviceList.length === 0) {
            // フォールバック: 全アドバイスから選択
            adviceList = this.fallbackData.filter(advice =>
                advice.category === 'universal'
            );
        }

        const randomIndex = Math.floor(Math.random() * adviceList.length);
        return adviceList[randomIndex];
    }

    // フィードバックを記録（コメント機能拡張版）
    recordFeedback(adviceId, feedbackType, comment = null) {
        const feedback = {
            adviceId,
            feedbackType, // 'helpful', 'too_easy', 'too_hard'
            comment, // 新規追加：ユーザーのコメント
            timestamp: new Date().toISOString(),
            date: new Date().toDateString()
        };

        this.feedbackHistory.push(feedback);
        this.saveFeedbackHistory();
        this.updateUserProgress(feedback);

        // コメントがある場合は次の日のコーチングプロンプトに反映
        if (comment && comment.trim().length > 0) {
            this.saveFeedbackForNextDay(feedback);
        }
    }

    // 次の日のコーチング用にフィードバックを保存
    saveFeedbackForNextDay(feedback) {
        try {
            const today = new Date().toDateString();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toDateString();

            const nextDayFeedbacks = this.getNextDayFeedbacks(tomorrowStr);
            nextDayFeedbacks.push({
                ...feedback,
                forDate: tomorrowStr,
                savedAt: today
            });

            localStorage.setItem(`coaching_next_day_feedback_${tomorrowStr}`, JSON.stringify(nextDayFeedbacks));
        } catch (error) {
            console.warn('Failed to save feedback for next day:', error);
        }
    }

    // 指定日の次の日向けフィードバックを取得
    getNextDayFeedbacks(dateStr) {
        try {
            const stored = localStorage.getItem(`coaching_next_day_feedback_${dateStr}`);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('Failed to load next day feedbacks:', error);
            return [];
        }
    }

    // ユーザープログレスを更新
    updateUserProgress(feedback) {
        const today = new Date().toDateString();

        if (!this.userProgress[today]) {
            this.userProgress[today] = {
                completed: false,
                feedback: null
            };
        }

        this.userProgress[today].completed = true;
        this.userProgress[today].feedback = feedback.feedbackType;

        this.saveUserProgress();

        // 進捗統計の更新を通知するためのイベントを発火
        if (typeof window !== 'undefined' && window.app) {
            setTimeout(() => {
                if (window.app.updateCoachingProgress) {
                    window.app.updateCoachingProgress();
                }
            }, 100);
        }
    }

    // 進捗統計を取得
    getProgressStats() {
        const totalDays = Object.keys(this.userProgress).length;
        const completedDays = Object.values(this.userProgress)
            .filter(day => day.completed).length;

        const currentStreak = this.calculateCurrentStreak();

        return {
            totalLessons: completedDays,
            continuousLearningDays: currentStreak,
            totalActiveDays: totalDays
        };
    }

    // 今日のフィードバック状態を取得
    getTodaysFeedbackStatus() {
        const today = new Date().toDateString();
        const todayProgress = this.userProgress[today];

        if (todayProgress && todayProgress.feedback) {
            return {
                hasFeedback: true,
                feedbackType: todayProgress.feedback
            };
        }

        return {
            hasFeedback: false,
            feedbackType: null
        };
    }

    // 現在の継続日数を計算
    calculateCurrentStreak() {
        const today = new Date();
        const todayStr = today.toDateString();
        let streak = 0;

        // 今日完了済みかどうかを確認
        const todayCompleted = this.userProgress[todayStr]?.completed || false;

        // 今日が完了済みの場合は今日から、そうでなければ昨日から計算開始
        const startOffset = todayCompleted ? 0 : 1;

        for (let i = startOffset; i < 365; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            const dateStr = checkDate.toDateString();

            if (this.userProgress[dateStr]?.completed) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }

    // キャッシュからアドバイスを取得
    getCachedAdvice(date) {
        try {
            const cached = localStorage.getItem(`coaching_advice_${date}`);
            return cached ? JSON.parse(cached) : null;
        } catch (error) {
            console.warn('CoachingService: Failed to load cached advice:', error);
            return null;
        }
    }

    // アドバイスをキャッシュ
    cacheAdvice(date, advice) {
        try {
            // キャッシュサイズ制限のチェック
            const cacheKey = `coaching_advice_${date}`;
            const cacheData = JSON.stringify(advice);

            // LocalStorageの容量制限を考慮（2-5MB程度が一般的）
            if (cacheData.length > 100000) { // 100KB以上の場合は警告
                console.warn('CoachingService: Advice data is unusually large, skipping cache');
                return;
            }

            localStorage.setItem(cacheKey, cacheData);

            // メタデータを保存（キャッシュ管理用）
            this.updateCacheMetadata(date, advice.source || 'unknown');

            // 履歴に追加（新機能）
            this.addToHistory(advice);

            // 古いキャッシュを削除（30日以上前）
            this.cleanOldCache();
        } catch (error) {
            console.warn('CoachingService: Failed to cache advice:', error);
        }
    }
    
    // 履歴に追加
    addToHistory(advice) {
        try {
            // 既存の履歴を取得
            const history = this.getHistory();
            
            // 新しいアドバイスオブジェクトを作成
            const historyEntry = {
                id: advice.id || `history_${Date.now()}`,
                headline: advice.headline,
                coreContent: advice.coreContent,
                practicalStep: advice.practicalStep,
                goalConnection: advice.goalConnection || '',
                date: advice.date || new Date().toDateString(),
                timestamp: new Date().toISOString(),
                source: advice.source || 'unknown'
            };
            
            // 履歴の先頭に追加（新しいものが上に来るように）
            history.unshift(historyEntry);
            
            // 履歴を保存
            localStorage.setItem('coachingHistory', JSON.stringify(history));
            
            console.log('CoachingService: Added advice to history:', historyEntry.headline);
        } catch (error) {
            console.warn('CoachingService: Failed to add to history:', error);
        }
    }
    
    // 履歴に確実に存在するようにする（重複チェック付き）
    ensureInHistory(advice) {
        try {
            const history = this.getHistory();
            const today = new Date().toDateString();
            
            // 今日の日付で既に同じIDまたはheadlineの履歴があるかチェック
            const existsToday = history.some(item => {
                const itemDate = new Date(item.timestamp).toDateString();
                return itemDate === today && 
                       (item.id === advice.id || item.headline === advice.headline);
            });
            
            // 存在しない場合のみ追加
            if (!existsToday) {
                this.addToHistory(advice);
            } else {
                console.log('CoachingService: Advice already in history for today');
            }
        } catch (error) {
            console.warn('CoachingService: Failed to ensure in history:', error);
        }
    }
    
    // 履歴を取得
    getHistory() {
        try {
            const stored = localStorage.getItem('coachingHistory');
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('CoachingService: Failed to load history:', error);
            return [];
        }
    }
    
    // 履歴を検索
    searchHistory(keyword) {
        try {
            const history = this.getHistory();
            
            if (!keyword || keyword.trim() === '') {
                return history;
            }
            
            const lowerKeyword = keyword.toLowerCase();
            
            return history.filter(item => {
                const searchText = `${item.headline} ${item.coreContent} ${item.practicalStep}`.toLowerCase();
                return searchText.includes(lowerKeyword);
            });
        } catch (error) {
            console.warn('CoachingService: Failed to search history:', error);
            return [];
        }
    }

    // キャッシュメタデータを更新
    updateCacheMetadata(date, source) {
        try {
            const metadata = this.getCacheMetadata();
            metadata[date] = {
                timestamp: Date.now(),
                source: source
            };

            localStorage.setItem('coaching_cache_metadata', JSON.stringify(metadata));
        } catch (error) {
            console.warn('CoachingService: Failed to update cache metadata:', error);
        }
    }

    // キャッシュメタデータを取得
    getCacheMetadata() {
        try {
            const stored = localStorage.getItem('coaching_cache_metadata');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('CoachingService: Failed to load cache metadata:', error);
            return {};
        }
    }

    // 古いキャッシュを削除
    cleanOldCache() {
        try {
            const metadata = this.getCacheMetadata();
            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30日前

            const keysToRemove = [];

            // メタデータベースでの削除
            Object.keys(metadata).forEach(date => {
                if (metadata[date].timestamp < thirtyDaysAgo) {
                    keysToRemove.push(date);
                    localStorage.removeItem(`coaching_advice_${date}`);
                    delete metadata[date];
                }
            });

            // メタデータが存在しない古いキャッシュも削除
            const allKeys = Object.keys(localStorage).filter(key =>
                key.startsWith('coaching_advice_')
            );

            allKeys.forEach(key => {
                const dateStr = key.replace('coaching_advice_', '');
                if (!metadata[dateStr]) {
                    const cacheDate = new Date(dateStr);
                    const thirtyDaysAgoDate = new Date();
                    thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);

                    if (cacheDate < thirtyDaysAgoDate) {
                        localStorage.removeItem(key);
                        keysToRemove.push(dateStr);
                    }
                }
            });

            // 古い次の日向けフィードバックも削除
            this.cleanOldNextDayFeedbacks();

            // メタデータを更新
            if (keysToRemove.length > 0) {
                localStorage.setItem('coaching_cache_metadata', JSON.stringify(metadata));
                console.log(`CoachingService: Cleaned ${keysToRemove.length} old cache entries`);
            }

            // キャッシュサイズ制限（最大100エントリ）
            this.limitCacheSize(metadata);
        } catch (error) {
            console.warn('CoachingService: Failed to clean old cache:', error);
        }
    }

    // 古い次の日向けフィードバックを削除
    cleanOldNextDayFeedbacks() {
        try {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            const feedbackKeys = Object.keys(localStorage).filter(key =>
                key.startsWith('coaching_next_day_feedback_')
            );

            feedbackKeys.forEach(key => {
                const dateStr = key.replace('coaching_next_day_feedback_', '');
                try {
                    const feedbackDate = new Date(dateStr);
                    if (feedbackDate < sevenDaysAgo) {
                        localStorage.removeItem(key);
                        console.log(`CoachingService: Cleaned old next-day feedback for ${dateStr}`);
                    }
                } catch (error) {
                    // 日付の解析に失敗した場合は削除
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.warn('CoachingService: Failed to clean old next-day feedbacks:', error);
        }
    }

    // キャッシュサイズを制限
    limitCacheSize(metadata) {
        const maxEntries = 100;
        const entries = Object.entries(metadata);

        if (entries.length > maxEntries) {
            // 古いものから削除
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toRemove = entries.slice(0, entries.length - maxEntries);

            toRemove.forEach(([date]) => {
                localStorage.removeItem(`coaching_advice_${date}`);
                delete metadata[date];
            });

            localStorage.setItem('coaching_cache_metadata', JSON.stringify(metadata));
            console.log(`CoachingService: Removed ${toRemove.length} cache entries to limit size`);
        }
    }

    // API呼び出し頻度制限のチェック
    checkApiRateLimit() {
        const now = Date.now();
        const lastCallKey = 'coaching_last_api_call';
        const callCountKey = 'coaching_api_call_count';
        const callTimesKey = 'coaching_api_call_times';

        try {
            const lastCall = parseInt(localStorage.getItem(lastCallKey) || '0');
            const callCount = parseInt(localStorage.getItem(callCountKey) || '0');
            const callTimes = JSON.parse(localStorage.getItem(callTimesKey) || '[]');

            // 1分以内の呼び出し制限（最大3回）
            const oneMinuteAgo = now - 60000;
            const recentCalls = callTimes.filter(time => time > oneMinuteAgo);

            if (recentCalls.length >= 3) {
                const waitTime = Math.ceil((recentCalls[0] + 60000 - now) / 1000);
                throw new Error(`Rate limit exceeded. Please wait ${waitTime} seconds.`);
            }

            // 1時間以内の呼び出し制限（最大10回）
            const oneHourAgo = now - 3600000;
            const hourlyCallsm = callTimes.filter(time => time > oneHourAgo);

            if (hourlyCallsm.length >= 10) {
                throw new Error('Hourly rate limit exceeded. Please try again later.');
            }

            // 呼び出し記録を更新
            const updatedCallTimes = [...recentCalls, now];
            localStorage.setItem(lastCallKey, now.toString());
            localStorage.setItem(callCountKey, (callCount + 1).toString());
            localStorage.setItem(callTimesKey, JSON.stringify(updatedCallTimes));

            return true;
        } catch (error) {
            if (error.message.includes('Rate limit')) {
                throw error;
            }
            console.warn('CoachingService: Failed to check rate limit:', error);
            return true; // エラー時は制限しない
        }
    }

    // ユーザープログレスを読み込み
    loadUserProgress() {
        const stored = localStorage.getItem('coaching_user_progress');
        return stored ? JSON.parse(stored) : {};
    }

    // ユーザープログレスを保存
    saveUserProgress() {
        localStorage.setItem('coaching_user_progress', JSON.stringify(this.userProgress));
    }

    // フィードバック履歴を読み込み
    loadFeedbackHistory() {
        const stored = localStorage.getItem('coaching_feedback_history');
        return stored ? JSON.parse(stored) : [];
    }

    // フィードバック履歴を保存
    saveFeedbackHistory() {
        localStorage.setItem('coaching_feedback_history', JSON.stringify(this.feedbackHistory));
    }

    // 最近のアドバイスIDを取得
    getRecentAdvice() {
        const recentDays = 7; // 過去7日間
        const recentAdvice = [];

        for (let i = 0; i < recentDays; i++) {
            const checkDate = new Date();
            checkDate.setDate(checkDate.getDate() - i);
            const dateStr = checkDate.toDateString();

            const cached = this.getCachedAdvice(dateStr);
            if (cached) {
                recentAdvice.push(cached.id);
            }
        }

        return recentAdvice;
    }

    // 最近のキャッシュされたアドバイスを取得（フォールバック用）
    getRecentCachedAdvice() {
        try {
            const metadata = this.getCacheMetadata();
            const entries = Object.entries(metadata);

            if (entries.length === 0) return null;

            // 最新のキャッシュされたアドバイスを取得
            entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
            const recentDate = entries[0][0];

            return this.getCachedAdvice(recentDate);
        } catch (error) {
            console.warn('CoachingService: Failed to get recent cached advice:', error);
            return null;
        }
    }

    // フィードバック調整を取得
    getFeedbackAdjustments() {
        const recentFeedback = this.feedbackHistory.slice(-10); // 直近10件
        const adjustments = { universal: 0, gameSpecific: 0, wellness: 0 };

        recentFeedback.forEach(feedback => {
            // Gemini生成のアドバイスの場合、IDからカテゴリを推測
            let categoryGroup = 'universal';

            if (feedback.adviceId.startsWith('gemini_')) {
                // Gemini生成のアドバイスは保存されたフィードバック情報から推測
                categoryGroup = 'gameSpecific'; // デフォルトでゲーム固有として扱う
            } else {
                const advice = this.fallbackData.find(a => a.id === feedback.adviceId);
                if (advice) {
                    categoryGroup = this.getCategoryGroup(advice.category);
                }
            }

            if (feedback.feedbackType === 'helpful') {
                adjustments[categoryGroup] += 0.1;
            } else if (feedback.feedbackType === 'too_easy' || feedback.feedbackType === 'too_hard') {
                adjustments[categoryGroup] -= 0.05;
            }
        });

        return adjustments;
    }

    // カテゴリグループを取得
    getCategoryGroup(category) {
        if (['fps', 'moba', 'fighting', 'rts'].includes(category)) {
            return 'gameSpecific';
        } else if (category === 'wellness') {
            return 'wellness';
        } else {
            return 'universal';
        }
    }

    // 優先度を調整
    adjustPriorities(basePriorities, adjustments) {
        const adjusted = { ...basePriorities };

        Object.keys(adjustments).forEach(key => {
            adjusted[key] = Math.max(0.1, Math.min(0.8, adjusted[key] + adjustments[key]));
        });

        // 正規化
        const total = Object.values(adjusted).reduce((sum, val) => sum + val, 0);
        Object.keys(adjusted).forEach(key => {
            adjusted[key] = adjusted[key] / total;
        });

        return adjusted;
    }

    // 目標と進捗の分析を取得（新メソッド）
    getGoalProgress(userProfile) {
        const { currentGoals = [], weeklyGoals = [] } = userProfile;

        if (currentGoals.length === 0 && weeklyGoals.length === 0) {
            return `- 現在設定されている目標がありません
- 提案：今日のコーチングで新しい目標設定をサポートしてください
- 推奨：短期目標（1-3日）と中期目標（1週間）を1つずつ設定`;
        }

        let goalProgressText = '';

        if (currentGoals.length > 0) {
            goalProgressText += '## 現在の目標:\n';
            currentGoals.forEach((goal, index) => {
                const progress = this.calculateGoalProgress(goal);
                goalProgressText += `${index + 1}. ${goal.title} (進捗: ${progress}%)\n`;
                goalProgressText += `   詳細: ${goal.description || 'なし'}\n`;
                goalProgressText += `   期限: ${goal.deadline || '未設定'}\n`;
            });
        }

        if (weeklyGoals.length > 0) {
            goalProgressText += '\n## 今週の目標:\n';
            weeklyGoals.forEach((goal, index) => {
                const progress = this.calculateGoalProgress(goal);
                goalProgressText += `${index + 1}. ${goal.title} (進捗: ${progress}%)\n`;
                goalProgressText += `   詳細: ${goal.description || 'なし'}\n`;
            });
        }

        goalProgressText += '\n## 重要：今日のコーチングは上記目標の達成を最優先に設計してください';

        return goalProgressText;
    }

    // 個別目標の進捗を計算
    calculateGoalProgress(goal) {
        if (!goal.progress) return 0;

        // 進捗の種類に応じた計算
        if (goal.type === 'numerical') {
            const current = goal.progress.current || 0;
            const target = goal.progress.target || 1;
            return Math.min(100, Math.round((current / target) * 100));
        } else if (goal.type === 'boolean') {
            return goal.progress.completed ? 100 : 0;
        } else if (goal.type === 'milestone') {
            const completed = goal.progress.completedMilestones || 0;
            const total = goal.progress.totalMilestones || 1;
            return Math.round((completed / total) * 100);
        }

        return 0;
    }

    // 目標達成向けの静的アドバイス選択（フォールバック強化）
    selectGoalOrientedAdvice(userProfile) {
        const { currentGoals = [], weeklyGoals = [] } = userProfile;
        const allGoals = [...currentGoals, ...weeklyGoals];

        if (allGoals.length > 0) {
            // 目標があるプレイヤー向けのアドバイス選択
            return this.selectAdviceForGoals(allGoals, userProfile);
        } else {
            // 目標がないプレイヤー向けの目標設定サポートアドバイス
            return this.selectGoalSettingAdvice(userProfile);
        }
    }

    // 目標に基づくアドバイス選択
    selectAdviceForGoals(goals, userProfile) {
        const { gameGenre, skillLevel } = userProfile;

        // 進捗が遅れている目標を優先
        const priorityGoal = this.findPriorityGoal(goals);

        if (priorityGoal) {
            // 特定目標に関連するアドバイスを探す
            const relatedAdvice = this.findGoalRelatedAdvice(priorityGoal, userProfile);
            if (relatedAdvice) {
                return this.enhanceAdviceForGoal(relatedAdvice, priorityGoal);
            }
        }

        // 一般的な目標達成サポートアドバイスにフォールバック
        return this.selectPersonalizedAdvice(userProfile);
    }

    // 優先目標を特定
    findPriorityGoal(goals) {
        // 進捗が50%未満で期限が近い目標を優先
        const urgentGoals = goals.filter(goal => {
            const progress = this.calculateGoalProgress(goal);
            const isUrgent = goal.deadline && new Date(goal.deadline) <= new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3日以内
            return progress < 50 || isUrgent;
        });

        return urgentGoals.length > 0 ? urgentGoals[0] : goals[0];
    }

    // 目標関連アドバイスを検索
    findGoalRelatedAdvice(goal, userProfile) {
        const { gameGenre, skillLevel } = userProfile;

        // 目標のキーワードに基づくアドバイス選択
        const goalKeywords = (goal.title + ' ' + (goal.description || '')).toLowerCase();

        const relevantAdvice = this.fallbackData.filter(advice => {
            if (!advice.skillLevels.includes(skillLevel)) return false;
            if (advice.category !== gameGenre && advice.category !== 'universal') return false;

            // キーワードマッチング
            const adviceText = (advice.headline + ' ' + advice.coreContent + ' ' + advice.practicalStep).toLowerCase();

            // 一般的なゲーミングキーワードでの関連性チェック
            const commonKeywords = ['aim', 'エイム', 'practice', '練習', 'skill', 'スキル', 'improve', '向上', 'master', 'マスター'];
            return commonKeywords.some(keyword =>
                goalKeywords.includes(keyword) && adviceText.includes(keyword)
            );
        });

        return relevantAdvice.length > 0 ? relevantAdvice[Math.floor(Math.random() * relevantAdvice.length)] : null;
    }

    // アドバイスを目標向けに強化
    enhanceAdviceForGoal(advice, goal) {
        return {
            ...advice,
            goalConnection: `「${goal.title}」の達成に直接貢献します`,
            practicalStep: `【目標達成ステップ】${advice.practicalStep}`,
            coreContent: advice.coreContent + ` この練習は設定された目標「${goal.title}」の達成において重要な要素となります。`
        };
    }

    // 目標設定サポートアドバイス
    selectGoalSettingAdvice(userProfile) {
        const { gameGenre, skillLevel } = userProfile;

        const goalSettingAdvice = {
            id: `goal_setting_${Date.now()}`,
            category: gameGenre,
            skillLevels: [skillLevel],
            headline: "目標設定でゲーミングライフを変革しよう",
            coreContent: "明確な目標設定は上達の加速に不可欠です。「今週○○を達成する」といった具体的で測定可能な目標を設定することで、練習に方向性が生まれ、進歩を実感しやすくなります。まずは1つの小さな目標から始めて、達成の喜びを体験しましょう。",
            practicalStep: "今日は「今週達成したい具体的な目標」を1つ決めて、それに向けた最初のアクションを15分間実行してみましょう。",
            goalConnection: "目標設定習慣の確立により継続的な成長をサポートします",
            source: 'goal_setting_support'
        };

        return goalSettingAdvice;
    }

    // プラン基盤のコーチングアドバイスを取得
    getPlanBasedAdvice(userProfile) {
        try {
            // コーチングプランサービスが利用可能かチェック
            if (!window.CoachingPlanService) {
                return null;
            }

            const planService = new window.CoachingPlanService();
            const activePlans = planService.getActivePlans();

            if (activePlans.length === 0) {
                return null;
            }

            // 最初のアクティブプランから今日のタスクを取得
            const currentPlan = activePlans[0];
            const todayTask = planService.getTodayTask(currentPlan.id);

            if (!todayTask) {
                return null;
            }

            // プラン基盤のアドバイスを作成
            return this.createPlanBasedAdvice(currentPlan, todayTask, userProfile);
        } catch (error) {
            console.warn('Failed to get plan-based advice:', error);
            return null;
        }
    }

    // プラン基盤のアドバイスを作成
    createPlanBasedAdvice(plan, todayTask, userProfile) {
        return {
            id: `plan_advice_${Date.now()}`,
            category: plan.metadata.gameGenre || userProfile.gameGenre || 'universal',
            skillLevels: [plan.metadata.skillLevel || userProfile.skillLevel || 'intermediate'],
            headline: `【週${todayTask.weekNumber}】${todayTask.focus}`,
            coreContent: `今週のフォーカスは「${todayTask.focus}」です。設定された目標「${plan.goalTitle}」の達成に向けて、計画的にスキルアップを進めましょう。今日の練習内容は段階的な成長プロセスの一部として設計されています。`,
            practicalStep: `【今日のプラン】${todayTask.todayTask}`,
            goalConnection: `コーチングプラン「${plan.goalTitle}」の第${todayTask.weekNumber}週目の実行`,
            source: 'coaching_plan',
            planId: plan.id,
            weekNumber: todayTask.weekNumber,
            objectives: todayTask.objectives,
            milestones: todayTask.milestones
        };
    }
}

// コーチングアドバイスデータベース
const COACHING_ADVICE_DATABASE = [
    // 普遍的原則 - 初心者向け
    {
        id: "universal_001",
        category: "universal",
        skillLevels: ["beginner"],
        headline: "小さな目標から始めよう",
        coreContent: "大きな目標は素晴らしいものですが、まずは達成可能な小さな目標から始めることが重要です。例えば「今日は30分練習する」「1つの新しいテクニックを覚える」など、具体的で測定可能な目標を設定しましょう。小さな成功体験を積み重ねることで、自信とモチベーションが向上します。",
        practicalStep: "今日は15分間の集中練習セッションを設定し、1つの基本スキルに焦点を当てて練習してみましょう。",
        goalConnection: "小さな目標の達成習慣が大きな目標達成の基盤となります"
    },
    {
        id: "universal_002",
        category: "universal",
        skillLevels: ["beginner"],
        headline: "練習の質を意識する",
        coreContent: "長時間の練習よりも、集中した短時間の練習の方が効果的です。だらだらと何時間もプレイするのではなく、明確な目的を持って集中的に練習することで、スキルアップのスピードが格段に向上します。疲れているときの練習は逆効果になることもあります。",
        practicalStep: "今日は20分タイマーをセットし、特定のスキル（エイムやラストヒットなど）だけに集中して練習してみましょう。",
        goalConnection: "集中練習の質向上により設定した目標の効率的達成をサポートします"
    },

    // 普遍的原則 - 中級者向け
    {
        id: "universal_003",
        category: "universal",
        skillLevels: ["intermediate"],
        headline: "メンタルトレーニングの重要性",
        coreContent: "技術的なスキルだけでなく、メンタル面のトレーニングも同じくらい重要です。負けた試合から学び、感情をコントロールし、プレッシャーの中でも冷静に判断する能力を育てましょう。トップレベルのプレイヤーほど、メンタルトレーニングに時間を投資しています。",
        practicalStep: "次の試合で負けたときは、5分間冷静に何が悪かったかを分析し、改善点を1つノートに書き留めてみましょう。",
        goalConnection: "メンタル強化により困難な目標にも諦めずに取り組む力を育成します"
    },
    {
        id: "universal_004",
        category: "universal",
        skillLevels: ["intermediate"],
        headline: "リプレイ分析の習慣化",
        coreContent: "自分のプレイを客観的に見ることで、プレイ中には気づかない課題や改善点を発見できます。特に負けた試合のリプレイを見ることで、判断ミスやポジショニングの問題を特定できます。週に数回、15分程度でも良いのでリプレイ分析の時間を作りましょう。",
        practicalStep: "今日は最近の試合から1つ選んで、10分間リプレイを見ながら改善できそうなポイントを3つ見つけてみましょう。",
        goalConnection: "客観的分析により目標達成のための具体的改善点を明確化できます"
    },

    // 普遍的原則 - 上級者向け
    {
        id: "universal_005",
        category: "universal",
        skillLevels: ["advanced"],
        headline: "チームコミュニケーションの最適化",
        coreContent: "上級レベルでは個人スキル以上にチームワークが勝敗を左右します。効果的なコミュニケーションは、情報を正確かつ簡潔に伝え、チームの戦略的判断を向上させます。不要な会話を避け、重要な情報のみを適切なタイミングで共有することが重要です。",
        practicalStep: "今日のチーム戦では、コール（呼びかけ）を「敵の位置」「自分の状況」「提案する戦略」の3要素に絞って練習してみましょう。",
        goalConnection: "チーム連携向上により個人では達成困難な高レベル目標の実現を可能にします"
    },

    // FPS - 初心者向け
    {
        id: "fps_001",
        category: "fps",
        skillLevels: ["beginner"],
        headline: "エイム練習の基礎を固める",
        coreContent: "FPSにおいてエイムは最も基本的なスキルです。まずは感度設定を固定し、毎日少しずつでも継続的に練習することが重要です。エイムトレーナーやゲーム内の練習モードを活用し、まずは静止ターゲットに確実に当てられるようになりましょう。急がず、正確性を重視することが上達への近道です。",
        practicalStep: "今日は10分間エイムトレーニングを行い、静止ターゲットでの命中率80%以上を目指してみましょう。"
    },
    {
        id: "fps_002",
        category: "fps",
        skillLevels: ["beginner"],
        headline: "マップ理解から始めよう",
        coreContent: "エイムスキルと同じくらい重要なのがマップ知識です。各マップの基本的なレイアウト、主要なルート、よく使われるポジションを覚えることで、敵の動きを予測し、有利なポジションを取ることができるようになります。まずは1つのマップを完全に覚えることから始めましょう。",
        practicalStep: "今日は1つのマップを選んで、カスタムゲームで15分間歩き回り、すべての角やポジションを確認してみましょう。"
    },

    // FPS - 中級者向け
    {
        id: "fps_003",
        category: "fps",
        skillLevels: ["intermediate"],
        headline: "プリエイムとプリファイアの習得",
        coreContent: "中級者になると、反応速度だけでなく予測が重要になります。プリエイム（事前に照準を合わせておくこと）とプリファイア（角を曲がる前に撃ち始めること）をマスターすることで、撃ち合いで優位に立てます。敵がよく現れる位置を把握し、そこに事前に照準を合わせる習慣をつけましょう。",
        practicalStep: "今日の試合では、角を曲がる前に敵がいそうな位置に事前に照準を合わせることを意識してプレイしてみましょう。"
    },

    // MOBA - 初心者向け
    {
        id: "moba_001",
        category: "moba",
        skillLevels: ["beginner"],
        headline: "ラストヒットの基礎練習",
        coreContent: "MOBAゲームにおいて、ミニオンへのラストヒット（CS）は経済基盤の基礎です。トレーニングモードで、スキルを使わずに通常攻撃だけでミニオンを倒す練習を毎日行いましょう。最初は1ウェーブで6体中4体取れれば上出来です。焦らず、タイミングを体で覚えることが重要です。",
        practicalStep: "今日は練習ツールで10分間、スキルを使わずにラストヒットだけを練習してみましょう。"
    },
    {
        id: "moba_002",
        category: "moba",
        skillLevels: ["beginner"],
        headline: "ワード配置の重要性を学ぶ",
        coreContent: "視界確保は勝利への第一歩です。敵の動きが見えることで、ガンクを避けたり、オブジェクトを安全に取ったりできます。まずは自分のレーンの川にワードを置く習慣をつけ、マップを頻繁に確認するクセをつけましょう。1つのワードが試合の流れを変えることもあります。",
        practicalStep: "今日の試合では、3分以内に必ず川にワードを置き、30秒に1回はミニマップを確認することを心がけてみましょう。"
    },

    // MOBA - 中級者向け
    {
        id: "moba_003",
        category: "moba",
        skillLevels: ["intermediate"],
        headline: "ウェーブコントロールをマスターする",
        coreContent: "ミニオンウェーブの管理は中級者が習得すべき重要スキルです。フリーズ、スロープッシュ、ファストプッシュを使い分けることで、敵を不利な状況に追い込むことができます。特にフリーズ（ウェーブを自分のタワー前で止める）を覚えると、敵のファームを妨害しながら安全にレーニングできます。",
        practicalStep: "今日は1試合で、意図的にウェーブを自分のタワー近くでフリーズさせる練習をしてみましょう。"
    },

    // 格闘ゲーム - 初心者向け
    {
        id: "fighting_001",
        category: "fighting",
        skillLevels: ["beginner"],
        headline: "基本コンボの確実な習得",
        coreContent: "格闘ゲームでは、複雑なコンボよりもまず基本コンボを確実に決められることが重要です。1つのキャラクターの基本コンボを練習モードで100回連続で成功できるまで練習しましょう。実戦では緊張やプレッシャーでコンボを落としがちなので、体に覚え込ませることが必要です。",
        practicalStep: "今日は選んだ基本コンボを練習モードで50回連続成功させることを目標にしてみましょう。"
    },

    // RTS - 初心者向け
    {
        id: "rts_001",
        category: "rts",
        skillLevels: ["beginner"],
        headline: "資源管理の基礎を固める",
        coreContent: "RTSゲームにおいて、資源管理は勝利の基盤です。常に資源を無駄なく使い切り、アイドル時間（何もしていない時間）を最小限に抑えることが重要です。まずは基本的な建設順序を覚え、常にワーカーを生産し続けることから始めましょう。",
        practicalStep: "今日は1試合で、常にワーカーの生産を止めないことを最優先にプレイしてみましょう。"
    },

    // ウェルネス - 全レベル共通
    {
        id: "wellness_001",
        category: "wellness",
        skillLevels: ["beginner", "intermediate", "advanced"],
        headline: "適切な休憩でパフォーマンス向上",
        coreContent: "長時間のゲーミングは集中力とパフォーマンスの低下を招きます。25分プレイして5分休憩するポモドーロテクニックを試してみましょう。休憩中は画面から目を離し、軽いストレッチや深呼吸を行うことで、次のセッションでのパフォーマンスが向上します。",
        practicalStep: "今日は25分ゲームをプレイしたら5分間の休憩を取り、その間に軽いストレッチをしてみましょう。"
    },
    {
        id: "wellness_002",
        category: "wellness",
        skillLevels: ["beginner", "intermediate", "advanced"],
        headline: "正しい姿勢でゲームライフを改善",
        coreContent: "正しい姿勢は長時間のゲーミングにおいて極めて重要です。背筋を伸ばし、足裏を床につけ、モニターとの距離を50-70cm保ちましょう。悪い姿勢は集中力の低下だけでなく、長期的な健康問題にもつながります。1時間に1回は立ち上がって体を動かすことも大切です。",
        practicalStep: "今日は1時間ごとにアラームを設定し、立ち上がって2分間軽く体を動かしてみましょう。"
    }
];