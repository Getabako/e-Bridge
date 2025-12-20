// AI Coaching Service for eSports Performance Analysis
class AICoachingService {
  constructor() {
    this.apiConfig = {
      provider: localStorage.getItem('ai_provider') || 'openai',
      apiKey: localStorage.getItem('ai_api_key') || '',
      model: localStorage.getItem('ai_model') || 'gpt-4',
      endpoint: '',
      isConfigured: false,
      lastVerified: localStorage.getItem('ai_last_verified')
    };
    
    this.apiConfig.endpoint = this.getEndpoint();
    this.checkConfiguration();
    
    // Rate limiting
    this.lastAPICall = 0;
    this.minInterval = 1000; // 1 second between calls
    
    // Request queue for handling multiple simultaneous requests
    this.requestQueue = [];
    this.isProcessingQueue = false;
  }

  // Configuration Management
  checkConfiguration() {
    this.apiConfig.isConfigured = this.apiConfig.apiKey.length > 0;
    return this.apiConfig.isConfigured;
  }

  getEndpoint() {
    const endpoints = {
      'openai': 'https://api.openai.com/v1/chat/completions',
      'anthropic': 'https://api.anthropic.com/v1/messages',
      'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
    };
    return endpoints[this.apiConfig.provider] || endpoints['openai'];
  }

  saveConfiguration(provider, apiKey, model) {
    try {
      localStorage.setItem('ai_provider', provider);
      localStorage.setItem('ai_api_key', apiKey);
      localStorage.setItem('ai_model', model);
      
      this.apiConfig.provider = provider;
      this.apiConfig.apiKey = apiKey;
      this.apiConfig.model = model;
      this.apiConfig.endpoint = this.getEndpoint();
      this.checkConfiguration();
      
      return { success: true, message: 'AI設定が正常に保存されました' };
    } catch (error) {
      console.error('Failed to save configuration:', error);
      return { success: false, message: '設定の保存に失敗しました' };
    }
  }

  clearConfiguration() {
    try {
      localStorage.removeItem('ai_provider');
      localStorage.removeItem('ai_api_key');
      localStorage.removeItem('ai_model');
      localStorage.removeItem('ai_last_verified');
      
      this.apiConfig.apiKey = '';
      this.apiConfig.isConfigured = false;
      this.apiConfig.lastVerified = null;
      
      return { success: true, message: 'AI設定がクリアされました' };
    } catch (error) {
      console.error('Failed to clear configuration:', error);
      return { success: false, message: '設定のクリアに失敗しました' };
    }
  }

  // API Validation
  async validateAPIKey() {
    if (!this.apiConfig.apiKey) {
      return { valid: false, message: 'APIキーが設定されていません' };
    }

    try {
      const testPrompt = "Test connection - respond with 'OK'";
      const response = await this.callAIAPI(testPrompt, { timeout: 10000 });
      
      localStorage.setItem('ai_last_verified', new Date().toISOString());
      this.apiConfig.lastVerified = new Date().toISOString();
      
      return { valid: true, message: 'APIキーが正常に検証されました' };
    } catch (error) {
      console.error('API validation failed:', error);
      return { 
        valid: false, 
        message: `APIキーの検証に失敗しました: ${this.getErrorMessage(error)}` 
      };
    }
  }

  // Main Analysis Functions
  async analyzePerformance(playerData, gameContext = null) {
    if (!this.apiConfig.isConfigured) {
      console.log('API not configured, using mock data');
      return this.getMockAnalysis(playerData);
    }

    try {
      const prompt = this.buildPrompt('performanceAnalysis', playerData, gameContext);
      const response = await this.callAIAPI(prompt);
      const analysis = this.parseAIResponse(response);
      
      // Validate response structure
      if (this.validateAnalysisStructure(analysis)) {
        return analysis;
      } else {
        console.warn('Invalid AI response structure, falling back to mock data');
        return this.getMockAnalysis(playerData);
      }
    } catch (error) {
      console.error('Performance analysis failed:', error);
      this.showError('パフォーマンス分析に失敗しました。モックデータを使用します。');
      return this.getMockAnalysis(playerData);
    }
  }

  async getStrategicAdvice(playerData, situation) {
    if (!this.apiConfig.isConfigured) {
      return this.getMockStrategicAdvice(situation);
    }

    try {
      const prompt = this.buildPrompt('strategyAdvice', { ...playerData, situation });
      const response = await this.callAIAPI(prompt);
      return this.parseStrategicResponse(response);
    } catch (error) {
      console.error('Strategic advice failed:', error);
      return this.getMockStrategicAdvice(situation);
    }
  }

  async generateRecommendations(analysisData) {
    if (!this.apiConfig.isConfigured) {
      return mockRecommendations;
    }

    try {
      const prompt = this.buildPrompt('recommendations', analysisData);
      const response = await this.callAIAPI(prompt);
      return this.parseRecommendationsResponse(response);
    } catch (error) {
      console.error('Recommendations generation failed:', error);
      return mockRecommendations;
    }
  }

  // Core API Call Method
  async callAIAPI(prompt, options = {}) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastCall = now - this.lastAPICall;
    if (timeSinceLastCall < this.minInterval) {
      await this.sleep(this.minInterval - timeSinceLastCall);
    }
    this.lastAPICall = Date.now();

    const timeout = options.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      let headers, body;

      // Configure headers and body based on provider
      switch (this.apiConfig.provider) {
        case 'openai':
          headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiConfig.apiKey}`
          };
          body = {
            model: this.apiConfig.model,
            messages: [
              {
                role: 'system',
                content: 'あなたはeSportsの専門コーチです。プレイヤーのパフォーマンスを分析し、具体的で実践可能な改善アドバイスを提供してください。回答は必ず指定されたJSON形式で返してください。'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: 0.7,
            max_tokens: 1500
          };
          break;

        case 'anthropic':
          headers = {
            'Content-Type': 'application/json',
            'x-api-key': this.apiConfig.apiKey,
            'anthropic-version': '2023-06-01'
          };
          body = {
            model: this.apiConfig.model,
            max_tokens: 1500,
            messages: [
              {
                role: 'user',
                content: prompt
              }
            ]
          };
          break;

        case 'gemini':
          headers = {
            'Content-Type': 'application/json'
          };
          // Gemini uses API key as query parameter
          this.apiConfig.endpoint = `${this.apiConfig.endpoint}?key=${this.apiConfig.apiKey}`;
          body = {
            contents: [{
              parts: [{
                text: prompt
              }]
            }]
          };
          break;

        default:
          throw new Error(`Unsupported provider: ${this.apiConfig.provider}`);
      }

      const response = await fetch(this.apiConfig.endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API request failed: ${response.status} - ${errorData.error?.message || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('API request timed out');
      }
      
      throw error;
    }
  }

  // Prompt Templates
  buildPrompt(type, data, gameContext = null) {
    // Get game-specific context if available
    let gameSpecificInfo = '';
    if (gameContext) {
      const gamePrompt = window.app?.gameManager?.getGameSpecificPrompt?.(gameContext.id);
      if (gamePrompt) {
        gameSpecificInfo = `

ゲーム固有の情報:
- ゲーム: ${gameContext.name}
- 重要統計: ${gamePrompt.stats.join(', ')}
- ロール/ポジション: ${gamePrompt.roles ? gamePrompt.roles.join(', ') : 'N/A'}
- 重点分野: ${gamePrompt.tips}
`;
      }
    }

    const templates = {
      performanceAnalysis: `
以下のeSportsプレイヤーのデータを詳細に分析し、改善点を提案してください：

プレイヤー情報:
- ゲーム: VALORANT
- ランク: ${data.rank || 'Unknown'}
- メインロール: ${data.stats?.mainRole || 'Unknown'}
${gameSpecificInfo}
パフォーマンス統計:
- 勝率: ${data.stats?.winRate || 0}%
- 総試合数: ${data.stats?.gamesPlayed || 0}

最近の試合結果:
${data.recentMatches ? data.recentMatches.map(match => 
  `- ${match.result}: キャラ ${match.character}, ラウンド ${match.rounds} (${match.duration}分)`
).join('\n') : '情報なし'}

以下のJSON形式で回答してください:
{
  "analysis": "全体的な分析（150-200文字程度）",
  "strengths": ["強み1", "強み2", "強み3"],
  "weaknesses": ["弱み1", "弱み2", "弱み3"],
  "improvements": ["具体的な改善点1", "改善点2", "改善点3"],
  "training": ["推奨練習方法1", "練習方法2", "練習方法3"],
  "priority": "最優先で改善すべき点",
  "estimatedImprovement": "改善による予想される効果"
}`,

      strategyAdvice: `
VALORANTの${data.rank || 'ランク不明'}プレイヤーに対して、
${data.situation}の状況での最適な戦略をアドバイスしてください。

プレイヤーのメインロール: ${data.stats?.mainRole || '不明'}
現在の勝率: ${data.stats?.winRate || 0}%

具体的で実践可能なアドバイスを3つ提供し、JSON形式で回答してください:
{
  "situation": "${data.situation}",
  "advice": [
    {
      "title": "アドバイス1のタイトル",
      "description": "詳細な説明",
      "priority": "high|medium|low"
    }
  ]
}`,

      recommendations: `
以下の分析データに基づいて、プレイヤーへの具体的な推奨事項を生成してください：

${JSON.stringify(data, null, 2)}

JSON形式で3-5個の推奨事項を返してください:
{
  "recommendations": [
    {
      "title": "推奨事項のタイトル",
      "type": "skill|strategy|teamfight|macro",
      "priority": "high|medium|low",
      "description": "詳細な説明",
      "actionItems": ["具体的行動1", "具体的行動2"],
      "estimatedTime": "予想所要時間",
      "difficulty": "易|中|難"
    }
  ]
}`
    };

    return templates[type] || '';
  }

  // Response Parsing
  parseAIResponse(response) {
    try {
      let content;

      // Handle different provider response formats
      switch (this.apiConfig.provider) {
        case 'openai':
          content = response.choices?.[0]?.message?.content;
          break;
        case 'anthropic':
          content = response.content?.[0]?.text;
          break;
        case 'gemini':
          content = response.candidates?.[0]?.content?.parts?.[0]?.text;
          break;
        default:
          content = response.choices?.[0]?.message?.content;
      }

      if (!content) {
        throw new Error('No content in API response');
      }

      // Try to extract JSON from the response
      const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/) || content.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;

      const parsed = JSON.parse(jsonText);
      return parsed;
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      console.log('Raw response:', response);
      throw new Error('AIレスポンスの解析に失敗しました');
    }
  }

  parseStrategicResponse(response) {
    try {
      const parsed = this.parseAIResponse(response);
      return parsed.advice || [];
    } catch (error) {
      console.error('Failed to parse strategic response:', error);
      return [];
    }
  }

  parseRecommendationsResponse(response) {
    try {
      const parsed = this.parseAIResponse(response);
      return parsed.recommendations || mockRecommendations;
    } catch (error) {
      console.error('Failed to parse recommendations response:', error);
      return mockRecommendations;
    }
  }

  // Validation
  validateAnalysisStructure(analysis) {
    const required = ['analysis', 'strengths', 'weaknesses', 'improvements', 'training', 'priority', 'estimatedImprovement'];
    return required.every(field => analysis && analysis[field] !== undefined);
  }

  // Mock Data Fallbacks
  getMockAnalysis(data = {}) {
    return {
      ...mockAIAnalysis,
      analysis: mockAIAnalysis.analysis,
      lastUpdated: new Date().toISOString(),
      dataSource: 'mock'
    };
  }

  getMockStrategicAdvice(situation) {
    return [
      {
        title: "ポジショニングの最適化",
        description: `${situation}では、より安全な位置を維持しながら最大ダメージを出せるポジションを意識してください。`,
        priority: "high"
      },
      {
        title: "マップコントロールの強化",
        description: "視界確保を優先し、敵の動きを予測して行動してください。",
        priority: "medium"
      },
      {
        title: "チーム連携の向上",
        description: "チームメンバーとのコミュニケーションを密に取り、連携プレイを心がけてください。",
        priority: "medium"
      }
    ];
  }

  // Utility Methods
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getErrorMessage(error) {
    if (error.message.includes('401')) {
      return 'APIキーが無効です';
    } else if (error.message.includes('429')) {
      return 'API使用量上限に達しました';
    } else if (error.message.includes('timeout')) {
      return 'リクエストがタイムアウトしました';
    } else {
      return error.message || '不明なエラー';
    }
  }

  showError(message) {
    if (typeof window !== 'undefined' && window.showToast) {
      window.showToast(message, 'error');
    } else {
      console.error(message);
    }
  }

  // Queue Management for Multiple Requests
  async queueRequest(requestFn) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ requestFn, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const { requestFn, resolve, reject } = this.requestQueue.shift();
      
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }

      // Rate limiting between queued requests
      if (this.requestQueue.length > 0) {
        await this.sleep(this.minInterval);
      }
    }

    this.isProcessingQueue = false;
  }

  // Configuration Getter
  getConfiguration() {
    return {
      provider: this.apiConfig.provider,
      model: this.apiConfig.model,
      isConfigured: this.apiConfig.isConfigured,
      lastVerified: this.apiConfig.lastVerified,
      hasApiKey: !!this.apiConfig.apiKey
    };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AICoachingService;
} else if (typeof window !== 'undefined') {
  window.AICoachingService = AICoachingService;
}