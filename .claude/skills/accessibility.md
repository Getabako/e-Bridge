# アクセシビリティガイド

## 対象ユーザーの特性

### 吃音のあるユーザー
- 音声入力への不安
- 電話でのやり取りを避けたい
- テキストベースのコミュニケーションを好む

**配慮事項:**
- 電話以外の連絡手段を用意
- チャット・フォームでの問い合わせ
- 時間制限のあるUIを避ける

### 不登校経験のあるユーザー
- 学校的なUIへの抵抗感
- 評価・採点への敏感さ
- プレッシャーへの弱さ

**配慮事項:**
- 学校っぽいUIを避ける
- 点数化・ランキングを控える
- 「正解」「不正解」表現を避ける
- 自分のペースで進められる設計

### 発達特性（ADHD）のあるユーザー
- 集中の持続が難しい
- 衝動性がある
- ワーキングメモリの制限

**配慮事項:**
- 短いセクションに分割
- 進捗の可視化
- 取り消し・やり直しを簡単に
- 自動保存機能
- 派手な装飾を避ける

### 発達特性（ASD）のあるユーザー
- 予測可能性を好む
- 変化への適応が難しい
- 感覚過敏（視覚・聴覚）

**配慮事項:**
- 一貫したレイアウト
- 明確な構造
- 変更時の事前通知
- 明滅するアニメーションを避ける
- 音の自動再生を避ける

### 感覚過敏への配慮
- 強いコントラストを避ける
- 明滅・点滅するアニメーションを禁止
- 背景動画の自動再生禁止
- 音の自動再生禁止
- 白背景は真っ白(#FFFFFF)より少し落ち着いた色(#FAFAFA)

## 技術的要件

### HTMLセマンティクス
```html
<!-- 良い例 -->
<header>
  <nav aria-label="メインナビゲーション">
    <ul>
      <li><a href="/">ホーム</a></li>
    </ul>
  </nav>
</header>

<main>
  <article>
    <h1>ページタイトル</h1>
    <section aria-labelledby="section-heading">
      <h2 id="section-heading">セクション</h2>
    </section>
  </article>
</main>

<footer>
  <nav aria-label="フッターナビゲーション">
  </nav>
</footer>
```

### キーボード操作
```css
/* フォーカス表示 - 必ず視認できるように */
:focus {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
}

/* アウトラインを消す場合は代替手段を */
:focus:not(:focus-visible) {
  outline: none;
}

:focus-visible {
  outline: 3px solid var(--primary);
  outline-offset: 2px;
}
```

### スキップリンク
```html
<body>
  <a href="#main-content" class="skip-link">
    メインコンテンツへスキップ
  </a>

  <header>...</header>

  <main id="main-content" tabindex="-1">
    ...
  </main>
</body>
```

```css
.skip-link {
  position: absolute;
  top: -40px;
  left: 0;
  background: var(--primary);
  color: white;
  padding: 8px 16px;
  z-index: 1000;
  transition: top 0.3s;
}

.skip-link:focus {
  top: 0;
}
```

### 画像
```html
<!-- 意味のある画像 -->
<img src="child-studying.jpg"
     alt="教室で笑顔で勉強する小学生の女の子">

<!-- 装飾的な画像 -->
<img src="decoration.png" alt="" role="presentation">
```

### フォーム
```html
<form>
  <div class="form-group">
    <label for="name">
      お名前 <span class="required" aria-label="必須">*</span>
    </label>
    <input
      type="text"
      id="name"
      name="name"
      required
      aria-required="true"
      aria-describedby="name-hint"
    >
    <p id="name-hint" class="hint">
      保護者の方のお名前を入力してください
    </p>
  </div>

  <div class="form-group" role="group" aria-labelledby="contact-method">
    <p id="contact-method">ご希望の連絡方法</p>
    <label>
      <input type="radio" name="contact" value="email">
      メール
    </label>
    <label>
      <input type="radio" name="contact" value="chat">
      チャット
    </label>
  </div>
</form>
```

### エラーメッセージ
```html
<div class="form-group" aria-invalid="true">
  <label for="email">メールアドレス</label>
  <input
    type="email"
    id="email"
    aria-describedby="email-error"
    aria-invalid="true"
  >
  <p id="email-error" class="error" role="alert">
    メールアドレスの形式が正しくありません
  </p>
</div>
```

### ボタン
```html
<!-- リンクボタン -->
<a href="/contact" class="btn btn-primary">
  お問い合わせ
</a>

<!-- 送信ボタン -->
<button type="submit" class="btn btn-primary">
  送信する
</button>

<!-- アイコンボタン -->
<button
  type="button"
  aria-label="メニューを開く"
  class="btn-icon"
>
  <svg aria-hidden="true">...</svg>
</button>

<!-- 状態を持つボタン -->
<button
  type="button"
  aria-expanded="false"
  aria-controls="menu-content"
>
  メニュー
</button>
```

### モーダル
```html
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  aria-describedby="modal-desc"
>
  <h2 id="modal-title">確認</h2>
  <p id="modal-desc">この操作を続けますか？</p>
  <button type="button">はい</button>
  <button type="button">いいえ</button>
</div>
```

### ローディング状態
```html
<button
  type="submit"
  aria-busy="true"
  aria-live="polite"
>
  <span class="spinner" aria-hidden="true"></span>
  送信中...
</button>
```

## カラーコントラスト

### 最小コントラスト比
- 通常テキスト: 4.5:1 以上
- 大きなテキスト（18px以上/太字14px以上）: 3:1 以上
- 非テキスト要素（アイコン、ボーダー）: 3:1 以上

### ツール
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/)

## テスト方法

### 自動テスト
```javascript
// axe-core を使用
import axe from 'axe-core';

axe.run(document, (err, results) => {
  if (err) throw err;
  console.log(results.violations);
});
```

### 手動テスト
1. **キーボード操作**: Tabキーで全要素にアクセス可能か
2. **スクリーンリーダー**: VoiceOver/NVDAで読み上げ確認
3. **ズーム**: 200%まで拡大しても使えるか
4. **色反転**: 色反転モードで読めるか
5. **アニメーション停止**: `prefers-reduced-motion`対応

### prefers-reduced-motion
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```
