// レベル6の問題データ生成: node gen6.js -> src/data.js
// 手書き10問（src/handmade.js）＋ 計算で作る問題。誤答は「よくあるまちがい」から作り、理由も一緒に付ける。
const fs = require('fs'), path = require('path');

let seed = 20261020;
function R() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const MINUS = '−';
const lab = v => (v < 0 ? MINUS + (-v) : String(v));
const T = v => String(v);
const fr = (n, d) => '\\dfrac{' + n + '}{' + d + '}';
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
function lcmBrute(a, b) { for (let x = Math.max(a, b); ; x++) if (x % a === 0 && x % b === 0) return x; }
const key = v => (v == null ? 'null:' + Math.random() : Array.isArray(v) ? v.map(x => x.toFixed(9)).join(',') : v.toFixed(9));

/* 問題を組み立てる。truth={v,tex}, cands=[{v,tex,why}]（先のものほど優先） */
function build(o) {
  const unit = o.unit || '';
  const wrap = (tex, raw) => (raw ? tex : '$' + tex + '$' + unit);
  const seen = [o.truth.tex], seenV = [key(o.truth.v)], wrongs = [];
  for (const c of o.cands) {
    if (wrongs.length >= 3) break;
    if (seen.includes(c.tex)) continue;
    if (!c.same && seenV.includes(key(c.v))) continue;
    seen.push(c.tex); seenV.push(key(c.v)); wrongs.push(c);
  }
  if (wrongs.length < 3) throw new Error(o.id + ': 誤答の候補が足りない');
  const all = shuffle([{ t: wrap(o.truth.tex, o.truth.raw), v: o.truth.v, ok: true }].concat(wrongs.map(c => (c.same ? { t: wrap(c.tex, c.raw), v: c.v, why: c.why, same: true } : { t: wrap(c.tex, c.raw), v: c.v, why: c.why }))));
  const ans = all.findIndex(x => x.ok);
  all.forEach(x => delete x.ok);
  const q = { id: o.id, expr: o.expr, p: o.p, ch: all, ans, steps: o.steps, point: o.point };
  if (o.fig) q.fig = o.fig;
  if (o.figAfter) q.figAfter = o.figAfter;
  return q;
}

/* ---------- 共通の小物 ---------- */
const LT = a => a.join(',\\ ');                                  // 数のならび（TeX）
const dfmt = x => String(+x.toFixed(8));                         // 小数の表示
const divisors = n => { const r = []; for (let i = 1; i <= n; i++) if (n % i === 0) r.push(i); return r; };
const reduceF = (n, d) => { const g = gcd(n, d); return [n / g, d / g]; };
const frT = (n, d) => (d === 1 ? String(n) : fr(n, d));           // 分母1なら整数で表示
const Fv = (n, d) => { const [a, b] = reduceF(n, d); return { v: n / d, tex: frT(a, b) }; };
const C = (n, d, why, same) => { const o = { v: n / d, tex: (n * d < 0 ? '-' : '') + frT(Math.abs(n), Math.abs(d)), why }; if (same) o.same = true; return o; };
const mixT = (w, n, d) => String(w) + fr(n, d);
function fracOfDec(x) { const s = Math.round(x * 10000); const g = gcd(s, 10000); return [s / g, 10000 / g]; }
const RAWQ = (id, p, truth, wrongs, steps, point, extra) => build(Object.assign({
  id, expr: '1', p, raw: true, truth: { v: 1, tex: truth, raw: true },
  cands: wrongs.map(([t, why]) => ({ v: null, raw: true, tex: t, why })), steps, point
}, extra || {}));
const lcmOf = (a, b) => a / gcd(a, b) * b;

/* ---------- 共通の小物（レベル6） ---------- */
const fp = n => (n < 0 ? '(' + n + ')' : String(n));       // かっこつきで表示
const sgnWord = s => (s < 0 ? 'マイナス' : 'プラス');
const cnt = a => a.filter(x => x < 0).length;


/* ---------- 文字式の道具 ---------- */
const D = s => (String(s).includes('$') || /[ぁ-んァ-ヶ一-龥]/.test(String(s)) ? s : '$' + s + '$');
// RQ: 4択（式が選択肢）。texはそのまま渡すと $…$ で包む
const RQ = (id, p, t, ws, steps, point, extra) => RAWQ(id, p, D(t), ws.map(([w, why]) => [D(w), why]), steps, point, extra);
// 1次式 a x + b を TeX に
const xt = (a, v) => (a === 1 ? v : a === -1 ? '-' + v : a + v);
const lin = (a, b, v) => { v = v || 'x'; if (a === 0) return String(b); let s = xt(a, v); if (b > 0) s += '+' + b; else if (b < 0) s += '-' + (-b); return s; };
const sgn = n => (n < 0 ? '-' + (-n) : '+' + n);
const num = n => String(n);
// 数値問題（答えがひとつの数）
const NQ = (id, p, t, ws, steps, point, unit) => build({ id, expr: String(t), p, truth: { v: t, tex: dfmt(t) }, cands: ws.map(([v, why]) => ({ v, tex: dfmt(v), why })), steps, point, unit });


/* ---------- 座標グラフの図（SVG） ---------- */
const GR = 6, GS = 22, GC = 150;
const gx = x => GC + GS * x, gy = y => GC - GS * y;
function graph(o) {
  o = o || {};
  const st = (s) => ' style="' + s + '"';
  let s = '<svg viewBox="0 0 300 300" role="img" aria-label="座標平面"' + st('width:100%;max-width:340px;height:auto;display:block;margin:8px auto') + '>';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<line x1="' + gx(i) + '" y1="' + gy(-GR) + '" x2="' + gx(i) + '" y2="' + gy(GR) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
    s += '<line x1="' + gx(-GR) + '" y1="' + gy(i) + '" x2="' + gx(GR) + '" y2="' + gy(i) + '"' + st('stroke:var(--line);stroke-width:1') + '/>';
  }
  s += '<line x1="' + gx(-GR - .4) + '" y1="' + GC + '" x2="' + gx(GR + .4) + '" y2="' + GC + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  s += '<line x1="' + GC + '" y1="' + gy(-GR - .4) + '" x2="' + GC + '" y2="' + gy(GR + .4) + '"' + st('stroke:var(--fg);stroke-width:2') + '/>';
  const tx = 'font:700 10px sans-serif;fill:var(--muted);text-anchor:middle';
  for (let i = -GR; i <= GR; i++) {
    if (i === 0) continue;
    s += '<text x="' + gx(i) + '" y="' + (GC + 13) + '"' + st(tx) + '>' + i + '</text>';
    s += '<text x="' + (GC - 9) + '" y="' + (gy(i) + 3.5) + '"' + st(tx) + '>' + i + '</text>';
  }
  s += '<text x="' + (GC - 8) + '" y="' + (GC + 13) + '"' + st(tx) + '>O</text>';
  s += '<text x="' + gx(GR + .4) + '" y="' + (GC + 24) + '"' + st('font:700 12px sans-serif;fill:var(--fg);text-anchor:end') + '>x</text>';
  s += '<text x="' + (GC + 10) + '" y="' + (gy(GR + .4) + 8) + '"' + st('font:700 12px sans-serif;fill:var(--fg)') + '>y</text>';
  (o.lines || []).forEach(a => {                       // y = a x
    const xm = Math.min(GR, GR / Math.abs(a));
    s += '<line x1="' + gx(-xm) + '" y1="' + gy(-a * xm) + '" x2="' + gx(xm) + '" y2="' + gy(a * xm) + '"' + st('stroke:var(--neg);stroke-width:2.5;stroke-linecap:round') + '/>';
  });
  (o.hyper || []).forEach(a => {                       // y = a / x
    [1, -1].forEach(sg => {
      let pts = [];
      for (let x = Math.abs(a) / GR; x <= GR + 1e-9; x += 0.05) pts.push(gx(sg * x).toFixed(1) + ',' + gy(a / (sg * x)).toFixed(1));
      s += '<polyline points="' + pts.join(' ') + '" fill="none"' + st('stroke:var(--neg);stroke-width:2.5;stroke-linecap:round') + '/>';
    });
  });
  (o.pts || []).forEach(p => {
    s += '<circle cx="' + gx(p.x) + '" cy="' + gy(p.y) + '" r="4.5"' + st('fill:var(--pos);stroke:var(--card);stroke-width:1.5') + '/>';
    if (p.l) s += '<text x="' + (gx(p.x) + 7) + '" y="' + (gy(p.y) - 6) + '"' + st('font:700 13px sans-serif;fill:var(--pos)') + '>' + p.l + '</text>';
  });
  return { type: 'svg', html: s + '</svg>' };
}
const ct = (x, y) => '(' + x + ',' + y + ')';
const rdc = (n, d) => { const g = gcd(n, d); n /= g; d /= g; if (d < 0) { n = -n; d = -d; } return [n, d]; };
const slope = (n, d) => { [n, d] = rdc(n, d); return d === 1 ? (n === 1 ? '' : n === -1 ? '-' : String(n)) + 'x' : (n < 0 ? '-' : '') + '\\dfrac{' + Math.abs(n) + '}{' + d + '}x'; };
const yEq = (n, d) => 'y=' + slope(n, d);
const hyEq = a => 'y=' + (a < 0 ? '-' : '') + '\\dfrac{' + Math.abs(a) + '}{x}';
const QN = ['第1象限', '第2象限', '第3象限', '第4象限'];

const PI = n => (n === 1 ? '\\pi' : n + '\\pi');

const PU = (n, u) => '$' + PI(n) + '$ ' + u;
const S_ = s => ' style="' + s + '"';
const svgW = (h, inner) => '<svg viewBox="0 0 260 ' + h + '" role="img" aria-label="図"' + S_('width:100%;max-width:320px;height:auto;display:block;margin:8px auto') + '>' + inner + '</svg>';
const ln = (x1, y1, x2, y2, c, w, dash) => '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' + S_('stroke:var(' + c + ');stroke-width:' + (w || 2) + ';stroke-linecap:round' + (dash ? ';stroke-dasharray:5 4' : '')) + '/>';
const tx = (x, y, t, a) => '<text x="' + x + '" y="' + y + '"' + S_('font:700 13px sans-serif;fill:var(--fg);text-anchor:' + (a || 'middle')) + '>' + t + '</text>';
const circ = (cx, cy, r) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="var(--card)"' + S_('stroke:var(--fg);stroke-width:2.5') + '/>';
function figCylNet() {
  return { type: 'svg', html: svgW(210, circ(130, 38, 25) + '<rect x="40" y="63" width="180" height="82" fill="var(--card)"' + S_('stroke:var(--fg);stroke-width:2.5') + '/>' + circ(130, 170, 25) + tx(130, 108, '側面（長方形）') + tx(130, 126, 'よこ ＝ 底面の円周') ) };
}
function figConeNet() {
  const sec = '<path d="M130,15 L43.4,65 A100 100 0 0 0 216.6,65 Z" fill="var(--card)"' + S_('stroke:var(--fg);stroke-width:2.5') + '/>';
  return { type: 'svg', html: svgW(235, sec + ln(130, 15, 43.4, 65, '--neg', 4) + tx(72, 30, '母線', 'end') + circ(130, 180, 25) + tx(130, 80, 'おうぎ形（側面）') + tx(130, 138, '弧 ＝ 底面の円周') + tx(130, 218, '底面（円）')) };
}
function figRot(kind) {
  let s = ln(60, 12, 60, 168, '--neg', 2, true) + tx(66, 14, '軸', 'start');
  if (kind === 'rect') s += '<rect x="60" y="30" width="90" height="120" fill="var(--card)"' + S_('stroke:var(--fg);stroke-width:2.5') + '/>' + tx(105, 168, '3 cm') + tx(168, 95, '4 cm', 'start');
  else s += '<path d="M60,30 L60,150 L150,150 Z" fill="var(--card)"' + S_('stroke:var(--fg);stroke-width:2.5') + '/>' + tx(105, 168, '3 cm') + tx(40, 95, '4 cm', 'end');
  return { type: 'svg', html: svgW(180, s) };
}


/* ---------- 立体図（3D → 2D） ---------- */
const PHI = (1 + Math.sqrt(5)) / 2;
function polyFaces(V) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cr = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dt = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const seen = {}, faces = [];
  const n = V.length;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = j + 1; k < n; k++) {
    let nm = cr(sub(V[j], V[i]), sub(V[k], V[i]));
    const L = Math.hypot(...nm); if (L < 1e-9) continue; nm = nm.map(x => x / L);
    const d = dt(nm, V[i]);
    let pos = 0, neg = 0, on = [];
    for (let m = 0; m < n; m++) { const e = dt(nm, V[m]) - d; if (e > 1e-6) pos++; else if (e < -1e-6) neg++; else on.push(m); }
    if (pos && neg) continue;
    const key = on.join(',');
    if (seen[key]) continue; seen[key] = 1;
    if (d < 0) nm = nm.map(x => -x);
    const c = on.reduce((a, m) => [a[0] + V[m][0] / on.length, a[1] + V[m][1] / on.length, a[2] + V[m][2] / on.length], [0, 0, 0]);
    const u = sub(V[on[0]], c), uL = Math.hypot(...u), ux = u.map(x => x / uL), vy = cr(nm, ux);
    on.sort((p, q) => Math.atan2(dt(sub(V[p], c), vy), dt(sub(V[p], c), ux)) - Math.atan2(dt(sub(V[q], c), vy), dt(sub(V[q], c), ux)));
    faces.push({ idx: on, n: nm });
  }
  return faces;
}
function polyCell(V, cx, cy, s, noHid) {
  const ry = 28 * Math.PI / 180, rx = 24 * Math.PI / 180;
  const rot = p => { let [x, y, z] = p; let x1 = x * Math.cos(ry) + z * Math.sin(ry), z1 = -x * Math.sin(ry) + z * Math.cos(ry); let y1 = y * Math.cos(rx) - z1 * Math.sin(rx), z2 = y * Math.sin(rx) + z1 * Math.cos(rx); return [x1, y1, z2]; };
  const R = Math.max(...V.map(v => Math.hypot(...v)));
  const P = V.map(v => { const r = rot(v); return [cx + r[0] * s / R, cy - r[1] * s / R]; });
  const faces = polyFaces(V), edges = {};
  faces.forEach(f => { const front = rot(f.n)[2] > 1e-6; f.idx.forEach((a, i) => { const b = f.idx[(i + 1) % f.idx.length]; const k = Math.min(a, b) + '-' + Math.max(a, b); edges[k] = edges[k] || [a, b, false]; if (front) edges[k][2] = true; }); });
  let hid = '', vis = '';
  Object.values(edges).forEach(([a, b, v]) => { const l = ln(P[a][0].toFixed(1), P[a][1].toFixed(1), P[b][0].toFixed(1), P[b][1].toFixed(1), '--fg', v ? 2.4 : 1.4, !v); if (v) vis += l; else hid += l; });
  if (noHid) return vis;
  return hid.replace(/stroke:var\(--fg\)/g, 'stroke:var(--muted)') + vis;
}
const ngon = (n, y) => Array.from({ length: n }, (_, i) => [Math.sin(2 * Math.PI * i / n), y, Math.cos(2 * Math.PI * i / n)]);
const SOL = {
  tetra: ngon(3, -0.47).concat([[0, 0.94, 0]]),
  cube: [[1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1], [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]],
  octa: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]],
  dodeca: (() => { const a = [], p = 1 / PHI; [1, -1].forEach(x => [1, -1].forEach(y => [1, -1].forEach(z => a.push([x, y, z])))); [1, -1].forEach(y => [1, -1].forEach(z => a.push([0, y * p, z * PHI]))); [1, -1].forEach(x => [1, -1].forEach(y => a.push([x * p, y * PHI, 0]))); [1, -1].forEach(x => [1, -1].forEach(z => a.push([x * PHI, 0, z * p]))); return a; })(),
  icosa: (() => { const a = []; [1, -1].forEach(y => [1, -1].forEach(z => a.push([0, y, z * PHI]))); [1, -1].forEach(x => [1, -1].forEach(y => a.push([x, y * PHI, 0]))); [1, -1].forEach(x => [1, -1].forEach(z => a.push([x * PHI, 0, z]))); return a; })(),
  prism3: ngon(3, 0.8).concat(ngon(3, -0.8)),
  prism5: ngon(5, 0.8).concat(ngon(5, -0.8)),
  pyr3: ngon(3, -0.7).concat([[0, 1.1, 0]]),
  pyr4: ngon(4, -0.7).concat([[0, 1.1, 0]])
};
const fillS = ' fill="var(--card)"';
function cylCell(cx, cy, s) {
  const rx = s * 0.8, ry = s * 0.26, h = s * 1.5, ty = cy - h / 2, by = cy + h / 2;
  const st = c => S_('stroke:var(' + c + ');stroke-width:2.4;fill:none');
  return '<path d="M' + (cx - rx) + ',' + by + ' A' + rx + ' ' + ry + ' 0 0 1 ' + (cx + rx) + ',' + by + '"' + S_('stroke:var(--muted);stroke-width:1.4;fill:none;stroke-dasharray:5 4') + '/>' + ln(cx - rx, ty, cx - rx, by, '--fg', 2.4) + ln(cx + rx, ty, cx + rx, by, '--fg', 2.4) + '<path d="M' + (cx - rx) + ',' + by + ' A' + rx + ' ' + ry + ' 0 0 0 ' + (cx + rx) + ',' + by + '"' + st('--fg') + '/>' + '<ellipse cx="' + cx + '" cy="' + ty + '" rx="' + rx + '" ry="' + ry + '"' + fillS + S_('stroke:var(--fg);stroke-width:2.4') + '/>';
}
function coneCell(cx, cy, s, bosen) {
  const rx = s * 0.8, ry = s * 0.26, h = s * 1.6, ty = cy - h / 2, by = cy + h / 2;
  let o = '<path d="M' + (cx - rx) + ',' + by + ' A' + rx + ' ' + ry + ' 0 0 1 ' + (cx + rx) + ',' + by + '"' + S_('stroke:var(--muted);stroke-width:1.4;fill:none;stroke-dasharray:5 4') + '/>' + ln(cx, ty, cx - rx, by, '--fg', 2.4) + '<path d="M' + (cx - rx) + ',' + by + ' A' + rx + ' ' + ry + ' 0 0 0 ' + (cx + rx) + ',' + by + '"' + S_('stroke:var(--fg);stroke-width:2.4;fill:none') + '/>' + ln(cx, ty, cx + rx, by, bosen ? '--neg' : '--fg', bosen ? 3 : 2.4);
  if (bosen) o += tx(cx + rx - 4, cy - 6, '母線', 'start') + ln(cx, ty, cx, by, '--muted', 1.4, true) + tx(cx - 4, cy + 4, '高さ', 'end');
  return o;
}
function sphCell(cx, cy, s) {
  const r = s * 0.9;
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '"' + fillS + S_('stroke:var(--fg);stroke-width:2.4') + '/>' + '<path d="M' + (cx - r) + ',' + cy + ' A' + r + ' ' + (r * 0.3) + ' 0 0 1 ' + (cx + r) + ',' + cy + '"' + S_('stroke:var(--muted);stroke-width:1.4;fill:none;stroke-dasharray:5 4') + '/>' + '<path d="M' + (cx - r) + ',' + cy + ' A' + r + ' ' + (r * 0.3) + ' 0 0 0 ' + (cx + r) + ',' + cy + '"' + S_('stroke:var(--fg);stroke-width:2;fill:none') + '/>';
}
function cell(kind, cx, cy, s, flag) {
  if (kind === 'cyl') return cylCell(cx, cy, s);
  if (kind === 'cone') return coneCell(cx, cy, s, flag);
  if (kind === 'sph') return sphCell(cx, cy, s);
  return polyCell(SOL[kind], cx, cy, s, kind === 'dodeca' || kind === 'icosa');
}
function figSolid(kind, label, flag) {
  return { type: 'svg', html: svgW(160, cell(kind, 130, 70, 52, flag) + tx(130, 150, label)) };
}
function figSolids(list, cols) {                  // list: [[kind,label]...]
  const rows = []; for (let i = 0; i < list.length; i += cols) rows.push(list.slice(i, i + cols));
  let s = '';
  rows.forEach((r, ri) => r.forEach(([k, lb], ci) => {
    const w = 260 / cols, off = (cols - r.length) * w / 2, cx = off + w * (ci + 0.5), cy = 52 + ri * 112;
    s += cell(k, cx, cy, 34) + tx(cx, cy + 56, lb);
  }));
  return { type: 'svg', html: svgW(rows.length * 112 + 6, s) };
}
const FIG_BASIC = figSolids([['prism3', '三角柱'], ['pyr4', '四角錐'], ['pyr3', '三角錐'], ['cyl', '円柱'], ['cone', '円錐'], ['sph', '球']], 3);
const FIG_REG = figSolids([['tetra', '正四面体'], ['cube', '正六面体'], ['octa', '正八面体'], ['dodeca', '正十二面体'], ['icosa', '正二十面体']], 3);

/* ================= パートA: 立体 ================= */
function genNamae() {
  return [
    RQ('ls-1', '底面が円で、側面が曲面。先がとがっている立体は？', '円錐', [['円柱', '円柱は、底面が2つあって、先がとがっていない。'], ['三角錐', '底面は、円ではなく三角形。'], ['球', '球には、底面がない。']], ['底面が円で、頂点が1つ ＝ 円錐。'], '柱は底面が2つ、錐は底面が1つで頂点がある。', {fig: figSolid('cone','円錐')}),
    RQ('ls-2', '底面が、合同な2つの六角形で、側面が長方形の立体は？', '六角柱', [['六角錐', '錐は、底面が1つ。側面は三角形。'], ['円柱', '底面は、円ではなく六角形。'], ['三角柱', '底面は、三角形ではなく六角形。']], ['底面が2つ、側面が長方形 ＝ 柱。', '底面が六角形なので、六角柱。'], '柱の名前は、底面の形でつく。'),
    NQ('ls-3', '四角錐の、面の数は？', 5, [[4, '底面1つと、側面4つで、5つ。'], [6, '6つは、立方体の面の数。四角錐は、底面1＋側面4。'], [8, '8は、頂点や辺の数と、まちがえているよ。']], ['底面が1つ。', '側面が4つ。$1+4=5$。'], '角錐の面の数 ＝ 底面1つ ＋ 側面（底面の辺の数）。', '個', {fig: figSolid('pyr4','四角錐')}),
    NQ('ls-4', '三角柱の、辺の数は？', 9, [[6, '6は、頂点の数。辺は、底面の辺3つ×2と、横の辺3つ。'], [8, '底面の辺 $3\\times2=6$ と、横の辺3つで、9。'], [12, '12は、立方体の辺の数。']], ['底面の辺：$3\\times2=6$。', '横の辺：3。$6+3=9$。'], '角柱の辺の数 ＝ 底面の辺の数 × 3。', '本', {fig: figSolid('prism3','三角柱')}),
    NQ('ls-5', '五角柱の、頂点の数は？', 10, [[5, '底面が2つあるので、$5\\times2$。'], [7, '底面が2つあるので、$5\\times2=10$。'], [12, '12は、六角柱の頂点の数。']], ['底面が2つ。1つに頂点が5つ。', '$5\\times2=10$。'], '角柱の頂点の数 ＝ 底面の頂点の数 × 2。', '個', {fig: figSolid('prism5','五角柱')}),
    NQ('ls-6', '立方体の、辺の数は？', 12, [[8, '8は、頂点の数。辺は、12本。'], [6, '6は、面の数。辺は、12本。'], [24, '24は、多すぎる。辺は、12本。']], ['上の面に4本、下の面に4本、たてに4本。', '$4+4+4=12$。'], '立方体：面6、辺12、頂点8。', '本', {fig: figSolid('cube','立方体')}),
    NQ('ls-7', '正多面体は、全部で何種類ある？', 5, [[4, '4種類ではなく、5種類。（正四面体・正六面体・正八面体・正十二面体・正二十面体）'], [6, '6種類ではなく、5種類。'], [8, '8種類ではなく、5種類。']], ['正四面体、正六面体、正八面体、正十二面体、正二十面体。', '全部で5種類。'], '正多面体は5種類だけ。', '種類', {fig: FIG_REG})
  ];
}
function genTenkai() {
  const out = [];
  out.push(RAWQ('tk-1', '底面の半径が3 cm の円柱の展開図で、側面の長方形の、よこの長さは？', PU(6, 'cm'), [[PU(3, 'cm'), '半径をそのまま、使っているよ。よこ ＝ 円周 ＝ $2\\pi\\times3$。'], [PU(9, 'cm'), '$\\pi r^2$ は、円の面積。よこは、円周。'], [PU(12, 'cm'), '$2\\pi\\times3=6\\pi$。2をかけすぎている。']], ['側面のよこの長さ ＝ 底面の円周。', '$2\\pi\\times3=6\\pi$。'], '円柱の側面：よこ＝円周、たて＝高さ。', { fig: figCylNet() }));
  out.push(RQ('tk-2', '円錐の展開図で、側面はどんな形？', 'おうぎ形', [['長方形', '長方形は、円柱の側面。円錐は、おうぎ形。'], ['三角形', '三角形は、角錐の側面。円錐は、おうぎ形。'], ['円', '円は、底面。側面は、おうぎ形。']], ['円錐の側面は、おうぎ形。'], '円錐：側面はおうぎ形、底面は円。', { fig: figConeNet() }));
  out.push(RAWQ('tk-3', '底面の半径3 cm、母線9 cm の円錐。側面のおうぎ形の、弧の長さは？', PU(6, 'cm'), [[PU(3, 'cm'), '半径をそのまま、使っているよ。弧 ＝ 底面の円周 ＝ $2\\pi\\times3$。'], [PU(18, 'cm'), '$2\\pi\\times9=18\\pi$ は、母線を半径とする円の円周。弧は、底面の円周。'], [PU(9, 'cm'), '9は、母線の長さ。弧は、底面の円周。']], ['おうぎ形の弧 ＝ 底面の円周。', '$2\\pi\\times3=6\\pi$。'], '円錐：おうぎ形の弧 ＝ 底面の円周。', { fig: figConeNet() }));
  out.push(NQ('tk-4', '底面の半径3 cm、母線9 cm の円錐。側面のおうぎ形の、中心角は？', 120, [[60, '弧 $6\\pi$ は、円周 $18\\pi$ の $\\dfrac{1}{3}$。$\\dfrac{1}{6}$ ではない。'], [240, '240° は、$\\dfrac{2}{3}$。弧 $6\\pi$ は、円周 $18\\pi$ の $\\dfrac{1}{3}$。'], [90, '90° は、$\\dfrac{1}{4}$。弧 $6\\pi$ は、円周 $18\\pi$ の $\\dfrac{1}{3}$。']], ['弧 ＝ $6\\pi$。母線9の円周 ＝ $18\\pi$。', '$\\dfrac{6\\pi}{18\\pi}=\\dfrac{1}{3}$。$360\\times\\dfrac{1}{3}=120$。'], '中心角 ＝ 360° × 底面の半径 ÷ 母線。', '°'));
  out.push(NQ('tk-5', '三角柱の展開図には、側面の長方形が、いくつある？', 3, [[2, '2つは、底面の三角形の数。側面は、底面の辺と同じ数。'], [4, '4つは、四角柱の側面の数。'], [6, '6は、多すぎる。側面は、底面の辺と同じ数。']], ['側面の数 ＝ 底面の辺の数。', '三角形なので、3つ。'], '角柱の側面の数 ＝ 底面の辺の数。', '個'));
  out.push(RQ('tk-6', '四角錐の展開図は、どれ？（底面は正方形）', '正方形1つと、合同な三角形4つ', [['長方形4つと、正方形2つ', 'これは、立方体（直方体）の展開図。'], ['正方形1つと、おうぎ形1つ', 'これは、円錐の展開図。'], ['正方形1つと、三角形2つ', '側面の三角形は、底面の辺と同じ、4つ必要。']], ['底面が1つ（正方形）。', '側面は、底面の辺の数と同じ4つの三角形。'], '角錐の展開図：底面 ＋ 側面（三角形）。'));
  out.push(NQ('tk-7', '底面の半径2 cm、母線8 cm の円錐。側面のおうぎ形の、中心角は？', 90, [[45, '弧 $4\\pi$ は、円周 $16\\pi$ の $\\dfrac{1}{4}$。'], [180, '180° は、$\\dfrac{1}{2}$。弧 $4\\pi$ は、円周 $16\\pi$ の $\\dfrac{1}{4}$。'], [120, '120° は、$\\dfrac{1}{3}$。弧 $4\\pi$ は、円周 $16\\pi$ の $\\dfrac{1}{4}$。']], ['弧 ＝ $2\\pi\\times2=4\\pi$。円周 ＝ $2\\pi\\times8=16\\pi$。', '$\\dfrac{4\\pi}{16\\pi}=\\dfrac{1}{4}$。$360\\times\\dfrac{1}{4}=90$。'], '中心角 ＝ 360° × 底面の半径 ÷ 母線。', '°'));
  return out;
}
function genIchi() {
  return [
    RQ('ic-1', '同じ平面の上にある、交わらない2直線の関係は？', '平行', [['ねじれの位置', 'ねじれの位置は、同じ平面の上にない2直線。'], ['垂直', '垂直は、直角に交わる。交わらない2直線ではない。'], ['重なる', '重なっていたら、1本の直線。']], ['同じ平面の上で交わらない ＝ 平行。'], '平行：同じ平面の上で、交わらない。'),
    RQ('ic-2', '空間で、平行でも交わらない2直線の関係は？', 'ねじれの位置', [['平行', '平行は、同じ平面の上にある。'], ['垂直', '垂直な直線は、交わる。'], ['交わる', '問題は、交わらない2直線のことだよ。']], ['平行でなく、交わらない ＝ ねじれの位置。'], 'ねじれの位置：平行でもなく、交わりもしない。'),
    NQ('ic-3', '立方体で、1つの辺ABと、ねじれの位置にある辺は、何本？', 4, [[3, '3本は、辺ABと平行な辺の数。'], [5, '5本ではなく、4本。'], [8, '8本は、多すぎる。平行3本、交わる辺4本、ねじれ4本。']], ['辺ABと同じ辺以外の11本は、3本（平行）、4本（交わる）、4本（ねじれ）。'], '立方体の1辺：平行3本、交わる4本、ねじれ4本。', '本'),
    RQ('ic-4', '直線が平面に垂直なのは、どんなとき？', '平面上の、交わる2直線に垂直なとき', [['平面上の、1本の直線に垂直なとき', '1本だけでは、まだ決まらない。交わる2直線が必要。'], ['平面と交わらないとき', 'これは、平行のとき。'], ['平面と1点で交わるとき', '1点で交わっても、垂直とは限らない。']], ['平面上の、交わる2直線に垂直なら、その平面に垂直。'], '直線と平面の垂直：交わる2直線に垂直。'),
    RQ('ic-5', '空間の2つの平面は、どんな位置関係になる？', '平行か、交わるか', [['ねじれの位置', 'ねじれの位置は、直線どうしの関係。平面には、ない。'], ['かならず交わる', '平行な平面は、交わらない。'], ['かならず平行', '交わる平面も、ある。']], ['平行（交わらない）か、交わる（交線ができる）か。'], '2つの平面：平行か、交わるか。'),
    NQ('ic-6', '立方体で、1つの面に垂直な辺は、何本？', 4, [[2, '2本ではなく、4本。面の4つの頂点から、1本ずつ。'], [8, '8本は、多すぎる。面の4つの頂点から、1本ずつ。'], [12, '12本は、立方体の辺ぜんぶ。']], ['面の4つの頂点から、垂直に1本ずつ出ている。', '4本。'], '面に垂直な辺は、面の頂点の数だけある。', '本'),
    RQ('ic-7', '三角柱の、2つの底面の位置関係は？', '平行', [['垂直', '2つの底面は、交わらない。'], ['ねじれの位置', 'ねじれは、直線どうしの関係。'], ['交わる', '底面は、交わらず、向かい合っている。']], ['柱の2つの底面は、平行。'], '柱の2つの底面は、平行で合同。')
  ];
}
/* ================= パートB: 表面積と体積 ================= */
function genHyomen() {
  const out = [];
  out.push(NQ('hy-1', '底面積が12 cm²、底面のまわりが14 cm、高さ5 cm の角柱の表面積は？', 94, [[82, '底面が1つ分。底面は、2つある。'], [70, '側面だけ。底面2つも足す。'], [38, '側面の高さを、かけ忘れているよ。$14\\times5$。']], ['底面2つ：$12\\times2=24$。', '側面 ＝ まわり×高さ ＝ $14\\times5=70$。', '$24+70=94$。'], '角柱の表面積 ＝ 底面積×2 ＋ 側面積（まわり×高さ）。', 'cm²'));
  out.push(NQ('hy-2', '1辺4 cm の立方体の、表面積は？', 96, [[64, '64は、体積。表面積は、面積×6。'], [16, '16は、1つの面の面積。6つ分。'], [48, '48は、3つ分。6つ分で 96。']], ['1つの面：$4\\times4=16$。', '6つ分：$16\\times6=96$。'], '立方体の表面積 ＝ 1つの面 × 6。', 'cm²'));
  out.push(RAWQ('hy-3', '半径3 cm、高さ5 cm の円柱の、表面積は？', PU(48, 'cm²'), [[PU(39, 'cm²'), '底面が1つ分。底面は、2つある。'], [PU(30, 'cm²'), '側面だけ。底面2つも足す。'], [PU(33, 'cm²'), '側面を、半分にしているよ。側面 ＝ 円周×高さ ＝ $6\\pi\\times5$。']], ['底面2つ：$9\\pi\\times2=18\\pi$。', '側面 ＝ 円周×高さ ＝ $6\\pi\\times5=30\\pi$。', '$18\\pi+30\\pi=48\\pi$。'], '円柱の表面積 ＝ 底面×2 ＋ 側面（円周×高さ）。'));
  out.push(RAWQ('hy-4', '底面の半径3 cm、母線9 cm の円錐の、表面積は？', PU(36, 'cm²'), [[PU(27, 'cm²'), '側面だけ。底面も足す。'], [PU(18, 'cm²'), '底面のぶんを、2つ分にしているよ。底面は1つ。'], [PU(90, 'cm²'), '側面を $\\pi r^2$ のように、計算しているよ。側面 ＝ $\\pi\\times$母線$\\times$半径。']], ['底面：$\\pi\\times3\\times3=9\\pi$。', '側面 ＝ $\\pi\\times9\\times3=27\\pi$。', '$9\\pi+27\\pi=36\\pi$。'], '円錐の表面積 ＝ 底面 ＋ 側面（π×母線×半径）。', { fig: figConeNet() }));
  out.push(NQ('hy-5', '底面が1辺6 cm の正方形、側面の三角形の高さが5 cm の正四角錐の、表面積は？', 96, [[60, '側面だけ。底面も足す。'], [66, '側面を、1つ分しか足していないよ。側面は、4つ。'], [156, '÷2を忘れているよ。三角形は、底辺×高さ÷2。']], ['底面：$6\\times6=36$。', '側面1つ：$6\\times5\\div2=15$。4つで 60。', '$36+60=96$。'], '角錐の表面積 ＝ 底面 ＋ 側面（三角形の和）。', 'cm²'));
  out.push(RAWQ('hy-6', '半径2 cm、高さ10 cm の円柱の、側面積は？', PU(40, 'cm²'), [[PU(20, 'cm²'), '円周 $2\\pi r$ の、2をかけ忘れているよ。'], [PU(80, 'cm²'), '2を、かけすぎているよ。$2\\pi\\times2\\times10=40\\pi$。'], [PU(8, 'cm²'), '8πは、底面2つ分の面積。']], ['側面 ＝ 円周×高さ。', '$2\\pi\\times2\\times10=40\\pi$。'], '円柱の側面積 ＝ 底面の円周 × 高さ。'));
  return out;
}
function genTaiseki() {
  const out = [];
  out.push(NQ('tb-1', '底面積15 cm²、高さ4 cm の角柱の、体積は？', 60, [[19, '足し算になっているよ。体積 ＝ 底面積×高さ。'], [30, '÷2は、いらないよ。柱の体積 ＝ 底面積×高さ。'], [20, '20は、錐の体積。柱は、$\\dfrac{1}{3}$ をかけない。']], ['$15\\times4=60$。'], '柱の体積 ＝ 底面積 × 高さ。', 'cm³'));
  out.push(NQ('tb-2', '底面積15 cm²、高さ4 cm の角錐の、体積は？', 20, [[60, '$\\dfrac{1}{3}$ を、かけ忘れているよ。錐の体積 ＝ 底面積×高さ×$\\dfrac{1}{3}$。'], [30, '$\\dfrac{1}{2}$ をかけているよ。錐は、$\\dfrac{1}{3}$。'], [19, '足し算になっているよ。']], ['$15\\times4\\times\\dfrac{1}{3}=20$。'], '錐の体積 ＝ 底面積 × 高さ × 1/3。', 'cm³'));
  out.push(RAWQ('tb-3', '半径3 cm、高さ5 cm の円柱の、体積は？', PU(45, 'cm³'), [[PU(15, 'cm³'), '$\\pi\\times3\\times5$ になっているよ。底面積は、$\\pi\\times3\\times3$。'], [PU(30, 'cm³'), '30πは、側面積。体積は、底面積×高さ。'], [PU(135, 'cm³'), '半径を、3回かけているよ。$9\\pi\\times5$。']], ['底面積：$\\pi\\times3\\times3=9\\pi$。', '$9\\pi\\times5=45\\pi$。'], '円柱の体積 ＝ 底面積 × 高さ ＝ πr²h。'));
  out.push(RAWQ('tb-4', '半径3 cm、高さ4 cm の円錐の、体積は？', PU(12, 'cm³'), [[PU(36, 'cm³'), '$\\dfrac{1}{3}$ を、かけ忘れているよ。'], [PU(24, 'cm³'), '$\\dfrac{1}{3}$ ではなく、$\\dfrac{2}{3}$ をかけているよ。'], [PU(16, 'cm³'), '半径と高さを、とりちがえているよ。']], ['底面積：$9\\pi$。', '$9\\pi\\times4\\times\\dfrac{1}{3}=12\\pi$。'], '円錐の体積 ＝ 底面積 × 高さ × 1/3。'));
  out.push(NQ('tb-5', '1辺5 cm の立方体の、体積は？', 125, [[25, '25は、1つの面の面積。体積は、3回かける。'], [15, '足し算になっているよ。$5\\times5\\times5$。'], [150, '150は、表面積。']], ['$5\\times5\\times5=125$。'], '立方体の体積 ＝ 1辺 × 1辺 × 1辺。', 'cm³'));
  out.push(NQ('tb-6', 'たて3 cm、よこ4 cm、高さ5 cm の直方体の、体積は？', 60, [[12, '12は、底面積。高さもかける。'], [47, '足し算になっているよ。たて×よこ×高さ。'], [94, '94は、表面積。']], ['$3\\times4\\times5=60$。'], '直方体の体積 ＝ たて × よこ × 高さ。', 'cm³'));
  out.push(NQ('tb-7', '底面が、底辺6 cm・高さ4 cm の三角形で、高さ10 cm の三角柱の、体積は？', 120, [[240, '÷2を、忘れているよ。底面積は、$6\\times4\\div2=12$。'], [40, '÷3をしているよ。柱は、底面積×高さ。'], [60, '÷2を、2回しているよ。']], ['底面積：$6\\times4\\div2=12$。', '$12\\times10=120$。'], '柱の体積 ＝ 底面積 × 高さ。', 'cm³'));
  return out;
}
/* ================= パートC: 球と回転体 ================= */
function genKyu() {
  const out = [];
  out.push(RAWQ('qk-1', '半径2 cm の球の、表面積は？', PU(16, 'cm²'), [[PU(4, 'cm²'), '$\\pi r^2$ になっているよ。球の表面積は、$4\\pi r^2$。'], [PU(8, 'cm²'), '$2\\pi r^2$ になっているよ。球は、$4\\pi r^2$。'], [PU(32, 'cm²'), '$4\\pi r^3$ のように、3回かけているよ。2回。']], ['$4\\pi\\times2\\times2=16\\pi$。'], '球の表面積 ＝ 4πr²。'));
  out.push(RAWQ('qk-2', '半径6 cm の球の、体積は？', PU(288, 'cm³'), [[PU(864, 'cm³'), '$\\dfrac{1}{3}$ を、かけ忘れているよ。体積 ＝ $\\dfrac{4}{3}\\pi r^3$。'], [PU(144, 'cm³'), '144πは、表面積。体積は、$\\dfrac{4}{3}\\pi r^3$。'], [PU(96, 'cm³'), '$r^3$ ではなく、$r^2$ で計算しているよ。']], ['$\\dfrac{4}{3}\\pi\\times6^3=\\dfrac{4}{3}\\pi\\times216=288\\pi$。'], '球の体積 ＝ (4/3)πr³。'));
  out.push(RAWQ('qk-3', '半径4 cm の球の、表面積は？', PU(64, 'cm²'), [[PU(16, 'cm²'), '$\\pi r^2$ になっているよ。4をかけ忘れ。'], [PU(32, 'cm²'), '$2\\pi r^2$ になっているよ。球は、$4\\pi r^2$。'], [PU(256, 'cm²'), '$4\\pi r^3$ のように、3回かけているよ。2回。']], ['$4\\pi\\times4\\times4=64\\pi$。'], '球の表面積 ＝ 4πr²。'));
  out.push(RAWQ('qk-4', '直径10 cm の球の、表面積は？', PU(100, 'cm²'), [[PU(400, 'cm²'), '直径を、そのまま使っているよ。半径は、5。'], [PU(25, 'cm²'), '4をかけ忘れているよ。$4\\pi r^2$。'], [PU(200, 'cm²'), '$2\\pi r^2$ になっているよ。球は、$4\\pi r^2$。']], ['半径 ＝ $10\\div2=5$。', '$4\\pi\\times5\\times5=100\\pi$。'], '半径を使う。直径のときは、÷2。'));
  out.push(RAWQ('qk-5', '半径3 cm の球の、体積は？', PU(36, 'cm³'), [[PU(108, 'cm³'), '$\\dfrac{1}{3}$ を、かけ忘れているよ。'], [PU(12, 'cm³'), '$\\dfrac{4}{3}\\pi r^3$ の、$r^3$ を、$r$ で計算しているよ。'], [PU(9, 'cm³'), '$\\pi r^2$ になっているよ。']], ['$\\dfrac{4}{3}\\pi\\times27=36\\pi$。'], '球の体積 ＝ (4/3)πr³。'));
  out.push(RQ('qk-6', '球の半径を2倍にすると、体積は何倍になる？', '8倍', [['2倍', '半径が2倍になると、体積は、$2\\times2\\times2$ 倍。'], ['4倍', '4倍は、表面積。体積は、3回かける。'], ['16倍', '16倍は、半径を4乗にしているよ。体積は、3乗。']], ['体積は、半径の3乗に比例する。', '$2^3=8$ 倍。'], '半径が2倍 → 表面積4倍、体積8倍。'));
  return out;
}
function genKaiten() {
  const out = [];
  out.push(RQ('kt-1', '長方形を、1辺を軸にして、1回転させると？', '円柱', [['円錐', '円錐は、直角三角形を回転させたとき。'], ['球', '球は、半円を回転させたとき。'], ['角柱', '回転させると、曲面になる。角柱には、ならない。']], ['長方形を回すと、円柱。'], '回転体：長方形→円柱、直角三角形→円錐、半円→球。', { fig: figRot('rect') }));
  out.push(RQ('kt-2', '直角三角形を、直角をはさむ1辺を軸にして、1回転させると？', '円錐', [['円柱', '円柱は、長方形を回転させたとき。'], ['球', '球は、半円を回転させたとき。'], ['三角錐', '回転させると、曲面になる。三角錐には、ならない。']], ['直角三角形を回すと、円錐。'], '回転体：長方形→円柱、直角三角形→円錐、半円→球。', { fig: figRot('tri') }));
  out.push(RQ('kt-3', '半円を、直径を軸にして、1回転させると？', '球', [['円柱', '円柱は、長方形を回転させたとき。'], ['円錐', '円錐は、直角三角形を回転させたとき。'], ['半球', '1回転すると、まるごとの球になる。']], ['半円を回すと、球。'], '回転体：長方形→円柱、直角三角形→円錐、半円→球。'));
  out.push(RAWQ('kt-4', '縦4 cm、横3 cm の長方形を、縦の辺を軸にして1回転させた立体の、体積は？', PU(36, 'cm³'), [[PU(48, 'cm³'), '半径と高さを、とりちがえているよ。軸が縦なので、高さ4、半径3。'], [PU(12, 'cm³'), '円錐の体積になっているよ。長方形を回すと、円柱。'], [PU(24, 'cm³'), '$\\pi\\times3\\times4\\times2$ になっているよ。底面積は、$\\pi r^2$。']], ['軸の縦が高さ4、横が半径3の円柱。', '$\\pi\\times3\\times3\\times4=36\\pi$。'], '回転体では、軸に平行な辺が高さ、軸に垂直な辺が半径。', { fig: figRot('rect') }));
  out.push(RAWQ('kt-5', '直角をはさむ辺が3 cm と 4 cm の直角三角形を、4 cm の辺を軸にして1回転させた立体の、体積は？', PU(12, 'cm³'), [[PU(16, 'cm³'), '半径と高さを、とりちがえているよ。軸が4cmなので、高さ4、半径3。'], [PU(36, 'cm³'), '$\\dfrac{1}{3}$ を、かけ忘れているよ。'], [PU(24, 'cm³'), '$\\dfrac{1}{3}$ ではなく、$\\dfrac{2}{3}$ をかけているよ。']], ['軸の4cmが高さ、3cmが半径の円錐。', '$\\pi\\times3\\times3\\times4\\times\\dfrac{1}{3}=12\\pi$。'], '回転体では、軸に平行な辺が高さ、軸に垂直な辺が半径。', { fig: figRot('tri') }));
  out.push(RQ('kt-6', '円錐を、軸（頂点と底面の中心を通る線）をふくむ平面で切ったとき、切り口の形は？', '二等辺三角形', [['円', '円は、底面に平行に切ったときの切り口。'], ['長方形', '長方形は、円柱を切ったときの切り口。'], ['台形', '台形は、軸をふくまずに切ったときなどの切り口。']], ['軸をふくむ平面で切ると、二等辺三角形。'], '円錐：軸をふくんで切ると二等辺三角形、底面と平行に切ると円。'));
  out.push(RQ('kt-7', '円柱を、底面に平行な平面で切ったとき、切り口の形は？', '円', [['長方形', '長方形は、軸をふくんで切ったとき。'], ['だ円', 'だ円は、ななめに切ったときの切り口。'], ['三角形', '三角形には、ならない。']], ['底面と平行に切ると、底面と同じ円。'], '円柱：底面に平行に切ると円、軸をふくんで切ると長方形。'));
  return out;
}

/* ---------- 組み立て ---------- */
const RT = rows => '<table class="rtab">' + rows.map(r => '<tr>' + r.map(c => '<td>' + c + '</td>').join('') + '</tr>').join('') + '</table>';
const I = {
  na: '<b>柱</b>は、底面が<b>2つ</b>（合同で平行）で、側面は長方形。<b>錐</b>は、底面が<b>1つ</b>で、側面は三角形（円錐は曲面）。<br>名前は、<b>底面の形</b>でつく。三角柱、四角錐、円柱、円錐…。' + FIG_BASIC.html + '立方体は、面6・辺12・頂点8。<br><b>正多面体</b>は、全部で5種類。' + FIG_REG.html + '正四面体（面4）・正六面体（面6）・正八面体（面8）・正十二面体（面12）・正二十面体（面20）。',
  tk: '<b>展開図</b>は、立体を切り開いて、平面にしたもの。<br>・円柱：側面は<b>長方形</b>（よこ＝底面の円周）<br>・円錐：側面は<b>おうぎ形</b>（弧＝底面の円周）<br>円錐の<b>母線</b>は、頂点から底面のふちまでの線。' + figSolid('cone','円錐', true).html + 'これを開くと、おうぎ形になる。母線は、おうぎ形の<b>半径</b>。' + figConeNet().html + 'おうぎ形の中心角 ＝ 360° × 底面の半径 ÷ 母線。',
  ic: '空間の2直線は、<b>平行</b>・<b>交わる</b>・<b>ねじれの位置</b>の3つ。<br><b>ねじれの位置</b>は、平行でなく、交わらない。<br>直線が平面に垂直 ＝ 平面上の<b>交わる2直線</b>に垂直。<br>2つの平面は、<b>平行</b>か<b>交わる</b>か。',
  hy: '<b>表面積</b> ＝ 底面積 ＋ 側面積。<br>・<b>柱</b>：底面積×2 ＋ （まわり×高さ）<br>・<b>円柱</b>：$2\\pi r^2+2\\pi r\\times h$<br>・<b>角錐</b>：底面 ＋ 三角形の側面<br>・<b>円錐</b>：$\\pi r^2+\\pi\\times$母線$\\times r$',
  tb: '<b>柱</b>の体積 ＝ 底面積 × 高さ。<br><b>錐</b>の体積 ＝ 底面積 × 高さ × $\\dfrac{1}{3}$。<br>円柱 $\\pi r^2h$、円錐 $\\dfrac{1}{3}\\pi r^2h$。<br>直方体は、たて×よこ×高さ。',
  qk: '<b>球</b>（半径 $r$）<br>・表面積 ＝ $4\\pi r^2$<br>・体積 ＝ $\\dfrac{4}{3}\\pi r^3$<br>直径のときは、まず半径（÷2）にする。',
  kt: '平面の図形を、<b>軸</b>のまわりに1回転させてできる立体が<b>回転体</b>。<br>長方形 → 円柱、直角三角形 → 円錐、半円 → 球。<br>体積は、<b>軸に平行な辺が高さ、軸に垂直な辺が半径</b>。<br>切り口は、底面に平行なら円、軸をふくむなら（円柱は長方形、円錐は二等辺三角形）。'
};
const ABOUT = {
  ritsu: [
    { p: '<b>柱</b>は底面が2つ、<b>錐</b>は底面が1つ。展開図にすると、平面になる。' },
    { p: RT([['円柱の側面', '→', '長方形'], ['円錐の側面', '→', 'おうぎ形'], ['角錐の側面', '→', '三角形']]) },
    { cap: '展開図を思いうかべると、公式が出せる。' }
  ],
  hyotai: [
    { p: '<b>表面積</b>は、展開図の面積の合計。<b>体積</b>は、柱は底面積×高さ、錐はその $\\dfrac{1}{3}$。' },
    { p: RT([['柱の体積', '→', '底面積×高さ'], ['錐の体積', '→', '底面積×高さ×1/3'], ['円柱の表面積', '→', '底面2つ＋側面']]) },
    { cap: '錐の体積は、柱の3分の1。' }
  ],
  kyu: [
    { p: '<b>球</b>は、公式をそのまま使う。<b>回転体</b>は、軸に平行な辺が高さ。' },
    { p: RT([['球の表面積', '→', '$4\\pi r^2$'], ['球の体積', '→', '$\\dfrac{4}{3}\\pi r^3$'], ['半円を回転', '→', '球']]) },
    { cap: '半径は、直径の半分。' }
  ]
};
const PARTS = [
  {
    id: 'ritsu', title: '立体と展開図', sub: '名前・展開図・位置', about: ABOUT.ritsu, aboutTitle: 'まず見てみよう：立体', aboutSub: '柱と錐',
    steps: [
      { id: 'ritsu-1', title: '立体の名前', sub: '柱・錐・面と辺', intro: I.na, qs: genNamae() },
      { id: 'ritsu-2', title: '展開図', sub: '円柱・円錐・角錐', intro: I.tk, qs: genTenkai() },
      { id: 'ritsu-3', title: '直線と平面の位置', sub: '平行・ねじれ・垂直', intro: I.ic, qs: genIchi() }
    ]
  },
  {
    id: 'hyotai', title: '表面積と体積', sub: '柱と錐の公式', about: ABOUT.hyotai, aboutTitle: 'まず見てみよう：公式', aboutSub: '柱と錐',
    steps: [
      { id: 'hyotai-1', title: '表面積', sub: '底面＋側面', intro: I.hy, qs: genHyomen() },
      { id: 'hyotai-2', title: '体積', sub: '柱と錐', intro: I.tb, qs: genTaiseki() }
    ]
  },
  {
    id: 'kyu', title: '球と回転体', sub: '球・回転体・切り口', about: ABOUT.kyu, aboutTitle: 'まず見てみよう：球と回転体', aboutSub: '4πr² と (4/3)πr³',
    steps: [
      { id: 'kyu-1', title: '球', sub: '表面積と体積', intro: I.qk, qs: genKyu() },
      { id: 'kyu-2', title: '回転体と切り口', sub: '軸のまわりに回す', intro: I.kt, qs: genKaiten() }
    ]
  }
];
const rb = s => s.replace(/母線/g, '<ruby>母線<rt>ぼせん</rt></ruby>').replace(/弧/g, '<ruby>弧<rt>こ</rt></ruby>').replace(/錐/g, '<ruby>錐<rt>すい</rt></ruby>');
const ruby = o => typeof o === 'string' ? o.split(/(<svg[\s\S]*?<\/svg>)/).map((t, k) => k % 2 ? t : rb(t)).join('')
  : Array.isArray(o) ? o.map(ruby) : (o && typeof o === 'object') ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (k === 'expr' || k === 'id' || k === 'html') ? v : ruby(v)])) : o;
const out = '// 自動生成（node gen6.js）。手で直すときは gen6.js を直す。\nconst PARTS = ' + JSON.stringify(ruby(PARTS)) + ';\nif (typeof module !== \'undefined\') module.exports = PARTS;\n';
fs.writeFileSync(path.join(__dirname, 'src/data.js'), out);
let n = 0; PARTS.forEach(P => P.steps.forEach(s => { n += s.qs.length; }));
console.log('src/data.js を作成：' + n + '問、' + (out.length / 1024).toFixed(0) + 'KB');
