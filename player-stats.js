// 統計データ管理のための新しいファイル
class PlayerStatsManager {
    constructor() {
        this.storageKey = 'playerStats';
    }

    // プレイヤー統計データを取得
    getPlayerStats() {
        return JSON.parse(localStorage.getItem(this.storageKey) || '{}');
    }

    // プレイヤー統計データを保存
    savePlayerStats(stats) {
        localStorage.setItem(this.storageKey, JSON.stringify(stats));
    }

    // 統計値が存在するかチェック
    hasValidStats() {
        const stats = this.getPlayerStats();
        return stats.winRate !== undefined &&
               stats.gamesPlayed !== undefined;
    }

    // 統計データをダッシュボードに表示
    loadStatsToUI() {
        const stats = this.getPlayerStats();

        // 統計値の更新（基本統計のみ）
        if (stats.winRate !== undefined) {
            const element = document.getElementById('win-rate');
            if (element) element.textContent = stats.winRate + '%';
        }

        if (stats.gamesPlayed !== undefined) {
            const element = document.getElementById('games-played');
            if (element) element.textContent = stats.gamesPlayed;
        }

        // チャートの初期化（データがある場合のみ）
        this.initChartsIfDataExists(stats);
    }

    // データが存在する場合のみチャートを初期化
    initChartsIfDataExists(stats) {
        if (stats.performanceData && stats.performanceData.length > 0) {
            this.initPerformanceChart(stats.performanceData);
        }
        
        if (stats.sf6MetricsData) {
            this.initSF6MetricsChart(stats.sf6MetricsData);
        }
    }

    // パフォーマンスチャート初期化
    initPerformanceChart(data) {
        const perfCanvas = document.getElementById('performance-chart');
        if (perfCanvas && typeof Chart !== 'undefined') {
            const ctx = perfCanvas.getContext('2d');
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.labels,
                    datasets: [{
                        label: '勝率',
                        data: data.values,
                        borderColor: '#e94560',
                        backgroundColor: 'rgba(233, 69, 96, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: false
                        }
                    }
                }
            });
        }
    }

    // SF6指標チャート初期化
    initSF6MetricsChart(data) {
        const sf6Canvas = document.getElementById('sf6-metrics-chart');
        if (sf6Canvas && typeof Chart !== 'undefined') {
            const ctx = sf6Canvas.getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['ドライブインパクト成功率', '対空成功率', '投げ抜け率'],
                    datasets: [{
                        label: '成功率 (%)',
                        data: [data.driveImpact, data.antiAir, data.throwTech],
                        backgroundColor: ['#e94560', '#0f3460', '#10b981']
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
        }
    }

    // 最近の試合履歴をロード
    loadRecentMatches() {
        const container = document.getElementById('recent-matches');
        if (!container) return;
        
        // 新旧両方のキーからデータを取得してマージ
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
        
        if (matches.length === 0) {
            container.innerHTML = '<p class="no-data">試合記録がまだありません</p>';
            return;
        }
        
        container.innerHTML = matches.map(match => {
            // agent プロパティも認識するように修正
            const character = match.agent || match.character || 'Unknown';
            return `
            <div class="match-item ${match.result.toLowerCase()}">
                <span class="match-result">${match.result}</span>
                <span class="match-character">キャラ: ${character}</span>
                <span class="match-rounds">ラウンド: ${match.rounds || match.score || '0-0'}</span>
            </div>
        `;
        }).join('');
    }
}

// グローバルに使用できるようにする
window.PlayerStatsManager = PlayerStatsManager;