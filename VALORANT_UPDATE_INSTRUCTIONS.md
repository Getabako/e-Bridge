# VALORANT アップデート実装手順

このファイルには、ストリートファイター6機能をVALORANT試合分析機能に置き換えるための詳細な手順が記載されています。

## 完了した作業

### 1. index.html の更新 ✅
- ✅ マップ選択UI (7種類のマップ)
- ✅ エージェント選択UI (28種類のエージェント)
- ✅ スコア入力フィールド (チームスコア vs 敵スコア)
- ✅ KDA入力フィールド (Kill/Death/Assist)
- ✅ 各種スタッツ入力フィールド (ACS, ADR, HS%)
- ✅ SF6特有のUI要素の削除 (相手キャラクター、VS、決着方法)
- ✅ hidden input フィールドの更新

## 残りの作業

### 2. app.js の更新

#### A. setupQuickMatchListeners() 関数の置き換え

**場所**: app.js の行1086付近

**置き換え対象のコード**:
```javascript
setupQuickMatchListeners() {
    // 自分のキャラクター選択
    const characterOptions = document.querySelectorAll('#player-character-grid .char-option');
    // ... (既存のSF6用コード)
}
```

**新しいコード**:
```javascript
setupQuickMatchListeners() {
    // マップ選択
    const mapOptions = document.querySelectorAll('.map-option');
    mapOptions.forEach(option => {
        option.addEventListener('click', () => {
            this.selectMap(option);
        });
    });

    // エージェント選択
    const agentOptions = document.querySelectorAll('.agent-option');
    agentOptions.forEach(option => {
        option.addEventListener('click', () => {
            this.selectAgent(option);
        });
    });

    // エージェント検索機能
    this.setupAgentFiltering();

    // スコア・KDA入力フィールドの監視
    const scoreInputs = ['team-score', 'enemy-score', 'kills', 'deaths', 'assists'];
    scoreInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', () => this.updateSubmitButton());
        }
    });

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
```

#### B. 新しいヘルパー関数の追加

**場所**: setupQuickMatchListeners() の後に追加

```javascript
// マップ選択処理
selectMap(option) {
    // 他の選択を解除
    document.querySelectorAll('.map-option').forEach(opt => {
        opt.classList.remove('selected');
    });

    // 新しい選択をアクティブにする
    option.classList.add('selected');

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
```

#### C. updateSubmitButton() 関数の置き換え

**場所**: app.js の既存 updateSubmitButton() 関数を検索

**新しいコード**:
```javascript
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
```

#### D. resetQuickForm() 関数の置き換え

**場所**: app.js の既存 resetQuickForm() 関数を検索

**新しいコード**:
```javascript
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
        'team-score': 13,
        'enemy-score': 10,
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
```

#### E. handleQuickMatchSubmit() 関数の置き換え

**場所**: app.js の既存 handleQuickMatchSubmit() 関数を検索

**新しいコード**:
```javascript
handleQuickMatchSubmit() {
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

    // フォームをリセット
    this.resetQuickForm();

    this.showToast('✅ VALORANT試合データを記録しました！', 'success');

    // ダッシュボードを更新
    if (this.currentPage === 'dashboard') {
        this.loadDashboard();
    }

    // ギャラリーを更新
    if (this.currentPage === 'gallery') {
        this.loadGallery();
    }
}
```

#### F. storeValorantMatch() 関数の追加

**場所**: handleQuickMatchSubmit() の後に追加

```javascript
// VALORANT試合データを保存
storeValorantMatch(matchData) {
    try {
        // 既存のデータを取得
        const existingMatches = JSON.parse(localStorage.getItem('valorant_matches') || '[]');
        
        // 新しい試合データを追加
        existingMatches.push(matchData);
        
        // ローカルストレージに保存
        localStorage.setItem('valorant_matches', JSON.stringify(existingMatches));
        
        console.log('VALORANT試合データを保存しました:', matchData);
    } catch (error) {
        console.error('試合データの保存に失敗しました:', error);
        this.showToast('❌ データの保存に失敗しました', 'error');
    }
}
```

### 3. ギャラリー表示の更新

#### A. loadGallery() 関数の更新

**場所**: app.js の loadGallery() 関数を検索

**更新内容**:
- `localStorage.getItem('valorant_gallery')` を `localStorage.getItem('valorant_matches')` に変更
- カード表示をVALORANT仕様に変更 (マップ名、エージェント、KDA、スタッツ)

#### B. カード生成コードの例

```javascript
loadGallery() {
    const galleryGrid = document.getElementById('gallery-grid');
    if (!galleryGrid) return;

    // VALORANT試合データを取得
    const matches = JSON.parse(localStorage.getItem('valorant_matches') || '[]');

    if (matches.length === 0) {
        galleryGrid.innerHTML = `
            <div class="no-matches-message">
                <p class="message-text">まだ試合データがありません</p>
                <p class="message-sub">分析タブから試合結果を入力してください</p>
            </div>
        `;
        return;
    }

    // 最新の試合から表示
    const sortedMatches = matches.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    galleryGrid.innerHTML = sortedMatches.map(match => `
        <div class="match-card valorant-match-card ${match.result.toLowerCase()}" data-match-id="${match.id}">
            <div class="match-card-header">
                <div class="match-map">
                    <span class="map-icon">🗺️</span>
                    <span class="map-name">${match.map}</span>
                </div>
                <div class="match-score ${match.result.toLowerCase()}">
                    ${match.score} (${match.result})
                </div>
            </div>
            <div class="match-card-body">
                <div class="agent-info">
                    <span class="agent-label">使用エージェント:</span>
                    <span class="agent-name">${match.agent}</span>
                </div>
                <div class="match-stats">
                    <div class="stat-row">
                        <span class="stat-label">KDA:</span>
                        <span class="stat-value">${match.kills}/${match.deaths}/${match.assists} (${match.kda})</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">ACS:</span>
                        <span class="stat-value">${match.acs}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">ADR:</span>
                        <span class="stat-value">${match.adr}</span>
                    </div>
                    <div class="stat-row">
                        <span class="stat-label">HS%:</span>
                        <span class="stat-value">${match.hsPercent}%</span>
                    </div>
                </div>
                ${match.insightTags && match.insightTags.length > 0 ? `
                    <div class="match-tags">
                        ${match.insightTags.map(tag => `<span class="match-tag">${tag}</span>`).join('')}
                    </div>
                ` : ''}
            </div>
            <div class="match-card-footer">
                <span class="match-date">${match.date}</span>
                <button class="btn-text delete-match-btn" data-match-id="${match.id}">🗑️ 削除</button>
            </div>
        </div>
    `).join('');

    // 削除ボタンのイベントリスナー
    document.querySelectorAll('.delete-match-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const matchId = e.target.dataset.matchId;
            this.deleteValorantMatch(matchId);
        });
    });
}
```

### 4. CSS の追加

**場所**: styles.css の最後に追加

```css
/* VALORANT Match Cards */
.valorant-match-card {
    background: linear-gradient(145deg, 
        rgba(22, 33, 62, 0.95), 
        rgba(26, 26, 46, 0.9)
    );
    border: 2px solid rgba(233, 69, 96, 0.3);
    border-radius: 12px;
    padding: 1.5rem;
    transition: all 0.3s ease;
}

.valorant-match-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(233, 69, 96, 0.3);
    border-color: rgba(233, 69, 96, 0.6);
}

.valorant-match-card.win {
    border-left: 4px solid #00c896;
}

.valorant-match-card.loss {
    border-left: 4px solid #ff4655;
}

.match-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.match-map {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    font-weight: 600;
}

.match-score {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-weight: 700;
}

.match-score.win {
    background: rgba(0, 200, 150, 0.2);
    color: #00c896;
}

.match-score.loss {
    background: rgba(255, 70, 85, 0.2);
    color: #ff4655;
}

.agent-info {
    margin-bottom: 1rem;
    font-size: 1rem;
}

.agent-label {
    color: var(--text-secondary);
}

.agent-name {
    font-weight: 600;
    color: var(--color-accent);
}

.match-stats {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.stat-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
}

.stat-label {
    color: var(--text-secondary);
}

.stat-value {
    font-weight: 600;
    color: var(--text-primary);
}

.match-card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.match-date {
    font-size: 0.875rem;
    color: var(--text-muted);
}

/* Map Options */
.map-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
}

.map-option {
    padding: 1rem;
    background: var(--glass-bg);
    border: 2px solid transparent;
    border-radius: 8px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    font-weight: 600;
}

.map-option:hover {
    border-color: var(--color-accent);
    background: rgba(233, 69, 96, 0.1);
    transform: scale(1.05);
}

.map-option.selected {
    border-color: var(--color-accent);
    background: rgba(233, 69, 96, 0.2);
    box-shadow: 0 0 10px rgba(233, 69, 96, 0.3);
}

/* Agent Options */
.agent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 0.75rem;
}

.agent-option {
    padding: 0.75rem 1rem;
    background: var(--glass-bg);
    border: 2px solid transparent;
    border-radius: 8px;
    text-align: center;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 0.9rem;
}

.agent-option:hover {
    border-color: var(--color-accent);
    background: rgba(233, 69, 96, 0.1);
    transform: scale(1.05);
}

.agent-option.selected {
    border-color: var(--color-accent);
    background: rgba(233, 69, 96, 0.2);
    box-shadow: 0 0 10px rgba(233, 69, 96, 0.3);
}

/* Score and KDA Inputs */
.score-inputs,
.kda-inputs {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
}

.score-input-group,
.kda-input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
}

.score-input-group input,
.kda-input-group input {
    width: 80px;
    padding: 0.75rem;
    text-align: center;
    font-size: 1.25rem;
    font-weight: 700;
    border: 2px solid var(--glass-border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
}

.score-separator,
.kda-separator {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-secondary);
}

/* Stats Grid */
.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
}

.stat-input-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
}

.stat-input-group label {
    font-size: 0.9rem;
    color: var(--text-secondary);
    font-weight: 600;
}

.stat-input-group input {
    padding: 0.75rem;
    border: 2px solid var(--glass-border);
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    font-size: 1rem;
}
```

## 実装チェックリスト

- [x] index.html の UI 更新
- [ ] app.js の setupQuickMatchListeners() 更新
- [ ] app.js の selectMap(), selectAgent() 追加
- [ ] app.js の updateSubmitButton() 更新
- [ ] app.js の resetQuickForm() 更新
- [ ] app.js の handleQuickMatchSubmit() 更新
- [ ] app.js の storeValorantMatch() 追加
- [ ] app.js の loadGallery() 更新
- [ ] styles.css に VALORANT 用スタイル追加

## テスト手順

1. ブラウザで `index.html` を開く
2. 「分析」タブに移動
3. マップを選択
4. エージェントを選択
5. スコアを入力 (例: 13-10)
6. KDAを入力 (例: 15/8/5)
7. スタッツを入力 (任意)
8. 「試合を記録」ボタンをクリック
9. 「ギャラリー」タブで試合カードが表示されることを確認
10. カードに正しい情報 (マップ、エージェント、KDA、スコア) が表示されることを確認

## トラブルシューティング

### 送信ボタンが有効にならない
- すべての必須フィールド (マップ、エージェント、スコア、KDA) が入力されているか確認
- `updateSubmitButton()` 関数が正しく呼ばれているか確認

### データが保存されない
- ブラウザのコンソールでエラーを確認
- `localStorage` が使用可能か確認
- `storeValorantMatch()` 関数が正しく実装されているか確認

### ギャラリーにカードが表示されない
- `localStorage.getItem('valorant_matches')` でデータが存在するか確認
- `loadGallery()` 関数が正しく実装されているか確認
