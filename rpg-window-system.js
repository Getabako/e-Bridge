// rpg-window-system.js
// 8ビットRPG風ウィンドウシステム - 瞬時開閉専用

class RPGWindowSystem {
    constructor() {
        this.windows = new Map();
        this.backgroundStack = [];
        this.isWindowOpen = false;
        this.init();
    }

    init() {
        // ウィンドウコンテナを作成
        this.container = document.createElement('div');
        this.container.id = 'rpg-window-container';
        this.container.className = 'rpg-window-container';
        document.body.appendChild(this.container);

        // 背景保存用のキャンバスを準備
        this.backgroundCanvas = document.createElement('canvas');
        this.backgroundContext = this.backgroundCanvas.getContext('2d');
    }

    /**
     * ウィンドウをスムーズに開く（アニメーション付き）
     * @param {string} id - ウィンドウID
     * @param {string} content - ウィンドウの内容(HTML)
     * @param {Object} options - オプション設定
     */
    openWindow(id, content, options = {}) {
        // 既に開いている場合はスキップ
        if (this.isWindowOpen) {
            console.warn('ウィンドウは既に開かれています');
            return;
        }

        // 現在の背景を保存
        this.saveBackground();

        // ウィンドウ要素を作成
        const window = this.createWindowElement(id, content, options);
        
        // DOMに追加（アニメーションで表示）
        this.container.appendChild(window);
        this.windows.set(id, window);
        this.isWindowOpen = true;

        // アニメーション開始を少し遅延させて確実に動作させる
        requestAnimationFrame(() => {
            window.style.opacity = '1';
        });

        // ウィンドウが開いたことを記録
        console.log(`[RPG Window] スムーズ開: ${id}`);

        // 閉じるボタンのイベント設定
        this.setupCloseButton(window, id);
    }

    /**
     * ウィンドウをスムーズに閉じる（アニメーション付き）
     * @param {string} id - ウィンドウID
     */
    closeWindow(id) {
        const window = this.windows.get(id);
        if (!window) {
            console.warn(`ウィンドウ "${id}" が見つかりません`);
            return;
        }

        // フェードアウトアニメーション
        window.style.opacity = '0';
        window.style.transform = 'translate(-50%, -48%) scale(0.95)';
        
        // アニメーション完了後に削除
        setTimeout(() => {
            window.remove();
            this.windows.delete(id);
            this.isWindowOpen = false;

            // 背景を復元
            this.restoreBackground();

            console.log(`[RPG Window] スムーズ閉: ${id}`);
        }, 300);
    }

    /**
     * ウィンドウ要素を作成
     */
    createWindowElement(id, content, options) {
        const window = document.createElement('div');
        window.id = `rpg-window-${id}`;
        window.className = 'rpg-window';
        
        // デフォルトオプション
        const opts = {
            width: options.width || '600px',
            height: options.height || 'auto',
            title: options.title || 'ウィンドウ',
            closable: options.closable !== false,
            centered: options.centered !== false,
            ...options
        };

        // スタイル適用
        if (opts.centered) {
            window.style.left = '50%';
            window.style.top = '50%';
            window.style.transform = 'translate(-50%, -50%)';
        }
        window.style.width = opts.width;
        window.style.height = opts.height;

        // ウィンドウ構造
        window.innerHTML = `
            <div class="rpg-window-border">
                <div class="rpg-window-header">
                    <span class="rpg-window-title">${opts.title}</span>
                    ${opts.closable ? '<button class="rpg-window-close" data-window-id="' + id + '">✕</button>' : ''}
                </div>
                <div class="rpg-window-content">
                    ${content}
                </div>
            </div>
        `;

        return window;
    }

    /**
     * 閉じるボタンのイベント設定
     */
    setupCloseButton(window, id) {
        const closeBtn = window.querySelector('.rpg-window-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeWindow(id);
            });
        }

        // ESCキーで閉じる
        const escHandler = (e) => {
            if (e.key === 'Escape' && this.isWindowOpen) {
                this.closeWindow(id);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    }

    /**
     * 背景を保存（瞬時スナップショット）
     */
    saveBackground() {
        // 現在のメインコンテンツの状態を記録
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            // DOMの状態をスタックに保存
            this.backgroundStack.push({
                content: mainContent.innerHTML,
                scrollPosition: window.scrollY,
                timestamp: Date.now()
            });
        }
    }

    /**
     * 背景を復元（瞬時復元）
     */
    restoreBackground() {
        if (this.backgroundStack.length === 0) {
            return;
        }

        const savedState = this.backgroundStack.pop();
        // スクロール位置を瞬時に復元
        window.scrollTo(0, savedState.scrollPosition);
    }

    /**
     * すべてのウィンドウを瞬時に閉じる
     */
    closeAllWindows() {
        const windowIds = Array.from(this.windows.keys());
        windowIds.forEach(id => {
            this.closeWindow(id);
        });
    }

    /**
     * 特定のウィンドウが開いているか確認
     */
    isOpen(id) {
        return this.windows.has(id);
    }
}

// グローバルインスタンス作成
window.rpgWindowSystem = new RPGWindowSystem();

console.log('[RPG Window System] 初期化完了 - 瞬時開閉モード');
