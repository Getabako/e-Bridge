// デバッグ用スクリプト: 目標の進捗バー問題を修正

console.log('🎯 目標進捗バー デバッグスクリプト開始');

// 1. 現在の目標データを確認
const currentGoals = JSON.parse(localStorage.getItem('goals') || '[]');
console.log('📊 現在の目標データ:', currentGoals);

// 2. 各目標の進捗値を確認・修正
const fixedGoals = currentGoals.map((goal, index) => {
    console.log(`🎯 目標 ${index + 1}: "${goal.title}"`);
    console.log(`   - 現在の進捗: ${goal.progress}`);
    console.log(`   - 型: ${typeof goal.progress}`);

    // 進捗が未定義、null、または無効な場合は25%に設定（デモ用）
    if (typeof goal.progress !== 'number' || isNaN(goal.progress)) {
        goal.progress = 25; // デモ用に25%に設定
        console.log(`   - 修正後: ${goal.progress}%`);
    }

    return goal;
});

// 3. 修正したデータを保存
localStorage.setItem('goals', JSON.stringify(fixedGoals));
console.log('💾 修正された目標データを保存しました');

// 4. アプリが存在する場合は再読み込み
if (window.app && typeof window.app.loadDashboardGoals === 'function') {
    console.log('🔄 ダッシュボード目標を再読み込み中...');
    window.app.loadDashboardGoals();
    console.log('✅ ダッシュボード目標の再読み込み完了');
} else {
    console.log('⚠️ アプリインスタンスが見つかりません。ページをリロードしてください。');
}

// 5. 特定の目標を手動で更新する関数を提供
window.updateGoalProgressManually = function(title, progress) {
    const goals = JSON.parse(localStorage.getItem('goals') || '[]');
    const goalIndex = goals.findIndex(goal => goal.title.includes(title));

    if (goalIndex !== -1) {
        goals[goalIndex].progress = progress;
        localStorage.setItem('goals', JSON.stringify(goals));

        if (window.app && typeof window.app.loadDashboardGoals === 'function') {
            window.app.loadDashboardGoals();
        }

        console.log(`✅ "${goals[goalIndex].title}" の進捗を ${progress}% に更新しました`);
        return true;
    } else {
        console.log(`❌ "${title}" を含む目標が見つかりませんでした`);
        return false;
    }
};

console.log('🎯 使用方法:');
console.log('   updateGoalProgressManually("操作", 50) // "操作になれる"の進捗を50%に設定');
console.log('');
console.log('🎯 デバッグスクリプト完了');