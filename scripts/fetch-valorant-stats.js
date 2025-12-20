// fetch-valorant-stats.js - GitHub ActionsでValorant戦績を取得するスクリプト
const fs = require('fs');
const path = require('path');

// 設定
const CONFIG = {
    baseUrl: 'https://api.henrikdev.xyz',
    apiKey: process.env.HENRIK_API_KEY,
    riotName: process.env.RIOT_NAME || 'ykun',
    riotTag: process.env.RIOT_TAG || '1672',
    region: process.env.RIOT_REGION || 'ap',
    platform: 'pc'
};

// レート制限対応の遅延
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// APIリクエスト
async function makeRequest(endpoint) {
    const url = `${CONFIG.baseUrl}${endpoint}`;

    console.log(`Fetching: ${url}`);

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': CONFIG.apiKey,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    return response.json();
}

// アカウント情報を取得
async function getAccountInfo() {
    const endpoint = `/valorant/v1/account/${encodeURIComponent(CONFIG.riotName)}/${encodeURIComponent(CONFIG.riotTag)}`;
    const response = await makeRequest(endpoint);
    return response.data;
}

// MMR/ランク情報を取得
async function getMMR() {
    const endpoint = `/valorant/v3/mmr/${CONFIG.region}/${CONFIG.platform}/${encodeURIComponent(CONFIG.riotName)}/${encodeURIComponent(CONFIG.riotTag)}`;
    const response = await makeRequest(endpoint);
    return response.data;
}

// マッチ履歴を取得
async function getMatchHistory(mode = 'competitive', size = 20) {
    const endpoint = `/valorant/v3/matches/${CONFIG.region}/${encodeURIComponent(CONFIG.riotName)}/${encodeURIComponent(CONFIG.riotTag)}?mode=${mode}&size=${size}`;
    const response = await makeRequest(endpoint);
    return response.data || [];
}

// マッチデータから統計を計算
function calculateStats(matches, puuid) {
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
    let totalScore = 0;
    let totalDamage = 0;
    let totalHeadshots = 0;
    let totalBodyshots = 0;
    let totalLegshots = 0;
    let totalRounds = 0;
    const agentStats = {};
    const mapStats = {};

    matches.forEach(match => {
        const player = match.players?.all_players?.find(p => p.puuid === puuid);
        if (!player) return;

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

        const stats = player.stats || {};
        totalKills += stats.kills || 0;
        totalDeaths += stats.deaths || 0;
        totalAssists += stats.assists || 0;

        // ラウンド数を取得
        const matchRounds = (redScore + blueScore) || 1;
        totalRounds += matchRounds;

        // スコア（ACS計算用）
        totalScore += stats.score || 0;

        // ダメージ（ADR計算用）
        const damage = player.damage_made || stats.damage?.made || stats.damage?.dealt || 0;
        totalDamage += damage;

        // ヘッドショット関連（HS%計算用）
        totalHeadshots += stats.headshots || 0;
        totalBodyshots += stats.bodyshots || 0;
        totalLegshots += stats.legshots || 0;

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

    // トップエージェント
    const topAgents = Object.entries(agentStats)
        .map(([agent, data]) => ({
            agent,
            matches: data.matches,
            wins: data.wins,
            winRate: data.matches > 0 ? ((data.wins / data.matches) * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.matches - a.matches)
        .slice(0, 5);

    // トップマップ
    const topMaps = Object.entries(mapStats)
        .map(([map, data]) => ({
            map,
            matches: data.matches,
            wins: data.wins,
            winRate: data.matches > 0 ? ((data.wins / data.matches) * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.matches - a.matches)
        .slice(0, 5);

    // ヘッドショット率を計算
    const totalShots = totalHeadshots + totalBodyshots + totalLegshots;
    const hsPercent = totalShots > 0 ? (totalHeadshots / totalShots) * 100 : 0;

    // ACS = スコア / ラウンド数
    const avgACS = totalRounds > 0 ? totalScore / totalRounds : 0;

    // ADR = ダメージ / ラウンド数
    const avgADR = totalRounds > 0 ? totalDamage / totalRounds : 0;

    return {
        totalMatches,
        wins,
        losses: totalMatches - wins,
        winRate: totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : "0.0",
        avgKills: totalMatches > 0 ? (totalKills / totalMatches).toFixed(1) : "0.0",
        avgDeaths: totalMatches > 0 ? (totalDeaths / totalMatches).toFixed(1) : "0.0",
        avgAssists: totalMatches > 0 ? (totalAssists / totalMatches).toFixed(1) : "0.0",
        avgKD: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : "0.00",
        avgACS: avgACS.toFixed(1),
        avgADR: avgADR.toFixed(1),
        avgHS: hsPercent.toFixed(1),
        topAgents,
        topMaps
    };
}

// マッチをギャラリー形式に変換
function convertMatchToGalleryFormat(match, puuid) {
    const player = match.players?.all_players?.find(p => p.puuid === puuid);
    if (!player) return null;

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
    const matchRounds = (teamScore + enemyScore) || 1;

    // ACS計算（スコア / ラウンド数）
    const acs = matchRounds > 0 ? (stats.score || 0) / matchRounds : 0;

    // ADR計算（ダメージ / ラウンド数）
    const damage = player.damage_made || stats.damage?.made || stats.damage?.dealt || 0;
    const adr = matchRounds > 0 ? damage / matchRounds : 0;

    // HS%計算
    const headshots = stats.headshots || 0;
    const bodyshots = stats.bodyshots || 0;
    const legshots = stats.legshots || 0;
    const totalShots = headshots + bodyshots + legshots;
    const hsPercent = totalShots > 0 ? (headshots / totalShots) * 100 : 0;

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
        acs: Math.round(acs * 10) / 10,
        adr: Math.round(adr * 10) / 10,
        hsPercent: Math.round(hsPercent * 10) / 10,
        date: match.metadata?.game_start_patched || new Date().toISOString().split('T')[0],
        duration: Math.round((match.metadata?.game_length || 0) / 60),
        gameMode: match.metadata?.mode || 'Competitive',
        matchId: match.metadata?.matchid,
        season: match.metadata?.season_id,
        importedFromAPI: true
    };
}

// メイン処理
async function main() {
    console.log('=== Valorant Stats Fetcher ===');
    console.log(`Riot ID: ${CONFIG.riotName}#${CONFIG.riotTag}`);
    console.log(`Region: ${CONFIG.region}`);

    if (!CONFIG.apiKey) {
        throw new Error('HENRIK_API_KEY environment variable is not set');
    }

    try {
        // アカウント情報を取得
        console.log('\n1. Fetching account info...');
        const account = await getAccountInfo();
        console.log(`   Account: ${account.name}#${account.tag} (Level ${account.account_level})`);

        await delay(2000); // レート制限対応

        // MMR情報を取得
        console.log('\n2. Fetching MMR info...');
        const mmr = await getMMR();
        console.log(`   Rank: ${mmr.current?.tier?.name || 'Unranked'} (${mmr.current?.rr || 0} RR)`);

        await delay(2000);

        // マッチ履歴を取得（Competitiveのみ）
        console.log('\n3. Fetching match history (Competitive only)...');
        const allMatches = await getMatchHistory('competitive', 20);

        // Competitiveモードのみをフィルタリング
        const competitiveMatches = allMatches.filter(match => {
            const mode = match.metadata?.mode?.toLowerCase();
            return mode === 'competitive';
        });

        // 最新シーズンを特定（最初のマッチのシーズンを基準）
        let currentSeason = null;
        let currentSeasonName = 'Unknown';
        if (competitiveMatches.length > 0) {
            currentSeason = competitiveMatches[0].metadata?.season_id;
            // シーズン名を推測（APIからは詳細名が取れない場合がある）
            currentSeasonName = currentSeason ? `Season ${currentSeason.substring(0, 8)}` : 'Current';
        }

        // 最新シーズンのマッチのみをフィルタリング
        const matches = currentSeason
            ? competitiveMatches.filter(match => match.metadata?.season_id === currentSeason)
            : competitiveMatches;

        console.log(`   Found ${matches.length} matches in current season (from ${competitiveMatches.length} competitive matches)`);
        if (currentSeason) {
            console.log(`   Current season ID: ${currentSeason}`);
        }

        // 統計を計算
        console.log('\n4. Calculating statistics...');
        const stats = calculateStats(matches, account.puuid);

        // マッチをギャラリー形式に変換
        const galleryMatches = matches
            .map(match => convertMatchToGalleryFormat(match, account.puuid))
            .filter(m => m !== null);

        // 結果をまとめる
        const result = {
            lastUpdated: new Date().toISOString(),
            account: {
                name: account.name,
                tag: account.tag,
                region: account.region,
                accountLevel: account.account_level,
                puuid: account.puuid,
                card: account.card
            },
            rank: {
                current: mmr.current?.tier?.name || 'Unranked',
                currentTier: mmr.current?.tier?.id || 0,
                rr: mmr.current?.rr || 0,
                peak: mmr.peak?.tier?.name || 'Unknown',
                peakSeason: mmr.peak?.season || ''
            },
            stats: stats,
            matches: galleryMatches
        };

        // JSONファイルとして保存
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const outputPath = path.join(dataDir, 'valorant-stats.json');
        fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
        console.log(`\n5. Saved to ${outputPath}`);

        // サマリーを表示
        console.log('\n=== Summary ===');
        console.log(`Rank: ${result.rank.current} (${result.rank.rr} RR)`);
        console.log(`Win Rate: ${stats.winRate}%`);
        console.log(`K/D: ${stats.avgKD}`);
        console.log(`HS%: ${stats.avgHS}%`);
        console.log(`ACS: ${stats.avgACS}`);
        console.log(`ADR: ${stats.avgADR}`);
        console.log(`Matches: ${stats.totalMatches}`);
        console.log(`Top Agent: ${stats.topAgents[0]?.agent || 'N/A'}`);

        console.log('\n=== Done ===');

    } catch (error) {
        console.error('\nError:', error.message);
        process.exit(1);
    }
}

main();
