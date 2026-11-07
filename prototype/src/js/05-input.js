/* ================= canvas interaction ================= */
const pointers = new Map();
let pinch = null, lastClick = { t: 0, x: 0, y: 0 };
const tip = $('#tip');

function hitTarget(el) {
  if (!(el instanceof Element)) return null;
  const h = el.closest('[data-h]');
  if (h) { const [k, id, idx] = h.dataset.h.split(':'); return { kind: 'handle', h: k, id, idx }; }
  const pad = el.closest('[data-p]');
  if (pad) { const g = pad.closest('[data-id]'); return g ? { kind: 'pin', id: g.dataset.id, pin: pad.dataset.p } : null; }
  const g = el.closest('[data-id]');
  return g ? { kind: kindOf(g.dataset.id), id: g.dataset.id } : null;
}
function epFromSnap(sn) { return sn.pin ? { c: sn.pin.c, p: sn.pin.p, x: f2(sn.x), y: f2(sn.y) } : { x: f2(sn.x), y: f2(sn.y) }; }
function selectOnly(id) { S.sel.clear(); if (id) S.sel.add(id); }
function afterSelect(toBoard) {
  if (S.sel.size && S.tool !== 'place' && (S.tab === 'lib' || toBoard)) S.tab = 'board';
  renderSide(); schedule('scene'); renderOptbar();
}
function scrollRowIntoView() { requestAnimationFrame(() => { const r = tabBody.querySelector('.row.open'); if (r) r.scrollIntoView({ block: 'nearest' }); }); }

svg.addEventListener('contextmenu', e => e.preventDefault());
svg.addEventListener('pointerdown', e => {
  try { svg.setPointerCapture(e.pointerId); } catch (_) { }
  pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 2) {
    if (S.drag && S.drag.moved) revert();
    S.drag = null;
    const [p1, p2] = [...pointers.values()];
    pinch = { d: dist(p1, p2), m: [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2], v: { ...view } };
    return;
  }
  const w = toWorld(e); S.mouse = w; S.shift = e.shiftKey; S.mouseIn = true;
  if (e.button === 1 || (e.button === 0 && (S.spaceDown || S.tool === 'pan'))) {
    S.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y }; wrap.classList.add('dragging'); e.preventDefault(); return;
  }
  if (e.button === 2) { onRightClick(); return; }
  if (e.button !== 0) return;
  const now = performance.now();
  const dbl = now - lastClick.t < 380 && Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) < 7;
  lastClick = { t: dbl ? 0 : now, x: e.clientX, y: e.clientY };
  const T = S.tool;
  if (T === 'select') return downSelect(e, w, dbl);
  if (T === 'place') {
    if (!S.placeType) return;
    const c = addComp(S.placeType, w[0], w[1], { rot: S.placeRot });
    selectOnly(c.id); commit({ light: true }); renderOptbar();
    toast(`${c.ref} paigutatud · klõpsa uuesti järgmise jaoks`);
    return;
  }
  if (T === 'point') {
    const sn = snapAt(w, { pins: false, traces: true });
    const c = addComp(S.pointType, sn.x, sn.y);
    selectOnly(c.id); commit({ light: true });
    toast(`${c.ref} lisatud`);
    return;
  }
  if (T === 'pin') {
    const c = pinTarget(w);
    if (!c) { toast('Klõpsa komponendi peale (või vali see enne)', 'warn'); return; }
    const [lx, ly] = w2l(c, w[0], w[1]), id = nextPinId(c);
    c.extra = c.extra || []; c.extra.push({ id, x: f2(lx), y: f2(ly), d: f2(pinSizeFor(c)), shape: 'circle' });
    selectOnly(c.id); S.selPin = { c: c.id, p: id }; S.tab = 'board';
    commit(); scrollRowIntoView();
    toast(`Lisatud jalg ${c.ref}.${id}`);
    return;
  }
  if (T === 'trace') return downTrace(w, dbl);
  if (T === 'measure') {
    const sn = snapAt(w, { vertices: true });
    if (!S.draft) S.draft = { kind: 'dim', a: epFromSnap(sn) };
    else if (!S.draft.b) {
      const cur = draftCursor(), ep = sn.pin || sn.vertex ? epFromSnap(sn) : { x: f2(cur[0]), y: f2(cur[1]) };
      if (dist(epPos(S.draft.a), epPos(ep)) < 2 / view.z) return;
      S.draft.b = ep;
    } else {
      const a = epPos(S.draft.a), b = epPos(S.draft.b);
      doc.dims.push({ id: uid('d'), a: S.draft.a, b: S.draft.b, off: f2(dimOffsetFor(a, b, w)) });
      S.draft = null; commit({ light: true });
    }
    renderOptbar(); schedule('over'); return;
  }
  if (T === 'outline') { S.drag = { kind: 'outline', a: w, b: w }; return; }
  if (T === 'calib') {
    const cur = draftCursor();
    if (!S.draft) { S.draft = { kind: 'calib', a: w }; schedule('over'); return; }
    S.draft.b = cur; schedule('over');
    const px = dist(S.draft.a, S.draft.b);
    if (px < 3) { S.draft = null; return; }
    openCalib(px);
  }
});
function downSelect(e, w, dbl) {
  const hit = hitTarget(e.target);
  if (hit && hit.kind === 'handle') {
    if (hit.h === 'tv' && e.altKey && !['a', 'b'].includes(hit.idx)) {
      const t = anyById(hit.id); t.pts.splice(+hit.idx, 1); commit({ light: true }); return;
    }
    S.drag = { kind: hit.h, id: hit.id, idx: hit.idx, moved: false, sx: e.clientX, sy: e.clientY };
    return;
  }
  if (hit && (hit.kind === 'comp' || hit.kind === 'pin')) {
    const id = hit.id;
    if (e.shiftKey) { S.sel.has(id) ? S.sel.delete(id) : S.sel.add(id); }
    else if (!S.sel.has(id)) selectOnly(id);
    if (hit.kind === 'pin') {
      S.selPin = { c: id, p: hit.pin };
      const n = getNets().byPin.get(id + ':' + hit.pin); S.hlPinned = n ? n.key : null;
      if (dbl) { startTraceFrom(id, hit.pin); return; }
    } else if (S.selPin && S.selPin.c !== id) S.selPin = null;
    afterSelect(true); scrollRowIntoView();
    startMove(e, w, id);
    return;
  }
  if (hit && hit.kind === 'trace') {
    const t = anyById(hit.id);
    if (dbl && t) {
      const pts = tracePts(t), r = nearestOnPoly(w, pts);
      if (r.i >= 0) { t.pts.splice(r.i, 0, [f2(r.q[0]), f2(r.q[1])]); selectOnly(t.id); commit({ light: true }); return; }
    }
    if (e.shiftKey) { S.sel.has(hit.id) ? S.sel.delete(hit.id) : S.sel.add(hit.id); } else if (!S.sel.has(hit.id)) selectOnly(hit.id);
    const n = getNets().byTrace.get(hit.id); S.hlPinned = n ? n.key : null;
    afterSelect(); scrollRowIntoView();
    if (S.sel.size > 1) startMove(e, w, hit.id);
    return;
  }
  if (hit && (hit.kind === 'dim' || hit.kind === 'outline')) {
    if (e.shiftKey) { S.sel.has(hit.id) ? S.sel.delete(hit.id) : S.sel.add(hit.id); } else if (!S.sel.has(hit.id)) selectOnly(hit.id);
    afterSelect(); scrollRowIntoView();
    if (hit.kind === 'dim' && S.sel.size === 1) S.drag = { kind: 'do', id: hit.id, moved: false, sx: e.clientX, sy: e.clientY };
    else startMove(e, w, hit.id);
    return;
  }
  if (!e.shiftKey) { if (S.sel.size || S.hlPinned || S.selPin) { S.sel.clear(); S.selPin = null; S.hlPinned = null; afterSelect(); } }
  S.drag = { kind: 'marquee', a: w, b: w, add: e.shiftKey, moved: false, sx: e.clientX, sy: e.clientY };
}
function startMove(e, w, clickedId) {
  const orig = {};
  for (const id of S.sel) {
    const o = anyById(id), k = kindOf(id); if (!o) continue;
    if (k === 'comp' || k === 'outline') orig[id] = [o.x, o.y];
    else if (k === 'trace') orig[id] = { a: [o.a.x, o.a.y], b: [o.b.x, o.b.y], pts: o.pts.map(p => [...p]) };
    else if (k === 'dim') orig[id] = { a: [o.a.x, o.a.y], b: [o.b.x, o.b.y] };
  }
  S.drag = { kind: 'move', start: w, orig, moved: false, sx: e.clientX, sy: e.clientY, clickedId, shift: e.shiftKey };
}
function startTraceFrom(cid, pid) {
  const q = pinWorld(cid, pid); if (!q) return;
  setTool('trace');
  S.draft = { kind: 'trace', a: { c: cid, p: pid, x: f2(q[0]), y: f2(q[1]) }, pts: [], layer: S.traceLayer, w: S.traceW };
  renderOptbar(); schedule('over');
  toast(`Rada algab: ${pinLabel(cid, pid)} — klõpsa sihtjalal`);
}
function downTrace(w, dbl) {
  const sn = snapAt(w, { traces: true, vertices: true });
  if (!S.draft) {
    S.draft = { kind: 'trace', a: epFromSnap(sn), pts: [], layer: S.traceLayer, w: S.traceW };
    renderOptbar(); schedule('over'); return;
  }
  const d = S.draft;
  if (dbl) {
    const last = d.pts.pop();
    if (last) finishTrace({ x: last[0], y: last[1] }); else cancelDraft();
    return;
  }
  if (sn.pin) { finishTrace(epFromSnap(sn)); return; }
  if (sn.trace || sn.vertex) {
    const start = epPos(d.a);
    if (d.pts.length || dist(start, [sn.x, sn.y]) > 6 / view.z) { finishTrace({ x: f2(sn.x), y: f2(sn.y) }); return; }
  }
  const cur = draftCursor();
  d.pts.push([f2(cur[0]), f2(cur[1])]);
  schedule('over');
}
function finishTrace(b) {
  const d = S.draft; S.draft = null;
  const a = epPos(d.a), bp = epPos(b);
  if (dist(a, bp) < 1e-3 && !d.pts.length) { renderOptbar(); schedule('over'); return; }
  if (d.a.c && b.c && d.a.c === b.c && d.a.p === b.p) { renderOptbar(); schedule('over'); return; }
  const t = { id: uid('t'), a: d.a, b, pts: d.pts, w: d.w, layer: d.layer, net: '' };
  doc.traces.push(t);
  commit({ light: true }); renderOptbar();
  const n = getNets().byTrace.get(t.id);
  toast(`Rada ${epText(t.a)} → ${epText(t.b)}${n ? ' · võrk ' + n.name : ''}`);
}
function cancelDraft() { S.draft = null; renderOptbar(); schedule('over'); }
function onRightClick() {
  const d = S.draft;
  if (d && d.kind === 'trace' && d.pts.length) { const last = d.pts.pop(); finishTrace({ x: last[0], y: last[1] }); return; }
  if (d) { cancelDraft(); return; }
  if (S.tool !== 'select') setTool('select');
}

svg.addEventListener('pointermove', e => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch && pointers.size === 2) {
    const [p1, p2] = [...pointers.values()], r = svg.getBoundingClientRect();
    const d = dist(p1, p2), m = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
    const z = clamp(pinch.v.z * d / pinch.d, .02, 80), k = z / pinch.v.z;
    view.z = z; view.x = (m[0] - r.left) - ((pinch.m[0] - r.left) - pinch.v.x) * k; view.y = (m[1] - r.top) - ((pinch.m[1] - r.top) - pinch.v.y) * k;
    applyView(); schedule('scene'); return;
  }
  const w = toWorld(e); S.mouse = w; S.shift = e.shiftKey; S.mouseIn = true;
  updateCoords(w);
  const dr = S.drag;
  if (dr) { onDrag(e, w, dr); return; }
  const T = S.tool;
  if (T === 'trace') S.snap = snapAt(w, { traces: true, vertices: true });
  else if (T === 'measure') S.snap = snapAt(w, { vertices: true });
  else if (T === 'point') S.snap = snapAt(w, { pins: false, traces: true });
  else S.snap = null;
  showTip(e, T === 'select' || T === 'pin' || T === 'pan' ? hitTarget(e.target) : (S.snap && S.snap.pin ? { kind: 'pin', id: S.snap.pin.c, pin: S.snap.pin.p } : null));
  schedule('over');
});
svg.addEventListener('pointerleave', () => { S.mouseIn = false; tip.hidden = true; if (!S.drag) { S.snap = null; schedule('over'); } });
function onDrag(e, w, dr) {
  if (!dr.moved && dr.sx != null && Math.hypot(e.clientX - dr.sx, e.clientY - dr.sy) < 3) return;
  dr.moved = true; tip.hidden = true;
  if (dr.kind === 'pan') { view.x = dr.vx + e.clientX - dr.sx; view.y = dr.vy + e.clientY - dr.sy; applyView(); return; }
  if (dr.kind === 'marquee' || dr.kind === 'outline') { dr.b = w; schedule('over'); return; }
  if (dr.kind === 'move') {
    const dx = w[0] - dr.start[0], dy = w[1] - dr.start[1];
    for (const id in dr.orig) {
      const o = anyById(id), k = kindOf(id), v = dr.orig[id]; if (!o) continue;
      if (k === 'comp' || k === 'outline') { o.x = f2(v[0] + dx); o.y = f2(v[1] + dy); }
      else if (k === 'trace') { if (!o.a.c) { o.a.x = f2(v.a[0] + dx); o.a.y = f2(v.a[1] + dy); } if (!o.b.c) { o.b.x = f2(v.b[0] + dx); o.b.y = f2(v.b[1] + dy); } o.pts = v.pts.map(p => [f2(p[0] + dx), f2(p[1] + dy)]); }
      else if (k === 'dim') { if (!o.a.c) { o.a.x = f2(v.a[0] + dx); o.a.y = f2(v.a[1] + dy); } if (!o.b.c) { o.b.x = f2(v.b[0] + dx); o.b.y = f2(v.b[1] + dy); } }
    }
    touch(); schedule('scene'); return;
  }
  if (dr.kind === 'tv') {
    const t = anyById(dr.id); if (!t) return;
    if (dr.idx === 'a' || dr.idx === 'b') {
      const sn = snapAt(w, {}); S.snap = sn;
      const ep = t[dr.idx]; delete ep.c; delete ep.p; ep.x = f2(sn.x); ep.y = f2(sn.y); dr.pin = sn.pin || null;
    } else {
      let p = w; if (e.shiftKey) { const pts = tracePts(t), i = +dr.idx + 1; p = constrain45(pts[i - 1], w); }
      t.pts[+dr.idx] = [f2(p[0]), f2(p[1])];
    }
    touch(); schedule('scene'); return;
  }
  if (dr.kind === 'da') {
    const d = anyById(dr.id); if (!d) return;
    const sn = snapAt(w, { vertices: true }); S.snap = sn;
    const ep = d[dr.idx]; delete ep.c; delete ep.p; ep.x = f2(sn.x); ep.y = f2(sn.y); dr.pin = sn.pin || null;
    touch(); schedule('scene'); return;
  }
  if (dr.kind === 'do') { const d = anyById(dr.id); if (!d) return; d.off = f2(dimOffsetFor(epPos(d.a), epPos(d.b), w)); schedule('scene'); return; }
  if (dr.kind === 'oc') {
    const o = anyById(dr.id); if (!o) return;
    const c = [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]], opp = c[(+dr.idx + 2) % 4];
    const [x0, y0, x1, y1] = rectOf(opp, w); o.x = f2(x0); o.y = f2(y0); o.w = f2(x1 - x0); o.h = f2(y1 - y0);
    const right = w[0] >= opp[0], below = w[1] >= opp[1];
    dr.idx = String(below ? (right ? 2 : 3) : (right ? 1 : 0));
    touch(); schedule('scene');
  }
}
function endPointer(e) {
  pointers.delete(e.pointerId);
  if (pinch) { if (pointers.size < 2) { pinch = null; queueSave(); } return; }
  const dr = S.drag; S.drag = null; wrap.classList.remove('dragging');
  if (!dr) return;
  if (dr.kind === 'pan') { queueSave(); return; }
  if (dr.kind === 'marquee') {
    if (dr.moved) {
      const [x0, y0, x1, y1] = rectOf(dr.a, dr.b), inR = p => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
      if (!dr.add) S.sel.clear();
      for (const c of doc.comps) if (inR([c.x, c.y])) S.sel.add(c.id);
      for (const t of doc.traces) if (tracePts(t).every(inR)) S.sel.add(t.id);
      for (const d of doc.dims) if (inR(epPos(d.a)) && inR(epPos(d.b))) S.sel.add(d.id);
      afterSelect();
    }
    schedule('over'); return;
  }
  if (dr.kind === 'outline') {
    const [x0, y0, x1, y1] = rectOf(dr.a, dr.b);
    if (x1 - x0 > 4 && y1 - y0 > 4) {
      const o = { id: uid('o'), x: f2(x0), y: f2(y0), w: f2(x1 - x0), h: f2(y1 - y0), dims: true };
      doc.outlines.push(o); selectOnly(o.id); S.tab = 'board'; commit();
      toast(`Kontuur ${fmtN(o.w / doc.ppm)} × ${fmtN(o.h / doc.ppm)} mm`);
    } else schedule('over');
    return;
  }
  if (dr.kind === 'move') {
    if (dr.moved) commit({ light: true });
    else if (!dr.shift && S.sel.size > 1 && dr.clickedId) { selectOnly(dr.clickedId); afterSelect(); }
    return;
  }
  if (dr.kind === 'tv' || dr.kind === 'da') {
    if (dr.moved) {
      const o = anyById(dr.id);
      if (o && dr.pin) Object.assign(o[dr.idx], { c: dr.pin.c, p: dr.pin.p });
      S.snap = null; commit({ light: true });
    }
    return;
  }
  if (dr.moved) commit({ light: true });
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);
svg.addEventListener('wheel', e => {
  e.preventDefault();
  const r = svg.getBoundingClientRect();
  const k = Math.exp(-(e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY) * (e.ctrlKey ? .01 : .0018));
  zoomAt(e.clientX - r.left, e.clientY - r.top, k);
}, { passive: false });

function updateCoords(w) {
  const [x, y] = toMM(w);
  $('#coords').textContent = `X ${fmtN(x)}   Y ${fmtN(y)} mm`;
}
function showTip(e, hit) {
  let h = '';
  if (hit && hit.kind === 'pin') {
    const c = compById(hit.id), p = c && compFP(c).pinMap.get(hit.pin);
    if (p) {
      const n = getNets().byPin.get(c.id + ':' + p.id);
      h = `<b>${esc(c.ref)}.${esc(p.id)}</b>${p.name ? ' ' + esc(p.name) : ''}<br><i>${n ? 'võrk ' + esc(n.name) + ' · ' + (n.pins.length - 1) + ' ühendust' : 'ühendamata'}</i>`;
    }
  } else if (hit && hit.kind === 'comp') {
    const c = compById(hit.id); if (c) h = `<b>${esc(c.ref)}</b> ${esc(c.value || '')}<br><i>${esc(fpLabel(c))}${c.side === 'bottom' ? ' · alumine pool' : ''}</i>`;
  } else if (hit && hit.kind === 'trace') {
    const t = anyById(hit.id), n = getNets().byTrace.get(hit.id);
    if (t) h = `<b>${esc(n ? n.name : 'rada')}</b> · ${fmtN(t.w)} mm<br><i>${fmtMM(polyLen(tracePts(t)) / doc.ppm)} · ${t.layer === 'bottom' ? 'alumine' : t.layer === 'wire' ? 'juhe' : 'pealmine'}</i>`;
  }
  if (!h) { tip.hidden = true; return; }
  tip.innerHTML = h; tip.hidden = false;
  const r = wrap.getBoundingClientRect();
  let x = e.clientX - r.left + 16, y = e.clientY - r.top + 18;
  if (x + tip.offsetWidth > r.width - 8) x = e.clientX - r.left - tip.offsetWidth - 12;
  if (y + tip.offsetHeight > r.height - 8) y = e.clientY - r.top - tip.offsetHeight - 12;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}

/* ================= keyboard ================= */
const typing = el => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
document.addEventListener('keydown', e => {
  if (!modal.hidden) { if (e.key === 'Escape') closeModal(); return; }
  const k = e.key, ctrl = e.ctrlKey || e.metaKey;
  if (typing(document.activeElement)) { if (k === 'Escape') document.activeElement.blur(); return; }
  if (ctrl) {
    const kl = k.toLowerCase();
    if (kl === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((kl === 'z' && e.shiftKey) || kl === 'y') { e.preventDefault(); redo(); }
    else if (kl === 's') { e.preventDefault(); saveProject(); }
    else if (kl === 'o') { e.preventDefault(); $('#fileProj').click(); }
    else if (kl === 'd') { e.preventDefault(); duplicateSelection(); }
    else if (kl === 'a') { e.preventDefault(); S.sel = new Set([...doc.comps.map(c => c.id), ...doc.traces.map(t => t.id)]); afterSelect(); }
    return;
  }
  if (k === ' ') { if (!S.spaceDown) { S.spaceDown = true; wrap.classList.add('panning'); } e.preventDefault(); return; }
  if (k === 'Escape') {
    if (S.draft) cancelDraft();
    else if (S.tool !== 'select') setTool('select');
    else { S.sel.clear(); S.selPin = null; S.hlPinned = null; afterSelect(); }
    return;
  }
  if (k === 'Enter') { const d = S.draft; if (d && d.kind === 'trace') { const last = d.pts.pop(); if (last) finishTrace({ x: last[0], y: last[1] }); else cancelDraft(); } return; }
  if (k === 'Backspace' && S.draft && S.draft.kind === 'trace') { e.preventDefault(); if (S.draft.pts.length) { S.draft.pts.pop(); schedule('over'); } else cancelDraft(); return; }
  if (k === 'Delete' || k === 'Backspace') { e.preventDefault(); deleteSelection(); return; }
  if (k.startsWith('Arrow')) {
    const comps = [...S.sel].map(compById).filter(Boolean); if (!comps.length) return;
    e.preventDefault();
    const st = (e.shiftKey ? 10 : 1) / view.z, dx = k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, dy = k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0;
    comps.forEach(c => { c.x = f2(c.x + dx); c.y = f2(c.y + dy); });
    touch(); schedule('scene'); clearTimeout(S.nudgeT); S.nudgeT = setTimeout(() => commit({ light: true }), 400);
    return;
  }
  const kl = k.toLowerCase();
  const toolKeys = { v: 'select', h: 'pan', t: 'trace', p: 'point', j: 'pin', m: 'measure', o: 'outline', k: 'calib' };
  if (toolKeys[kl] && !e.altKey) { setTool(toolKeys[kl]); return; }
  if (kl === 'r') { if (S.tool === 'place') { S.placeRot = (S.placeRot + (e.shiftKey ? 270 : 90)) % 360; renderOptbar(); schedule('over'); } else rotateSel(e.shiftKey ? -90 : 90); return; }
  if (kl === 'q' || kl === 'e') { rotateSel((kl === 'q' ? -1 : 1) * (e.shiftKey ? 15 : 1)); return; }
  if (kl === 'f') { flipSel(); return; }
  if (kl === 'l' && S.tool === 'trace') { const L = ['top', 'bottom', 'wire']; S.traceLayer = L[(L.indexOf(S.traceLayer) + 1) % 3]; if (S.draft) S.draft.layer = S.traceLayer; renderOptbar(); schedule('over'); return; }
  if (k === '0') { fitView(); return; }
  if (k === '+' || k === '=') { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.25); return; }
  if (k === '-') { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, .8); return; }
  if (k === '?') openHelp();
});
document.addEventListener('keyup', e => { if (e.key === ' ') { S.spaceDown = false; wrap.classList.remove('panning'); } });
window.addEventListener('blur', () => { S.spaceDown = false; wrap.classList.remove('panning'); });
