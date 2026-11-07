/* ================= document & UI state ================= */
const newDoc = () => ({ name: 'Uus plaat', ppm: 10, calibrated: false, calib: null, comps: [], traces: [], dims: [], outlines: [], nextId: 1, sample: false });
let doc = newDoc();
let img = null; // {src, w, h, name}
const DEFAULT_LAYERS = { img: true, body: true, pads: true, top: true, bottom: true, wire: true, dims: true, labels: true, pinl: true };
const ui = { opacity: .85, gray: false, contrast: 1, layers: { ...DEFAULT_LAYERS }, netColors: false, bannerOff: false };
const view = { x: 0, y: 0, z: 1 };
const S = {
  tool: 'select', step: 'place', tab: 'lib', placeType: null, placeRot: 0, pointType: 'via',
  traceLayer: 'top', traceW: .4, pinSize: 0,
  sel: new Set(), selPin: null, hover: null, snap: null, hlNet: null, hlPinned: null,
  draft: null, drag: null, mouse: [0, 0], shift: false, spaceDown: false,
  libQ: '', boardQ: '', exported: false, exPhoto: false
};
const uid = p => p + (doc.nextId++);
const kindOf = id => ({ c: 'comp', t: 'trace', d: 'dim', o: 'outline' })[String(id)[0]];
const isPoint = c => DEF[c.type]?.cat === 'point';
const isConn = c => DEF[c.type]?.cat === 'conn';

/* ---- geometry caches ---- */
let geoV = 1;
const touch = () => { geoV++; };
const fpMemo = new WeakMap();
function compFP(c) {
  const m = fpMemo.get(c);
  if (m && m.v === geoV) return m.fp;
  const b = baseFP(c.type, c.params);
  const pins = b.pins.map(p => (c.pn && c.pn[p.id] != null) ? { ...p, name: c.pn[p.id] } : p);
  for (const e of (c.extra || [])) pins.push({ id: e.id, x: e.x, y: e.y, w: e.d, h: e.d, shape: e.shape || 'circle', drill: e.drill || 0, name: (c.pn && c.pn[e.id]) || '', extra: true });
  let bbox = b.bbox;
  if (c.extra && c.extra.length) {
    bbox = { ...bbox };
    for (const p of pins) { bbox.x0 = Math.min(bbox.x0, p.x - p.w / 2); bbox.y0 = Math.min(bbox.y0, p.y - p.h / 2); bbox.x1 = Math.max(bbox.x1, p.x + p.w / 2); bbox.y1 = Math.max(bbox.y1, p.y + p.h / 2); }
  }
  const fp = { body: b.body, marks: b.marks, svg: b.svg, pins, bbox, pinMap: new Map(pins.map(p => [p.id, p])) };
  fpMemo.set(c, { v: geoV, fp });
  return fp;
}
let cmapV = 0, cmap = new Map();
function compById(id) { if (cmapV !== geoV) { cmap = new Map(doc.comps.map(c => [c.id, c])); cmapV = geoV; } return cmap.get(id); }
function anyById(id) {
  const k = kindOf(id);
  if (k === 'comp') return compById(id);
  if (k === 'trace') return doc.traces.find(t => t.id === id);
  if (k === 'dim') return doc.dims.find(d => d.id === id);
  if (k === 'outline') return doc.outlines.find(o => o.id === id);
}
function l2w(c, lx, ly) {
  const x = c.side === 'bottom' ? -lx : lx, a = c.rot * DEG, co = Math.cos(a), si = Math.sin(a), k = doc.ppm;
  return [c.x + (x * co - ly * si) * k, c.y + (x * si + ly * co) * k];
}
function w2l(c, wx, wy) {
  const dx = (wx - c.x) / doc.ppm, dy = (wy - c.y) / doc.ppm, a = -c.rot * DEG, co = Math.cos(a), si = Math.sin(a);
  let x = dx * co - dy * si; const y = dx * si + dy * co;
  if (c.side === 'bottom') x = -x;
  return [x, y];
}
const compTransform = c => `translate(${f2(c.x)} ${f2(c.y)}) rotate(${f2(c.rot)}) scale(${f2((c.side === 'bottom' ? -1 : 1) * doc.ppm)} ${f2(doc.ppm)})`;
let pidxV = 0, pidx = [];
function pinIndex() {
  if (pidxV !== geoV) {
    pidx = [];
    for (const c of doc.comps) { const f = compFP(c); for (const p of f.pins) { const [x, y] = l2w(c, p.x, p.y); pidx.push({ c, p, x, y, r: Math.max(p.w, p.h) / 2 * doc.ppm }); } }
    pidxV = geoV;
  }
  return pidx;
}
function pinWorld(cid, pid) { const c = compById(cid); if (!c) return null; const p = compFP(c).pinMap.get(pid); return p ? l2w(c, p.x, p.y) : null; }
function epPos(ep) { if (ep.c) { const q = pinWorld(ep.c, ep.p); if (q) return q; } return [ep.x, ep.y]; }
const tracePts = t => [epPos(t.a), ...t.pts, epPos(t.b)];
function refreshEndpoints() {
  const fix = ep => { const q = epPos(ep); ep.x = f2(q[0]); ep.y = f2(q[1]); if (ep.c && !pinWorld(ep.c, ep.p)) { delete ep.c; delete ep.p; } };
  for (const t of doc.traces) { fix(t.a); fix(t.b); }
  for (const d of doc.dims) { fix(d.a); fix(d.b); }
}
const origin = () => doc.outlines[0] ? [doc.outlines[0].x, doc.outlines[0].y] : [0, 0];
const toMM = ([x, y]) => { const [ox, oy] = origin(); return [(x - ox) / doc.ppm, (y - oy) / doc.ppm]; };
const pinLabel = (cid, pid) => { const c = compById(cid); return (c ? c.ref : '?') + '.' + pid; };

/* ---- nets ---- */
const NET_PAL = ['#e0532f', '#2f74e0', '#1f9e6e', '#c0399b', '#d99a12', '#7a55d6', '#0f9fb5', '#a8562a', '#5f8f1f', '#d1446d', '#3c63a8', '#8c7a2a'];
let netsV = 0, netsCache = null;
function getNets() {
  if (netsV === geoV && netsCache) return netsCache;
  const parent = new Map();
  const add = k => { if (!parent.has(k)) parent.set(k, k); };
  const find = k => { let r = k; while (parent.get(r) !== r) r = parent.get(r); while (parent.get(k) !== r) { const n = parent.get(k); parent.set(k, r); k = n; } return r; };
  const uni = (a, b) => { add(a); add(b); const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  const polys = doc.traces.map(t => ({ t, pts: tracePts(t) }));
  for (const { t } of polys) {
    add('t:' + t.id);
    if (t.a.c) uni('t:' + t.id, 'p:' + t.a.c + ':' + t.a.p);
    if (t.b.c) uni('t:' + t.id, 'p:' + t.b.c + ':' + t.b.p);
  }
  const tol = Math.max(1.5, .25 * doc.ppm), pins = pinIndex();
  for (const A of polys) for (const end of ['a', 'b']) {
    if (A.t[end].c) continue;
    const q = end === 'a' ? A.pts[0] : A.pts[A.pts.length - 1];
    for (const B of polys) if (B !== A && nearestOnPoly(q, B.pts).d <= tol + B.t.w * doc.ppm / 2) uni('t:' + A.t.id, 't:' + B.t.id);
    for (const pi of pins) if (dist(q, [pi.x, pi.y]) <= Math.max(pi.r, tol)) uni('t:' + A.t.id, 'p:' + pi.c.id + ':' + pi.p.id);
  }
  const groups = new Map();
  for (const k of parent.keys()) {
    const r = find(k);
    if (!groups.has(r)) groups.set(r, { traces: [], pins: [] });
    const g = groups.get(r);
    if (k[0] === 't') g.traces.push(k.slice(2));
    else { const i = k.indexOf(':', 2); g.pins.push({ c: k.slice(2, i), p: k.slice(i + 1) }); }
  }
  const tnum = id => parseInt(id.slice(1), 10) || 0;
  const list = [];
  for (const g of groups.values()) {
    if (!g.traces.length) continue;
    g.traces.sort((a, b) => tnum(a) - tnum(b));
    const ts = g.traces.map(id => doc.traces.find(t => t.id === id));
    const named = ts.find(t => t.net);
    const len = polys.filter(P => g.traces.includes(P.t.id)).reduce((s, P) => s + polyLen(P.pts), 0) / doc.ppm;
    const pinsSorted = g.pins.filter(p => compById(p.c)).sort((a, b) => pinLabel(a.c, a.p).localeCompare(pinLabel(b.c, b.p), 'et', { numeric: true }));
    list.push({ key: g.traces[0], name: named ? named.net : '', named: !!named, traces: g.traces, pins: pinsSorted, len });
  }
  list.sort((a, b) => tnum(a.key) - tnum(b.key));
  let auto = 0;
  for (const n of list) {
    if (!n.named) n.name = 'N' + (++auto);
    const u = n.name.toUpperCase();
    n.color = /^(GND|VSS|0V|AGND|DGND|PGND)/.test(u) ? '#7b8a84' : NET_PAL[(tnum(n.key) * 7) % NET_PAL.length];
  }
  const byTrace = new Map(), byPin = new Map(), byKey = new Map();
  for (const n of list) { byKey.set(n.key, n); n.traces.forEach(t => byTrace.set(t, n)); n.pins.forEach(p => byPin.set(p.c + ':' + p.p, n)); }
  netsCache = { list, byTrace, byPin, byKey };
  netsV = geoV;
  return netsCache;
}

/* ---- history ---- */
const hist = { past: [], future: [] };
const snap = () => JSON.stringify(doc);
function resetHistory() { hist.past = [snap()]; hist.future = []; }
function commit(opts = {}) {
  refreshEndpoints(); touch();
  const s = snap();
  if (hist.past[hist.past.length - 1] !== s) { hist.past.push(s); if (hist.past.length > 200) hist.past.shift(); hist.future.length = 0; }
  if (opts.light) { schedule('scene'); renderSide(); renderSteps(); renderStatus(); } else renderAll();
  queueSave();
}
function revert() { doc = JSON.parse(hist.past[hist.past.length - 1]); touch(); }
function afterSwap() {
  for (const id of [...S.sel]) if (!anyById(id)) S.sel.delete(id);
  if (S.selPin && !pinWorld(S.selPin.c, S.selPin.p)) S.selPin = null;
  touch(); renderAll(); queueSave();
}
function undo() {
  if (S.draft) { S.draft = null; schedule('over'); renderOptbar(); return; }
  if (hist.past.length < 2) { toast('Pole midagi tagasi võtta'); return; }
  hist.future.push(hist.past.pop()); doc = JSON.parse(hist.past[hist.past.length - 1]); afterSwap();
}
function redo() {
  const s = hist.future.pop(); if (!s) return;
  hist.past.push(s); doc = JSON.parse(s); afterSwap();
}

/* ---- persistence (IndexedDB, best effort) ---- */
const IDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      try {
        const r = indexedDB.open('pcb-kaardistaja', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { this.db = r.result; res(r.result); };
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
  },
  async get(k) { const db = await this.open(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); },
  async set(k, v) { const db = await this.open(); return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
};
let saveTimer = 0;
function queueSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { IDB.set('auto', { doc, ui, view: { ...view }, t: Date.now() }).catch(() => {}); }, 600);
}
const saveImage = () => IDB.set('img', img).catch(() => {});

/* ---- object helpers ---- */
function nextRef(prefix) {
  let m = 0; const re = new RegExp('^' + prefix + '(\\d+)$');
  for (const c of doc.comps) { const r = re.exec(c.ref); if (r) m = Math.max(m, +r[1]); }
  return prefix + (m + 1);
}
function addComp(type, x, y, o = {}) {
  const def = DEF[type];
  const c = { id: uid('c'), type, ref: nextRef(def.prefix), value: def.value || '', x: f2(x), y: f2(y), rot: 0, side: 'top', params: defaultParams(def), pn: {}, extra: [], note: '', ...o };
  doc.comps.push(c); touch();
  return c;
}
function nextPinId(c) {
  let m = 0; for (const p of compFP(c).pins) { const v = parseInt(p.id, 10); if (String(v) === p.id) m = Math.max(m, v); }
  return String(m + 1);
}
function freezeRefsTo(pred) {
  for (const t of doc.traces) for (const ep of [t.a, t.b]) if (ep.c && pred(ep)) { const q = epPos(ep); ep.x = f2(q[0]); ep.y = f2(q[1]); delete ep.c; delete ep.p; }
  for (const d of doc.dims) for (const ep of [d.a, d.b]) if (ep.c && pred(ep)) { const q = epPos(ep); ep.x = f2(q[0]); ep.y = f2(q[1]); delete ep.c; delete ep.p; }
}
function deleteSelection() {
  if (!S.sel.size) return;
  const ids = new Set(S.sel), n = ids.size;
  freezeRefsTo(ep => ids.has(ep.c));
  doc.comps = doc.comps.filter(c => !ids.has(c.id));
  doc.traces = doc.traces.filter(t => !ids.has(t.id));
  doc.dims = doc.dims.filter(d => !ids.has(d.id));
  doc.outlines = doc.outlines.filter(o => !ids.has(o.id));
  S.sel.clear(); S.selPin = null;
  commit();
  toast(n === 1 ? 'Kustutatud · Ctrl+Z toob tagasi' : `Kustutatud ${n} objekti · Ctrl+Z toob tagasi`);
}
function deletePin(c, pid) {
  freezeRefsTo(ep => ep.c === c.id && ep.p === pid);
  c.extra = (c.extra || []).filter(e => e.id !== pid);
  if (c.pn) delete c.pn[pid];
  if (S.selPin && S.selPin.c === c.id && S.selPin.p === pid) S.selPin = null;
  commit();
}
function duplicateSelection() {
  const comps = [...S.sel].map(compById).filter(Boolean);
  if (!comps.length) return;
  const off = 2 * doc.ppm; S.sel.clear();
  for (const c of comps) {
    const n = JSON.parse(JSON.stringify(c));
    n.id = uid('c'); n.ref = nextRef(DEF[c.type].prefix); n.x = f2(c.x + off); n.y = f2(c.y + off);
    doc.comps.push(n); touch(); S.sel.add(n.id);
  }
  commit();
}
function rotateSel(d) {
  let any = false;
  for (const id of S.sel) { const c = compById(id); if (c) { c.rot = f2(((c.rot + d) % 360 + 360) % 360); any = true; } }
  if (any) commit({ light: true });
}
function flipSel() {
  let any = false;
  for (const id of S.sel) { const c = compById(id); if (c) { c.side = c.side === 'bottom' ? 'top' : 'bottom'; any = true; } }
  if (any) commit();
}
