// デモ画面を拡張機能と同じ条件で動かすための最小スタブ
window.chrome = {
  storage: { sync: { get: (d, cb) => cb(d) }, onChanged: { addListener: () => {} } },
  runtime: { onMessage: { addListener: () => {} } }
};
