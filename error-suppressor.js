/**
 * ブラウザ拡張機能関連のエラー抑制スクリプト
 * Chrome拡張機能との通信エラーを安全に握りつぶすための汎用コード
 * 
 * 対応するエラー:
 * - Unchecked runtime.lastError: The message port closed before a response was received.
 * - Uncaught (in promise) Error: A listener indicated an asynchronous response...
 */

(function() {
    'use strict';

    // =================================================================
    // 対策1: chrome.runtime API のエラーを抑制
    // =================================================================
    // Chrome拡張機能が存在する場合、そのメッセージングエラーを抑制
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        const originalSendMessage = chrome.runtime.sendMessage;
        chrome.runtime.sendMessage = function(...args) {
            try {
                // コールバックが提供されていない場合は空のコールバックを追加
                if (typeof args[args.length - 1] !== 'function') {
                    args.push(function(response) {
                        // lastErrorを確認して無視
                        if (chrome.runtime.lastError) {
                            // エラーを握りつぶす（何もしない）
                            void chrome.runtime.lastError;
                        }
                    });
                } else {
                    // 既存のコールバックをラップ
                    const originalCallback = args[args.length - 1];
                    args[args.length - 1] = function(response) {
                        if (chrome.runtime.lastError) {
                            // エラーを握りつぶす
                            void chrome.runtime.lastError;
                            return;
                        }
                        originalCallback(response);
                    };
                }
                return originalSendMessage.apply(this, args);
            } catch (e) {
                // sendMessage自体が失敗した場合も握りつぶす
                return undefined;
            }
        };
    }

    // =================================================================
    // 対策2: グローバルなエラーハンドラーで特定のエラーを抑制
    // =================================================================
    const originalErrorHandler = window.onerror;
    window.onerror = function(message, source, lineno, colno, error) {
        // 拡張機能関連のエラーメッセージパターン
        const suppressPatterns = [
            /message port closed before a response was received/i,
            /listener indicated an asynchronous response/i,
            /message channel closed/i,
            /Extension context invalidated/i,
            /chrome\.runtime/i
        ];

        // メッセージが抑制パターンに一致する場合は握りつぶす
        if (typeof message === 'string') {
            for (let pattern of suppressPatterns) {
                if (pattern.test(message)) {
                    return true; // エラーを握りつぶす
                }
            }
        }

        // その他のエラーは元のハンドラーに渡す
        if (originalErrorHandler) {
            return originalErrorHandler.apply(this, arguments);
        }
        return false;
    };

    // =================================================================
    // 対策3: unhandledrejection イベントで Promise エラーを抑制
    // =================================================================
    const originalRejectionHandler = window.onunhandledrejection;
    window.addEventListener('unhandledrejection', function(event) {
        const reason = event.reason;
        
        // 拡張機能関連のエラーパターン
        const suppressPatterns = [
            /message port closed before a response was received/i,
            /listener indicated an asynchronous response/i,
            /message channel closed/i,
            /Extension context invalidated/i,
            /chrome\.runtime/i
        ];

        // エラーメッセージをチェック
        let shouldSuppress = false;
        if (reason) {
            const errorMessage = reason.message || reason.toString();
            for (let pattern of suppressPatterns) {
                if (pattern.test(errorMessage)) {
                    shouldSuppress = true;
                    break;
                }
            }
        }

        if (shouldSuppress) {
            event.preventDefault(); // エラーを握りつぶす
            event.stopPropagation();
            return;
        }

        // その他のエラーは元のハンドラーに渡す
        if (originalRejectionHandler) {
            originalRejectionHandler.call(this, event);
        }
    }, true);

    // =================================================================
    // 対策4: コンソールエラーメッセージをフィルタリング（開発環境用）
    // =================================================================
    // 注意: この対策は開発時のみ使用することを推奨
    // 本番環境では重要なエラーも隠れる可能性があるため慎重に使用
    if (typeof console !== 'undefined' && console.error) {
        const originalConsoleError = console.error;
        console.error = function(...args) {
            // 引数を文字列に変換してチェック
            const message = args.join(' ');
            
            const suppressPatterns = [
                /message port closed before a response was received/i,
                /listener indicated an asynchronous response/i,
                /message channel closed/i,
                /Extension context invalidated/i
            ];

            // 抑制パターンに一致する場合は握りつぶす
            for (let pattern of suppressPatterns) {
                if (pattern.test(message)) {
                    return; // コンソール出力を抑制
                }
            }

            // その他のエラーは通常通り出力
            originalConsoleError.apply(console, args);
        };
    }

    // =================================================================
    // 対策5: postMessage関連のエラーを抑制
    // =================================================================
    // 拡張機能がpostMessageを使用している場合の対策
    if (window.postMessage) {
        const originalPostMessage = window.postMessage;
        window.postMessage = function(...args) {
            try {
                return originalPostMessage.apply(this, args);
            } catch (e) {
                // postMessageのエラーを握りつぶす
                if (e.message && /message port closed|message channel closed/i.test(e.message)) {
                    return;
                }
                throw e; // その他のエラーは再スロー
            }
        };
    }

    // =================================================================
    // 初期化完了ログ（オプション）
    // =================================================================
    // デバッグ用: エラー抑制スクリプトが正常に読み込まれたことを確認
    // console.log('✓ Error suppressor initialized - Extension errors will be suppressed');

})();
