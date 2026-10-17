# 中学数学 レベル6（空間図形）

公開URL: https://chugaku-suugaku6.senta1111.workers.dev/

- 配信するのは `public/index.html` の1枚だけ（KaTeXの式表示も中に入っている）。
- 内容: 立体と展開図 / 表面積と体積 / 球と回転体。全7ステップ・47問。立体図は SVG を自動で描いている。
- 問題を直す・足すとき: `tools/gen6.js` を直す。
  1. `cd tools`
  2. `node gen6.js`（`src/data.js` を作る）
  3. `node check.js`（ALL OK が出ること）
  4. `node build.js --repo`（`tools/public/index.html` を作る）→ `public/index.html` に置きかえる
