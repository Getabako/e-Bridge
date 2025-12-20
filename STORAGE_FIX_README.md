# 🔧 ギャラリー表示問題の修正

## 問題の原因

**データの保存場所と読み込み場所の不一致**

- **保存**: バッチ入力は `sf6_gallery` に保存
- **読み込み**: ギャラリーページは `recentMatches` から読み込み
- **結果**: データが保存されてもギャラリーに表示されない

## 修正内容

### 1. **統一ストレージ戦略**

両方のストレージ (`sf6_gallery` と `recentMatches`) をマージして使用するように変更:

```javascript
// 修正前
const matches = JSON.parse(localStorage.getItem('recentMatches') || '[]');

// 修正後
const sf6Gallery = JSON.parse(localStorage.getItem('sf6_gallery') || '[]');
const recentMatches = JSON.parse(localStorage.getItem('recentMatches') || '[]');

// 重複を排除してマージ
const matchesMap = new Map();
[...sf6Gallery, ...recentMatches].forEach(match => {
    if (match.id) {
        matchesMap.set(match.id, match);
    }
});

const matches = Array.from(matchesMap.values());
```

### 2. **修正したメソッド**

#### ✅ `loadGalleryMatches()`
- 両方のストレージから試合データを読み込み
- 重複を排除してマージ
- ギャラリーページに表示

#### ✅ `loadRecentMatches()`
- ダッシュボードの「最近の試合結果」も両方のストレージから読み込み
- 最新10件のみ表示
- 新しい順にソート

#### ✅ `renderWinRateTrendChart()`
- 勝率トレンドグラフも両方のストレージからデータ取得
- 統計の正確性を向上

#### ✅ `renderCharacterUsageChart()`
- キャラクター使用率グラフも統合データを使用

#### ✅ `loadWinRateDetailData()`
- 勝率詳細モーダルも統合データを使用

#### ✅ `storeMatchAndRefresh()`
- 新しい試合データを**両方のストレージ**に保存
- データの一貫性を確保

#### ✅ `saveBatchMatchData()`
- 保存後、ギャラリーページにいる場合は自動リロード

### 3. **データの重複排除**

`Map`を使用してIDベースで重複を排除:

```javascript
const matchesMap = new Map();
[...sf6Gallery, ...recentMatches].forEach(match => {
    if (match.id) {
        matchesMap.set(match.id, match);
    }
});
```

### 4. **ソート処理**

最新のデータが上に来るように、IDベースでソート:

```javascript
const matches = Array.from(matchesMap.values())
    .sort((a, b) => (b.id || 0) - (a.id || 0)); // 新しい順
```

## テスト手順

### 1. バッチ入力のテスト
1. 分析ページの「まとめて入力」セクションを開く
2. スクリーンショットをアップロード
3. データを確認して保存
4. ✅ 「データを保存しました」メッセージが表示される

### 2. ギャラリー表示の確認
1. ギャラリーページに移動
2. ✅ 保存したデータが表示される
3. ✅ 試合カードがクリック可能

### 3. ダッシュボードの確認
1. ダッシュボードページに移動
2. ✅ 「最近の試合結果」にデータが表示される
3. ✅ 勝率トレンドグラフが更新される
4. ✅ キャラクター使用率グラフが更新される

### 4. 統計の確認
1. ダッシュボードの「📊 詳しく見る」をクリック
2. ✅ 対戦キャラクター別統計が表示される
3. ✅ 総試合数が正しい

## データ構造

### `sf6_gallery`
```json
[
  {
    "id": "batch_1728567890123_abc123",
    "timestamp": "2025-10-10T12:34:56.789Z",
    "character": "LUKE",
    "opponent": "Unknown",
    "result": "WIN",
    "score": "3-0",
    "decision": "unknown",
    "source": "batch_screenshot",
    "insightTags": ["#一括入力"],
    "feelings": "スクリーンショットから一括入力されたデータ"
  }
]
```

### `recentMatches`
```json
[
  {
    "id": 1728567890123,
    "result": "WIN",
    "character": "Luke",
    "playerCharacter": "Luke",
    "opponentCharacter": "Ryu",
    "roundsWon": 3,
    "roundsLost": 1,
    "rounds": "3-1",
    "duration": 3,
    "date": "2025-10-10",
    "gameMode": "Ranked"
  }
]
```

## 今後の改善案

### データ移行
将来的には、`recentMatches` のデータを `sf6_gallery` に統合して、単一のストレージに移行することを検討:

```javascript
// データ移行スクリプト（参考）
function migrateToSingleStorage() {
    const sf6Gallery = JSON.parse(localStorage.getItem('sf6_gallery') || '[]');
    const recentMatches = JSON.parse(localStorage.getItem('recentMatches') || '[]');
    
    const allMatches = [...sf6Gallery, ...recentMatches];
    localStorage.setItem('sf6_gallery', JSON.stringify(allMatches));
    localStorage.removeItem('recentMatches');
    
    console.log('✅ データ移行完了');
}
```

## まとめ

✅ **問題**: ギャラリーにデータが表示されない
✅ **原因**: 保存場所と読み込み場所の不一致
✅ **解決**: 両方のストレージをマージして使用
✅ **効果**: すべての画面で統合データが表示される

これで、バッチ入力で保存したデータがギャラリー、ダッシュボード、グラフすべてに反映されるようになりました！🎉
