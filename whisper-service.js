/**
 * Whisper API Service
 * OpenAI Whisper APIを使った音声文字起こしサービス
 */

class WhisperService {
    constructor() {
        this.apiKey = localStorage.getItem('openai_api_key') || '';
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
    }

    /**
     * APIキーを設定
     */
    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('openai_api_key', key);
    }

    /**
     * APIキーを取得
     */
    getApiKey() {
        return this.apiKey;
    }

    /**
     * APIキーが設定されているか確認
     */
    isConfigured() {
        return this.apiKey && this.apiKey.length > 0;
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
     * Whisper APIで文字起こし
     */
    async transcribe(audioBlob) {
        if (!this.isConfigured()) {
            throw new Error('OpenAI APIキーが設定されていません');
        }

        // 音声ファイルを準備
        const formData = new FormData();

        // ファイル拡張子を決定
        const ext = this.getExtensionFromMimeType(audioBlob.type);
        formData.append('file', audioBlob, `audio.${ext}`);
        formData.append('model', 'whisper-1');
        formData.append('language', 'ja');
        formData.append('response_format', 'json');

        console.log('Sending to Whisper API, file type:', audioBlob.type, 'size:', audioBlob.size);

        try {
            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Whisper API error:', errorData);
                throw new Error(errorData.error?.message || `API error: ${response.status}`);
            }

            const result = await response.json();
            console.log('Whisper API result:', result);
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
                    const text = await whisperService.transcribe(audioBlob);

                    if (text) {
                        updateWhisperStatus(`認識結果: "${text}"`);

                        // 入力欄に設定
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
