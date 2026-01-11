// strategy-guide-service.js - VALORANT攻略テキスト管理サービス
class StrategyGuideService {
    constructor() {
        this.STORAGE_KEY = 'valorant_strategy_guides';
        this.guides = this.loadGuides();

        // 初回起動時にデフォルト攻略を追加
        if (this.guides.length === 0) {
            this.initializeDefaultGuides();
        }
    }

    // 攻略ガイドを読み込み
    loadGuides() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.warn('StrategyGuideService: Failed to load guides:', error);
            return [];
        }
    }

    // 攻略ガイドを保存
    saveGuides() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.guides));
            console.log('StrategyGuideService: Guides saved successfully');
        } catch (error) {
            console.error('StrategyGuideService: Failed to save guides:', error);
        }
    }

    // 新しい攻略を追加
    addGuide(title, content, category = 'general') {
        const guide = {
            id: `guide_${Date.now()}`,
            title: title,
            content: content,
            category: category,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.guides.push(guide);
        this.saveGuides();

        console.log('StrategyGuideService: Guide added:', title);
        return guide;
    }

    // 攻略を更新
    updateGuide(id, updates) {
        const index = this.guides.findIndex(g => g.id === id);
        if (index !== -1) {
            this.guides[index] = {
                ...this.guides[index],
                ...updates,
                updatedAt: new Date().toISOString()
            };
            this.saveGuides();
            return this.guides[index];
        }
        return null;
    }

    // 攻略を削除
    deleteGuide(id) {
        const index = this.guides.findIndex(g => g.id === id);
        if (index !== -1) {
            const deleted = this.guides.splice(index, 1)[0];
            this.saveGuides();
            console.log('StrategyGuideService: Guide deleted:', deleted.title);
            return true;
        }
        return false;
    }

    // 全攻略を取得
    getAllGuides() {
        return this.guides;
    }

    // カテゴリ別に攻略を取得
    getGuidesByCategory(category) {
        return this.guides.filter(g => g.category === category);
    }

    // 攻略を検索
    searchGuides(keyword) {
        const lowerKeyword = keyword.toLowerCase();
        return this.guides.filter(g =>
            g.title.toLowerCase().includes(lowerKeyword) ||
            g.content.toLowerCase().includes(lowerKeyword)
        );
    }

    // AIコーチング用に攻略テキストを結合して取得
    getGuidesForCoaching(maxLength = 8000) {
        if (this.guides.length === 0) {
            return '';
        }

        let combinedText = '【VALORANT攻略知識ベース】\n\n';
        let currentLength = combinedText.length;

        for (const guide of this.guides) {
            const guideText = `## ${guide.title}\n${guide.content}\n\n`;

            if (currentLength + guideText.length > maxLength) {
                // 最大長を超える場合は省略
                combinedText += '...(以下省略)\n';
                break;
            }

            combinedText += guideText;
            currentLength += guideText.length;
        }

        return combinedText;
    }

    // 特定のトピックに関連する攻略を取得
    getRelevantGuides(topic, maxGuides = 3) {
        const keywords = this.extractKeywords(topic);
        const scoredGuides = this.guides.map(guide => {
            let score = 0;
            const guideText = (guide.title + ' ' + guide.content).toLowerCase();

            keywords.forEach(keyword => {
                if (guideText.includes(keyword.toLowerCase())) {
                    score += 1;
                }
            });

            return { guide, score };
        });

        // スコア順にソートして上位を返す
        return scoredGuides
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxGuides)
            .map(item => item.guide);
    }

    // キーワード抽出
    extractKeywords(text) {
        const valorantKeywords = [
            // エージェント名
            'ジェット', 'レイナ', 'セージ', 'ソーヴァ', 'ブリムストーン', 'フェニックス',
            'ヴァイパー', 'サイファー', 'レイズ', 'キルジョイ', 'スカイ', 'ヨル',
            'アストラ', 'KAY/O', 'チェンバー', 'ネオン', 'フェイド', 'ハーバー',
            'ゲッコー', 'デッドロック', 'クローヴ', 'ヴァイス',
            // 役割
            'デュエリスト', 'イニシエーター', 'コントローラー', 'センチネル',
            // マップ名
            'バインド', 'ヘイヴン', 'スプリット', 'アセント', 'アイスボックス',
            'ブリーズ', 'フラクチャー', 'パール', 'ロータス', 'サンセット',
            // 戦術用語
            'エイム', 'ピーク', 'プリエイム', 'クリアリング', 'スモーク',
            'フラッシュ', 'ウルト', 'アビリティ', 'エコ', 'フルバイ',
            'ラッシュ', 'リテイク', 'ローテート', 'アンカー', 'エントリー'
        ];

        const foundKeywords = [];
        const lowerText = text.toLowerCase();

        valorantKeywords.forEach(keyword => {
            if (lowerText.includes(keyword.toLowerCase())) {
                foundKeywords.push(keyword);
            }
        });

        return foundKeywords;
    }

    // デフォルト攻略を初期化
    initializeDefaultGuides() {
        const defaultGuide = {
            id: 'guide_default_001',
            title: 'VALORANT 完全攻略ガイド：勝利への全知識',
            content: `1. 基礎知識とマネーシステム
VALORANTは知識が勝敗を分けるゲームです。まずは基本を押さえましょう。
・勝利条件：13ラウンド先取で勝利。攻めはスパイク設置・爆破または敵の全滅、守りは解除または設置阻止・敵の全滅を目指します。
・マネーシステム：勝利チームは約3000、敗北チームは約1900クレジットを得ます。
  - エコラウンド：次ラウンドでフルバイ（武器・スキルを揃える）できるように節約する。
  - 武器選択：基本はバンダルまたはファントム。スモーク役は弾道が見えないファントムと相性が良く、遠距離重視ならバンダルが推奨されます。

2. 役割別・エージェント別攻略
各エージェントの「本質的な役割」を理解することが重要です。

【デュエリスト（先陣・切り開き）】
・ジェット：「キャリームーブ」が真骨頂。敵の多い場所へ積極的に行き、ブリンクで生存しながら勝負回数を増やします。
・フェニックス：ウルト（ランナバウト）の回転率を上げ、ノーリスクでエリア奪取やキルを狙います。
・レイナ：エイムが最重要。リーア（目）はミニマップを確認し、壁越しでも敵の視界に入る位置に出します。
・ヨル：TPとフラッシュを組み合わせたエントリーが強力。
・ネオン：スピードを活かしたローテートとエントリーが武器。

【イニシエーター（情報収集・起点作り）】
・ソーヴァ：ドローンとリコンボルトの使い分けが肝。
・KAY/O：敵のスキルを封じる「ディスラプター（妨害役）」。フラッシュは右クリックの「ポップフラッシュ」が非常に避けづらく強力。
・ブリーチ：壁越しのスタンやアフターショックで敵のポジションを潰します。
・フェイド：プラウラーでの角のクリアリングと、ホウント（目）による索敵を組み合わせます。
・ゲッコウ：アビリティを回収して再利用できる点が最大の特徴。

【コントローラー（射線管理）】
・オーメン：ワンウェイスモーク（自分だけ敵の足が見える）が極めて強力。
・ブリムストーン：スモークの持続時間が19秒と最長。
・ヴァイパー：アイスボックスやブリーズなどの広いマップで必須級。
・クローブ：「死んだ後もスモークを炊ける」唯一のエージェント。
・ハーバー：移動する壁（カスケード）や弾を通さない盾（コーヴ）を使います。

【センチネル（防衛・裏警戒）】
・サイファー：ワイヤーは敵との心理戦です。
・キルジョイ：タレットとアラームボットのセットアップでサイトを固めます。
・セージ：壁（バリアオーブ）は時間を稼ぐだけでなく、上に乗ってオフアングルを作る攻撃的な使い方も可能。
・チェンバー：オペレーター（SR）との相性が抜群。
・デッドロック：音に反応するセンサーや、敵を拘束するウルトが強力。

3. 戦術とセオリー

【攻めのセオリー】
・コンタクトラッシュ：バレるまで足音を立てず静かに進み、敵に遭遇した瞬間にスキルを合わせる戦術。
・スロープレイ：ゆっくりエリアを広げ、敵のスキルを消費させてから本命のサイトを決めます。
・設置後の意識：「オープン設置」にすることで、メイン側から解除を阻止しやすくなります。

【守りのセオリー】
・人数不利の時：「動き出して情報を取る」か勝負を仕掛け、人数をイーブンに戻す努力が必要。
・逆サイトに敵が来たら：単純に寄るだけでなく、自サイトを「前詰め（プッシュ）」してエリアを取り返す。
・ワンピック取ったら下がる：防衛で1人倒せば人数有利。さらに欲張って倒され、人数を戻されるのが最悪の展開。

4. 撃ち合いと技術のコツ
・切り返し打ち（トトンのリズム）：2発撃って動く、2発撃って動くというリズムで撃つことで、ヘッドショット率が大幅に向上。
・もっこりスモークの禁止：スモークを焚く際は、壁と直線になるようにします。
・2人での行動：1人で勝負せず、常に味方のカバーが入る距離を保つ。

【マップ別ワンポイント】
・アセント：ミッドのコントロールが最重要。
・バインド：回収できるスキルがワープによるエリア移動と相性抜群。
・パール：メイン舞台とミッド（アート）舞台の2方向に分かれて挟む攻めが基本。
・ブリーズ/アイスボックス：広大な視線を遮るためにヴァイパーがほぼ必須。

【まとめ】
VALORANTでの戦いは、「じゃんけん」と「陣取り合戦」を同時に行うようなもの。後出しでスキルを返せば（じゃんけんの原理）有利になり、スキルを使ってより広いエリアを保持すれば（陣取りの原理）、敵の動ける範囲を狭めて勝利へと近づくことができます。`,
            category: 'comprehensive',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isDefault: true
        };

        this.guides.push(defaultGuide);
        this.saveGuides();
        console.log('StrategyGuideService: Default guides initialized');
    }

    // 全攻略をリセット（デフォルトに戻す）
    resetToDefault() {
        this.guides = [];
        this.initializeDefaultGuides();
        console.log('StrategyGuideService: Reset to default guides');
    }

    // 攻略の統計情報を取得
    getStats() {
        return {
            totalGuides: this.guides.length,
            categories: [...new Set(this.guides.map(g => g.category))],
            totalCharacters: this.guides.reduce((sum, g) => sum + g.content.length, 0),
            lastUpdated: this.guides.length > 0
                ? Math.max(...this.guides.map(g => new Date(g.updatedAt).getTime()))
                : null
        };
    }
}

// グローバルインスタンス
window.strategyGuideService = new StrategyGuideService();
