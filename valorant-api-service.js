// valorant-api-service.js - Valorant API統合サービス (Henrik API使用)
class ValorantAPIService {
    constructor() {
        this.baseUrl = 'https://api.henrikdev.xyz';
        this.apiKey = '';
        this.region = 'ap'; // デフォルトはアジアパシフィック
        this.platform = 'pc';

        // GitHub Actions連携設定
        this.staticDataUrl = 'data/valorant-stats.json';
        this.useStaticData = true; // 静的データを優先使用

        // レート制限管理
        this.rateLimitConfig = {
            requestsPerMinute: 30, // Basic keyの制限
            requestQueue: [],
            lastRequestTime: 0,
            minRequestInterval: 2000 // 2秒間隔
        };

        // キャッシュ設定
        this.cache = {
            account: null,
            mmr: null,
            matches: [],
            lastFetch: {},
            staticData: null
        };
        this.cacheDuration = 5 * 60 * 1000; // 5分

        // 初期化
        this.loadSettings();

        console.log('ValorantAPIService initialized');
    }

    // GitHub Actionsで生成された静的JSONデータを読み込み
    async loadStaticData() {
        try {
            // キャッシュチェック
            if (this.cache.staticData && this.isCacheValid('staticData')) {
                console.log('Using cached static data');
                return this.cache.staticData;
            }

            console.log('Loading static data from:', this.staticDataUrl);
            const response = await fetch(this.staticDataUrl);

            if (!response.ok) {
                console.warn('Static data not available:', response.status);
                return null;
            }

            const data = await response.json();

            // キャッシュに保存
            this.cache.staticData = data;
            this.cache.lastFetch['staticData'] = Date.now();

            console.log('Static data loaded:', {
                lastUpdated: data.lastUpdated,
                account: data.account?.name,
                matchCount: data.matches?.length
            });

            return data;
        } catch (error) {
            console.warn('Failed to load static data:', error);
            return null;
        }
    }

    // 静的データからプレイヤー統計を取得
    async getPlayerStatsFromStatic() {
        const staticData = await this.loadStaticData();

        if (!staticData) {
            throw new Error('静的データが利用できません。GitHub Actionsでデータを取得してください。');
        }

        return {
            account: staticData.account,
            rank: staticData.rank,
            stats: staticData.stats,
            lastUpdated: staticData.lastUpdated
        };
    }

    // 静的データからマッチ履歴を取得
    async getMatchHistoryFromStatic() {
        const staticData = await this.loadStaticData();

        if (!staticData || !staticData.matches) {
            return [];
        }

        return staticData.matches;
    }

    // 静的データをギャラリーにインポート
    async importFromStaticData() {
        try {
            const staticData = await this.loadStaticData();

            if (!staticData || !staticData.matches || staticData.matches.length === 0) {
                return {
                    imported: 0,
                    skipped: 0,
                    message: '静的データにマッチが見つかりませんでした'
                };
            }

            // 既存のギャラリーデータを取得
            const existingGallery = JSON.parse(localStorage.getItem('valorant_gallery') || '[]');
            const existingIds = new Set(existingGallery.map(m => m.matchId || m.id));

            // 新しいマッチをフィルタリング
            const newMatches = [];
            let skipped = 0;

            for (const match of staticData.matches) {
                if (existingIds.has(match.matchId || match.id)) {
                    skipped++;
                } else {
                    newMatches.push(match);
                }
            }

            // ギャラリーに追加
            if (newMatches.length > 0) {
                const updatedGallery = [...newMatches, ...existingGallery];
                localStorage.setItem('valorant_gallery', JSON.stringify(updatedGallery));
            }

            return {
                imported: newMatches.length,
                skipped: skipped,
                total: staticData.matches.length,
                message: `${newMatches.length}件のマッチをインポートしました${skipped > 0 ? `（${skipped}件は既存）` : ''}`
            };

        } catch (error) {
            console.error('Failed to import from static data:', error);
            throw error;
        }
    }

    // 静的データが利用可能かチェック
    async isStaticDataAvailable() {
        try {
            const response = await fetch(this.staticDataUrl, { method: 'HEAD' });
            return response.ok;
        } catch {
            return false;
        }
    }

    // 設定を読み込み
    loadSettings() {
        try {
            const settings = localStorage.getItem('valorant_api_settings');
            if (settings) {
                const parsed = JSON.parse(settings);
                this.apiKey = parsed.apiKey || '';
                this.region = parsed.region || 'ap';
                this.platform = parsed.platform || 'pc';
            }

            // Riot IDの読み込み
            const riotId = localStorage.getItem('valorant_riot_id');
            if (riotId) {
                this.riotId = JSON.parse(riotId);
            }
        } catch (error) {
            console.warn('Failed to load Valorant API settings:', error);
        }
    }

    // 設定を保存
    saveSettings() {
        try {
            const settings = {
                apiKey: this.apiKey,
                region: this.region,
                platform: this.platform
            };
            localStorage.setItem('valorant_api_settings', JSON.stringify(settings));
        } catch (error) {
            console.warn('Failed to save Valorant API settings:', error);
        }
    }

    // APIキーを設定
    setApiKey(apiKey) {
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('有効なAPIキーを入力してください');
        }

        this.apiKey = apiKey.trim();
        this.saveSettings();
        console.log('Valorant API key set successfully');
        return true;
    }

    // APIキーを取得
    getApiKey() {
        return this.apiKey;
    }

    // リージョンを設定
    setRegion(region) {
        const validRegions = ['eu', 'na', 'ap', 'kr', 'latam', 'br'];
        if (!validRegions.includes(region)) {
            throw new Error(`無効なリージョンです。有効な値: ${validRegions.join(', ')}`);
        }
        this.region = region;
        this.saveSettings();
        return true;
    }

    // Riot IDを設定 (name#tag形式)
    setRiotId(name, tag) {
        if (!name || !tag) {
            throw new Error('Riot IDの名前とタグを入力してください');
        }

        this.riotId = {
            name: name.trim(),
            tag: tag.trim().replace('#', '')
        };

        localStorage.setItem('valorant_riot_id', JSON.stringify(this.riotId));

        // キャッシュをクリア（新しいアカウントのため）
        this.clearCache();

        console.log(`Riot ID set: ${this.riotId.name}#${this.riotId.tag}`);
        return true;
    }

    // Riot IDを取得
    getRiotId() {
        return this.riotId || null;
    }

    // 設定が完了しているかチェック
    isConfigured() {
        return this.apiKey && this.apiKey.length > 0 && this.riotId;
    }

    // キャッシュをクリア
    clearCache() {
        this.cache = {
            account: null,
            mmr: null,
            matches: [],
            lastFetch: {}
        };
    }

    // キャッシュが有効かチェック
    isCacheValid(cacheKey) {
        const lastFetch = this.cache.lastFetch[cacheKey];
        if (!lastFetch) return false;
        return (Date.now() - lastFetch) < this.cacheDuration;
    }

    // レート制限を考慮したリクエスト
    async makeRequest(endpoint, options = {}) {
        if (!this.apiKey) {
            throw new Error('Valorant APIキーが設定されていません');
        }

        // レート制限チェック
        const now = Date.now();
        const timeSinceLastRequest = now - this.rateLimitConfig.lastRequestTime;

        if (timeSinceLastRequest < this.rateLimitConfig.minRequestInterval) {
            const waitTime = this.rateLimitConfig.minRequestInterval - timeSinceLastRequest;
            await this.delay(waitTime);
        }

        const url = `${this.baseUrl}${endpoint}`;

        try {
            console.log(`Valorant API Request: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': this.apiKey,
                    'Content-Type': 'application/json'
                },
                ...options
            });

            this.rateLimitConfig.lastRequestTime = Date.now();

            // レート制限エラー
            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || 60;
                throw new Error(`レート制限に達しました。${retryAfter}秒後に再試行してください。`);
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.errors?.[0]?.message ||
                                   errorData.message ||
                                   `HTTP ${response.status}: ${response.statusText}`;

                if (response.status === 404) {
                    throw new Error('プレイヤーが見つかりませんでした。Riot IDを確認してください。');
                } else if (response.status === 401) {
                    throw new Error('APIキーが無効です。Henrik APIのキーを確認してください。');
                } else if (response.status === 403) {
                    throw new Error('アクセスが拒否されました。APIキーの権限を確認してください。');
                }

                throw new Error(errorMessage);
            }

            const data = await response.json();

            // APIのエラーレスポンスチェック
            if (data.status && data.status !== 200) {
                throw new Error(data.errors?.[0]?.message || 'APIエラーが発生しました');
            }

            return data;

        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('ネットワーク接続に失敗しました。インターネット接続を確認してください。');
            }
            throw error;
        }
    }

    // 遅延処理
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // アカウント情報を取得
    async getAccountInfo() {
        if (!this.riotId) {
            throw new Error('Riot IDが設定されていません');
        }

        // キャッシュチェック
        if (this.isCacheValid('account') && this.cache.account) {
            console.log('Using cached account info');
            return this.cache.account;
        }

        const endpoint = `/valorant/v1/account/${encodeURIComponent(this.riotId.name)}/${encodeURIComponent(this.riotId.tag)}`;
        const response = await this.makeRequest(endpoint);

        // キャッシュに保存
        this.cache.account = response.data;
        this.cache.lastFetch['account'] = Date.now();

        return response.data;
    }

    // MMR/ランク情報を取得
    async getMMR() {
        if (!this.riotId) {
            throw new Error('Riot IDが設定されていません');
        }

        // キャッシュチェック
        if (this.isCacheValid('mmr') && this.cache.mmr) {
            console.log('Using cached MMR info');
            return this.cache.mmr;
        }

        const endpoint = `/valorant/v3/mmr/${this.region}/${this.platform}/${encodeURIComponent(this.riotId.name)}/${encodeURIComponent(this.riotId.tag)}`;
        const response = await this.makeRequest(endpoint);

        // キャッシュに保存
        this.cache.mmr = response.data;
        this.cache.lastFetch['mmr'] = Date.now();

        return response.data;
    }

    // マッチ履歴を取得
    async getMatchHistory(mode = 'competitive', size = 10) {
        if (!this.riotId) {
            throw new Error('Riot IDが設定されていません');
        }

        const cacheKey = `matches_${mode}_${size}`;

        // キャッシュチェック
        if (this.isCacheValid(cacheKey) && this.cache.matches.length > 0) {
            console.log('Using cached match history');
            return this.cache.matches;
        }

        const endpoint = `/valorant/v3/matches/${this.region}/${encodeURIComponent(this.riotId.name)}/${encodeURIComponent(this.riotId.tag)}?mode=${mode}&size=${size}`;
        const response = await this.makeRequest(endpoint);

        // キャッシュに保存
        this.cache.matches = response.data || [];
        this.cache.lastFetch[cacheKey] = Date.now();

        return response.data || [];
    }

    // 特定のマッチ詳細を取得
    async getMatchDetails(matchId) {
        const endpoint = `/valorant/v2/match/${matchId}`;
        const response = await this.makeRequest(endpoint);
        return response.data;
    }

    // 総合プレイヤー統計を計算
    async getPlayerStats() {
        try {
            const [account, mmr, matches] = await Promise.all([
                this.getAccountInfo(),
                this.getMMR(),
                this.getMatchHistory('competitive', 20)
            ]);

            // マッチデータから統計を計算
            const stats = this.calculateStats(matches, account.puuid);

            return {
                account: {
                    name: account.name,
                    tag: account.tag,
                    region: account.region,
                    accountLevel: account.account_level,
                    card: account.card
                },
                rank: {
                    current: mmr.current?.tier?.name || 'Unranked',
                    currentTier: mmr.current?.tier?.id || 0,
                    rr: mmr.current?.rr || 0,
                    peak: mmr.peak?.tier?.name || 'Unknown',
                    peakSeason: mmr.peak?.season || ''
                },
                stats: stats
            };
        } catch (error) {
            console.error('Failed to get player stats:', error);
            throw error;
        }
    }

    // マッチデータから統計を計算
    calculateStats(matches, puuid) {
        if (!matches || matches.length === 0) {
            return {
                totalMatches: 0,
                wins: 0,
                losses: 0,
                winRate: 0,
                avgKills: 0,
                avgDeaths: 0,
                avgAssists: 0,
                avgKD: 0,
                avgACS: 0,
                avgADR: 0,
                avgHS: 0,
                topAgents: [],
                topMaps: []
            };
        }

        let wins = 0;
        let totalKills = 0;
        let totalDeaths = 0;
        let totalAssists = 0;
        let totalACS = 0;
        let totalADR = 0;
        let totalHS = 0;
        const agentStats = {};
        const mapStats = {};

        matches.forEach(match => {
            // プレイヤーのデータを見つける
            const player = match.players?.all_players?.find(p => p.puuid === puuid);
            if (!player) return;

            // 勝敗判定
            const playerTeam = player.team?.toLowerCase();
            const redScore = match.teams?.red?.rounds_won || 0;
            const blueScore = match.teams?.blue?.rounds_won || 0;

            let isWin = false;
            if (playerTeam === 'red') {
                isWin = redScore > blueScore;
            } else if (playerTeam === 'blue') {
                isWin = blueScore > redScore;
            }

            if (isWin) wins++;

            // 統計加算
            const stats = player.stats || {};
            totalKills += stats.kills || 0;
            totalDeaths += stats.deaths || 0;
            totalAssists += stats.assists || 0;
            totalACS += player.acs || 0;
            totalADR += player.damage_per_round || stats.damage?.dealt || 0;
            totalHS += player.headshot_percent || 0;

            // エージェント統計
            const agent = player.character || 'Unknown';
            if (!agentStats[agent]) {
                agentStats[agent] = { matches: 0, wins: 0 };
            }
            agentStats[agent].matches++;
            if (isWin) agentStats[agent].wins++;

            // マップ統計
            const map = match.metadata?.map || 'Unknown';
            if (!mapStats[map]) {
                mapStats[map] = { matches: 0, wins: 0 };
            }
            mapStats[map].matches++;
            if (isWin) mapStats[map].wins++;
        });

        const totalMatches = matches.length;

        // トップエージェントを計算
        const topAgents = Object.entries(agentStats)
            .map(([agent, data]) => ({
                agent,
                matches: data.matches,
                wins: data.wins,
                winRate: data.matches > 0 ? ((data.wins / data.matches) * 100).toFixed(1) : 0
            }))
            .sort((a, b) => b.matches - a.matches)
            .slice(0, 5);

        // トップマップを計算
        const topMaps = Object.entries(mapStats)
            .map(([map, data]) => ({
                map,
                matches: data.matches,
                wins: data.wins,
                winRate: data.matches > 0 ? ((data.wins / data.matches) * 100).toFixed(1) : 0
            }))
            .sort((a, b) => b.matches - a.matches)
            .slice(0, 5);

        return {
            totalMatches,
            wins,
            losses: totalMatches - wins,
            winRate: totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : 0,
            avgKills: totalMatches > 0 ? (totalKills / totalMatches).toFixed(1) : 0,
            avgDeaths: totalMatches > 0 ? (totalDeaths / totalMatches).toFixed(1) : 0,
            avgAssists: totalMatches > 0 ? (totalAssists / totalMatches).toFixed(1) : 0,
            avgKD: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : 0,
            avgACS: totalMatches > 0 ? (totalACS / totalMatches).toFixed(1) : 0,
            avgADR: totalMatches > 0 ? (totalADR / totalMatches).toFixed(1) : 0,
            avgHS: totalMatches > 0 ? (totalHS / totalMatches).toFixed(1) : 0,
            topAgents,
            topMaps
        };
    }

    // マッチデータを既存のギャラリー形式に変換
    convertMatchToGalleryFormat(match, puuid) {
        const player = match.players?.all_players?.find(p => p.puuid === puuid);
        if (!player) return null;

        // チームスコア取得
        const playerTeam = player.team?.toLowerCase();
        const redScore = match.teams?.red?.rounds_won || 0;
        const blueScore = match.teams?.blue?.rounds_won || 0;

        let teamScore, enemyScore, result;
        if (playerTeam === 'red') {
            teamScore = redScore;
            enemyScore = blueScore;
        } else {
            teamScore = blueScore;
            enemyScore = redScore;
        }

        if (teamScore > enemyScore) {
            result = 'WIN';
        } else if (teamScore < enemyScore) {
            result = 'LOSS';
        } else {
            result = 'DRAW';
        }

        const stats = player.stats || {};

        return {
            id: match.metadata?.matchid || `match_${Date.now()}`,
            result: result,
            agent: player.character || 'Unknown',
            map: match.metadata?.map || 'Unknown',
            score: `${teamScore}-${enemyScore}`,
            rounds: `${teamScore}-${enemyScore}`,
            kills: stats.kills || 0,
            deaths: stats.deaths || 0,
            assists: stats.assists || 0,
            acs: player.acs || 0,
            adr: player.damage_per_round || 0,
            hsPercent: player.headshot_percent || 0,
            date: match.metadata?.game_start_patched || new Date().toISOString().split('T')[0],
            duration: Math.round((match.metadata?.game_length || 0) / 60),
            gameMode: match.metadata?.mode || 'Competitive',
            // 追加情報
            matchId: match.metadata?.matchid,
            season: match.metadata?.season_id,
            cluster: match.metadata?.cluster,
            importedFromAPI: true
        };
    }

    // マッチ履歴をインポート
    async importMatchHistory(mode = 'competitive', size = 10) {
        try {
            const account = await this.getAccountInfo();
            const matches = await this.getMatchHistory(mode, size);

            if (!matches || matches.length === 0) {
                return {
                    imported: 0,
                    skipped: 0,
                    message: 'インポートするマッチが見つかりませんでした'
                };
            }

            // 既存のギャラリーデータを取得
            const existingGallery = JSON.parse(localStorage.getItem('valorant_gallery') || '[]');
            const existingIds = new Set(existingGallery.map(m => m.matchId || m.id));

            // 新しいマッチを変換
            const newMatches = [];
            let skipped = 0;

            for (const match of matches) {
                const convertedMatch = this.convertMatchToGalleryFormat(match, account.puuid);
                if (convertedMatch) {
                    if (existingIds.has(convertedMatch.matchId)) {
                        skipped++;
                    } else {
                        newMatches.push(convertedMatch);
                    }
                }
            }

            // ギャラリーに追加
            if (newMatches.length > 0) {
                const updatedGallery = [...newMatches, ...existingGallery];
                localStorage.setItem('valorant_gallery', JSON.stringify(updatedGallery));
            }

            return {
                imported: newMatches.length,
                skipped: skipped,
                total: matches.length,
                message: `${newMatches.length}件のマッチをインポートしました${skipped > 0 ? `（${skipped}件は既存）` : ''}`
            };

        } catch (error) {
            console.error('Failed to import match history:', error);
            throw error;
        }
    }

    // 接続テスト
    async testConnection() {
        if (!this.isConfigured()) {
            throw new Error('APIキーとRiot IDを設定してください');
        }

        try {
            const account = await this.getAccountInfo();
            return {
                success: true,
                message: `接続成功: ${account.name}#${account.tag} (Level ${account.account_level})`,
                account: account
            };
        } catch (error) {
            return {
                success: false,
                message: `接続失敗: ${error.message}`,
                error: error
            };
        }
    }

    // デバッグ情報
    getDebugInfo() {
        return {
            isConfigured: this.isConfigured(),
            hasApiKey: !!this.apiKey,
            apiKeyLength: this.apiKey?.length || 0,
            riotId: this.riotId ? `${this.riotId.name}#${this.riotId.tag}` : 'Not set',
            region: this.region,
            platform: this.platform,
            cacheStatus: {
                account: this.isCacheValid('account'),
                mmr: this.isCacheValid('mmr'),
                matchesCount: this.cache.matches.length
            }
        };
    }

    // 設定をリセット
    reset() {
        this.apiKey = '';
        this.riotId = null;
        this.region = 'ap';
        this.platform = 'pc';
        this.clearCache();

        localStorage.removeItem('valorant_api_settings');
        localStorage.removeItem('valorant_riot_id');

        console.log('ValorantAPIService reset');
    }
}

// グローバルインスタンス
window.valorantAPIService = new ValorantAPIService();
