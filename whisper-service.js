/**
 * Whisper API Service（Vercel Serverless対応版）
 * OpenAI Whisper APIを使った音声文字起こしサービス
 */

class WhisperService {
    constructor() {
        // Vercel Serverless Function経由でAPIを呼び出す
        this.apiEndpoint = '/api/whisper';
        this.configEndpoint = '/api/config';
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        this._isConfigured = null;

        // 初期化時に設定を確認
        this.checkConfiguration();
    }

    /**
     * サーバー側の設定を確認
     */
    async checkConfiguration() {
        try {
            const response = await fetch(this.configEndpoint);
            const data = await response.json();
            this._isConfigured = data.openai === true;
            console.log('🔍 Whisper API設定状況:', data);
            return this._isConfigured;
        } catch (error) {
            console.warn('Whisper設定確認に失敗:', error.message);
            return false;
        }
    }

    /**
     * APIキーが設定されているか確認（サーバー側で管理）
     */
    isConfigured() {
        if (this._isConfigured !== null) {
            return this._isConfigured;
        }
        return true; // 初回はtrueとして扱う
    }

    // 互換性のため残すが、実質的には何もしない
    setApiKey(key) {
        console.log('APIキーはVercel環境変数で管理されます');
    }

    getApiKey() {
        return '***server-managed***';
    }

    /**
     * 録音を開始
     */
    async startRecording() {
        if (this.isRecording) {
            return;
        }

        try {
            // マイクへのアクセスを要求
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            // MediaRecorderを作成
            const mimeType = this.getSupportedMimeType();
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: mimeType,
                audioBitsPerSecond: 128000
            });

            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start(100); // 100msごとにデータを収集
            this.isRecording = true;

            console.log('Recording started with mime type:', mimeType);
            return true;

        } catch (error) {
            console.error('Failed to start recording:', error);
            throw error;
        }
    }

    /**
     * サポートされているMIMEタイプを取得
     */
    getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/wav'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return 'audio/webm'; // デフォルト
    }

    /**
     * 録音を停止して音声データを返す
     */
    async stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) {
            return null;
        }

        return new Promise((resolve) => {
            this.mediaRecorder.onstop = async () => {
                const mimeType = this.mediaRecorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(this.audioChunks, { type: mimeType });

                // ストリームを停止
                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                    this.stream = null;
                }

                this.isRecording = false;
                this.audioChunks = [];

                console.log('Recording stopped, blob size:', audioBlob.size);
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
        });
    }

    /**
     * 録音をキャンセル
     */
    cancelRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
        }

        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        this.isRecording = false;
        this.audioChunks = [];
    }

    /**
     * Whisper APIで文字起こし（サーバーレス関数経由）
     */
    async transcribe(audioBlob) {
        // 音声が短すぎる場合は警告（10KB未満は約0.5秒以下）
        if (audioBlob.size < 10000) {
            console.warn('Audio too short, may cause hallucination');
        }

        // 音声ファイルを準備
        const formData = new FormData();

        // ファイル拡張子を決定
        const ext = this.getExtensionFromMimeType(audioBlob.type);
        formData.append('file', audioBlob, `audio.${ext}`);
        formData.append('model', 'whisper-1');
        formData.append('language', 'ja');
        formData.append('response_format', 'verbose_json');
        formData.append('prompt', 'これはVALORANTというゲームについての質問や会話です。エイム、キルデス比、ランク、エージェント、マップなどについて話しています。');
        formData.append('temperature', '0');

        console.log('Sending to Whisper API via server, file type:', audioBlob.type, 'size:', audioBlob.size);

        try {
            // サーバーレス関数経由でリクエスト
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Whisper API error:', errorData);
                if (errorData.error?.includes('OPENAI_API_KEY')) {
                    throw new Error('Vercel環境変数にOPENAI_API_KEYを設定してください');
                }
                throw new Error(errorData.error || `API error: ${response.status}`);
            }

            const result = await response.json();
            console.log('Whisper API result:', result);

            // verbose_jsonの場合、no_speech_probをチェック
            // 無音確率が高い場合はハルシネーションの可能性が高い
            if (result.segments && result.segments.length > 0) {
                const avgNoSpeechProb = result.segments.reduce((sum, s) => sum + (s.no_speech_prob || 0), 0) / result.segments.length;
                console.log('Average no_speech_prob:', avgNoSpeechProb);

                // 無音確率が50%以上の場合は空を返す
                if (avgNoSpeechProb > 0.5) {
                    console.warn('High no_speech probability, likely hallucination');
                    return '';
                }

                // 既知のハルシネーションフレーズをフィルタリング
                const hallucinations = [
                    'ご視聴ありがとうございました',
                    'ありがとうございました',
                    'チャンネル登録',
                    'いいねボタン',
                    '字幕',
                    'ご覧いただき'
                ];

                const text = result.text || '';
                for (const phrase of hallucinations) {
                    if (text.includes(phrase) && avgNoSpeechProb > 0.3) {
                        console.warn('Detected likely hallucination phrase:', text);
                        return '';
                    }
                }
            }

            return result.text || '';

        } catch (error) {
            console.error('Transcription failed:', error);
            throw error;
        }
    }

    /**
     * MIMEタイプから拡張子を取得
     */
    getExtensionFromMimeType(mimeType) {
        const map = {
            'audio/webm': 'webm',
            'audio/webm;codecs=opus': 'webm',
            'audio/ogg': 'ogg',
            'audio/ogg;codecs=opus': 'ogg',
            'audio/mp4': 'm4a',
            'audio/mpeg': 'mp3',
            'audio/wav': 'wav',
            'audio/x-wav': 'wav'
        };

        return map[mimeType] || 'webm';
    }
}

/**
 * 吃音（どもり）を検知してスムーズなテキストに修正
 * ユーザーには修正後のテキストのみを表示し、安心感を与える
 */
function correctStuttering(text) {
    if (!text) return text;

    // 吃音パターン1: 同じひらがな/カタカナが2回以上連続（例: ぼぼぼぼ → ぼ）
    // ひらがな
    let corrected = text.replace(/([ぁ-ん])\1{1,}/g, '$1');
    // カタカナ
    corrected = corrected.replace(/([ァ-ヶ])\1{1,}/g, '$1');

    // 吃音パターン2: 同じ音の繰り返しパターン（例: ぼ、ぼ、ぼく → ぼく）
    // 読点やスペースを挟んだ繰り返しも検知
    corrected = corrected.replace(/([ぁ-んァ-ヶ])[、,\s]*\1[、,\s]*\1+/g, '$1');

    // 吃音パターン3: 2文字セットの繰り返し（例: おに、おに、おにぎり → おにぎり）
    corrected = corrected.replace(/([ぁ-んァ-ヶ]{1,2})[、,\s]+\1[、,\s]+/g, '$1');

    // 吃音パターン4: 語頭の繰り返し（例: 「ぼ、僕は」→「僕は」）
    corrected = corrected.replace(/([ぁ-んァ-ヶ])[、,\s]+([一-龯々])/g, (match, kana, kanji) => {
        // ひらがなが漢字の読みの一部である可能性が高い場合は削除
        return kanji;
    });

    // 吃音パターン5: 長音の過剰な伸ばし（例: あーーー → あー）
    corrected = corrected.replace(/ー{2,}/g, 'ー');

    // 吃音パターン6: 「っ」の連続（例: えっっっと → えっと）
    corrected = corrected.replace(/っ{2,}/g, 'っ');

    // 吃音パターン7: フィラー語の繰り返し（例: えー、えー → えー）
    corrected = corrected.replace(/(えー|あー|うー|あの|えっと)[、,\s]*(えー|あー|うー|あの|えっと)[、,\s]*/gi, '$1、');

    // 先頭・末尾の余分な句読点を整理
    corrected = corrected.replace(/^[、,\s]+/, '').replace(/[、,\s]+$/, '');

    // 連続した読点を1つに
    corrected = corrected.replace(/、{2,}/g, '、');

    // 修正があった場合のみログ（デバッグ用、本番では非表示）
    if (text !== corrected) {
        console.log('[吃音修正] 適用済み');
    }

    return corrected;
}

// グローバルインスタンス
const whisperService = new WhisperService();

/**
 * Whisperを使った音声入力UIを初期化
 */
function initWhisperVoiceUI() {
    const chatFooter = document.querySelector('.chat-popup-footer .chat-input-wrapper');
    if (!chatFooter) {
        setTimeout(initWhisperVoiceUI, 500);
        return;
    }

    // 既存の音声ボタンを置き換え
    let voiceBtnsContainer = document.querySelector('.voice-buttons');
    if (!voiceBtnsContainer) {
        voiceBtnsContainer = document.createElement('div');
        voiceBtnsContainer.className = 'voice-buttons';
        const inputField = chatFooter.querySelector('input');
        if (inputField) {
            chatFooter.insertBefore(voiceBtnsContainer, inputField);
        }
    } else {
        voiceBtnsContainer.innerHTML = '';
    }

    // 音声入力ボタン（Whisper）
    const micBtn = document.createElement('button');
    micBtn.id = 'voice-input-btn';
    micBtn.className = 'voice-btn mic-btn';
    micBtn.title = '音声で入力 (Whisper)';
    micBtn.type = 'button';
    micBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
    `;

    let isRecording = false;

    micBtn.onclick = async () => {
        if (!whisperService.isConfigured()) {
            updateWhisperStatus('エラー: OpenAI APIキーが設定されていません。設定画面で設定してください。');
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('OpenAI APIキーを設定してください', 'error');
            }
            return;
        }

        if (!isRecording) {
            // 録音開始
            try {
                await whisperService.startRecording();
                isRecording = true;
                micBtn.classList.add('listening');
                micBtn.title = 'クリックで停止';
                updateWhisperStatus('録音中... 話し終わったらもう一度クリック');
            } catch (error) {
                updateWhisperStatus(`エラー: ${error.message}`);
                if (error.name === 'NotAllowedError') {
                    updateWhisperStatus('エラー: マイクへのアクセスが許可されていません');
                }
            }
        } else {
            // 録音停止＆文字起こし
            try {
                micBtn.classList.remove('listening');
                micBtn.classList.add('processing');
                updateWhisperStatus('文字起こし処理中...');

                const audioBlob = await whisperService.stopRecording();
                isRecording = false;

                if (audioBlob && audioBlob.size > 0) {
                    const rawText = await whisperService.transcribe(audioBlob);

                    if (rawText) {
                        // 吃音修正を適用（ユーザーには修正後のみ表示）
                        const text = correctStuttering(rawText);
                        updateWhisperStatus(`認識結果: "${text}"`);

                        // 入力欄に修正後のテキストを設定
                        const input = document.getElementById('floating-chat-input');
                        if (input) {
                            input.value = text;
                        }

                        // 1秒後に自動送信
                        setTimeout(() => {
                            const sendBtn = document.getElementById('floating-chat-send');
                            if (sendBtn) {
                                sendBtn.click();
                            }
                            updateWhisperStatus('');
                        }, 1000);
                    } else {
                        updateWhisperStatus('音声を認識できませんでした');
                    }
                } else {
                    updateWhisperStatus('音声が録音されませんでした');
                }
            } catch (error) {
                updateWhisperStatus(`エラー: ${error.message}`);
            } finally {
                micBtn.classList.remove('processing');
                micBtn.title = '音声で入力 (Whisper)';
            }
        }
    };

    voiceBtnsContainer.appendChild(micBtn);

    // 音声出力トグルボタン（既存のTTS）
    const speakerBtn = document.createElement('button');
    speakerBtn.id = 'voice-output-btn';
    speakerBtn.className = 'voice-btn speaker-btn';
    speakerBtn.title = '音声読み上げON';
    speakerBtn.type = 'button';
    speakerBtn.dataset.enabled = 'true';
    speakerBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
        </svg>
    `;
    speakerBtn.onclick = () => {
        const isEnabled = speakerBtn.dataset.enabled === 'true';
        speakerBtn.dataset.enabled = (!isEnabled).toString();
        speakerBtn.classList.toggle('disabled', isEnabled);
        speakerBtn.title = isEnabled ? '音声読み上げOFF' : '音声読み上げON';

        if (isEnabled && voiceChatService && voiceChatService.isSpeaking) {
            voiceChatService.stopSpeaking();
        }
    };

    voiceBtnsContainer.appendChild(speakerBtn);

    console.log('Whisper voice UI initialized');
}

/**
 * Whisperステータス表示を更新
 */
function updateWhisperStatus(message) {
    let statusEl = document.getElementById('voice-status-display');

    if (!statusEl) {
        const chatPopup = document.querySelector('.floating-chat-popup');
        if (chatPopup) {
            statusEl = document.createElement('div');
            statusEl.id = 'voice-status-display';
            statusEl.className = 'voice-status-display';
            const footer = chatPopup.querySelector('.chat-popup-footer');
            if (footer) {
                footer.insertBefore(statusEl, footer.firstChild);
            }
        }
    }

    if (statusEl) {
        statusEl.textContent = message;
        statusEl.style.display = message ? 'block' : 'none';
    }
}

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initWhisperVoiceUI, 200);
});

// チャットボタンクリック時にも初期化
document.addEventListener('click', (e) => {
    if (e.target.closest('#floating-chat-btn')) {
        setTimeout(initWhisperVoiceUI, 200);
    }
});
