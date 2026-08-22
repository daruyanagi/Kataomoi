# プライバシーポリシー / Privacy Policy

**Kataomoi** — 最終更新: 2026-08-23

## 日本語

### 収集する情報

**Kataomoi は、いかなる情報も収集・保存・送信しません。**

- 開発者や第三者のサーバーへデータを送ることはありません
- 拡張機能から X (x.com / twitter.com) を含む外部への通信を新たに発生させることはありません
- 解析ツール、広告、トラッキングの類は一切組み込んでいません

### 拡張機能が扱うもの

Kataomoi が動作のために読み取るのは、以下の 2 つだけです。いずれも**あなたのブラウザーの中だけ**で処理され、画面に 💔 を表示した時点で役目を終えます。どこにも保存されません。

| 読み取るもの | 目的 |
| --- | --- |
| 表示中の x.com / twitter.com のページ内容（フォローボタンの状態、「フォローされています」バッジ、表示名） | 片思いかどうかを判定して 💔 を表示するため |
| ブラウザーがすでに受け取った X のレスポンスに含まれるフォロー関係（`relationship_perspectives`） | タイムラインのツイートで片思いかどうかを判定するため |

2 つ目について補足します。Kataomoi は X に対してリクエストを送りません。**あなたのブラウザーが X の画面を表示するためにすでに受け取っているデータ**を読むだけです。

### 保存する設定

`chrome.storage.sync` に、次の 1 項目だけを保存します。

- `enabled` — 💔 の表示 ON / OFF（真偽値）

これは Chrome の同期機能によってあなたの Google アカウント内で同期されることがありますが、開発者がその内容を参照することはできません。

### 権限について

| 権限 | 理由 |
| --- | --- |
| `storage` | 上記の ON / OFF 設定を保存するため |
| `https://x.com/*`, `https://twitter.com/*` | 対象ページで 💔 を表示するため。この 2 サイト以外では一切動作しません |

### 連絡先

不具合や質問は GitHub の Issue へお願いします。
https://github.com/daruyanagi/Kataomoi/issues

---

## English

### Information we collect

**Kataomoi does not collect, store, or transmit any information.**

- No data is ever sent to the developer or any third party
- The extension makes no network requests of its own, to X or anywhere else
- No analytics, advertising, or tracking of any kind

### What the extension reads

Kataomoi reads only the following, entirely **within your browser**. Nothing is retained after the 💔 is drawn.

| Read | Purpose |
| --- | --- |
| The content of the x.com / twitter.com page you are viewing (follow button state, "Follows you" badge, display names) | To decide whether to show 💔 |
| Follow relationships (`relationship_perspectives`) contained in responses your browser has **already received** from X | To decide whether to show 💔 on timeline tweets |

Kataomoi never sends requests to X. It only reads data your browser already received in order to render the page.

### Stored settings

A single value is stored in `chrome.storage.sync`:

- `enabled` — whether 💔 is shown (boolean)

Chrome may sync this within your own Google account. The developer cannot access it.

### Permissions

| Permission | Reason |
| --- | --- |
| `storage` | To remember the on/off setting above |
| `https://x.com/*`, `https://twitter.com/*` | To show 💔 on those pages. The extension does not run anywhere else |

### Contact

https://github.com/daruyanagi/Kataomoi/issues
