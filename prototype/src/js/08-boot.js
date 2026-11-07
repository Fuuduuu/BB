/* ================= wiring ================= */
function renderAll() { renderScene(); renderOverlay(); renderSide(); renderSteps(); renderOptbar(); renderStatus(); renderRail(); }

$('#steps').addEventListener('click', e => { const b = e.target.closest('[data-step]'); if (b) goStep(b.dataset.step); });
$('#rail').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) setTool(b.dataset.tool); });
$('#tabs').addEventListener('click', e => {
  if (e.target.closest('#sideClose')) { closeSideNarrow(); return; }
  const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab);
});
$('#btnPanel').addEventListener('click', () => $('#app').classList.toggle('side-open'));
$('#btnUndo').addEventListener('click', undo);
$('#btnRedo').addEventListener('click', redo);
$('#btnNew').addEventListener('click', newProject);
$('#btnOpen').addEventListener('click', () => $('#fileProj').click());
$('#btnSave').addEventListener('click', saveProject);
$('#btnExport').addEventListener('click', () => { S.step = 'export'; renderSteps(); openExport(); });
$('#btnHelp').addEventListener('click', openHelp);
$('#dzPick').addEventListener('click', () => $('#fileImg').click());
$('#fileImg').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) loadImageFile(f); });
$('#fileProj').addEventListener('change', e => { const f = e.target.files; if (f.length) handleFiles(f); e.target.value = ''; });
$('#projName').addEventListener('change', e => { doc.name = e.target.value.trim() || 'Plaat'; commit({ light: true }); });
$('#projName').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });

/* bottom strip */
$('#opRange').addEventListener('input', e => { ui.opacity = e.target.value / 100; if (!ui.layers.img) ui.layers.img = true; updateImageStyle(); queueSave(); });
$('#ctRange').addEventListener('input', e => { ui.contrast = e.target.value / 100; updateImageStyle(); queueSave(); });
$('#btnGray').addEventListener('click', () => { ui.gray = !ui.gray; updateImageStyle(); queueSave(); });
$('#btnRot').addEventListener('click', () => transformImage('rot'));
$('#btnFlip').addEventListener('click', () => transformImage('flip'));
$('#zIn').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.25); });
$('#zOut').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, .8); });
$('#zFit').addEventListener('click', fitView);
$('#scaleChip').addEventListener('click', () => goStep('scale'));
$('#btnLayers').addEventListener('click', e => {
  const p = $('#layersPop'), open = p.hidden; p.hidden = !open; e.currentTarget.setAttribute('aria-expanded', String(open));
  if (open) renderLayersPop();
});
document.addEventListener('pointerdown', e => { const p = $('#layersPop'); if (!p.hidden && !e.target.closest('#layersPop,#btnLayers')) { p.hidden = true; $('#btnLayers').setAttribute('aria-expanded', 'false'); } });
$('#layersPop').addEventListener('change', e => {
  const k = e.target.dataset.layer; if (!k) return;
  ui.layers[k] = e.target.checked; updateImageStyle(); schedule('scene'); queueSave();
});

/* options bar */
$('#optbar').addEventListener('click', e => {
  const b = e.target.closest('[data-opt]'); if (!b) return;
  const o = b.dataset.opt, v = b.dataset.v;
  if (o === 'layer') { S.traceLayer = v; if (S.draft && S.draft.kind === 'trace') S.draft.layer = v; renderOptbar(); schedule('over'); }
  else if (o === 'ptype') { S.pointType = v; renderOptbar(); schedule('over'); }
  else if (o === 'pickimg') $('#fileImg').click();
  else if (o === 'rot') transformImage('rot');
  else if (o === 'flip') transformImage('flip');
});
$('#optbar').addEventListener('change', e => {
  const id = e.target.id, v = parseNum(e.target.value);
  if (id === 'obW') { if (v > 0) { S.traceW = v; if (S.draft) S.draft.w = v; } renderOptbar(); }
  else if (id === 'obPin') { S.pinSize = v > 0 ? v : 0; renderOptbar(); schedule('over'); }
  else if (id === 'obPpm') { if (v > 0) { doc.ppm = v; doc.calibrated = true; commit(); toast(`Mõõtkava ${fmtN(v)} px/mm`); } else renderOptbar(); }
});
$('#optbar').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur(); });

/* banner */
$('#banner').addEventListener('click', e => {
  const b = e.target.closest('[data-ban]'); if (!b) return;
  if (b.dataset.ban === 'close') { ui.bannerOff = true; renderBanner(); queueSave(); }
  else if (b.dataset.ban === 'photo') $('#fileImg').click();
  else if (b.dataset.ban === 'empty') newProject();
});

/* modal generic */
modal.addEventListener('click', e => {
  if (e.target.closest('[data-close]') || (e.target === modal && !modal.onclick)) { closeModal(); return; }
  const ex = e.target.closest('[data-ex]'); if (ex) runExport(ex.dataset.ex);
});
modal.addEventListener('change', e => {
  if (e.target.id === 'exPhoto') S.exPhoto = e.target.checked;
  if (e.target.id === 'exName') { doc.name = e.target.value.trim() || 'Plaat'; commit({ light: true }); }
});

/* sidebar */
tabBody.addEventListener('click', e => {
  const tile = e.target.closest('.tile');
  if (tile) { const t = tile.dataset.type; if (S.tool === 'place' && S.placeType === t) setTool('select'); else { S.placeType = t; S.placeRot = 0; setTool('place'); S.placeType = t; renderOptbar(); renderSide(); } closeSideNarrow(); return; }
  const a = e.target.closest('[data-act]'); if (!a) {
    const segb = e.target.closest('[data-opt]');
    if (segb) {
      const o = anyById([...S.sel][0]); if (!o) return;
      if (segb.dataset.opt === 'side') o.side = segb.dataset.v;
      if (segb.dataset.opt === 'tlayer') o.layer = segb.dataset.v;
      commit();
    }
    return;
  }
  const act = a.dataset.act, cur = [...S.sel][0], c = compById(cur);
  const pinRow = a.closest('[data-pin]'), pid = pinRow ? pinRow.dataset.pin : null;
  switch (act) {
    case 'pick': {
      const id = a.dataset.id;
      if (S.sel.size === 1 && S.sel.has(id)) { S.sel.clear(); S.selPin = null; }
      else { selectOnly(id); centerOn(id); const n = kindOf(id) === 'trace' ? getNets().byTrace.get(id) : null; S.hlPinned = n ? n.key : null; }
      renderSide(); schedule('scene'); renderOptbar(); scrollRowIntoView(); break;
    }
    case 'addpin': setTool('pin'); toast(`Klõpsa ${c ? c.ref : 'komponendi'} peal kohta, kus jalg asub`); break;
    case 'selpin': if (c) { S.selPin = { c: c.id, p: pid }; const n = getNets().byPin.get(c.id + ':' + pid); S.hlPinned = n ? n.key : null; centerOnPin(c.id, pid); renderSide(); schedule('scene'); } break;
    case 'tracefrom': if (c) { closeSideNarrow(); startTraceFrom(c.id, pid); } break;
    case 'delpin': if (c) deletePin(c, pid); break;
    case 'hlnet': { const k = a.dataset.net; S.hlPinned = S.hlPinned === k ? null : k; schedule('scene'); renderSide(); break; }
    case 'dup': duplicateSelection(); break;
    case 'rot90': rotateSel(90); renderSide(); break;
    case 'del': deleteSelection(); break;
    case 'pingo': { const cid = a.dataset.c, p = a.dataset.p; selectOnly(cid); S.selPin = { c: cid, p }; centerOnPin(cid, p); setTab('board'); schedule('scene'); scrollRowIntoView(); break; }
  }
});
tabBody.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'libQ') { S.libQ = t.value; renderSide(); return; }
  if (t.id === 'boardQ') { S.boardQ = t.value; renderSide(); return; }
  const o = anyById([...S.sel][0]);
  if (t.dataset.f && o && kindOf(o.id) === 'comp') {
    const f = t.dataset.f;
    if (f === 'ref' || f === 'value' || f === 'note') { o[f] = t.value; schedule('scene'); }
    else { const v = parseNum(t.value); if (!Number.isFinite(v)) return; const [ox, oy] = origin(); if (f === 'x') o.x = f2(ox + v * doc.ppm); if (f === 'y') o.y = f2(oy + v * doc.ppm); if (f === 'rot') o.rot = v; touch(); schedule('scene'); }
  }
  if (t.dataset.pn != null && o) { o.pn = o.pn || {}; o.pn[t.dataset.pn] = t.value; touch(); schedule('scene'); }
});
tabBody.addEventListener('change', e => {
  const t = e.target, o = anyById([...S.sel][0]);
  if (t.id === 'netColors') { ui.netColors = t.checked; schedule('scene'); renderSide(); queueSave(); return; }
  if (t.dataset.netname) {
    const n = getNets().byKey.get(t.dataset.netname); if (!n) return;
    const name = t.value.trim();
    for (const id of n.traces) { const tr = doc.traces.find(x => x.id === id); if (tr) tr.net = name; }
    commit(); return;
  }
  if (!o) return;
  if (t.dataset.param) {
    const def = DEF[o.type], p = def.params.find(q => q.k === t.dataset.param);
    let v = t.value;
    if (p && p.n) { v = parseNum(v); if (!Number.isFinite(v)) { renderSide(); return; } v = clamp(v, p.n[0], p.n[1]); }
    o.params = { ...o.params, [t.dataset.param]: v };
    commit(); return;
  }
  if (t.dataset.f || t.dataset.pn != null) { commit({ light: true }); return; }
  if (t.dataset.tf) {
    if (t.dataset.tf === 'w') { const v = parseNum(t.value); if (v > 0) o.w = v; }
    if (t.dataset.tf === 'net') { const n = getNets().byTrace.get(o.id), name = t.value.trim(); (n ? n.traces : [o.id]).forEach(id => { const tr = doc.traces.find(x => x.id === id); if (tr) tr.net = name; }); }
    commit(); return;
  }
  if (t.dataset.of) {
    if (t.dataset.of === 'dims') o.dims = t.checked;
    else { const v = parseNum(t.value); if (v > 0) o[t.dataset.of] = f2(v * doc.ppm); }
    commit();
  }
});
tabBody.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') e.target.blur(); });
tabBody.addEventListener('pointerover', e => { const n = e.target.closest('.net'); const k = n ? n.dataset.net : null; if (k !== S.hlNet) { S.hlNet = k; schedule('scene'); } });
tabBody.addEventListener('pointerleave', () => { if (S.hlNet) { S.hlNet = null; schedule('scene'); } });
tabBody.addEventListener('dragstart', e => {
  const t = e.target.closest('.tile'); if (!t) return;
  e.dataTransfer.setData('text/x-pcb-part', t.dataset.type); e.dataTransfer.setData('text/plain', t.dataset.type); e.dataTransfer.effectAllowed = 'copy';
});
function centerOn(id) {
  const o = anyById(id); if (!o) return; let p;
  const k = kindOf(id);
  if (k === 'comp') p = [o.x, o.y]; else if (k === 'outline') p = [o.x + o.w / 2, o.y + o.h / 2];
  else if (k === 'trace') { const pts = tracePts(o); p = pts[Math.floor(pts.length / 2)]; } else p = epPos(o.a);
  panTo(p);
}
function centerOnPin(cid, pid) { const q = pinWorld(cid, pid); if (q) panTo(q); }
function panTo(p) {
  const r = svg.getBoundingClientRect(), sx = p[0] * view.z + view.x, sy = p[1] * view.z + view.y;
  if (sx > 60 && sx < r.width - 40 && sy > 40 && sy < r.height - 40) return;
  view.x = r.width / 2 - p[0] * view.z; view.y = r.height / 2 - p[1] * view.z; applyView(); schedule('scene');
}

/* drag & drop + paste */
let dragDepth = 0;
const isFileDrag = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
window.addEventListener('dragenter', e => { if (isFileDrag(e)) { dragDepth++; const d = $('#drop'); d.hidden = false; d.classList.add('hot', 'overlay'); } });
window.addEventListener('dragleave', e => { if (isFileDrag(e) && --dragDepth <= 0) { dragDepth = 0; const d = $('#drop'); d.classList.remove('hot', 'overlay'); d.hidden = !!img; } });
window.addEventListener('dragover', e => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = isFileDrag(e) ? 'copy' : 'copy'; });
window.addEventListener('drop', e => {
  e.preventDefault(); dragDepth = 0;
  const d = $('#drop'); d.classList.remove('hot', 'overlay'); d.hidden = !!img;
  const type = e.dataTransfer.getData('text/x-pcb-part');
  if (type && DEF[type] && wrap.contains(e.target)) {
    const w = toWorld(e), c = addComp(type, w[0], w[1]);
    selectOnly(c.id); S.tab = 'board'; commit(); scrollRowIntoView();
    toast(`${c.ref} paigutatud — ${DEF[type].name}`); return;
  }
  if (e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
});
document.addEventListener('paste', e => {
  if (typing(document.activeElement)) return;
  const f = [...(e.clipboardData ? e.clipboardData.files : [])].find(x => x.type.startsWith('image/'));
  if (f) { e.preventDefault(); loadImageFile(f); }
});
window.addEventListener('resize', () => schedule('scene'));

/* ================= boot ================= */
async function boot() {
  let restored = false;
  try {
    const a = await IDB.get('auto');
    if (a && a.doc && (a.doc.comps.length || a.doc.traces.length || !a.doc.sample)) {
      const im = await IDB.get('img');
      doc = { ...newDoc(), ...a.doc }; img = im || null;
      if (a.ui) { Object.assign(ui, a.ui); ui.layers = { ...DEFAULT_LAYERS, ...(a.ui.layers || {}) }; }
      restored = true;
      if (a.view && a.view.z) Object.assign(view, a.view);
    }
  } catch (e) { }
  if (!restored) { buildSample(); saveImage(); }
  touch(); resetHistory(); renderImage(); renderAll(); renderBanner();
  if (!restored || !view.z || view.z === 1) fitView(); else { applyView(); renderScene(); }
  if (restored) S.step = img ? 'place' : 'photo';
  renderSteps(); renderOptbar();
}
boot();
