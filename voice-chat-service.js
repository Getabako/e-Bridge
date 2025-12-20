/**
 * Voice Chat Service
 * 音声入力（Speech Recognition）と音声出力（Text-to-Speech）を管理
 */

class VoiceChatService {
    constructor() {
        this.isListening = false;
        this.isSpeaking = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.selectedVoice = null;
        this.voiceRate = 1.0;
        this.voicePitch = 1.1; // 少し高めで女性らしく
        this.voiceVolume = 1.0;

        this.initSpeechRecognition();
        this.initVoices();
    }

    /**
     * 音声認識の初期化
     */
    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.warn('Speech Recognition API is not supported in this browser');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.lang = 'ja-JP';
        this.recognition.continuous = true;  // 継続的に聞き取る
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        // 音声検出の感度を上げる設定
        if (this.recognition.speechRecognitionOptions) {
            this.recognition.speechRecognitionOptions = {
                enableAutomaticPunctuation: true
            };
        }

        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateMicButtonState(true);
            console.log('Voice recognition started');
        };

        this.recognition.onend = () => {
            console.log('Voice recognition ended');
            // continuous modeでも終了することがあるので、リスニング中なら再開
            if (this.isListening) {
                setTimeout(() => {
                    if (this.isListening) {
                        try {
                            this.recognition.start();
                            console.log('Voice recognition restarted');
                        } catch (e) {
                            console.log('Recognition restart skipped:', e.message);
                        }
                    }
                }, 100);
            } else {
                this.updateMicButtonState(false);
            }
        };

        this.recognition.onresult = (event) => {
            const results = event.results;
            const lastResult = results[results.length - 1];

            if (lastResult.isFinal) {
                const transcript = lastResult[0].transcript.trim();
                if (transcript) {
                    // 音声入力完了 - リスニングを停止してから送信
                    this.isListening = false;
                    this.recognition.stop();
                    this.updateMicButtonState(false);
                    this.onSpeechResult(transcript);
                }
            } else {
                // 中間結果を表示
                const interimTranscript = lastResult[0].transcript;
                this.onInterimResult(interimTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);

            if (event.error === 'not-allowed') {
                this.isListening = false;
                this.updateMicButtonState(false);
                this.showToast('マイクへのアクセスが許可されていません。ブラウザの設定を確認してください。', 'error');
            } else if (event.error === 'no-speech') {
                // no-speechエラーの場合は自動で再開を試みる
                if (this.isListening) {
                    console.log('No speech detected, continuing to listen...');
                    // 少し待ってから再開
                    setTimeout(() => {
                        if (this.isListening) {
                            try {
                                this.recognition.start();
                            } catch (e) {
                                // 既に開始されている場合は無視
                            }
                        }
                    }, 100);
                }
            } else if (event.error === 'aborted') {
                // ユーザーによる中止
                this.isListening = false;
                this.updateMicButtonState(false);
            } else if (event.error === 'network') {
                this.isListening = false;
                this.updateMicButtonState(false);
                this.showToast('ネットワークエラー。インターネット接続を確認してください。', 'error');
            } else {
                this.isListening = false;
                this.updateMicButtonState(false);
                this.showToast(`音声認識エラー: ${event.error}`, 'warning');
            }
        };
    }

    /**
     * 音声合成のボイス初期化
     */
    initVoices() {
        const loadVoices = () => {
            const voices = this.synthesis.getVoices();

            // 日本語女性の声を優先的に選択
            const japaneseVoices = voices.filter(v => v.lang.includes('ja'));
            const femaleVoices = japaneseVoices.filter(v =>
                v.name.toLowerCase().includes('female') ||
                v.name.includes('女性') ||
                v.name.includes('Kyoko') ||
                v.name.includes('O-Ren') ||
                v.name.includes('Haruka') ||
                v.name.includes('Mizuki') ||
                v.name.includes('Nanami')
            );

            if (femaleVoices.length > 0) {
                this.selectedVoice = femaleVoices[0];
            } else if (japaneseVoices.length > 0) {
                this.selectedVoice = japaneseVoices[0];
            } else if (voices.length > 0) {
                this.selectedVoice = voices[0];
            }

            console.log('Available voices:', voices.map(v => `${v.name} (${v.lang})`));
            console.log('Selected voice:', this.selectedVoice?.name);
        };

        // Chrome等では非同期でvoicesが読み込まれる
        if (this.synthesis.getVoices().length > 0) {
            loadVoices();
        } else {
            this.synthesis.onvoiceschanged = loadVoices;
        }
    }

    /**
     * 音声入力を開始
     */
    startListening() {
        if (!this.recognition) {
            this.showToast('音声認識はこのブラウザでサポートされていません', 'error');
            return;
        }

        if (this.isListening) {
            this.stopListening();
            return;
        }

        // 音声出力中なら停止
        if (this.isSpeaking) {
            this.stopSpeaking();
        }

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Failed to start speech recognition:', error);
        }
    }

    /**
     * 音声入力を停止
     */
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    /**
     * テキストを音声で読み上げ
     */
    speak(text) {
        if (!this.synthesis) {
            console.warn('Speech Synthesis is not supported');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            // 既存の音声を停止
            this.synthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);

            if (this.selectedVoice) {
                utterance.voice = this.selectedVoice;
            }

            utterance.lang = 'ja-JP';
            utterance.rate = this.voiceRate;
            utterance.pitch = this.voicePitch;
            utterance.volume = this.voiceVolume;

            utterance.onstart = () => {
                this.isSpeaking = true;
                this.updateSpeakerState(true);
            };

            utterance.onend = () => {
                this.isSpeaking = false;
                this.updateSpeakerState(false);
                resolve();
            };

            utterance.onerror = (event) => {
                this.isSpeaking = false;
                this.updateSpeakerState(false);
                console.error('Speech synthesis error:', event);
                reject(event);
            };

            this.synthesis.speak(utterance);
        });
    }

    /**
     * 音声出力を停止
     */
    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
            this.isSpeaking = false;
            this.updateSpeakerState(false);
        }
    }

    /**
     * マイクボタンの状態を更新
     */
    updateMicButtonState(isActive) {
        const micBtn = document.getElementById('voice-input-btn');
        if (micBtn) {
            if (isActive) {
                micBtn.classList.add('listening');
                micBtn.title = '音声入力中... (クリックで停止)';
                micBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                `;
            } else {
                micBtn.classList.remove('listening');
                micBtn.title = '音声で入力';
                micBtn.innerHTML = `
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" y1="19" x2="12" y2="23"/>
                        <line x1="8" y1="23" x2="16" y2="23"/>
                    </svg>
                `;
            }
        }
    }

    /**
     * スピーカー状態を更新
     */
    updateSpeakerState(isSpeaking) {
        const speakerBtn = document.getElementById('voice-output-btn');
        if (speakerBtn) {
            if (isSpeaking) {
                speakerBtn.classList.add('speaking');
            } else {
                speakerBtn.classList.remove('speaking');
            }
        }
    }

    /**
     * 音声認識結果のコールバック（オーバーライド用）
     */
    onSpeechResult(transcript) {
        console.log('Speech result:', transcript);
        // チャット入力欄に設定
        const input = document.getElementById('floating-chat-input');
        if (input) {
            input.value = transcript;
            // 送信イベントをトリガー
            const sendBtn = document.getElementById('floating-chat-send');
            if (sendBtn) {
                sendBtn.click();
            }
        }
    }

    /**
     * 中間結果のコールバック
     */
    onInterimResult(transcript) {
        const input = document.getElementById('floating-chat-input');
        if (input) {
            input.value = transcript;
            input.classList.add('interim');
        }
    }

    /**
     * トースト表示
     */
    showToast(message, type = 'info') {
        if (typeof app !== 'undefined' && app.showToast) {
            app.showToast(message, type);
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    /**
     * 音声機能が利用可能か確認
     */
    isVoiceSupported() {
        return {
            recognition: !!(window.SpeechRecognition || window.webkitSpeechRecognition),
            synthesis: !!window.speechSynthesis
        };
    }
}

// グローバルインスタンス
const voiceChatService = new VoiceChatService();

/**
 * チャットUIに音声ボタンを追加
 */
function initVoiceChatUI() {
    // チャットポップアップのフッターを取得
    const chatFooter = document.querySelector('.chat-popup-footer .chat-input-wrapper');
    if (!chatFooter) {
        console.warn('Chat footer not found, retrying...');
        setTimeout(initVoiceChatUI, 500);
        return;
    }

    // 既に追加されている場合はスキップ
    if (document.getElementById('voice-input-btn')) {
        return;
    }

    // 音声入力ボタン
    const micBtn = document.createElement('button');
    micBtn.id = 'voice-input-btn';
    micBtn.className = 'voice-btn mic-btn';
    micBtn.title = '音声で入力';
    micBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
    `;
    micBtn.onclick = () => voiceChatService.startListening();

    // 音声出力トグルボタン
    const speakerBtn = document.createElement('button');
    speakerBtn.id = 'voice-output-btn';
    speakerBtn.className = 'voice-btn speaker-btn';
    speakerBtn.title = '音声読み上げON';
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

        if (isEnabled && voiceChatService.isSpeaking) {
            voiceChatService.stopSpeaking();
        }
    };

    // ボタンコンテナ
    const voiceBtnsContainer = document.createElement('div');
    voiceBtnsContainer.className = 'voice-buttons';
    voiceBtnsContainer.appendChild(micBtn);
    voiceBtnsContainer.appendChild(speakerBtn);

    // 入力欄の前に挿入
    const inputField = chatFooter.querySelector('input');
    if (inputField) {
        chatFooter.insertBefore(voiceBtnsContainer, inputField);
    }

    console.log('Voice chat UI initialized');
}

/**
 * AIの応答を音声で読み上げ
 */
function speakAIResponse(text) {
    const speakerBtn = document.getElementById('voice-output-btn');
    if (speakerBtn && speakerBtn.dataset.enabled === 'true') {
        // 絵文字や特殊文字を除去してから読み上げ
        const cleanText = text
            .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // 顔文字
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // その他の絵文字
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // 乗り物等
            .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // 国旗
            .replace(/[\u{2600}-\u{26FF}]/gu, '')   // その他の記号
            .replace(/[\u{2700}-\u{27BF}]/gu, '')   // 装飾記号
            .trim();

        if (cleanText) {
            voiceChatService.speak(cleanText);
        }
    }
}

// DOMContentLoaded時に初期化
document.addEventListener('DOMContentLoaded', () => {
    // 少し遅延させて他のスクリプトの読み込みを待つ
    setTimeout(initVoiceChatUI, 100);
});

// チャットボタンクリック時にも初期化を試みる
document.addEventListener('click', (e) => {
    if (e.target.closest('#floating-chat-btn')) {
        setTimeout(initVoiceChatUI, 100);
    }
});
