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
    let totalACS = 0;
    let totalADR = 0;
    let totalHS = 0;
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

        // マッチ履歴を取得
        console.log('\n3. Fetching match history...');
        const matches = await getMatchHistory('competitive', 20);
        console.log(`   Found ${matches.length} matches`);

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
        console.log(`Matches: ${stats.totalMatches}`);
        console.log(`Top Agent: ${stats.topAgents[0]?.agent || 'N/A'}`);

        console.log('\n=== Done ===');

    } catch (error) {
        console.error('\nError:', error.message);
        process.exit(1);
    }
}

main();
