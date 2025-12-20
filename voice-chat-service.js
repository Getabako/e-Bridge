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
        this.voicePitch = 1.1;
        this.voiceVolume = 1.0;
        this.restartTimeout = null;

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
        this.recognition.continuous = false;  // シンプルに1回ずつ
        this.recognition.interimResults = true;
        this.recognition.maxAlternatives = 1;

        this.recognition.onstart = () => {
            console.log('Voice recognition started');
            this.updateMicButtonState(true);
            this.updateStatusDisplay('音声認識開始... 話しかけてください');
        };

        this.recognition.onaudiostart = () => {
            console.log('Audio capture started');
            this.updateStatusDisplay('マイク入力中...');
        };

        this.recognition.onsoundstart = () => {
            console.log('Sound detected');
            this.updateStatusDisplay('音声を検出中...');
        };

        this.recognition.onspeechstart = () => {
            console.log('Speech detected');
            this.updateStatusDisplay('話している内容を認識中...');
        };

        this.recognition.onspeechend = () => {
            console.log('Speech ended');
            this.updateStatusDisplay('認識処理中...');
        };

        this.recognition.onend = () => {
            console.log('Voice recognition ended');
            // リスニング状態なら再開（no-speechでendが呼ばれた場合）
            if (this.isListening) {
                this.updateStatusDisplay('再開準備中...');
                this.scheduleRestart();
            } else {
                this.updateMicButtonState(false);
                this.updateStatusDisplay('');
            }
        };

        this.recognition.onresult = (event) => {
            const results = event.results;
            const lastResult = results[results.length - 1];
            const confidence = lastResult[0].confidence;

            if (lastResult.isFinal) {
                const transcript = lastResult[0].transcript.trim();
                console.log('Final result:', transcript, 'confidence:', confidence);
                this.updateStatusDisplay(`確定: "${transcript}" (信頼度: ${Math.round(confidence * 100)}%)`);
                if (transcript) {
                    // 停止してから送信
                    this.stopListening();
                    this.onSpeechResult(transcript);
                }
            } else {
                // 中間結果を表示
                const interimTranscript = lastResult[0].transcript;
                console.log('Interim result:', interimTranscript);
                this.updateStatusDisplay(`認識中: "${interimTranscript}"`);
                this.onInterimResult(interimTranscript);
            }
        };

        this.recognition.onerror = (event) => {
            console.log('Speech recognition event:', event.error);

            switch (event.error) {
                case 'no-speech':
                    // 音声が検出されなかった - リスニング中なら継続
                    this.updateStatusDisplay('音声が検出されませんでした。もう一度話してください...');
                    break;

                case 'not-allowed':
                case 'service-not-allowed':
                    this.stopListening();
                    this.updateStatusDisplay('エラー: マイクへのアクセスが許可されていません');
                    this.showToast('マイクへのアクセスが許可されていません', 'error');
                    break;

                case 'network':
                    this.stopListening();
                    this.updateStatusDisplay('エラー: ネットワーク接続に問題があります');
                    this.showToast('ネットワークエラー', 'error');
                    break;

                case 'audio-capture':
                    this.stopListening();
                    this.updateStatusDisplay('エラー: マイクが見つかりません');
                    this.showToast('マイクが見つかりません', 'error');
                    break;

                case 'aborted':
                    // ユーザーによる中止
                    this.updateStatusDisplay('音声認識を停止しました');
                    break;

                default:
                    console.warn('Speech recognition error:', event.error);
                    this.updateStatusDisplay(`エラー: ${event.error}`);
                    break;
            }
        };
    }

    /**
     * ステータス表示を更新
     */
    updateStatusDisplay(message) {
        let statusEl = document.getElementById('voice-status-display');

        if (!statusEl) {
            // ステータス表示要素を作成
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

    /**
     * 再起動をスケジュール（重複防止）
     */
    scheduleRestart() {
        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
        }

        this.restartTimeout = setTimeout(() => {
            if (this.isListening && this.recognition) {
                try {
                    this.recognition.start();
                } catch (e) {
                    // 既に開始されている場合は無視
                    console.log('Restart skipped');
                }
            }
        }, 300);
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

            console.log('Selected voice:', this.selectedVoice?.name);
        };

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

        // トグル動作
        if (this.isListening) {
            this.stopListening();
            return;
        }

        // 音声出力中なら停止
        if (this.isSpeaking) {
            this.stopSpeaking();
        }

        this.isListening = true;
        this.updateMicButtonState(true);

        try {
            this.recognition.start();
        } catch (error) {
            console.error('Failed to start:', error);
            this.isListening = false;
            this.updateMicButtonState(false);
        }
    }

    /**
     * 音声入力を停止
     */
    stopListening() {
        this.isListening = false;

        if (this.restartTimeout) {
            clearTimeout(this.restartTimeout);
            this.restartTimeout = null;
        }

        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {
                // 既に停止している場合は無視
            }
        }

        this.updateMicButtonState(false);
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
                micBtn.title = 'クリックで停止';
            } else {
                micBtn.classList.remove('listening');
                micBtn.title = '音声で入力';
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
     * 音声認識結果のコールバック
     */
    onSpeechResult(transcript) {
        console.log('Speech result:', transcript);
        const input = document.getElementById('floating-chat-input');
        if (input) {
            input.value = transcript;
            input.classList.remove('interim');
            // 送信
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
}

// グローバルインスタンス
const voiceChatService = new VoiceChatService();

/**
 * チャットUIに音声ボタンを追加
 */
function initVoiceChatUI() {
    const chatFooter = document.querySelector('.chat-popup-footer .chat-input-wrapper');
    if (!chatFooter) {
        setTimeout(initVoiceChatUI, 500);
        return;
    }

    if (document.getElementById('voice-input-btn')) {
        return;
    }

    // 音声入力ボタン
    const micBtn = document.createElement('button');
    micBtn.id = 'voice-input-btn';
    micBtn.className = 'voice-btn mic-btn';
    micBtn.title = '音声で入力';
    micBtn.type = 'button';
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

        if (isEnabled && voiceChatService.isSpeaking) {
            voiceChatService.stopSpeaking();
        }
    };

    // ボタンコンテナ
    const voiceBtnsContainer = document.createElement('div');
    voiceBtnsContainer.className = 'voice-buttons';
    voiceBtnsContainer.appendChild(micBtn);
    voiceBtnsContainer.appendChild(speakerBtn);

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
        // 絵文字や特殊文字を除去
        const cleanText = text
            .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
            .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
            .replace(/[\u{2600}-\u{26FF}]/gu, '')
            .replace(/[\u{2700}-\u{27BF}]/gu, '')
            .trim();

        if (cleanText) {
            voiceChatService.speak(cleanText);
        }
    }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initVoiceChatUI, 100);
});

document.addEventListener('click', (e) => {
    if (e.target.closest('#floating-chat-btn')) {
        setTimeout(initVoiceChatUI, 100);
    }
});
