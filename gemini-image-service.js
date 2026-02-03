/**
 * Gemini Image Generation Service
 * Gemini APIを使ってアイコン画像を生成するサービス
 */

class GeminiImageService {
    constructor() {
        // 画像生成は無効化（CORSエラー回避のため）
        // 将来的にはサーバーサイドAPI経由で実装する必要あり
        this.enabled = false;
        this.apiKey = null;
        this.flashModel = 'gemini-2.0-flash-exp-image-generation';
        this.proModel = 'imagen-3.0-generate-002';
        this.imageCache = new Map();
        this.loadCacheFromStorage();
    }

    /**
     * キャッシュをlocalStorageから読み込み
     */
    loadCacheFromStorage() {
        try {
            const cached = localStorage.getItem('gemini_image_cache');
            if (cached) {
                const data = JSON.parse(cached);
                Object.entries(data).forEach(([key, value]) => {
                    this.imageCache.set(key, value);
                });
            }
        } catch (e) {
            console.warn('Failed to load image cache:', e);
        }
    }

    /**
     * キャッシュをlocalStorageに保存
     */
    saveCacheToStorage() {
        try {
            const data = Object.fromEntries(this.imageCache);
            localStorage.setItem('gemini_image_cache', JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save image cache:', e);
        }
    }

    /**
     * 小さなアイコン画像を生成（無効化 - CORSエラー回避）
     * @param {string} prompt - 画像生成プロンプト
     * @param {string} cacheKey - キャッシュキー
     * @returns {Promise<string>} - null（無効化）
     */
    async generateSmallIcon(prompt, cacheKey) {
        // 画像生成は無効化（クライアントからの直接API呼び出しはCORSでブロックされる）
        // キャッシュがあれば返す
        if (this.imageCache.has(cacheKey)) {
            return this.imageCache.get(cacheKey);
        }
        return null;
    }

    /**
     * 大きな装飾画像を生成（無効化 - CORSエラー回避）
     * @param {string} prompt - 画像生成プロンプト
     * @param {string} cacheKey - キャッシュキー
     * @returns {Promise<string>} - null（無効化）
     */
    async generateLargeImage(prompt, cacheKey) {
        // 画像生成は無効化（クライアントからの直接API呼び出しはCORSでブロックされる）
        // キャッシュがあれば返す
        if (this.imageCache.has(cacheKey)) {
            return this.imageCache.get(cacheKey);
        }
        return null;
    }

    /**
     * レスポンスから画像データを抽出
     */
    extractImageFromResponse(result) {
        try {
            if (result.candidates && result.candidates[0]) {
                const parts = result.candidates[0].content?.parts || [];
                for (const part of parts) {
                    if (part.inlineData) {
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        const base64 = part.inlineData.data;
                        return `data:${mimeType};base64,${base64}`;
                    }
                }
            }
        } catch (e) {
            console.error('Failed to extract image:', e);
        }
        return null;
    }

    /**
     * SVGアイコンを生成（フォールバック用）
     */
    generateSVGIcon(type) {
        const icons = {
            dashboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
            target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
            clipboard: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>`,
            settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
            moon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
            sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
            user: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
            fire: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
            chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
            gamepad: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/></svg>`,
            search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
            edit: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
            check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
            refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
            save: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>`,
            robot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>`,
            book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
            lightbulb: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`,
            chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
            key: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>`,
            trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>`,
            plant: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/></svg>`,
            party: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/></svg>`,
            calendar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
            download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
            scroll: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/></svg>`,
            map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>`,
            plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
            x: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
            thumbsUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>`,
            smile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
            meh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
            eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
            eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
            alertTriangle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
            xCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
            checkCircle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
            file: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
            trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
            pause: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`,
            play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
            swords: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" y1="14" x2="9" y2="18"/><line x1="7" y1="17" x2="4" y2="20"/><line x1="3" y1="19" x2="5" y2="21"/></svg>`,
            mountain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`,
            building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/></svg>`,
            snowflake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg>`,
            bridge: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h20"/><path d="M6 20V10a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v10"/><path d="M2 10h4"/><path d="M18 10h4"/><circle cx="12" cy="10" r="2"/></svg>`
        };
        return icons[type] || icons.target;
    }
}

// グローバルインスタンス
const geminiImageService = new GeminiImageService();

/**
 * 絵文字をSVGアイコンに置き換える
 */
function replaceEmojiWithIcon(element, emojiType) {
    const svg = geminiImageService.generateSVGIcon(emojiType);
    const span = document.createElement('span');
    span.className = 'icon-svg';
    span.innerHTML = svg;
    span.style.display = 'inline-flex';
    span.style.alignItems = 'center';
    span.style.justifyContent = 'center';
    span.style.width = '1.2em';
    span.style.height = '1.2em';
    span.style.verticalAlign = 'middle';
    return span;
}

// 絵文字とアイコンタイプのマッピング
const emojiToIconMap = {
    '📊': 'dashboard',
    '🎯': 'target',
    '📋': 'clipboard',
    '⚙️': 'settings',
    '🌙': 'moon',
    '☀️': 'sun',
    '👤': 'user',
    '🔥': 'fire',
    '📈': 'chart',
    '📝': 'edit',
    '🎮': 'gamepad',
    '🔍': 'search',
    '✏️': 'edit',
    '✅': 'check',
    '🔄': 'refresh',
    '💾': 'save',
    '🤖': 'robot',
    '📚': 'book',
    '💡': 'lightbulb',
    '💬': 'chat',
    '🔑': 'key',
    '🏆': 'trophy',
    '🌱': 'plant',
    '🎉': 'party',
    '📅': 'calendar',
    '📥': 'download',
    '📜': 'scroll',
    '🗺️': 'map',
    '➕': 'plus',
    '✕': 'x',
    '👍': 'thumbsUp',
    '😊': 'smile',
    '😅': 'meh',
    '👁️': 'eye',
    '🙈': 'eyeOff',
    '⚠️': 'alertTriangle',
    '❌': 'xCircle',
    '🌐': 'globe',
    '📄': 'file',
    '🗑️': 'trash',
    '⏸️': 'pause',
    '▶️': 'play',
    '⚔️': 'swords',
    '🕳️': 'map',
    '🏔️': 'mountain',
    '🏛️': 'building',
    '🏙️': 'building',
    '❄️': 'snowflake',
    '🌉': 'bridge',
    '✕': 'x',
    '👁️‍🗨️': 'eye'
};

/**
 * ページ内の絵文字をSVGアイコンに置き換え
 */
function replaceAllEmojis() {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{1F000}-\u{1F02F}]/gu;

    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
        if (emojiRegex.test(node.textContent)) {
            textNodes.push(node);
        }
    }

    textNodes.forEach(textNode => {
        const text = textNode.textContent;
        const parent = textNode.parentNode;

        // 絵文字ごとに分割して処理
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        // 各絵文字を検出
        for (const [emoji, iconType] of Object.entries(emojiToIconMap)) {
            const index = text.indexOf(emoji);
            if (index !== -1) {
                // 絵文字の前のテキスト
                if (index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex, index)));
                }
                // SVGアイコンを追加
                fragment.appendChild(replaceEmojiWithIcon(null, iconType));
                lastIndex = index + emoji.length;
            }
        }

        // 残りのテキスト
        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        if (fragment.childNodes.length > 0) {
            parent.replaceChild(fragment, textNode);
        }
    });
}

// DOMContentLoaded時に実行
document.addEventListener('DOMContentLoaded', () => {
    // 少し遅延させて他のスクリプトが実行された後に絵文字を置き換え
    setTimeout(replaceAllEmojis, 500);
});

// MutationObserverで動的に追加された要素も監視
const emojiObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
            setTimeout(replaceAllEmojis, 100);
        }
    });
});

// 監視開始（DOMContentLoaded後）
document.addEventListener('DOMContentLoaded', () => {
    emojiObserver.observe(document.body, {
        childList: true,
        subtree: true
    });

    // 装飾画像を追加
    addDecorativeImages();
});

/**
 * ページに装飾画像を追加して見栄えを改善
 */
async function addDecorativeImages() {
    // ダッシュボードページのカード間に装飾を追加
    const dashboardPage = document.getElementById('dashboard');
    if (dashboardPage) {
        // 戦績ギャラリーの前にバナーを追加
        const galleryCard = dashboardPage.querySelector('.gallery-card');
        if (galleryCard && !galleryCard.previousElementSibling?.classList?.contains('decorative-banner')) {
            const banner = createDecorativeBanner(
                'Your Gaming Journey',
                'valorant-gaming-futuristic-neon'
            );
            galleryCard.parentNode.insertBefore(banner, galleryCard);
        }

        // コーチングカードの前にビジュアルブレイクを追加
        const coachingCard = document.getElementById('daily-coaching-card');
        if (coachingCard && !coachingCard.previousElementSibling?.classList?.contains('visual-break-card')) {
            const visualBreak = createVisualBreakCard(
                'Daily Coaching',
                'あなたの上達をサポートする今日のアドバイス',
                'coaching-training-esports'
            );
            coachingCard.parentNode.insertBefore(visualBreak, coachingCard);
        }

        // 目標セクションの前にディバイダーを追加
        const goalsSection = document.getElementById('dashboard-goals');
        if (goalsSection && !goalsSection.previousElementSibling?.classList?.contains('section-divider')) {
            const divider = createSectionDivider('target-crosshair-neon');
            goalsSection.parentNode.insertBefore(divider, goalsSection);
        }
    }

    // 目標ページにも装飾を追加
    const goalsPage = document.getElementById('goals');
    if (goalsPage) {
        const pageHeader = goalsPage.querySelector('.page-header');
        if (pageHeader && !pageHeader.nextElementSibling?.classList?.contains('decorative-banner')) {
            const banner = createDecorativeBanner(
                'Aim for the Top',
                'valorant-rank-progression-neon'
            );
            pageHeader.parentNode.insertBefore(banner, pageHeader.nextSibling);
        }
    }

    // コーチングプランページに装飾を追加
    const coachingPlansPage = document.getElementById('coaching-plans');
    if (coachingPlansPage) {
        const pageHeader = coachingPlansPage.querySelector('.page-header');
        if (pageHeader && !pageHeader.nextElementSibling?.classList?.contains('decorative-banner')) {
            const banner = createDecorativeBanner(
                'Your Training Path',
                'esports-training-plan-cyberpunk'
            );
            pageHeader.parentNode.insertBefore(banner, pageHeader.nextSibling);
        }
    }
}

/**
 * 装飾バナーを作成
 */
function createDecorativeBanner(text, imageKey) {
    const banner = document.createElement('div');
    banner.className = 'decorative-banner ai-image-loading';
    banner.innerHTML = `
        <div class="banner-text">${text}</div>
    `;

    // Imagen 3で画像を生成（大きな画像用）
    generateDecorativeImage(imageKey, 'large').then(imageUrl => {
        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = text;
            img.onload = () => {
                banner.classList.remove('ai-image-loading');
                banner.insertBefore(img, banner.firstChild);
            };
        } else {
            banner.classList.remove('ai-image-loading');
        }
    });

    return banner;
}

/**
 * ビジュアルブレイクカードを作成
 */
function createVisualBreakCard(title, description, imageKey) {
    const card = document.createElement('div');
    card.className = 'visual-break-card';
    card.innerHTML = `
        <div class="visual-image ai-image-loading"></div>
        <div class="visual-content">
            <h4>${title}</h4>
            <p>${description}</p>
        </div>
    `;

    // Flash用の小さな画像を生成
    const imageContainer = card.querySelector('.visual-image');
    generateDecorativeImage(imageKey, 'small').then(imageUrl => {
        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = title;
            img.onload = () => {
                imageContainer.classList.remove('ai-image-loading');
                imageContainer.appendChild(img);
            };
        } else {
            imageContainer.classList.remove('ai-image-loading');
            // フォールバック: グラデーション背景
            imageContainer.style.background = 'linear-gradient(135deg, var(--neon-cyan), var(--neon-purple))';
        }
    });

    return card;
}

/**
 * セクションディバイダーを作成
 */
function createSectionDivider(imageKey) {
    const divider = document.createElement('div');
    divider.className = 'section-divider';

    // 小さな画像を生成
    generateDecorativeImage(imageKey, 'small').then(imageUrl => {
        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = 'divider';
            divider.appendChild(img);
        }
    });

    return divider;
}

/**
 * 装飾画像を生成（キャッシュ付き）
 */
async function generateDecorativeImage(key, size) {
    const cacheKey = `decor_${key}_${size}`;

    // キャッシュをチェック
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        return cached;
    }

    // プロンプトマッピング
    const prompts = {
        'valorant-gaming-futuristic-neon': 'Futuristic VALORANT gaming scene with neon lights, cyberpunk cityscape, professional esports atmosphere',
        'valorant-rank-progression-neon': 'Abstract representation of gaming rank progression, glowing tiers, competitive achievement symbols',
        'esports-training-plan-cyberpunk': 'Esports training facility with holographic displays, gaming equipment, cyberpunk aesthetic',
        'coaching-training-esports': 'Professional gaming coach with holographic data, performance analytics visualization',
        'target-crosshair-neon': 'Minimalist neon crosshair target symbol, glowing cyan and pink'
    };

    const prompt = prompts[key] || key;

    try {
        let imageUrl;
        if (size === 'large') {
            imageUrl = await geminiImageService.generateLargeImage(prompt, cacheKey);
        } else {
            imageUrl = await geminiImageService.generateSmallIcon(prompt, cacheKey);
        }

        if (imageUrl) {
            // キャッシュに保存
            try {
                localStorage.setItem(cacheKey, imageUrl);
            } catch (e) {
                // ストレージ容量超過時は古いキャッシュをクリア
                console.warn('Storage full, clearing old cache');
            }
        }

        return imageUrl;
    } catch (error) {
        console.error('Failed to generate decorative image:', error);
        return null;
    }
}
