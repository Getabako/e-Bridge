// unified-api-manager.js - 統一APIキー管理システム（Vercel Serverless対応版）
class UnifiedAPIManager {
    constructor() {
        // Vercel Serverless Function経由でAPIを管理
        this.configEndpoint = '/api/config';
        this._isConfigured = null; // キャッシュ
        this.isInitialized = true; // サーバー管理なので常にtrue

        console.log('🚀 UnifiedAPIManager initializing (Vercel Serverless mode)...');

        // サーバーの設定を確認
        this.checkConfiguration();
    }
    
    // サーバー側の設定を確認
    async checkConfiguration() {
        try {
            const response = await fetch(this.configEndpoint);
            const data = await response.json();
            this._isConfigured = data.configured === true;
            this._configData = data;
            console.log('🔧 Server API configuration:', data);
            return this._isConfigured;
        } catch (error) {
            console.warn('設定確認に失敗:', error.message);
            // ローカル開発時はtrueとして扱う
            if (window.location.protocol === 'file:' ||
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1') {
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
        // 初回はtrueとして扱う
        return true;
    }

    // 以下のメソッドは互換性のため残すが、サーバー管理なので実質的には何もしない
    setAPIKey(apiKey) {
        console.log('APIキーはVercel環境変数で管理されます');
        return true;
    }

    getAPIKey() {
        return '***server-managed***';
    }

    loadAPIKey() {
        console.log('APIキーはVercel環境変数で管理されます');
        return true;
    }

    updateLegacyAPIKeys() {
        // サーバー管理なので何もしない
    }

    // 接続テスト（サーバー経由）
    async validateAPIKey() {
        try {
            if (window.geminiService && typeof window.geminiService.testConnection === 'function') {
                await window.geminiService.testConnection();
                return { valid: true, message: '接続テストに成功しました' };
            } else {
                // geminiServiceがない場合は設定チェックのみ
                await this.checkConfiguration();
                return { valid: this._isConfigured, message: this._isConfigured ? '設定済み' : '未設定' };
            }
        } catch (error) {
            throw new Error(`接続テストに失敗しました: ${error.message}`);
        }
    }

    clearAPIKey() {
        console.log('APIキーはVercel環境変数で管理されます');
    }

    // APIキー統計情報を取得
    getAPIKeyInfo() {
        return {
            configured: this._isConfigured,
            serverManaged: true,
            message: 'APIキーはVercel環境変数で管理されています'
        };
    }

    // 初回設定が必要かチェック
    needsInitialSetup() {
        return false; // サーバー管理なので常にfalse
    }

    // APIキーの強度チェック（互換性のため残す）
    validateAPIKeyStrength(apiKey) {
        return { valid: true, issues: [] };
    }

    // 使用可能な機能リストを取得
    getAvailableFeatures() {
        return [
            {
                name: 'AIチャット',
                description: 'Gemini 1.5 Flash でリアルタイムチャット',
                model: 'gemini-1.5-flash',
                available: true
            },
            {
                name: '音声入力',
                description: 'OpenAI Whisper で音声認識',
                model: 'whisper-1',
                available: true
            }
        ];
    }
}

// グローバルインスタンス
window.unifiedApiManager = new UnifiedAPIManager();