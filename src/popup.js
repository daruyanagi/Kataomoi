'use strict';

const countEl = document.getElementById('count');
const noteEl = document.getElementById('note');
const enabledEl = document.getElementById('enabled');

chrome.storage.sync.get({ enabled: KATAOMOI_DEFAULTS.enabled }, (settings) => {
  enabledEl.checked = settings.enabled;
});

enabledEl.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: enabledEl.checked }, refresh);
});

function refresh() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.tabs.sendMessage(tab.id, { type: 'kataomoi:stats' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        countEl.textContent = '–';
        noteEl.textContent = 'このページでは動作しません。x.com を開いてください。';
        return;
      }
      countEl.textContent = String(response.count);
      noteEl.textContent = response.enabled
        ? 'ユーザー一覧をスクロールすると、表示済みのぶんだけ数が増えます。'
        : '現在オフになっています。';
    });
  });
}

document.getElementById('openOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

refresh();
