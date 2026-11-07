/* ================= utils ================= */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const f2 = v => Math.round(v * 1000) / 1000;
const fmtN = (v, d = 2) => (Number.isFinite(v) ? v : 0).toFixed(d).replace('.', ',');
const fmtMM = v => fmtN(v) + ' mm';
const parseNum = s => { const v = parseFloat(String(s).replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
const byId = (a, b) => ((parseFloat(a.id) || 0) - (parseFloat(b.id) || 0)) || String(a.id).localeCompare(String(b.id));
const DEG = Math.PI / 180;
function distToSeg(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2, 0, 1) : 0;
  const q = [a[0] + t * dx, a[1] + t * dy];
  return { d: dist(p, q), q, t };
}
function nearestOnPoly(p, pts) {
  let best = { d: Infinity, q: p, i: -1 };
  for (let i = 0; i < pts.length - 1; i++) { const r = distToSeg(p, pts[i], pts[i + 1]); if (r.d < best.d) best = { ...r, i }; }
  return best;
}
const polyLen = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; };
const polyD = pts => 'M' + pts.map(p => f2(p[0]) + ' ' + f2(p[1])).join('L');
function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ================= footprints (mm, origin = centre) ================= */
const P = (id, x, y, w, h, shape, drill, name) => ({ id: String(id), x: f2(x), y: f2(y), w: f2(w), h: f2(h ?? w), shape: shape || 'rect', drill: f2(drill || 0), name: name || '' });
const Rc = (x, y, w, h, r = 0) => ({ t: 'rect', x: f2(x), y: f2(y), w: f2(w), h: f2(h), r: f2(r) });
const Ci = (x, y, r) => ({ t: 'circle', x: f2(x), y: f2(y), r: f2(r) });
const Pa = (d, bb) => ({ t: 'path', d, bb });
const Dt = (x, y, r = .25) => ({ t: 'dot', x: f2(x), y: f2(y), r });
const plus = (x, y, s = .5) => Pa(`M${f2(x - s)} ${f2(y)}H${f2(x + s)}M${f2(x)} ${f2(y - s)}V${f2(y + s)}`);

const CHIP = {
  '0402': { c: .5, pw: .6, ph: .6, bl: 1, bw: .5 }, '0603': { c: .8, pw: .8, ph: .95, bl: 1.6, bw: .8 },
  '0805': { c: 1, pw: 1, ph: 1.35, bl: 2, bw: 1.25 }, '1206': { c: 1.5, pw: 1.15, ph: 1.8, bl: 3.2, bw: 1.6 },
  '1210': { c: 1.5, pw: 1.15, ph: 2.7, bl: 3.2, bw: 2.5 }, '2010': { c: 2.4, pw: 1.3, ph: 2.6, bl: 5, bw: 2.5 },
  '2512': { c: 2.95, pw: 1.5, ph: 3.4, bl: 6.3, bw: 3.2 }
};
const TANT = { A: { c: 1.4, pw: 1.4, ph: 1.4, bl: 3.2, bw: 1.6 }, B: { c: 1.55, pw: 1.5, ph: 2.3, bl: 3.5, bw: 2.8 }, C: { c: 2.6, pw: 2.2, ph: 2.4, bl: 6, bw: 3.2 }, D: { c: 3.2, pw: 2.5, ph: 2.6, bl: 7.3, bw: 4.3 } };
const DIO = { 'SOD-323': { c: 1.15, pw: .6, ph: .5, bl: 1.7, bw: 1.25 }, 'SOD-123': { c: 1.65, pw: .9, ph: 1.2, bl: 2.7, bw: 1.6 }, SMA: { c: 2, pw: 1.6, ph: 1.6, bl: 4.3, bw: 2.6 }, SMB: { c: 2.15, pw: 2.1, ph: 2.3, bl: 4.6, bw: 3.6 }, SMC: { c: 3.4, pw: 2.5, ph: 3.3, bl: 6.9, bw: 5.9 } };

function gChip(tbl, key, o = {}) {
  const s = tbl[key] || Object.values(tbl)[0];
  const f = { body: [Rc(-s.bl / 2, -s.bw / 2, s.bl, s.bw, .06)], marks: [], pins: [P(1, -s.c, 0, s.pw, s.ph, 'rect', 0, o.n1), P(2, s.c, 0, s.pw, s.ph, 'rect', 0, o.n2)] };
  if (o.polar) f.marks.push(Pa(`M${f2(-s.c - s.pw / 2 - .3)} ${f2(-s.ph / 2)}V${f2(s.ph / 2)}`));
  return f;
}
function gAxial(pitch, bl, bd, o = {}) {
  const h = pitch / 2, pd = o.pd || 1.6, dr = o.dr || .8;
  const f = { body: [Rc(-bl / 2, -bd / 2, bl, bd, bd * .3)], marks: [Pa(`M${f2(-h + pd / 2)} 0H${f2(-bl / 2)}M${f2(bl / 2)} 0H${f2(h - pd / 2)}`)],
    pins: [P(1, -h, 0, pd, pd, o.sq ? 'rect' : 'circle', dr, o.n1), P(2, h, 0, pd, pd, 'circle', dr, o.n2)] };
  if (o.band) f.marks.push(Pa(`M${f2(-bl / 2 + bl * .2)} ${f2(-bd / 2)}V${f2(bd / 2)}`));
  return f;
}
const gDisc = pitch => { const h = pitch / 2; return { body: [Rc(-h - 1.1, -1.3, pitch + 2.2, 2.6, 1.1)], marks: [], pins: [P(1, -h, 0, 1.6, 1.6, 'circle', .8), P(2, h, 0, 1.6, 1.6, 'circle', .8)] }; };
function gRadial(D, pitch) {
  const r = D / 2, h = pitch / 2, pd = Math.min(1.8, pitch * .72), dr = pd * .5;
  return { body: [Ci(0, 0, r)],
    marks: [plus(-r * .55, -r * .5, Math.min(.6, r * .18)), Pa(`M${f2(r * .55)} ${f2(-r * .835)}A${f2(r)} ${f2(r)} 0 0 1 ${f2(r * .55)} ${f2(r * .835)}`)],
    pins: [P(1, -h, 0, pd, pd, 'rect', dr, '+'), P(2, h, 0, pd, pd, 'circle', dr, '−')] };
}
function gElSmd(D) {
  const h = D / 2 + .15, c = D * .22, pc = D * .42, pw = Math.max(1.4, D * .45), ph = Math.max(1, D * .26);
  return { body: [Pa(`M${f2(-h + c)} ${f2(-h)}H${f2(h)}V${f2(h)}H${f2(-h + c)}L${f2(-h)} ${f2(h - c)}V${f2(-h + c)}Z`, [-h, -h, h, h])],
    marks: [Ci(0, 0, D / 2 - .25), plus(-h * .55, -h * .62, .45)],
    pins: [P(1, -pc, 0, pw, ph, 'rect', 0, '+'), P(2, pc, 0, pw, ph, 'rect', 0, '−')] };
}
function gLedTht(D) {
  const r = D / 2 + .4, f = r * .86, cc = Math.sqrt(r * r - f * f);
  return { body: [Pa(`M${f2(-f)} ${f2(-cc)}A${f2(r)} ${f2(r)} 0 1 1 ${f2(-f)} ${f2(cc)}Z`, [-f, -r, r, r])], marks: [],
    pins: [P(1, -1.27, 0, 1.8, 1.8, 'rect', .9, 'K'), P(2, 1.27, 0, 1.8, 1.8, 'circle', .9, 'A')] };
}
function gSot23(n) {
  const pins = [], pw = .6, ph = .8;
  if (n === 3) pins.push(P(1, -.95, 1, pw, ph), P(2, .95, 1, pw, ph), P(3, 0, -1, pw, ph));
  else if (n === 5) pins.push(P(1, -.95, 1.1, pw, ph), P(2, 0, 1.1, pw, ph), P(3, .95, 1.1, pw, ph), P(4, .95, -1.1, pw, ph), P(5, -.95, -1.1, pw, ph));
  else { [-.95, 0, .95].forEach((x, i) => pins.push(P(i + 1, x, 1.1, pw, ph))); [.95, 0, -.95].forEach((x, i) => pins.push(P(i + 4, x, -1.1, pw, ph))); }
  const bh = n === 3 ? 1.3 : 1.6;
  return { body: [Rc(-1.45, -bh / 2, 2.9, bh, .05)], marks: [Dt(-1.05, bh / 2 - .35, .15)], pins };
}
const gSot223 = () => ({ body: [Rc(-3.25, -1.75, 6.5, 3.5, .1)], marks: [Dt(-2.6, 1.1, .25)], pins: [P(1, -2.3, 3.15, .95, 2), P(2, 0, 3.15, .95, 2), P(3, 2.3, 3.15, .95, 2), P(4, 0, -3.15, 3.25, 2)] });
const gDpak = () => ({ body: [Rc(-3.3, -3.8, 6.6, 6.1, .1)], marks: [], pins: [P(1, -2.28, 4.1, 1.1, 1.8), P(2, 0, -1.6, 5.8, 6.2), P(3, 2.28, 4.1, 1.1, 1.8)] });
const gTo92 = () => ({ body: [Pa('M-1.79 1.6A2.4 2.4 0 1 1 1.79 1.6Z', [-2.4, -2.4, 2.4, 1.6])], marks: [], pins: [P(1, -1.27, 0, 1.05, 1.5, 'rect', .6), P(2, 0, 0, 1.05, 1.5, 'oval', .6), P(3, 1.27, 0, 1.05, 1.5, 'oval', .6)] });
const gTo220 = () => ({ body: [Rc(-5.1, -3.4, 10.2, 4.6, .1)], marks: [Pa('M-5.1 -2.1H5.1')], pins: [P(1, -2.54, 0, 1.9, 2.6, 'rect', 1.1), P(2, 0, 0, 1.9, 2.6, 'oval', 1.1), P(3, 2.54, 0, 1.9, 2.6, 'oval', 1.1)] });
function gDip(N, W) {
  const n = N / 2, pins = [], y0 = -(n - 1) / 2 * 2.54;
  for (let i = 0; i < n; i++) { pins.push(P(i + 1, -W / 2, y0 + i * 2.54, 1.6, 1.6, i ? 'circle' : 'rect', .8)); pins.push(P(N - i, W / 2, y0 + i * 2.54, 1.6, 1.6, 'circle', .8)); }
  pins.sort(byId);
  const bw = W - 1.27, bh = n * 2.54 + .3;
  return { body: [Rc(-bw / 2, -bh / 2, bw, bh, .2)], marks: [Pa(`M-.9 ${f2(-bh / 2)}A.9 .9 0 0 0 .9 ${f2(-bh / 2)}`)], pins };
}
function gSop(N, bw, pitch, pl, pwid) {
  const n = N / 2, pc = bw / 2 + pl / 2 + .05, pins = [], y0 = -(n - 1) / 2 * pitch;
  for (let i = 0; i < n; i++) { pins.push(P(i + 1, -pc, y0 + i * pitch, pl, pwid)); pins.push(P(N - i, pc, y0 + i * pitch, pl, pwid)); }
  pins.sort(byId);
  const bh = n * pitch - .2 + (pitch < 1 ? .6 : 0);
  return { body: [Rc(-bw / 2, -bh / 2, bw, bh, .1)], marks: [Dt(-bw / 2 + .6, -bh / 2 + .6, .28)], pins };
}
function gQuad(N, pitch, kind, ep, bodyO) {
  const n = Math.max(1, Math.round(N / 4));
  const B = bodyO > 0 ? bodyO : (kind === 'qfn' ? n * pitch + 1 : n * pitch + 1.2);
  const pl = kind === 'qfn' ? .8 : 1.5, pw = pitch * .55, pc = kind === 'qfn' ? B / 2 - .25 : B / 2 + .75;
  const off = k => (k - (n - 1) / 2) * pitch, pins = [];
  for (let k = 0; k < n; k++) {
    pins.push(P(1 + k, -pc, off(k), pl, pw));
    pins.push(P(1 + n + k, off(k), pc, pw, pl));
    pins.push(P(1 + 2 * n + k, pc, -off(k), pl, pw));
    pins.push(P(1 + 3 * n + k, -off(k), -pc, pw, pl));
  }
  pins.sort(byId);
  if (kind === 'qfn' && ep === 'jah') pins.push(P(4 * n + 1, 0, 0, B * .55, B * .55, 'rect', 0, 'EP'));
  return { body: [Rc(-B / 2, -B / 2, B, B, .15)], marks: [Dt(-B / 2 + .8, -B / 2 + .8, .35)], pins };
}
function gHdr1(N, pitch) {
  const pd = pitch * .68, dr = pitch * .4, pins = [];
  for (let i = 0; i < N; i++) pins.push(P(i + 1, (i - (N - 1) / 2) * pitch, 0, pd, pd, i ? 'circle' : 'rect', dr));
  return { body: [Rc(-N * pitch / 2, -pitch / 2, N * pitch, pitch)], marks: [], pins };
}
function gHdr2(n, pitch) {
  const pd = pitch * .68, dr = pitch * .4, pins = [];
  for (let i = 0; i < n; i++) { const x = (i - (n - 1) / 2) * pitch; pins.push(P(2 * i + 1, x, pitch / 2, pd, pd, i ? 'circle' : 'rect', dr)); pins.push(P(2 * i + 2, x, -pitch / 2, pd, pd, 'circle', dr)); }
  pins.sort(byId);
  return { body: [Rc(-n * pitch / 2, -pitch, n * pitch, 2 * pitch)], marks: [], pins };
}
const JST = { 'XH 2.5': { p: 2.5, pd: 1.7, dr: 1, ex: 4.9, h: 5.75, y0: -3.4 }, 'PH 2.0': { p: 2, pd: 1.2, dr: .7, ex: 3.9, h: 4.5, y0: -2.7 }, 'SH 1.0': { p: 1, smd: 1 } };
function gJst(series, N) {
  const s = JST[series] || JST['XH 2.5'], pins = [];
  if (s.smd) {
    for (let i = 0; i < N; i++) pins.push(P(i + 1, (i - (N - 1) / 2) * s.p, -1.6, .6, 1.55));
    const mx = (N - 1) / 2 * s.p + 1.35;
    pins.push(P('MP1', -mx, 1.2, 1.2, 1.8, 'rect', 0, 'MP'), P('MP2', mx, 1.2, 1.2, 1.8, 'rect', 0, 'MP'));
    const w = (N - 1) * s.p + 3.6;
    return { body: [Rc(-w / 2, -.9, w, 3.2, .2)], marks: [], pins };
  }
  for (let i = 0; i < N; i++) pins.push(P(i + 1, (i - (N - 1) / 2) * s.p, 0, s.pd, s.pd, i ? 'circle' : 'rect', s.dr));
  const w = (N - 1) * s.p + s.ex;
  return { body: [Rc(-w / 2, s.y0, w, s.h, .2)], marks: [], pins };
}
function gTerm(N, pitch) {
  const pd = pitch * .52, dr = pitch * .26, pins = [], marks = [];
  for (let i = 0; i < N; i++) { const x = (i - (N - 1) / 2) * pitch; pins.push(P(i + 1, x, 0, pd, pd, i ? 'circle' : 'rect', dr)); marks.push(Ci(x, -pitch * .62, pitch * .28)); }
  return { body: [Rc(-N * pitch / 2, -pitch * 1.05, N * pitch, pitch * 1.6, .2)], marks, pins };
}
function gUsbC() {
  const L = [['A1B12', 'GND', -3.2, .6], ['A4B9', 'VBUS', -2.4, .6], ['B8', 'SBU2', -1.75, .3], ['A5', 'CC1', -1.25, .3], ['B7', 'D−', -.75, .3], ['A6', 'D+', -.25, .3], ['A7', 'D−', .25, .3], ['B6', 'D+', .75, .3], ['A8', 'SBU1', 1.25, .3], ['B5', 'CC2', 1.75, .3], ['B4A9', 'VBUS', 2.4, .6], ['B1A12', 'GND', 3.2, .6]];
  const pins = L.map(([id, n, x, w]) => P(id, x, -3.85, w, 1.15, 'rect', 0, n));
  pins.push(P('S1', -4.32, -2.9, .9, 2, 'oval', .6, 'SHIELD'), P('S2', 4.32, -2.9, .9, 2, 'oval', .6, 'SHIELD'), P('S3', -4.32, 1.1, .9, 1.7, 'oval', .6, 'SHIELD'), P('S4', 4.32, 1.1, .9, 1.7, 'oval', .6, 'SHIELD'));
  return { body: [Rc(-4.47, -3.15, 8.94, 7.3, .6)], marks: [Pa('M-3.6 3.5H3.6')], pins };
}
function gMicroUsb() {
  const pins = ['VBUS', 'D−', 'D+', 'ID', 'GND'].map((n, i) => P(i + 1, (i - 2) * .65, -2.7, .4, 1.35, 'rect', 0, n));
  pins.push(P('S1', -3.1, -2.45, 1.6, 1.4, 'rect', 0, 'SHIELD'), P('S2', 3.1, -2.45, 1.6, 1.4, 'rect', 0, 'SHIELD'), P('S3', -1.2, 0, 1.9, 1.9, 'rect', 0, 'SHIELD'), P('S4', 1.2, 0, 1.9, 1.9, 'rect', 0, 'SHIELD'));
  return { body: [Rc(-3.75, -2.2, 7.5, 5, .3)], marks: [Pa('M-3.75 2.1H3.75')], pins };
}
const gDcJack = () => ({ body: [Rc(-4.5, -6.6, 9, 14.4, .5)], marks: [Ci(0, 4.2, 2.3)], pins: [P(1, 0, -5.2, 3.2, 1.6, 'oval', 1, '+'), P(2, 0, .8, 3.2, 1.6, 'oval', 1, '−'), P(3, 4.5, -2.2, 1.6, 3.2, 'oval', 1, 'SW')] });
const gXtal = () => ({ body: [Rc(-5.5, -2.33, 11, 4.65, 2.3)], marks: [], pins: [P(1, -2.44, 0, 1.5, 1.5, 'circle', .8), P(2, 2.44, 0, 1.5, 1.5, 'circle', .8)] });
const gXtalSmd = () => ({ body: [Rc(-1.6, -1.25, 3.2, 2.5, .1)], marks: [Dt(-1.9, 1.5, .18)], pins: [P(1, -1.1, .85, 1.4, 1.15), P(2, 1.1, .85, 1.4, 1.15), P(3, 1.1, -.85, 1.4, 1.15), P(4, -1.1, -.85, 1.4, 1.15)] });
const gBtn = () => ({ body: [Rc(-3, -3, 6, 6, .4)], marks: [Ci(0, 0, 1.75)], pins: [P(1, -3.25, -2.25, 2, 2, 'circle', 1), P(2, 3.25, -2.25, 2, 2, 'circle', 1), P(3, -3.25, 2.25, 2, 2, 'circle', 1), P(4, 3.25, 2.25, 2, 2, 'circle', 1)] });
const gPot = () => ({ body: [Rc(-3.3, -3.6, 6.6, 7, .4)], marks: [Ci(0, -.8, 2.3), Pa('M-1.2 -.8H1.2')], pins: [P(1, -2.54, 2.3, 1.6, 1.6, 'rect', .8), P(2, 0, 2.3, 1.6, 1.6, 'circle', .8, 'W'), P(3, 2.54, 2.3, 1.6, 1.6, 'circle', .8)] });
function gCustom(layout, N, pitch, w, h) {
  N = Math.max(0, Math.round(N)); const pins = [], pd = Math.min(pitch * .6, 1.6);
  if (layout === '1 rida') for (let i = 0; i < N; i++) pins.push(P(i + 1, (i - (N - 1) / 2) * pitch, 0, pd, pd, i ? 'circle' : 'rect'));
  else if (layout === '2 rida') {
    const n = Math.ceil(N / 2), y0 = -(n - 1) / 2 * pitch;
    for (let i = 0; i < n; i++) pins.push(P(i + 1, -w / 2, y0 + i * pitch, pd, pd, i ? 'circle' : 'rect'));
    for (let i = 0; i < N - n; i++) pins.push(P(n + i + 1, w / 2, y0 + (n - 1 - i) * pitch, pd, pd, 'circle'));
  } else if (layout === '4 külge') {
    const n = Math.max(1, Math.ceil(N / 4)), off = k => (k - (n - 1) / 2) * pitch;
    const pos = [k => [-w / 2, off(k)], k => [off(k), h / 2], k => [w / 2, -off(k)], k => [-off(k), -h / 2]];
    for (let i = 0; i < N; i++) { const [x, y] = pos[Math.floor(i / n) % 4](i % n); pins.push(P(i + 1, x, y, pd, pd, i ? 'circle' : 'rect')); }
  }
  return { body: [Rc(-w / 2, -h / 2, w, h, .3)], marks: N ? [Dt(-w / 2 + .9, -h / 2 + .9, .3)] : [], pins };
}

/* ---- library ---- */
const SZ = ['0402', '0603', '0805', '1206', '1210', '2010', '2512'];
const pSel = (k, l, o, d) => ({ k, l, o, d });
const pNum = (k, l, min, max, step, d) => ({ k, l, n: [min, max, step], d });
const LIB = [
  { key: 'r_smd', cat: 'pass', name: 'Takisti SMD', prefix: 'R', value: '10k', kw: 'resistor chip', params: [pSel('size', 'Korpus', SZ, '0805')], gen: p => gChip(CHIP, p.size) },
  { key: 'c_smd', cat: 'pass', name: 'Kondensaator SMD', prefix: 'C', value: '100n', kw: 'capacitor mlcc', params: [pSel('size', 'Korpus', SZ, '0805')], gen: p => gChip(CHIP, p.size) },
  { key: 'l_smd', cat: 'pass', name: 'Induktiivsus SMD', prefix: 'L', value: '10µH', kw: 'inductor drossel', params: [pSel('size', 'Korpus', SZ, '1210')], gen: p => gChip(CHIP, p.size) },
  { key: 'f_smd', cat: 'pass', name: 'Kaitse SMD', prefix: 'F', value: '1A', kw: 'fuse sulavkaitse', params: [pSel('size', 'Korpus', SZ, '1206')], gen: p => gChip(CHIP, p.size) },
  { key: 'c_tant', cat: 'pass', name: 'Tantaal SMD', prefix: 'C', value: '10µ', kw: 'tantalum', params: [pSel('case', 'Korpus', ['A', 'B', 'C', 'D'], 'B')], gen: p => gChip(TANT, p.case, { polar: true, n1: '+', n2: '−' }) },
  { key: 'c_elsmd', cat: 'pass', name: 'Elektrolüüt SMD', prefix: 'C', value: '100µ', kw: 'electrolytic', params: [pSel('D', 'Läbimõõt', ['4', '5', '6.3', '8', '10'], '6.3')], gen: p => gElSmd(+p.D) },
  { key: 'r_tht', cat: 'pass', name: 'Takisti THT', prefix: 'R', value: '10k', kw: 'resistor axial', params: [pSel('pitch', 'Samm', ['7.62', '10.16', '12.7'], '10.16')], gen: p => gAxial(+p.pitch, 6.3, 2.5) },
  { key: 'c_disc', cat: 'pass', name: 'Kondensaator THT', prefix: 'C', value: '100n', kw: 'ceramic disc', params: [pSel('pitch', 'Samm', ['2.54', '5.08'], '5.08')], gen: p => gDisc(+p.pitch) },
  { key: 'c_el', cat: 'pass', name: 'Elektrolüüt THT', prefix: 'C', value: '100µ', kw: 'electrolytic radial', params: [pSel('D', 'Läbimõõt', ['5', '6.3', '8', '10', '13'], '6.3'), pSel('pitch', 'Samm', ['2', '2.5', '3.5', '5'], '2.5')], gen: p => gRadial(+p.D, +p.pitch) },
  { key: 'd_smd', cat: 'semi', name: 'Diood SMD', prefix: 'D', value: '', kw: 'diode schottky', params: [pSel('case', 'Korpus', Object.keys(DIO), 'SOD-123')], gen: p => gChip(DIO, p.case, { polar: true, n1: 'K', n2: 'A' }) },
  { key: 'd_tht', cat: 'semi', name: 'Diood THT', prefix: 'D', value: '1N4007', kw: 'diode do-41', params: [], gen: () => gAxial(10.16, 5.2, 2.7, { band: true, sq: true, n1: 'K', n2: 'A', pd: 2, dr: 1 }) },
  { key: 'led_smd', cat: 'semi', name: 'LED SMD', prefix: 'D', value: '', kw: 'led', params: [pSel('size', 'Korpus', ['0603', '0805', '1206'], '0805')], gen: p => gChip(CHIP, p.size, { polar: true, n1: 'K', n2: 'A' }) },
  { key: 'led_tht', cat: 'semi', name: 'LED THT', prefix: 'D', value: '', kw: 'led', params: [pSel('D', 'Läbimõõt', ['3', '5'], '5')], gen: p => gLedTht(+p.D) },
  { key: 'sot23', cat: 'semi', name: 'SOT-23', prefix: 'Q', value: '', kw: 'transistor mosfet', params: [pSel('pins', 'Jalgu', ['3', '5', '6'], '3')], gen: p => gSot23(+p.pins) },
  { key: 'sot223', cat: 'semi', name: 'SOT-223', prefix: 'U', value: '', kw: 'regulator', params: [], gen: gSot223 },
  { key: 'dpak', cat: 'semi', name: 'DPAK', prefix: 'Q', value: '', kw: 'to-252 mosfet', params: [], gen: gDpak },
  { key: 'to92', cat: 'semi', name: 'TO-92', prefix: 'Q', value: '', kw: 'transistor', params: [], gen: gTo92 },
  { key: 'to220', cat: 'semi', name: 'TO-220', prefix: 'U', value: '', kw: 'regulator mosfet', params: [], gen: gTo220 },
  { key: 'soic', cat: 'ic', name: 'SOIC', prefix: 'U', value: '', kw: 'so ic', params: [pSel('pins', 'Jalgu', ['8', '14', '16', '20', '24', '28'], '8'), pSel('body', 'Kere laius', ['3.9', '7.5'], '3.9')], gen: p => gSop(+p.pins, +p.body, 1.27, 1.55, .6) },
  { key: 'tssop', cat: 'ic', name: 'TSSOP / MSOP', prefix: 'U', value: '', kw: 'ic', params: [pSel('pins', 'Jalgu', ['8', '10', '14', '16', '20', '24', '28'], '14'), pSel('pitch', 'Samm', ['0.65', '0.5'], '0.65')], gen: p => gSop(+p.pins, +p.pitch < .6 ? 3 : 4.4, +p.pitch, 1.4, +p.pitch * .6) },
  { key: 'dip', cat: 'ic', name: 'DIP', prefix: 'U', value: '', kw: 'ic tht', params: [pSel('pins', 'Jalgu', ['4', '6', '8', '14', '16', '18', '20', '24', '28', '40'], '8'), pSel('row', 'Ridade vahe', ['7.62', '15.24'], '7.62')], gen: p => gDip(+p.pins, +p.row) },
  { key: 'qfp', cat: 'ic', name: 'QFP', prefix: 'U', value: '', kw: 'lqfp tqfp mcu', params: [pSel('pins', 'Jalgu', ['32', '44', '48', '64', '80', '100'], '44'), pSel('pitch', 'Samm', ['0.8', '0.65', '0.5'], '0.8'), pNum('body', 'Kere (mm, 0 = auto)', 0, 40, .1, 0)], gen: p => gQuad(+p.pins, +p.pitch, 'qfp', '', +p.body) },
  { key: 'qfn', cat: 'ic', name: 'QFN', prefix: 'U', value: '', kw: 'dfn mlf', params: [pSel('pins', 'Jalgu', ['16', '20', '24', '28', '32', '48', '64'], '32'), pSel('pitch', 'Samm', ['0.65', '0.5', '0.4'], '0.5'), pSel('ep', 'Keskpadi', ['jah', 'ei'], 'jah'), pNum('body', 'Kere (mm, 0 = auto)', 0, 20, .1, 0)], gen: p => gQuad(+p.pins, +p.pitch, 'qfn', p.ep, +p.body) },
  { key: 'hdr1', cat: 'conn', name: 'Pinnirida 1×N', prefix: 'J', value: '', kw: 'header pin', params: [pNum('pins', 'Jalgu', 1, 40, 1, 4), pSel('pitch', 'Samm', ['2.54', '2.0', '1.27'], '2.54')], gen: p => gHdr1(Math.round(+p.pins), +p.pitch) },
  { key: 'hdr2', cat: 'conn', name: 'Pinnirida 2×N', prefix: 'J', value: '', kw: 'header idc', params: [pNum('pins', 'Paare', 1, 40, 1, 5), pSel('pitch', 'Samm', ['2.54', '2.0', '1.27'], '2.54')], gen: p => gHdr2(Math.round(+p.pins), +p.pitch) },
  { key: 'jst', cat: 'conn', name: 'JST pistik', prefix: 'J', value: '', kw: 'xh ph sh connector', params: [pSel('series', 'Seeria', Object.keys(JST), 'XH 2.5'), pNum('pins', 'Jalgu', 1, 16, 1, 3)], gen: p => gJst(p.series, Math.round(+p.pins)) },
  { key: 'term', cat: 'conn', name: 'Kruviklemm', prefix: 'J', value: '', kw: 'terminal block', params: [pNum('pins', 'Jalgu', 1, 12, 1, 2), pSel('pitch', 'Samm', ['5.0', '5.08', '3.5'], '5.0')], gen: p => gTerm(Math.round(+p.pins), +p.pitch) },
  { key: 'usbc', cat: 'conn', name: 'USB-C', prefix: 'J', value: 'USB-C', kw: 'type-c usb', params: [], gen: gUsbC },
  { key: 'musb', cat: 'conn', name: 'Micro-USB', prefix: 'J', value: 'micro-USB', kw: 'usb', params: [], gen: gMicroUsb },
  { key: 'dcjack', cat: 'conn', name: 'Toitepesa DC', prefix: 'J', value: '', kw: 'barrel jack power', params: [], gen: gDcJack },
  { key: 'xtal', cat: 'misc', name: 'Kvarts HC-49', prefix: 'Y', value: '16MHz', kw: 'crystal', params: [], gen: gXtal },
  { key: 'xtal_smd', cat: 'misc', name: 'Kvarts SMD', prefix: 'Y', value: '16MHz', kw: 'crystal 3225', params: [], gen: gXtalSmd },
  { key: 'btn', cat: 'misc', name: 'Nupp 6×6', prefix: 'SW', value: '', kw: 'button switch tact', params: [], gen: gBtn },
  { key: 'pot', cat: 'misc', name: 'Trimmer', prefix: 'RV', value: '10k', kw: 'potentiometer', params: [], gen: gPot },
  { key: 'custom', cat: 'misc', name: 'Kohandatud', prefix: 'U', value: '', kw: 'generic custom moodul', params: [pSel('layout', 'Jalgade paigutus', ['2 rida', '1 rida', '4 külge', 'tühi'], '2 rida'), pNum('pins', 'Jalgu', 0, 200, 1, 8), pNum('pitch', 'Samm (mm)', .3, 10, .01, 2.54), pNum('w', 'Laius (mm)', 1, 200, .1, 8), pNum('h', 'Kõrgus (mm)', 1, 200, .1, 10)], gen: p => gCustom(p.layout, +p.pins, +p.pitch, +p.w, +p.h) },
  { key: 'tp', cat: 'point', name: 'Testpunkt', prefix: 'TP', value: '', kw: 'test point', params: [], gen: () => ({ body: [], marks: [Ci(0, 0, 1.15)], pins: [P(1, 0, 0, 1.5, 1.5, 'circle')] }) },
  { key: 'via', cat: 'point', name: 'Via', prefix: 'V', value: '', kw: 'via läbiviik', params: [], gen: () => ({ body: [], marks: [], pins: [P(1, 0, 0, .7, .7, 'circle', .35)] }) },
  { key: 'pad', cat: 'point', name: 'Kontaktpadi', prefix: 'P', value: '', kw: 'pad', params: [pSel('shape', 'Kuju', ['ümar', 'nelinurk'], 'ümar'), pNum('size', 'Suurus (mm)', .2, 20, .1, 1.6)], gen: p => ({ body: [], marks: [], pins: [P(1, 0, 0, +p.size, +p.size, p.shape === 'nelinurk' ? 'rect' : 'circle')] }) },
  { key: 'wire', cat: 'point', name: 'Juhtme jootekoht', prefix: 'W', value: '', kw: 'wire juhe', params: [], gen: () => ({ body: [], marks: [], pins: [P(1, 0, 0, 2, 2, 'circle', 1)] }) },
  { key: 'hole', cat: 'point', name: 'Kinnitusava', prefix: 'H', value: '', kw: 'mounting hole', params: [pSel('D', 'Ava', ['2.2', '3.2', '4.3'], '3.2')], gen: p => ({ body: [], marks: [], pins: [P(1, 0, 0, +p.D * 1.8, +p.D * 1.8, 'circle', +p.D)] }) },
];
const DEF = Object.fromEntries(LIB.map(d => [d.key, d]));
const CATS = [['pass', 'Passiivsed'], ['semi', 'Pooljuhid'], ['ic', 'Mikroskeemid'], ['conn', 'Konnektorid'], ['misc', 'Muud'], ['point', 'Punktid plaadil']];
const POINT_TYPES = [['tp', 'Testpunkt'], ['via', 'Via'], ['pad', 'Padi'], ['wire', 'Juhe'], ['hole', 'Ava']];

const defaultParams = def => Object.fromEntries((def.params || []).map(p => [p.k, p.d]));
function bboxOf(f) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (a, b, c, d) => { x0 = Math.min(x0, a); y0 = Math.min(y0, b); x1 = Math.max(x1, c); y1 = Math.max(y1, d); };
  for (const s of [...f.body, ...f.marks]) {
    if (s.t === 'rect') add(s.x, s.y, s.x + s.w, s.y + s.h);
    else if (s.t === 'circle') add(s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r);
    else if (s.t === 'path' && s.bb) add(...s.bb);
  }
  for (const p of f.pins) add(p.x - p.w / 2, p.y - p.h / 2, p.x + p.w / 2, p.y + p.h / 2);
  if (!isFinite(x0)) { x0 = y0 = -1; x1 = y1 = 1; }
  return { x0, y0, x1, y1 };
}
const fpCache = new Map();
function baseFP(type, params) {
  const key = type + '|' + JSON.stringify(params || {});
  let f = fpCache.get(key);
  if (!f) {
    const def = DEF[type] || DEF.custom;
    f = def.gen({ ...defaultParams(def), ...(params || {}) });
    f.bbox = bboxOf(f);
    f.svg = fpShapes(f);
    fpCache.set(key, f);
  }
  return f;
}
function shapeSVG(s, cls) {
  const c = cls ? ` class="${cls}"` : '';
  if (s.t === 'rect') return `<rect${c} x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.r || 0}"/>`;
  if (s.t === 'circle') return `<circle${c} cx="${s.x}" cy="${s.y}" r="${s.r}"/>`;
  if (s.t === 'dot') return `<circle class="dot" cx="${s.x}" cy="${s.y}" r="${s.r}"/>`;
  return `<path${c} d="${s.d}"/>`;
}
function fpShapes(f) {
  const body = f.body.map(s => shapeSVG(s)).join('');
  const marks = f.marks.map(s => shapeSVG(s)).join('');
  const haloMarks = f.marks.filter(s => s.t !== 'dot').map(s => shapeSVG(s)).join('');
  return { halo: `<g class="fp-halo">${body}${haloMarks}</g>`, body: `<g class="fp-body">${body}</g><g class="fp-marks">${marks}</g>` };
}
function padSVG(p, cls, attrs = '') {
  if (p.shape === 'circle') return `<circle class="${cls}" cx="${p.x}" cy="${p.y}" r="${f2(p.w / 2)}"${attrs}/>`;
  if (p.shape === 'oval' && Math.abs(p.w - p.h) < 1e-6) return `<circle class="${cls}" cx="${p.x}" cy="${p.y}" r="${f2(p.w / 2)}"${attrs}/>`;
  const rx = p.shape === 'oval' ? Math.min(p.w, p.h) / 2 : Math.min(p.w, p.h) * .14;
  return `<rect class="${cls}" x="${f2(p.x - p.w / 2)}" y="${f2(p.y - p.h / 2)}" width="${p.w}" height="${p.h}" rx="${f2(rx)}"${attrs}/>`;
}
const thumbCache = {};
function thumb(def) {
  if (thumbCache[def.key]) return thumbCache[def.key];
  const f = baseFP(def.key, defaultParams(def)), b = f.bbox;
  const m = Math.max(b.x1 - b.x0, b.y1 - b.y0) * .1 + .25;
  const vb = `${f2(b.x0 - m)} ${f2(b.y0 - m)} ${f2(b.x1 - b.x0 + 2 * m)} ${f2(b.y1 - b.y0 + 2 * m)}`;
  const pads = f.pins.map(p => padSVG(p, 'pad') + (p.drill ? `<circle class="drill" cx="${p.x}" cy="${p.y}" r="${f2(p.drill / 2)}"/>` : '')).join('');
  return (thumbCache[def.key] = `<svg class="thumb" viewBox="${vb}" aria-hidden="true">${f.svg.body}${pads}</svg>`);
}
function fpLabel(c) {
  const def = DEF[c.type]; if (!def) return c.type;
  const p = { ...defaultParams(def), ...(c.params || {}) };
  switch (c.type) {
    case 'soic': case 'tssop': case 'dip': case 'qfp': case 'qfn': return `${def.name.split(' ')[0]}-${p.pins}`;
    case 'sot23': return p.pins === '3' ? 'SOT-23' : `SOT-23-${p.pins}`;
    case 'hdr1': return `${p.pins}×1 · ${p.pitch}`;
    case 'hdr2': return `${p.pins}×2 · ${p.pitch}`;
    case 'jst': return `JST ${p.series.split(' ')[0]} ${p.pins}p`;
    case 'term': return `Klemm ${p.pins}p · ${p.pitch}`;
    case 'custom': return `Kohandatud ${p.w}×${p.h}`;
    default: {
      const v = p.size || p.case || (p.D ? 'Ø' + p.D : '') || p.pitch;
      return v ? `${def.name} ${v}` : def.name;
    }
  }
}
