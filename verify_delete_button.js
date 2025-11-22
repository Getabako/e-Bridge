
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // サーバーが起動するのを少し待つ
  await new Promise(resolve => setTimeout(resolve, 2000));

  // ダミーデータをlocalStorageにセットするために一度ページを開く
  await page.goto('http://localhost:8000');

  await page.evaluate(() => {
    localStorage.clear(); // 一旦クリア
    // 初期設定完了フラグ
    localStorage.setItem('initialSetupCompleted', 'true');
    localStorage.setItem('playerSkillLevel', 'intermediate');
    localStorage.setItem('selectedGame', 'valorant');
    localStorage.setItem('selectedGameData', JSON.stringify({
        id: 'valorant',
        name: 'VALORANT',
        icon: '🎯',
        category: 'FPS'
    }));

    const dummyPlans = [
        {
            id: 'plan_123',
            goalId: 'goal_123',
            goalTitle: 'テストプラン',
            status: 'active',
            weeks: [
                { weekNumber: 1, startDate: '2024-01-01', endDate: '2024-01-07', focus: 'Focus', objectives: ['Obj1'], milestones: ['Mile1'] }
            ],
            metadata: { totalWeeks: 1 }
        }
    ];
    localStorage.setItem('coaching_plans', JSON.stringify(dummyPlans));

    localStorage.setItem('goals', JSON.stringify([{
        id: 'goal_123',
        title: 'テストプラン',
        deadline: '2024-12-31',
        planId: 'plan_123'
    }]));
  });

  // 再読み込みしてデータを反映
  await page.reload();
  await page.waitForTimeout(2000); // 読み込み待機

  // API初期設定モーダルが表示されているか確認し、強制的に非表示にする
  await page.evaluate(() => {
      const apiModal = document.getElementById('api-initial-setup-modal');
      if (apiModal) {
          apiModal.classList.add('hidden');
          apiModal.style.display = 'none';
          // オーバーレイも消す
          const overlays = document.querySelectorAll('.modal-overlay');
          overlays.forEach(o => o.style.display = 'none');
      }
      const loginModal = document.getElementById('login-modal');
      if (loginModal) {
          loginModal.classList.add('hidden');
          loginModal.style.display = 'none';
      }
  });
  await page.waitForTimeout(500);

  // コーチングプランページへ移動（DOM操作で強制的にアクティブにする）
  await page.evaluate(() => {
      // ナビゲーションボタンをアクティブに
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const btn = document.querySelector('button[data-page="coaching-plans"]');
      if (btn) btn.classList.add('active');

      // ページをアクティブに
      document.querySelectorAll('.page').forEach(p => {
          p.classList.remove('active');
          p.style.display = 'none';
      });
      const targetPage = document.getElementById('coaching-plans');
      if (targetPage) {
          targetPage.classList.add('active');
          targetPage.style.display = 'block';

          // app.jsの関数を呼んで再描画させる
          if (window.app && window.app.loadCoachingPlans) {
              window.app.loadCoachingPlans();
          }
      }
  });

  // 少し待つ
  await page.waitForTimeout(1000);

  // スクリーンショットを保存
  await page.screenshot({ path: 'coaching_plans_page_header_icon.png', fullPage: true });

  // 詳細ボタンをクリック（DOM操作で）
  await page.evaluate(() => {
      const btn = document.querySelector('.plan-actions .btn-primary'); // 「詳細表示」ボタン
      if (btn) btn.click();
  });

  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'plan_detail_modal_header_icon.png', fullPage: true });

  await browser.close();
})();
