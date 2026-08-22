/*
 * Kataomoi - 片思いチェッカー for X
 *
 * 「自分はフォローしている」かつ「相手からはフォローされていない」ユーザーに 💔 を付ける。
 *
 * 判定はすべて画面の DOM だけで完結させている（API キーも追加の権限も不要）:
 *   - 自分がフォローしている  … フォローボタンの data-testid が "<userId>-unfollow"
 *   - 相手がフォローしている  … 「フォローされています / Follows you」バッジの有無
 */
(() => {
  'use strict';

  const HEART_CLASS = 'kataomoi-heart';
  const HEART = '💔';
  const TOOLTIP = '片思い: あなたはフォローしていますが、フォローバックされていません';

  /**
   * 「フォローされています」バッジの文言。X の UI 言語ごとに変わるため主要ロケールを列挙する。
   * data-testid="userFollowIndicator" が付く場合はそちらを優先して見るので、
   * ここに無いロケールでもプロフィールページでは正しく判定できる。
   */
  const FOLLOWS_YOU_LABELS = new Set([
    'フォローされています',
    'あなたをフォローしています',
    'Follows you',
    'Follows You',
    'Te sigue',
    'Vous suit',
    'Folgt dir',
    'Ti segue',
    'Segue você',
    'Volgt jou',
    'Følger dig',
    'Følger deg',
    'Följer dig',
    'Seuraa sinua',
    'Obserwuje Cię',
    'Sleduje vás',
    'Sleduje ťa',
    'Követ téged',
    'Te urmărește',
    'Seni takip ediyor',
    'Подписан(а) на вас',
    'Подписана на вас',
    'Стежить за вами',
    'Ακολουθεί εσάς',
    'يتابعك',
    'עוקב אחריך',
    'आपको फ़ॉलो करता है',
    'ติดตามคุณอยู่',
    'Mengikuti Anda',
    'Mengikuti anda',
    'Theo dõi bạn',
    '회원님을 팔로우합니다',
    '팔로우함',
    '关注了你',
    '追蹤你',
    '追蹤中你'
  ]);

  let enabled = true;

  /* ------------------------------------------------------------------ 判定 */

  /** 自分がこのユーザーをフォローしているか */
  function youFollowThem(scope) {
    return !!scope.querySelector('button[data-testid$="-unfollow"]');
  }

  /** このユーザーが自分をフォローしているか */
  function theyFollowYou(scope) {
    if (scope.querySelector('[data-testid="userFollowIndicator"]')) return true;

    for (const span of scope.querySelectorAll('span')) {
      if (span.childElementCount) continue;
      const text = span.textContent.trim();
      if (!text || text.length > 24) continue;
      // 自己紹介文に同じ文字列が含まれていても誤判定しないように除外する
      if (FOLLOWS_YOU_LABELS.has(text) && !span.closest('[data-testid="UserDescription"]')) {
        return true;
      }
    }
    return false;
  }

  /* ------------------------------------------------------------------ 描画 */

  function addHeart(anchor) {
    if (!anchor || anchor.querySelector(':scope > .' + HEART_CLASS)) return;
    const heart = document.createElement('span');
    heart.className = HEART_CLASS;
    heart.textContent = HEART;
    heart.title = TOOLTIP;
    heart.setAttribute('aria-label', '片思い');
    heart.setAttribute('role', 'img');
    anchor.appendChild(heart);
  }

  function removeHeart(scope) {
    scope.querySelectorAll('.' + HEART_CLASS).forEach((el) => el.remove());
  }

  function update(scope, anchor) {
    if (!anchor) return;
    if (youFollowThem(scope) && !theyFollowYou(scope)) {
      addHeart(anchor);
    } else {
      // 仮想スクロールで DOM が使い回されることがあるので、条件を満たさなくなったら消す
      removeHeart(scope);
    }
  }

  /* -------------------------------------------------------- 対象要素の取得 */

  /** ユーザー一覧（フォロー中・フォロワー・検索結果など）の 1 行 */
  function cellAnchor(cell) {
    const name = cell.querySelector('[data-testid="User-Name"]');
    if (!name) return null;
    // 表示名の行に付けたいので、1 行目の要素を優先する
    return name.firstElementChild || name;
  }

  /** プロフィールページのヘッダー（表示名とフォローボタンを両方含む祖先要素） */
  function profileScope() {
    const name = document.querySelector('[data-testid="UserName"]');
    const button = document.querySelector('[data-testid="placementTracking"]');
    if (!name || !button) return null;

    let node = name;
    while (node && !node.contains(button)) node = node.parentElement;
    return node;
  }

  function profileAnchor() {
    const name = document.querySelector('[data-testid="UserName"]');
    if (!name) return null;
    return name.firstElementChild || name;
  }

  /* ------------------------------------------------------------ スキャン */

  function scan() {
    if (!enabled) return;

    for (const cell of document.querySelectorAll('[data-testid="UserCell"]')) {
      update(cell, cellAnchor(cell));
    }

    const profile = profileScope();
    if (profile) update(profile, profileAnchor());
  }

  function clearAll() {
    document.querySelectorAll('.' + HEART_CLASS).forEach((el) => el.remove());
  }

  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      scan();
    }, 120);
  }

  /* --------------------------------------------------------------- 起動 */

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    // フォローボタンを押した直後は data-testid だけが差し替わることがある
    attributes: true,
    attributeFilter: ['data-testid']
  });

  chrome.storage.sync.get({ enabled: true }, (settings) => {
    enabled = settings.enabled;
    scan();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.enabled) return;
    enabled = changes.enabled.newValue;
    if (enabled) scan();
    else clearAll();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'kataomoi:stats') return;
    sendResponse({
      enabled,
      count: document.querySelectorAll('.' + HEART_CLASS).length
    });
  });
})();
