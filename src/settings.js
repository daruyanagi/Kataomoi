/*
 * Kataomoi - 設定の既定値
 *
 * content.js / popup.js / options.js のどれからも読めるように 1 か所にまとめている。
 * chrome.storage.sync.get() にそのまま渡す形。
 */
const KATAOMOI_DEFAULTS = {
  /** 💔 を表示するか（ポップアップからも切り替えられる） */
  enabled: true,

  /** 片思いのときに表示する記号 */
  icon: '💔',

  /** 記号の大きさ: small | medium | large */
  iconSize: 'medium',

  /** 表示する場所 */
  showInLists: true,
  showInTimeline: true,
  showInProfile: true,

  /** タイムラインで、引用元の投稿者にも表示するか */
  showQuoted: true,

  /** 相互フォローにも印を付けるか */
  markMutual: false,

  /** 相互フォローのときに表示する記号 */
  mutualIcon: '💚'
};
