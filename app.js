// app.js - 完全修復版
class App {
    constructor() {
        this.currentPage = 'dashboard';
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.isGuest = false;
        this.currentUser = null;
        
        // エラー追跡
        this.apiErrorCount = 0;
        this.lastSuccessfulAPICall = Date.now();
        this.consecutiveErrors = 0;
        
        // パフォーマンス最適化: マッチデータのキャッシュ
        this.cachedMatchData = null;
        this.lastDataLoadTime = 0;
        this.DATA_CACHE_TTL = 5000; // 5秒間キャッシュを保持
        
        // チャート更新のデバウンス用タイマー
        this.chartUpdateTimer = null;
        
        // パフォーマンス最適化: 重複初期化を防ぐフラグ
        this.isMainAppInitialized = false;
        this.isEventListenersSetup = false;
        this.isThemeInitialized = false;
        
        // サービスの初期化
        this.initializeServices();
        
        // DOMContentLoadedで初期化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }
    
    initializeServices() {
        // APIサービスが存在する場合のみ初期化
        if (typeof AICoachingService !== 'undefined') {
            this.aiService = new AICoachingService();
        }
        
        // 認証サービス
        if (typeof AuthService !== 'undefined') {
            this.authService = new AuthService();
        }
        
        // ゲームマネージャー
        if (typeof GameManager !== 'undefined') {
            this.gameManager = new GameManager();
        }
        
        // Geminiサービス
        if (typeof GeminiService !== 'undefined') {
            this.geminiService = new GeminiService();
        }
        
        // プレイヤー統計マネージャー
        if (typeof PlayerStatsManager !== 'undefined') {
            this.playerStatsManager = new PlayerStatsManager();
        }

        // コーチングプランサービス
        if (typeof CoachingPlanService !== 'undefined') {
            this.coachingPlanService = new CoachingPlanService();
        }

        this.chatMessages = [];
    }
    
    async init() {
        console.log('App initializing...');

        // valorant-stats.jsonから戦績データを自動インポート
        await this.autoImportValorantStats();

        // テーマの初期化
        this.initTheme();
        
        // すべてのモーダルを非表示にする
        this.hideAllModals();
        
        // 統一APIマネージャーの初期化完了を待つ
        await this.waitForUnifiedAPIManager();

        // 1. 最優先で初回設定（スキルレベルなど）が必要かチェック
        if (this.needsInitialSetup()) {
            console.log('初回設定が必要です。初期設定画面を表示します。');
            this.showInitialSetupModal();
            return; // 初期設定が完了するまで他の処理を中断
        }
        
        // 2. サーバーのAPI設定をチェック（Vercel環境変数）
        const apiCheckResult = await this.performBackgroundAPICheck();

        console.log('API設定チェック結果:', apiCheckResult);
        this.closeInitialSetupModal(); // 不要なモーダルを閉じる

        // メイン画面へ遷移（APIキー入力画面はスキップ）
        console.log('メイン画面へ遷移');
        await this.initializeMainApp();
        
        console.log('App initialized successfully');
    }

    // valorant-stats.jsonから戦績データを自動インポート
    async autoImportValorantStats() {
        try {
            // 既存のデータをチェック
            const existingGallery = JSON.parse(localStorage.getItem('valorant_gallery') || '[]');
            const existingMatches = JSON.parse(localStorage.getItem('valorant_matches') || '[]');

            // 既にデータがある場合はスキップ
            if (existingGallery.length > 0 || existingMatches.length > 0) {
                console.log('既存の戦績データがあります。自動インポートをスキップ');
                return;
            }

            // valorant-stats.jsonからデータを取得
            const response = await fetch('data/valorant-stats.json');
            if (!response.ok) {
                console.log('valorant-stats.json が見つかりません');
                return;
            }

            const statsData = await response.json();
            if (!statsData.matches || statsData.matches.length === 0) {
                console.log('valorant-stats.json に試合データがありません');
                return;
            }

            // 試合データをlocalStorageに保存
            const matchesToImport = statsData.matches.map(m => ({
                ...m,
                timestamp: new Date(m.date).getTime() || Date.now(),
                importedFromAPI: true
            }));

            localStorage.setItem('valorant_gallery', JSON.stringify(matchesToImport));

            // キャッシュを無効化
            this.cachedMatchData = null;

            console.log(`valorant-stats.jsonから${matchesToImport.length}試合をインポートしました`);
        } catch (error) {
            console.warn('戦績データの自動インポートに失敗:', error);
        }
    }

    // テーマ管理
    initTheme() {
        // 既に初期化済みの場合はスキップ（重複イベントリスナーを防ぐ）
        if (this.isThemeInitialized) {
            return;
        }
        
        this.applyTheme(this.currentTheme);
        
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
                this.applyTheme(this.currentTheme);
                localStorage.setItem('theme', this.currentTheme);
                
                // テーマ変更時にグラフを再描画
                this.refreshChartsForTheme();
            });
        }
        
        this.isThemeInitialized = true;
    }
    
    // テーマ変更時にグラフを再描画
    refreshChartsForTheme() {
        if (this.currentPage === 'dashboard') {
            // デバウンスを使用してパフォーマンス向上
            this.scheduleChartUpdate();
        }
    }
    
    applyTheme(theme) {
        const root = document.documentElement;
        const themeBtn = document.getElementById('theme-toggle-btn');
        
        if (theme === 'light') {
            root.setAttribute('data-theme', 'light');
            if (themeBtn) themeBtn.textContent = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
            
            // ライトモードのスタイル
            root.style.setProperty('--bg-primary', '#ffffff');
            root.style.setProperty('--bg-secondary', '#f5f5f5');
            root.style.setProperty('--bg-card', '#ffffff');
            root.style.setProperty('--text-primary', '#1a1a1a');
            root.style.setProperty('--text-secondary', '#666666');
            root.style.setProperty('--border-color', '#e0e0e0');
            root.style.setProperty('--accent-primary', '#0066cc');
            root.style.setProperty('--accent-secondary', '#0052a3');
        } else {
            root.setAttribute('data-theme', 'dark');
            if (themeBtn) themeBtn.textContent = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
            
            // ダークモードのスタイル
            root.style.setProperty('--bg-primary', '#1a1a2e');
            root.style.setProperty('--bg-secondary', '#16213e');
            root.style.setProperty('--bg-card', '#0f1924');
            root.style.setProperty('--text-primary', '#ffffff');
            root.style.setProperty('--text-secondary', '#b0b0b0');
            root.style.setProperty('--border-color', '#2a3f5f');
            root.style.setProperty('--accent-primary', '#e94560');
            root.style.setProperty('--accent-secondary', '#c13651');
        }
    }
    
    // 認証チェック
    checkAuthentication() {
        const storedUser = sessionStorage.getItem('currentUser');
        const isGuest = sessionStorage.getItem('isGuest');
        
        if (storedUser) {
            this.currentUser = JSON.parse(storedUser);
            this.updateUserDisplay(this.currentUser.username);
        } else if (isGuest === 'true') {
            this.isGuest = true;
            this.updateUserDisplay('ゲストユーザー', true);
        } else {
            // ログインモーダルを表示
            this.showLoginModal();
        }
    }
    
    showLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }
    
    hideLoginModal() {
        const modal = document.getElementById('login-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    updateUserDisplay(username, isGuest = false) {
        const headerUserName = document.getElementById('header-user-name');
        const userTypeIndicator = document.getElementById('user-type-indicator');
        
        if (headerUserName) {
            headerUserName.textContent = username;
        }
        
        if (userTypeIndicator) {
            userTypeIndicator.textContent = isGuest ? 'ゲスト' : 'ユーザー';
            userTypeIndicator.className = isGuest ? 'user-type guest' : 'user-type registered';
        }
    }
    
    // すべてのモーダルを非表示
    hideAllModals() {
        const modals = [
            'login-modal',
            'api-setup-modal',
            'initial-setup-modal'
        ];
        
        modals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('hidden');
                modal.style.display = 'none';
            }
        });
    }

    // 統一APIマネージャーの初期化完了を待つ
    async waitForUnifiedAPIManager() {
        let attempts = 0;
        const maxAttempts = 50; // 5秒待機
        
        while (!window.unifiedApiManager && attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!window.unifiedApiManager) {
            console.error('統一APIマネージャーの初期化に失敗');
            throw new Error('統一APIマネージャーが利用できません');
        }
        
        console.log('統一APIマネージャー初期化完了');
    }

    // バックグラウンドでAPI設定をチェック（Vercel Serverless対応版）
    async performBackgroundAPICheck() {
        try {
            // サーバーの設定を確認
            console.log('サーバーのAPI設定を確認中...');
            const response = await fetch('/api/config');
            const configData = await response.json();

            console.log('サーバー設定:', configData);

            if (configData.configured) {
                // サーバーにAPIキーが設定されている
                console.log('サーバーにAPIキーが設定されています');
                return { success: true, result: configData };
            } else {
                // サーバーにAPIキーが未設定
                console.log('サーバーにAPIキーが未設定です');
                const missingKeys = [];
                if (!configData.gemini) missingKeys.push('GEMINI_API_KEY');
                if (!configData.openai) missingKeys.push('OPENAI_API_KEY');

                // エラーメッセージを表示するが、アプリは起動する
                this.showToast(`Vercel環境変数に ${missingKeys.join(', ')} を設定してください`, 'warning');
                return { success: true, warning: 'api_not_configured' };
            }

        } catch (error) {
            console.warn('サーバー設定の確認に失敗:', error);

            // ローカル開発時（file://プロトコル）の場合は成功として扱う
            if (window.location.protocol === 'file:') {
                console.log('ローカル開発モード: API設定チェックをスキップ');
                return { success: true, local: true };
            }

            // ネットワークエラーの場合でもアプリは起動
            return { success: true, warning: 'network_error' };
        }
    }

    // メインアプリを初期化(API接続成功時)
    async initializeMainApp() {
        // 既に初期化済みの場合はスキップ（重複初期化を防ぐ）
        if (this.isMainAppInitialized) {
            console.log('メインアプリは既に初期化済みです。スキップします。');
            return;
        }
        
        console.log('メインアプリを初期化中...');
        
        // 統一APIマネージャーからGeminiServiceへのAPIキー同期を確保
        if (window.unifiedApiManager && window.unifiedApiManager.isConfigured()) {
            window.unifiedApiManager.updateLegacyAPIKeys();
        }
        
        // ログインチェック
        this.checkAuthentication();
        
        // 残りの初期化を実行
        this.continueInitialization();
        
        // ゲーム選択とダッシュボード機能の初期化
        this.initGameSelection();
        this.initializeSkillLevel();
        // 日替わりコーチングは非同期で遅延初期化（503エラーの連鎖を防ぐため）
        setTimeout(() => {
            this.initDailyCoaching().catch(err => {
                console.warn('日替わりコーチングの初期化に失敗しました（サーバー混雑の可能性）:', err.message);
            });
        }, 2000); // 2秒遅延
        this.initDashboardGoals();

        // その他のナビゲーション機能
        this.initNavigationHelpers();
        
        // 連勝記録の初期化
        this.initWinStreak();
        
        // 初期ページの表示
        this.showPage(this.currentPage);
        
        // チャートの初期化
        this.initCharts();
        
        // データのロード
        this.loadUserData();
        
        // ログイン画面を表示
        setTimeout(() => {
            this.showLoginModal();
        }, 100);
        
        // 初期化完了フラグを設定
        this.isMainAppInitialized = true;
        console.log('メインアプリの初期化が完了しました。');
    }

    // API設定チェックと初期化（従来のメソッド、互換性のため残す）
    async checkAndInitializeAPI() {
        // 新しいフローに置き換えられたため、何もしない
        console.log('checkAndInitializeAPIは新しいフローに置き換えられました');
    }
    
    // 初期化の続行
    continueInitialization() {
        // イベントリスナーの設定
        this.setupEventListeners();

        // ギャラリーイベントリスナーの設定
        this.setupGalleryEventListeners();

        // フローティングチャットの設定
        this.setupFloatingChat();

        // ナビゲーションの初期化
        this.initNavigation();

        // チャット機能の初期化
        this.initChat();
        

        // コーチング機能のフィードバックボタンを設定
        this.setupCoachingFeedbackListeners();

        // 気づきタグ機能のイベントリスナー設定
        this.setupInsightTagsListeners();
    }
    
    // APIセットアップモーダルを閉じる
    closeAPISetupModal() {
        const modal = document.getElementById('api-setup-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }
    
    // APIキー入力フィールドの同期
    syncAPIKeyInputs() {
        if (!window.unifiedApiManager) return;
        
        const apiKey = window.unifiedApiManager.getAPIKey();
        const inputs = [
            document.getElementById('gemini-api-key'),
            document.getElementById('initial-api-key')
        ];
        
        inputs.forEach(input => {
            if (input && apiKey) {
                input.value = apiKey;
            }
        });
    }
    
    // ナビゲーション
    initNavigation() {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = btn.dataset.page;
                if (page) {
                    this.showPage(page);
                    
                    // アクティブクラスの更新
                    navBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        });
    }
    
    showPage(pageId) {
        console.log('Showing page:', pageId);
        
        // すべてのページを非表示
        const pages = document.querySelectorAll('.page');
        pages.forEach(page => {
            page.classList.remove('active');
        });
        
        // 指定されたページを表示
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.add('active');
            this.currentPage = pageId;
            
            // ページ固有の初期化
            this.initPageContent(pageId);
        }
    }
    
    initPageContent(pageId) {
        switch(pageId) {
            case 'coaching-plans':
                this.initCoachingPlansPage();
                break;
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'analysis':
                this.loadAnalysis();
                // マップ選択肢を初期化
                if (!this._mapOptionsRendered) {
                    this.renderMapOptions();
                    this._mapOptionsRendered = true;
                }
                break;
            case 'goals':
                this.loadGoals();
                break;
            case 'gallery':
                this.loadGallery();
                break;
            case 'data-source':
                this.loadDataSourcePage();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }
    
    // イベントリスナー設定
    setupEventListeners() {
        // 既に設定済みの場合はスキップ（重複イベントリスナーを防ぐ）
        if (this.isEventListenersSetup) {
            console.log('イベントリスナーは既に設定済みです。スキップします。');
            return;
        }
        
        console.log('イベントリスナーを設定中...');
        
        // ログイン/登録タブ切り替え
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = btn.dataset.tab;
                this.switchTab(tabName);
            });
        });
        
        // ログインフォーム
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }
        
        // 登録フォーム
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }
        
        // ゲストボタン
        const guestBtn = document.getElementById('guest-btn');
        if (guestBtn) {
            guestBtn.addEventListener('click', () => {
                this.handleGuestAccess();
            });
        }
        
        // ログアウトボタン
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }
        
        // 試合データフォーム
        const matchForm = document.getElementById('match-form');
        if (matchForm) {
            matchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleMatchSubmit();
            });
        }

        // クイック試合入力フォーム
        const quickMatchForm = document.getElementById('quick-match-form');
        if (quickMatchForm) {
            quickMatchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleQuickMatchSubmit();
            });
        }

        // クイック入力のイベントリスナー
        this.setupQuickMatchListeners();
        
        // プラン付き目標作成ボタン
        const createWithPlanBtn = document.getElementById('create-with-plan-btn');
        if (createWithPlanBtn) {
            createWithPlanBtn.addEventListener('click', () => {
                this.handleCreateGoalWithPlan();
            });
        }

        // 戦績から目標を自動策定ボタン
        const autoGenerateGoalsBtn = document.getElementById('auto-generate-goals-btn');
        if (autoGenerateGoalsBtn) {
            autoGenerateGoalsBtn.addEventListener('click', () => {
                this.generateGoalsFromStats();
            });
        }

        // コーチングプランモーダルイベント
        this.initCoachingPlanModal();
        
        // API設定フォーム
        const apiForm = document.getElementById('api-form');
        if (apiForm) {
            apiForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleApiSave();
            });
        }
        
        // APIキー表示トグル
        const toggleApiKey = document.getElementById('toggle-api-key');
        if (toggleApiKey) {
            toggleApiKey.addEventListener('click', () => {
                const apiKeyInput = document.getElementById('api-key');
                if (apiKeyInput) {
                    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
                    toggleApiKey.textContent = apiKeyInput.type === 'password' ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>‍🗨️';
                }
            });
        }
        
        // APIテストボタン
        const testApiBtn = document.getElementById('test-api-btn');
        if (testApiBtn) {
            testApiBtn.addEventListener('click', () => {
                this.testApiConnection();
            });
        }
        
        // APIクリアボタン
        const clearApiBtn = document.getElementById('clear-api-btn');
        if (clearApiBtn) {
            clearApiBtn.addEventListener('click', () => {
                this.clearApiSettings();
            });
        }
        
        // AI更新ボタン
        const refreshAiBtn = document.getElementById('refresh-ai-btn');
        if (refreshAiBtn) {
            refreshAiBtn.addEventListener('click', () => {
                this.refreshAiRecommendations();
            });
        }
        
        // VALORANT専用アプリのため、ゲーム選択機能は無効化

        // スキルレベル変更ボタン
        const changeSkillBtn = document.getElementById('change-skill-btn');
        if (changeSkillBtn) {
            changeSkillBtn.addEventListener('click', () => {
                this.showSkillSelector();
            });
        }

        // スキルレベル選択確定ボタン
        const confirmSkillBtn = document.getElementById('confirm-skill-btn');
        if (confirmSkillBtn) {
            confirmSkillBtn.addEventListener('click', () => {
                this.confirmSkillSelection();
            });
        }

        // スキルレベル選択キャンセルボタン
        const cancelSkillBtn = document.getElementById('cancel-skill-btn');
        if (cancelSkillBtn) {
            cancelSkillBtn.addEventListener('click', () => {
                this.hideSkillSelector();
            });
        }

        // アプリ初期化ボタン
        const resetBtn = document.getElementById('reset-app-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetAppData();
            });
        }

        // Data Source Page Listeners
        const uploadForm = document.getElementById('upload-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => this.handleFileUpload(e));
        }

        const fileInput = document.getElementById('file-input');
        const uploadBtn = document.getElementById('upload-btn');
        if (fileInput && uploadBtn) {
            fileInput.addEventListener('change', () => {
                uploadBtn.disabled = fileInput.files.length === 0;
            });
        }

        // Gallery Page Listeners
        this.setupGalleryFilters();

        // 勝率詳細ボタン
        const winRateDetailBtn = document.getElementById('show-winrate-detail-btn');
        if (winRateDetailBtn) {
            winRateDetailBtn.addEventListener('click', () => {
                this.showWinRateDetailModal();
            });
        }

        // Valorant API連携イベントリスナー
        this.setupValorantAPIListeners();

        // 攻略ガイド管理イベントリスナー
        this.setupStrategyGuideListeners();

        // イベントリスナー設定完了フラグを設定
        this.isEventListenersSetup = true;
        console.log('イベントリスナーの設定が完了しました。');
    }
    
    // タブ切り替え
    switchTab(tabName) {
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabBtns.forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        tabContents.forEach(content => {
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
            } else {
                content.classList.remove('active');
            }
        });
    }
    
    // ログイン処理
    handleLogin() {
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        if (this.authService) {
            const result = this.authService.login(username, password);
            if (result.success) {
                this.currentUser = result.user;
                this.updateUserDisplay(username);
                this.hideLoginModal();
                this.loadUserData();
                this.showToast('ログインしました', 'success');
            } else {
                this.showToast(result.message, 'error');
            }
        } else {
            // モックログイン
            this.currentUser = { username: username };
            sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            this.updateUserDisplay(username);
            this.hideLoginModal();
            this.showToast('ログインしました', 'success');
        }
    }
    
    // 登録処理
    handleRegister() {
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const passwordConfirm = document.getElementById('register-password-confirm').value;
        
        if (password !== passwordConfirm) {
            this.showToast('パスワードが一致しません', 'error');
            return;
        }
        
        if (this.authService) {
            const result = this.authService.register(username, password, email);
            if (result.success) {
                this.showToast('登録が完了しました。ログインしてください。', 'success');
                this.switchTab('login');
            } else {
                this.showToast(result.message, 'error');
            }
        } else {
            // モック登録
            this.showToast('登録が完了しました', 'success');
            this.switchTab('login');
        }
    }
    
    // ゲストアクセス
    handleGuestAccess() {
        this.isGuest = true;
        sessionStorage.setItem('isGuest', 'true');
        this.updateUserDisplay('ゲストユーザー', true);
        this.hideLoginModal();
        this.showToast('ゲストとしてログインしました', 'info');
    }
    
    // ログアウト
    handleLogout() {
        this.currentUser = null;
        this.isGuest = false;
        sessionStorage.removeItem('currentUser');
        sessionStorage.removeItem('isGuest');
        this.showLoginModal();
        this.showToast('ログアウトしました', 'info');
    }
    
    // 試合データ送信
    handleMatchSubmit() {
        const matchData = {
            result: document.getElementById('match-result').value,
            character: document.getElementById('character-select').value,
            // キャラクター・ラウンド結果指標のみ
            playerCharacter: document.getElementById('player-character').value,
            opponentCharacter: document.getElementById('opponent-character').value,
            roundsWon: parseInt(document.getElementById('rounds-won').value || 0),
            roundsLost: parseInt(document.getElementById('rounds-lost').value || 0),
            duration: parseFloat(document.getElementById('match-duration').value)
        };

        // 1) 分析結果の表示
        this.analyzeMatch(matchData);

        // 2) 試合を保存し、ダッシュボード統計を更新（連動）
        this.storeMatchAndRefresh(matchData);
        document.getElementById('match-form').reset();
        this.showToast('分析を実行しています...', 'info');
    }

    // クイック試合入力のイベントリスナーを設定
    setupQuickMatchListeners() {
        // マップ管理機能の初期化
        this.initializeMapManagement();

        // マップ選択（動的に再生成）
        this.renderMapOptions();

        // エージェント選択
        const agentOptions = document.querySelectorAll('.agent-option');
        agentOptions.forEach(option => {
            option.addEventListener('click', () => {
                this.selectAgent(option);
            });
        });

        // エージェント検索機能
        this.setupAgentFiltering();
        
        // ゲームモード切り替えと引き分けオプションの表示制御
        this.initializeGameModeHandlers();

        // スコア・KDA入力フィールドの監視
        const scoreInputs = ['team-score', 'enemy-score', 'kills', 'deaths', 'assists'];
        scoreInputs.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input) {
                input.addEventListener('input', () => this.updateSubmitButton());
            }
        });

        // 数値ボタンの初期化
        this.initializeNumberButtons();

        // リセットボタン
        const resetBtn = document.getElementById('reset-quick-form');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetQuickForm();
            });
        }

        // 気づきタグ機能
        this.setupInsightTagsListeners();
    }

    // 数値ボタンの初期化
    initializeNumberButtons() {
        // スコアボタン（テンキー方式）
        this.createTenkeyButtons('team-score');
        this.createTenkeyButtons('enemy-score');
        
        // KDAボタン（テンキー方式）
        this.createTenkeyButtons('kills');
        this.createTenkeyButtons('deaths');
        this.createTenkeyButtons('assists');
        
        // スタッツボタン（テンキー方式）
        this.createTenkeyButtons('acs');
        this.createTenkeyButtons('adr');
        this.createTenkeyButtons('hs-percent');
    }

    // テンキー式ボタンを生成
    createTenkeyButtons(inputId) {
        const container = document.getElementById(`${inputId}-buttons`);
        const input = document.getElementById(inputId);
        
        if (!container || !input) {
            console.warn(`Container or input not found for ${inputId}`);
            return;
        }
        
        container.innerHTML = '';
        container.classList.add('tenkey-container');
        
        // テンキーボタンの配置（電卓式: 7-8-9, 4-5-6, 1-2-3, 0）
        const tenkeyLayout = [
            [7, 8, 9],
            [4, 5, 6],
            [1, 2, 3],
            ['C', 0]
        ];
        
        tenkeyLayout.forEach(row => {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'tenkey-row';
            
            row.forEach(value => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'tenkey-btn';
                
                if (value === 'C') {
                    btn.textContent = 'C';
                    btn.classList.add('tenkey-clear');
                    btn.addEventListener('click', () => {
                        input.value = '0';
                        this.updateSubmitButton();
                    });
                } else {
                    btn.textContent = value;
                    btn.classList.add('tenkey-number');
                    btn.addEventListener('click', () => {
                        let currentValue = input.value || '0';
                        if (currentValue === '0') {
                            input.value = value.toString();
                        } else {
                            const newValue = parseInt(currentValue + value.toString());
                            const maxValue = parseInt(input.getAttribute('max')) || 999;
                            if (newValue <= maxValue) {
                                input.value = newValue;
                            }
                        }
                        this.updateSubmitButton();
                    });
                }
                
                rowDiv.appendChild(btn);
            });
            
            container.appendChild(rowDiv);
        });
    }
    
    // ゲームモード切り替えに応じた引き分けオプションの表示制御
    initializeGameModeHandlers() {
        const competitiveRadio = document.getElementById('mode-competitive');
        const unratedRadio = document.getElementById('mode-unrated');
        const drawOptionContainer = document.getElementById('draw-option-container');
        const drawCheckbox = document.getElementById('is-draw');

        const updateDrawVisibility = () => {
            if (competitiveRadio && competitiveRadio.checked) {
                if (drawOptionContainer) drawOptionContainer.style.display = 'block';
            } else {
                if (drawOptionContainer) drawOptionContainer.style.display = 'none';
                if (drawCheckbox) drawCheckbox.checked = false;
            }
        };

        // 初期表示設定
        updateDrawVisibility();

        // イベントリスナー設定
        if (competitiveRadio) {
            competitiveRadio.addEventListener('change', updateDrawVisibility);
        }
        if (unratedRadio) {
            unratedRadio.addEventListener('change', updateDrawVisibility);
        }
    }

    // エージェント検索フィルタリング機能の設定
    setupAgentFiltering() {
        const agentSearchInput = document.getElementById('agent-search');
        if (agentSearchInput) {
            agentSearchInput.addEventListener('input', (e) => {
                this.filterAgents(e.target.value.toLowerCase());
            });
        }
    }

    // エージェントフィルタリング処理
    filterAgents(searchTerm) {
        const agentOptions = document.querySelectorAll('.agent-option');
        let visibleCount = 0;

        agentOptions.forEach(option => {
            const agentName = option.dataset.agent ? option.dataset.agent.toLowerCase() : '';
            const displayText = option.textContent.toLowerCase();

            const matches = agentName.includes(searchTerm) || displayText.includes(searchTerm);

            if (matches || searchTerm === '') {
                option.style.display = 'flex';
                visibleCount++;
            } else {
                option.style.display = 'none';
            }
        });
    }

    // マップ選択処理
    selectMap(option) {
        // 他の選択を解除
        document.querySelectorAll('.map-option').forEach(opt => {
            opt.classList.remove('selected');
            // 選択解除時のスタイルをリセット
            opt.style.borderColor = 'rgba(233, 69, 96, 0.3)';
            opt.style.background = 'linear-gradient(145deg, rgba(22, 33, 62, 0.95), rgba(15, 52, 96, 0.9))';
            opt.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            opt.style.transform = 'scale(1)';
        });

        // 新しい選択をアクティブにする
        option.classList.add('selected');
        // 選択時のスタイルを適用
        option.style.borderColor = 'var(--color-accent)';
        option.style.background = 'linear-gradient(145deg, rgba(233, 69, 96, 0.3), rgba(15, 52, 96, 0.95))';
        option.style.boxShadow = '0 0 20px rgba(233, 69, 96, 0.5)';
        option.style.transform = 'scale(1.05)';

        // hidden inputに値を設定
        document.getElementById('selected-map').value = option.dataset.map;

        this.updateSubmitButton();
    }

    // エージェント選択処理
    selectAgent(option) {
        // 他の選択を解除
        document.querySelectorAll('.agent-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // 新しい選択をアクティブにする
        option.classList.add('selected');

        // hidden inputに値を設定
        document.getElementById('selected-agent').value = option.dataset.agent;

        this.updateSubmitButton();
    }

    // 送信ボタンの状態を更新
    updateSubmitButton() {
        const submitBtn = document.querySelector('.quick-submit-btn');
        if (!submitBtn) return;
        
        const map = document.getElementById('selected-map')?.value || '';
        const agent = document.getElementById('selected-agent')?.value || '';
        const teamScore = document.getElementById('team-score')?.value || '';
        const enemyScore = document.getElementById('enemy-score')?.value || '';
        const kills = document.getElementById('kills')?.value || '';
        const deaths = document.getElementById('deaths')?.value || '';
        const assists = document.getElementById('assists')?.value || '';

        // 必須項目がすべて入力されているかチェック
        const isComplete = map && agent && teamScore && enemyScore && kills && deaths && assists;
        submitBtn.disabled = !isComplete;
    }

    // クイックフォームをリセット
    // 気づきタグ機能のイベントリスナー設定
    setupInsightTagsListeners() {
        // 感想入力のテキストカウンター
        const feelingsInput = document.getElementById('match-feelings');
        const charCountElement = document.getElementById('feelings-char-count');
        const generateTagsBtn = document.getElementById('generate-tags-btn');

        if (feelingsInput && charCountElement && generateTagsBtn) {
            feelingsInput.addEventListener('input', (e) => {
                const length = e.target.value.length;
                charCountElement.textContent = length;

                // 10文字以上で生成ボタン有効化
                generateTagsBtn.disabled = length < 10;
                console.log(`入力文字数: ${length}, ボタン状態: ${generateTagsBtn.disabled ? '無効' : '有効'}`);
            });
        } else {
            console.warn('感想入力の必要な要素が見つかりません:', {
                feelingsInput: !!feelingsInput,
                charCountElement: !!charCountElement,
                generateTagsBtn: !!generateTagsBtn
            });
        }

        // タグ生成ボタン（重複防止のため、onclickで設定）
        if (generateTagsBtn) {
            // onclickは常に1つだけなので重複しない
            generateTagsBtn.onclick = () => {
                console.log('タグ生成ボタンがクリックされました');
                this.generateInsightTags();
            };
        } else {
            console.warn('generate-tags-btn要素が見つかりません');
        }

        // タグ再生成ボタン
        const regenerateTagsBtn = document.getElementById('regenerate-tags-btn');
        if (regenerateTagsBtn) {
            regenerateTagsBtn.onclick = () => {
                console.log('タグ再生成ボタンがクリックされました');
                this.generateInsightTags();
            };
        }

        // タグ採用ボタン
        const acceptTagsBtn = document.getElementById('accept-tags-btn');
        if (acceptTagsBtn) {
            acceptTagsBtn.addEventListener('click', () => {
                this.acceptGeneratedTags();
            });
        }

        // タグクリアボタン
        const clearTagsBtn = document.getElementById('clear-tags-btn');
        if (clearTagsBtn) {
            clearTagsBtn.addEventListener('click', () => {
                this.clearGeneratedTags();
            });
        }

        // タグ編集ボタン
        const editTagsBtn = document.getElementById('edit-tags-btn');
        if (editTagsBtn) {
            editTagsBtn.addEventListener('click', () => {
                this.editFinalTags();
            });
        }
    }

    // 気づきタグ生成
    async generateInsightTags() {
        // 多重実行を防止
        if (this._isGeneratingTags) {
            console.warn('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> タグ生成は既に実行中です');
            return;
        }
        
        const feelingsInput = document.getElementById('match-feelings');
        // クローンで置き換えた後も正しく取得できるように、毎回DOMから取得
        const generateBtn = document.getElementById('generate-tags-btn');
        const analysisSource = document.querySelector('input[name="analysis-source"]:checked');

        if (!feelingsInput || !feelingsInput.value.trim()) {
            this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> 感想を入力してください', 'error');
            return;
        }
        if (!this.geminiService) {
            this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> AIサービスが初期化されていません', 'error');
            return;
        }
        if (!analysisSource) {
            this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> 情報ソースを選択してください', 'error');
            return;
        }

        let fileContent = null;
        let analysisMode = 'browsing';

        try {
            this._isGeneratingTags = true; // フラグを立てる
            if (generateBtn) {
                generateBtn.disabled = true;
                generateBtn.textContent = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg> 分析中...';
            }

            if (analysisSource.value === 'file') {
                analysisMode = 'file';
                
                // ファイルが1件もアップロードされていない場合のバリデーション
                const allFiles = this.getLocalDataSources();
                if (allFiles.length === 0) {
                    throw new Error('アップロードされたファイルがありません。設定ページからファイルをアップロードしてください。');
                }
                
                const selectedCheckboxes = document.querySelectorAll('input[name="source-file"]:checked');

                if (selectedCheckboxes.length === 0) {
                    throw new Error('分析に使用するファイルを1つ以上選択してください。');
                }

                const fileContents = [];
                let totalSize = 0;
                selectedCheckboxes.forEach(checkbox => {
                    const filename = checkbox.value;
                    const content = localStorage.getItem(`datasource-${filename}`);
                    if (content) {
                        fileContents.push(`--- Content from ${filename} ---\n${content}`);
                        totalSize += content.length;
                    }
                });

                if (fileContents.length === 0) {
                    throw new Error('選択されたファイルの読み込みに失敗しました。');
                }

                // ファイルサイズ警告（6000文字制限をユーザーに通知）
                if (totalSize > 6000) {
                    this.showToast(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> 選択されたファイルは${totalSize}文字です。AIの分析には最初の6,000文字のみが使用されます。`, 'warning');
                }

                fileContent = fileContents.join('\n\n');
            }

            // Geminiサービスを使用してタグ生成
            const result = await this.geminiService.generateInsightTags(
                feelingsInput.value.trim(),
                analysisMode,
                fileContent
            );

            // 推敲結果があれば表示
            if (result.refinedContent) {
                this.displayRefinedContent(result.refinedContent);
            }

            // グラウンディングソース情報があれば表示
            if (result.groundingSources) {
                this.displayGroundingSources(result.groundingSources);
            }

            // 生成されたタグを表示
            this.displayGeneratedTags(result.tags);

            // コンテナを表示
            const generatedTagsContainer = document.getElementById('generated-tags-container');
            if (generatedTagsContainer) {
                generatedTagsContainer.style.display = 'block';
            }

            // フォールバックモードかグラウンディング成功かに応じてメッセージを表示
            if (result.fallbackMode) {
                this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 推敲・AI分析を完了しました（通常モード）', 'success');
            } else if (result.groundingSources && result.groundingSources.totalSources > 0) {
                this.showToast(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 推敲・分析完了（参考情報${result.groundingSources.totalSources}件）`, 'success');
            } else {
                this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 推敲・AI分析を完了しました', 'success');
            }

        } catch (error) {
            console.error('タグ生成エラー:', error);
            this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> タグ生成に失敗しました: ' + error.message, 'error');
        } finally {
            this._isGeneratingTags = false; // フラグを解除
            // ボタンを再度取得して状態を更新
            const finalBtn = document.getElementById('generate-tags-btn');
            if (finalBtn) {
                finalBtn.disabled = false;
                finalBtn.textContent = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg> AIでタグ生成';
            }
        }
    }

    // 推敲結果を表示
    displayRefinedContent(refinedContent) {
        // 推敲結果を表示する要素を動的に作成
        let refinedDisplay = document.getElementById('refined-content-display');
        if (!refinedDisplay) {
            refinedDisplay = document.createElement('div');
            refinedDisplay.id = 'refined-content-display';
            refinedDisplay.className = 'refined-content-display';

            // generated-tags-containerの前に挿入
            const generatedContainer = document.getElementById('generated-tags-container');
            generatedContainer.parentNode.insertBefore(refinedDisplay, generatedContainer);
        }

        refinedDisplay.innerHTML = `
            <div class="refined-header">
                <h5><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> AI分析結果</h5>
                <button type="button" class="btn-text" onclick="this.parentElement.parentElement.style.display='none'">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> 閉じる
                </button>
            </div>
            <div class="refined-content">
                <div class="refined-section">
                    <strong>構造化された内容:</strong>
                    <p>${refinedContent.structuredContent}</p>
                </div>
                ${refinedContent.extractedElements && refinedContent.extractedElements.length > 0 ? `
                <div class="refined-section">
                    <strong>抽出された要素:</strong>
                    <ul>
                        ${refinedContent.extractedElements.map(element => `<li>${element}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                ${refinedContent.keyPoints && refinedContent.keyPoints.length > 0 ? `
                <div class="refined-section">
                    <strong>重要ポイント:</strong>
                    <ul>
                        ${refinedContent.keyPoints.map(point => `<li>${point}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
                ${refinedContent.metaInsights && refinedContent.metaInsights.length > 0 ? `
                <div class="refined-section">
                    <strong><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> 最新メタ情報:</strong>
                    <ul>
                        ${refinedContent.metaInsights.map(insight => `<li>${insight}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
        `;

        refinedDisplay.style.display = 'block';
    }

    // 検索ソース情報を表示
    displayGroundingSources(groundingSources) {
        // 検索ソース表示要素を動的に作成
        let sourcesDisplay = document.getElementById('grounding-sources-display');
        if (!sourcesDisplay) {
            sourcesDisplay = document.createElement('div');
            sourcesDisplay.id = 'grounding-sources-display';
            sourcesDisplay.className = 'grounding-sources-display';

            // refined-content-displayの後に挿入
            const refinedDisplay = document.getElementById('refined-content-display');
            if (refinedDisplay) {
                refinedDisplay.parentNode.insertBefore(sourcesDisplay, refinedDisplay.nextSibling);
            } else {
                const generatedContainer = document.getElementById('generated-tags-container');
                generatedContainer.parentNode.insertBefore(sourcesDisplay, generatedContainer);
            }
        }

        sourcesDisplay.innerHTML = `
            <div class="sources-header">
                <h5><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> 参考にした情報源 (${groundingSources.totalSources}件)</h5>
                <button type="button" class="btn-text" onclick="this.parentElement.parentElement.style.display='none'">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> 閉じる
                </button>
            </div>
            <div class="sources-content">
                ${groundingSources.sources.map(source => `
                    <div class="source-item">
                        <div class="source-title">
                            <a href="${source.url}" target="_blank" rel="noopener">
                                ${source.title}
                            </a>
                        </div>
                        ${source.snippet ? `<div class="source-snippet">${source.snippet}</div>` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        sourcesDisplay.style.display = 'block';
    }

    // 生成されたタグを表示
    displayGeneratedTags(tags) {
        const tagsList = document.getElementById('generated-tags-list');
        if (!tagsList) return;

        tagsList.innerHTML = '';

        tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'insight-tag generated-tag';
            tagElement.textContent = tag;
            tagsList.appendChild(tagElement);
        });
    }

    // 生成されたタグを採用
    acceptGeneratedTags() {
        const generatedTags = document.querySelectorAll('#generated-tags-list .generated-tag');
        const tags = Array.from(generatedTags).map(tag => tag.textContent);

        // 最終タグとして設定
        this.setFinalTags(tags);

        // コンテナを切り替え
        document.getElementById('generated-tags-container').style.display = 'none';
        document.getElementById('final-tags-container').style.display = 'block';

        // hiddenフィールドに保存
        document.getElementById('selected-tags').value = tags.join(',');
        document.getElementById('match-feelings-hidden').value = document.getElementById('match-feelings').value;
    }

    // 生成されたタグをクリア
    clearGeneratedTags() {
        document.getElementById('generated-tags-container').style.display = 'none';
        document.getElementById('generated-tags-list').innerHTML = '';
    }

    // 最終タグを設定
    setFinalTags(tags) {
        const finalTagsList = document.getElementById('final-tags-list');
        if (!finalTagsList) return;

        finalTagsList.innerHTML = '';

        tags.forEach(tag => {
            const tagElement = document.createElement('span');
            tagElement.className = 'insight-tag final-tag';
            tagElement.textContent = tag;
            finalTagsList.appendChild(tagElement);
        });
    }

    // 最終タグを編集
    editFinalTags() {
        // 最終タグコンテナを非表示にして生成されたタグコンテナを再表示
        document.getElementById('final-tags-container').style.display = 'none';
        document.getElementById('generated-tags-container').style.display = 'block';

        // hiddenフィールドをクリア
        document.getElementById('selected-tags').value = '';
    }

    resetQuickForm() {
        // 選択状態をリセット
        document.querySelectorAll('.map-option, .agent-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // hidden inputをリセット
        const hiddenInputs = ['selected-map', 'selected-agent', 'selected-tags', 'match-feelings-hidden'];
        hiddenInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });

        // 数値入力をリセット
        const resetValues = {
            'team-score': 0,
            'enemy-score': 0,
            'kills': 0,
            'deaths': 0,
            'assists': 0,
            'acs': 0,
            'adr': 0,
            'hs-percent': 0
        };
        
        Object.entries(resetValues).forEach(([id, value]) => {
            const input = document.getElementById(id);
            if (input) input.value = value;
        });
        
        // ゲームモードを初期状態に戻す
        const competitiveRadio = document.getElementById('mode-competitive');
        if (competitiveRadio) competitiveRadio.checked = true;
        
        // 引き分けチェックボックスを初期化
        const drawCheckbox = document.getElementById('is-draw');
        if (drawCheckbox) drawCheckbox.checked = false;
        
        // 引き分けオプションの表示状態を更新
        this.initializeGameModeHandlers();

        // 気づきタグ関連もリセット
        const feelingsInput = document.getElementById('match-feelings');
        if (feelingsInput) {
            feelingsInput.value = '';
            const charCount = document.getElementById('feelings-char-count');
            if (charCount) charCount.textContent = '0';
        }

        const containers = ['generated-tags-container', 'final-tags-container'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container) container.style.display = 'none';
        });
        
        const generateBtn = document.getElementById('generate-tags-btn');
        if (generateBtn) generateBtn.disabled = true;

        this.updateSubmitButton();
    }
    
    /**
     * エラーメッセージをポップアップで表示する
     * @param {string} message - 表示するエラーメッセージ
     */
    showErrorPopup(message) {
        // 既存のポップアップがあれば削除
        const existingPopup = document.querySelector('.error-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // 新しいポップアップを作成
        const popup = document.createElement('div');
        popup.className = 'error-popup';
        popup.textContent = message;
        document.body.appendChild(popup);

        // 3秒後に自動で消える
        setTimeout(() => {
            popup.classList.add('fade-out');
            setTimeout(() => {
                if (document.body.contains(popup)) {
                    popup.remove();
                }
            }, 300);
        }, 3000);
    }
    
    /**
     * 入力値のバリデーションを実行
     * @returns {object} { isValid: boolean, error: string }
     */
    validateMatchInputs() {
        // フォーム要素の取得
        const killsInput = document.getElementById('kills');
        const deathsInput = document.getElementById('deaths');
        const assistsInput = document.getElementById('assists');
        const myScoreInput = document.getElementById('team-score');
        const opponentScoreInput = document.getElementById('enemy-score');
        const gameModeElement = document.querySelector('input[name="game-mode"]:checked');
        const drawCheckbox = document.getElementById('is-draw');
        
        if (!gameModeElement) {
            return { isValid: false, error: 'ゲームモードが選択されていません。' };
        }
        
        const gameMode = gameModeElement.value;
        const isDraw = drawCheckbox ? drawCheckbox.checked : false;

        // 1. KDAのバリデーション
        const kills = parseInt(killsInput?.value);
        const deaths = parseInt(deathsInput?.value);
        const assists = parseInt(assistsInput?.value);

        if (isNaN(kills) || kills < 0 || !Number.isInteger(kills)) {
            return { isValid: false, error: 'キル数は0以上の整数を入力してください。' };
        }
        if (isNaN(deaths) || deaths < 0 || !Number.isInteger(deaths)) {
            return { isValid: false, error: 'デス数は0以上の整数を入力してください。' };
        }
        if (isNaN(assists) || assists < 0 || !Number.isInteger(assists)) {
            return { isValid: false, error: 'アシスト数は0以上の整数を入力してください。' };
        }

        // 2. スコアのバリデーション
        const myScore = parseInt(myScoreInput?.value);
        const opponentScore = parseInt(opponentScoreInput?.value);

        if (isNaN(myScore) || myScore < 0 || !Number.isInteger(myScore)) {
            return { isValid: false, error: '自チームのスコアは0以上の整数を入力してください。' };
        }
        if (isNaN(opponentScore) || opponentScore < 0 || !Number.isInteger(opponentScore)) {
            return { isValid: false, error: '相手チームのスコアは0以上の整数を入力してください。' };
        }

        // 3. ゲームモード別のスコアルール
        if (gameMode === 'competitive') {
            return this.validateCompetitiveScore(myScore, opponentScore, isDraw);
        } else if (gameMode === 'unrated') {
            return this.validateUnratedScore(myScore, opponentScore);
        }

        return { isValid: true, error: '' };
    }

    /**
     * コンペティティブモードのスコアバリデーション
     */
    validateCompetitiveScore(myScore, opponentScore, isDraw) {
        // 引き分けの場合
        if (isDraw) {
            if (myScore !== opponentScore) {
                return { isValid: false, error: '引き分けの場合、両チームのスコアは同じである必要があります。' };
            }
            if (myScore < 12) {
                return { isValid: false, error: '引き分けの場合、スコアは12点以上である必要があります。' };
            }
            return { isValid: true, error: '' };
        }

        // 勝ち/負けの場合
        const winScore = Math.max(myScore, opponentScore);
        const loseScore = Math.min(myScore, opponentScore);

        // 13点での勝利の場合
        if (winScore === 13) {
            if (loseScore > 11) {
                return { isValid: false, error: 'コンペティティブで13点勝利の場合、相手スコアは11点以下である必要があります。' };
            }
        }
        // 14点以上での勝利の場合
        else if (winScore >= 14) {
            const scoreDiff = winScore - loseScore;
            if (scoreDiff !== 2) {
                return { isValid: false, error: 'コンペティティブで14点以上の勝利の場合、2点差である必要があります。' };
            }
        }
        // 13点未満の場合は無効
        else {
            return { isValid: false, error: 'コンペティティブでは最低13点必要です。' };
        }

        return { isValid: true, error: '' };
    }

    /**
     * アンレートモードのスコアバリデーション
     */
    validateUnratedScore(myScore, opponentScore) {
        const winScore = Math.max(myScore, opponentScore);
        const loseScore = Math.min(myScore, opponentScore);

        // 引き分けは無効
        if (myScore === opponentScore) {
            return { isValid: false, error: 'アンレートでは引き分けはありません。' };
        }

        // 13点での勝利
        if (winScore === 13) {
            // 13-11以下、または13-12は有効
            if (loseScore <= 12) {
                return { isValid: true, error: '' };
            }
        }
        // 14点以上は延長戦なので無効
        else if (winScore >= 14) {
            return { isValid: false, error: 'アンレートでは延長戦(14点以上)はありません。' };
        }
        // 13点未満は無効
        else {
            return { isValid: false, error: 'アンレートでは最低13点必要です。' };
        }

        return { isValid: false, error: '無効なスコアです。アンレートでは13点で終了します。' };
    }

    // クイック試合入力の送信処理
    handleQuickMatchSubmit() {
        // バリデーション実行
        const validation = this.validateMatchInputs();
        
        if (!validation.isValid) {
            // エラーがある場合、ポップアップを表示して処理を中断
            this.showErrorPopup(validation.error);
            return;
        }
        
        const map = document.getElementById('selected-map').value;
        const agent = document.getElementById('selected-agent').value;
        const teamScore = parseInt(document.getElementById('team-score').value);
        const enemyScore = parseInt(document.getElementById('enemy-score').value);
        const kills = parseInt(document.getElementById('kills').value);
        const deaths = parseInt(document.getElementById('deaths').value);
        const assists = parseInt(document.getElementById('assists').value);
        const acs = parseInt(document.getElementById('acs').value || 0);
        const adr = parseInt(document.getElementById('adr').value || 0);
        const hsPercent = parseFloat(document.getElementById('hs-percent').value || 0);
        const feelings = document.getElementById('match-feelings').value || '';
        const tagsInput = document.getElementById('selected-tags').value;
        const insightTags = tagsInput ? tagsInput.split(',').filter(tag => tag.trim()) : [];

        // 試合結果を判定
        const result = teamScore > enemyScore ? 'WIN' : teamScore < enemyScore ? 'LOSS' : 'DRAW';

        // VALORANT用試合データオブジェクト
        const matchData = {
            id: `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            date: new Date().toLocaleDateString('ja-JP'),
            map: map,
            agent: agent,
            score: `${teamScore}-${enemyScore}`,
            teamScore: teamScore,
            enemyScore: enemyScore,
            result: result,
            kills: kills,
            deaths: deaths,
            assists: assists,
            kda: deaths > 0 ? ((kills + assists) / deaths).toFixed(2) : kills + assists,
            acs: acs,
            adr: adr,
            hsPercent: hsPercent,
            feelings: feelings,
            insightTags: insightTags,
            source: 'quick_input'
        };

        // データを保存
        this.storeValorantMatch(matchData);

        // 連勝記録を更新
        this.updateWinStreak(matchData.result);

        // フォームをリセット
        this.resetQuickForm();

        this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> VALORANT試合データを記録しました！', 'success');

        // ダッシュボードを更新
        if (this.currentPage === 'dashboard') {
            this.loadDashboard();
        }

        // ギャラリーを更新
        if (this.currentPage === 'gallery') {
            this.loadGallery();
        }
    }

    // VALORANT試合データを保存
    storeValorantMatch(matchData) {
        try {
            // 既存のデータを取得
            const existingMatches = JSON.parse(localStorage.getItem('valorant_matches') || '[]');
            
            // 新しい試合データを追加
            existingMatches.unshift(matchData);
            
            // ローカルストレージに保存
            localStorage.setItem('valorant_matches', JSON.stringify(existingMatches));
            
            console.log('VALORANT試合データを保存しました:', matchData);
        } catch (error) {
            console.error('試合データの保存に失敗しました:', error);
            this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> データの保存に失敗しました', 'error');
        }
    }

    // 分析ページの入力をローカルに保存し、ダッシュボードを更新
    storeMatchAndRefresh(matchData) {
        try {
            // 保存フォーマットへ整形（キャラクター・ラウンド情報のみ）
            const newMatch = {
                id: Date.now(),
                result: matchData.result || 'WIN',
                character: matchData.character || 'Unknown',
                // キャラクター・ラウンド結果指標
                playerCharacter: matchData.playerCharacter || 'Unknown',
                opponentCharacter: matchData.opponentCharacter || 'Unknown',
                roundsWon: matchData.roundsWon || 0,
                roundsLost: matchData.roundsLost || 0,
                rounds: `${matchData.roundsWon || 0}-${matchData.roundsLost || 0}`,
                duration: matchData.duration || 1,
                date: new Date().toISOString().split('T')[0],
                gameMode: 'Ranked'
            };

            // 直近試合へ追加（最大50件）
            const matches = JSON.parse(localStorage.getItem('recentMatches') || '[]');
            matches.unshift(newMatch);
            if (matches.length > 50) matches.length = 50;
            localStorage.setItem('recentMatches', JSON.stringify(matches));
            
            // valorant_galleryにも保存（統一ストレージ）
            const galleryData = JSON.parse(localStorage.getItem('valorant_gallery') || '[]');
            galleryData.unshift(newMatch);
            localStorage.setItem('valorant_gallery', JSON.stringify(galleryData));

            // 基本統計の計算（勝率のみ）
            const totalMatches = matches.length;
            const wins = matches.filter(m => (m.result || '').toUpperCase() === 'WIN').length;
            const winRate = totalMatches ? +(((wins / totalMatches) * 100).toFixed(1)) : 0;

            const updatedStats = {
                winRate,
                gamesPlayed: totalMatches
            };

            if (this.playerStatsManager) {
                this.playerStatsManager.savePlayerStats(updatedStats);
                // UIを即時更新
                this.playerStatsManager.loadStatsToUI();
                this.playerStatsManager.loadRecentMatches();
            } else {
                localStorage.setItem('playerStats', JSON.stringify(updatedStats));
                this.loadRecentMatches();
                // 手動でUIへ反映
                const winRateEl = document.getElementById('win-rate');
                const gamesPlayedEl = document.getElementById('games-played');
                if (winRateEl) winRateEl.textContent = `${winRate}%`;
                if (gamesPlayedEl) gamesPlayedEl.textContent = `${totalMatches}`;
            }

            // キャッシュを無効化して、グラフを更新（デバウンス版を使用）
            this.cachedMatchData = null;
            this.scheduleChartUpdate();
        } catch (e) {
            console.warn('Failed to store match and refresh stats:', e);
        }
    }
    
    // API設定保存
    handleApiSave() {
        const provider = document.getElementById('api-provider').value;
        const apiKey = document.getElementById('api-key').value;
        const model = document.getElementById('api-model').value;
        
        if (this.aiService) {
            this.aiService.saveConfiguration(provider, apiKey, model);
        } else {
            localStorage.setItem('ai_provider', provider);
            localStorage.setItem('ai_api_key', apiKey);
            localStorage.setItem('ai_model', model);
        }
        
        this.updateApiStatus(true);
        this.showToast('API設定を保存しました', 'success');
    }
    
    // API接続テスト
    async testApiConnection() {
        this.showLoading();
        
        setTimeout(() => {
            this.hideLoading();
            if (Math.random() > 0.5) {
                this.showToast('API接続成功', 'success');
            } else {
                this.showToast('API接続失敗: キーを確認してください', 'error');
            }
        }, 1000);
    }
    
    // API設定クリア
    clearApiSettings() {
        if (this.aiService) {
            this.aiService.clearConfiguration();
        } else {
            localStorage.removeItem('ai_provider');
            localStorage.removeItem('ai_api_key');
            localStorage.removeItem('ai_model');
        }
        
        document.getElementById('api-key').value = '';
        this.updateApiStatus(false);
        this.showToast('API設定をクリアしました', 'info');
    }
    
    // API状態更新
    updateApiStatus(isConfigured) {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        
        if (statusIndicator && statusText) {
            if (isConfigured) {
                statusIndicator.classList.remove('offline');
                statusIndicator.classList.add('online');
                statusText.textContent = 'API設定済み';
            } else {
                statusIndicator.classList.remove('online');
                statusIndicator.classList.add('offline');
                statusText.textContent = 'API未設定';
            }
        }
    }
    
    // パフォーマンス最適化: マッチデータを読み込んでキャッシュ
    loadMatchDataWithCache(forceReload = false) {
        const now = Date.now();
        
        // キャッシュが有効で強制リロードでない場合はキャッシュを返す
        if (!forceReload && this.cachedMatchData && (now - this.lastDataLoadTime) < this.DATA_CACHE_TTL) {
            return this.cachedMatchData;
        }
        
        // localStorageから全データを読み込み
        const valorantGallery = JSON.parse(localStorage.getItem('valorant_gallery') || '[]');
        const sf6Gallery = JSON.parse(localStorage.getItem('sf6_gallery') || '[]');
        const recentMatches = JSON.parse(localStorage.getItem('recentMatches') || '[]');
        const valorantMatches = JSON.parse(localStorage.getItem('valorant_matches') || '[]');
        
        // 重複を排除してマージ
        const matchesMap = new Map();
        [...valorantGallery, ...sf6Gallery, ...recentMatches, ...valorantMatches].forEach(match => {
            if (match.id) {
                matchesMap.set(match.id, match);
            }
        });
        
        const matches = Array.from(matchesMap.values());
        
        // キャッシュを更新
        this.cachedMatchData = matches;
        this.lastDataLoadTime = now;
        
        return matches;
    }
    
    // チャート更新をデバウンス（連続呼び出しを制限）
    scheduleChartUpdate() {
        // 既存のタイマーをクリア
        if (this.chartUpdateTimer) {
            clearTimeout(this.chartUpdateTimer);
        }
        
        // 新しいタイマーを設定（300ms後に実行）
        this.chartUpdateTimer = setTimeout(() => {
            this.renderWinRateTrendChart();
            this.renderCharacterUsageChart();
            this.chartUpdateTimer = null;
        }, 300);
    }
    
    // チャート初期化
    initCharts() {
        // ダッシュボードページに遷移した時にグラフを描画
        this.renderWinRateTrendChart();
        this.renderCharacterUsageChart();
    }

    // 勝率トレンドグラフの描画
    renderWinRateTrendChart() {
        const canvas = document.getElementById('performance-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // 既存のチャートを破棄
        if (this.winRateTrendChart) {
            this.winRateTrendChart.destroy();
        }

        // パフォーマンス最適化: キャッシュからデータを取得
        const allMatches = this.loadMatchDataWithCache();
        
        // 新しい順にソート
        const matches = allMatches.sort((a, b) => (b.id || 0) - (a.id || 0));

        if (matches.length === 0) {
            // データがない場合は空のグラフを表示
            ctx.font = '20px sans-serif';
            ctx.fillStyle = '#e94560';
            ctx.textAlign = 'center';
            ctx.fillText('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 記録しよう！', canvas.width / 2, canvas.height / 2);
            return;
        }

        // 直近10試合ごとの勝率推移を計算（最大50試合 = 5区間）
        const batchSize = 10;
        const maxBatches = 5; // 最大5区間（50試合分）
        const batches = [];
        const matchesToProcess = Math.min(matches.length, batchSize * maxBatches);
        
        for (let i = 0; i < matchesToProcess; i += batchSize) {
            const batch = matches.slice(i, i + batchSize);
            const wins = batch.filter(m => (m.result || '').toUpperCase() === 'WIN').length;
            const winRate = (wins / batch.length * 100).toFixed(1);
            
            // より読みやすいラベル形式
            let label;
            if (i === 0) {
                label = '直近10試合';
            } else {
                const startMatch = i + 1;
                const endMatch = i + 10;
                label = `${startMatch}-${endMatch}試合前`;
            }
            
            batches.push({
                label: label,
                winRate: parseFloat(winRate)
            });
        }
        
        // データを古い順にするため反転（グラフで左から右への推移を表現）
        batches.reverse();

        // グラフの描画 - 勝率推移を折れ線グラフで表示
        this.winRateTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: batches.map(b => b.label),
                datasets: [{
                    label: '勝率',
                    data: batches.map(b => b.winRate),
                    backgroundColor: 'rgba(54, 162, 235, 0.2)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBackgroundColor: 'rgba(54, 162, 235, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverBackgroundColor: 'rgba(54, 162, 235, 1)',
                    pointHoverBorderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 1.5,
                layout: {
                    padding: {
                        top: 10,
                        bottom: 20,
                        left: 10,
                        right: 10
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#fff',
                            font: {
                                size: 13,
                                weight: '600'
                            },
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    title: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        padding: 12,
                        titleFont: {
                            size: 14,
                            weight: '600'
                        },
                        bodyFont: {
                            size: 13
                        },
                        callbacks: {
                            label: function(context) {
                                return `勝率: ${context.parsed.y}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        suggestedMax: 105,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            },
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#aaa',
                            font: {
                                size: 12
                            },
                            stepSize: 20
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        title: {
                            display: true,
                            text: '勝率 (%)',
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#fff',
                            font: {
                                size: 13,
                                weight: '600'
                            }
                        }
                    },
                    x: {
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-secondary') || '#aaa',
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false,
                            font: {
                                size: 11
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    }
                }
            }
        });

        // 改善ポイントを別で表示
        this.renderChallengePoints(matches);
    }

    // 改善ポイント（課題）の表示
    renderChallengePoints(matches) {
        const container = document.getElementById('challenge-points-content');
        if (!container) return;

        if (matches.length === 0) {
            container.innerHTML = '<p class="no-data-message"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> 記録しよう！</p>';
            return;
        }

        // ステージごとの累計勝率を計算
        const stageStats = {};
        matches.forEach(match => {
            const stage = match.map || 'Unknown';
            if (!stageStats[stage]) {
                stageStats[stage] = { wins: 0, total: 0 };
            }
            stageStats[stage].total++;
            if ((match.result || '').toUpperCase() === 'WIN') {
                stageStats[stage].wins++;
            }
        });

        // エージェント/キャラクターごとの累計勝率を計算
        const agentStats = {};
        matches.forEach(match => {
            const agent = match.agent || match.character || 'Unknown';
            if (!agentStats[agent]) {
                agentStats[agent] = { wins: 0, total: 0 };
            }
            agentStats[agent].total++;
            if ((match.result || '').toUpperCase() === 'WIN') {
                agentStats[agent].wins++;
            }
        });

        // 総試合数が3以上あれば、各項目は1試合以上で表示可能にする
        const minMatchesPerCategory = matches.length >= 3 ? 1 : 3;
        
        // 最も勝率が低いステージを抽出
        let lowestStageWinRate = null;
        if (Object.keys(stageStats).length > 0) {
            const stageWinRateData = Object.entries(stageStats)
                .filter(([_, stats]) => stats.total >= minMatchesPerCategory)
                .map(([stage, stats]) => ({
                    stage,
                    winRate: parseFloat((stats.wins / stats.total * 100).toFixed(1)),
                    wins: stats.wins,
                    total: stats.total
                }));
            
            if (stageWinRateData.length > 0) {
                const minWinRate = Math.min(...stageWinRateData.map(d => d.winRate));
                const lowestWinRateStages = stageWinRateData.filter(d => d.winRate === minWinRate);
                lowestStageWinRate = lowestWinRateStages.sort((a, b) => b.total - a.total)[0];
            }
        }

        // 最も勝率が低いエージェントを抽出
        let lowestAgentWinRate = null;
        if (Object.keys(agentStats).length > 0) {
            const agentWinRateData = Object.entries(agentStats)
                .filter(([_, stats]) => stats.total >= minMatchesPerCategory)
                .map(([agent, stats]) => ({
                    agent,
                    winRate: parseFloat((stats.wins / stats.total * 100).toFixed(1)),
                    wins: stats.wins,
                    total: stats.total
                }));
            
            if (agentWinRateData.length > 0) {
                const minWinRate = Math.min(...agentWinRateData.map(d => d.winRate));
                const lowestWinRateAgents = agentWinRateData.filter(d => d.winRate === minWinRate);
                lowestAgentWinRate = lowestWinRateAgents.sort((a, b) => b.total - a.total)[0];
            }
        }

        // HTMLを生成
        let html = '';

        if (lowestStageWinRate) {
            html += `
                <div class="challenge-item">
                    <div class="challenge-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg></div>
                    <div class="challenge-info">
                        <div class="challenge-label">苦手なマップ</div>
                        <div class="challenge-name">${lowestStageWinRate.stage}</div>
                        <div class="challenge-stats">${lowestStageWinRate.wins}勝 ${lowestStageWinRate.total - lowestStageWinRate.wins}敗 (${lowestStageWinRate.total}試合)</div>
                    </div>
                    <div class="challenge-winrate">
                        <div class="winrate-bar">
                            <div class="winrate-fill" style="width: ${lowestStageWinRate.winRate}%"></div>
                        </div>
                        <div class="winrate-text">${lowestStageWinRate.winRate}%</div>
                    </div>
                </div>
            `;
        }

        if (lowestAgentWinRate) {
            html += `
                <div class="challenge-item">
                    <div class="challenge-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg></div>
                    <div class="challenge-info">
                        <div class="challenge-label">苦手なキャラ/エージェント</div>
                        <div class="challenge-name">${lowestAgentWinRate.agent}</div>
                        <div class="challenge-stats">${lowestAgentWinRate.wins}勝 ${lowestAgentWinRate.total - lowestAgentWinRate.wins}敗 (${lowestAgentWinRate.total}試合)</div>
                    </div>
                    <div class="challenge-winrate">
                        <div class="winrate-bar">
                            <div class="winrate-fill" style="width: ${lowestAgentWinRate.winRate}%"></div>
                        </div>
                        <div class="winrate-text">${lowestAgentWinRate.winRate}%</div>
                    </div>
                </div>
            `;
        }

        if (!html) {
            html = '<p class="no-data-message">十分なデータがありません<br><small>各項目3試合以上で表示されます</small></p>';
        }

        container.innerHTML = html;
    }

    // キャラクター使用率グラフの描画
    renderCharacterUsageChart() {
        const canvas = document.getElementById('valorant-metrics-chart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        // 既存のチャートを破棄
        if (this.characterUsageChart) {
            this.characterUsageChart.destroy();
        }

        // パフォーマンス最適化: キャッシュからデータを取得
        const matches = this.loadMatchDataWithCache();

        if (matches.length === 0) {
            // データがない場合は空のグラフを表示
            ctx.font = '16px sans-serif';
            ctx.fillStyle = '#888';
            ctx.textAlign = 'center';
            ctx.fillText('試合データがまだありません', canvas.width / 2, canvas.height / 2);
            return;
        }

        // キャラクター使用率を計算
        const characterUsage = {};
        matches.forEach(match => {
            // agent プロパティも認識するように修正
            const character = match.agent || match.playerCharacter || match.character || 'Unknown';
            if (!characterUsage[character]) {
                characterUsage[character] = 0;
            }
            characterUsage[character]++;
        });

        // 使用率を計算してソート
        const characterData = Object.entries(characterUsage)
            .map(([character, count]) => ({
                character,
                count,
                percentage: ((count / matches.length) * 100).toFixed(1)
            }))
            .sort((a, b) => b.count - a.count);

        // 現在のテーマを取得（ライトモードかダークモードか）
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const isDarkMode = currentTheme === 'dark';
        
        // テーマに応じた色設定（より明確なコントラスト）
        const textColor = isDarkMode ? '#ffffff' : '#000000';
        const backgroundColor = isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.95)';

        console.log('グラフ描画 - テーマ:', currentTheme, '文字色:', textColor);

        // グラフの描画
        this.characterUsageChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: characterData.map(c => c.character),
                datasets: [{
                    label: '使用回数',
                    data: characterData.map(c => c.count),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.7)',
                        'rgba(54, 162, 235, 0.7)',
                        'rgba(255, 206, 86, 0.7)',
                        'rgba(75, 192, 192, 0.7)',
                        'rgba(153, 102, 255, 0.7)',
                        'rgba(255, 159, 64, 0.7)',
                        'rgba(201, 203, 207, 0.7)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(201, 203, 207, 1)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'right',
                        labels: {
                            color: textColor,  // 明示的なテーマ対応の色
                            font: {
                                size: 13,
                                weight: '500'
                            },
                            padding: 10,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            generateLabels: function(chart) {
                                const data = chart.data;
                                if (data.labels.length && data.datasets.length) {
                                    return data.labels.map((label, i) => {
                                        const value = data.datasets[0].data[i];
                                        const percentage = ((value / matches.length) * 100).toFixed(1);
                                        return {
                                            text: `${label}: ${percentage}% (${value}回)`,
                                            fillStyle: data.datasets[0].backgroundColor[i],
                                            strokeStyle: data.datasets[0].borderColor[i],
                                            lineWidth: 2,
                                            hidden: !chart.getDataVisibility(i),
                                            index: i,
                                            fontColor: textColor  // 追加の色指定
                                        };
                                    });
                                }
                                return [];
                            }
                        }
                    },
                    title: {
                        display: false  // HTMLタイトルを使用
                    },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.9)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        borderWidth: 1,
                        padding: 12,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const percentage = ((value / matches.length) * 100).toFixed(1);
                                return `${label}: ${value}回 (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        console.log('キャラクター使用率グラフ描画完了');
    }

    // 勝率詳細モーダルを表示（RPGウィンドウシステムに変更）
    showWinRateDetailModal() {
        // 既存のモーダルを隠す
        const oldModal = document.getElementById('winrate-detail-modal');
        if (oldModal) {
            oldModal.style.display = 'none';
        }

        // スタッツデータを取得
        const statsContent = this.generateStatsContent();

        // RPGウィンドウを瞬時に開く
        window.rpgWindowSystem.openWindow('stats-window', statsContent, {
            title: '試合成績スコア',
            width: '700px',
            height: '500px',
            centered: true,
            closable: true
        });
    }
    
    // スタッツコンテンツを生成
    generateStatsContent() {
        const matches = this.getMatchesData();
        
        if (matches.length === 0) {
            return `
                <div style="text-align: center; padding: 40px;">
                    <p style="font-size: 20px; color: #ffff00;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> まだ試合データがありません</p>
                    <p style="font-size: 16px; color: #fff; margin-top: 20px;">
                        試合を記録して統計を確認しましょう！
                    </p>
                </div>
            `;
        }

        // ステージ別統計を計算
        const stageStats = {};
        matches.forEach(match => {
            const stage = match.map || 'Unknown';
            if (!stageStats[stage]) {
                stageStats[stage] = { wins: 0, losses: 0, total: 0 };
            }
            stageStats[stage].total++;
            if ((match.result || '').toUpperCase() === 'WIN') {
                stageStats[stage].wins++;
            } else {
                stageStats[stage].losses++;
            }
        });

        // エージェント別統計を計算
        const agentStats = {};
        matches.forEach(match => {
            const agent = match.agent || 'Unknown';
            if (!agentStats[agent]) {
                agentStats[agent] = { wins: 0, losses: 0, total: 0 };
            }
            agentStats[agent].total++;
            if ((match.result || '').toUpperCase() === 'WIN') {
                agentStats[agent].wins++;
            } else {
                agentStats[agent].losses++;
            }
        });

        // 対戦キャラクター別統計を計算（既存機能維持）
        const opponentStats = {};
        matches.forEach(match => {
            const opponent = match.opponentCharacter || 'Unknown';
            if (!opponentStats[opponent]) {
                opponentStats[opponent] = { wins: 0, losses: 0, total: 0 };
            }
            opponentStats[opponent].total++;
            if ((match.result || '').toUpperCase() === 'WIN') {
                opponentStats[opponent].wins++;
            } else {
                opponentStats[opponent].losses++;
            }
        });

        // ステージ別データ配列を生成
        const stageData = Object.entries(stageStats).map(([stage, stats]) => ({
            stage,
            winRate: ((stats.wins / stats.total) * 100).toFixed(1),
            total: stats.total,
            wins: stats.wins,
            losses: stats.losses
        }));

        // エージェント別データ配列を生成
        const agentData = Object.entries(agentStats).map(([agent, stats]) => ({
            agent,
            winRate: ((stats.wins / stats.total) * 100).toFixed(1),
            total: stats.total,
            wins: stats.wins,
            losses: stats.losses
        }));

        // 対戦キャラクター別データ配列を生成
        const opponentData = Object.entries(opponentStats).map(([opponent, stats]) => ({
            opponent,
            winRate: ((stats.wins / stats.total) * 100).toFixed(1),
            total: stats.total,
            wins: stats.wins,
            losses: stats.losses
        }));

        return `
            <div class="rpg-stats-section" style="max-height: 600px; overflow-y: auto;">
                <!-- ステージ別勝率テーブル -->
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #ffff00; margin-bottom: 15px; font-size: 18px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> ステージ別勝率</h3>
                    <table class="stats-table" id="stage-stats-table" style="width: 100%; border-collapse: collapse; background: rgba(0, 0, 0, 0.3);">
                        <thead>
                            <tr style="background: rgba(255, 255, 255, 0.1); border-bottom: 2px solid #ffff00;">
                                <th style="padding: 10px; text-align: left; cursor: pointer; user-select: none;" data-sort="stage">
                                    ステージ名 <span class="sort-indicator">▼</span>
                                </th>
                                <th style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" data-sort="winRate">
                                    勝率(%) <span class="sort-indicator"></span>
                                </th>
                                <th style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" data-sort="total">
                                    試合数 <span class="sort-indicator"></span>
                                </th>
                                <th style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" data-sort="wins">
                                    勝利数 <span class="sort-indicator"></span>
                                </th>
                                <th style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" data-sort="losses">
                                    敗北数 <span class="sort-indicator"></span>
                                </th>
                            </tr>
                        </thead>
                        <tbody id="stage-stats-tbody">
                            ${stageData.map(data => `
                                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                                    <td style="padding: 10px; color: #fff;">${data.stage}</td>
                                    <td style="padding: 10px; text-align: center; color: #00ff00; font-weight: bold;">${data.winRate}%</td>
                                    <td style="padding: 10px; text-align: center; color: #fff;">${data.total}</td>
                                    <td style="padding: 10px; text-align: center; color: #00ff00;">${data.wins}</td>
                                    <td style="padding: 10px; text-align: center; color: #ff0000;">${data.losses}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- エージェント別勝率テーブル -->
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #ffff00; margin-bottom: 15px; font-size: 18px;">🎭 エージェント別勝率</h3>
                    <table class="stats-table" id="agent-stats-table" style="width: 100%; border-collapse: collapse; background: rgba(0, 0, 0, 0.3);">
                        <thead>
                            <tr style="background: rgba(255, 255, 255, 0.1); border-bottom: 2px solid #ffff00;">
                                <th style="padding: 10px; text-align: left; cursor: pointer; user-select: none;" data-sort="agent">
                                    エージェント名 <span class="sort-indicator">▼</span>
                                </th>
                                <th style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" data-sort="winRate">
                                    勝率(%) <span class="sort-indicator"></span>
                                </th>
                                <th style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" data-sort="total">
                                    試合数 <span class="sort-indicator"></span>
                                </th>
                                <th style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" data-sort="wins">
                                    勝利数 <span class="sort-indicator"></span>
                                </th>
                                <th style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" data-sort="losses">
                                    敗北数 <span class="sort-indicator"></span>
                                </th>
                            </tr>
                        </thead>
                        <tbody id="agent-stats-tbody">
                            ${agentData.map(data => `
                                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                                    <td style="padding: 10px; color: #fff;">${data.agent}</td>
                                    <td style="padding: 10px; text-align: center; color: #00ff00; font-weight: bold;">${data.winRate}%</td>
                                    <td style="padding: 10px; text-align: center; color: #fff;">${data.total}</td>
                                    <td style="padding: 10px; text-align: center; color: #00ff00;">${data.wins}</td>
                                    <td style="padding: 10px; text-align: center; color: #ff0000;">${data.losses}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- 対戦キャラクター別勝率テーブル（既存機能維持） -->
                <div style="margin-bottom: 30px;">
                    <h3 style="color: #ffff00; margin-bottom: 15px; font-size: 18px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="4" y2="20"/><line x1="3" y1="19" x2="5" y2="21"/></svg> 対戦キャラクター別勝率</h3>
                    <table class="stats-table" id="opponent-stats-table" style="width: 100%; border-collapse: collapse; background: rgba(0, 0, 0, 0.3);">
                        <thead>
                            <tr style="background: rgba(255, 255, 255, 0.1); border-bottom: 2px solid #ffff00;">
                                <th style="padding: 10px; text-align: left; cursor: pointer; user-select: none;" data-sort="opponent">
                                    キャラクター名 <span class="sort-indicator">▼</span>
                                </th>
                                <th style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" data-sort="winRate">
                                    勝率(%) <span class="sort-indicator"></span>
                                </th>
                                <th style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" data-sort="total">
                                    試合数 <span class="sort-indicator"></span>
                                </th>
                                <th style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" data-sort="wins">
                                    勝利数 <span class="sort-indicator"></span>
                                </th>
                                <th style="padding: 10px; text-align: center; cursor: pointer; user-select: none;" data-sort="losses">
                                    敗北数 <span class="sort-indicator"></span>
                                </th>
                            </tr>
                        </thead>
                        <tbody id="opponent-stats-tbody">
                            ${opponentData.map(data => `
                                <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                                    <td style="padding: 10px; color: #fff;">${data.opponent}</td>
                                    <td style="padding: 10px; text-align: center; color: #00ff00; font-weight: bold;">${data.winRate}%</td>
                                    <td style="padding: 10px; text-align: center; color: #fff;">${data.total}</td>
                                    <td style="padding: 10px; text-align: center; color: #00ff00;">${data.wins}</td>
                                    <td style="padding: 10px; text-align: center; color: #ff0000;">${data.losses}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <script>
                // テーブルソート機能を追加
                (function() {
                    const tables = ['stage-stats-table', 'agent-stats-table', 'opponent-stats-table'];
                    
                    tables.forEach(tableId => {
                        const table = document.getElementById(tableId);
                        if (!table) return;
                        
                        const headers = table.querySelectorAll('thead th[data-sort]');
                        const tbody = table.querySelector('tbody');
                        
                        let currentSort = { column: null, ascending: true };
                        
                        headers.forEach(header => {
                            header.addEventListener('click', function() {
                                const sortBy = this.getAttribute('data-sort');
                                const isAscending = currentSort.column === sortBy ? !currentSort.ascending : true;
                                
                                currentSort = { column: sortBy, ascending: isAscending };
                                
                                // すべてのインジケーターをリセット
                                headers.forEach(h => {
                                    h.querySelector('.sort-indicator').textContent = '';
                                });
                                
                                // 現在のソートインジケーターを設定
                                this.querySelector('.sort-indicator').textContent = isAscending ? '▲' : '▼';
                                
                                // 行を配列に変換
                                const rows = Array.from(tbody.querySelectorAll('tr'));
                                
                                // ソート
                                rows.sort((a, b) => {
                                    let aVal, bVal;
                                    const cellIndex = Array.from(headers).indexOf(this);
                                    
                                    if (sortBy === 'winRate' || sortBy === 'total' || sortBy === 'wins' || sortBy === 'losses') {
                                        aVal = parseFloat(a.children[cellIndex].textContent) || 0;
                                        bVal = parseFloat(b.children[cellIndex].textContent) || 0;
                                    } else {
                                        aVal = a.children[cellIndex].textContent.toLowerCase();
                                        bVal = b.children[cellIndex].textContent.toLowerCase();
                                    }
                                    
                                    if (aVal < bVal) return isAscending ? -1 : 1;
                                    if (aVal > bVal) return isAscending ? 1 : -1;
                                    return 0;
                                });
                                
                                // 再描画
                                rows.forEach(row => tbody.appendChild(row));
                            });
                        });
                    });
                })();
            </script>
        `;
    }
    
    // 試合データを取得するヘルパーメソッド
    getMatchesData() {
        // パフォーマンス最適化: キャッシュを使用
        return this.loadMatchDataWithCache().sort((a, b) => (b.id || 0) - (a.id || 0));
    }

    // 勝率詳細モーダルを閉じる
    closeWinRateDetailModal() {
        const modal = document.getElementById('winrate-detail-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // 勝率詳細データを読み込む
    loadWinRateDetailData() {
        // パフォーマンス最適化: キャッシュからデータを取得
        const matches = this.loadMatchDataWithCache();

        if (matches.length === 0) {
            document.getElementById('opponent-stats-list').innerHTML = '<p class="no-data">試合データがありません</p>';
            return;
        }

        // 対戦キャラクターごとの統計を計算
        const opponentStats = {};
        matches.forEach(match => {
            const opponent = match.opponentCharacter || 'Unknown';
            if (!opponentStats[opponent]) {
                opponentStats[opponent] = { wins: 0, losses: 0, total: 0 };
            }
            opponentStats[opponent].total++;
            if ((match.result || '').toUpperCase() === 'WIN') {
                opponentStats[opponent].wins++;
            } else {
                opponentStats[opponent].losses++;
            }
        });

        // 統計データを配列に変換
        this.opponentStatsData = Object.entries(opponentStats).map(([opponent, stats]) => ({
            opponent,
            wins: stats.wins,
            losses: stats.losses,
            total: stats.total,
            winRate: stats.total > 0 ? (stats.wins / stats.total * 100).toFixed(1) : 0
        }));

        // サマリー情報を更新
        const totalMatches = matches.length;
        const uniqueOpponents = this.opponentStatsData.length;
        const totalWins = matches.filter(m => (m.result || '').toUpperCase() === 'WIN').length;
        const overallWinRate = totalMatches > 0 ? (totalWins / totalMatches * 100).toFixed(1) : 0;

        document.getElementById('detail-total-matches').textContent = totalMatches;
        document.getElementById('detail-unique-opponents').textContent = uniqueOpponents;
        document.getElementById('detail-overall-winrate').textContent = overallWinRate + '%';

        // 初期表示
        this.renderOpponentStatsList();

        // ソート・フィルターのイベントリスナー
        this.setupDetailControls();
    }

    // 詳細コントロールのイベントリスナーを設定
    setupDetailControls() {
        const sortSelect = document.getElementById('sort-by');
        const minMatchesInput = document.getElementById('min-matches');

        if (sortSelect && !sortSelect.hasAttribute('data-listener-added')) {
            sortSelect.addEventListener('change', () => this.renderOpponentStatsList());
            sortSelect.setAttribute('data-listener-added', 'true');
        }

        if (minMatchesInput && !minMatchesInput.hasAttribute('data-listener-added')) {
            minMatchesInput.addEventListener('input', () => this.renderOpponentStatsList());
            minMatchesInput.setAttribute('data-listener-added', 'true');
        }
    }

    // 対戦キャラクター別統計リストを描画
    renderOpponentStatsList() {
        const container = document.getElementById('opponent-stats-list');
        if (!container || !this.opponentStatsData) return;

        // フィルター条件を取得
        const minMatches = parseInt(document.getElementById('min-matches').value) || 0;
        const sortBy = document.getElementById('sort-by').value;

        // フィルター適用
        let filteredData = this.opponentStatsData.filter(stat => stat.total >= minMatches);

        // ソート適用
        switch (sortBy) {
            case 'matches-desc':
                filteredData.sort((a, b) => b.total - a.total);
                break;
            case 'matches-asc':
                filteredData.sort((a, b) => a.total - b.total);
                break;
            case 'winrate-desc':
                filteredData.sort((a, b) => parseFloat(b.winRate) - parseFloat(a.winRate));
                break;
            case 'winrate-asc':
                filteredData.sort((a, b) => parseFloat(a.winRate) - parseFloat(b.winRate));
                break;
            case 'name-asc':
                filteredData.sort((a, b) => a.opponent.localeCompare(b.opponent));
                break;
        }

        // リストを描画
        if (filteredData.length === 0) {
            container.innerHTML = '<p class="no-data">条件に一致するデータがありません</p>';
            return;
        }

        container.innerHTML = filteredData.map(stat => {
            const winRateValue = parseFloat(stat.winRate);
            const winRateClass = winRateValue >= 60 ? 'high' : winRateValue >= 40 ? 'medium' : 'low';
            
            return `
                <div class="opponent-stat-item">
                    <div class="opponent-header">
                        <span class="opponent-name">${stat.opponent}</span>
                        <span class="opponent-winrate ${winRateClass}">${stat.winRate}%</span>
                    </div>
                    <div class="opponent-details">
                        <span class="stat-detail">試合数: ${stat.total}</span>
                        <span class="stat-detail wins">${stat.wins}勝</span>
                        <span class="stat-detail losses">${stat.losses}敗</span>
                    </div>
                    <div class="winrate-bar">
                        <div class="winrate-fill ${winRateClass}" style="width: ${stat.winRate}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 勝率データをエクスポート
    exportWinRateData() {
        if (!this.opponentStatsData || this.opponentStatsData.length === 0) {
            this.showToast('エクスポートするデータがありません', 'warning');
            return;
        }

        // CSV形式でエクスポート
        let csv = 'キャラクター,試合数,勝利数,敗北数,勝率(%)\n';
        this.opponentStatsData.forEach(stat => {
            csv += `${stat.opponent},${stat.total},${stat.wins},${stat.losses},${stat.winRate}\n`;
        });

        // ダウンロード
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `対戦キャラクター別勝率_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToast('データをエクスポートしました', 'success');
    }
    
    // トースト表示
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
    
    // ローディング表示（任意メッセージ対応）
    showLoading(message = 'ロード中...') {
        // テキストを更新（重複IDに対応して全て更新）
        try {
            const msgNodes = document.querySelectorAll('#loading .loading-content p');
            if (msgNodes && msgNodes.length > 0) {
                msgNodes.forEach(p => p.textContent = message);
            }
        } catch (e) {
            console.debug('loading message update skipped:', e);
        }

        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.remove('hidden');
        }
    }
    
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.classList.add('hidden');
        }
    }
    
    // 各ページのロード処理
    async loadDashboard() {
        // ギャラリーを読み込み（valorant-stats.jsonから自動取得）
        await this.renderDashboardGallery();

        // 新しい統計システムを使用
        if (this.playerStatsManager) {
            this.playerStatsManager.loadStatsToUI();
        }

        // ダッシュボード目標を読み込み
        this.loadDashboardGoals();

        // グラフを描画（デバウンスを使用してパフォーマンス向上）
        this.scheduleChartUpdate();
    }
    
    loadAnalysis() {
        const sourceRadios = document.querySelectorAll('input[name="analysis-source"]');
        const fileRadio = document.getElementById('source-file-radio');
        const fileSelectorContainer = document.getElementById('source-file-selector-container');
        const fileListContainer = document.getElementById('source-file-list');

        const files = this.getLocalDataSources();

        // ファイルラジオボタンは常に有効
        fileRadio.disabled = false;

        if (files.length > 0) {
            // "Select All" checkbox
            const selectAllHtml = `
                <div class="checkbox-item">
                    <input type="checkbox" id="select-all-files">
                    <label for="select-all-files">すべてのファイルを選択</label>
                </div>
            `;

            // File checkboxes
            const filesHtml = files.map(f => `
                <div class="checkbox-item">
                    <input type="checkbox" id="file-${f}" value="${f}" name="source-file">
                    <label for="file-${f}">${f}</label>
                </div>
            `).join('');

            fileListContainer.innerHTML = selectAllHtml + filesHtml;

            // Add event listener for "Select All"
            const selectAllCheckbox = document.getElementById('select-all-files');
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('input[name="source-file"]');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
            });

        } else {
            // ファイルがない場合はリッチな案内UIを表示
            fileListContainer.innerHTML = `
                <div style="text-align: center; padding: 2rem; background: rgba(255, 193, 7, 0.1); border-radius: 8px; border: 2px dashed rgba(255, 193, 7, 0.3);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📁</div>
                    <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-primary);">アップロードされたファイルがありません</p>
                    <p style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1.5rem;">分析に使用するファイルを設定ページからアップロードしてください</p>
                    <button class="btn btn-primary" onclick="app.showPage('settings')" style="padding: 0.75rem 2rem; font-size: 1rem;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> 設定ページへ移動
                    </button>
                </div>
            `;
        }

        // Add event listeners for radio buttons
        sourceRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === 'file') {
                    fileSelectorContainer.style.display = 'block';
                } else {
                    fileSelectorContainer.style.display = 'none';
                }
            });
        });

        // 初期表示時：デフォルトで「アップロードしたファイル」が選択されている場合、コンテナを表示
        const selectedRadio = document.querySelector('input[name="analysis-source"]:checked');
        if (selectedRadio && selectedRadio.value === 'file') {
            fileSelectorContainer.style.display = 'block';
        }
    }
    
    loadGoals() {
        // 既存の重複目標を自動クリーンアップ
        this.cleanupDuplicateGoals();
        this.loadGoalsList();
    }

    // 重複目標を自動的にクリーンアップ
    cleanupDuplicateGoals() {
        try {
            const goals = JSON.parse(localStorage.getItem('goals') || '[]');
            if (goals.length === 0) return;

            // 目標カテゴリを判定するキーワード
            const goalCategories = {
                'hs': ['HS', 'ヘッドショット', 'HS率', 'ヘッドショット率'],
                'kd': ['K/D', 'KD', 'キルデス'],
                'winrate': ['勝率', '勝利率', 'Win'],
                'acs': ['ACS', 'コンバットスコア'],
                'adr': ['ADR', 'ダメージ', 'ラウンド毎'],
                'agent': ['エージェント', 'メインエージェント'],
                'duelist': ['デュエリスト', 'Jett', 'Phoenix', 'Reyna', 'Raze', 'Yoru', 'Neon', 'Iso'],
                'ability': ['アビリティ', 'スキル', '能力'],
                'positioning': ['ポジション', '立ち回り', '位置取り'],
                'economy': ['エコノミー', 'クレジット', '経済'],
                'map': ['マップ', 'Split', 'Bind', 'Haven', 'Ascent', 'Pearl', 'Lotus', 'Icebox', 'Breeze', 'Fracture', 'Sunset', 'Abyss']
            };

            const getGoalCategory = (title) => {
                for (const [category, keywords] of Object.entries(goalCategories)) {
                    if (keywords.some(kw => title.includes(kw))) {
                        return category;
                    }
                }
                return null;
            };

            // カテゴリごとに最新の目標のみを残す
            const seenCategories = new Map();
            const seenTitles = new Set();
            const uniqueGoals = [];

            // 新しい順（IDが大きい順）にソート
            const sortedGoals = [...goals].sort((a, b) => (b.id || 0) - (a.id || 0));

            for (const goal of sortedGoals) {
                const category = getGoalCategory(goal.title);
                const titleKey = goal.title.replace(/\s+/g, '').toLowerCase();

                // カテゴリがあり、既にそのカテゴリの目標がある場合はスキップ
                if (category && seenCategories.has(category)) {
                    continue;
                }

                // 同じタイトルの目標がある場合はスキップ
                if (seenTitles.has(titleKey)) {
                    continue;
                }

                if (category) {
                    seenCategories.set(category, true);
                }
                seenTitles.add(titleKey);
                uniqueGoals.push(goal);
            }

            // 元の順序に戻す（古い順）
            uniqueGoals.sort((a, b) => (a.id || 0) - (b.id || 0));

            // 重複があった場合のみ保存
            if (uniqueGoals.length < goals.length) {
                localStorage.setItem('goals', JSON.stringify(uniqueGoals));
                console.log(`🧹 重複目標をクリーンアップ: ${goals.length} → ${uniqueGoals.length}`);
            }
        } catch (error) {
            console.error('Failed to cleanup duplicate goals:', error);
        }
    }

    async loadGallery() {
        await this.loadGalleryMatches();
        this.loadOpponentFilter();
        this.setupGallerySelectionMode();
    }
    
    loadSettings() {
        this.loadGameCategories();
        this.loadApiSettings();
        this.loadCurrentRank();
    }

    // 戦績から現在のランクを取得して表示
    async loadCurrentRank() {
        const rankValueEl = document.getElementById('current-rank-value');
        const rankRREl = document.getElementById('current-rank-rr');
        const rankIconEl = document.getElementById('current-rank-icon');

        if (!rankValueEl) return;

        try {
            // valorant-api-serviceから戦績データを取得
            if (window.valorantAPIService) {
                const stats = await window.valorantAPIService.getPlayerStatsFromStatic();

                if (stats && stats.rank) {
                    const rankName = stats.rank.current || 'Unknown';
                    const rankRR = stats.rank.rr || 0;

                    rankValueEl.textContent = rankName;
                    rankRREl.textContent = `${rankRR} RR`;

                    // ランクに応じたアイコンを設定
                    const rankIcons = {
                        'Iron': '🔩',
                        'Bronze': '🥉',
                        'Silver': '🥈',
                        'Gold': '🥇',
                        'Platinum': '💎',
                        'Diamond': '💠',
                        'Ascendant': '⭐',
                        'Immortal': '👑',
                        'Radiant': '🌟'
                    };

                    const iconKey = Object.keys(rankIcons).find(key => rankName.includes(key));
                    if (iconKey && rankIconEl) {
                        rankIconEl.textContent = rankIcons[iconKey];
                    }
                } else {
                    rankValueEl.textContent = 'データなし';
                    rankRREl.textContent = '';
                }
            } else {
                rankValueEl.textContent = 'データなし';
                rankRREl.textContent = '';
            }
        } catch (error) {
            console.error('Failed to load current rank:', error);
            rankValueEl.textContent = 'データなし';
            rankRREl.textContent = '';
        }
    }
    
    // データロード処理
    loadUserData() {
        // ユーザーデータのロード
        if (!this.isGuest && this.currentUser) {
            // 保存されたデータをロード
        }
    }
    
    async loadRecentMatches() {
        // 新しいギャラリー描画関数を呼び出し
        await this.renderDashboardGallery();
    }

    // ダッシュボードギャラリーを描画
    async renderDashboardGallery(filters = {}) {
        const container = document.getElementById('gallery-grid');
        if (!container) return;

        // パフォーマンス最適化: キャッシュからデータを取得
        let matches = this.loadMatchDataWithCache();

        // localStorageにデータがない場合、valorant-stats.jsonから直接取得
        if (matches.length === 0) {
            try {
                const response = await fetch('data/valorant-stats.json');
                if (response.ok) {
                    const statsData = await response.json();
                    if (statsData.matches && statsData.matches.length > 0) {
                        matches = statsData.matches.map(m => ({
                            ...m,
                            timestamp: new Date(m.date).getTime() || Date.now()
                        }));
                        // localStorageに保存して次回以降はキャッシュを使用
                        localStorage.setItem('valorant_gallery', JSON.stringify(matches));
                        this.cachedMatchData = null; // キャッシュをリセット
                        console.log('valorant-stats.jsonから' + matches.length + '試合を読み込みました');
                    }
                }
            } catch (error) {
                console.error('valorant-stats.jsonの読み込みに失敗:', error);
            }
        }

        // 日付でソート（新しい順）
        matches = matches.sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateB - dateA;
        });

        // フィルタリング
        if (filters.result) {
            matches = matches.filter(m => m.result === filters.result);
        }
        if (filters.tag) {
            matches = matches.filter(m =>
                m.tags && m.tags.some(t => t.toLowerCase().includes(filters.tag.toLowerCase()))
            );
        }

        if (matches.length === 0) {
            container.innerHTML = `
                <div class="no-matches-message">
                    <p class="message-text">戦績データを読み込み中...</p>
                    <p class="message-sub">ワークフローでアカウントを接続してください</p>
                </div>
            `;
            return;
        }

        container.innerHTML = matches.map(match => {
            const agent = match.agent || match.character || 'Unknown';
            const result = (match.result || 'UNKNOWN').toUpperCase();
            const resultClass = result.toLowerCase();

            // KDA計算
            const kills = match.kills || 0;
            const deaths = match.deaths || 0;
            const assists = match.assists || 0;
            const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);

            // 日付フォーマット
            let dateStr = match.date || '';
            if (dateStr) {
                try {
                    const date = new Date(dateStr);
                    if (!isNaN(date)) {
                        dateStr = date.toLocaleDateString('ja-JP', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    }
                } catch (e) {
                    // 日付パースエラーは無視
                }
            }

            return `
                <div class="gallery-match-card ${resultClass}" onclick="app.openMatchDetail('${match.id || match.matchId}')">
                    <div class="gallery-card-header">
                        <div class="gallery-map-info">
                            <h4 class="gallery-map-name">${match.map || 'Unknown'}</h4>
                            <span class="gallery-score">${match.score || match.rounds || 'N/A'}</span>
                        </div>
                        <span class="gallery-result-badge ${resultClass}">${result === 'WIN' ? '勝利' : result === 'LOSS' ? '敗北' : '引分'}</span>
                    </div>
                    <div class="gallery-card-body">
                        <div class="gallery-agent">${agent}</div>
                        <div class="gallery-kda">
                            <span>KDA: ${kills}/${deaths}/${assists}</span>
                            <span class="gallery-kda-ratio">(${kd})</span>
                        </div>
                        <div class="gallery-stats">
                            <div class="gallery-stat">
                                <span class="gallery-stat-label">ACS</span>
                                <span class="gallery-stat-value ${this.getStatClass(match.acs, 200, 150)}">${match.acs || 0}</span>
                            </div>
                            <div class="gallery-stat">
                                <span class="gallery-stat-label">ADR</span>
                                <span class="gallery-stat-value ${this.getStatClass(match.adr, 150, 100)}">${match.adr || 0}</span>
                            </div>
                            <div class="gallery-stat">
                                <span class="gallery-stat-label">HS%</span>
                                <span class="gallery-stat-value ${this.getStatClass(match.hsPercent, 25, 15)}">${match.hsPercent || 0}%</span>
                            </div>
                            <div class="gallery-stat">
                                <span class="gallery-stat-label">K/D</span>
                                <span class="gallery-stat-value ${this.getStatClass(parseFloat(kd), 1.2, 0.8)}">${kd}</span>
                            </div>
                        </div>
                    </div>
                    <div class="gallery-card-footer">
                        <span>${dateStr}</span>
                        <span>${match.gameMode || 'Competitive'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // スタッツの値に応じたクラスを返す
    getStatClass(value, goodThreshold, averageThreshold) {
        const numValue = parseFloat(value) || 0;
        if (numValue >= goodThreshold) {
            return 'good';
        } else if (numValue >= averageThreshold) {
            return 'average';
        } else {
            return 'bad';
        }
    }

    // ギャラリーのイベントリスナーを設定
    setupGalleryEventListeners() {
        // フィルター表示切替
        const toggleBtn = document.getElementById('toggle-gallery-filters');
        const filtersDiv = document.getElementById('gallery-filters');
        if (toggleBtn && filtersDiv) {
            toggleBtn.addEventListener('click', () => {
                const isHidden = filtersDiv.style.display === 'none';
                filtersDiv.style.display = isHidden ? 'block' : 'none';
            });
        }

        // フィルター適用
        const applyBtn = document.getElementById('apply-gallery-filters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const resultFilter = document.getElementById('gallery-result-filter')?.value || '';
                const tagFilter = document.getElementById('gallery-tag-filter')?.value || '';
                this.renderDashboardGallery({ result: resultFilter, tag: tagFilter });
            });
        }

        // フィルタークリア
        const clearBtn = document.getElementById('clear-gallery-filters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                const resultSelect = document.getElementById('gallery-result-filter');
                const tagInput = document.getElementById('gallery-tag-filter');
                if (resultSelect) resultSelect.value = '';
                if (tagInput) tagInput.value = '';
                this.renderDashboardGallery();
            });
        }
    }

    // フローティングチャットの設定
    setupFloatingChat() {
        const chatBtn = document.getElementById('floating-chat-btn');
        const chatPopup = document.getElementById('floating-chat-popup');
        const closeBtn = document.getElementById('close-chat-popup');
        const chatInput = document.getElementById('floating-chat-input');
        const sendBtn = document.getElementById('floating-chat-send');

        if (chatBtn && chatPopup) {
            chatBtn.addEventListener('click', () => {
                chatPopup.classList.toggle('hidden');
                if (!chatPopup.classList.contains('hidden')) {
                    chatInput?.focus();
                }
            });
        }

        if (closeBtn && chatPopup) {
            closeBtn.addEventListener('click', () => {
                chatPopup.classList.add('hidden');
            });
        }

        if (chatInput) {
            chatInput.addEventListener('keydown', (e) => {
                // IME入力中（変換中）はEnterで送信しない
                if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                    e.preventDefault();
                    this.sendFloatingChatMessage();
                }
            });
        }

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendFloatingChatMessage());
        }
    }

    // フローティングチャットメッセージ送信
    async sendFloatingChatMessage() {
        const input = document.getElementById('floating-chat-input');
        const messagesContainer = document.getElementById('floating-chat-messages');
        const sendBtn = document.getElementById('floating-chat-send');

        if (!input || !messagesContainer) return;

        const message = input.value.trim();
        if (!message) return;

        // ユーザーメッセージを表示
        messagesContainer.innerHTML += `
            <div class="chat-message user">
                <div class="message-content">${this.escapeHtml(message)}</div>
            </div>
        `;

        // 入力をクリア
        input.value = '';
        input.classList.remove('interim'); // 音声入力の中間状態をクリア
        if (sendBtn) sendBtn.disabled = true;

        // ローディング表示
        const loadingId = 'loading-' + Date.now();
        messagesContainer.innerHTML += `
            <div class="chat-message assistant loading" id="${loadingId}">
                <div class="message-content">
                    <span class="dot"></span>
                    <span class="dot"></span>
                    <span class="dot"></span>
                </div>
            </div>
        `;

        // スクロール
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            // Gemini APIでレスポンス取得
            if (!window.geminiService || !window.geminiService.isConfigured()) {
                throw new Error('APIキーが設定されていません。設定画面でGemini APIキーを設定してください。');
            }

            // 戦績データを取得してコンテキストに追加
            let contextInfo = '';

            try {
                // valorant-stats.jsonから統計データを取得
                const statsResponse = await fetch('data/valorant-stats.json');
                if (statsResponse.ok) {
                    const statsData = await statsResponse.json();
                    const stats = statsData.stats;
                    const rank = statsData.rank;
                    const matches = statsData.matches || [];

                    // トップエージェント
                    const topAgents = stats.topAgents?.slice(0, 3)
                        .map(a => `${a.agent}(${a.matches}試合, ${a.winRate}%)`)
                        .join(', ') || 'なし';

                    // トップマップ
                    const topMaps = stats.topMaps?.slice(0, 3)
                        .map(m => `${m.map}(${m.matches}試合, ${m.winRate}%)`)
                        .join(', ') || 'なし';

                    // 最近5試合の詳細
                    const recentDetail = matches.slice(0, 5).map(m =>
                        `${m.result}(${m.agent}, ${m.map}, ${m.kills}/${m.deaths}/${m.assists}, HS${m.hsPercent}%)`
                    ).join(', ');

                    contextInfo = `

[プレイヤー統計情報]
- ランク: ${rank.current} (${rank.rr} RR)
- ピークランク: ${rank.peak}
- 総試合数: ${stats.totalMatches}試合 (${stats.wins}勝${stats.losses}敗, 勝率${stats.winRate}%)
- 平均K/D: ${stats.avgKD}
- 平均HS率: ${stats.avgHS}%
- 平均ACS: ${stats.avgACS}
- 平均ADR: ${stats.avgADR}
- 平均キル: ${stats.avgKills}
- 平均デス: ${stats.avgDeaths}
- よく使うエージェント: ${topAgents}
- よく遊ぶマップ: ${topMaps}
- 最近5試合: ${recentDetail}

この情報を元に質問に答えてください。`;
                } else {
                    throw new Error('Stats file not found');
                }
            } catch (error) {
                console.warn('Failed to load valorant-stats.json:', error);
                // フォールバック: localStorageから読む
                const matches = this.loadMatchDataWithCache();
                if (matches.length > 0) {
                    const wins = matches.filter(m => m.result === 'WIN').length;
                    const avgKD = matches.reduce((sum, m) => {
                        const deaths = m.deaths || 1;
                        return sum + (m.kills || 0) / deaths;
                    }, 0) / matches.length;
                    contextInfo = `\n\n[プレイヤー情報] ${matches.length}試合: ${wins}勝${matches.length - wins}敗, 平均K/D: ${avgKD.toFixed(2)}`;
                }
            }

            const prompt = `あなたはVALORANTの上達をサポートするAIコーチです。プレイヤーの戦績データを元に具体的なアドバイスをしてください。${contextInfo}\n\n質問: ${message}`;

            const result = await window.geminiService.sendChatMessage(prompt, false, false);
            // resultはオブジェクト {response: string, usage: object} なので response プロパティを取得
            // 第3引数のfalseでフルスクリーンローディングオーバーレイを無効化
            const responseText = result.response || result;

            // ローディングを削除してレスポンスを表示
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) {
                loadingEl.outerHTML = `
                    <div class="chat-message assistant">
                        <div class="message-content">${this.formatChatResponse(responseText)}</div>
                    </div>
                `;
            }

            // 音声読み上げ（voice-chat-serviceが読み込まれている場合）
            if (typeof speakAIResponse === 'function') {
                speakAIResponse(responseText);
            }

        } catch (error) {
            console.error('Chat error:', error);
            const loadingEl = document.getElementById(loadingId);
            if (loadingEl) {
                loadingEl.outerHTML = `
                    <div class="chat-message assistant">
                        <div class="message-content" style="color: var(--color-error);">
                            エラーが発生しました: ${this.escapeHtml(error.message)}
                        </div>
                    </div>
                `;
            }
        }

        if (sendBtn) sendBtn.disabled = false;
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // チャットレスポンスのフォーマット
    formatChatResponse(text) {
        if (!text) return '';
        return this.escapeHtml(text)
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }

    // HTMLエスケープ
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ランクからスキルレベルを自動決定
    determineSkillLevelFromRank(rank) {
        if (!rank) return 'intermediate';

        const rankLower = rank.toLowerCase();

        // 初心者: Iron, Bronze, Silver
        if (rankLower.includes('iron') || rankLower.includes('bronze') || rankLower.includes('silver')) {
            return 'beginner';
        }

        // 上級者: Diamond, Ascendant, Immortal, Radiant
        if (rankLower.includes('diamond') || rankLower.includes('ascendant') ||
            rankLower.includes('immortal') || rankLower.includes('radiant')) {
            return 'advanced';
        }

        // 中級者: Gold, Platinum (default)
        return 'intermediate';
    }

    // スキル表示を更新
    updateSkillDisplay() {
        const skillLevel = localStorage.getItem('playerSkillLevel') || 'intermediate';

        const skillInfo = {
            'beginner': { icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>', name: '初心者', desc: '基本的なゲームメカニクスを学習中' },
            'intermediate': { icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>', name: '中級者', desc: 'バランスの取れたスキルレベル' },
            'advanced': { icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>', name: '上級者', desc: '高度な戦略と技術を身につけている' }
        };

        const info = skillInfo[skillLevel] || skillInfo.intermediate;

        const iconEl = document.getElementById('current-skill-icon');
        const levelEl = document.getElementById('current-skill-level');
        const descEl = document.getElementById('current-skill-description');

        if (iconEl) iconEl.textContent = info.icon;
        if (levelEl) levelEl.textContent = info.name;
        if (descEl) descEl.textContent = info.desc;
    }
    
    loadAiRecommendations() {
        // この関数は削除されました - AIコーチング機能は無効化されています
        console.log('🚨 loadAiRecommendations called but AI coaching feature has been removed');
    }
    
    refreshAiRecommendations() {
        // この関数は削除されました - AIコーチング機能は無効化されています
        console.log('🚨 refreshAiRecommendations called but AI coaching feature has been removed');
    }
    
    loadGoalsList() {
        const container = document.getElementById('goals-list');
        if (!container) return;

        const goals = JSON.parse(localStorage.getItem('goals') || '[]');

        if (goals.length === 0) {
            container.innerHTML = '<p class="no-data">目標がまだ設定されていません</p>';
            return;
        }

        container.innerHTML = goals.map(goal => {
            // 進捗の計算と表示テキストの決定
            let progress;
            let progressText;

            if (goal.hasCoachingPlan && goal.planId && this.coachingPlanService) {
                const plan = this.coachingPlanService.getPlan(goal.planId);
                if (plan) {
                    progress = this.calculatePlanProgress(plan);
                    progressText = `${progress}% (プラン進捗)`;
                } else {
                    progress = this.calculateProgressByDays(goal);
                    progressText = `${progress}% (日数ベース)`;
                }
            } else {
                progress = this.calculateProgressByDays(goal);
                progressText = `${progress}% (日数ベース)`;
            }

            return `
            <div class="goal-item">
                <div class="goal-header">
                    <h4>${goal.title}</h4>
                    <span class="goal-deadline">${goal.deadline}</span>
                </div>
                <p class="goal-description">${goal.description}</p>
                <div class="goal-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <span class="progress-text">${progressText}</span>
                </div>
                <div class="goal-actions">
                    <button class="btn-danger btn-sm" onclick="app.deleteGoal(${goal.id})">削除</button>
                </div>
            </div>
        `;
        }).join('');
    }
    
    addGoal(goalData) {
        const goals = JSON.parse(localStorage.getItem('goals') || '[]');
        goals.push(goalData);
        localStorage.setItem('goals', JSON.stringify(goals));
        this.loadGoalsList();
    }

    // 戦績から目標を自動策定
    async generateGoalsFromStats() {
        if (!window.valorantAPIService) {
            this.showToast('Valorant APIサービスが利用できません', 'error');
            return;
        }

        if (!window.geminiService || !window.geminiService.isConfigured()) {
            this.showToast('目標の自動策定にはGemini APIキーが必要です', 'error');
            return;
        }

        try {
            this.showLoading('戦績を分析して目標を策定中...');

            // 静的データから戦績を取得
            const stats = await window.valorantAPIService.getPlayerStatsFromStatic();

            if (!stats || !stats.stats) {
                this.hideLoading();
                this.showToast('戦績データがありません。先にGitHub Actionsでデータを取得してください。', 'error');
                return;
            }

            const { account, rank, stats: matchStats } = stats;

            // AIに目標策定を依頼
            // 現在値を明確に変数として保持
            const currentWinRate = matchStats.winRate;
            const currentKD = matchStats.avgKD;
            const currentACS = matchStats.avgACS;
            const currentADR = matchStats.avgADR;
            const currentHS = matchStats.avgHS;

            const prompt = `あなたはVALORANTコーチです。以下の【現在の戦績データ】を分析し、改善目標を3つ提案してください。

━━━━━━━━━━━━━━━━━━━━━━━━━━
【現在の戦績データ】※これが実際の値です
━━━━━━━━━━━━━━━━━━━━━━━━━━
ランク: ${rank.current} (${rank.rr} RR)
現在の勝率: ${currentWinRate}%
現在のK/D: ${currentKD}
現在のACS: ${currentACS}
現在のADR: ${currentADR}
現在のHS率: ${currentHS}%
試合数: ${matchStats.totalMatches}
メインエージェント: ${matchStats.topAgents?.map(a => a.agent).join(', ') || 'N/A'}
━━━━━━━━━━━━━━━━━━━━━━━━━━

【絶対厳守ルール】
1. 上記の「現在の」値を必ずそのまま使用すること
2. 現在のHS率は${currentHS}%です。これ以外の値を使用してはいけません
3. 現在のK/Dは${currentKD}です。これ以外の値を使用してはいけません
4. 現在の勝率は${currentWinRate}%です。これ以外の値を使用してはいけません
5. 数値を推測したり、適当な値を作ったりしてはいけません
6. descriptionには必ず「現在の${currentHS}%から」のように実際の現在値を含めること

【出力形式】
以下のJSON形式で3つの目標を出力してください。

{
  "goals": [
    {
      "title": "目標タイトル（20文字以内）",
      "description": "現在の○○から△△への具体的な改善方法（必ず上記の現在値を使用）",
      "deadline_days": 7
    }
  ]
}

【目標設定の指針】
- 現在値から+3〜5%程度の現実的な改善目標を設定
- 例：現在のHS率が${currentHS}%なら、目標は${(parseFloat(currentHS) + 3).toFixed(1)}%〜${(parseFloat(currentHS) + 5).toFixed(1)}%程度
- 例：現在のK/Dが${currentKD}なら、目標は${(parseFloat(currentKD) + 0.1).toFixed(2)}〜${(parseFloat(currentKD) + 0.2).toFixed(2)}程度
- 1週間で達成可能な目標にする

JSONのみを出力してください。`;

            const response = await window.geminiService.sendChatMessage(prompt, false);

            this.hideLoading();

            // JSONを抽出
            let goalsData;
            try {
                const jsonMatch = response.response.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    goalsData = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('JSON形式で取得できませんでした');
                }
            } catch (e) {
                console.error('Failed to parse goals JSON:', e);
                this.showToast('目標の生成に失敗しました。再試行してください。', 'error');
                return;
            }

            if (!goalsData.goals || goalsData.goals.length === 0) {
                this.showToast('目標を生成できませんでした', 'error');
                return;
            }

            // 生成された目標をユーザーに確認
            const goalsHtml = goalsData.goals.map((goal, index) => `
                <div style="text-align: left; margin-bottom: 15px; padding: 10px; background: var(--bg-secondary); border-radius: 8px;">
                    <label style="display: flex; align-items: flex-start; gap: 10px; cursor: pointer;">
                        <input type="checkbox" id="goal-${index}" checked style="margin-top: 3px;">
                        <div>
                            <strong>${goal.title}</strong>
                            <p style="margin: 5px 0 0; font-size: 12px; color: var(--text-secondary);">
                                ${goal.description}
                            </p>
                            <small style="color: var(--color-accent);">期限: ${goal.deadline_days}日後</small>
                        </div>
                    </label>
                </div>
            `).join('');

            const result = await Swal.fire({
                title: '目標の自動策定',
                html: `
                    <p style="margin-bottom: 15px;">戦績を分析して以下の目標を策定しました。追加する目標を選択してください。</p>
                    ${goalsHtml}
                `,
                width: '600px',
                showCancelButton: true,
                confirmButtonText: '選択した目標を追加',
                cancelButtonText: 'キャンセル'
            });

            if (result.isConfirmed) {
                // 選択された目標を追加（類似目標は上書き）
                let addedCount = 0;
                let replacedCount = 0;

                // 目標カテゴリを判定するキーワード
                const goalCategories = {
                    'hs': ['HS', 'ヘッドショット', 'HS率', 'ヘッドショット率'],
                    'kd': ['K/D', 'KD', 'キルデス'],
                    'winrate': ['勝率', '勝利率', 'Win'],
                    'acs': ['ACS', 'コンバットスコア'],
                    'adr': ['ADR', 'ダメージ', 'ラウンド毎'],
                    'agent': ['エージェント', 'メインエージェント'],
                    'duelist': ['デュエリスト', 'Jett', 'Phoenix', 'Reyna', 'Raze', 'Yoru', 'Neon', 'Iso'],
                    'ability': ['アビリティ', 'スキル', '能力'],
                    'positioning': ['ポジション', '立ち回り', '位置取り'],
                    'economy': ['エコノミー', 'クレジット', '経済'],
                    'map': ['マップ', 'Split', 'Bind', 'Haven', 'Ascent', 'Pearl', 'Lotus', 'Icebox', 'Breeze', 'Fracture', 'Sunset', 'Abyss']
                };

                // 目標のカテゴリを判定
                const getGoalCategory = (title) => {
                    for (const [category, keywords] of Object.entries(goalCategories)) {
                        if (keywords.some(kw => title.includes(kw))) {
                            return category;
                        }
                    }
                    return null;
                };

                // 既存の目標を取得
                let existingGoals = JSON.parse(localStorage.getItem('goals') || '[]');

                // 新しい目標のカテゴリを収集
                const newCategories = new Set();
                goalsData.goals.forEach((goal, index) => {
                    const checkbox = document.getElementById(`goal-${index}`);
                    if (checkbox && checkbox.checked) {
                        const category = getGoalCategory(goal.title);
                        if (category) {
                            newCategories.add(category);
                        }
                    }
                });

                // 同じカテゴリの既存目標を全て削除（重複防止）
                const removedCount = existingGoals.filter(existing => {
                    const existingCategory = getGoalCategory(existing.title);
                    return existingCategory && newCategories.has(existingCategory);
                }).length;

                existingGoals = existingGoals.filter(existing => {
                    const existingCategory = getGoalCategory(existing.title);
                    return !existingCategory || !newCategories.has(existingCategory);
                });

                if (removedCount > 0) {
                    replacedCount = removedCount;
                }

                // 新しい目標を追加（IDを収集）
                const newGoalIds = [];
                goalsData.goals.forEach((goal, index) => {
                    const checkbox = document.getElementById(`goal-${index}`);
                    if (checkbox && checkbox.checked) {
                        const deadline = new Date();
                        deadline.setDate(deadline.getDate() + (goal.deadline_days || 7));

                        const goalId = Date.now() + index;
                        const goalData = {
                            id: goalId,
                            title: goal.title,
                            description: goal.description,
                            deadline: deadline.toISOString().split('T')[0],
                            progress: 0,
                            createdAt: new Date().toISOString(),
                            autoGenerated: true
                        };

                        existingGoals.push(goalData);
                        newGoalIds.push(goalId);
                        addedCount++;
                    }
                });

                // 保存
                localStorage.setItem('goals', JSON.stringify(existingGoals));

                if (addedCount > 0 || replacedCount > 0) {
                    let message = '';
                    if (addedCount > 0 && replacedCount > 0) {
                        message = `${addedCount}件追加、${replacedCount}件を上書きしました`;
                    } else if (addedCount > 0) {
                        message = `${addedCount}件の目標を追加しました`;
                    } else {
                        message = `${replacedCount}件の目標を上書きしました`;
                    }
                    this.showToast(message, 'success');
                    this.loadDashboardGoals();
                    this.loadGoals(); // 目標ページも更新

                    // 自動でコーチングプランを生成
                    console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> コーチングプラン自動生成チェック:', {
                        hasCoachingPlanService: !!this.coachingPlanService,
                        hasGeminiService: !!window.geminiService,
                        isGeminiConfigured: window.geminiService?.isConfigured?.(),
                        newGoalIdsLength: newGoalIds.length
                    });

                    if (newGoalIds.length > 0) {
                        if (!this.coachingPlanService) {
                            console.warn('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> coachingPlanServiceが初期化されていません');
                        }
                        if (!window.geminiService?.isConfigured?.()) {
                            console.warn('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Gemini APIが設定されていません');
                            this.showToast('コーチングプラン生成にはGemini APIキーが必要です', 'warning');
                        }
                    }

                    if (this.coachingPlanService && window.geminiService?.isConfigured?.() && newGoalIds.length > 0) {
                        this.showLoading('コーチングプランを自動生成中...');

                        try {
                            let plansCreated = 0;
                            for (const goalId of newGoalIds) {
                                const goal = existingGoals.find(g => g.id === goalId);
                                console.log(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> プラン生成中: ${goal?.title} (ID: ${goalId})`);

                                if (goal && !goal.hasCoachingPlan) {
                                    try {
                                        const plan = await this.coachingPlanService.generateCoachingPlan({
                                            id: goal.id,
                                            title: goal.title,
                                            description: goal.description,
                                            deadline: goal.deadline
                                        });

                                        if (plan) {
                                            // 目標にプランIDを関連付け
                                            goal.hasCoachingPlan = true;
                                            goal.planId = plan.id;
                                            plansCreated++;
                                            console.log(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> プラン生成成功: ${goal.title}`);
                                        } else {
                                            console.warn(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> プラン生成失敗（null返却）: ${goal.title}`);
                                        }
                                    } catch (planError) {
                                        console.error(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> プラン生成エラー for goal ${goalId}:`, planError);
                                        this.showToast(`プラン生成失敗: ${planError.message}`, 'error');
                                    }
                                }
                            }

                            // 更新された目標を保存
                            localStorage.setItem('goals', JSON.stringify(existingGoals));

                            this.hideLoading();

                            if (plansCreated > 0) {
                                this.showToast(`${plansCreated}件のコーチングプランを自動生成しました`, 'success');
                                this.loadCoachingPlans();
                            } else {
                                this.showToast('コーチングプランの生成に失敗しました', 'error');
                            }
                        } catch (planError) {
                            this.hideLoading();
                            console.error('Failed to auto-generate coaching plans:', planError);
                            this.showToast(`プラン生成エラー: ${planError.message}`, 'error');
                        }
                    }
                } else {
                    this.showToast('目標が選択されていません', 'info');
                }
            }

        } catch (error) {
            this.hideLoading();
            console.error('Failed to generate goals:', error);
            this.showToast(`目標の策定に失敗しました: ${error.message}`, 'error');
        }
    }

    // デバッグ用: 特定の目標の進捗を強制的に更新する関数
    forceUpdateGoalByTitle(title, progress) {
        try {
            const goals = JSON.parse(localStorage.getItem('goals') || '[]');
            const goalIndex = goals.findIndex(goal => goal.title === title);

            if (goalIndex !== -1) {
                goals[goalIndex].progress = progress;
                localStorage.setItem('goals', JSON.stringify(goals));
                this.loadDashboardGoals();
                console.log(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Force updated "${title}" to ${progress}%`);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Force update failed:', error);
            return false;
        }
    }


    async deleteGoal(goalId) {
        // 確認ダイアログを表示
        const result = await Swal.fire({
            title: '目標を削除しますか？',
            html: '本当にこの目標を削除しますか？<br>削除する場合は <b>削除</b> と入力してください。',
            icon: 'warning',
            input: 'text',
            inputAttributes: {
                autocapitalize: 'off'
            },
            showCancelButton: true,
            confirmButtonText: '削除する',
            cancelButtonText: 'キャンセル',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            reverseButtons: true,
            background: getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim(),
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
            preConfirm: (inputValue) => {
                if (inputValue !== '削除') {
                    Swal.showValidationMessage('キーワードが一致しません。「削除」と入力してください。');
                    return false;
                }
                return true;
            }
        });

        if (!result.isConfirmed) {
            return;
        }

        try {
            const goals = JSON.parse(localStorage.getItem('goals') || '[]');
            const filteredGoals = goals.filter(goal => goal.id !== goalId);

            localStorage.setItem('goals', JSON.stringify(filteredGoals));

            // リストを更新
            this.loadGoalsList();

            // 現在のページがダッシュボードの場合のみ更新
            if (this.currentPage === 'dashboard') {
                this.loadDashboardGoals();
            }

            await Swal.fire({
                title: '削除しました',
                text: '目標を削除しました。',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                background: getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim(),
                color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim()
            });
        } catch (error) {
            console.error('Failed to delete goal:', error);
            this.showToast('目標の削除に失敗しました', 'error');
        }
    }

    analyzeMatch(matchData) {
        // キャラクター・ラウンド情報のみ保持
        const playerCharacter = matchData.playerCharacter || 'Unknown';
        const opponentCharacter = matchData.opponentCharacter || 'Unknown';
        const roundsWon = matchData.roundsWon || 0;
        const roundsLost = matchData.roundsLost || 0;

        const resultsContainer = document.getElementById('analysis-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="card">
                    <h3>試合分析結果</h3>
                    <div class="analysis-stats">
                        <div class="stat-section">
                            <h4>試合情報</h4>
                            <div class="stat-row">
                                <div class="stat-box">
                                    <span class="stat-label">使用キャラ</span>
                                    <span class="stat-value">${playerCharacter}</span>
                                </div>
                                <div class="stat-box">
                                    <span class="stat-label">相手キャラ</span>
                                    <span class="stat-value">${opponentCharacter}</span>
                                </div>
                                <div class="stat-box">
                                    <span class="stat-label">ラウンド勝利</span>
                                    <span class="stat-value">${roundsWon}/${roundsWon + roundsLost}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="analysis-feedback">
                        <h4>パフォーマンス評価</h4>
                        <p>試合データが記録されました。キャラクター対戦データを蓄積中...</p>
                    </div>
                </div>
            `;
            resultsContainer.classList.remove('hidden');
        }
    }
    
    loadGameCategories() {
        const container = document.getElementById('game-categories');
        if (!container || typeof ESPORTS_GAMES === 'undefined') return;
        
        let html = '';
        for (const [categoryKey, category] of Object.entries(ESPORTS_GAMES)) {
            html += `<div class="game-category-section">
                <h4 class="category-title">${category.name}</h4>
                <div class="games-grid">`;
            
            category.games.forEach(game => {
                html += `
                    <div class="game-option" 
                         data-game-id="${game.id}" 
                         data-game-name="${game.name}" 
                         data-game-icon="${game.icon}" 
                         data-category="${category.name}"
                         role="button"
                         tabindex="0">
                        <span class="game-option-icon">${game.icon}</span>
                        <span class="game-option-name">${game.name}</span>
                    </div>`;
            });
            
            html += '</div></div>';
        }
        
        container.innerHTML = html;
        
        // ゲーム選択カードのクリックイベントを設定
        this.setupGameCards();
    }
    
    showGameSelector() {
        const selector = document.getElementById('game-selector');
        if (selector) {
            selector.classList.remove('hidden');
        }
    }
    
    hideGameSelector() {
        const selector = document.getElementById('game-selector');
        if (selector) {
            selector.classList.add('hidden');
        }
    }
    
    confirmGameSelection() {
        const selected = document.querySelector('.game-card.selected');
        if (selected) {
            const gameId = selected.dataset.gameId;
            const gameName = selected.querySelector('.game-name').textContent;
            const gameIcon = selected.querySelector('.game-icon').textContent;
            
            const currentGameName = document.getElementById('current-game-name');
            const currentGameIcon = document.getElementById('current-game-icon');
            const playerGame = document.getElementById('player-game');
            
            if (currentGameName) currentGameName.textContent = gameName;
            if (currentGameIcon) currentGameIcon.textContent = gameIcon;
            if (playerGame) playerGame.textContent = gameName;
            
            localStorage.setItem('selectedGame', gameId);
            this.hideGameSelector();
            this.showToast(`ゲームを${gameName}に変更しました`, 'success');
        }
    }
    
    loadApiSettings() {
        const provider = localStorage.getItem('ai_provider');
        const model = localStorage.getItem('ai_model');
        const hasKey = localStorage.getItem('ai_api_key');
        
        if (provider) {
            const providerSelect = document.getElementById('api-provider');
            if (providerSelect) providerSelect.value = provider;
        }
        if (model) {
            const modelSelect = document.getElementById('api-model');
            if (modelSelect) modelSelect.value = model;
        }
        
        this.updateApiStatus(!!hasKey);
    }

    // === チャット機能 ===
    initChat() {
        console.log('Initializing chat...');
        
        // API設定関連
        this.setupChatApiSettings();
        
        // チャット入力関連
        this.setupChatInput();
        
        // メッセージ履歴を復元
        this.loadChatHistory();
    }
    
    setupChatApiSettings() {
        // APIキー設定
        const saveKeyBtn = document.getElementById('save-gemini-key');
        const testConnectionBtn = document.getElementById('test-gemini-connection');
        const toggleKeyBtn = document.getElementById('toggle-gemini-key');
        const apiKeyInput = document.getElementById('gemini-api-key');
        
        if (saveKeyBtn) {
            saveKeyBtn.addEventListener('click', () => this.saveGeminiApiKey());
        }
        
        if (testConnectionBtn) {
            testConnectionBtn.addEventListener('click', () => this.testGeminiConnection());
        }
        
        if (toggleKeyBtn && apiKeyInput) {
            toggleKeyBtn.addEventListener('click', () => {
                const isPassword = apiKeyInput.type === 'password';
                apiKeyInput.type = isPassword ? 'text' : 'password';
                toggleKeyBtn.textContent = isPassword ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
            });
        }
        
        // 既存のAPIキーを読み込み
        if (apiKeyInput && this.geminiService) {
            apiKeyInput.value = this.geminiService.getApiKey();
        }
    }
    
    setupChatInput() {
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-message');
        const clearBtn = document.getElementById('clear-chat');
        
        if (chatInput) {
            // 自動リサイズ
            chatInput.addEventListener('input', () => {
                chatInput.style.height = 'auto';
                chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
                
                // 送信ボタンの有効/無効
                if (sendBtn) {
                    sendBtn.disabled = !chatInput.value.trim();
                }
            });
            
            // Enter キーで送信
            chatInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendChatMessage();
                }
            });
        }
        
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendChatMessage());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearChat());
        }
    }
    
    async saveGeminiApiKey() {
        const apiKeyInput = document.getElementById('gemini-api-key');
        if (!apiKeyInput) return;
        
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
            this.showToast('APIキーを入力してください', 'warning');
            return;
        }
        
        try {
            // 統一APIマネージャーを使用
            if (window.unifiedApiManager) {
                await window.unifiedApiManager.setAPIKey(apiKey);
                // 他の入力フィールドも同期
                this.syncAPIKeyInputs();
                this.showToast('APIキーを保存しました', 'success');
            } else if (this.geminiService) {
                // フォールバック
                this.geminiService.setApiKey(apiKey);
                this.showToast('Gemini APIキーを保存しました', 'success');
            } else {
                this.showToast('APIサービスが初期化されていません', 'error');
            }
        } catch (error) {
            this.showToast(`APIキー保存に失敗しました: ${error.message}`, 'error');
        }
    }
    
    async testGeminiConnection() {
        if (!window.unifiedApiManager || !window.unifiedApiManager.isConfigured()) {
            this.showToast('Gemini APIキーが設定されていません', 'error');
            return;
        }
        
        const testBtn = document.getElementById('test-gemini-connection');
        if (testBtn) {
            testBtn.disabled = true;
            testBtn.textContent = 'テスト中...';
        }
        
        try {
            await window.unifiedApiManager.validateAPIKey();
            this.showToast('接続テストに成功しました', 'success');
        } catch (error) {
            this.showToast(`接続テストに失敗: ${error.message}`, 'error');
        } finally {
            if (testBtn) {
                testBtn.disabled = false;
                testBtn.textContent = '接続テスト';
            }
        }
    }
    
    async sendChatMessage() {
        const chatInput = document.getElementById('chat-input');
        const sendBtn = document.getElementById('send-message');
        
        if (!chatInput) return;
        
        // APIが設定されているか確認
        if (!window.unifiedApiManager || !window.unifiedApiManager.isConfigured()) {
            this.showToast('Gemini APIキーが設定されていません', 'warning');
            return;
        }
        
        const message = chatInput.value.trim();
        if (!message) return;
        
        // UIを無効化
        chatInput.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        
        try {
            // ユーザーメッセージを表示
            this.addChatMessage(message, 'user');
            
            // 入力フィールドをクリア
            chatInput.value = '';
            chatInput.style.height = 'auto';
            
            // タイピングインジケーター表示
            this.showTypingIndicator();
            
            // APIに送信
            const response = await this.geminiService.sendChatMessage(message);
            
            // タイピングインジケーター非表示
            this.hideTypingIndicator();
            
            // AIの応答を表示
            this.addChatMessage(response.response, 'ai');
            
            // 履歴を保存
            this.saveChatHistory();
            
        } catch (error) {
            this.hideTypingIndicator();
            this.showToast(`メッセージ送信エラー: ${error.message}`, 'error');
        } finally {
            // UIを再有効化
            chatInput.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
        }
    }
    
    addChatMessage(text, type) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}-message`;
        
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = type === 'user' ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>';
        
        const content = document.createElement('div');
        content.className = 'message-content';
        
        const messageText = document.createElement('div');
        messageText.className = 'message-text';
        messageText.textContent = text;
        
        const timestamp = document.createElement('div');
        timestamp.className = 'message-time';
        timestamp.textContent = new Date().toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        content.appendChild(messageText);
        content.appendChild(timestamp);
        messageDiv.appendChild(avatar);
        messageDiv.appendChild(content);
        
        messagesContainer.appendChild(messageDiv);
        
        // スクロール
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // メッセージを配列に追加
        this.chatMessages.push({
            text: text,
            type: type,
            timestamp: new Date().toISOString()
        });
    }
    
    showTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        const indicator = document.createElement('div');
        indicator.className = 'chat-message ai-message typing-indicator';
        indicator.id = 'typing-indicator';
        
        indicator.innerHTML = `
            <div class="message-avatar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg></div>
            <div class="message-content">
                <div class="message-text">
                    <span>AI が入力中</span>
                    <div class="typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    clearChat() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        // 最初のAIメッセージ以外を削除
        const messages = messagesContainer.querySelectorAll('.chat-message');
        messages.forEach((msg, index) => {
            if (index > 0) msg.remove();
        });
        
        // データをクリア
        this.chatMessages = [];
        if (this.geminiService) {
            this.geminiService.clearChatHistory();
        }
        
        this.saveChatHistory();
        this.showToast('チャット履歴をクリアしました', 'success');
    }
    
    saveChatHistory() {
        localStorage.setItem('chat-history', JSON.stringify(this.chatMessages));
    }
    
    loadChatHistory() {
        try {
            const history = localStorage.getItem('chat-history');
            if (history) {
                this.chatMessages = JSON.parse(history);
                // UIは復元しない（新しいセッションとして開始）
            }
        } catch (error) {
            console.warn('Failed to load chat history:', error);
            this.chatMessages = [];
        }
    }


    // === ゲーム選択とダッシュボード機能 ===
    initGameSelection() {
        console.log('Initializing game selection...');
        
        // ゲーム選択誘導ボタン
        const gotoGameSelectionBtn = document.getElementById('goto-game-selection');
        if (gotoGameSelectionBtn) {
            gotoGameSelectionBtn.addEventListener('click', () => {
                this.goToGameSelection();
            });
        }
        
        // ゲームカードのクリックイベントを設定
        this.setupGameActionButtons();
        
        // 初期状態のチェック
        this.checkGameSelection();
    }
    
    setupGameCardEvents() {
        // ゲームカードの初回設定
        this.setupGameCards();
        
        // ゲームカードが動的生成される場合のための再試行機構
        setTimeout(() => this.setupGameCards(), 500);
        setTimeout(() => this.setupGameCards(), 1500);
        
        // 確認・キャンセルボタンの設定
        this.setupGameActionButtons();
    }
    
    setupGameCards() {
        const gameCards = document.querySelectorAll('.game-option');
        console.log(`Found ${gameCards.length} game cards`);
        
        gameCards.forEach((card) => {
            // クリックイベントリスナー追加
            card.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Game card clicked:', card.dataset.gameName);
                this.selectGame(card);
            });
            
            // キーボードアクセシビリティ
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this.selectGame(card);
                }
            });
            
            // マウスオーバー効果
            card.addEventListener('mouseenter', () => {
                if (!card.classList.contains('selected')) {
                    card.style.transform = 'scale(1.02)';
                }
            });
            
            card.addEventListener('mouseleave', () => {
                if (!card.classList.contains('selected')) {
                    card.style.transform = 'scale(1)';
                }
            });
            
            // クリック可能であることを明示するスタイル
            card.style.cursor = 'pointer';
        });
        
        // 現在選択されているゲームがあれば表示
        this.restoreGameSelection();
    }
    
    setupGameActionButtons() {
        const confirmBtn = document.getElementById('confirm-game-btn');
        const cancelBtn = document.getElementById('cancel-game-btn');
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmGameSelection());
        }
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hideGameSelector());
        }
    }
    
    generateGameId(gameName) {
        // 日本語ゲーム名を英語IDに変換
        const gameIdMap = {
            'League of Legends': 'lol',
            'Valorant': 'valorant',
            'Overwatch 2': 'overwatch2',
            'Counter-Strike 2': 'cs2',
            'Apex Legends': 'apex',
            'Fortnite': 'fortnite',
            'Call of Duty': 'cod',
            'Rainbow Six Siege': 'r6',
            'Rocket League': 'rocketleague',
            'FIFA 24': 'fifa24',
            'NBA 2K24': 'nba2k24',
            'Gran Turismo 7': 'gt7'
        };
        
        return gameIdMap[gameName] || gameName.toLowerCase().replace(/\s+/g, '_');
    }
    
    restoreGameSelection() {
        const selectedGameId = localStorage.getItem('selectedGame');
        if (selectedGameId) {
            const selectedCard = document.querySelector(`.game-option[data-game-id="${selectedGameId}"]`);
            if (selectedCard) {
                selectedCard.classList.add('selected');
            }
        }
    }
    
    goToGameSelection() {
        // 設定タブに移動
        this.showPage('settings');
        
        // ナビゲーションのアクティブ状態を更新
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.page === 'settings') {
                btn.classList.add('active');
            }
        });
        
        // ゲーム選択エリアまでスクロール
        setTimeout(() => {
            const gameSelection = document.getElementById('current-game-display');
            if (gameSelection) {
                gameSelection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
            
            // ゲーム選択を開く
            this.showGameSelector();
            
            // ハイライトアニメーション
            const gameSelector = document.getElementById('game-selector');
            if (gameSelector) {
                gameSelector.classList.add('highlight');
                setTimeout(() => {
                    gameSelector.classList.remove('highlight');
                }, 1500);
            }
        }, 300);
    }
    
    checkGameSelection() {
        const selectedGame = localStorage.getItem('selectedGame');
        const selectedGameData = localStorage.getItem('selectedGameData');

        if (selectedGame && selectedGameData) {
            // ゲームが選択済み
            this.updateUIWithGameData(JSON.parse(selectedGameData));
        } else {
            // VALORANT専用なので、ゲームデータを自動設定
            const valorantGameData = {
                id: 'valorant',
                name: 'VALORANT',
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
                category: 'FPS'
            };

            localStorage.setItem('selectedGame', valorantGameData.id);
            localStorage.setItem('selectedGameData', JSON.stringify(valorantGameData));
            this.updateUIWithGameData(valorantGameData);
        }
    }
    
    selectGame(gameCard) {
        // 他のカードの選択を解除
        const allCards = document.querySelectorAll('.game-option');
        allCards.forEach(card => card.classList.remove('selected'));
        
        // 選択したカードをハイライト
        gameCard.classList.add('selected');
    }
    
    confirmGameSelection() {
        const selectedCard = document.querySelector('.game-option.selected');
        if (!selectedCard) {
            this.showToast('ゲームを選択してください', 'warning');
            return;
        }
        
        // ゲーム情報を取得
        const gameId = selectedCard.dataset.gameId;
        const gameName = selectedCard.dataset.gameName || selectedCard.querySelector('.game-option-name').textContent;
        const gameIcon = selectedCard.dataset.gameIcon || selectedCard.querySelector('.game-option-icon').textContent;
        const categoryName = selectedCard.dataset.category || selectedCard.closest('.game-category-section')?.querySelector('.category-title')?.textContent || 'その他';
        
        const gameData = {
            id: gameId,
            name: gameName,
            icon: gameIcon,
            category: categoryName
        };
        
        // LocalStorageに保存
        localStorage.setItem('selectedGame', gameId);
        localStorage.setItem('selectedGameData', JSON.stringify(gameData));
        
        // UIを更新
        this.updateUIWithGameData(gameData);
        this.hideGameSelector();
        this.hideGameSelectionGuidance();
        
        this.showToast(`${gameName} を選択しました`, 'success');

        // コーチングを更新
        this.refreshDailyCoaching();

        // ダッシュボードに戻る
        setTimeout(() => {
            this.showPage('dashboard');
            const navBtns = document.querySelectorAll('.nav-btn');
            navBtns.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.page === 'dashboard') {
                    btn.classList.add('active');
                }
            });
        }, 1000);
    }
    
    updateUIWithGameData(gameData) {
        // ダッシュボード更新
        const playerGame = document.getElementById('player-game');
        const currentGameName = document.getElementById('current-game-name');
        const currentGameIcon = document.getElementById('current-game-icon');
        const currentGameCategory = document.getElementById('current-game-category');
        
        if (playerGame) playerGame.textContent = gameData.name;
        if (currentGameName) currentGameName.textContent = gameData.name;
        if (currentGameIcon) currentGameIcon.textContent = gameData.icon;
        if (currentGameCategory) currentGameCategory.textContent = gameData.category;
        
        // サンプルデータを表示
        this.loadSampleGameData(gameData);
    }
    
    loadSampleGameData(gameData) {
        // プレイヤー名をカスタマイズ
        const playerName = document.getElementById('player-name');
        if (playerName) {
            playerName.textContent = `${gameData.name} プレイヤー`;
        }

        // ランクを設定（固定の例。ここはランダムではないため従来通り）
        const playerRank = document.getElementById('player-rank');
        if (playerRank) {
            const ranks = {
                'League of Legends': 'Gold II',
                'Valorant': 'Diamond I',
                'Overwatch 2': 'Platinum III',
                'Counter-Strike 2': 'Global Elite',
                'Apex Legends': 'Diamond IV'
            };
            playerRank.textContent = ranks[gameData.name] || 'Platinum II';
        }

        // 1) まずは保存済みの統計があればそれを使用（安定表示）
        let stableStats = null;
        if (this.playerStatsManager && this.playerStatsManager.hasValidStats()) {
            stableStats = this.playerStatsManager.getPlayerStats();
        }

        // 2) 保存済みの統計がない場合は何もしない（初期状態は「-」のまま）

        // 3) UI へ反映（存在しなければハイフンのまま）
        if (stableStats) {
            const mapping = {
                'win-rate': `${Number(stableStats.winRate).toFixed(0)}%`,
                'avg-drive-rush-attempts': `${Number(stableStats.avgDriveRushAttempts || 0).toFixed(1)}`,
                'drive-impact-success-rate': `${Number(stableStats.driveImpactSuccessRate || 0).toFixed(1)}%`,
                'burnout-frequency': `${Number(stableStats.burnoutFrequency || 0).toFixed(1)}`,
                'anti-air-success-rate': `${Number(stableStats.antiAirSuccessRate || 0).toFixed(1)}%`,
                'throw-tech-rate': `${Number(stableStats.throwTechRate || 0).toFixed(1)}%`,
                'games-played': `${parseInt(stableStats.gamesPlayed, 10)}`
            };
            Object.entries(mapping).forEach(([id, value]) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            });
            // チャート初期化（保存している場合のみ）
            if (this.playerStatsManager) {
                this.playerStatsManager.loadStatsToUI();
            }
        }
    }
    
    generateRandomStat(min, max, suffix = '', decimals = 0) {
        const value = Math.random() * (max - min) + min;
        return decimals > 0 ? value.toFixed(decimals) + suffix : Math.floor(value) + suffix;
    }
    
    clearGameData() {
        const playerGame = document.getElementById('player-game');
        const currentGameName = document.getElementById('current-game-name');
        
        if (playerGame) playerGame.textContent = 'ゲーム未選択';
        if (currentGameName) currentGameName.textContent = 'ゲームを選択してください';
        
        // 統計を「-」に戻す
        ['win-rate', 'avg-drive-rush-attempts', 'drive-impact-success-rate', 'burnout-frequency', 'anti-air-success-rate', 'throw-tech-rate', 'games-played'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '-';
        });
    }
    
    showGameSelectionGuidance() {
        const guidance = document.getElementById('game-selection-guidance');
        if (guidance) {
            guidance.classList.remove('hidden');
        }
    }
    
    hideGameSelectionGuidance() {
        const guidance = document.getElementById('game-selection-guidance');
        if (guidance) {
            guidance.classList.add('hidden');
        }
    }

    // スキルレベル選択関連のメソッド
    showSkillSelector() {
        const selector = document.getElementById('skill-selector');
        if (selector) {
            selector.classList.remove('hidden');
            // スキルレベルオプションのクリックイベントを設定
            this.setupSkillOptions();
        }
    }

    hideSkillSelector() {
        const selector = document.getElementById('skill-selector');
        if (selector) {
            selector.classList.add('hidden');
            // 選択状態をクリア
            const skillOptions = document.querySelectorAll('.skill-option');
            skillOptions.forEach(option => option.classList.remove('selected'));
        }
    }

    setupSkillOptions() {
        const skillOptions = document.querySelectorAll('.skill-option');
        skillOptions.forEach(option => {
            option.addEventListener('click', () => {
                this.selectSkillLevel(option);
            });
        });
    }

    selectSkillLevel(skillOption) {
        // 他のオプションの選択を解除
        const allOptions = document.querySelectorAll('.skill-option');
        allOptions.forEach(option => option.classList.remove('selected'));

        // 選択したオプションをハイライト
        skillOption.classList.add('selected');
    }

    confirmSkillSelection() {
        const selectedOption = document.querySelector('.skill-option.selected');
        if (!selectedOption) {
            this.showToast('スキルレベルを選択してください', 'warning');
            return;
        }

        const skillLevel = selectedOption.dataset.skill;
        const skillInfo = this.getSkillLevelInfo(skillLevel);

        // LocalStorageに保存
        localStorage.setItem('playerSkillLevel', skillLevel);
        localStorage.setItem('playerSkillLevelData', JSON.stringify(skillInfo));

        // UIを更新
        this.updateSkillLevelUI(skillInfo);
        this.hideSkillSelector();

        this.showToast(`スキルレベルを${skillInfo.name}に設定しました`, 'success');

        // コーチングを更新
        this.refreshDailyCoaching();
    }

    getSkillLevelInfo(skillLevel) {
        const skillLevels = {
            beginner: {
                name: '初心者',
                description: '基本的なゲームメカニクスを学習中',
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>'
            },
            intermediate: {
                name: '中級者',
                description: 'ゲームの基本は理解し、上達を目指している',
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'
            },
            advanced: {
                name: '上級者',
                description: '高度な戦略と技術を身につけている',
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>'
            }
        };
        return skillLevels[skillLevel] || skillLevels.intermediate;
    }

    updateSkillLevelUI(skillInfo) {
        const currentSkillLevel = document.getElementById('current-skill-level');
        const currentSkillDescription = document.getElementById('current-skill-description');
        const currentSkillIcon = document.getElementById('current-skill-icon');

        if (currentSkillLevel) currentSkillLevel.textContent = skillInfo.name;
        if (currentSkillDescription) currentSkillDescription.textContent = skillInfo.description;
        if (currentSkillIcon) currentSkillIcon.textContent = skillInfo.icon;
    }

    initializeSkillLevel() {
        // 保存済みのスキルレベルがあれば復元
        const savedSkillLevel = localStorage.getItem('playerSkillLevel');
        const savedSkillData = localStorage.getItem('playerSkillLevelData');

        if (savedSkillLevel && savedSkillData) {
            const skillInfo = JSON.parse(savedSkillData);
            this.updateSkillLevelUI(skillInfo);
        } else {
            // デフォルトで中級者を設定
            const defaultSkill = this.getSkillLevelInfo('intermediate');
            this.updateSkillLevelUI(defaultSkill);
            localStorage.setItem('playerSkillLevel', 'intermediate');
            localStorage.setItem('playerSkillLevelData', JSON.stringify(defaultSkill));
        }
    }

    // 日替わりコーチング機能の初期化
    async initDailyCoaching() {
        // CoachingServiceを初期化
        if (typeof CoachingService !== 'undefined') {
            this.coachingService = new CoachingService();
        } else {
            console.warn('CoachingService not found');
            return;
        }

        // 日替わりコーチングを表示（非同期）
        await this.loadDailyCoaching();

        // 進捗統計を更新
        this.updateCoachingProgress();
    }

    async loadDailyCoaching() {
        if (!this.coachingService) return;

        try {
            // ユーザープロファイルを取得
            const userProfile = this.getUserProfile();

            if (!userProfile.gameGenre || !userProfile.skillLevel) {
                // プロファイルが設定されていない場合はプレースホルダーを表示
                this.showCoachingPlaceholder();
                return;
            }

            // ローディング状態を表示
            this.showCoachingLoading();

            // 本日のコーチングアドバイスを取得（非同期）
            const dailyAdvice = await this.coachingService.getDailyCoaching(userProfile);

            if (dailyAdvice) {
                this.displayCoachingAdvice(dailyAdvice);

                // ソース表示（デバッグ用）
                if (dailyAdvice.source === 'gemini') {
                    console.log('CoachingService: Using AI-generated advice');
                } else if (dailyAdvice.source === 'cached_fallback') {
                    this.showToast('レート制限のため、最近のアドバイスを表示しています', 'info');
                } else if (dailyAdvice.source === 'fallback') {
                    console.log('CoachingService: Using fallback static advice');
                }
            } else {
                this.showCoachingPlaceholder();
            }
        } catch (error) {
            console.error('Failed to load daily coaching:', error);
            this.showCoachingError(error);
        }
    }

    getUserProfile() {
        // ゲーム情報を取得
        const selectedGame = localStorage.getItem('selectedGame');
        const gameData = localStorage.getItem('selectedGameData');

        // スキルレベル情報を取得
        const skillLevel = localStorage.getItem('playerSkillLevel');

        // 目標情報を取得
        const currentGoals = this.getCurrentGoalsFromStorage();
        const weeklyGoals = this.getWeeklyGoalsFromStorage();

        let gameGenre = null;

        if (selectedGame && gameData) {
            const game = JSON.parse(gameData);
            // ゲームカテゴリをジャンルにマッピング
            const categoryToGenre = {
                'FPS': 'fps',
                'MOBA': 'moba',
                '格闘ゲーム': 'fighting',
                'ストラテジー': 'strategy'
            };
            gameGenre = categoryToGenre[game.category] || 'universal';
        }

        return {
            gameGenre,
            skillLevel: skillLevel || 'intermediate',
            currentGoals: currentGoals || [],
            weeklyGoals: weeklyGoals || []
        };
    }

    displayCoachingAdvice(advice) {
        // HTMLエレメントを取得
        const headlineEl = document.getElementById('coaching-headline');
        const coreContentEl = document.getElementById('coaching-core-content');
        const practicalStepEl = document.getElementById('coaching-practical-step');
        const dateEl = document.getElementById('coaching-date');
        const goalConnectionEl = document.getElementById('coaching-goal-connection');
        const goalConnectionContainer = document.getElementById('coaching-goal-connection-container');

        // コンテンツを更新
        if (headlineEl) headlineEl.textContent = advice.headline;
        if (coreContentEl) coreContentEl.textContent = advice.coreContent;
        if (practicalStepEl) practicalStepEl.textContent = advice.practicalStep;
        if (dateEl) {
            const today = new Date();
            dateEl.textContent = `${today.getMonth() + 1}/${today.getDate()}`;
        }

        // 目標との関連性を表示
        if (goalConnectionEl && goalConnectionContainer && advice.goalConnection) {
            goalConnectionEl.textContent = advice.goalConnection;
            goalConnectionContainer.style.display = 'block';
        } else if (goalConnectionContainer) {
            goalConnectionContainer.style.display = 'none';
        }

        // 今日のアドバイスIDを保存（フィードバック用）
        this.currentAdviceId = advice.id;

        // フィードバックボタンの状態を復元
        this.restoreFeedbackState();
    }

    showCoachingPlaceholder() {
        const headlineEl = document.getElementById('coaching-headline');
        const coreContentEl = document.getElementById('coaching-core-content');
        const practicalStepEl = document.getElementById('coaching-practical-step');

        if (headlineEl) headlineEl.textContent = 'コーチングを準備中...';
        if (coreContentEl) {
            coreContentEl.textContent = 'ゲームを選択してスキルレベルを設定すると、パーソナライズされたコーチングアドバイスが表示されます。';
        }
        if (practicalStepEl) {
            practicalStepEl.textContent = '設定を完了して、今日のアドバイスを受け取りましょう！';
        }

        this.currentAdviceId = null;
    }

    showCoachingLoading() {
        const headlineEl = document.getElementById('coaching-headline');
        const coreContentEl = document.getElementById('coaching-core-content');
        const practicalStepEl = document.getElementById('coaching-practical-step');

        if (headlineEl) headlineEl.textContent = 'AIが今日のアドバイスを生成中...';
        if (coreContentEl) {
            coreContentEl.textContent = 'あなたのプロフィールとフィードバック履歴を分析して、最適なコーチングアドバイスを作成しています。少々お待ちください。';
        }
        if (practicalStepEl) {
            practicalStepEl.textContent = '⏳ 生成中...';
        }

        this.currentAdviceId = null;
    }

    showCoachingError(error) {
        const headlineEl = document.getElementById('coaching-headline');
        const coreContentEl = document.getElementById('coaching-core-content');
        const practicalStepEl = document.getElementById('coaching-practical-step');

        if (headlineEl) headlineEl.textContent = 'コーチング取得中にエラーが発生しました';
        if (coreContentEl) {
            if (error.message && error.message.includes('Rate limit')) {
                coreContentEl.textContent = 'APIの利用制限に達しました。しばらく時間をおいてから再度お試しください。設定画面から手動でリフレッシュすることも可能です。';
            } else {
                coreContentEl.textContent = 'アドバイスの取得中に問題が発生しました。ネットワーク接続とAPI設定を確認してください。';
            }
        }
        if (practicalStepEl) {
            practicalStepEl.textContent = 'しばらくしてからページを再読み込みしてみてください。';
        }

        this.currentAdviceId = null;
    }

    // 初期設定モーダル関連のメソッド
    showInitialSetupModal() {
        const modal = document.getElementById('initial-setup-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.style.display = 'flex';
            this.currentSetupStep = 1;

            // VALORANT固定なので、ゲーム選択をスキップ
            this.selectedGameData = {
                id: 'valorant',
                name: 'VALORANT',
                icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
                category: 'FPS'
            };
            this.selectedSkillLevel = null;

            // 初期設定リスナーを設定
            this.setupInitialSetupListeners();
        }
    }

    closeInitialSetupModal() {
        const modal = document.getElementById('initial-setup-modal');
        if (modal) {
            modal.classList.add('hidden');
            modal.style.display = 'none';
        }
    }

    generateGameOptions() {
        console.log('generateGameOptions called');
        const gameGrid = document.getElementById('setup-game-grid');
        if (!gameGrid) {
            console.error('Game grid element not found');
            return;
        }
        if (!this.gameManager) {
            console.error('Game manager not initialized');
            return;
        }

        gameGrid.innerHTML = '';

        const gameCategories = this.gameManager.getGameCategories();
        console.log('Game categories:', gameCategories);

        let gameCount = 0;
        Object.keys(gameCategories).forEach(categoryId => {
            const category = gameCategories[categoryId];

            if (categoryId === 'other') return; // カスタムゲームは除外

            category.games.forEach(game => {
                const gameCard = document.createElement('div');
                gameCard.className = 'game-option-card';
                gameCard.dataset.gameId = game.id;
                gameCard.dataset.gameName = game.name;
                gameCard.dataset.gameIcon = game.icon;
                gameCard.dataset.gameCategory = category.name;

                gameCard.innerHTML = `
                    <div class="game-icon">${game.icon}</div>
                    <div class="game-name">${game.name}</div>
                    <div class="game-category">${category.name}</div>
                `;

                gameCard.addEventListener('click', () => {
                    console.log('Game card clicked:', game.name);
                    this.selectSetupGame(gameCard);
                });

                gameGrid.appendChild(gameCard);
                gameCount++;
            });
        });

        console.log(`Generated ${gameCount} game cards`);
    }

    selectSetupGame(gameCard) {
        console.log('selectSetupGame called, gameCard:', gameCard);

        // 他のカードの選択を解除
        const allCards = document.querySelectorAll('.game-option-card');
        allCards.forEach(card => card.classList.remove('selected'));

        // 選択したカードをハイライト
        gameCard.classList.add('selected');

        // ゲームデータを保存
        this.selectedGameData = {
            id: gameCard.dataset.gameId,
            name: gameCard.dataset.gameName,
            icon: gameCard.dataset.gameIcon,
            category: gameCard.dataset.gameCategory
        };

        console.log('Selected game data:', this.selectedGameData);

        // 次へボタンを有効化
        const nextBtn = document.getElementById('setup-game-next');
        if (nextBtn) {
            nextBtn.disabled = false;
            console.log('Next button enabled');
        } else {
            console.error('Next button not found');
        }
    }

    selectSetupSkill(skillCard) {
        // 他のカードの選択を解除
        const allCards = document.querySelectorAll('.skill-card');
        allCards.forEach(card => card.classList.remove('selected'));

        // 選択したカードをハイライト
        skillCard.classList.add('selected');

        // スキルレベルを保存
        this.selectedSkillLevel = skillCard.dataset.skill;

        // 完了ボタンを有効化
        const completeBtn = document.getElementById('setup-skill-complete');
        if (completeBtn) {
            completeBtn.disabled = false;
        }
    }

    nextToSkillSelection() {
        console.log('nextToSkillSelection called, selectedGameData:', this.selectedGameData);

        if (!this.selectedGameData) {
            console.error('No game selected, cannot proceed to skill selection');
            this.showToast('ゲームを選択してください', 'warning');
            return;
        }

        // ステップ1を非表示、ステップ2を表示
        document.getElementById('setup-step-1').classList.add('hidden');
        document.getElementById('setup-step-2').classList.remove('hidden');

        // プログレスバーを更新
        this.updateSetupProgress(2);

        this.currentSetupStep = 2;
        console.log('Moved to step 2');
    }

    backToGameSelection() {
        // ステップ2を非表示、ステップ1を表示
        document.getElementById('setup-step-2').classList.add('hidden');
        document.getElementById('setup-step-1').classList.remove('hidden');

        // プログレスバーを更新
        this.updateSetupProgress(1);

        this.currentSetupStep = 1;
    }

    completeInitialSetup() {
        if (!this.selectedSkillLevel) return;

        // VALORANT固定なので、ゲームデータを自動設定
        this.selectedGameData = {
            id: 'valorant',
            name: 'VALORANT',
            icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
            category: 'FPS'
        };

        // 設定を保存
        localStorage.setItem('selectedGame', this.selectedGameData.id);
        localStorage.setItem('selectedGameData', JSON.stringify(this.selectedGameData));
        localStorage.setItem('playerSkillLevel', this.selectedSkillLevel);

        const skillInfo = this.getSkillLevelInfo(this.selectedSkillLevel);
        localStorage.setItem('playerSkillLevelData', JSON.stringify(skillInfo));

        // 初回設定完了フラグを設定
        localStorage.setItem('initialSetupCompleted', 'true');

        // ゲーム選択ガイダンスを非表示に
        this.hideGameSelectionGuidance();

        // 完了画面を表示
        this.showSetupCompletion();
    }

    showSetupCompletion() {
        // すべてのステップを非表示にして完了画面を表示
        document.getElementById('setup-step-1').classList.add('hidden');
        document.getElementById('setup-step-complete').classList.remove('hidden');

        // プログレスバーを完了状態に
        this.updateSetupProgress(3);

        // サマリーを更新
        const summaryGame = document.getElementById('summary-game');
        const summarySkill = document.getElementById('summary-skill');

        if (summaryGame) summaryGame.textContent = this.selectedGameData.name;
        if (summarySkill) {
            const skillInfo = this.getSkillLevelInfo(this.selectedSkillLevel);
            summarySkill.textContent = skillInfo.name;
        }
    }

    updateSetupProgress(step) {
        const progressFill = document.getElementById('setup-progress-fill');
        const progressText = document.getElementById('setup-progress-text');

        if (progressFill && progressText) {
            switch (step) {
                case 1:
                    progressFill.style.width = '33%';
                    progressText.textContent = 'ステップ 1 / 3';
                    break;
                case 2:
                    progressFill.style.width = '66%';
                    progressText.textContent = 'ステップ 2 / 3';
                    break;
                case 3:
                    progressFill.style.width = '100%';
                    progressText.textContent = '完了';
                    break;
            }
        }
    }

    async startApp() {
        // 初期設定モーダルを閉じる
        this.closeInitialSetupModal();

        // 完了メッセージを表示し、ページをリロードして初期化プロセスを再実行
        this.showToast('設定を保存しました。アプリを起動します...', 'success');
        setTimeout(() => {
            window.location.reload();
        }, 1000); // 1秒待ってからリロード
    }

    setupInitialSetupListeners() {
        console.log('Setting up initial setup listeners...');

        // 既存のリスナーをクリア（重複防止）
        this.clearInitialSetupListeners();

        // VALORANT専用なので、ゲーム選択ステップは不要

        // スキル完了ボタン
        const skillCompleteBtn = document.getElementById('setup-skill-complete');
        if (skillCompleteBtn) {
            this.skillCompleteHandler = () => {
                this.completeInitialSetup();
            };
            skillCompleteBtn.addEventListener('click', this.skillCompleteHandler);
        }

        // アプリ開始ボタン
        const startAppBtn = document.getElementById('setup-start-app');
        if (startAppBtn) {
            this.startAppHandler = async () => {
                await this.startApp();
            };
            startAppBtn.addEventListener('click', this.startAppHandler);
        }

        // スキルカードのクリックイベント
        const skillCards = document.querySelectorAll('.skill-card');
        skillCards.forEach(card => {
            const skillHandler = () => {
                this.selectSetupSkill(card);
            };
            card.addEventListener('click', skillHandler);
            // ハンドラーを保存（後でクリーンアップ用）
            card._skillHandler = skillHandler;
        });
    }

    clearInitialSetupListeners() {
        // VALORANT専用なので、ゲーム選択関連のリスナーは不要

        // スキル完了ボタンのリスナーを削除
        const skillCompleteBtn = document.getElementById('setup-skill-complete');
        if (skillCompleteBtn && this.skillCompleteHandler) {
            skillCompleteBtn.removeEventListener('click', this.skillCompleteHandler);
        }

        // アプリ開始ボタンのリスナーを削除
        const startAppBtn = document.getElementById('setup-start-app');
        if (startAppBtn && this.startAppHandler) {
            startAppBtn.removeEventListener('click', this.startAppHandler);
        }

        // スキルカードのリスナーを削除
        const skillCards = document.querySelectorAll('.skill-card');
        skillCards.forEach(card => {
            if (card._skillHandler) {
                card.removeEventListener('click', card._skillHandler);
                delete card._skillHandler;
            }
        });
    }

    // 不要になったデバッグメソッド（UIの簡略化により削除）
    // debugButtonStates() {
    //     console.log('=== Button States Debug ===');
    //     const skillBackBtn = document.getElementById('setup-skill-back');
    //     const skillCompleteBtn = document.getElementById('setup-skill-complete');
    //     console.log('Skill back button found:', !!skillBackBtn);
    //     console.log('Skill complete button found:', !!skillCompleteBtn);
    //     console.log('=== End Button Debug ===');
    // }

    // 初回設定が必要かチェック（VALORANT専用）
    needsInitialSetup() {
        const setupCompleted = localStorage.getItem('initialSetupCompleted');
        console.log('Setup check - setupCompleted:', setupCompleted);

        // 明示的に初期設定完了フラグがtrueの場合は不要
        if (setupCompleted === 'true') {
            return false;
        }

        // VALORANT専用なので、スキルレベルのみをチェック
        const hasSkill = localStorage.getItem('skillLevel') || localStorage.getItem('playerSkillLevel');

        console.log('Setup check - hasSkill:', hasSkill);

        // スキルレベルが設定されていない場合のみ初期設定が必要
        return !hasSkill;
    }

    setupCoachingFeedbackListeners() {
        const feedbackButtons = document.querySelectorAll('.feedback-btn');

        feedbackButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const feedbackType = button.dataset.feedback;
                this.handleCoachingFeedback(feedbackType, button);
            });
        });

        // コメント機能のリスナー
        this.setupCommentFeedbackListeners();
        
        // 履歴機能のリスナー
        this.setupCoachingHistoryListeners();
    }
    
    // 履歴機能のイベントリスナー設定
    setupCoachingHistoryListeners() {
        const historyButton = document.getElementById('history-button');
        const closeModalButton = document.getElementById('close-modal-button');
        const modalOverlay = document.getElementById('modal-overlay');
        const searchInput = document.getElementById('search-history-input');
        
        // 履歴ボタンクリック
        if (historyButton) {
            historyButton.addEventListener('click', () => {
                this.showCoachingHistoryModal();
            });
        }
        
        // 閉じるボタンクリック
        if (closeModalButton) {
            closeModalButton.addEventListener('click', () => {
                this.hideCoachingHistoryModal();
            });
        }
        
        // オーバーレイクリック
        if (modalOverlay) {
            modalOverlay.addEventListener('click', () => {
                this.hideCoachingHistoryModal();
            });
        }
        
        // 検索入力
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterCoachingHistory(e.target.value);
            });
        }
    }
    
    // 履歴モーダルを表示
    showCoachingHistoryModal() {
        const modal = document.getElementById('history-modal');
        const overlay = document.getElementById('modal-overlay');
        
        if (modal && overlay) {
            // 履歴を読み込んで表示
            this.displayCoachingHistory();
            
            // モーダルとオーバーレイを表示
            modal.style.display = 'flex';
            overlay.style.display = 'block';
            
            // アニメーション用に少し遅延
            setTimeout(() => {
                modal.style.opacity = '1';
                overlay.style.opacity = '1';
            }, 10);
        }
    }
    
    // 履歴モーダルを非表示
    hideCoachingHistoryModal() {
        const modal = document.getElementById('history-modal');
        const overlay = document.getElementById('modal-overlay');
        const searchInput = document.getElementById('search-history-input');
        
        if (modal && overlay) {
            // フェードアウト
            modal.style.opacity = '0';
            overlay.style.opacity = '0';
            
            setTimeout(() => {
                modal.style.display = 'none';
                overlay.style.display = 'none';
                
                // 検索入力をクリア
                if (searchInput) {
                    searchInput.value = '';
                }
            }, 300);
        }
    }
    
    // 履歴を表示
    displayCoachingHistory(keyword = '') {
        const container = document.getElementById('history-list-container');
        if (!container || !this.coachingService) return;
        
        // 履歴を取得（検索キーワードがあれば絞り込み）
        const history = keyword 
            ? this.coachingService.searchHistory(keyword)
            : this.coachingService.getHistory();
        
        // コンテナをクリア
        container.innerHTML = '';
        
        // 履歴がない場合
        if (history.length === 0) {
            if (keyword) {
                container.innerHTML = `
                    <div class="no-results-message">
                        <div class="search-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>
                        <h4>"${keyword}" に一致する履歴が見つかりませんでした</h4>
                        <p>別のキーワードで検索してみてください</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="no-history-message">
                        <h4>まだ履歴がありません</h4>
                        <p>コーチングアドバイスが生成されると、ここに履歴が表示されます</p>
                    </div>
                `;
            }
            return;
        }
        
        // 履歴アイテムを生成
        history.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'history-item';
            
            // 日付のフォーマット
            const date = new Date(item.timestamp);
            const dateStr = date.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            itemEl.innerHTML = `
                <div class="history-item-header">
                    <span class="history-item-date">${dateStr}</span>
                </div>
                <div class="history-item-headline">${item.headline}</div>
                <div class="history-item-content">${item.coreContent}</div>
                <div class="history-item-step">
                    <strong>実践ステップ:</strong> ${item.practicalStep}
                </div>
                ${item.goalConnection ? `
                <div class="history-item-goal">
                    <strong><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> 目標との関連:</strong> ${item.goalConnection}
                </div>
                ` : ''}
            `;
            
            container.appendChild(itemEl);
        });
    }
    
    // 履歴を絞り込み
    filterCoachingHistory(keyword) {
        this.displayCoachingHistory(keyword);
    }

    setupCommentFeedbackListeners() {
        const commentTextarea = document.getElementById('feedback-comment');
        const submitBtn = document.getElementById('submit-feedback-btn');
        const cancelBtn = document.getElementById('cancel-feedback-btn');
        const charCountSpan = document.getElementById('comment-char-count');

        // テキストエリアの文字数カウント
        if (commentTextarea && charCountSpan) {
            commentTextarea.addEventListener('input', (e) => {
                const count = e.target.value.length;
                charCountSpan.textContent = count;

                // ボタン状態の更新
                if (submitBtn) {
                    submitBtn.disabled = count === 0 || count > 500;
                }

                // 文字数警告の色変更
                const counter = document.querySelector('.comment-counter');
                if (counter) {
                    counter.classList.remove('warning', 'error');
                    if (count > 450) {
                        counter.classList.add('warning');
                    }
                    if (count > 500) {
                        counter.classList.add('error');
                    }
                }
            });
        }

        // フィードバック送信ボタン
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.submitFeedbackWithComment();
            });
        }

        // キャンセルボタン
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.cancelFeedbackComment();
            });
        }
    }

    handleCoachingFeedback(feedbackType, buttonEl) {
        if (!this.coachingService || !this.currentAdviceId) {
            this.showToast('フィードバックを送信できませんでした', 'error');
            return;
        }

        // 選択されたフィードバックタイプを保存
        this.selectedFeedbackType = feedbackType;
        this.selectedFeedbackButton = buttonEl;

        // ボタンの状態を更新
        this.updateFeedbackButtonState(buttonEl);

        // コメントセクションを表示
        this.showCommentSection();
    }

    showCommentSection() {
        const commentSection = document.getElementById('feedback-comment-section');
        const commentTextarea = document.getElementById('feedback-comment');

        if (commentSection) {
            commentSection.style.display = 'block';
            commentSection.classList.add('show');

            // フォーカスをテキストエリアに
            if (commentTextarea) {
                setTimeout(() => {
                    commentTextarea.focus();
                }, 200);
            }
        }
    }

    hideCommentSection() {
        const commentSection = document.getElementById('feedback-comment-section');
        if (commentSection) {
            commentSection.classList.remove('show');
            setTimeout(() => {
                commentSection.style.display = 'none';
            }, 300);
        }
    }

    submitFeedbackWithComment() {
        if (!this.coachingService || !this.currentAdviceId || !this.selectedFeedbackType) {
            this.showToast('フィードバックを送信できませんでした', 'error');
            return;
        }

        const commentTextarea = document.getElementById('feedback-comment');
        const comment = commentTextarea ? commentTextarea.value.trim() : '';

        // フィードバックを記録（コメント付き）
        this.coachingService.recordFeedback(this.currentAdviceId, this.selectedFeedbackType, comment);

        // 進捗統計を更新
        setTimeout(() => {
            this.updateCoachingProgress();
        }, 150);

        // UIをリセット
        this.hideCommentSection();
        this.resetCommentForm();

        // トーストメッセージを表示
        const feedbackMessages = {
            helpful: 'フィードバックありがとうございます！',
            too_easy: '次回はより挑戦的なアドバイスを提供します',
            too_hard: '次回はより基本的なアドバイスを提供します'
        };

        let message = feedbackMessages[this.selectedFeedbackType];
        if (comment.length > 0) {
            message += '\nコメントは明日のコーチングに反映されます！';
        }

        this.showToast(message, 'success');

        // 変数をクリア
        this.selectedFeedbackType = null;
        this.selectedFeedbackButton = null;
    }

    cancelFeedbackComment() {
        // フィードバックボタンの選択状態をリセット
        if (this.selectedFeedbackButton) {
            this.resetFeedbackButtons();
        }

        // コメントセクションを隠す
        this.hideCommentSection();
        this.resetCommentForm();

        // 変数をクリア
        this.selectedFeedbackType = null;
        this.selectedFeedbackButton = null;
    }

    resetCommentForm() {
        const commentTextarea = document.getElementById('feedback-comment');
        const charCountSpan = document.getElementById('comment-char-count');
        const submitBtn = document.getElementById('submit-feedback-btn');
        const counter = document.querySelector('.comment-counter');

        if (commentTextarea) {
            commentTextarea.value = '';
        }

        if (charCountSpan) {
            charCountSpan.textContent = '0';
        }

        if (submitBtn) {
            submitBtn.disabled = true;
        }

        if (counter) {
            counter.classList.remove('warning', 'error');
        }
    }

    updateFeedbackButtonState(selectedButton) {
        // すべてのフィードバックボタンから選択状態を削除
        const allButtons = document.querySelectorAll('.feedback-btn');
        allButtons.forEach(btn => {
            btn.classList.remove('selected');
            this.updateFeedbackButtonText(btn, false); // テキストもリセット
        });

        // 選択されたボタンに選択状態を追加
        selectedButton.classList.add('selected');
        this.updateFeedbackButtonText(selectedButton, true); // 選択状態のテキストに変更
    }

    resetFeedbackButtons() {
        const allButtons = document.querySelectorAll('.feedback-btn');
        allButtons.forEach(btn => {
            btn.classList.remove('selected');
            this.updateFeedbackButtonText(btn, false); // テキストもリセット
        });
    }

    // 今日のフィードバック状態を復元
    restoreFeedbackState() {
        if (!this.coachingService) return;

        const feedbackStatus = this.coachingService.getTodaysFeedbackStatus();

        if (feedbackStatus.hasFeedback) {
            // 該当するフィードバックボタンを選択状態にする
            const targetButton = document.querySelector(`.feedback-btn[data-feedback="${feedbackStatus.feedbackType}"]`);
            if (targetButton) {
                this.resetFeedbackButtons(); // まず全てリセット
                targetButton.classList.add('selected'); // 今日のフィードバックを選択状態に
                this.updateFeedbackButtonText(targetButton, true); // 選択状態のテキストに更新
            }
        } else {
            // フィードバックがない場合は全てリセット
            this.resetFeedbackButtons();
        }
    }

    // フィードバックボタンのテキストを更新
    updateFeedbackButtonText(button, isSelected) {
        const feedbackType = button.dataset.feedback;
        const originalTexts = {
            helpful: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg> 役に立った',
            too_easy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> 簡単すぎた',
            too_hard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg> 難しすぎた'
        };
        const selectedTexts = {
            helpful: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 役に立った',
            too_easy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 簡単すぎた',
            too_hard: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 難しすぎた'
        };

        if (isSelected) {
            button.innerHTML = selectedTexts[feedbackType] || button.innerHTML;
        } else {
            button.innerHTML = originalTexts[feedbackType] || button.innerHTML;
        }
    }

    updateCoachingProgress() {
        if (!this.coachingService) return;

        const stats = this.coachingService.getProgressStats();

        const continuousDaysEl = document.getElementById('continuous-days');
        const totalLessonsEl = document.getElementById('total-lessons');

        if (continuousDaysEl) continuousDaysEl.textContent = stats.continuousLearningDays;
        if (totalLessonsEl) totalLessonsEl.textContent = stats.totalLessons;
    }

    // ゲームやスキルレベル変更時にコーチングを更新
    async refreshDailyCoaching() {
        if (this.coachingService) {
            await this.loadDailyCoaching();
        }
    }

    // アプリ全体の初期化（データ消去）
    async resetAppData() {
        // SweetAlert2を使用したリッチな確認ダイアログ
        const result = await Swal.fire({
            title: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> データ初期化の確認',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <p style="font-size: 16px; margin-bottom: 15px;">
                        アプリを初期化します。以下のデータが<strong>完全に削除</strong>されます:
                    </p>
                    <ul style="list-style: none; padding: 0;">
                        <li style="padding: 8px 0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg> 保存された試合データ</li>
                        <li style="padding: 8px 0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> 設定した目標</li>
                        <li style="padding: 8px 0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg> APIキー設定</li>
                        <li style="padding: 8px 0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> すべての統計情報</li>
                        <li style="padding: 8px 0;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> アプリケーション設定</li>
                    </ul>
                    <p style="font-size: 14px; color: #e74c3c; margin-top: 15px; font-weight: bold;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> この操作は取り消せません
                    </p>
                </div>
            `,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '初期化する',
            cancelButtonText: 'キャンセル',
            confirmButtonColor: '#e74c3c',
            cancelButtonColor: '#95a5a6',
            reverseButtons: true,
            focusCancel: true,
            customClass: {
                confirmButton: 'swal2-confirm-danger',
                popup: 'swal2-popup-custom'
            }
        });

        // キャンセルされた場合は処理を中止
        if (!result.isConfirmed) {
            return;
        }

        try {
            // ローディング表示
            Swal.fire({
                title: 'データを初期化中...',
                html: 'しばらくお待ちください',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // localStorage を完全にクリア
            localStorage.clear();

            // sessionStorage もクリア
            sessionStorage.clear();

            // 内部サービスのクリーンアップ
            if (this.geminiService && typeof this.geminiService.clearApiKey === 'function') {
                try { this.geminiService.clearApiKey(); } catch (e) { console.debug(e); }
            }
            if (window.unifiedApiManager && typeof window.unifiedApiManager.clearAPIKey === 'function') {
                try { window.unifiedApiManager.clearAPIKey(); } catch (e) { console.debug(e); }
            }

            // テーマをデフォルトに戻す
            this.currentTheme = 'dark';
            this.applyTheme(this.currentTheme);

            // 成功メッセージを表示してリロード
            await Swal.fire({
                title: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 初期化完了',
                text: 'アプリケーションを初期化しました。ページを再読み込みします。',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
            });

            // ページをリロード
            setTimeout(() => window.location.reload(), 500);
            
        } catch (e) {
            console.error('Failed to reset app:', e);
            
            // エラーメッセージを表示
            await Swal.fire({
                title: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> エラー',
                text: '初期化に失敗しました。ページを手動で再読み込みしてください。',
                icon: 'error',
                confirmButtonText: 'OK'
            });
        }
    }

    // === ダッシュボード目標表示機能 ===
    initDashboardGoals() {
        console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Initializing dashboard goals...');

        // 既存の目標データをチェック・修正
        this.checkAndFixGoalsData();

        // イベントリスナー設定
        const viewAllGoalsBtn = document.getElementById('view-all-goals');
        const addFirstGoalBtn = document.getElementById('add-first-goal');

        if (viewAllGoalsBtn) {
            viewAllGoalsBtn.addEventListener('click', () => {
                this.showPage('goals');
                this.updateNavigation('goals');
            });
        }

        if (addFirstGoalBtn) {
            addFirstGoalBtn.addEventListener('click', () => {
                this.showPage('goals');
                this.updateNavigation('goals');
            });
        }

        // 目標データを読み込み
        this.loadDashboardGoals();

        // LocalStorageの変更を監視
        this.setupGoalsStorageListener();
    }

    // 目標データの整合性をチェック・修正
    checkAndFixGoalsData() {
        try {
            const goalsData = localStorage.getItem('goals');
            if (!goalsData) return;

            const goals = JSON.parse(goalsData);
            let dataFixed = false;

            console.log('🔧 Checking goals data integrity...');

            const fixedGoals = goals.map(goal => {
                // 進捗値が不正な場合の修正
                if (typeof goal.progress !== 'number' || isNaN(goal.progress) || goal.progress < 0 || goal.progress > 100) {
                    console.log(`🔧 Fixing invalid progress for goal "${goal.title}": ${goal.progress} → 0`);
                    goal.progress = 0;
                    dataFixed = true;
                }

                // IDが存在しない場合の修正
                if (!goal.id) {
                    goal.id = Date.now() + Math.random();
                    dataFixed = true;
                }

                // createdAtが存在しない場合、現在の日付から推定して設定
                if (!goal.createdAt) {
                    const deadline = new Date(goal.deadline);
                    const now = new Date();

                    // 期限から遡って適切な作成日を推定
                    // 期限が未来の場合：今日から2週間前を作成日とする
                    // 期限が過去の場合：期限の1ヶ月前を作成日とする
                    let estimatedCreatedAt;
                    if (deadline > now) {
                        estimatedCreatedAt = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000)); // 2週間前
                    } else {
                        estimatedCreatedAt = new Date(deadline.getTime() - (30 * 24 * 60 * 60 * 1000)); // 1ヶ月前
                    }

                    goal.createdAt = estimatedCreatedAt.toISOString();
                    console.log(`🔧 Setting estimated createdAt for goal "${goal.title}": ${goal.createdAt.split('T')[0]}`);
                    dataFixed = true;
                }

                return goal;
            });

            if (dataFixed) {
                localStorage.setItem('goals', JSON.stringify(fixedGoals));
                console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Goals data has been fixed and saved');
            }
        } catch (error) {
            console.error('Error checking goals data:', error);
        }
    }
    
    loadDashboardGoals() {
        try {
            const goalsData = localStorage.getItem('goals');
            let goals = goalsData ? JSON.parse(goalsData) : [];

            console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Loading dashboard goals:', goals.length, 'goals found');

            // データのクリーンアップは初期化時のみ実行（無限ループ防止）
            this.renderDashboardGoals(goals);
        } catch (error) {
            console.warn('Failed to load goals:', error);
            this.renderDashboardGoals([]);
        }
    }
    
    renderDashboardGoals(goals) {
        const goalsList = document.getElementById('dashboard-goals-list');
        if (!goalsList) {
            console.error('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> dashboard-goals-list element not found');
            return;
        }

        if (goals.length === 0) {
            // 目標なし
            goalsList.innerHTML = `
                <div class="no-goals-message">
                    <h4>目標が設定されていません</h4>
                    <p>パフォーマンス向上のための目標を設定しましょう</p>
                    <button class="add-goal-btn" id="add-first-goal">最初の目標を追加</button>
                </div>
            `;

            // イベントリスナー再設定
            const addFirstGoalBtn = document.getElementById('add-first-goal');
            if (addFirstGoalBtn) {
                addFirstGoalBtn.addEventListener('click', () => {
                    this.showPage('goals');
                    this.updateNavigation('goals');
                });
            }

            return;
        }

        // 目標をソート（期限が近い順、進捗が低い順）
        const sortedGoals = goals.sort((a, b) => {
            const dateA = new Date(a.deadline);
            const dateB = new Date(b.deadline);
            const progressA = a.progress || 0;
            const progressB = b.progress || 0;

            // 期限が近い順
            if (dateA !== dateB) {
                return dateA - dateB;
            }

            // 進捗が低い順
            return progressA - progressB;
        });

        // 最大3件表示
        const displayGoals = sortedGoals.slice(0, 3);

        // HTMLを生成して挿入
        const html = displayGoals.map(goal => this.renderGoalItem(goal)).join('');
        goalsList.innerHTML = html;
    }
    
    renderGoalItem(goal) {
        // プランがある場合はプランの進捗を使用、なければ日数ベース
        let progress;
        if (goal.hasCoachingPlan && goal.planId && this.coachingPlanService) {
            const plan = this.coachingPlanService.getPlan(goal.planId);
            if (plan) {
                progress = this.calculatePlanProgress(plan);
            } else {
                progress = this.calculateProgressByDays(goal);
            }
        } else {
            progress = this.calculateProgressByDays(goal);
        }

        const deadline = new Date(goal.deadline).toLocaleDateString('ja-JP');
        const isUrgent = this.isDeadlineUrgent(goal.deadline);
        const urgentClass = isUrgent ? 'urgent' : '';

        // デバッグ時のみログ出力
        if (window.DEBUG_GOALS) {
            console.log(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Rendering "${goal.title}": ${progress}%`);
        }

        return `
            <div class="dashboard-goal-item ${urgentClass}">
                <div class="goal-item-header">
                    <h5 class="goal-item-title">${goal.title}</h5>
                    <span class="goal-item-deadline">〜 ${deadline}</span>
                </div>
                <div class="goal-progress-container">
                    <div class="goal-progress-bar">
                        <div class="goal-progress-fill" style="width: ${progress}%;"></div>
                    </div>
                    <div class="goal-progress-text">${progress}%</div>
                </div>
            </div>
        `;
    }
    
    isDeadlineUrgent(deadline) {
        const now = new Date();
        const deadlineDate = new Date(deadline);
        const diffDays = (deadlineDate - now) / (1000 * 60 * 60 * 24);
        return diffDays <= 7; // 7日以内は緊急
    }

    // 日数ベースの進捗計算
    calculateProgressByDays(goal) {
        try {
            const now = new Date();
            const createdAt = goal.createdAt ? new Date(goal.createdAt) : null;
            const deadline = new Date(goal.deadline);

            // 作成日が設定されていない場合はデフォルト値を返す
            if (!createdAt) {
                return 0;
            }

            // 期限が過去の場合は100%
            if (deadline <= now) {
                return 100;
            }

            // 作成日が未来の場合（データエラー）は作成日を今日に修正
            if (createdAt > now) {
                console.warn(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Goal "${goal.title}" has future createdAt, fixing to today`);
                createdAt = now;
            }

            // 総日数と経過日数を計算
            const totalDays = (deadline - createdAt) / (1000 * 60 * 60 * 24);
            const elapsedDays = (now - createdAt) / (1000 * 60 * 60 * 24);

            // 進捗率を計算（0-100%の範囲に制限）
            const progress = Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));

            // デバッグ時のみ詳細ログ
            if (window.DEBUG_GOALS) {
                console.log(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Progress: "${goal.title}" = ${Math.round(progress)}% (${elapsedDays.toFixed(1)}/${totalDays.toFixed(1)} days)`);
            }

            return Math.round(progress);
        } catch (error) {
            console.error('Error calculating progress:', error);
            return goal.progress || 0;
        }
    }
    
    setupGoalsStorageListener() {
        // 重複リスナー防止のフラグ
        if (this.goalsListenerSetup) {
            return;
        }
        this.goalsListenerSetup = true;

        // LocalStorageの変更を監視（他のタブからの変更のみ）
        window.addEventListener('storage', (e) => {
            if (e.key === 'goals') {
                console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Storage event detected from another tab');
                this.loadDashboardGoals();
            }
        });

        console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Goals storage listener setup completed');
    }
    
    updateNavigation(pageId) {
        const navBtns = document.querySelectorAll('.nav-btn');
        navBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.page === pageId) {
                btn.classList.add('active');
            }
        });
    }

    // === ナビゲーション支援機能 ===
    initNavigationHelpers() {
        // 分析タブへのナビゲーションボタン
        const gotoAnalysisBtn = document.getElementById('goto-analysis');
        if (gotoAnalysisBtn) {
            gotoAnalysisBtn.addEventListener('click', () => {
                this.showPage('analysis');
                this.updateNavigation('analysis');
            });
        }
        
        // AI用目標設定ボタン
    }

    // === データソース管理機能 (Client-Side) ===
    loadDataSourcePage() {
        const files = this.getLocalDataSources();
        this.renderDataSources(files);
    }

    getLocalDataSources() {
        const sources = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('datasource-')) {
                sources.push(key.replace('datasource-', ''));
            }
        }
        return sources;
    }

    renderDataSources(files) {
        const listContainer = document.getElementById('data-source-list');
        if (!listContainer) return;

        if (files.length === 0) {
            listContainer.innerHTML = `<div class="no-files-message"><p>まだアップロードされたファイルがありません。</p></div>`;
            return;
        }

        listContainer.innerHTML = files.map(file => `
            <div class="data-source-item" data-filename="${file}">
                <span class="file-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg></span>
                <span class="file-name">${file}</span>
                <div class="file-actions">
                    <button class="btn-secondary btn-sm view-file-btn">表示</button>
                    <button class="btn-danger btn-sm delete-file-btn">削除</button>
                </div>
            </div>
        `).join('');

        listContainer.querySelectorAll('.view-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleViewFile(e));
        });
        listContainer.querySelectorAll('.delete-file-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleDeleteFile(e));
        });
    }

    async handleFileUpload(event) {
        event.preventDefault();
        const fileInput = document.getElementById('file-input');
        const uploadBtn = document.getElementById('upload-btn');
        const file = fileInput.files[0];

        if (!file) {
            this.showToast('ファイルを選択してください', 'warning');
            return;
        }

        uploadBtn.disabled = true;
        uploadBtn.textContent = '処理中...';

        const reader = new FileReader();

        reader.onload = async (e) => {
            try {
                let textContent;
                let filename = file.name;

                if (file.name.toLowerCase().endsWith('.docx')) {
                    if (typeof mammoth === 'undefined') {
                        throw new Error('DOCXパーサーがロードされていません。');
                    }
                    const arrayBuffer = e.target.result;
                    const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                    textContent = result.value;
                    filename = file.name.replace(/\.docx$/i, '.txt');
                } else {
                    textContent = e.target.result;
                }

                localStorage.setItem(`datasource-${filename}`, textContent);
                this.showToast(`「${filename}」をローカルに保存しました`, 'success');
                fileInput.value = ''; // Reset file input
                uploadBtn.disabled = true;
                this.loadDataSourcePage();
            } catch (err) {
                console.error('File processing error:', err);
                this.showToast(`ファイル処理エラー: ${err.message}`, 'error');
            } finally {
                uploadBtn.disabled = false;
                uploadBtn.textContent = 'アップロード';
            }
        };

        reader.onerror = () => {
            this.showToast('ファイルの読み込みに失敗しました', 'error');
            uploadBtn.disabled = false;
            uploadBtn.textContent = 'アップロード';
        };

        if (file.name.toLowerCase().endsWith('.docx')) {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
    }

    handleViewFile(event) {
        const filename = event.target.closest('.data-source-item').dataset.filename;
        const content = localStorage.getItem(`datasource-${filename}`);
        if (content) {
            alert(`Content of ${filename}:\n\n${content.substring(0, 1000)}...`);
        } else {
            this.showToast('ファイルの内容が見つかりませんでした', 'error');
        }
    }

    handleDeleteFile(event) {
        const filename = event.target.closest('.data-source-item').dataset.filename;
        if (confirm(`本当にローカルストレージから「${filename}」を削除しますか？`)) {
            localStorage.removeItem(`datasource-${filename}`);
            this.showToast('ファイルを削除しました', 'success');
            this.loadDataSourcePage();
        }
    }


    // === 目標管理支援機能（コーチング用） ===

    // 現在の目標をストレージから取得（コーチング用）
    getCurrentGoalsFromStorage() {
        try {
            const goals = JSON.parse(localStorage.getItem('goals') || '[]');
            // 今日以降の期限の目標を返す（現在進行中の目標）
            const today = new Date().toISOString().split('T')[0];
            return goals.filter(goal => {
                if (!goal.deadline) return true; // 期限なしは現在目標として扱う
                return goal.deadline >= today;
            });
        } catch (error) {
            console.warn('Failed to get current goals:', error);
            return [];
        }
    }

    // 今週の目標をストレージから取得（コーチング用）
    getWeeklyGoalsFromStorage() {
        try {
            const goals = JSON.parse(localStorage.getItem('goals') || '[]');
            // 今週内（今日から7日以内）の期限の目標を返す
            const today = new Date();
            const weekFromNow = new Date();
            weekFromNow.setDate(today.getDate() + 7);

            const todayStr = today.toISOString().split('T')[0];
            const weekFromNowStr = weekFromNow.toISOString().split('T')[0];

            return goals.filter(goal => {
                if (!goal.deadline) return false; // 期限なしは週間目標から除外
                return goal.deadline >= todayStr && goal.deadline <= weekFromNowStr;
            });
        } catch (error) {
            console.warn('Failed to get weekly goals:', error);
            return [];
        }
    }

    // === コーチングプラン機能 ===

    // プラン付き目標作成を開始
    handleCreateGoalWithPlan() {
        // 空の目標データでモーダルを開く（モーダル内で入力）
        const goalData = {
            title: '',
            deadline: '',
            description: '',
            gameGenre: this.getCurrentGameGenre(),
            skillLevel: this.getCurrentSkillLevel()
        };

        // プランモーダルを開く
        this.openCoachingPlanModal(goalData);
    }

    // 現在のゲームジャンルを取得
    getCurrentGameGenre() {
        const gameData = localStorage.getItem('selectedGameData');
        if (gameData) {
            const game = JSON.parse(gameData);
            const categoryToGenre = {
                'FPS': 'fps',
                'MOBA': 'moba',
                '格闘ゲーム': 'fighting',
                'ストラテジー': 'strategy'
            };
            return categoryToGenre[game.category] || 'universal';
        }
        return 'universal';
    }

    // 現在のスキルレベルを取得
    getCurrentSkillLevel() {
        return localStorage.getItem('playerSkillLevel') || 'intermediate';
    }

    // コーチングプランモーダルの初期化
    initCoachingPlanModal() {
        if (this.isCoachingPlanModalInitialized) {
            return;
        }

        // モーダルクローズ
        const closeModal = document.getElementById('close-plan-modal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeCoachingPlanModal();
            });
        }

        // 知識ベース再読み込みボタン
        const reloadKbBtn = document.getElementById('reload-kb-btn');
        if (reloadKbBtn) {
            reloadKbBtn.addEventListener('click', () => {
                this.reloadValorantKnowledgeBase();
            });
        }

        // AI生成ボタン
        const generateBtn = document.getElementById('generate-plan-btn');
        if (generateBtn) {
            generateBtn.addEventListener('click', () => {
                this.generatePlanWithAI();
            });
        }

        // 手動作成ボタン
        const manualBtn = document.getElementById('manual-plan-btn');
        if (manualBtn) {
            manualBtn.addEventListener('click', () => {
                this.createManualPlan();
            });
        }

        // プラン編集ボタン
        const editBtn = document.getElementById('edit-plan-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                this.editPlan();
            });
        }

        // プラン承認ボタン
        const approveBtn = document.getElementById('approve-plan-btn');
        if (approveBtn) {
            approveBtn.addEventListener('click', () => {
                this.approvePlan();
            });
        }

        // 再生成ボタン
        const regenerateBtn = document.getElementById('regenerate-plan-btn');
        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', () => {
                this.regeneratePlan();
            });
        }

        // プラン保存ボタン
        const saveBtn = document.getElementById('save-plan-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.savePlanEdits();
            });
        }

        // 編集キャンセルボタン
        const cancelEditBtn = document.getElementById('cancel-edit-btn');
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                this.cancelPlanEdit();
            });
        }

        this.isCoachingPlanModalInitialized = true;
    }

    // コーチングプランモーダルを開く
    openCoachingPlanModal(goalData) {
        this.currentGoalData = goalData;

        // 目標情報を表示
        this.displayGoalSummary(goalData);

        // Valorant知識ベースの状態を更新
        this.updateValorantKnowledgeStatus();

        // モーダルを表示
        const modal = document.getElementById('coaching-plan-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.showPlanStep('plan-generation-step');
        }
    }

    // Valorant知識ベースの状態を更新
    updateValorantKnowledgeStatus() {
        try {
            // LocalStorageからデータソースファイルを取得
            const datasourceKeys = Object.keys(localStorage).filter(key => key.startsWith('datasource-'));
            
            const statusText = document.getElementById('kb-status-text');
            const fileCount = document.getElementById('kb-file-count');
            const dataSize = document.getElementById('kb-data-size');
            const kbDetails = document.getElementById('kb-details');
            
            if (datasourceKeys.length > 0) {
                // データがある場合
                let totalSize = 0;
                datasourceKeys.forEach(key => {
                    const content = localStorage.getItem(key);
                    if (content) {
                        totalSize += content.length;
                    }
                });
                
                if (statusText) statusText.textContent = '有効';
                if (statusText) statusText.className = 'indicator-value active';
                if (fileCount) fileCount.textContent = datasourceKeys.length;
                if (dataSize) dataSize.textContent = totalSize.toLocaleString();
                if (kbDetails) kbDetails.classList.remove('hidden');
                
                console.log(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Valorant知識ベース: ${datasourceKeys.length}ファイル、${totalSize}文字`);
            } else {
                // データがない場合
                if (statusText) statusText.textContent = '未設定';
                if (statusText) statusText.className = 'indicator-value inactive';
                if (fileCount) fileCount.textContent = '0';
                if (dataSize) dataSize.textContent = '0';
                if (kbDetails) kbDetails.classList.remove('hidden');
                
                console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Valorant知識ベース: データなし');
            }
        } catch (error) {
            console.error('知識ベース状態更新エラー:', error);
        }
    }

    // Valorant知識ベースを再読み込み
    async reloadValorantKnowledgeBase() {
        try {
            const reloadBtn = document.getElementById('reload-kb-btn');
            if (reloadBtn) {
                reloadBtn.disabled = true;
                reloadBtn.textContent = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
                reloadBtn.classList.add('spinning');
            }
            
            // コーチングプランサービスの知識ベースを再読み込み
            if (this.coachingPlanService) {
                await this.coachingPlanService.loadValorantKnowledgeBase();
            }
            
            // 状態表示を更新
            this.updateValorantKnowledgeStatus();
            
            this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Valorant知識ベースを更新しました', 'success');
            
            setTimeout(() => {
                if (reloadBtn) {
                    reloadBtn.disabled = false;
                    reloadBtn.classList.remove('spinning');
                }
            }, 1000);
        } catch (error) {
            console.error('知識ベース再読み込みエラー:', error);
            this.showToast('知識ベースの更新に失敗しました', 'error');
            
            const reloadBtn = document.getElementById('reload-kb-btn');
            if (reloadBtn) {
                reloadBtn.disabled = false;
                reloadBtn.classList.remove('spinning');
            }
        }
    }

    // コーチングプランモーダルを閉じる
    closeCoachingPlanModal() {
        const modal = document.getElementById('coaching-plan-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.currentGoalData = null;
        this.currentPlan = null;
    }

    // 目標概要を表示（フォーム入力フィールドに初期値を設定）
    displayGoalSummary(goalData) {
        const titleInput = document.getElementById('modal-goal-title-input');
        const deadlineInput = document.getElementById('modal-goal-deadline-input');
        const descriptionInput = document.getElementById('modal-goal-description-input');

        if (titleInput && goalData.title) {
            titleInput.value = goalData.title;
        }
        if (deadlineInput && goalData.deadline) {
            deadlineInput.value = goalData.deadline;
        }
        if (descriptionInput && goalData.description) {
            descriptionInput.value = goalData.description;
        }

        // 期限の最小値を今日の日付に設定
        if (deadlineInput) {
            const today = new Date().toISOString().split('T')[0];
            deadlineInput.min = today;
        }
    }

    // プランステップを表示
    showPlanStep(stepId) {
        console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Switching to plan step:', stepId);

        // 全ステップを非表示
        document.querySelectorAll('.plan-step').forEach(step => {
            step.classList.remove('active');
            console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Removed active from step:', step.id);
        });

        // 指定ステップを表示
        const targetStep = document.getElementById(stepId);
        if (targetStep) {
            targetStep.classList.add('active');
            targetStep.classList.remove('hidden'); // hiddenクラスも削除
            console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Activated step:', stepId);
        } else {
            console.error('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> Target step not found:', stepId);
        }
    }

    // AIでプラン生成
    async generatePlanWithAI() {
        if (!this.coachingPlanService) {
            this.showToast('コーチングプランサービスが利用できません', 'error');
            return;
        }

        // モーダル内のフォームから目標データを取得
        const titleInput = document.getElementById('modal-goal-title-input');
        const deadlineInput = document.getElementById('modal-goal-deadline-input');
        const descriptionInput = document.getElementById('modal-goal-description-input');

        if (!titleInput || !deadlineInput) {
            this.showToast('フォーム要素が見つかりません', 'error');
            return;
        }

        const title = titleInput.value.trim();
        const deadline = deadlineInput.value;
        const description = descriptionInput ? descriptionInput.value.trim() : '';

        // 入力検証
        if (!title || !deadline) {
            this.showToast('目標タイトルと期限を入力してください', 'warning');
            return;
        }

        // 期限が過去の日付でないかチェック
        const deadlineDate = new Date(deadline);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (deadlineDate < today) {
            this.showToast('期限は本日以降の日付を設定してください', 'warning');
            return;
        }

        // 目標データを更新
        this.currentGoalData = {
            title: title,
            deadline: deadline,
            description: description,
            gameGenre: this.getCurrentGameGenre(),
            skillLevel: this.getCurrentSkillLevel()
        };

        this.showPlanGenerationLoading(true);

        try {
            const plan = await this.coachingPlanService.generateCoachingPlan(this.currentGoalData);
            this.currentPlan = plan;

            this.showToast('AIによるカスタムプランを生成しました！', 'success');
            this.displayGeneratedPlan(plan);
            this.showPlanStep('plan-review-step');
        } catch (error) {
            console.error('Failed to generate coaching plan:', error);

            let errorMessage = 'プラン生成に失敗しました: ';
            if (error.message.includes('APIキー')) {
                errorMessage += 'Gemini APIキーを設定してください。';
            } else if (error.message.includes('API')) {
                errorMessage += 'API接続に問題があります。';
            } else {
                errorMessage += error.message;
            }

            this.showToast(errorMessage, 'error');
        } finally {
            this.showPlanGenerationLoading(false);
        }
    }

    // プラン生成ローディング表示
    showPlanGenerationLoading(show) {
        const status = document.getElementById('generation-status');
        const buttons = document.getElementById('generation-buttons');

        if (status) {
            if (show) {
                status.classList.remove('hidden');
                status.style.display = 'block';
            } else {
                status.classList.add('hidden');
                status.style.display = 'none';
            }
        }
        if (buttons) {
            buttons.style.display = show ? 'none' : 'flex';
        }
    }

    // 生成されたプランを表示
    displayGeneratedPlan(plan) {
        console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> Displaying generated plan:', plan);

        // プラン統計を表示
        const weeksEl = document.getElementById('plan-total-weeks');
        const daysEl = document.getElementById('plan-total-days');

        if (weeksEl) {
            weeksEl.textContent = plan.weeks.length;
            console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Set weeks count:', plan.weeks.length);
        } else {
            console.error('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> plan-total-weeks element not found');
        }

        if (daysEl) {
            daysEl.textContent = plan.metadata.totalWeeks * 7;
            console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> Set days count:', plan.metadata.totalWeeks * 7);
        } else {
            console.error('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> plan-total-days element not found');
        }

        // 週別プランを表示
        console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Rendering week cards...');
        this.renderWeekCards(plan.weeks);
        
        // グラウンディング情報を表示
        if (plan.metadata?.groundingSources) {
            this.renderGroundingSources(plan.metadata.groundingSources);
        }
    }

    // 週別カードをレンダリング
    renderWeekCards(weeks) {
        const container = document.getElementById('weeks-container');
        if (!container) {
            console.error('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> weeks-container not found');
            return;
        }

        console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Found weeks container, clearing content...');
        container.innerHTML = '';

        console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Rendering', weeks.length, 'week cards...');
        weeks.forEach((week, index) => {
            console.log(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Creating week card ${index + 1}:`, week);
            const weekCard = this.createWeekCard(week);
            container.appendChild(weekCard);
        });

        console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> Week cards rendered successfully');
    }

    // グラウンディング情報を表示
    renderGroundingSources(groundingSources) {
        const container = document.getElementById('weeks-container');
        if (!container || !groundingSources || groundingSources.totalSources === 0) {
            return;
        }

        const sourcesCard = document.createElement('div');
        sourcesCard.className = 'grounding-sources-card';
        sourcesCard.innerHTML = `
            <div class="sources-header">
                <span class="sources-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span>
                <h4>参考にした最新情報（${groundingSources.totalSources}件）</h4>
            </div>
            <div class="sources-list">
                ${groundingSources.sources.slice(0, 5).map(source => `
                    <div class="source-item">
                        <a href="${source.url}" target="_blank" rel="noopener noreferrer">
                            ${source.title}
                        </a>
                        ${source.snippet ? `<p class="source-snippet">${source.snippet}</p>` : ''}
                    </div>
                `).join('')}
            </div>
            <p class="sources-note">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg> このコーチングプランは、上記の最新情報を参考に生成されました
            </p>
        `;

        container.appendChild(sourcesCard);
    }

    // 週カードを作成
    createWeekCard(week) {
        const card = document.createElement('div');
        card.className = 'week-card';

        card.innerHTML = `
            <div class="week-header">
                <span class="week-number">第${week.weekNumber}週</span>
                <span class="week-dates">${week.startDate} - ${week.endDate}</span>
            </div>
            <div class="week-focus">${week.focus}</div>
            <div class="week-objectives">
                <h5>目標</h5>
                <ul class="objectives-list">
                    ${week.objectives.map(obj => `<li>${obj}</li>`).join('')}
                </ul>
            </div>
            <div class="week-milestones">
                <h5>マイルストーン</h5>
                <ul class="milestones-list">
                    ${week.milestones.map(milestone => `<li>${milestone}</li>`).join('')}
                </ul>
            </div>
        `;

        return card;
    }

    // プランを承認して目標を作成
    async approvePlan() {
        if (!this.currentPlan || !this.currentGoalData) return;

        // 連打防止
        if (this.isApprovingPlan) return;
        this.isApprovingPlan = true;

        const approveBtn = document.getElementById('approve-plan-btn');
        if (approveBtn) {
            approveBtn.disabled = true;
            approveBtn.textContent = '処理中...';
        }

        try {
            // 目標を作成（プラン情報付き）
            const goalData = {
                ...this.currentGoalData,
                id: Date.now(),
                progress: 0,
                hasCoachingPlan: true,
                planId: this.currentPlan.id
            };

            // プランのステータスをアクティブに更新
            this.currentPlan.status = 'active';
            this.currentPlan.goalId = goalData.id;

            // 保存
            this.coachingPlanService.savePlan(this.currentPlan);
            this.addGoal(goalData);

            // フォームをリセット
            document.getElementById('modal-goal-form').reset();

            // モーダルを閉じる
            this.closeCoachingPlanModal();

            this.showToast('コーチングプラン付きの目標を作成しました！', 'success');
        } catch (error) {
            console.error('Failed to approve plan:', error);
            this.showToast('プランの承認に失敗しました', 'error');

        } finally {
            this.isApprovingPlan = false;

            // ボタンを元に戻す
            if (approveBtn) {
                approveBtn.disabled = false;
                approveBtn.textContent = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> このプランで開始';
            }
        }
    }

    // 手動プラン作成（簡易版）
    createManualPlan() {
        this.showToast('手動プラン作成機能は今後実装予定です', 'info');
    }

    // プラン編集
    editPlan() {
        this.showToast('プラン編集機能は今後実装予定です', 'info');
    }

    // プラン再生成
    regeneratePlan() {
        this.generatePlanWithAI();
    }

    // プラン編集保存
    savePlanEdits() {
        this.showToast('プラン編集保存機能は今後実装予定です', 'info');
    }

    // プラン編集キャンセル
    cancelPlanEdit() {
        this.showPlanStep('plan-review-step');
    }

    // コーチングプランページの初期化
    initCoachingPlansPage() {
        // ステータスフィルターのイベントリスナー
        document.getElementById('plan-status-filter')?.addEventListener('change', (e) => {
            this.filterPlans(e.target.value);
        });

        // ページ表示時にプランを読み込み
        this.loadCoachingPlans();
    }

    // コーチングプランを読み込み
    loadCoachingPlans() {
        const allPlans = this.coachingPlanService.getAllPlans();
        this.displayAllPlans(allPlans);
    }

    // すべてのプランを表示
    displayAllPlans(plans) {
        const container = document.getElementById('all-plans-container');
        if (!container) return;

        if (plans.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg></div>
                    <h3>プランがありません</h3>
                    <p>目標ページでプランを作成してください</p>
                </div>
            `;
            return;
        }

        container.innerHTML = plans.map(plan => this.createPlanCard(plan)).join('');
    }

    // プランカードを作成
    createPlanCard(plan) {
        const progress = this.calculatePlanProgress(plan);
        const currentWeek = this.coachingPlanService.getCurrentWeekPlan(plan.id);

        return `
            <div class="plan-card" data-plan-id="${plan.id}">
                <div class="plan-card-header">
                    <h3 class="plan-title">${plan.goalTitle}</h3>
                    <div class="plan-header-actions">
                        <span class="plan-status ${plan.status}">${this.getStatusLabel(plan.status)}</span>
                    </div>
                </div>

                <div class="plan-info">
                    <div class="plan-stat">
                        <span class="plan-stat-value">${plan.weeks.length}</span>
                        <span class="plan-stat-label">週</span>
                    </div>
                    <div class="plan-stat">
                        <span class="plan-stat-value">${currentWeek?.weekNumber || 1}</span>
                        <span class="plan-stat-label">現在週</span>
                    </div>
                    <div class="plan-stat">
                        <span class="plan-stat-value">${progress}%</span>
                        <span class="plan-stat-label">進捗</span>
                    </div>
                </div>

                <div class="plan-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                </div>

                <div class="plan-actions">
                    <button class="btn-primary btn-sm" onclick="app.viewPlanDetails('${plan.id}')">詳細表示</button>
                    ${plan.status === 'active' ?
                        `<button class="btn-warning btn-sm" onclick="app.pausePlan('${plan.id}')">一時停止</button>` :
                        plan.status === 'paused' ?
                        `<button class="btn-success btn-sm" onclick="app.resumePlan('${plan.id}')">再開</button>` :
                        ''
                    }
                    ${plan.status !== 'completed' ?
                        `<button class="btn-secondary btn-sm" onclick="app.editPlan('${plan.id}')">編集</button>` : ''
                    }
                    <button class="btn-danger btn-sm" onclick="app.deletePlan('${plan.id}')">削除</button>
                </div>
            </div>
        `;
    }

    // プランの進捗を計算
    calculatePlanProgress(plan) {
        const currentWeek = this.coachingPlanService.getCurrentWeekPlan(plan.id);
        if (!currentWeek) return 0;

        const totalWeeks = plan.weeks.length;
        const currentWeekNumber = currentWeek.weekNumber;

        return Math.round((currentWeekNumber / totalWeeks) * 100);
    }

    // ステータスラベルを取得
    getStatusLabel(status) {
        const labels = {
            'active': 'アクティブ',
            'completed': '完了',
            'paused': '一時停止',
            'draft': '下書き'
        };
        return labels[status] || status;
    }

    // プランをフィルター
    filterPlans(status) {
        const allPlans = this.coachingPlanService.getAllPlans();
        const filteredPlans = status === 'all' ? allPlans : allPlans.filter(plan => plan.status === status);
        this.displayAllPlans(filteredPlans);
    }

    // プラン詳細を表示
    viewPlanDetails(planId) {
        const plan = this.coachingPlanService.getPlan(planId);
        if (!plan) {
            this.showToast('プランが見つかりません', 'error');
            return;
        }

        this.currentDetailPlanId = planId;
        this.displayPlanDetailModal(plan);
        this.showPlanDetailModal();
    }

    // プラン詳細モーダルを表示
    showPlanDetailModal() {
        const modal = document.getElementById('plan-detail-modal');
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    // プラン詳細モーダルを閉じる
    closePlanDetailModal() {
        const modal = document.getElementById('plan-detail-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
        this.currentDetailPlanId = null;
    }

    // プラン詳細データを表示
    displayPlanDetailModal(plan) {
        // プラン基本情報
        document.getElementById('detail-goal-title').textContent = plan.goalTitle;
        document.getElementById('detail-plan-status').textContent = this.getStatusLabel(plan.status);
        document.getElementById('detail-total-weeks').textContent = `${plan.weeks.length}週`;

        // 進捗計算と表示
        const progress = this.calculatePlanProgress(plan);
        document.getElementById('detail-progress').textContent = `${progress}%`;
        document.getElementById('detail-progress-bar').style.width = `${progress}%`;

        // 現在週の詳細表示
        this.displayCurrentWeekDetail(plan);

        // 週別タイムライン表示
        this.displayWeeksTimeline(plan);

        // アクションボタンの状態更新
        this.updatePlanDetailActions(plan);
    }

    // 現在週の詳細を表示
    displayCurrentWeekDetail(plan) {
        const currentWeek = this.coachingPlanService.getCurrentWeekPlan(plan.id);
        const container = document.getElementById('detail-current-week');

        if (!currentWeek) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>現在アクティブな週がありません</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="week-header">
                <div class="week-title">第${currentWeek.weekNumber}週</div>
                <div class="week-period">${currentWeek.startDate} ～ ${currentWeek.endDate}</div>
                <div class="week-focus">${currentWeek.focus}</div>
            </div>
            <div class="week-content">
                <div class="objectives-section">
                    <h4><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> 今週の目標</h4>
                    <ul class="objectives-list">
                        ${currentWeek.objectives.map(obj => `<li>${obj}</li>`).join('')}
                    </ul>
                </div>
                <div class="milestones-section">
                    <h4><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> 達成指標</h4>
                    <ul class="milestones-list">
                        ${currentWeek.milestones.map(milestone => `<li>${milestone}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    // 週別タイムライン表示
    displayWeeksTimeline(plan) {
        const container = document.getElementById('detail-weeks-timeline');
        const currentWeek = this.coachingPlanService.getCurrentWeekPlan(plan.id);
        const currentWeekNumber = currentWeek?.weekNumber || 1;

        container.innerHTML = plan.weeks.map(week => {
            const isCompleted = week.weekNumber < currentWeekNumber;
            const isCurrent = week.weekNumber === currentWeekNumber;
            const statusClass = isCompleted ? 'completed' : isCurrent ? 'current' : '';

            return `
                <div class="timeline-week ${statusClass}">
                    <div class="week-number">${week.weekNumber}</div>
                    <div class="week-info">
                        <div class="week-info-title">第${week.weekNumber}週: ${week.focus}</div>
                        <div class="week-info-focus">${week.objectives.join(', ')}</div>
                        <div class="week-info-period">${week.startDate} ～ ${week.endDate}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // プラン詳細アクションボタンの状態更新
    updatePlanDetailActions(plan) {
        const editBtn = document.getElementById('detail-edit-plan-btn');
        const pauseBtn = document.getElementById('detail-pause-plan-btn');
        const resumeBtn = document.getElementById('detail-resume-plan-btn');
        const completeBtn = document.getElementById('detail-complete-plan-btn');
        const deleteBtn = document.getElementById('detail-delete-plan-btn');

        // ボタンの表示/非表示を制御
        if (editBtn) editBtn.style.display = plan.status === 'completed' ? 'none' : 'inline-block';
        if (pauseBtn) pauseBtn.style.display = plan.status === 'active' ? 'inline-block' : 'none';
        if (resumeBtn) resumeBtn.style.display = plan.status === 'paused' ? 'inline-block' : 'none';
        if (completeBtn) completeBtn.style.display = plan.status === 'completed' ? 'none' : 'inline-block';
        if (deleteBtn) deleteBtn.style.display = 'inline-block'; // 常に表示
    }

    // 詳細モーダルからプラン編集
    editPlanFromDetail() {
        if (this.currentDetailPlanId) {
            this.closePlanDetailModal();
            this.editPlan(this.currentDetailPlanId);
        }
    }

    // 詳細モーダルからプラン一時停止
    pausePlanFromDetail() {
        if (this.currentDetailPlanId) {
            this.pausePlan(this.currentDetailPlanId);
            // モーダルを更新
            const plan = this.coachingPlanService.getPlan(this.currentDetailPlanId);
            if (plan) {
                this.displayPlanDetailModal(plan);
            }
        }
    }

    // 詳細モーダルからプラン再開
    resumePlanFromDetail() {
        if (this.currentDetailPlanId) {
            this.resumePlan(this.currentDetailPlanId);
            // モーダルを更新
            const plan = this.coachingPlanService.getPlan(this.currentDetailPlanId);
            if (plan) {
                this.displayPlanDetailModal(plan);
            }
        }
    }

    // 詳細モーダルからプラン完了
    completePlanFromDetail() {
        if (this.currentDetailPlanId) {
            if (this.coachingPlanService.updatePlanStatus(this.currentDetailPlanId, 'completed')) {
                this.showToast('プランを完了しました<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/></svg>', 'success');
                this.loadCoachingPlans();
                // モーダルを更新
                const plan = this.coachingPlanService.getPlan(this.currentDetailPlanId);
                if (plan) {
                    this.displayPlanDetailModal(plan);
                }
            }
        }
    }

    // 詳細モーダルからプラン削除
    deletePlanFromDetail() {
        if (this.currentDetailPlanId) {
            this.deletePlan(this.currentDetailPlanId);
        }
    }

    // プランを一時停止
    pausePlan(planId) {
        if (this.coachingPlanService.updatePlanStatus(planId, 'paused')) {
            this.showToast('プランを一時停止しました', 'success');
            this.loadCoachingPlans();
        }
    }

    // プランを再開
    resumePlan(planId) {
        if (this.coachingPlanService.updatePlanStatus(planId, 'active')) {
            this.showToast('プランを再開しました', 'success');
            this.loadCoachingPlans();
        }
    }

    // プランを編集
    editPlan(planId) {
        // プラン編集機能（今後実装）
        this.showToast('プラン編集機能は今後実装予定です', 'info');
    }

    // プランを削除
    async deletePlan(planId) {
        // 確認ダイアログを表示
        const result = await Swal.fire({
            title: 'プランを削除しますか？',
            html: '本当にこのコーチングプランを削除しますか？<br>削除する場合は <b>削除</b> と入力してください。<br><small>※関連する目標は削除されませんが、プランとのリンクは解除されます。</small>',
            icon: 'warning',
            input: 'text',
            inputAttributes: {
                autocapitalize: 'off'
            },
            showCancelButton: true,
            confirmButtonText: '削除する',
            cancelButtonText: 'キャンセル',
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            reverseButtons: true,
            background: getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim(),
            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim(),
            preConfirm: (inputValue) => {
                if (inputValue !== '削除') {
                    Swal.showValidationMessage('キーワードが一致しません。「削除」と入力してください。');
                    return false;
                }
                return true;
            }
        });

        if (!result.isConfirmed) {
            return;
        }

        try {
            // プランを削除
            if (this.coachingPlanService.deletePlan(planId)) {
                // 関連する目標のリンクを解除
                this.unlinkGoalFromPlan(planId);

                this.showToast('コーチングプランを削除しました', 'success');
                this.loadCoachingPlans();

                // 詳細モーダルから削除した場合はモーダルを閉じる
                if (this.currentDetailPlanId === planId) {
                    this.closePlanDetailModal();
                }
            } else {
                this.showToast('プランの削除に失敗しました', 'error');
            }
        } catch (error) {
            console.error('Failed to delete plan:', error);
            this.showToast('エラーが発生しました', 'error');
        }
    }

    // 目標からプランへのリンクを解除
    unlinkGoalFromPlan(planId) {
        try {
            const goals = JSON.parse(localStorage.getItem('goals') || '[]');
            let updated = false;

            const newGoals = goals.map(goal => {
                if (goal.planId === planId) {
                    updated = true;
                    return {
                        ...goal,
                        hasCoachingPlan: false,
                        planId: null
                    };
                }
                return goal;
            });

            if (updated) {
                localStorage.setItem('goals', JSON.stringify(newGoals));

                // 目標リストが表示されている場合は更新
                if (this.currentPage === 'dashboard') {
                    this.loadDashboardGoals();
                } else if (this.currentPage === 'goals') {
                    this.loadGoalsList();
                }
            }
        } catch (error) {
            console.warn('Failed to unlink goal from plan:', error);
        }
    }

    // ==========================================
    // Gallery Functions
    // ==========================================

    async loadGalleryMatches(filters = {}) {
        const galleryGrid = document.getElementById('gallery-grid');
        if (!galleryGrid) return;

        // VALORANTマッチデータを取得（valorant_galleryとvalorant_matchesの両方を統合）
        let valorantGallery = JSON.parse(localStorage.getItem('valorant_gallery') || '[]');
        const valorantMatches = JSON.parse(localStorage.getItem('valorant_matches') || '[]');
        let matches = [...valorantGallery, ...valorantMatches];

        // localStorageにデータがない場合、valorant-stats.jsonから取得
        if (matches.length === 0) {
            try {
                const response = await fetch('data/valorant-stats.json');
                if (response.ok) {
                    const statsData = await response.json();
                    if (statsData.matches && statsData.matches.length > 0) {
                        matches = statsData.matches.map(m => ({
                            ...m,
                            timestamp: new Date(m.date).getTime() || Date.now()
                        }));
                        console.log('Loaded matches from valorant-stats.json:', matches.length);
                    }
                }
            } catch (error) {
                console.warn('Failed to load from valorant-stats.json:', error);
            }
        }

        // フィルターを適用
        let filteredMatches = matches;

        if (filters.agent) {
            filteredMatches = filteredMatches.filter(m => 
                m.agent === filters.agent
            );
        }

        if (filters.result) {
            filteredMatches = filteredMatches.filter(m => 
                m.result === filters.result
            );
        }

        if (filters.tag) {
            filteredMatches = filteredMatches.filter(m => {
                const tags = m.insightTags || [];
                return tags.some(tag => 
                    tag.toLowerCase().includes(filters.tag.toLowerCase())
                );
            });
        }

        // 日付順でソート（新しい順）
        filteredMatches.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // 表示
        if (filteredMatches.length === 0) {
            galleryGrid.innerHTML = `
                <div class="no-matches-gallery">
                    <h3>試合データがありません</h3>
                    <p>かんたん試合入力から試合を記録してみましょう</p>
                </div>
            `;
            return;
        }

        galleryGrid.innerHTML = filteredMatches.map(match => this.createMatchCard(match)).join('');

        // カードクリックイベントを設定
        document.querySelectorAll('.valorant-match-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // 選択モード中はモーダルを開かない
                if (this.selectionMode) {
                    return;
                }
                
                // チェックボックスや削除ボタンのクリックは無視
                if (e.target.type === 'checkbox' || 
                    e.target.closest('.match-checkbox') ||
                    e.target.closest('.delete-match-btn')) {
                    return;
                }
                
                const matchId = card.dataset.matchId;
                this.showMatchDetail(matchId);
            });
        });
    }

    createMatchCard(match) {
        if (!match) {
            return '';
        }
        
        // 勝敗判定
        let resultClass = 'draw';
        let resultText = 'DRAW';
        if (match.result === 'WIN') {
            resultClass = 'win';
            resultText = 'WIN';
        } else if (match.result === 'LOSS') {
            resultClass = 'loss';
            resultText = 'LOSS';
        }

        const tags = match.insightTags || [];
        const mapName = match.map || 'Unknown';
        const agentName = match.agent || 'Unknown';
        const score = match.score || '0-0';

        return `
            <div class="valorant-match-card ${resultClass}" data-match-id="${String(match.id)}">
                <div class="match-card-header">
                    <div class="map-name">${mapName}</div>
                    <div class="match-score ${resultClass}">${score}</div>
                </div>

                <div class="match-card-body">
                    <div class="agent-info">
                        <div class="agent-name">${agentName}</div>
                    </div>

                    <div class="match-stats">
                        <div class="stat-row">
                            <span class="stat-label">KDA:</span>
                            <span class="stat-value">${match.kills || 0}/${match.deaths || 0}/${match.assists || 0} (${match.kda || '0.00'})</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">ACS:</span>
                            <span class="stat-value">${match.acs || 0}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">ADR:</span>
                            <span class="stat-value">${match.adr || 0}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">HS%:</span>
                            <span class="stat-value">${match.hsPercent || 0}%</span>
                        </div>
                    </div>

                    ${tags.length > 0 ? `
                    <div class="match-tags">
                        ${tags.slice(0, 3).map(tag => `<span class="match-tag">${tag}</span>`).join('')}
                        ${tags.length > 3 ? `<span class="match-tag">+${tags.length - 3}</span>` : ''}
                    </div>
                    ` : ''}
                </div>

                <div class="match-card-footer">
                    <span class="match-date">${match.date || '日付不明'}</span>
                    <button class="delete-match-btn" onclick="app.deleteMatch('${String(match.id)}'); event.stopPropagation();">
                        削除
                    </button>
                </div>
            </div>
        `;
    }



    showMatchDetail(matchId) {
        // VALORANTマッチデータを取得（両方のソースを統合）
        const valorantGallery = JSON.parse(localStorage.getItem('valorant_gallery') || '[]');
        const valorantMatches = JSON.parse(localStorage.getItem('valorant_matches') || '[]');
        const matches = [...valorantGallery, ...valorantMatches];
        
        // IDは文字列として比較
        const match = matches.find(m => String(m.id) === String(matchId));

        if (!match) {
            console.error('試合が見つかりません。ID:', matchId, 'タイプ:', typeof matchId);
            this.showToast('試合データが見つかりません', 'error');
            return;
        }

        const modal = document.getElementById('match-detail-modal');
        const body = document.getElementById('match-detail-body');

        if (!modal || !body) return;

        const tags = match.insightTags || [];
        const feelings = match.feelings || '';

        // 勝敗判定
        let resultText = 'DRAW';
        let resultClass = 'draw';
        if (match.result === 'WIN') {
            resultText = 'WIN';
            resultClass = 'win';
        } else if (match.result === 'LOSS') {
            resultText = 'LOSS';
            resultClass = 'loss';
        }

        body.innerHTML = `
            <div class="detail-section">
                <h3>試合結果</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">結果</div>
                        <div class="detail-value">
                            <span class="match-result-badge ${resultClass}">${resultText}</span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">試合日</div>
                        <div class="detail-value">${match.date || '日付不明'}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3>マップ・エージェント</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">マップ</div>
                        <div class="detail-value">${match.map || 'Unknown'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">エージェント</div>
                        <div class="detail-value">${match.agent || 'Unknown'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">スコア</div>
                        <div class="detail-value">${match.score || '0-0'}</div>
                    </div>
                </div>
            </div>

            <div class="detail-section">
                <h3>スタッツ</h3>
                <div class="detail-grid">
                    <div class="detail-item">
                        <div class="detail-label">KDA</div>
                        <div class="detail-value">${match.kills || 0}/${match.deaths || 0}/${match.assists || 0} (${match.kda || '0.00'})</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">ACS</div>
                        <div class="detail-value">${match.acs || 0}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">ADR</div>
                        <div class="detail-value">${match.adr || 0}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">HS%</div>
                        <div class="detail-value">${match.hsPercent || 0}%</div>
                    </div>
                </div>
            </div>

            ${tags.length > 0 ? `
            <div class="detail-section">
                <h3>気づきタグ</h3>
                <div class="match-tags">
                    ${tags.map(tag => `<span class="match-tag">${tag}</span>`).join('')}
                </div>
            </div>
            ` : ''}

            ${feelings ? `
            <div class="detail-section">
                <h3>試合の気づき</h3>
                <div class="memo-box">${feelings}</div>
            </div>
            ` : ''}
        `;

        // 編集・削除ボタンにイベントを設定
        const editBtn = document.getElementById('edit-match-btn');
        const deleteBtn = document.getElementById('delete-match-btn');

        if (editBtn) {
            editBtn.onclick = () => this.editMatch(matchId);
        }

        if (deleteBtn) {
            deleteBtn.onclick = () => this.deleteMatch(matchId);
        }

        modal.classList.remove('hidden');
    }

    closeMatchDetailModal() {
        const modal = document.getElementById('match-detail-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    editMatch(matchId) {
        this.showToast('編集機能は今後実装予定です', 'info');
        // TODO: 編集モーダルを表示して、試合データを編集できるようにする
    }

    async deleteMatch(matchId) {
        if (!confirm('この試合データを削除してもよろしいですか？')) {
            return;
        }

        // 両方のストレージから削除
        const valorantGallery = JSON.parse(localStorage.getItem('valorant_gallery') || '[]');
        const valorantMatches = JSON.parse(localStorage.getItem('valorant_matches') || '[]');
        
        // IDを文字列として正規化して比較
        const normalizedId = String(matchId);
        console.log('削除対象ID:', normalizedId);
        
        const filteredGallery = valorantGallery.filter(m => String(m.id) !== normalizedId);
        const filteredMatches = valorantMatches.filter(m => String(m.id) !== normalizedId);

        console.log('削除前/後:', {
            gallery: { before: valorantGallery.length, after: filteredGallery.length },
            matches: { before: valorantMatches.length, after: filteredMatches.length }
        });

        localStorage.setItem('valorant_gallery', JSON.stringify(filteredGallery));
        localStorage.setItem('valorant_matches', JSON.stringify(filteredMatches));

        // キャッシュを無効化
        this.cachedMatchData = null;

        this.showToast('試合データを削除しました', 'success');
        this.closeMatchDetailModal();
        await this.loadGalleryMatches();

        // ダッシュボード統計も更新
        if (this.currentPage === 'dashboard') {
            this.loadDashboard();
        }

        // 統計も更新
        if (this.playerStatsManager) {
            this.playerStatsManager.loadStatsToUI();
        }
    }

    loadOpponentFilter() {
        // VALORANTではエージェントでフィルタリング（両方のソースを統合）
        const valorantGallery = JSON.parse(localStorage.getItem('valorant_gallery') || '[]');
        const valorantMatches = JSON.parse(localStorage.getItem('valorant_matches') || '[]');
        const matches = [...valorantGallery, ...valorantMatches];
        const agents = [...new Set(matches.map(m => m.agent).filter(Boolean))];

        const select = document.getElementById('filter-opponent');
        if (!select) return;

        // 既存のオプションをクリアして再生成
        select.innerHTML = '<option value="">すべて</option>';
        agents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent;
            option.textContent = agent;
            select.appendChild(option);
        });
    }

    setupGalleryFilters() {
        const applyBtn = document.getElementById('apply-filters');
        const clearBtn = document.getElementById('clear-filters');

        if (applyBtn) {
            applyBtn.addEventListener('click', async () => {
                const filters = {
                    agent: document.getElementById('filter-opponent')?.value || '', // VALORANTではエージェントでフィルタ
                    result: document.getElementById('filter-result')?.value || '',
                    tag: document.getElementById('filter-tag')?.value || ''
                };

                await this.loadGalleryMatches(filters);
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                document.getElementById('filter-opponent').value = '';
                document.getElementById('filter-result').value = '';
                document.getElementById('filter-tag').value = '';
                await this.loadGalleryMatches();
            });
        }
    }

    // ギャラリー選択モードの設定
    setupGallerySelectionMode() {
        this.selectionMode = false;
        this.selectedMatches = new Set();
        this.lastSelectedIndex = -1; // SHIFT選択用

        const toggleBtn = document.getElementById('toggle-selection-mode');
        const selectAllBtn = document.getElementById('select-all-btn');
        const deselectAllBtn = document.getElementById('deselect-all-btn');
        const deleteSelectedBtn = document.getElementById('delete-selected-btn');
        const cancelBtn = document.getElementById('cancel-selection-btn');

        if (toggleBtn) {
            toggleBtn.onclick = () => this.toggleSelectionMode();
        }

        if (selectAllBtn) {
            selectAllBtn.onclick = () => this.selectAllMatches();
        }

        if (deselectAllBtn) {
            deselectAllBtn.onclick = () => this.deselectAllMatches();
        }

        if (deleteSelectedBtn) {
            deleteSelectedBtn.onclick = () => this.deleteSelectedMatches();
        }

        if (cancelBtn) {
            cancelBtn.onclick = () => this.cancelSelectionMode();
        }
    }

    // 選択モードの切り替え
    toggleSelectionMode() {
        this.selectionMode = !this.selectionMode;
        
        const selectionActions = document.getElementById('selection-actions');
        const galleryGrid = document.getElementById('gallery-grid');
        const toggleBtn = document.getElementById('toggle-selection-mode');

        if (this.selectionMode) {
            // 選択モード有効化
            selectionActions?.classList.remove('hidden');
            galleryGrid?.classList.add('selection-mode');
            if (toggleBtn) {
                toggleBtn.classList.add('active');
                toggleBtn.innerHTML = '<span class="icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span> キャンセル';
            }

            // 各カードにチェックボックスを追加
            this.addCheckboxesToCards();
        } else {
            // 選択モード無効化
            this.cancelSelectionMode();
        }
    }

    // 選択モードをキャンセル
    cancelSelectionMode() {
        this.selectionMode = false;
        this.selectedMatches.clear();
        this.lastSelectedIndex = -1;

        const selectionActions = document.getElementById('selection-actions');
        const galleryGrid = document.getElementById('gallery-grid');
        const toggleBtn = document.getElementById('toggle-selection-mode');

        selectionActions?.classList.add('hidden');
        galleryGrid?.classList.remove('selection-mode');
        
        if (toggleBtn) {
            toggleBtn.classList.remove('active');
            toggleBtn.innerHTML = '<span class="icon">✓</span> 削除';
        }

        // チェックボックスを削除
        document.querySelectorAll('.match-checkbox').forEach(cb => cb.remove());
        this.updateSelectionCount();
    }

    // カードにチェックボックスを追加
    addCheckboxesToCards() {
        const cards = document.querySelectorAll('.valorant-match-card');
        cards.forEach((card, index) => {
            // 既存のチェックボックスがあれば削除
            const existingCheckbox = card.querySelector('.match-checkbox');
            if (existingCheckbox) {
                existingCheckbox.remove();
            }

            // 新しいチェックボックスを追加
            const checkbox = document.createElement('div');
            checkbox.className = 'match-checkbox';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.className = 'match-select-input';
            checkbox.appendChild(input);
            
            const matchId = card.dataset.matchId;

            // チェックボックス全体のクリックイベントでSHIFTキーを検知
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                // クリック後、少し待ってから状態を確認（チェックボックスの状態更新を待つ）
                setTimeout(() => {
                    this.handleCheckboxChange(matchId, index, e.shiftKey);
                }, 0);
            });

            // カード全体のクリックイベントを追加（選択モード時のみ）
            const cardClickHandler = (e) => {
                // 削除ボタンのクリックは無視
                if (e.target.closest('.delete-match-btn')) {
                    return;
                }
                
                e.stopPropagation();
                
                // チェックボックスの状態をトグル
                input.checked = !input.checked;
                
                // 状態変更を処理
                setTimeout(() => {
                    this.handleCheckboxChange(matchId, index, e.shiftKey);
                }, 0);
            };
            
            // 既存のクリックハンドラーを削除してから新しいハンドラーを追加
            card.removeEventListener('click', cardClickHandler);
            card.addEventListener('click', cardClickHandler);

            card.insertBefore(checkbox, card.firstChild);
            card.style.cursor = 'pointer';
        });
    }

    // チェックボックス変更ハンドラー
    handleCheckboxChange(matchId, currentIndex, shiftKey) {
        const checkbox = document.querySelector(`.valorant-match-card[data-match-id="${matchId}"] input`);
        
        if (!checkbox) {
            console.error('チェックボックスが見つかりません:', matchId);
            return;
        }
        
        // IDを文字列として正規化
        const normalizedId = String(matchId);
        const isChecked = checkbox.checked;
        
        console.log('handleCheckboxChange:', {
            matchId: normalizedId,
            isChecked: isChecked,
            shiftKey: shiftKey,
            lastSelectedIndex: this.lastSelectedIndex,
            currentIndex: currentIndex
        });
        
        if (shiftKey && this.lastSelectedIndex !== -1 && this.lastSelectedIndex !== currentIndex) {
            // SHIFT+クリックで範囲選択
            console.log('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> SHIFT範囲選択を実行');
            this.selectRange(this.lastSelectedIndex, currentIndex, isChecked);
            // 範囲選択の場合、updateSelectionCountはselectRange内で呼ばれる
        } else {
            // 通常の選択
            if (isChecked) {
                this.selectedMatches.add(normalizedId);
                console.log('✓ Selected:', normalizedId, 'Total:', this.selectedMatches.size);
            } else {
                this.selectedMatches.delete(normalizedId);
                console.log('✗ Deselected:', normalizedId, 'Total:', this.selectedMatches.size);
            }
            this.updateSelectionCount();
        }

        // 最後に選択したインデックスを更新
        this.lastSelectedIndex = currentIndex;
    }

    // 範囲選択
    selectRange(startIndex, endIndex, checked) {
        const [start, end] = startIndex < endIndex 
            ? [startIndex, endIndex] 
            : [endIndex, startIndex];

        console.log('範囲選択:', {
            start: start,
            end: end,
            checked: checked,
            range: end - start + 1
        });

        const cards = document.querySelectorAll('.valorant-match-card');
        let selectedCount = 0;
        
        for (let i = start; i <= end; i++) {
            if (cards[i]) {
                const input = cards[i].querySelector('input');
                const matchId = String(cards[i].dataset.matchId); // 文字列として正規化
                
                if (input) {
                    input.checked = checked;
                    if (checked) {
                        this.selectedMatches.add(matchId);
                        selectedCount++;
                    } else {
                        this.selectedMatches.delete(matchId);
                    }
                }
            }
        }
        
        console.log(`範囲選択完了: ${selectedCount}件を${checked ? '選択' : '解除'}`);
        this.updateSelectionCount();
    }

    // すべて選択
    selectAllMatches() {
        const cards = document.querySelectorAll('.valorant-match-card');
        cards.forEach(card => {
            const input = card.querySelector('input');
            const matchId = String(card.dataset.matchId); // 文字列として正規化
            
            if (input) {
                input.checked = true;
                this.selectedMatches.add(matchId);
            }
        });

        console.log('Selected all:', this.selectedMatches.size, 'matches');
        this.updateSelectionCount();
    }

    // すべて選択解除
    deselectAllMatches() {
        const cards = document.querySelectorAll('.valorant-match-card');
        cards.forEach(card => {
            const input = card.querySelector('input');
            if (input) {
                input.checked = false;
            }
        });

        this.selectedMatches.clear();
        this.updateSelectionCount();
    }

    // 選択数の更新
    updateSelectionCount() {
        const countEl = document.getElementById('selection-count');
        const deleteBtn = document.getElementById('delete-selected-btn');

        if (countEl) {
            countEl.textContent = `${this.selectedMatches.size}件選択中`;
        }

        if (deleteBtn) {
            deleteBtn.disabled = this.selectedMatches.size === 0;
        }
    }

    // 選択された試合を削除
    async deleteSelectedMatches() {
        if (this.selectedMatches.size === 0) {
            this.showToast('削除する試合を選択してください', 'warning');
            return;
        }

        const count = this.selectedMatches.size;
        const message = `選択した${count}試合を削除してもよろしいですか？\n\nこの操作は取り消せません。`;

        if (!confirm(message)) {
            return;
        }

        // 新旧両方のキーからデータを取得して削除（sf6_gallery と valorant_gallery の互換性）
        const valorantGallery = JSON.parse(localStorage.getItem('valorant_gallery') || '[]');
        const sf6Gallery = JSON.parse(localStorage.getItem('sf6_gallery') || '[]');
        const recentMatches = JSON.parse(localStorage.getItem('recentMatches') || '[]');

        console.log('削除前のデータ数:', {
            valorantGallery: valorantGallery.length,
            sf6Gallery: sf6Gallery.length,
            recentMatches: recentMatches.length,
            selected: Array.from(this.selectedMatches)
        });

        // IDの型に関係なく削除できるように、両方の形式で比較
        const selectedIds = Array.from(this.selectedMatches);
        const filteredValorant = valorantGallery.filter(m => {
            const matchId = String(m.id);
            const shouldKeep = !selectedIds.some(id => String(id) === matchId);
            if (!shouldKeep) {
                console.log('valorant_galleryから削除:', matchId);
            }
            return shouldKeep;
        });
        const filteredSf6 = sf6Gallery.filter(m => {
            const matchId = String(m.id);
            const shouldKeep = !selectedIds.some(id => String(id) === matchId);
            if (!shouldKeep) {
                console.log('sf6_galleryから削除:', matchId);
            }
            return shouldKeep;
        });
        const filteredRecent = recentMatches.filter(m => {
            const matchId = String(m.id);
            const shouldKeep = !selectedIds.some(id => String(id) === matchId);
            if (!shouldKeep) {
                console.log('recentMatchesから削除:', matchId);
            }
            return shouldKeep;
        });

        console.log('削除後のデータ数:', {
            valorantGallery: filteredValorant.length,
            sf6Gallery: filteredSf6.length,
            recentMatches: filteredRecent.length,
            deleted: (valorantGallery.length - filteredValorant.length) + 
                     (sf6Gallery.length - filteredSf6.length) + 
                     (recentMatches.length - filteredRecent.length)
        });

        localStorage.setItem('valorant_gallery', JSON.stringify(filteredValorant));
        localStorage.setItem('sf6_gallery', JSON.stringify(filteredSf6));
        localStorage.setItem('recentMatches', JSON.stringify(filteredRecent));

        this.showToast(`${count}試合のデータを削除しました`, 'success');

        // キャッシュを無効化
        this.cachedMatchData = null;

        // 選択をクリア
        this.selectedMatches.clear();
        this.cancelSelectionMode();

        // ギャラリーを再読み込み
        await this.loadGalleryMatches();

        // ダッシュボードの統計も更新
        this.loadDashboard();
    }

    // ========== 連勝記録機能 ==========

    // 連勝記録の初期化
    initWinStreak() {
        const currentStreak = this.getWinStreak();
        this.updateWinStreakDisplay(currentStreak);
        console.log('連勝記録を初期化しました:', currentStreak);
    }

    // 連勝記録を取得
    getWinStreak() {
        const streak = localStorage.getItem('winStreak');
        return streak ? parseInt(streak) : 0;
    }

    // 連勝記録を保存
    saveWinStreak(streak) {
        localStorage.setItem('winStreak', streak.toString());
    }

    // 連勝記録を更新（試合結果に応じて）
    updateWinStreak(result) {
        const currentStreak = this.getWinStreak();
        let newStreak = currentStreak;

        switch (result.toUpperCase()) {
            case 'WIN':
                newStreak = currentStreak + 1;
                console.log(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> 勝利！連勝記録を更新: ${currentStreak} → ${newStreak}`);
                if (newStreak > 1) {
                    this.showToast(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> ${newStreak}連勝中！`, 'success');
                }
                break;
            case 'LOSS':
                if (currentStreak > 0) {
                    console.log(`😢 敗北... 連勝記録がリセットされました (${currentStreak}連勝)`);
                    this.showToast(`😢 連勝記録がリセットされました (${currentStreak}連勝)`, 'info');
                }
                newStreak = 0;
                break;
            case 'DRAW':
                console.log(`🤝 引き分け。連勝記録は維持: ${currentStreak}`);
                // 引き分けの場合は変動なし
                break;
            default:
                console.warn('不明な試合結果:', result);
                break;
        }

        this.saveWinStreak(newStreak);
        this.updateWinStreakDisplay(newStreak);
    }

    // 連勝記録をリセット
    resetWinStreak() {
        const currentStreak = this.getWinStreak();
        if (currentStreak > 0) {
            console.log(`連勝記録をリセット: ${currentStreak} → 0`);
        }
        this.saveWinStreak(0);
        this.updateWinStreakDisplay(0);
    }

    // 連勝記録の表示を更新
    updateWinStreakDisplay(streak) {
        const banner = document.getElementById('win-streak-banner');
        const streakValue = document.getElementById('current-win-streak');

        if (!banner || !streakValue) {
            console.warn('連勝バナーの要素が見つかりません');
            return;
        }

        streakValue.textContent = streak.toString();
        banner.setAttribute('data-streak', streak.toString());

        // 連勝数が0の場合は非表示
        if (streak === 0) {
            banner.style.display = 'none';
        } else {
            banner.style.display = 'block';
        }
    }

    // ========================================
    // マップ管理機能
    // ========================================

    // 初期マップデータ
    getDefaultMaps() {
        return [
            { id: 'abyss', name: 'アビス', nameEn: 'Abyss', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="12" rx="10" ry="6"/></svg>', enabled: true, isCustom: false },
            { id: 'ascent', name: 'アセント', nameEn: 'Ascent', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>', enabled: true, isCustom: false },
            { id: 'bind', name: 'バインド', nameEn: 'Bind', icon: '🚪', enabled: true, isCustom: false },
            { id: 'breeze', name: 'ブリーズ', nameEn: 'Breeze', icon: '🌴', enabled: true, isCustom: false },
            { id: 'corrode', name: 'カロード', nameEn: 'Corrode', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="7" height="14"/><rect x="14" y="4" width="7" height="18"/><line x1="5" y1="11" x2="8" y2="11"/><line x1="5" y1="14" x2="8" y2="14"/><line x1="16" y1="8" x2="19" y2="8"/><line x1="16" y1="12" x2="19" y2="12"/></svg>', enabled: true, isCustom: false },
            { id: 'fracture', name: 'フラクチャー', nameEn: 'Fracture', icon: '⚡', enabled: true, isCustom: false },
            { id: 'haven', name: 'ヘイヴン', nameEn: 'Haven', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/></svg>', enabled: true, isCustom: false },
            { id: 'icebox', name: 'アイスボックス', nameEn: 'Icebox', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg>', enabled: true, isCustom: false },
            { id: 'lotus', name: 'ロータス', nameEn: 'Lotus', icon: '🪷', enabled: true, isCustom: false },
            { id: 'pearl', name: 'パール', nameEn: 'Pearl', icon: '🦪', enabled: true, isCustom: false },
            { id: 'split', name: 'スプリット', nameEn: 'Split', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="7" height="14"/><rect x="14" y="4" width="7" height="18"/><line x1="5" y1="11" x2="8" y2="11"/><line x1="5" y1="14" x2="8" y2="14"/><line x1="16" y1="8" x2="19" y2="8"/><line x1="16" y1="12" x2="19" y2="12"/></svg>', enabled: true, isCustom: false },
            { id: 'sunset', name: 'サンセット', nameEn: 'Sunset', icon: '🌅', enabled: true, isCustom: false }
        ];
    }

    // マップ管理機能の初期化
    initializeMapManagement() {
        // 設定ボタンのイベントリスナー
        const mapSettingsBtn = document.getElementById('map-settings-btn');
        if (mapSettingsBtn) {
            mapSettingsBtn.addEventListener('click', () => {
                this.openMapManagementModal();
            });
        }

        // 保存されたマップ設定を読み込み、なければデフォルトを設定
        let maps = this.getMapSettings();
        if (!maps || maps.length === 0) {
            maps = this.getDefaultMaps();
            this.saveMapSettings(maps);
        }

        // マップ追加フォームのイベントリスナー
        const addMapForm = document.getElementById('add-map-form');
        if (addMapForm) {
            addMapForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddMap();
            });
        }

        // アイコンプレビュー機能
        const iconInput = document.getElementById('new-map-icon');
        if (iconInput) {
            iconInput.addEventListener('change', (e) => {
                this.previewMapIcon(e.target.files[0]);
            });
        }

        // 保存ボタン
        const saveBtn = document.getElementById('save-map-settings');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveMapSettingsFromModal();
            });
        }

        // モーダルコンテンツのクリックイベントが伝播しないようにする
        const modalContent = document.querySelector('#map-management-modal .map-management-content');
        if (modalContent) {
            modalContent.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    // マップ設定を取得
    getMapSettings() {
        try {
            const settings = localStorage.getItem('valorant_map_settings');
            return settings ? JSON.parse(settings) : null;
        } catch (error) {
            console.error('マップ設定の読み込みに失敗:', error);
            return null;
        }
    }

    // マップ設定を保存
    saveMapSettings(maps) {
        try {
            localStorage.setItem('valorant_map_settings', JSON.stringify(maps));
            console.log('マップ設定を保存しました:', maps);
        } catch (error) {
            console.error('マップ設定の保存に失敗:', error);
            this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> マップ設定の保存に失敗しました', 'error');
        }
    }

    // 有効なマップのみを取得
    getEnabledMaps() {
        const maps = this.getMapSettings();
        return maps ? maps.filter(map => map.enabled) : [];
    }

    // マップ管理モーダルを開く
    openMapManagementModal() {
        const modal = document.getElementById('map-management-modal');
        if (!modal) return;

        // 既存マップリストを描画
        this.renderExistingMapsList();

        // モーダルを表示
        modal.classList.remove('hidden');
    }

    // マップ管理モーダルを閉じる
    closeMapManagementModal() {
        const modal = document.getElementById('map-management-modal');
        if (modal) {
            modal.classList.add('hidden');
        }

        // フォームをリセット
        const form = document.getElementById('add-map-form');
        if (form) {
            form.reset();
        }

        // アイコンプレビューをリセット
        const preview = document.getElementById('icon-preview');
        if (preview) {
            preview.innerHTML = '<span class="preview-placeholder"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg></span>';
        }
    }

    // 既存マップリストを描画
    renderExistingMapsList() {
        const container = document.getElementById('existing-maps-list');
        if (!container) return;

        const maps = this.getMapSettings();
        if (!maps || maps.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--text-muted);">マップが登録されていません</p>';
            return;
        }

        container.innerHTML = '';

        maps.forEach(map => {
            const item = document.createElement('div');
            item.className = `map-list-item ${!map.enabled ? 'disabled' : ''}`;
            item.dataset.mapId = map.id;

            // カード全体にクリックイベントを追加
            item.addEventListener('click', (e) => {
                // 削除ボタンのクリックは除外
                if (e.target.closest('.map-delete-btn')) {
                    return;
                }
                
                // チェックボックスの状態を切り替え
                const checkbox = item.querySelector('.map-checkbox');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.toggleMapEnabled(map.id, checkbox.checked);
                }
            });

            // チェックボックス
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'map-checkbox';
            checkbox.checked = map.enabled;
            // チェックボックス自体のクリックイベントは親のイベントに任せる
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation(); // 二重発火を防ぐ
            });
            checkbox.addEventListener('change', (e) => {
                this.toggleMapEnabled(map.id, e.target.checked);
            });

            // アイコン
            const iconDisplay = document.createElement('div');
            iconDisplay.className = 'map-icon-display';
            if (map.iconData) {
                const img = document.createElement('img');
                img.src = map.iconData;
                img.alt = map.name;
                iconDisplay.appendChild(img);
            } else {
                iconDisplay.textContent = map.icon || '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>';
            }

            // マップ名
            const nameDisplay = document.createElement('span');
            nameDisplay.className = 'map-name-display';
            nameDisplay.textContent = map.name;

            // カスタムバッジ
            let customBadge = null;
            if (map.isCustom) {
                customBadge = document.createElement('span');
                customBadge.className = 'map-custom-badge';
                customBadge.textContent = 'カスタム';
            }

            // 削除ボタン（カスタムマップのみ）
            let deleteBtn = null;
            if (map.isCustom) {
                deleteBtn = document.createElement('button');
                deleteBtn.className = 'map-delete-btn';
                deleteBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
                deleteBtn.title = '削除';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deleteCustomMap(map.id);
                });
            }

            // 要素を組み立て
            item.appendChild(checkbox);
            item.appendChild(iconDisplay);
            item.appendChild(nameDisplay);
            if (customBadge) item.appendChild(customBadge);
            if (deleteBtn) item.appendChild(deleteBtn);

            container.appendChild(item);
        });
    }

    // マップの有効/無効を切り替え
    toggleMapEnabled(mapId, enabled) {
        const maps = this.getMapSettings();
        const map = maps.find(m => m.id === mapId);
        
        if (map) {
            map.enabled = enabled;
            this.saveMapSettings(maps);
            
            // リストを再描画
            this.renderExistingMapsList();
        }
    }

    // カスタムマップを削除
    deleteCustomMap(mapId) {
        if (!confirm('このカスタムマップを削除してもよろしいですか?')) {
            return;
        }

        const maps = this.getMapSettings();
        const filteredMaps = maps.filter(m => m.id !== mapId);
        
        this.saveMapSettings(filteredMaps);
        this.renderExistingMapsList();
        this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> カスタムマップを削除しました', 'success');
    }

    // 新しいマップを追加
    handleAddMap() {
        const nameInput = document.getElementById('new-map-name');
        const iconInput = document.getElementById('new-map-icon');

        if (!nameInput || !nameInput.value.trim()) {
            this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> マップ名を入力してください', 'error');
            return;
        }

        const mapName = nameInput.value.trim();

        // 名前の重複チェック
        const maps = this.getMapSettings();
        const duplicate = maps.find(m => m.name.toLowerCase() === mapName.toLowerCase());
        
        if (duplicate) {
            this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> この名前は既に使用されています', 'error');
            return;
        }

        // アイコン画像の処理
        let iconData = null;
        const file = iconInput.files[0];
        
        if (file) {
            // ファイルサイズチェック (2MB)
            if (file.size > 2 * 1024 * 1024) {
                this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> 画像ファイルは2MB以下にしてください', 'error');
                return;
            }

            // 画像をBase64に変換
            const reader = new FileReader();
            reader.onload = (e) => {
                iconData = e.target.result;
                this.addNewMap(mapName, iconData);
            };
            reader.onerror = () => {
                this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> 画像の読み込みに失敗しました', 'error');
            };
            reader.readAsDataURL(file);
        } else {
            // アイコンなしで追加
            this.addNewMap(mapName, null);
        }
    }

    // マップを追加（内部処理）
    addNewMap(mapName, iconData) {
        const maps = this.getMapSettings();
        
        const newMap = {
            id: `custom_${Date.now()}`,
            name: mapName,
            nameEn: mapName,
            icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
            iconData: iconData,
            enabled: true,
            isCustom: true
        };

        maps.push(newMap);
        this.saveMapSettings(maps);

        // UIを更新
        this.renderExistingMapsList();

        // フォームをリセット
        const form = document.getElementById('add-map-form');
        if (form) form.reset();

        const preview = document.getElementById('icon-preview');
        if (preview) {
            preview.innerHTML = '<span class="preview-placeholder"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg></span>';
        }

        this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> 新しいマップを追加しました', 'success');
    }

    // アイコンのプレビュー
    previewMapIcon(file) {
        const preview = document.getElementById('icon-preview');
        if (!preview || !file) return;

        // ファイルサイズチェック
        if (file.size > 2 * 1024 * 1024) {
            this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg> 画像ファイルは2MB以下にしてください', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = 'Preview';
            preview.innerHTML = '';
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    }

    // モーダルから設定を保存
    saveMapSettingsFromModal() {
        // 既に個別に保存されているので、モーダルを閉じるだけ
        this.closeMapManagementModal();
        
        // マップ選択UIを再描画
        this.renderMapOptions();
        
        this.showToast('<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> マップ設定を保存しました', 'success');
    }

    // マップ選択肢を描画
    renderMapOptions() {
        const mapGrid = document.getElementById('map-grid');
        if (!mapGrid) return;

        const enabledMaps = this.getEnabledMaps();

        if (enabledMaps.length === 0) {
            mapGrid.innerHTML = '<p style="text-align: center; color: var(--text-muted); grid-column: 1/-1;">有効なマップがありません。マップ管理で設定してください。</p>';
            return;
        }

        mapGrid.innerHTML = '';

        enabledMaps.forEach(map => {
            const option = document.createElement('div');
            option.className = 'map-option';
            option.dataset.map = map.nameEn;
            
            // インラインスタイルを直接設定（確実に表示するため）
            option.style.cssText = `
                padding: 1rem;
                background: linear-gradient(145deg, rgba(22, 33, 62, 0.95), rgba(15, 52, 96, 0.9));
                border: 2px solid rgba(233, 69, 96, 0.3);
                border-radius: 8px;
                text-align: center;
                cursor: pointer;
                transition: all 0.3s ease;
                font-weight: 600;
                font-size: 0.95rem;
                color: #ffffff;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                min-height: 50px;
            `;

            // アイコンを表示
            if (map.iconData) {
                const img = document.createElement('img');
                img.src = map.iconData;
                img.alt = map.name;
                img.style.width = '24px';
                img.style.height = '24px';
                img.style.borderRadius = '4px';
                option.appendChild(img);
            } else {
                const icon = document.createElement('span');
                icon.textContent = map.icon;
                option.appendChild(icon);
            }

            // マップ名を表示
            const name = document.createElement('span');
            name.textContent = map.name;
            option.appendChild(name);

            // ホバーイベント
            option.addEventListener('mouseenter', () => {
                if (!option.classList.contains('selected')) {
                    option.style.borderColor = 'var(--color-accent)';
                    option.style.background = 'linear-gradient(145deg, rgba(233, 69, 96, 0.2), rgba(15, 52, 96, 0.9))';
                    option.style.transform = 'scale(1.05)';
                    option.style.boxShadow = '0 0 15px rgba(233, 69, 96, 0.4)';
                }
            });

            option.addEventListener('mouseleave', () => {
                if (!option.classList.contains('selected')) {
                    option.style.borderColor = 'rgba(233, 69, 96, 0.3)';
                    option.style.background = 'linear-gradient(145deg, rgba(22, 33, 62, 0.95), rgba(15, 52, 96, 0.9))';
                    option.style.transform = 'scale(1)';
                    option.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                }
            });

            // クリックイベント
            option.addEventListener('click', () => {
                this.selectMap(option);
            });

            mapGrid.appendChild(option);
        });
    }

    // =============================================
    // Valorant API連携メソッド
    // =============================================

    // Valorant APIイベントリスナーの設定
    setupValorantAPIListeners() {
        // 接続テストボタン
        const testBtn = document.getElementById('test-valorant-api-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                this.testValorantAPIConnection();
            });
        }

        // 設定保存ボタン
        const saveBtn = document.getElementById('save-valorant-settings-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveValorantAPISettings();
            });
        }

        // マッチインポートボタン
        const importBtn = document.getElementById('import-matches-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.importValorantMatches();
            });
        }

        // プレイヤー統計表示ボタン
        const statsBtn = document.getElementById('view-player-stats-btn');
        if (statsBtn) {
            statsBtn.addEventListener('click', () => {
                this.showValorantPlayerStats();
            });
        }

        // 設定画面表示時にValorant API設定を読み込む
        this.loadValorantAPISettings();
    }

    // Valorant API設定を読み込み
    loadValorantAPISettings() {
        if (!window.valorantAPIService) return;

        const riotId = window.valorantAPIService.getRiotId();
        const nameInput = document.getElementById('riot-id-name');
        const tagInput = document.getElementById('riot-id-tag');
        const regionSelect = document.getElementById('valorant-region');
        const apiKeyInput = document.getElementById('henrik-api-key');

        if (riotId) {
            if (nameInput) nameInput.value = riotId.name || '';
            if (tagInput) tagInput.value = riotId.tag || '';
        }

        if (regionSelect) {
            regionSelect.value = window.valorantAPIService.region || 'ap';
        }

        if (apiKeyInput) {
            apiKeyInput.value = window.valorantAPIService.apiKey || '';
        }

        // 接続状態を更新
        this.updateValorantConnectionStatus();
    }

    // Valorant API設定を保存
    async saveValorantAPISettings() {
        try {
            const nameInput = document.getElementById('riot-id-name');
            const tagInput = document.getElementById('riot-id-tag');
            const regionSelect = document.getElementById('valorant-region');
            const apiKeyInput = document.getElementById('henrik-api-key');

            const name = nameInput?.value?.trim();
            const tag = tagInput?.value?.trim();
            const region = regionSelect?.value;
            const apiKey = apiKeyInput?.value?.trim();

            if (!name || !tag) {
                this.showToast('Riot IDの名前とタグを入力してください', 'error');
                return;
            }

            if (!apiKey) {
                this.showToast('Henrik APIキーを入力してください', 'error');
                return;
            }

            // ValorantAPIServiceに設定
            window.valorantAPIService.setApiKey(apiKey);
            window.valorantAPIService.setRiotId(name, tag);
            window.valorantAPIService.setRegion(region);

            // AuthServiceにも保存（ユーザーごとに紐付け）
            if (window.authService && window.authService.getCurrentUser()) {
                window.authService.saveValorantSettings({
                    riotId: { name, tag },
                    apiKey,
                    region,
                    platform: 'pc'
                });
            }

            this.showToast('Valorant API設定を保存しました', 'success');
            this.updateValorantConnectionStatus();

        } catch (error) {
            console.error('Failed to save Valorant API settings:', error);
            this.showToast(`設定の保存に失敗しました: ${error.message}`, 'error');
        }
    }

    // Valorant API接続テスト
    async testValorantAPIConnection() {
        if (!window.valorantAPIService) {
            this.showToast('Valorant APIサービスが利用できません', 'error');
            return;
        }

        try {
            this.showLoading('接続テスト中...');

            // まず設定を保存
            await this.saveValorantAPISettings();

            // 接続テスト実行
            const result = await window.valorantAPIService.testConnection();

            this.hideLoading();

            if (result.success) {
                this.showToast(result.message, 'success');
                this.updateValorantConnectionStatus(true);
            } else {
                this.showToast(result.message, 'error');
                this.updateValorantConnectionStatus(false, result.message);
            }

        } catch (error) {
            this.hideLoading();
            console.error('Valorant API connection test failed:', error);
            this.showToast(`接続テストに失敗しました: ${error.message}`, 'error');
            this.updateValorantConnectionStatus(false, error.message);
        }
    }

    // 接続状態UIを更新
    updateValorantConnectionStatus(connected = null, message = null) {
        const statusDot = document.getElementById('valorant-connection-status');
        const statusText = document.getElementById('valorant-connection-text');

        if (!statusDot || !statusText) return;

        if (connected === null) {
            // 自動判定
            connected = window.valorantAPIService?.isConfigured() || false;
        }

        if (connected) {
            statusDot.className = 'status-dot connected';
            const riotId = window.valorantAPIService.getRiotId();
            statusText.textContent = riotId
                ? `接続済み: ${riotId.name}#${riotId.tag}`
                : '接続済み';
        } else {
            statusDot.className = message ? 'status-dot error' : 'status-dot disconnected';
            statusText.textContent = message || '未接続';
        }
    }

    // Valorantマッチをインポート
    async importValorantMatches() {
        if (!window.valorantAPIService) {
            this.showToast('Valorant APIサービスが利用できません', 'error');
            return;
        }

        try {
            this.showLoading('戦績を取得中...');

            // 静的データからインポートを試みる
            const result = await window.valorantAPIService.importFromStaticData();

            this.hideLoading();

            // 結果表示
            const resultDiv = document.getElementById('import-result');
            const resultContent = document.getElementById('import-result-content');

            if (resultDiv && resultContent) {
                resultDiv.style.display = 'block';
                resultDiv.className = `import-result ${result.imported > 0 ? 'success' : ''}`;
                resultContent.innerHTML = `
                    <strong>${result.message}</strong>
                    <br>
                    <small>取得: ${result.total}件 / インポート: ${result.imported}件 / スキップ: ${result.skipped}件</small>
                `;
            }

            if (result.imported > 0) {
                this.showToast(`${result.imported}件のマッチをインポートしました`, 'success');

                // ギャラリーを更新
                this.loadGallery();

                // 統計を更新
                this.updatePlayerStats();

                // ランクからスキルレベルを自動決定
                try {
                    const stats = await window.valorantAPIService.getPlayerStatsFromStatic();
                    if (stats && stats.rank && stats.rank.current) {
                        const autoSkillLevel = this.determineSkillLevelFromRank(stats.rank.current);
                        const currentSkillLevel = localStorage.getItem('playerSkillLevel');

                        // 現在の設定と異なる場合のみ更新
                        if (autoSkillLevel && autoSkillLevel !== currentSkillLevel) {
                            localStorage.setItem('playerSkillLevel', autoSkillLevel);
                            this.updateSkillDisplay();
                            console.log(`スキルレベルを自動設定: ${stats.rank.current} → ${autoSkillLevel}`);
                            this.showToast(`ランク(${stats.rank.current})からスキルレベルを自動設定しました`, 'info');
                        }
                    }
                } catch (skillError) {
                    console.error('Failed to auto-determine skill level:', skillError);
                }
            } else {
                this.showToast(result.message, 'info');
            }

        } catch (error) {
            this.hideLoading();
            console.error('Failed to import Valorant matches:', error);

            const resultDiv = document.getElementById('import-result');
            const resultContent = document.getElementById('import-result-content');

            if (resultDiv && resultContent) {
                resultDiv.style.display = 'block';
                resultDiv.className = 'import-result error';
                resultContent.innerHTML = `<strong>エラー:</strong> ${error.message}`;
            }

            this.showToast(`インポートに失敗しました: ${error.message}`, 'error');
        }
    }

    // プレイヤー統計を表示
    async showValorantPlayerStats() {
        if (!window.valorantAPIService) {
            this.showToast('Valorant APIサービスが利用できません', 'error');
            return;
        }

        try {
            this.showLoading('統計を取得中...');

            // 静的データから統計を取得
            const stats = await window.valorantAPIService.getPlayerStatsFromStatic();

            this.hideLoading();

            // モーダルで統計を表示（AI分析ボタン付き）
            const modalContent = this.generatePlayerStatsModalWithAI(stats);

            await Swal.fire({
                title: `${stats.account.name}#${stats.account.tag}`,
                html: modalContent,
                width: '600px',
                showCloseButton: true,
                showConfirmButton: false,
                customClass: {
                    container: 'player-stats-modal'
                }
            });

        } catch (error) {
            this.hideLoading();
            console.error('Failed to get player stats:', error);
            this.showToast(`統計の取得に失敗しました: ${error.message}`, 'error');
        }
    }

    // プレイヤー統計モーダルのHTML生成
    generatePlayerStatsModal(stats) {
        const { account, rank, stats: matchStats } = stats;

        return `
            <div class="player-stats-content">
                <!-- ランク情報 -->
                <div style="text-align: center; margin-bottom: 15px;">
                    <div style="font-size: 24px; font-weight: bold; color: var(--color-accent);">
                        ${rank.current}
                    </div>
                    <div style="font-size: 14px; color: var(--text-secondary);">
                        ${rank.rr} RR | Peak: ${rank.peak}
                    </div>
                </div>

                <!-- 主要統計 -->
                <div class="stats-overview">
                    <div class="stat-box">
                        <div class="stat-value">${matchStats.winRate}%</div>
                        <div class="stat-label">勝率</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${matchStats.avgKD}</div>
                        <div class="stat-label">K/D</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value">${matchStats.avgACS}</div>
                        <div class="stat-label">平均ACS</div>
                    </div>
                </div>

                <!-- 詳細統計 -->
                <div class="stats-details">
                    <div class="detail-item">
                        <span class="detail-label">試合数</span>
                        <span class="detail-value">${matchStats.totalMatches}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">勝敗</span>
                        <span class="detail-value">${matchStats.wins}W - ${matchStats.losses}L</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">平均キル</span>
                        <span class="detail-value">${matchStats.avgKills}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">平均デス</span>
                        <span class="detail-value">${matchStats.avgDeaths}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">平均ADR</span>
                        <span class="detail-value">${matchStats.avgADR}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">ヘッドショット率</span>
                        <span class="detail-value">${matchStats.avgHS}%</span>
                    </div>
                </div>

                <!-- トップエージェント -->
                ${matchStats.topAgents.length > 0 ? `
                <div style="margin-top: 15px;">
                    <h4 style="margin-bottom: 10px; color: var(--text-secondary);">よく使うエージェント</h4>
                    <div class="agent-stats-list">
                        ${matchStats.topAgents.slice(0, 3).map(agent => `
                            <div class="agent-stat-item">
                                <span class="agent-name">${agent.agent}</span>
                                <span class="agent-winrate">${agent.matches}試合 (${agent.winRate}%)</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <!-- トップマップ -->
                ${matchStats.topMaps.length > 0 ? `
                <div style="margin-top: 15px;">
                    <h4 style="margin-bottom: 10px; color: var(--text-secondary);">よくプレイするマップ</h4>
                    <div class="map-stats-list">
                        ${matchStats.topMaps.slice(0, 3).map(map => `
                            <div class="map-stat-item">
                                <span class="map-name">${map.map}</span>
                                <span class="map-winrate">${map.matches}試合 (${map.winRate}%)</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    // プレイヤー統計を更新（既存のメソッドがあれば拡張）
    updatePlayerStats() {
        // 既存の統計更新ロジックがあれば呼び出し
        if (typeof this.loadDashboard === 'function') {
            this.loadDashboard();
        }
        if (typeof this.updateStats === 'function') {
            this.updateStats();
        }
    }

    // 自動取得データを基にAIコーチング分析を実行
    async analyzeWithAICoaching() {
        if (!window.valorantAPIService) {
            this.showToast('Valorant APIサービスが利用できません', 'error');
            return;
        }

        if (!window.geminiService || !window.geminiService.isConfigured()) {
            this.showToast('Gemini APIキーを設定してください', 'error');
            return;
        }

        try {
            this.showLoading('AI分析中...');

            // 静的データからプレイヤー統計を取得
            const stats = await window.valorantAPIService.getPlayerStatsFromStatic();

            // AI分析用のプロンプトを生成
            const analysisPrompt = this.generateAIAnalysisPrompt(stats);

            // Gemini APIで分析
            const response = await window.geminiService.sendChatMessage(analysisPrompt, false);

            this.hideLoading();

            // 分析結果をモーダルで表示
            await Swal.fire({
                title: 'AI コーチング分析',
                html: `
                    <div style="text-align: left; max-height: 400px; overflow-y: auto; padding: 10px;">
                        <div style="margin-bottom: 15px;">
                            <strong>${stats.account.name}#${stats.account.tag}</strong>
                            <span style="color: var(--text-secondary);"> - ${stats.rank.current}</span>
                        </div>
                        <div style="white-space: pre-wrap; line-height: 1.6;">
                            ${response.response.replace(/\n/g, '<br>')}
                        </div>
                    </div>
                `,
                width: '700px',
                showCloseButton: true,
                confirmButtonText: 'チャットで詳しく聞く',
                showCancelButton: true,
                cancelButtonText: '閉じる'
            }).then((result) => {
                if (result.isConfirmed) {
                    // AIチャットページに移動
                    this.navigateToPage('ai-chat');
                }
            });

        } catch (error) {
            this.hideLoading();
            console.error('AI analysis failed:', error);
            this.showToast(`AI分析に失敗しました: ${error.message}`, 'error');
        }
    }

    // AI分析用のプロンプトを生成
    generateAIAnalysisPrompt(stats) {
        const { account, rank, stats: matchStats } = stats;

        return `以下のVALORANTプレイヤーの戦績データを分析し、具体的な改善点とトレーニング提案を日本語で提供してください。

【プレイヤー情報】
- Riot ID: ${account.name}#${account.tag}
- ランク: ${rank.current} (${rank.rr} RR)
- ピークランク: ${rank.peak}

【戦績統計】
- 総試合数: ${matchStats.totalMatches}
- 勝敗: ${matchStats.wins}勝 ${matchStats.losses}敗 (勝率: ${matchStats.winRate}%)
- 平均キル: ${matchStats.avgKills}
- 平均デス: ${matchStats.avgDeaths}
- K/D比: ${matchStats.avgKD}
- 平均ACS: ${matchStats.avgACS}
- 平均ADR: ${matchStats.avgADR}
- ヘッドショット率: ${matchStats.avgHS}%

【よく使うエージェント】
${matchStats.topAgents.map(a => `- ${a.agent}: ${a.matches}試合 (勝率${a.winRate}%)`).join('\n')}

【よくプレイするマップ】
${matchStats.topMaps.map(m => `- ${m.map}: ${m.matches}試合 (勝率${m.winRate}%)`).join('\n')}

以下の形式で分析結果を提供してください：

## 強み
プレイヤーの優れている点を3つ

## 改善点
改善が必要な点を3つ（具体的な数値や状況を踏まえて）

## おすすめトレーニング
1. 今日できること（15分程度）
2. 今週の目標
3. 長期的な改善プラン

## エージェント提案
現在の統計を踏まえた、試してみるべきエージェントとその理由`;
    }

    // プレイヤー統計モーダルにAI分析ボタンを追加するように更新
    generatePlayerStatsModalWithAI(stats) {
        const baseModal = this.generatePlayerStatsModal(stats);

        return baseModal + `
            <div style="margin-top: 20px; text-align: center;">
                <button onclick="window.app.analyzeWithAICoaching()" class="btn-primary" style="width: 100%;">
                    <span style="margin-right: 8px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg></span>
                    AI分析を依頼
                </button>
            </div>
        `;
    }

    // 攻略ガイド管理イベントリスナーのセットアップ
    setupStrategyGuideListeners() {
        // ガイド追加ボタン
        const addGuideBtn = document.getElementById('add-guide-btn');
        if (addGuideBtn) {
            addGuideBtn.addEventListener('click', () => {
                this.handleAddGuide();
            });
        }

        // ガイドリセットボタン
        const resetGuidesBtn = document.getElementById('reset-guides-btn');
        if (resetGuidesBtn) {
            resetGuidesBtn.addEventListener('click', () => {
                if (confirm('攻略ガイドをデフォルトに戻しますか？追加したガイドは削除されます。')) {
                    if (window.strategyGuideService) {
                        window.strategyGuideService.resetToDefault();
                        this.renderGuideList();
                        this.updateGuideStats();
                        alert('攻略ガイドをリセットしました。');
                    }
                }
            });
        }

        // 初期表示
        this.renderGuideList();
        this.updateGuideStats();

        console.log('攻略ガイド管理リスナーの設定が完了しました。');
    }

    // ガイド追加処理
    handleAddGuide() {
        const titleInput = document.getElementById('guide-title');
        const contentInput = document.getElementById('guide-content');
        const categorySelect = document.getElementById('guide-category');

        if (!titleInput || !contentInput) {
            console.warn('攻略ガイド入力フォームが見つかりません');
            return;
        }

        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        const category = categorySelect ? categorySelect.value : 'general';

        if (!title) {
            alert('タイトルを入力してください。');
            titleInput.focus();
            return;
        }

        if (!content) {
            alert('内容を入力してください。');
            contentInput.focus();
            return;
        }

        if (window.strategyGuideService) {
            window.strategyGuideService.addGuide(title, content, category);

            // フォームをクリア
            titleInput.value = '';
            contentInput.value = '';
            if (categorySelect) {
                categorySelect.value = 'general';
            }

            // リスト更新
            this.renderGuideList();
            this.updateGuideStats();

            alert('攻略ガイドを追加しました。');
        }
    }

    // ガイド削除処理
    handleDeleteGuide(guideId) {
        if (confirm('このガイドを削除しますか？')) {
            if (window.strategyGuideService) {
                window.strategyGuideService.deleteGuide(guideId);
                this.renderGuideList();
                this.updateGuideStats();
            }
        }
    }

    // ガイドリスト表示
    renderGuideList() {
        const listContainer = document.getElementById('guide-list');
        if (!listContainer || !window.strategyGuideService) {
            return;
        }

        const guides = window.strategyGuideService.getAllGuides();

        if (guides.length === 0) {
            listContainer.innerHTML = '<p class="no-guides">登録されたガイドはありません。</p>';
            return;
        }

        const categoryLabels = {
            'general': '一般',
            'agent': 'エージェント',
            'map': 'マップ',
            'aim': 'エイム',
            'strategy': '戦術',
            'comprehensive': '総合'
        };

        listContainer.innerHTML = guides.map(guide => `
            <div class="guide-item" data-id="${guide.id}">
                <div class="guide-header">
                    <span class="guide-title">${this.escapeHtml(guide.title)}</span>
                    <span class="guide-category">${categoryLabels[guide.category] || guide.category}</span>
                </div>
                <div class="guide-preview">${this.escapeHtml(guide.content.substring(0, 100))}${guide.content.length > 100 ? '...' : ''}</div>
                <div class="guide-actions">
                    <button class="btn-small btn-danger" onclick="window.app.handleDeleteGuide('${guide.id}')">
                        削除
                    </button>
                </div>
            </div>
        `).join('');
    }

    // ガイド統計情報更新
    updateGuideStats() {
        const statsContainer = document.getElementById('guide-stats');
        if (!statsContainer || !window.strategyGuideService) {
            return;
        }

        const stats = window.strategyGuideService.getStats();

        statsContainer.innerHTML = `
            <span>登録数: ${stats.totalGuides}件</span>
            <span>総文字数: ${stats.totalCharacters.toLocaleString()}文字</span>
        `;
    }

    // HTML エスケープ
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

}

// アプリの起動
const app = new App();

// Export for global access
window.app = app;