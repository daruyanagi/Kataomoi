/*
 * Kataomoi - フォロー関係の収集役
 *
 * ツイートには「フォローされています」バッジもフォローボタンも無いので、
 * DOM だけではタイムラインの片思いを判定できない。
 *
 * ただし X 自身が受け取っている GraphQL のレスポンスには、ユーザーごとに
 *   relationship_perspectives: { following, followed_by, ... }
 * が入っている。ここではそれを横から読んで content.js に渡すだけで、
 * 追加のリクエストは一切投げない。
 *
 * ページ本体のスクリプトより先に fetch / XMLHttpRequest を差し替える必要があるため、
 * このファイルだけ world: "MAIN" かつ document_start で動かしている。
 */
(() => {
  'use strict';

  const GRAPHQL = /\/i\/api\/(?:\d+(?:\.\d+)?\/)?graphql\//;
  const MAX_BYTES = 8 * 1024 * 1024;

  /** レスポンス JSON から screen_name とフォロー関係の組を集める */
  function harvest(value, into) {
    if (!value || typeof value !== 'object') return;

    if (Array.isArray(value)) {
      for (const item of value) harvest(item, into);
      return;
    }

    const perspectives = value.relationship_perspectives;
    const screenName = value.screen_name || (value.core && value.core.screen_name);
    if (screenName && perspectives && typeof perspectives === 'object') {
      into[String(screenName).toLowerCase()] = {
        following: !!perspectives.following,
        followedBy: !!perspectives.followed_by
      };
    }

    for (const key of Object.keys(value)) harvest(value[key], into);
  }

  function publish(text) {
    if (typeof text !== 'string' || text.length > MAX_BYTES) return;
    let users;
    try {
      users = {};
      harvest(JSON.parse(text), users);
    } catch {
      return;
    }
    if (!Object.keys(users).length) return;
    window.postMessage({ __kataomoi: 1, users }, location.origin);
  }

  /* ---------------------------------------------------------------- fetch */

  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = function (...args) {
      const response = originalFetch.apply(this, args);
      try {
        const url = (typeof args[0] === 'string' ? args[0] : args[0] && args[0].url) || '';
        if (GRAPHQL.test(url)) {
          // 元の呼び出し側には一切影響を与えないよう、複製した方だけを読む
          response.then((r) => r.clone().text().then(publish)).catch(() => {});
        }
      } catch {
        /* 収集に失敗してもページの動作は妨げない */
      }
      return response;
    };
  }

  /* ------------------------------------------------------- XMLHttpRequest */

  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    try {
      this.__kataomoiUrl = String(url);
    } catch {
      /* noop */
    }
    return open.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    try {
      if (GRAPHQL.test(this.__kataomoiUrl || '')) {
        this.addEventListener('load', () => {
          try {
            if (this.responseType === '' || this.responseType === 'text') publish(this.responseText);
          } catch {
            /* noop */
          }
        });
      }
    } catch {
      /* noop */
    }
    return send.apply(this, args);
  };
})();
