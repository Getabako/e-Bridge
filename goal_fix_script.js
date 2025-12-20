// 目標進捗バー修正スクリプト
// ブラウザのConsoleで実行してください

console.log('🔧 目標進捗バー修正スクリプト開始');

// 1. 現在の目標データを取得・表示
function checkCurrentGoals() {
    const goalsData = localStorage.getItem('goals');
    console.log('📊 現在のgoalsデータ:', goalsData);

    if (goalsData) {
        const goals = JSON.parse(goalsData);
        console.log('📊 パースされた目標:', goals);

        goals.forEach((goal, index) => {
            console.log(`目標 ${index + 1}:`, {
                title: goal.title,
                progress: goal.progress,
                progressType: typeof goal.progress,
                deadline: goal.deadline
            });
        });

        return goals;
    } else {
        console.log('❌ 目標データが見つかりません');
        return [];
    }
}

// 2. 「操作」を含む目標の進捗を設定する
function fixOperationGoal(progressValue = 50) {
    const goals = checkCurrentGoals();

    if (goals.length === 0) {
        console.log('❌ 修正する目標がありません');
        return false;
    }

    let updated = false;
    const updatedGoals = goals.map(goal => {
        if (goal.title && goal.title.includes('操作')) {
            console.log(`🔧 目標「${goal.title}」の進捗を ${progressValue}% に設定`);
            goal.progress = progressValue;
            updated = true;
        }
        return goal;
    });

    if (updated) {
        localStorage.setItem('goals', JSON.stringify(updatedGoals));
        console.log('✅ localStorageに保存完了');

        // アプリが利用可能な場合は再読み込み
        if (window.app && typeof window.app.loadDashboardGoals === 'function') {
            console.log('🔄 ダッシュボード目標を再読み込み');
            window.app.loadDashboardGoals();
        }

        console.log('✅ 修正完了');
        return true;
    } else {
        console.log('❌ 「操作」を含む目標が見つかりませんでした');
        return false;
    }
}

// 3. 全ての目標の進捗を表示
function showAllGoalProgress() {
    const goals = checkCurrentGoals();
    console.log('\n📋 全目標の進捗状況:');
    goals.forEach((goal, index) => {
        console.log(`${index + 1}. ${goal.title}: ${goal.progress}%`);
    });
}

// 4. メイン実行
console.log('🚀 修正を実行します...');
checkCurrentGoals();
fixOperationGoal(50);
showAllGoalProgress();

console.log('\n✅ スクリプト実行完了');
console.log('\n📝 手動実行コマンド:');
console.log('  fixOperationGoal(75)  // 進捗を75%に設定');
console.log('  checkCurrentGoals()   // 現在の目標データを確認');
console.log('  showAllGoalProgress() // 全目標の進捗を表示');