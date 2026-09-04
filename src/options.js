'use strict';

/*
 * 設定ダイアログ。
 *
 * 保存ボタンは置かず、変更のたびに chrome.storage.sync へ書き込む。
 * content.js は storage.onChanged を見ているので、開いている X のタブにすぐ反映される。
 */

/** 入力欄の id と、扱う値の種類 */
const FIELDS = {
  icon: 'text',
  iconSize: 'select',
  markMutual: 'check',
  mutualIcon: 'text',
  showInLists: 'check',
  showInTimeline: 'check',
  showQuoted: 'check',
  showInProfile: 'check'
};

const statusEl = document.getElementById('status');
const previewEl = document.getElementById('previewMark');
let statusTimer = 0;

function el(id) {
  return document.getElementById(id);
}

function readForm() {
  const values = {};
  for (const [id, kind] of Object.entries(FIELDS)) {
    const input = el(id);
    values[id] = kind === 'check' ? input.checked : input.value;
  }
  // 記号を空にされると印が出せなくなるので既定値へ戻す
  if (!values.icon.trim()) values.icon = KATAOMOI_DEFAULTS.icon;
  if (!values.mutualIcon.trim()) values.mutualIcon = KATAOMOI_DEFAULTS.mutualIcon;
  return values;
}

function writeForm(values) {
  for (const [id, kind] of Object.entries(FIELDS)) {
    const input = el(id);
    if (kind === 'check') input.checked = !!values[id];
    else input.value = values[id];
  }
  updateEnabledState();
  updatePreview();
}

/** 親のチェックが外れている項目は触れないようにする */
function updateEnabledState() {
  el('showQuoted').disabled = !el('showInTimeline').checked;
  el('mutualIcon').disabled = !el('markMutual').checked;
}

function updatePreview() {
  const size = { small: '0.8em', medium: '0.95em', large: '1.2em' }[el('iconSize').value];
  previewEl.textContent = el('icon').value || KATAOMOI_DEFAULTS.icon;
  previewEl.style.marginLeft = '4px';
  previewEl.style.fontSize = size;
}

function flashStatus() {
  statusEl.classList.add('show');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusEl.classList.remove('show'), 1200);
}

function save() {
  const values = readForm();
  writeForm(values);
  chrome.storage.sync.set(values, flashStatus);
}

/* --------------------------------------------------------------- 起動 */

chrome.storage.sync.get(KATAOMOI_DEFAULTS, (stored) => {
  writeForm(Object.assign({}, KATAOMOI_DEFAULTS, stored));
});

for (const id of Object.keys(FIELDS)) {
  const input = el(id);
  input.addEventListener('change', save);
  if (input.type === 'text') input.addEventListener('input', updatePreview);
}

for (const button of document.querySelectorAll('#iconPresets button')) {
  button.addEventListener('click', () => {
    el('icon').value = button.dataset.icon;
    save();
  });
}

document.getElementById('reset').addEventListener('click', () => {
  writeForm(KATAOMOI_DEFAULTS);
  chrome.storage.sync.set(KATAOMOI_DEFAULTS, flashStatus);
});
