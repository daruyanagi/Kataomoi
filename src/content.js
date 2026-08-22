/*
 * Kataomoi - 片思いチェッカー for X
 *
 * 「自分はフォローしている」かつ「相手からはフォローされていない」ユーザーに 💔 を付ける。
 *
 * ユーザー一覧とプロフィールは画面の DOM だけで判定できる:
 *   - 自分がフォローしている  … フォローボタンの data-testid が "<userId>-unfollow"
 *   - 相手がフォローしている  … 「フォローされています / Follows you」バッジの有無
 *
 * タイムラインのツイートにはどちらの手がかりも無いので、interceptor.js が
 * X 自身の GraphQL レスポンスから拾ったフォロー関係を postMessage で受け取る。
 *
 * どちらの経路も追加のリクエストは投げず、API キーも要らない。
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

  /** "/screen_name" 形式のプロフィールリンクだけを拾うためのパターン */
  const PROFILE_PATH = /^\/[A-Za-z0-9_]{1,15}\/?$/;

  let enabled = true;

  /** interceptor.js から届いた screen_name（小文字）→ { following, followedBy } */
  const relations = new Map();

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
      // 自己紹介文を拾わないための保険。一覧の自己紹介には testid が付かないので
      // 長さでも弾いておく（バッジの文言はどの言語でも 24 文字に収まる）
      if (!text || text.length > 24) continue;
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

  /**
   * 表示名と同じ行に並ぶ要素を返す。
   *
   * 表示名を包む要素は flex-direction: column なことが多く、そこへ足すと 💔 が
   * 次の行に落ちてしまう。表示名の span の親（横並びの行）まで降りてから付ける。
   */
  function inlineAnchor(nameRoot) {
    if (!nameRoot) return null;
    const displayName = nameRoot.querySelector('span');
    return (displayName && displayName.parentElement) || nameRoot;
  }

  /**
   * ユーザー一覧（フォロー中・フォロワー・検索結果など）の 1 行。
   *
   * UserCell の中に表示名を指す data-testid は無いので、プロフィールへのリンクから辿る。
   * 1 行の中には「アバター」「表示名」「@ID」の順で同じ href のリンクが並ぶため、
   * アバターを除いた最初のリンクが表示名のリンクになる。
   */
  function cellAnchor(cell) {
    const avatar = cell.querySelector('[data-testid^="UserAvatar-Container-"]');
    const nameLink = [...cell.querySelectorAll('a')].find((a) => {
      const href = a.getAttribute('href') || '';
      if (!PROFILE_PATH.test(href)) return false;
      return !(avatar && avatar.contains(a));
    });
    return inlineAnchor(nameLink);
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
    // UserName は表示名の行と @ID の行を両方含むので、表示名の行まで降りる
    return inlineAnchor(document.querySelector('[data-testid="UserName"]'));
  }

  /* -------------------------------------------------- タイムラインのツイート */

  /** ツイートの投稿者の screen_name（小文字） */
  function tweetHandle(nameRoot) {
    const link = [...nameRoot.querySelectorAll('a')].find((a) =>
      PROFILE_PATH.test(a.getAttribute('href') || '')
    );
    if (!link) return null;
    return link.getAttribute('href').replace(/^\/|\/$/g, '').toLowerCase();
  }

  function updateTweet(tweet) {
    // 引用ツイートにも User-Name はあるが、最初に見つかるのは常に本体の投稿者
    const nameRoot = tweet.querySelector('[data-testid="User-Name"]');
    if (!nameRoot) return;

    const handle = tweetHandle(nameRoot);
    const relation = handle && relations.get(handle);
    const anchor = inlineAnchor(nameRoot);
    if (!anchor) return;

    // 関係が分からない投稿者には何も付けない（判定できないので）
    if (relation && relation.following && !relation.followedBy) addHeart(anchor);
    else removeHeart(nameRoot);
  }

  /* ------------------------------------------------------------ スキャン */

  function scan() {
    if (!enabled) return;

    for (const cell of document.querySelectorAll('[data-testid="UserCell"]')) {
      update(cell, cellAnchor(cell));
    }

    for (const tweet of document.querySelectorAll('article[data-testid="tweet"]')) {
      updateTweet(tweet);
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

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.__kataomoi !== 1 || !data.users || typeof data.users !== 'object') return;

    let added = false;
    for (const [handle, relation] of Object.entries(data.users)) {
      if (!relation || typeof relation !== 'object') continue;
      relations.set(handle, { following: !!relation.following, followedBy: !!relation.followedBy });
      added = true;
    }
    if (added) scheduleScan();
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
