// theme-manager.js - テーマ管理システム
class ThemeManager {
  constructor() {
    this.currentTheme = localStorage.getItem('theme') || 'dark';
    this.init();
  }

  init() {
    // 初期テーマを適用
    this.applyTheme(this.currentTheme);
    
    // システム設定に基づく自動切り替え対応
    this.detectSystemTheme();
    
    // システムテーマ変更の監視
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('theme-manual')) {
          this.currentTheme = e.matches ? 'dark' : 'light';
          this.applyTheme(this.currentTheme);
        }
      });
    }
  }

  detectSystemTheme() {
    // ユーザーが手動で設定していない場合はシステム設定に従う
    if (!localStorage.getItem('theme-manual')) {
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        this.currentTheme = 'light';
      } else {
        this.currentTheme = 'dark';
      }
      this.applyTheme(this.currentTheme);
    }
  }

  toggleTheme() {
    this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
    this.applyTheme(this.currentTheme);
    localStorage.setItem('theme', this.currentTheme);
    localStorage.setItem('theme-manual', 'true'); // ユーザーが手動で切り替えたことを記録
    
    // アプリに通知
    if (window.app && typeof window.app.onThemeChange === 'function') {
      window.app.onThemeChange(this.currentTheme);
    }
    
    // カスタムイベントを発火
    window.dispatchEvent(new CustomEvent('themeChanged', { 
      detail: { theme: this.currentTheme }
    }));
  }

  applyTheme(theme) {
    const root = document.documentElement;
    const body = document.body;
    const toggleBtn = document.getElementById('theme-toggle-btn');
    
    // 既存のテーマクラスを削除
    body.classList.remove('light-theme', 'dark-theme');
    
    // テーマ属性を設定
    root.setAttribute('data-theme', theme);
    
    // テーマクラスを追加（CSS優先度強化のため）
    body.classList.add(theme === 'light' ? 'light-theme' : 'dark-theme');
    
    if (theme === 'light') {
      // ライトモードのCSS変数を設定
      this.setLightThemeVariables(root);
      if (toggleBtn) {
        toggleBtn.textContent = '☀️';
        toggleBtn.setAttribute('title', 'ダークモードに切り替え');
      }
    } else {
      // ダークモードのCSS変数を設定
      this.setDarkThemeVariables(root);
      if (toggleBtn) {
        toggleBtn.textContent = '🌙';
        toggleBtn.setAttribute('title', 'ライトモードに切り替え');
      }
    }

    // 強制的にスタイルを再計算
    root.style.display = 'none';
    root.offsetHeight; // reflow をトリガー
    root.style.display = '';

    // スムーズな遷移効果
    document.body.style.transition = 'all 0.3s ease';
    setTimeout(() => {
      document.body.style.transition = '';
    }, 300);
  }

  setLightThemeVariables(root) {
    // ライトモードのカラーパレット - 改善されたコントラスト
    const lightColors = {
      // 背景色
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f1f5f9',
      '--bg-card': '#ffffff',
      
      // テキスト色 - より高いコントラスト
      '--text-primary': '#0f172a',
      '--text-secondary': '#334155',
      '--text-muted': '#64748b',
      
      // アクセントカラー
      '--color-primary': '#2563eb',
      '--color-accent': '#dc2626',
      '--color-success': '#16a34a',
      '--color-warning': '#ca8a04',
      '--color-danger': '#dc2626',
      
      // ボーダーとエフェクト - より強い境界線
      '--glass-bg': 'rgba(248, 250, 252, 0.95)',
      '--glass-border': 'rgba(15, 23, 42, 0.15)',
      '--backdrop-blur': 'blur(10px)',
      
      // シャドウ - より強いシャドウ
      '--shadow-small': '0 2px 4px rgba(0, 0, 0, 0.15)',
      '--shadow-medium': '0 4px 12px rgba(0, 0, 0, 0.2)',
      '--shadow-large': '0 8px 24px rgba(0, 0, 0, 0.25)',
      '--shadow-neon': '0 0 20px rgba(37, 99, 235, 0.4)'
    };

    Object.entries(lightColors).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }

  setDarkThemeVariables(root) {
    // ダークモードのカラーパレット
    const darkColors = {
      // 背景色
      '--bg-primary': '#1a1a2e',
      '--bg-secondary': '#16213e',
      '--bg-card': '#16213e',
      
      // テキスト色
      '--text-primary': '#ffffff',
      '--text-secondary': '#b8c5d6',
      '--text-muted': '#7a8496',
      
      // アクセントカラー
      '--color-primary': '#0f3460',
      '--color-accent': '#e94560',
      '--color-success': '#10b981',
      '--color-warning': '#f59e0b',
      '--color-danger': '#ef4444',
      
      // ボーダーとエフェクト
      '--glass-bg': 'rgba(22, 33, 62, 0.8)',
      '--glass-border': 'rgba(255, 255, 255, 0.1)',
      '--backdrop-blur': 'blur(10px)',
      
      // シャドウ
      '--shadow-small': '0 2px 8px rgba(0, 0, 0, 0.15)',
      '--shadow-medium': '0 4px 16px rgba(0, 0, 0, 0.25)',
      '--shadow-large': '0 8px 32px rgba(0, 0, 0, 0.35)',
      '--shadow-neon': '0 0 20px rgba(233, 69, 96, 0.3)'
    };

    Object.entries(darkColors).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }

  getCurrentTheme() {
    return this.currentTheme;
  }

  setTheme(theme) {
    if (theme === 'light' || theme === 'dark') {
      this.currentTheme = theme;
      this.applyTheme(theme);
      localStorage.setItem('theme', theme);
      localStorage.setItem('theme-manual', 'true');
    }
  }

  // テーマに応じたスタイル調整
  updateChartColors() {
    const isLight = this.currentTheme === 'light';
    return {
      background: isLight ? '#ffffff' : 'transparent',
      gridColor: isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)',
      textColor: isLight ? '#4a5568' : '#b8c5d6',
      primaryColor: isLight ? '#3182ce' : '#e94560',
      secondaryColor: isLight ? '#38a169' : '#10b981'
    };
  }
}