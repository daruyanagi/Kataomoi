/*
 * Kataomoi
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

  /** 印の共通クラス。種類ごとのクラスと大きさのクラスを足して使う */
  const MARK_CLASS = 'kataomoi-mark';
  const KATAOMOI_CLASS = 'kataomoi-heart';
  const MUTUAL_CLASS = 'kataomoi-mutual';

  const TOOLTIP = {
    kataomoi: '片思い: あなたはフォローしていますが、フォローバックされていません',
    mutual: '相互フォロー'
  };

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

  /** 画面に出ている "@screen_name" の表記 */
  const HANDLE_TEXT = /^@([A-Za-z0-9_]{1,15})$/;

  /** 設定。chrome.storage から読み込むまでは既定値で動かす */
  let settings = Object.assign({}, KATAOMOI_DEFAULTS);

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

  /**
   * scope の中の印を kind の状態に合わせる。
   *
   * kind は 'kataomoi' / 'mutual' / null（印なし）。仮想スクロールで DOM が
   * 使い回されたり設定が変わったりするので、毎回この関数で状態を合わせ直す。
   */
  function setMark(scope, anchor, kind) {
    const existing = scope.querySelector('.' + MARK_CLASS);

    if (!kind || !anchor) {
      if (existing) existing.remove();
      return;
    }

    const mutual = kind === 'mutual';
    const text = mutual ? settings.mutualIcon : settings.icon;
    if (!text) {
      if (existing) existing.remove();
      return;
    }

    // 中身が同じなら作り直さない（毎回の走査で DOM を触らないため）
    if (existing) {
      if (existing.dataset.kataomoiKind === kind && existing.textContent === text) return;
      existing.remove();
    }

    const mark = document.createElement('span');
    mark.className = [
      MARK_CLASS,
      mutual ? MUTUAL_CLASS : KATAOMOI_CLASS,
      MARK_CLASS + '--' + settings.iconSize
    ].join(' ');
    mark.dataset.kataomoiKind = kind;
    mark.textContent = text;
    mark.title = TOOLTIP[kind];
    mark.setAttribute('aria-label', mutual ? '相互フォロー' : '片思い');
    mark.setAttribute('role', 'img');
    anchor.appendChild(mark);
  }

  /**
   * フォローしている相手に付ける印の種類を返す。
   * 相互フォローの印は既定でオフなので、設定を見て null を返す。
   */
  function kindFor(followedBy) {
    if (!followedBy) return 'kataomoi';
    return settings.markMutual ? 'mutual' : null;
  }

  /** DOM から関係が読み取れる場所（ユーザー一覧・プロフィール）用 */
  function markFromDom(scope, anchor, visible) {
    if (!visible || !youFollowThem(scope)) {
      setMark(scope, anchor, null);
      return;
    }
    setMark(scope, anchor, kindFor(theyFollowYou(scope)));
  }

  /** relations から関係を引く場所（タイムライン）用 */
  function markFromRelation(scope, anchor, relation, visible) {
    if (!visible || !relation || !relation.following) {
      setMark(scope, anchor, null);
      return;
    }
    setMark(scope, anchor, kindFor(relation.followedBy));
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
    // 本体の投稿者名はプロフィールへのリンクになっている
    const link = [...nameRoot.querySelectorAll('a')].find((a) =>
      PROFILE_PATH.test(a.getAttribute('href') || '')
    );
    if (link) return link.getAttribute('href').replace(/^\/|\/$/g, '').toLowerCase();

    // 引用元は引用ブロック全体が 1 つのリンクになっていて、投稿者名は <a> ではない。
    // その場合は表示されている @ID から拾う
    for (const span of nameRoot.querySelectorAll('span')) {
      if (span.childElementCount) continue;
      const match = HANDLE_TEXT.exec(span.textContent.trim());
      if (match) return match[1].toLowerCase();
    }
    return null;
  }

  /** ツイート 1 件ぶんの投稿者名（本体・引用元それぞれに対して呼ぶ） */
  function updateTweetAuthor(nameRoot, visible) {
    const handle = tweetHandle(nameRoot);
    // 関係が分からない投稿者には何も付けない（判定できないので）
    markFromRelation(nameRoot, inlineAnchor(nameRoot), handle && relations.get(handle), visible);
  }

  /* ------------------------------------------------------------ スキャン */

  function scan() {
    // 設定でオフにした場所は、付いていた印を消したいので走査自体は続ける
    const on = settings.enabled;

    for (const cell of document.querySelectorAll('[data-testid="UserCell"]')) {
      markFromDom(cell, cellAnchor(cell), on && settings.showInLists);
    }

    for (const tweet of document.querySelectorAll('article[data-testid="tweet"]')) {
      // 1 つのツイートに本体と引用元の 2 つの投稿者名が入っていることがある
      const nameRoots = [...tweet.querySelectorAll('[data-testid="User-Name"]')];
      nameRoots.forEach((nameRoot, index) => {
        const quoted = index > 0;
        updateTweetAuthor(
          nameRoot,
          on && settings.showInTimeline && (!quoted || settings.showQuoted)
        );
      });
    }

    const profile = profileScope();
    if (profile) markFromDom(profile, profileAnchor(), on && settings.showInProfile);
  }

  function clearAll() {
    document.querySelectorAll('.' + MARK_CLASS).forEach((el) => el.remove());
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

  chrome.storage.sync.get(KATAOMOI_DEFAULTS, (stored) => {
    settings = Object.assign({}, KATAOMOI_DEFAULTS, stored);
    scan();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;

    let touched = false;
    for (const key of Object.keys(changes)) {
      if (!(key in KATAOMOI_DEFAULTS)) continue;
      settings[key] = changes[key].newValue;
      touched = true;
    }
    if (!touched) return;

    // 記号や大きさが変わったときは付け直す必要があるので、いったん全部消す
    clearAll();
    scan();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== 'kataomoi:stats') return;
    sendResponse({
      enabled: settings.enabled,
      count: document.querySelectorAll('.' + KATAOMOI_CLASS).length,
      mutualCount: document.querySelectorAll('.' + MUTUAL_CLASS).length
    });
  });
})();
