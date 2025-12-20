// unified-api-manager.js - 統一APIキー管理システム
class UnifiedAPIManager {
    constructor() {
        this.apiKey = null;
        this.isInitialized = false;
        this.encryptionKey = this.generateEncryptionKey();
        this.updatingLegacyKeys = false; // 循環参照防止フラグ
        
        console.log('🚀 UnifiedAPIManager initializing...');
        
        // 初期化時にAPIキーを読み込み
        const loaded = this.loadAPIKey();
        console.log('🚀 UnifiedAPIManager constructor complete. API key loaded:', loaded);
    }
    
    generateEncryptionKey() {
        // 簡単な暗号化キー（実際のプロダクションでは more secure な方法を使用）
        const userAgent = navigator.userAgent;
        const timestamp = Date.now().toString();
        return btoa(userAgent.slice(0, 10) + timestamp.slice(-5));
    }
    
    // 簡単なXOR暗号化
    encrypt(text) {
        if (!text) return '';
        try {
            let result = '';
            const key = this.encryptionKey;
            for (let i = 0; i < text.length; i++) {
                result += String.fromCharCode(
                    text.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            return btoa(result);
        } catch (error) {
            console.warn('Encryption failed:', error);
            return text; // フォールバック
        }
    }
    
    // 復号化
    decrypt(encryptedText) {
        if (!encryptedText) return '';
        try {
            const encrypted = atob(encryptedText);
            let result = '';
            const key = this.encryptionKey;
            for (let i = 0; i < encrypted.length; i++) {
                result += String.fromCharCode(
                    encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            return result;
        } catch (error) {
            console.warn('Decryption failed:', error);
            return encryptedText; // フォールバック
        }
    }
    
    // APIキーを設定
    setAPIKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('有効なAPIキーを入力してください');
        }
        
        // 完全なクリーンアップ処理
        const cleanedKey = apiKey
            .trim()                           // 前後の空白削除
            .replace(/[\r\n\t]/g, '')         // 改行・タブ文字削除
            .replace(/\s+/g, '');             // すべての空白文字削除
        
        if (cleanedKey.length === 0) {
            throw new Error('有効なAPIキーを入力してください');
        }
        
        this.apiKey = cleanedKey;
        
        // 平文でLocalStorageに保存（暗号化なし）
        localStorage.setItem('gemini_unified_api_key', this.apiKey);
        localStorage.setItem('api_key_timestamp', Date.now().toString());
        
        this.isInitialized = true;
        
        // 既存の個別APIキーを更新
        this.updateLegacyAPIKeys();

        // グローバルサービスに即時反映（存在しない場合のフォールバック保存も）
        try {
            if (window.geminiService && typeof window.geminiService.setApiKey === 'function') {
                window.geminiService.apiKey = this.apiKey; // 直接反映（ループ防止）
            } else {
                // 次回初期化時に拾えるようレガシーキーも更新
                localStorage.setItem('gemini-api-key', this.apiKey);
            }
        } catch (e) {
            console.debug('Failed to propagate API key to geminiService:', e?.message);
        }
        
        // アプリに初期化完了を通知
        if (window.app && typeof window.app.onAPIKeyConfigured === 'function') {
            window.app.onAPIKeyConfigured();
        }
        
        console.log('Unified API key saved successfully (plain text)');
        return true;
    }
    
    // APIキーを取得
    getAPIKey() {
        return this.apiKey;
    }
    
    // LocalStorageからAPIキーを読み込み
    loadAPIKey() {
        console.log('🔄 Loading API key from localStorage...');
        try {
            const storedKey = localStorage.getItem('gemini_unified_api_key');
            const timestamp = localStorage.getItem('api_key_timestamp');
            
            console.log('🔍 LocalStorage check:', {
                hasStoredKey: !!storedKey,
                keyLength: storedKey ? storedKey.length : 0,
                hasTimestamp: !!timestamp
            });
            
            if (storedKey) {
                // 平文で保存されたキーを直接読み込み（クリーンアップ適用）
                const cleanedKey = storedKey
                    .trim()
                    .replace(/[\r\n\t]/g, '')
                    .replace(/\s+/g, '');
                
                if (cleanedKey.length > 0) {
                    this.apiKey = cleanedKey;
                    this.isInitialized = true;
                    
                    console.log('✅ API key set successfully:', {
                        keyLength: cleanedKey.length,
                        isInitialized: this.isInitialized,
                        keyStartsWith: cleanedKey.substring(0, 6) + '...'
                    });
                    
                    // キーの有効期限チェック（30日）
                    if (timestamp) {
                        const keyAge = Date.now() - parseInt(timestamp);
                        const thirtyDays = 30 * 24 * 60 * 60 * 1000;
                        
                        if (keyAge > thirtyDays) {
                            console.warn('API key is older than 30 days, consider updating');
                        }
                    }
                    
                    // 既存の個別APIキーを更新
                    this.updateLegacyAPIKeys();
                    
                    console.log('✅ API key loaded successfully (plain text)');
                    return true;
                } else {
                    console.warn('⚠️ Stored API key is empty after cleaning');
                }
            } else {
                console.log('ℹ️ No API key found in localStorage');
            }
        } catch (error) {
            console.warn('❌ Failed to load API key:', error);
            this.clearAPIKey();
        }
        
        console.log('❌ API key loading failed');
        return false;
    }
    
    // 既存の個別APIキーを統一キーで更新
    updateLegacyAPIKeys() {
        if (!this.isConfigured() || this.updatingLegacyKeys) return;
        
        this.updatingLegacyKeys = true;
        try {
            // Geminiサービスが存在する場合はAPIキーを設定
            if (window.geminiService && typeof window.geminiService.setApiKey === 'function') {
                window.geminiService.setApiKey(this.apiKey);
            }
            
            // 既存の個別保存されたキーを削除（統一管理のため）
            const legacyKeys = [
                'gemini-api-key',
                'gemini-vision-api-key',
                'ai_api_key'
            ];
            
            legacyKeys.forEach(key => {
                if (localStorage.getItem(key)) {
                    localStorage.removeItem(key);
                }
            });
            
        } catch (error) {
            console.warn('Failed to update legacy API keys:', error);
        } finally {
            this.updatingLegacyKeys = false;
        }
    }
    
    // APIキーが設定されているかチェック
    isConfigured() {
        const result = this.isInitialized && this.apiKey && this.apiKey.length > 10;
        console.log('🔧 UnifiedAPIManager.isConfigured():', {
            isInitialized: this.isInitialized,
            hasApiKey: !!this.apiKey,
            apiKeyLength: this.apiKey ? this.apiKey.length : 0,
            result: result
        });
        return result;
    }
    
    // 接続テスト
    async validateAPIKey() {
        if (!this.isConfigured()) {
            throw new Error('APIキーが設定されていません');
        }
        
        try {
            // Geminiサービスを使用してテスト
            if (window.geminiService && typeof window.geminiService.testConnection === 'function') {
                await window.geminiService.testConnection();
                return { valid: true, message: '接続テストに成功しました' };
            } else {
                throw new Error('Geminiサービスが利用できません');
            }
        } catch (error) {
            throw new Error(`接続テストに失敗しました: ${error.message}`);
        }
    }
    
    // APIキーをクリア
    clearAPIKey() {
        this.apiKey = null;
        this.isInitialized = false;
        
        // LocalStorageから削除
        localStorage.removeItem('gemini_unified_api_key');
        localStorage.removeItem('api_key_timestamp');
        
        // 各サービスのAPIキーもクリア
        if (window.geminiService && typeof window.geminiService.clearApiKey === 'function') {
            window.geminiService.clearApiKey();
        }
        
        console.log('API key cleared');
    }
    
    // APIキー統計情報を取得
    getAPIKeyInfo() {
        if (!this.isConfigured()) {
            return {
                configured: false,
                keyLength: 0,
                lastUpdated: null,
                daysOld: null
            };
        }
        
        const timestamp = localStorage.getItem('api_key_timestamp');
        const lastUpdated = timestamp ? new Date(parseInt(timestamp)) : null;
        const daysOld = lastUpdated ? Math.floor((Date.now() - lastUpdated.getTime()) / (24 * 60 * 60 * 1000)) : null;
        
        return {
            configured: true,
            keyLength: this.apiKey.length,
            lastUpdated: lastUpdated,
            daysOld: daysOld,
            keyPreview: this.apiKey.substring(0, 8) + '...' + this.apiKey.substring(this.apiKey.length - 4)
        };
    }
    
    // 初回設定が必要かチェック
    needsInitialSetup() {
        return !this.isConfigured();
    }
    
    // APIキーの強度チェック
    validateAPIKeyStrength(apiKey) {
        const issues = [];
        
        if (!apiKey) {
            issues.push('APIキーが入力されていません');
            return { valid: false, issues };
        }
        
        if (apiKey.length < 20) {
            issues.push('APIキーが短すぎます（20文字以上必要）');
        }
        
        if (!apiKey.match(/^[A-Za-z0-9_-]+$/)) {
            issues.push('APIキーに無効な文字が含まれています');
        }
        
        if (!apiKey.startsWith('AIza')) {
            issues.push('Google Gemini APIキーは "AIza" で始まる必要があります');
        }
        
        return {
            valid: issues.length === 0,
            issues: issues
        };
    }
    
    // 使用可能な機能リストを取得
    getAvailableFeatures() {
        if (!this.isConfigured()) {
            return [];
        }
        
        return [
            {
                name: 'AIチャット',
                description: 'Gemini 1.5 Flash でリアルタイムチャット',
                model: 'gemini-1.5-flash',
                available: true
            },
        ];
    }
}

// グローバルインスタンス
window.unifiedApiManager = new UnifiedAPIManager();