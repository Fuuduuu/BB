/* ================= canvas rendering ================= */
const svg = $('#svg'), vp = $('#vp'), gImg = $('#gImg'), gScene = $('#gScene'), gOver = $('#gOver'), wrap = $('#wrap');
const layerVar = l => l === 'bottom' ? 'var(--bottom)' : l === 'wire' ? 'var(--wire)' : 'var(--top)';
let rafId = 0; const dirty = { scene: false, over: false };
function schedule(what) { if (what === 'scene') dirty.scene = true; dirty.over = true; if (!rafId) rafId = requestAnimationFrame(flush); }
function flush() { rafId = 0; if (dirty.scene) renderScene(); if (dirty.over) renderOverlay(); dirty.scene = dirty.over = false; }

function applyView() {
  vp.setAttribute('transform', `translate(${f2(view.x)} ${f2(view.y)}) scale(${view.z})`);
  wrap.style.backgroundPosition = `${f2(view.x)}px ${f2(view.y)}px`;
  const zv = $('#zVal'); if (zv) zv.textContent = Math.round(view.z * 100) + '%';
}
function zoomAt(sx, sy, factor) {
  const nz = clamp(view.z * factor, .02, 80), k = nz / view.z;
  view.x = sx - (sx - view.x) * k; view.y = sy - (sy - view.y) * k; view.z = nz;
  applyView(); schedule('scene'); queueSave();
}
function contentBounds() {
  if (img) return [0, 0, img.w, img.h];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const p of pinIndex()) add(p.x, p.y);
  for (const t of doc.traces) tracePts(t).forEach(q => add(...q));
  for (const o of doc.outlines) { add(o.x, o.y); add(o.x + o.w, o.y + o.h); }
  if (!isFinite(x0)) return [0, 0, 1000, 700];
  const m = 10 * doc.ppm; return [x0 - m, y0 - m, x1 + m, y1 + m];
}
function fitView() {
  const r = svg.getBoundingClientRect(); if (!r.width) return;
  const [x0, y0, x1, y1] = contentBounds(), pad = 40, padL = r.width > 700 ? 70 : 54;
  const z = Math.min((r.width - pad - padL) / (x1 - x0), (r.height - pad * 2) / (y1 - y0));
  view.z = clamp(z, .02, 80);
  view.x = padL + ((r.width - pad - padL) - (x1 - x0) * view.z) / 2 - x0 * view.z;
  view.y = (r.height - (y1 - y0) * view.z) / 2 - y0 * view.z;
  applyView(); schedule('scene');
}
function toWorld(e) { const r = svg.getBoundingClientRect(); return [(e.clientX - r.left - view.x) / view.z, (e.clientY - r.top - view.y) / view.z]; }

/* ---- photo ---- */
function imgFilter() { return `${ui.gray ? 'grayscale(1) ' : ''}contrast(${ui.contrast})`; }
function renderImage() {
  gImg.innerHTML = img ? `<image id="photo" href="${img.src}" x="0" y="0" width="${img.w}" height="${img.h}" preserveAspectRatio="none"/>` : '';
  updateImageStyle();
  $('#drop').hidden = !!img;
}
function updateImageStyle() {
  const el = $('#photo');
  if (el) { el.setAttribute('opacity', ui.layers.img ? ui.opacity : 0); el.style.filter = imgFilter(); }
  const r = $('#opRange'); r.value = Math.round(ui.opacity * 100); r.style.setProperty('--p', r.value + '%');
  $('#opVal').textContent = r.value + '%';
  const c = $('#ctRange'); c.value = Math.round(ui.contrast * 100); c.style.setProperty('--p', ((c.value - 60) / 140 * 100) + '%');
  $('#btnGray').classList.toggle('on', ui.gray);
}

/* ---- dimension geometry ---- */
function dimMarkup(a, b, off, z, o = {}) {
  const L = dist(a, b); if (L < 1e-6) return '';
  const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L, nx = -uy, ny = ux, sg = off < 0 ? -1 : 1;
  const A = [a[0] + nx * off, a[1] + ny * off], B = [b[0] + nx * off, b[1] + ny * off];
  const gap = 3 / z, over = 5 / z, ah = 9 / z, aw = 3.2 / z;
  let s = '';
  if (Math.abs(off) > gap) {
    s += `<line x1="${f2(a[0] + nx * gap * sg)}" y1="${f2(a[1] + ny * gap * sg)}" x2="${f2(A[0] + nx * over * sg)}" y2="${f2(A[1] + ny * over * sg)}"/>`;
    s += `<line x1="${f2(b[0] + nx * gap * sg)}" y1="${f2(b[1] + ny * gap * sg)}" x2="${f2(B[0] + nx * over * sg)}" y2="${f2(B[1] + ny * over * sg)}"/>`;
  }
  s += `<line x1="${f2(A[0])}" y1="${f2(A[1])}" x2="${f2(B[0])}" y2="${f2(B[1])}"/>`;
  const tri = (p, d) => `<polygon points="${f2(p[0])},${f2(p[1])} ${f2(p[0] + d * ux * ah + nx * aw)},${f2(p[1] + d * uy * ah + ny * aw)} ${f2(p[0] + d * ux * ah - nx * aw)},${f2(p[1] + d * uy * ah - ny * aw)}"/>`;
  s += tri(A, 1) + tri(B, -1);
  let ang = Math.atan2(uy, ux) / DEG; if (ang > 90.01 || ang < -89.99) ang += 180;
  const tx = (A[0] + B[0]) / 2 + nx * sg * 9 / z, ty = (A[1] + B[1]) / 2 + ny * sg * 9 / z;
  const label = o.label ?? fmtMM(L / doc.ppm);
  s += `<text x="${f2(tx)}" y="${f2(ty)}" font-size="${f2(11.5 / z)}" stroke-width="${f2(3.2 / z)}" transform="rotate(${f2(ang)} ${f2(tx)} ${f2(ty)})">${esc(label)}</text>`;
  if (o.id) s += `<line class="d-hit" x1="${f2(A[0])}" y1="${f2(A[1])}" x2="${f2(B[0])}" y2="${f2(B[1])}" stroke-width="${f2(12 / z)}"/>`;
  return `<g class="dimg${o.sel ? ' sel' : ''}"${o.id ? ` data-id="${o.id}"` : ''}>${s}</g>`;
}

/* ---- scene ---- */
function sceneMarkup(opt = {}) {
  const z = opt.z ?? view.z, L = ui.layers, nets = getNets(), ppm = doc.ppm;
  const exp = !!opt.export, hl = exp ? null : (S.hlNet || S.hlPinned);
  const out = { outl: '', bot: '', body: '', top: '', pads: '', wire: '', lbl: '', dims: '' };
  for (const o of doc.outlines) {
    const sel = !exp && S.sel.has(o.id);
    out.outl += `<g class="outline${sel ? ' sel' : ''}" data-id="${o.id}"><rect class="o-hit" x="${f2(o.x)}" y="${f2(o.y)}" width="${f2(o.w)}" height="${f2(o.h)}" stroke-width="${f2(10 / z)}"/><rect class="o-line" x="${f2(o.x)}" y="${f2(o.y)}" width="${f2(o.w)}" height="${f2(o.h)}"/></g>`;
    if (o.dims !== false) {
      out.dims += dimMarkup([o.x, o.y], [o.x + o.w, o.y], -22 / z, z) + dimMarkup([o.x, o.y + o.h], [o.x, o.y], -22 / z, z);
    }
  }
  for (const t of doc.traces) {
    const n = nets.byTrace.get(t.id), pts = tracePts(t), d = polyD(pts);
    const w = Math.max(t.w * ppm, 1.4 / z), sel = !exp && S.sel.has(t.id);
    const col = (ui.netColors && n) ? n.color : (exp ? opt.pal[t.layer] : layerVar(t.layer));
    const dim = hl && (!n || n.key !== hl) ? ' dimmed' : '';
    const dash = t.layer === 'wire' ? ` stroke-dasharray="${f2(Math.max(w * 1.6, 6 / z))} ${f2(Math.max(w * 1.6, 5 / z))}"` : '';
    const s = `<g class="trace${dim}" data-id="${t.id}">${exp ? '' : `<path class="t-hit" d="${d}" stroke-width="${f2(Math.max(w, 12 / z))}"/>`}${sel ? `<path class="t-glow" d="${d}" stroke-width="${f2(w + 7 / z)}"/>` : ''}<path class="t-line" d="${d}" stroke="${col}" stroke-width="${f2(w)}"${dash}/></g>`;
    if (t.layer === 'bottom') out.bot += s; else if (t.layer === 'wire') out.wire += s; else out.top += s;
  }
  const fs = 11 / z, sw = 3 / z;
  for (const c of doc.comps) {
    const f = compFP(c), tr = compTransform(c), sel = !exp && S.sel.has(c.id), b = f.bbox, pt = isPoint(c);
    out.body += `<g class="comp${sel ? ' sel' : ''}${c.side === 'bottom' ? ' bside' : ''}" data-id="${c.id}" transform="${tr}">${exp ? '' : `<rect class="hit" x="${f2(b.x0)}" y="${f2(b.y0)}" width="${f2(b.x1 - b.x0)}" height="${f2(b.y1 - b.y0)}"/>`}${f.svg.halo}${f.svg.body}</g>`;
    let pads = '';
    for (const p of f.pins) {
      const n = nets.byPin.get(c.id + ':' + p.id);
      let cls = 'pad' + (p.extra ? ' extra' : '') + (n ? ' linked' : '');
      if (hl && n && n.key === hl) cls += ' net-hl';
      if (!exp && S.selPin && S.selPin.c === c.id && S.selPin.p === p.id) cls += ' pin-sel';
      pads += padSVG(p, cls, ` data-p="${esc(p.id)}"`) + (p.drill ? `<circle class="drill" cx="${p.x}" cy="${p.y}" r="${f2(p.drill / 2)}"/>` : '');
    }
    out.pads += `<g class="pads" data-id="${c.id}" transform="${tr}">${pads}</g>`;
    if (L.labels) {
      let lx = c.x, ly = c.y, anchor = '';
      if (pt) { const r = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 * ppm; lx = c.x + r + 3 / z; anchor = ' text-anchor="start"'; }
      const hpx = Math.min(b.x1 - b.x0, b.y1 - b.y0) * ppm * z;
      const showVal = c.value && !pt && hpx > 44;
      out.lbl += `<text class="lbl${sel ? ' sel' : ''}" x="${f2(lx)}" y="${f2(ly - (showVal ? fs * .6 : 0))}" font-size="${f2(fs)}" stroke-width="${f2(sw)}"${anchor}>${esc(c.ref)}</text>`;
      if (showVal) out.lbl += `<text class="lbl val" x="${f2(lx)}" y="${f2(ly + fs * .75)}" font-size="${f2(fs * .9)}" stroke-width="${f2(sw)}">${esc(c.value)}</text>`;
    }
    if (L.pinl && !pt) {
      for (const p of f.pins) {
        const m = Math.min(p.w, p.h) * ppm * z; if (m < 13) continue;
        const [x, y] = l2w(c, p.x, p.y), size = Math.min(m * .5, 11) / z;
        const name = p.name && m >= 30 ? p.name : '';
        out.lbl += `<text class="pinl" x="${f2(x)}" y="${f2(y - (name ? size * .45 : 0))}" font-size="${f2(size)}">${esc(p.id)}</text>`;
        if (name) out.lbl += `<text class="pinn" x="${f2(x)}" y="${f2(y + size * .75)}" font-size="${f2(size * .8)}" stroke-width="${f2(2.4 / z)}">${esc(name)}</text>`;
      }
    }
  }
  for (const d of doc.dims) out.dims += dimMarkup(epPos(d.a), epPos(d.b), d.off, z, { id: d.id, sel: !exp && S.sel.has(d.id) });
  return (L.dims ? out.outl : '') + (L.bottom ? out.bot : '') + (L.body ? out.body : '') + (L.top ? out.top : '') + (L.pads ? out.pads : '') + (L.wire ? out.wire : '') + (L.labels || L.pinl ? out.lbl : '') + (L.dims ? out.dims : '');
}
function renderScene() { gScene.innerHTML = sceneMarkup(); }

/* ---- overlay: selection, handles, drafts, snapping ---- */
function handle(x, y, h, z, cls = '') { const s = 8 / z; return `<rect class="hnd ${cls}" data-h="${h}" x="${f2(x - s / 2)}" y="${f2(y - s / 2)}" width="${f2(s)}" height="${f2(s)}"/>`; }
function renderOverlay() {
  const z = view.z; let s = '';
  for (const id of S.sel) {
    const k = kindOf(id), o = anyById(id); if (!o) continue;
    if (k === 'comp') {
      const b = compFP(o).bbox, m = .4;
      s += `<g transform="${compTransform(o)}"><rect class="selbox" x="${f2(b.x0 - m)}" y="${f2(b.y0 - m)}" width="${f2(b.x1 - b.x0 + 2 * m)}" height="${f2(b.y1 - b.y0 + 2 * m)}"/></g>`;
    } else if (k === 'trace' && S.sel.size === 1) {
      const pts = tracePts(o);
      pts.forEach((p, i) => { const idx = i === 0 ? 'a' : i === pts.length - 1 ? 'b' : String(i - 1); s += handle(p[0], p[1], `tv:${id}:${idx}`, z, idx === 'a' || idx === 'b' ? 'end' : ''); });
    } else if (k === 'dim' && S.sel.size === 1) {
      const a = epPos(o.a), b = epPos(o.b), L = dist(a, b) || 1, nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
      s += handle(a[0], a[1], `da:${id}:a`, z, 'end') + handle(b[0], b[1], `da:${id}:b`, z, 'end');
      s += handle((a[0] + b[0]) / 2 + nx * o.off, (a[1] + b[1]) / 2 + ny * o.off, `do:${id}:0`, z);
    } else if (k === 'outline' && S.sel.size === 1) {
      [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]].forEach((p, i) => { s += handle(p[0], p[1], `oc:${id}:${i}`, z, 'end'); });
    }
  }
  const sn = S.snap;
  if (sn && (sn.pin || sn.vertex || sn.trace)) {
    if (sn.pin) { const pi = pinIndex().find(q => q.c.id === sn.pin.c && q.p.id === sn.pin.p); const r = Math.max(pi ? pi.r : 0, 5 / z) + 3 / z; s += `<circle class="snap" cx="${f2(sn.x)}" cy="${f2(sn.y)}" r="${f2(r)}"/>`; }
    else s += `<circle class="snapdot" cx="${f2(sn.x)}" cy="${f2(sn.y)}" r="${f2(3.5 / z)}"/>`;
  }
  const d = S.draft, cur = draftCursor();
  if (d && d.kind === 'trace') {
    const pts = [epPos(d.a), ...d.pts, cur], w = Math.max(d.w * doc.ppm, 1.4 / z);
    s += `<path class="draft" d="${polyD(pts)}" stroke="${layerVar(d.layer)}" stroke-width="${f2(w)}"${d.layer === 'wire' ? ` stroke-dasharray="${f2(6 / z)} ${f2(5 / z)}"` : ''}/>`;
    pts.slice(0, -1).forEach(p => { s += `<circle class="draft-v" cx="${f2(p[0])}" cy="${f2(p[1])}" r="${f2(3 / z)}"/>`; });
    const segL = dist(pts[pts.length - 2], cur) / doc.ppm;
    if (segL > 0) s += `<text class="lbl" x="${f2(cur[0] + 12 / z)}" y="${f2(cur[1] - 12 / z)}" font-size="${f2(10.5 / z)}" stroke-width="${f2(3 / z)}" text-anchor="start">${fmtMM(segL)}</text>`;
  }
  if (d && d.kind === 'dim') {
    const a = epPos(d.a);
    if (!d.b) s += dimMarkup(a, cur, 0, z);
    else { const b = epPos(d.b); s += dimMarkup(a, b, dimOffsetFor(a, b, S.mouse), z); }
  }
  if (d && d.kind === 'calib') {
    const b = d.b || cur, Lp = dist(d.a, b);
    s += `<g class="calib"><line x1="${f2(d.a[0])}" y1="${f2(d.a[1])}" x2="${f2(b[0])}" y2="${f2(b[1])}"/><circle cx="${f2(d.a[0])}" cy="${f2(d.a[1])}" r="${f2(4 / z)}"/><circle cx="${f2(b[0])}" cy="${f2(b[1])}" r="${f2(4 / z)}"/><text x="${f2((d.a[0] + b[0]) / 2)}" y="${f2((d.a[1] + b[1]) / 2 - 12 / z)}" font-size="${f2(11 / z)}" stroke-width="${f2(3 / z)}">${fmtN(Lp, 1)} px</text></g>`;
  }
  if (S.tool === 'calib' && !d && doc.calib) {
    const { a, b, mm } = doc.calib;
    s += `<g class="calib" opacity=".75"><line x1="${f2(a[0])}" y1="${f2(a[1])}" x2="${f2(b[0])}" y2="${f2(b[1])}"/><circle cx="${f2(a[0])}" cy="${f2(a[1])}" r="${f2(3.5 / z)}"/><circle cx="${f2(b[0])}" cy="${f2(b[1])}" r="${f2(3.5 / z)}"/><text x="${f2((a[0] + b[0]) / 2)}" y="${f2((a[1] + b[1]) / 2 - 12 / z)}" font-size="${f2(11 / z)}" stroke-width="${f2(3 / z)}">${fmtMM(mm)}</text></g>`;
  }
  const dr = S.drag;
  if (dr && dr.kind === 'marquee') { const [x0, y0, x1, y1] = rectOf(dr.a, dr.b); s += `<rect class="marq" x="${f2(x0)}" y="${f2(y0)}" width="${f2(x1 - x0)}" height="${f2(y1 - y0)}"/>`; }
  if (dr && dr.kind === 'outline') { const [x0, y0, x1, y1] = rectOf(dr.a, dr.b); s += `<rect class="o-line" x="${f2(x0)}" y="${f2(y0)}" width="${f2(x1 - x0)}" height="${f2(y1 - y0)}"/>` + dimMarkup([x0, y0], [x1, y0], -22 / z, z) + dimMarkup([x0, y1], [x0, y0], -22 / z, z); }
  if (S.tool === 'place' && S.placeType && S.mouseIn) {
    const g = { id: '_g', type: S.placeType, x: S.mouse[0], y: S.mouse[1], rot: S.placeRot, side: 'top', params: defaultParams(DEF[S.placeType]), pn: {}, extra: [] };
    const f = compFP(g); s += `<g class="comp ghost" transform="${compTransform(g)}">${f.svg.halo}${f.svg.body}${f.pins.map(p => padSVG(p, 'pad')).join('')}</g>`;
  }
  if (S.tool === 'pin' && S.mouseIn) {
    const c = pinTarget(S.mouse);
    if (c) {
      const b = compFP(c).bbox;
      s += `<g transform="${compTransform(c)}"><rect class="ptarget" x="${f2(b.x0 - .3)}" y="${f2(b.y0 - .3)}" width="${f2(b.x1 - b.x0 + .6)}" height="${f2(b.y1 - b.y0 + .6)}"/></g>`;
      s += `<circle class="pin-ghost" cx="${f2(S.mouse[0])}" cy="${f2(S.mouse[1])}" r="${f2(pinSizeFor(c) / 2 * doc.ppm)}"/>`;
    }
  }
  if (S.tool === 'point' && S.mouseIn && !d) {
    const f = baseFP(S.pointType, defaultParams(DEF[S.pointType])), p = f.pins[0], q = S.snap && S.snap.trace ? [S.snap.x, S.snap.y] : S.mouse;
    s += `<circle class="pin-ghost" cx="${f2(q[0])}" cy="${f2(q[1])}" r="${f2(Math.max(p.w / 2 * doc.ppm, 3 / z))}"/>`;
  }
  gOver.innerHTML = s;
}
const rectOf = (a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])];
function dimOffsetFor(a, b, m) { const L = dist(a, b) || 1, nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L; return (m[0] - a[0]) * nx + (m[1] - a[1]) * ny; }
function constrain45(from, to) {
  const dx = to[0] - from[0], dy = to[1] - from[1], a = Math.atan2(dy, dx), s = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
  const L = Math.hypot(dx, dy) * Math.cos(a - s);
  return [from[0] + Math.cos(s) * L, from[1] + Math.sin(s) * L];
}
function draftCursor() {
  const d = S.draft, sn = S.snap;
  if (sn && (sn.pin || sn.vertex || sn.trace)) return [sn.x, sn.y];
  if (!d || !S.shift) return S.mouse;
  if (d.kind === 'trace') { const last = d.pts.length ? d.pts[d.pts.length - 1] : epPos(d.a); return constrain45(last, S.mouse); }
  if (d.kind === 'dim' && !d.b) { const a = epPos(d.a); return Math.abs(S.mouse[0] - a[0]) > Math.abs(S.mouse[1] - a[1]) ? [S.mouse[0], a[1]] : [a[0], S.mouse[1]]; }
  if (d.kind === 'calib' && !d.b) { const a = d.a; return Math.abs(S.mouse[0] - a[0]) > Math.abs(S.mouse[1] - a[1]) ? [S.mouse[0], a[1]] : [a[0], S.mouse[1]]; }
  return S.mouse;
}

/* ---- snapping ---- */
function snapAt(w, o = {}) {
  const z = view.z, R = 10 / z;
  let best = null, bd = Infinity;
  if (o.pins !== false) for (const pi of pinIndex()) {
    if (o.skipComp && pi.c.id === o.skipComp) continue;
    const d = dist(w, [pi.x, pi.y]);
    if (d <= Math.max(pi.r, R) && d < bd) { bd = d; best = { x: pi.x, y: pi.y, pin: { c: pi.c.id, p: pi.p.id } }; }
  }
  if (best) return best;
  if (o.vertices || o.traces) for (const t of doc.traces) {
    if (o.skipTrace === t.id) continue;
    const pts = tracePts(t);
    if (o.vertices) for (const p of pts) { const d = dist(w, p); if (d <= R && d < bd) { bd = d; best = { x: p[0], y: p[1], vertex: true }; } }
  }
  if (best) return best;
  if (o.traces) for (const t of doc.traces) {
    if (o.skipTrace === t.id) continue;
    const r = nearestOnPoly(w, tracePts(t)), lim = Math.max(R * .8, t.w * doc.ppm / 2);
    if (r.d <= lim && r.d < bd) { bd = r.d; best = { x: r.q[0], y: r.q[1], trace: t.id }; }
  }
  return best || { x: w[0], y: w[1] };
}
function pinTarget(w) {
  const pad = 1.5;
  const inside = (c, m) => { const [lx, ly] = w2l(c, w[0], w[1]), b = compFP(c).bbox; return lx >= b.x0 - m && lx <= b.x1 + m && ly >= b.y0 - m && ly <= b.y1 + m; };
  for (const id of S.sel) { const c = compById(id); if (c && !isPoint(c) && inside(c, 4)) return c; }
  for (let i = doc.comps.length - 1; i >= 0; i--) { const c = doc.comps[i]; if (!isPoint(c) && inside(c, pad)) return c; }
  return null;
}
function pinSizeFor(c) {
  if (S.pinSize > 0) return S.pinSize;
  const ps = compFP(c).pins.map(p => Math.min(p.w, p.h)).sort((a, b) => a - b);
  return ps.length ? ps[Math.floor(ps.length / 2)] : 1.2;
}
