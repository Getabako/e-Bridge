// coaching-plan-service.js - コーチングプラン管理サービス（Valorant最適化版）
class CoachingPlanService {
    constructor() {
        this.geminiService = null;
        this.valorantKnowledgeBase = null;
        this.initializeGeminiService();
        this.loadValorantKnowledgeBase();
    }

    // Gemini APIサービスを初期化
    initializeGeminiService() {
        if (typeof GeminiService !== 'undefined' && window.unifiedApiManager?.isConfigured()) {
            try {
                this.geminiService = new GeminiService();
                console.log('CoachingPlanService: Gemini API initialized');
            } catch (error) {
                console.warn('CoachingPlanService: Failed to initialize Gemini API:', error);
            }
        }
    }

    // Valorant知識ベースをロード
    async loadValorantKnowledgeBase() {
        try {
            // LocalStorageから保存されているデータソースファイルを取得
            const datasourceKeys = Object.keys(localStorage).filter(key => key.startsWith('datasource-'));
            
            if (datasourceKeys.length > 0) {
                console.log(`📚 Valorant知識ベース: ${datasourceKeys.length}ファイル検出`);
                
                // 全ファイルの内容を結合
                let knowledgeBase = '';
                datasourceKeys.forEach(key => {
                    const content = localStorage.getItem(key);
                    const filename = key.replace('datasource-', '');
                    knowledgeBase += `\n--- ${filename} ---\n${content}\n`;
                });
                
                // サイズ制限（12,000文字）
                if (knowledgeBase.length > 12000) {
                    console.warn(`⚠️ 知識ベースが大きすぎます（${knowledgeBase.length}文字）。最初の12,000文字を使用します。`);
                    knowledgeBase = knowledgeBase.substring(0, 12000);
                }
                
                this.valorantKnowledgeBase = knowledgeBase;
                console.log(`✅ Valorant知識ベース読み込み完了: ${knowledgeBase.length}文字`);
            } else {
                console.log('📚 Valorant知識ベース: データソースファイルなし');
                this.valorantKnowledgeBase = null;
            }
        } catch (error) {
            console.error('Valorant知識ベース読み込みエラー:', error);
            this.valorantKnowledgeBase = null;
        }
    }

    // 目標に基づいてコーチングプランを自動生成（Valorant最適化版）
    async generateCoachingPlan(goal) {
        const { title, deadline, description, gameGenre, skillLevel } = goal;

        if (!deadline) {
            throw new Error('期限が設定されていない目標にはコーチングプランを作成できません');
        }

        try {
            // 知識ベースを再読み込み（最新のデータソースを反映）
            await this.loadValorantKnowledgeBase();
            
            const planData = this.calculatePlanStructure(deadline);

            if (!this.geminiService) {
                throw new Error('Gemini APIサービスが利用できません。APIキーを設定してください。');
            }

            console.log('🎮 Valorantコーチングプラン生成開始');
            console.log(`📊 知識ベース: ${this.valorantKnowledgeBase ? '有効' : '無効'}`);
            console.log(`🎯 目標: ${title}`);
            console.log(`📅 期間: ${planData.totalWeeks}週間`);

            // AIでプランを生成（プランオブジェクトが返される）
            const plan = await this.generatePlanWithAI(goal, planData);

            // プランを保存
            this.savePlan(plan);

            console.log(`✅ プラン保存完了: ${plan.id}`);

            return plan;
        } catch (error) {
            console.error('Failed to generate coaching plan:', error);
            throw error;
        }
    }

    // プラン構造を計算（週区切り）
    calculatePlanStructure(deadline) {
        const today = new Date();
        const deadlineDate = new Date(deadline);

        // 日数計算
        const totalDays = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
        const totalWeeks = Math.ceil(totalDays / 7);

        if (totalDays <= 0) {
            throw new Error('期限が過去または今日の目標にはプランを作成できません');
        }

        const weeks = [];
        let currentDate = new Date(today);

        for (let i = 0; i < totalWeeks; i++) {
            const weekStart = new Date(currentDate);
            const weekEnd = new Date(currentDate);
            weekEnd.setDate(weekEnd.getDate() + 6);

            // 最終週は期限日まで
            if (i === totalWeeks - 1) {
                weekEnd.setTime(deadlineDate.getTime());
            }

            weeks.push({
                weekNumber: i + 1,
                startDate: weekStart.toISOString().split('T')[0],
                endDate: weekEnd.toISOString().split('T')[0],
                focus: '', // AIまたはユーザーが設定
                objectives: [], // 週の目標
                milestones: [] // 達成指標
            });

            currentDate.setDate(currentDate.getDate() + 7);
        }

        return {
            totalWeeks,
            totalDays,
            weeks
        };
    }

    // AIでコーチングプランを生成（Valorant最適化版・グラウンディング対応）
    async generatePlanWithAI(goal, planStructure) {
        const prompt = this.buildPlanGenerationPrompt(goal, planStructure);

        try {
            console.log('🤖 Generating Valorant coaching plan with Gemini API...');
            
            // データソース情報の有無を確認
            const hasKnowledgeBase = this.valorantKnowledgeBase && this.valorantKnowledgeBase.length > 0;
            console.log(`📚 知識ベース: ${hasKnowledgeBase ? '有効' : '無効'}`);
            
            // グラウンディングを使用してAPI呼び出し
            const response = await this.generatePlanWithGrounding(prompt, goal);

            console.log('📡 Raw API Response:', response);

            if (!response) {
                throw new Error('Gemini APIからの応答がありません');
            }

            let responseText = null;
            if (response.response) {
                responseText = response.response;
                console.log('✅ Using response.response field');
            } else if (response.text) {
                responseText = response.text;
                console.log('✅ Using response.text field');
            } else {
                console.error('❌ Invalid API response structure:', response);
                console.error('Response type:', typeof response);
                console.error('Response keys:', Object.keys(response));
                throw new Error('APIレスポンスに有効なテキストフィールドがありません');
            }

            if (!responseText || responseText.trim().length === 0) {
                throw new Error('AIからの応答テキストが空です');
            }

            console.log('📝 Response text length:', responseText.length);
            console.log('📝 Response preview:', responseText.substring(0, 200) + '...');

            const generatedPlan = this.parsePlanResponse(responseText, planStructure);
            const planObject = this.createPlanObject(goal, generatedPlan);
            
            // グラウンディング情報があれば追加
            if (response.groundingSources) {
                planObject.metadata.groundingSources = response.groundingSources;
                planObject.metadata.knowledgeBaseUsed = hasKnowledgeBase;
            }
            
            return planObject;
        } catch (error) {
            console.error('AI plan generation failed:', error);
            throw error;
        }
    }

    // グラウンディングを使用してプラン生成
    async generatePlanWithGrounding(prompt, goal) {
        const { character } = goal;
        
        // Valorant固有の検索クエリを生成
        const searchQueries = this.generateValorantSearchQueries(goal);
        
        // リクエストボディを構築
        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 8192,
                topP: 0.8,
                topK: 40
            }
        };

        // 知識ベースがある場合はコンテキストに追加
        if (this.valorantKnowledgeBase) {
            const contextPrompt = `## Valorant 参考資料\n${this.valorantKnowledgeBase}\n\n${prompt}`;
            requestBody.contents[0].parts[0].text = contextPrompt;
            console.log('📚 知識ベースをコンテキストに追加');
        }

        // Webグラウンディングを有効化
        if (searchQueries.length > 0 && this.geminiService.groundingConfig?.enableWebSearch) {
            requestBody.tools = [{
                googleSearch: {}
            }];
            
            // 検索キーワードをプロンプトに含める
            const enhancedPrompt = `${requestBody.contents[0].parts[0].text}

【最新情報検索】
以下のキーワードで最新のメタ情報を検索して参考にしてください：
${searchQueries.map(q => `- ${q}`).join('\n')}`;
            
            requestBody.contents[0].parts[0].text = enhancedPrompt;
            console.log('🔍 グラウンディング有効化:', searchQueries);
        }

        // サーバーレス関数経由でAPI呼び出し
        const model = this.geminiService.chatModel;

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: requestBody.contents,
                model: model,
                generationConfig: requestBody.generationConfig
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API request failed: ${response.status} - ${errorData.error || 'Unknown error'}`);
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No response from API');
        }

        const candidate = data.candidates[0];
        const text = candidate.content?.parts?.[0]?.text || '';

        // グラウンディング情報を抽出
        let groundingSources = null;
        if (candidate.groundingMetadata && this.geminiService.processGroundingMetadata) {
            groundingSources = this.geminiService.processGroundingMetadata(candidate.groundingMetadata);
        }

        return {
            response: text,
            groundingSources: groundingSources
        };
    }

    // Valorant固有の検索クエリを生成
    generateValorantSearchQueries(goal) {
        const { title, character, description, skillLevel } = goal;
        const queries = [];
        
        // 基本検索クエリ
        queries.push('Valorant meta 2025');
        queries.push('Valorant patch notes latest');
        
        // エージェント固有の検索 (characterフィールドをagentとして扱う)
        if (character && character !== 'all') {
            queries.push(`Valorant ${character} guide 2025`);
            queries.push(`Valorant ${character} lineups`);
            queries.push(`Valorant ${character} pro play`);
        }
        
        // スキルレベル別の検索
        if (skillLevel) {
            const levelMap = {
                'beginner': '初心者',
                'intermediate': '中級者',
                'advanced': '上級者'
            };
            const levelJp = levelMap[skillLevel] || '中級者';
            queries.push(`Valorant ${levelJp} 上達法`);
            queries.push(`Valorant ${skillLevel} guide`);
        }
        
        // 目標タイトルからキーワード抽出
        if (title) {
            // ランク関連
            if (title.match(/Iron|Bronze|Silver|Gold|Platinum|Diamond|Ascendant|Immortal|Radiant|アイアン|ブロンズ|シルバー|ゴールド|プラチナ|ダイヤ|アセンダント|イモータル|レディアント/i)) {
                queries.push('Valorant ranked tips');
                queries.push('Valorant climbing rank guide');
            }

            // マップ関連
            const maps = ['Ascent', 'Bind', 'Haven', 'Split', 'Icebox', 'Breeze', 'Fracture', 'Pearl', 'Lotus', 'Sunset', 'Abyss'];
            maps.forEach(map => {
                if (title.toLowerCase().includes(map.toLowerCase())) {
                    queries.push(`Valorant ${map} strategy`);
                }
            });

            // 役割関連
            const roles = ['Duelist', 'Initiator', 'Controller', 'Sentinel', 'デュエリスト', 'イニシエーター', 'コントローラー', 'センチネル'];
            roles.forEach(role => {
                 if (title.toLowerCase().includes(role.toLowerCase())) {
                    queries.push(`Valorant ${role} tips`);
                 }
            });
        }
        
        return queries;
    }

    // AI用プロンプトを構築（Valorant最適化版）
    buildPlanGenerationPrompt(goal, planStructure) {
        const { title, character, description, skillLevel, gameGenre } = goal;
        
        // エージェント情報
        const agentInfo = character && character !== 'all' ? `使用エージェント: ${character}` : '全エージェント対応';
        
        // スキルレベル情報
        const skillLevelMap = {
            'beginner': '初心者（基本操作、ストッピング、プリエイムを習得中）',
            'intermediate': '中級者（スキル合わせ、マップ名称、エコノミーを理解）',
            'advanced': '上級者（高度な戦術、マクロ理解、IGLなどを実践中）'
        };
        const skillInfo = skillLevelMap[skillLevel] || '中級者';
        
        // ユーザープロフィールから統計情報を取得
        const userStats = this.getUserStatistics();

        return `# Valorant コーチングプラン生成

## 目標情報
- **目標**: ${title}
- **期間**: ${planStructure.totalWeeks}週間（${planStructure.totalDays}日間）
- **エージェント**: ${agentInfo}
- **スキルレベル**: ${skillInfo}
${description ? `- **詳細**: ${description}` : ''}

## プレイヤー統計 (Valorant)
- 総試合数: ${userStats.totalMatches}試合
- 総合勝率: ${userStats.overallWinRate}%
- K/D: ${userStats.avgKD}
- HS%: ${userStats.avgHS}%
- よく使うエージェント: ${userStats.topAgents.join(', ') || 'データなし'}
- 苦手なマップ: ${userStats.weakMaps.join(', ') || 'データなし'}

## 指示
Valorantの最新メタ、エージェント構成、マップ戦略を考慮した実践的な${planStructure.totalWeeks}週間のコーチングプランを作成してください。
**絶対に** 格闘ゲームやMOBAの用語（ドライブシステム、波動拳、ミニオン、ジャングルなど）を含めないでください。

### 各週の構成
1. **focus**: その週のメインテーマ（Valorantの実践的なスキルに特化）
2. **objectives**: 達成すべき具体的な目標（2-3個、測定可能なもの）
3. **milestones**: 達成の判断基準（具体的な数値や状況）

### Valorant固有の考慮事項
- **メカニクス**: ストッピング（Counter-strafing）、クロスヘアプレースメント、リコイルコントロール、プリエイム
- **戦術**: エコノミー管理（Buy/Save/Eco）、トレードキル、エリアコントロール、エントリー、リテイク
- **ユーティリティ**: 定点（Lineups）、スキルの合わせ、フラッシュのタイミング、スモークの位置
- **コミュニケーション**: 報告（Callouts）、IGL、メンタル管理
- **マップ**: 各マップ固有の攻め方・守り方

### プランの難易度調整
- 第1週: 基礎・メカニクス強化（${skillInfo}向けのエイム・移動）
- 中盤週: 戦術・立ち回り（ランクマッチでのマップ理解・判断力）
- 最終週: 目標達成・仕上げ（${title}の完遂、メンタル）

## 出力形式
**必ずJSON形式のみで回答してください**：

\`\`\`json
{
  "weeks": [
    {
      "weekNumber": 1,
      "focus": "クロスヘアプレースメントとストッピングの徹底",
      "objectives": [
        "デスマッチでヘッドショットのみを狙い3回プレイ",
        "ランクマッチでプリエイムを意識してクリアリング",
        "射撃場（ハード）で15体以上キル"
      ],
      "milestones": [
        "デスマッチの順位が上位50%以内",
        "ランクマッチでのヘッドショット率15%以上",
        "射撃場スコア安定化"
      ]
    }
  ]
}
\`\`\`

${planStructure.totalWeeks}週分のプランを生成してください。各週は上記の例のように、Valorantの実践的で測定可能な内容にしてください。`;
    }

    // ユーザー統計情報を取得（Valorant用）
    getUserStatistics() {
        try {
            // Valorantのマッチデータを取得
            const valorantMatches = JSON.parse(localStorage.getItem('valorant_matches') || '[]');
            const valorantGallery = JSON.parse(localStorage.getItem('valorant_gallery') || '[]');
            
            // 重複を除去して結合（簡易的なIDチェック）
            const allMatches = [...valorantMatches];
            valorantGallery.forEach(m => {
                if (!allMatches.some(existing => existing.id === m.id)) {
                    allMatches.push(m);
                }
            });

            if (allMatches.length === 0) {
                return {
                    totalMatches: 0,
                    overallWinRate: 0,
                    avgKD: '0.00',
                    avgHS: '0',
                    topAgents: [],
                    weakMaps: []
                };
            }

            // 総試合数と勝率
            const totalMatches = allMatches.length;
            const wins = allMatches.filter(m => (m.result || '').toUpperCase() === 'WIN').length;
            const overallWinRate = ((wins / totalMatches) * 100).toFixed(1);

            // 平均K/D
            let totalKills = 0;
            let totalDeaths = 0;
            let totalHS = 0;
            let hsCount = 0;

            allMatches.forEach(m => {
                totalKills += parseInt(m.kills || 0);
                totalDeaths += parseInt(m.deaths || 0);
                if (m.hsPercent) {
                    totalHS += parseFloat(m.hsPercent);
                    hsCount++;
                }
            });

            const avgKD = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toFixed(2);
            const avgHS = hsCount > 0 ? (totalHS / hsCount).toFixed(1) : '0';

            // よく使うエージェント（上位3つ）
            const agentCount = {};
            allMatches.forEach(match => {
                const agent = match.agent || match.character; // 互換性のためcharacterもチェック
                if (agent && agent !== 'Unknown') {
                    agentCount[agent] = (agentCount[agent] || 0) + 1;
                }
            });
            const topAgents = Object.entries(agentCount)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3)
                .map(([agent]) => agent);

            // 苦手なマップ（勝率が低いマップ上位3つ）
            const mapStats = {};
            allMatches.forEach(match => {
                const map = match.map;
                if (map && map !== 'Unknown') {
                    if (!mapStats[map]) {
                        mapStats[map] = { wins: 0, total: 0 };
                    }
                    mapStats[map].total++;
                    if ((match.result || '').toUpperCase() === 'WIN') {
                        mapStats[map].wins++;
                    }
                }
            });
            const weakMaps = Object.entries(mapStats)
                .filter(([_, stats]) => stats.total >= 3) // 3試合以上のデータがあるマップのみ
                .map(([map, stats]) => ({
                    map,
                    winRate: (stats.wins / stats.total) * 100
                }))
                .sort((a, b) => a.winRate - b.winRate)
                .slice(0, 3)
                .map(item => item.map);

            return {
                totalMatches,
                overallWinRate,
                avgKD,
                avgHS,
                topAgents,
                weakMaps
            };
        } catch (error) {
            console.error('統計情報の取得エラー:', error);
            return {
                totalMatches: 0,
                overallWinRate: 0,
                avgKD: '0.00',
                avgHS: '0',
                topAgents: [],
                weakMaps: []
            };
        }
    }

    // AIレスポンスを解析
    parsePlanResponse(responseText, planStructure) {
        try {
            console.log('🔍 Parsing AI response...');
            console.log('📝 Full response text:', responseText);

            let jsonText = null;

            // より堅牢なJSONパターンをチェック
            const patterns = [
                /```json\s*([\s\S]*?)\s*```/i,    // ```json ... ```
                /```\s*([\s\S]*?)\s*```/,         // ``` ... ```
                /(\{[\s\S]*?"weeks"[\s\S]*?\})/,  // weeks を含む最初の JSON オブジェクト
                /\{[\s\S]*\}/                     // { ... } 直接
            ];

            for (let i = 0; i < patterns.length; i++) {
                const pattern = patterns[i];
                const match = responseText.match(pattern);
                if (match) {
                    jsonText = match[1] || match[0];
                    console.log(`✅ Found JSON pattern ${i + 1}:`, jsonText.substring(0, 100) + '...');

                    // JSONが不完全な場合は修復を試みる
                    if (!jsonText.trim().endsWith('}')) {
                        console.log('⚠️ Incomplete JSON detected, attempting to fix...');
                        const openBraces = (jsonText.match(/\{/g) || []).length;
                        const closeBraces = (jsonText.match(/\}/g) || []).length;
                        const missingBraces = openBraces - closeBraces;

                        if (missingBraces > 0) {
                            jsonText += '}'.repeat(missingBraces);
                            console.log('🔧 Added missing closing braces:', missingBraces);
                        }
                    }
                    break;
                }
            }

            if (!jsonText) {
                console.log('❌ No JSON pattern found, using full response');
                jsonText = responseText.trim();
            }

            console.log('📝 Final JSON to parse:', jsonText);

            let parsed;
            try {
                parsed = JSON.parse(jsonText);
            } catch (parseError) {
                console.error('❌ JSON parse failed:', parseError);
                // 最後の手段：部分的なJSONを修復
                const weeksMatch = jsonText.match(/"weeks"\s*:\s*\[([\s\S]*)/);
                if (weeksMatch) {
                    console.log('🔧 Attempting partial JSON reconstruction...');
                    try {
                        parsed = { weeks: JSON.parse('[' + weeksMatch[1].split(']')[0] + ']') };
                    } catch {
                        throw parseError;
                    }
                } else {
                    throw parseError;
                }
            }

            if (!parsed.weeks || !Array.isArray(parsed.weeks)) {
                throw new Error('Response missing "weeks" array');
            }

            if (parsed.weeks.length === 0) {
                console.warn('⚠️ Empty weeks array, creating minimal plan');
                // 空の場合は最小限のプランを作成
                parsed.weeks = [{
                    weekNumber: 1,
                    focus: '基礎練習',
                    objectives: ['基本スキル向上'],
                    milestones: ['週目標達成']
                }];
            }

            console.log(`✅ Successfully parsed ${parsed.weeks.length} weeks`);

            // 構造データとマージ（AIが生成した週数が少ない場合は残りを拡張）
            return planStructure.weeks.map((week, index) => {
                if (index < parsed.weeks.length) {
                    return {
                        ...week,
                        ...parsed.weeks[index],
                        weekNumber: week.weekNumber
                    };
                } else {
                    // AIが生成しなかった週は最後の週のパターンを使用
                    const lastParsedWeek = parsed.weeks[parsed.weeks.length - 1];
                    return {
                        ...week,
                        focus: lastParsedWeek?.focus || '継続練習',
                        objectives: lastParsedWeek?.objectives || ['基本練習'],
                        milestones: lastParsedWeek?.milestones || ['週目標達成']
                    };
                }
            });

        } catch (error) {
            console.error('Failed to parse AI plan response:', error);
            console.error('Response text:', responseText);
            throw new Error('AI応答の解析に失敗しました: ' + error.message);
        }
    }


    // プランオブジェクトを作成
    createPlanObject(goal, weeks) {
        return {
            id: `plan_${Date.now()}`,
            goalId: goal.id || `goal_${Date.now()}`,
            goalTitle: goal.title,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'draft', // draft, active, completed, paused
            weeks: weeks,
            metadata: {
                gameGenre: goal.gameGenre,
                skillLevel: goal.skillLevel,
                totalWeeks: weeks.length,
                estimatedTimePerDay: 60 // 分
            }
        };
    }

    // プランを保存
    savePlan(plan) {
        try {
            const plans = this.getAllPlans();
            const existingIndex = plans.findIndex(p => p.id === plan.id);

            if (existingIndex >= 0) {
                plans[existingIndex] = { ...plan, updatedAt: new Date().toISOString() };
            } else {
                plans.push(plan);
            }

            localStorage.setItem('coaching_plans', JSON.stringify(plans));
            return true;
        } catch (error) {
            console.error('Failed to save coaching plan:', error);
            return false;
        }
    }

    // 全プランを取得
    getAllPlans() {
        try {
            const plans = JSON.parse(localStorage.getItem('coaching_plans') || '[]');

            // 不正なプランデータを削除
            const validPlans = plans.filter(plan => {
                // weeks が配列でない場合は削除
                if (!plan.weeks || !Array.isArray(plan.weeks)) {
                    console.warn(`🗑️ 不正なプラン ${plan.id} を削除します（weeks が配列ではありません）`);
                    return false;
                }
                return true;
            });

            // 不正なプランがあった場合は保存
            if (validPlans.length !== plans.length) {
                localStorage.setItem('coaching_plans', JSON.stringify(validPlans));
                console.log(`📝 ${plans.length - validPlans.length}件の不正なプランを削除しました`);
            }

            return validPlans;
        } catch (error) {
            console.warn('Failed to load coaching plans:', error);
            return [];
        }
    }

    // 特定プランを取得
    getPlan(planId) {
        const plans = this.getAllPlans();
        return plans.find(plan => plan.id === planId);
    }

    // 目標IDに基づいてプランを取得
    getPlanByGoalId(goalId) {
        const plans = this.getAllPlans();
        return plans.find(plan => plan.goalId === goalId);
    }

    // アクティブなプランを取得
    getActivePlans() {
        const plans = this.getAllPlans();
        return plans.filter(plan => plan.status === 'active');
    }

    // 今週のプラン内容を取得
    getCurrentWeekPlan(planId) {
        const plan = this.getPlan(planId);
        if (!plan) return null;

        const today = new Date().toISOString().split('T')[0];
        const currentWeek = plan.weeks.find(week =>
            week.startDate <= today && week.endDate >= today
        );

        return currentWeek;
    }


    // プランのステータスを更新
    updatePlanStatus(planId, status) {
        const plan = this.getPlan(planId);
        if (!plan) return false;

        plan.status = status;
        plan.updatedAt = new Date().toISOString();

        return this.savePlan(plan);
    }

    // プランを削除
    deletePlan(planId) {
        try {
            const plans = this.getAllPlans();
            const filteredPlans = plans.filter(plan => plan.id !== planId);
            localStorage.setItem('coaching_plans', JSON.stringify(filteredPlans));
            return true;
        } catch (error) {
            console.error('Failed to delete coaching plan:', error);
            return false;
        }
    }
}

// Export for global access
window.CoachingPlanService = CoachingPlanService;