/* ================= panels: steps, rail, options bar, sidebar ================= */
const ICON = {
  select: '<path d="M5 3l13 7.5-5.6 1.4L9.8 18z"/>',
  pan: '<path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>',
  trace: '<path d="M4.5 18H9l6-6V6.5h4.5"/><circle cx="4" cy="18" r="2"/><circle cx="20" cy="6" r="2"/>',
  point: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="2.2"/>',
  pin: '<rect x="6" y="5" width="9" height="14" rx="1.2"/><path d="M3 9h3M3 15h3M15 9h2.5M19.5 13v7M16 16.5h7"/>',
  measure: '<path d="M4 7v10M20 7v10M4 12h16M7.5 9.5L4 12l3.5 2.5M16.5 9.5L20 12l-3.5 2.5"/>',
  outline: '<rect x="4" y="5" width="16" height="14" rx="1.5" stroke-dasharray="3.2 2.4"/>',
  calib: '<path d="M3 15.5L15.5 3 21 8.5 8.5 21z"/><path d="M7 11.5l2 2M10 8.5l2 2M13 5.5l2 2"/>',
  place: '<rect x="5" y="7" width="14" height="10" rx="1.5"/><path d="M8 4v3M12 4v3M16 4v3M8 17v3M12 17v3M16 17v3"/>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-8 8"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  route: '<path d="M5 19h4l6-6V7h4"/><path d="M16 4l3 3-3 3"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>'
};
const ic = (n, cls = 'ic') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const TOOLS = [
  ['select', 'Vali ja liiguta', 'V'], ['pan', 'Liiguta vaadet', 'H'], null,
  ['trace', 'Rada', 'T'], ['pin', 'Lisa jalg', 'J'], ['point', 'Punkt plaadil', 'P'], null,
  ['measure', 'Mõõt', 'M'], ['outline', 'Plaadi kontuur', 'O'], ['calib', 'Kalibreeri mõõtkava', 'K']
];
const STEPS = [
  { id: 'photo', n: 1, label: 'Foto', done: () => !!img && !doc.sample },
  { id: 'scale', n: 2, label: 'Mõõtkava', done: () => doc.calibrated },
  { id: 'place', n: 3, label: 'Komponendid', done: () => doc.comps.some(c => !isPoint(c)) },
  { id: 'pins', n: 4, label: 'Jalad ja punktid', done: () => doc.comps.some(c => (c.extra && c.extra.length) || isPoint(c)) },
  { id: 'traces', n: 5, label: 'Rajad', done: () => doc.traces.length > 0 },
  { id: 'dims', n: 6, label: 'Mõõdud', done: () => doc.dims.length > 0 || doc.outlines.length > 0 },
  { id: 'export', n: 7, label: 'Eksport', done: () => S.exported }
];
const TOOL_STEP = { trace: 'traces', pin: 'pins', point: 'pins', measure: 'dims', outline: 'dims', calib: 'scale', place: 'place' };

function renderSteps() {
  $('#steps').innerHTML = STEPS.map((s, i) => {
    const done = s.done(), cur = S.step === s.id;
    const seg = i ? `<span class="trace-seg${STEPS[i - 1].done() ? ' done' : ''}"></span>` : '';
    return `${seg}<button class="step${done ? ' done' : ''}${cur ? ' cur' : ''}" data-step="${s.id}" title="${s.n}. ${s.label}"><span class="spad">${done && !cur ? `<svg viewBox="0 0 24 24">${ICON.check}</svg>` : s.n}</span><span class="step-label">${s.label}</span></button>`;
  }).join('');
  $('#btnUndo').disabled = hist.past.length < 2;
  $('#btnRedo').disabled = !hist.future.length;
  const pn = $('#projName'); if (document.activeElement !== pn) pn.value = doc.name;
}
function renderRail() {
  $('#rail').innerHTML = TOOLS.map(t => t ? `<button class="${S.tool === t[0] ? 'on' : ''}" data-tool="${t[0]}" data-tip="${t[1]} · ${t[2]}" aria-label="${t[1]} (${t[2]})">${ic(t[0])}</button>` : '<span class="rsep"></span>').join('');
  wrap.className = 'canvas-wrap t-' + S.tool;
}
function setTool(t, opts = {}) {
  if (S.draft) S.draft = null;
  S.tool = t; S.snap = null;
  if (t !== 'place') S.placeType = null;
  if (TOOL_STEP[t]) S.step = TOOL_STEP[t];
  else if (!opts.keepStep && !['photo', 'place'].includes(S.step)) S.step = 'place';
  renderRail(); renderOptbar(); renderSteps(); schedule('over');
  if (S.tab === 'lib') renderSide();
}
function goStep(id) {
  S.step = id;
  if (id === 'photo') { setTool('select', { keepStep: true }); if (!img || doc.sample) $('#fileImg').click(); }
  else if (id === 'scale') setTool('calib');
  else if (id === 'place') { setTool('select', { keepStep: true }); setTab('lib'); }
  else if (id === 'pins') { setTool('pin'); setTab('board'); }
  else if (id === 'traces') { setTool('trace'); setTab('nets'); }
  else if (id === 'dims') { setTool('measure'); setTab('board'); }
  else if (id === 'export') { openExport(); }
  renderSteps(); renderOptbar();
  closeSideNarrow();
}

function seg(opt, cur, items) { return `<div class="seg" role="group">${items.map(([v, l, dot]) => `<button class="${cur === v ? 'on' : ''}" data-opt="${opt}" data-v="${v}">${dot ? `<span class="dotc" style="background:${dot}"></span>` : ''}${l}</button>`).join('')}</div>`; }
function renderOptbar() {
  const t = S.tool; let tool = '', body = '';
  const hint = arr => `<div class="ob-hint">${arr.map(x => `<span>${x}</span>`).join('')}</div>`;
  const head = (icon, name) => `<div class="ob-tool"><span class="ico">${ic(icon)}</span>${name}</div>`;
  if (t === 'select' && S.step === 'photo') {
    tool = head('photo', 'Foto');
    body = img ? `<span class="ob-field mono">${esc(img.name || 'foto')} · ${img.w}×${img.h} px</span><button class="btn sm" data-opt="pickimg">Vaheta foto</button><button class="btn sm" data-opt="rot">Pööra 90°</button><button class="btn sm" data-opt="flip">Peegelda</button>` + hint(['Nähtavust muudad all olevast liugurist', 'Järgmine samm: mõõtkava'])
      : `<button class="btn sm primary" data-opt="pickimg">Vali foto</button>` + hint(['Lohista foto aknasse või kleebi <kbd>Ctrl</kbd>+<kbd>V</kbd>']);
  } else if (t === 'select') {
    tool = head('select', 'Vali');
    body = hint(['Klõpsa valimiseks, lohista liigutamiseks', '<kbd>Shift</kbd> lisab valikusse', '<kbd>R</kbd> 90°', '<kbd>Q</kbd>/<kbd>E</kbd> peenpööre', '<kbd>F</kbd> teisele poolele', '<kbd>Del</kbd> kustutab']);
  } else if (t === 'pan') {
    tool = head('pan', 'Liiguta vaadet'); body = hint(['Lohista vaate nihutamiseks', 'rullik suumib', 'tühik + lohistamine töötab igas tööriistas']);
  } else if (t === 'place') {
    const def = DEF[S.placeType];
    tool = head('place', 'Paiguta: ' + esc(def ? def.name : ''));
    body = hint(['Klõpsa plaadil, kuhu komponent käib', '<kbd>R</kbd> pöörab 90° (praegu ' + S.placeRot + '°)', '<kbd>Esc</kbd> lõpetab']);
  } else if (t === 'trace') {
    tool = head('trace', 'Rada');
    body = seg('layer', S.traceLayer, [['top', 'Pealmine', 'var(--top)'], ['bottom', 'Alumine', 'var(--bottom)'], ['wire', 'Juhe', 'var(--wire)']]) +
      `<label class="ob-field">Laius <input class="inp" id="obW" inputmode="decimal" value="${fmtN(S.traceW, 2)}"> mm</label>` +
      hint(S.draft ? ['Klõpsa käänupunkte', 'lõpeta jalal, rajal või topeltklõpsuga', '<kbd>Shift</kbd> 45°', '<kbd>Backspace</kbd> samm tagasi', '<kbd>Esc</kbd> katkestab'] : ['Alusta jalast, punktist või rajalt', '<kbd>L</kbd> vahetab kihti']);
  } else if (t === 'point') {
    tool = head('point', 'Punkt plaadil');
    body = seg('ptype', S.pointType, POINT_TYPES) + hint(['Klõpsa plaadil', 'rajale klõpsates kinnitub punkt rajale']);
  } else if (t === 'pin') {
    const c = [...S.sel].map(compById).find(Boolean);
    tool = head('pin', 'Lisa jalg');
    body = `<span class="ob-field">${c ? 'Komponent <b class="mono">' + esc(c.ref) + '</b>' : 'Vali komponent või klõpsa selle peale'}</span>` +
      `<label class="ob-field">Suurus <input class="inp" id="obPin" inputmode="decimal" placeholder="auto" value="${S.pinSize > 0 ? fmtN(S.pinSize, 2) : ''}"> mm</label>` +
      hint(['Klõpsa komponendil kohta, kus jalg on', 'jalg saab järgmise numbri', 'nime annad vasakul paneelil']);
  } else if (t === 'measure') {
    tool = head('measure', 'Mõõt');
    body = hint(S.draft && S.draft.b ? ['Vii hiir küljele ja klõpsa, et mõõtjoon paika panna'] : ['Klõpsa alguspunkt ja lõpp-punkt', 'haakub jalgade ja rajapunktidega', '<kbd>Shift</kbd> horisontaalne/vertikaalne']);
  } else if (t === 'outline') {
    tool = head('outline', 'Plaadi kontuur'); body = hint(['Lohista ristkülik ümber plaadi serva', 'kontuuri vasak ülanurk on koordinaatide nullpunkt']);
  } else if (t === 'calib') {
    tool = head('calib', 'Mõõtkava');
    body = `<label class="ob-field">px/mm <input class="inp" id="obPpm" inputmode="decimal" value="${fmtN(doc.ppm, 3)}"></label>` +
      hint(['Klõpsa kaks punkti, mille vahekaugust tead', 'nt pinnirea 4 sammu = 10,16 mm või plaadi laius']);
  }
  $('#optbar').innerHTML = tool + body;
}

/* ---- sidebar ---- */
const tabBody = $('#tabBody');
function setTab(t) { S.tab = t; renderSide(); }
function renderTabs() {
  const N = getNets();
  const tabs = [['lib', 'Teek', ''], ['board', 'Plaadil', doc.comps.length + doc.traces.length], ['nets', 'Võrgud', N.list.length]];
  $('#tabs').innerHTML = tabs.map(([k, l, n]) => `<button class="tab" role="tab" aria-selected="${S.tab === k}" data-tab="${k}">${l}${n !== '' ? `<span class="count">${n}</span>` : ''}</button>`).join('') +
    `<button class="icon-btn side-close" id="sideClose" aria-label="Sulge paneel">${ic('x')}</button>`;
}
function renderSide() {
  const a = document.activeElement, keep = a && tabBody.contains(a) && a.id ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
  const top = tabBody.scrollTop;
  renderTabs();
  tabBody.innerHTML = S.tab === 'lib' ? renderLib() : S.tab === 'board' ? renderBoard() : renderNets();
  tabBody.scrollTop = top;
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { if (keep.s != null) el.setSelectionRange(keep.s, keep.e); } catch (e) { } } }
}
function renderLib() {
  const q = S.libQ.trim().toLowerCase();
  let h = `<div class="search">${ic('search')}<input id="libQ" type="search" placeholder="Otsi: SOIC, LED, USB…" value="${esc(S.libQ)}" autocomplete="off" aria-label="Otsi komponenti"></div>`;
  h += `<p class="hint-s">Lohista komponent plaadile või klõpsa ja paiguta. Mõõdud on millimeetrites, nii et pärast kalibreerimist on korpus õige suurusega.</p>`;
  let any = false;
  for (const [cat, label] of CATS) {
    const items = LIB.filter(d => d.cat === cat && (!q || (d.name + ' ' + d.kw + ' ' + d.prefix).toLowerCase().includes(q)));
    if (!items.length) continue; any = true;
    h += `<section><h3 class="sec-h">${label}<span class="count">${items.length}</span></h3><div class="tiles">` +
      items.map(d => `<button class="tile${S.tool === 'place' && S.placeType === d.key ? ' active' : ''}" draggable="true" data-type="${d.key}" title="${esc(d.name)} — tähis ${d.prefix}">${thumb(d)}<span>${esc(d.name)}</span></button>`).join('') + `</div></section>`;
  }
  if (!any) h += `<div class="empty">Sellist komponenti ei leitud. Proovi „Kohandatud“ — sellele saad ise jalad lisada.</div>`;
  return h;
}
function connSummary(c) {
  const N = getNets(), f = compFP(c); let linked = 0;
  for (const p of f.pins) if (N.byPin.has(c.id + ':' + p.id)) linked++;
  return { pins: f.pins.length, linked };
}
function rowHead(id, ref, meta, badges, sw) {
  return `<button class="row-head" data-act="pick" data-id="${id}">${sw ? `<span class="swatch" style="background:${sw}"></span>` : `<span class="ref">${esc(ref)}</span>`}<span class="meta">${sw ? `<b class="ref">${esc(ref)}</b> ` : ''}${meta}</span><span class="badges">${badges}</span></button>`;
}
function renderBoard() {
  const q = S.boardQ.trim().toLowerCase(), N = getNets();
  const match = s => !q || s.toLowerCase().includes(q);
  const open = S.sel.size === 1 ? [...S.sel][0] : null;
  const comps = doc.comps.filter(c => match(c.ref + ' ' + c.value + ' ' + fpLabel(c)));
  const groups = [['Komponendid', comps.filter(c => !isPoint(c) && !isConn(c))], ['Konnektorid', comps.filter(isConn)], ['Punktid plaadil', comps.filter(isPoint)]];
  let h = `<div class="search">${ic('search')}<input id="boardQ" type="search" placeholder="Otsi tähise või väärtuse järgi" value="${esc(S.boardQ)}" autocomplete="off" aria-label="Otsi plaadilt"></div>`;
  h += `<div class="summary"><span class="chip"><b>${doc.comps.filter(c => !isPoint(c)).length}</b> komponenti</span><span class="chip"><b>${doc.comps.filter(isPoint).length}</b> punkti</span><span class="chip"><b>${doc.traces.length}</b> rada</span><span class="chip"><b>${N.list.length}</b> võrku</span></div>`;
  if (!doc.comps.length && !doc.traces.length) h += `<div class="empty">Plaadil pole veel midagi. Ava <b>Teek</b> ja lohista esimene komponent foto peale.</div>`;
  for (const [label, list] of groups) {
    if (!list.length) continue;
    h += `<section><h3 class="sec-h">${label}<span class="count">${list.length}</span></h3><div class="group">`;
    for (const c of list) {
      const cs = connSummary(c);
      const badges = `<span class="badge${cs.linked ? ' ok' : ''}" title="ühendatud / kõik jalad">${cs.linked}/${cs.pins}</span>`;
      h += `<div class="row${open === c.id ? ' open' : ''}">${rowHead(c.id, c.ref, `${esc(c.value || '')} <i>${esc(fpLabel(c))}</i>`, badges)}${open === c.id ? inspComp(c) : ''}</div>`;
    }
    h += `</div></section>`;
  }
  const traces = doc.traces.filter(t => { const n = N.byTrace.get(t.id); return match((n ? n.name : '') + ' ' + epText(t.a) + ' ' + epText(t.b)); });
  if (traces.length) {
    h += `<section><h3 class="sec-h">Rajad<span class="count">${traces.length}</span></h3><div class="group">`;
    for (const t of traces) {
      const n = N.byTrace.get(t.id), len = polyLen(tracePts(t)) / doc.ppm;
      h += `<div class="row${open === t.id ? ' open' : ''}">${rowHead(t.id, n ? n.name : '—', `${esc(epText(t.a))} → ${esc(epText(t.b))}`, `<span>${fmtN(len, 1)}</span>`, ui.netColors && n ? n.color : layerVar(t.layer))}${open === t.id ? inspTrace(t, n, len) : ''}</div>`;
    }
    h += `</div></section>`;
  }
  const mech = [...doc.outlines.map(o => ['o', o]), ...doc.dims.map(d => ['d', d])];
  if (mech.length) {
    h += `<section><h3 class="sec-h">Mõõdud ja kontuur<span class="count">${mech.length}</span></h3><div class="group">`;
    for (const [k, o] of mech) {
      const txt = k === 'o' ? `Kontuur <i>${fmtN(o.w / doc.ppm)} × ${fmtN(o.h / doc.ppm)} mm</i>` : `Mõõt <i>${fmtMM(dist(epPos(o.a), epPos(o.b)) / doc.ppm)}</i>`;
      h += `<div class="row${open === o.id ? ' open' : ''}">${rowHead(o.id, '', txt, '', 'var(--dim)')}${open === o.id ? (k === 'o' ? inspOutline(o) : inspDim(o)) : ''}</div>`;
    }
    h += `</div></section>`;
  }
  return h;
}
const epText = ep => ep.c ? pinLabel(ep.c, ep.p) : 'vaba punkt';
function paramField(def, c, p) {
  const v = (c.params && c.params[p.k] != null) ? c.params[p.k] : p.d, id = 'pp-' + p.k;
  if (p.o) return `<label class="f">${p.l}<select id="${id}" data-param="${p.k}">${p.o.map(o => `<option${String(o) === String(v) ? ' selected' : ''}>${o}</option>`).join('')}</select></label>`;
  return `<label class="f">${p.l}<input id="${id}" class="mono" data-param="${p.k}" data-num="1" inputmode="decimal" value="${esc(String(v).replace('.', ','))}"></label>`;
}
function inspComp(c) {
  const def = DEF[c.type], f = compFP(c), N = getNets(), [mx, my] = toMM([c.x, c.y]);
  let h = `<div class="insp" data-cid="${c.id}">`;
  h += `<div class="g2"><label class="f">Tähis<input id="i-ref" class="mono" data-f="ref" value="${esc(c.ref)}"></label><label class="f">Väärtus / tüüp<input id="i-val" data-f="value" value="${esc(c.value)}" placeholder="nt 10k, ATmega328"></label></div>`;
  h += `<div class="fp-name">Korpus <b>${esc(def.name)}</b></div>`;
  if (def.params.length) h += `<div class="g2">${def.params.map(p => paramField(def, c, p)).join('')}</div>`;
  h += `<div class="g3"><label class="f">X (mm)<input id="i-x" class="mono" data-f="x" inputmode="decimal" value="${fmtN(mx)}"></label><label class="f">Y (mm)<input id="i-y" class="mono" data-f="y" inputmode="decimal" value="${fmtN(my)}"></label><label class="f">Pööre (°)<input id="i-rot" class="mono" data-f="rot" inputmode="decimal" value="${fmtN(c.rot, 1)}"></label></div>`;
  h += `<div class="lblrow">Pool ${seg('side', c.side, [['top', 'Pealmine'], ['bottom', 'Alumine']])}</div>`;
  h += `<div class="pins-h"><h4>Jalad <span class="count">${f.pins.length}</span></h4><button class="btn sm" data-act="addpin">+ Lisa jalg</button></div><div class="pins">`;
  f.pins.forEach((p, i) => {
    const n = N.byPin.get(c.id + ':' + p.id), on = S.selPin && S.selPin.c === c.id && S.selPin.p === p.id;
    const others = n ? n.pins.filter(q => !(q.c === c.id && q.p === p.id)).map(q => pinLabel(q.c, q.p)) : [];
    h += `<div class="pin${on ? ' on' : ''}" data-pin="${esc(p.id)}"><span class="pid" data-act="selpin" title="Näita joonisel">${esc(p.id)}</span><input id="pn-${i}" data-pn="${esc(p.id)}" value="${esc(p.name)}" placeholder="nimi" aria-label="Jala ${esc(p.id)} nimi">` +
      (n ? `<button class="net-chip" style="--nc:${n.color}" data-act="hlnet" data-net="${n.key}" title="Võrk ${esc(n.name)}">${esc(n.name)}</button>` : `<span class="net-chip none">—</span>`) +
      `<span class="pact"><button class="mini" data-act="tracefrom" title="Alusta rada sellest jalast">${ic('route')}</button>${p.extra ? `<button class="mini" data-act="delpin" title="Kustuta jalg">${ic('x')}</button>` : ''}</span>` +
      (others.length ? `<span class="conn">→ ${esc(others.join(' · '))}</span>` : '') + `</div>`;
  });
  h += `</div>`;
  h += `<label class="f">Märkused<textarea id="i-note" data-f="note" placeholder="nt märgistus kiibil, kahtlused…">${esc(c.note || '')}</textarea></label>`;
  h += `<div class="actions"><button class="btn sm" data-act="dup">Dubleeri</button><button class="btn sm" data-act="rot90">Pööra 90°</button><button class="btn sm danger" data-act="del">${ic('trash')}Kustuta</button></div></div>`;
  return h;
}
function inspTrace(t, n, len) {
  return `<div class="insp" data-tid="${t.id}">` +
    `<div class="lblrow">Kiht ${seg('tlayer', t.layer, [['top', 'Pealm.', 'var(--top)'], ['bottom', 'Alum.', 'var(--bottom)'], ['wire', 'Juhe', 'var(--wire)']])}</div>` +
    `<div class="g2"><label class="f">Laius (mm)<input id="t-w" class="mono" data-tf="w" inputmode="decimal" value="${fmtN(t.w)}"></label><label class="f">Võrgu nimi<input id="t-net" class="mono" data-tf="net" value="${esc(n && n.named ? n.name : '')}" placeholder="${esc(n ? n.name : '')}"></label></div>` +
    `<div class="kv">Pikkus <b>${fmtMM(len)}</b></div><div class="kv">Ühendab <b>${esc(epText(t.a))} → ${esc(epText(t.b))}</b></div><div class="kv">Käänupunkte <b>${t.pts.length}</b></div>` +
    `<p class="hint-s">Lohista otspunkte ja käänupunkte joonisel. Topeltklõps rajal lisab käänupunkti, <kbd>Alt</kbd>+klõps eemaldab.</p>` +
    `<div class="actions"><button class="btn sm danger" data-act="del">${ic('trash')}Kustuta rada</button></div></div>`;
}
function inspDim(d) {
  return `<div class="insp"><div class="kv">Kaugus <b>${fmtMM(dist(epPos(d.a), epPos(d.b)) / doc.ppm)}</b></div><div class="kv">Algus <b>${esc(epText(d.a))}</b></div><div class="kv">Lõpp <b>${esc(epText(d.b))}</b></div><div class="actions"><button class="btn sm danger" data-act="del">${ic('trash')}Kustuta</button></div></div>`;
}
function inspOutline(o) {
  return `<div class="insp" data-oid="${o.id}"><div class="g2"><label class="f">Laius (mm)<input id="o-w" class="mono" data-of="w" inputmode="decimal" value="${fmtN(o.w / doc.ppm)}"></label><label class="f">Kõrgus (mm)<input id="o-h" class="mono" data-of="h" inputmode="decimal" value="${fmtN(o.h / doc.ppm)}"></label></div>` +
    `<label class="chk"><input type="checkbox" id="o-dims" data-of="dims"${o.dims !== false ? ' checked' : ''}> Näita mõõte joonisel</label>` +
    `<p class="hint-s">Kontuuri vasak ülanurk on koordinaatide nullpunkt (X paremale, Y alla).</p><div class="actions"><button class="btn sm danger" data-act="del">${ic('trash')}Kustuta</button></div></div>`;
}
function renderNets() {
  const N = getNets();
  let h = `<div class="summary"><span class="chip"><b>${N.list.length}</b> võrku</span><span class="chip"><b>${N.list.reduce((s, n) => s + n.pins.length, 0)}</b> ühendatud jalga</span></div>`;
  h += `<div class="actions"><label class="chk"><input type="checkbox" id="netColors"${ui.netColors ? ' checked' : ''}> Värvi rajad võrgu järgi</label></div>`;
  if (!N.list.length) return h + `<div class="empty">Võrgud tekivad radadest. Vali tööriist <b>Rada</b> (<kbd>T</kbd>), klõpsa ühel jalal ja siis teisel — need jalad on nüüd samas võrgus. Anna võrgule nimi, nt GND või 3V3.</div>`;
  const hl = S.hlNet || S.hlPinned;
  for (const n of N.list) {
    h += `<div class="net${hl === n.key ? ' on' : ''}" data-net="${n.key}"><div class="net-top"><span class="swatch" style="background:${n.color}"></span><input class="net-name" id="nn-${n.key}" data-netname="${n.key}" value="${esc(n.named ? n.name : '')}" placeholder="${esc(n.name)}" aria-label="Võrgu nimi"><span class="nstat">${n.pins.length} jalga · ${fmtN(n.len, 1)} mm</span></div>`;
    h += `<div class="members">${n.pins.map(p => { const c = compById(p.c), pn = c ? compFP(c).pinMap.get(p.p) : null; return `<button class="mem" data-act="pingo" data-c="${p.c}" data-p="${esc(p.p)}">${esc(pinLabel(p.c, p.p))}${pn && pn.name ? ` <i>${esc(pn.name)}</i>` : ''}</button>`; }).join('') || '<span class="hint-s">Ühtki jalga pole veel ühendatud</span>'}</div></div>`;
  }
  return h;
}

/* ---- bottom strip ---- */
function renderStatus() {
  const ch = $('#scaleChip');
  ch.textContent = doc.calibrated ? fmtN(doc.ppm, 2) + ' px/mm' : 'Kalibreerimata';
  ch.classList.toggle('warn', !doc.calibrated);
  applyView();
}
function renderLayersPop() {
  const L = ui.layers;
  const row = (k, l, sw) => `<label class="chk"><input type="checkbox" data-layer="${k}"${L[k] ? ' checked' : ''}>${sw ? `<span class="sw" style="background:${sw}"></span>` : ''}${l}</label>`;
  $('#layersPop').innerHTML = `<h4>Nähtavad kihid</h4>` + row('img', 'Foto') + row('body', 'Komponentide kered') + row('pads', 'Jalad ja padid', 'var(--pad)') + row('top', 'Rajad – pealmine', 'var(--top)') + row('bottom', 'Rajad – alumine', 'var(--bottom)') + row('wire', 'Juhtmed', 'var(--wire)') + row('dims', 'Mõõdud ja kontuur', 'var(--dim)') + row('labels', 'Tähised') + row('pinl', 'Jalgade numbrid');
}

/* ---- banner (sample project) ---- */
function renderBanner() {
  const b = $('#banner');
  b.hidden = !(doc.sample && !ui.bannerOff);
  if (b.hidden) return;
  b.innerHTML = `<button class="icon-btn x" data-ban="close" aria-label="Peida">${ic('x')}</button><h3>Näidisplaat <span class="tag">näide</span></h3><p>Osa komponente ja radu on juba paigas, ülejäänud (R2, Q1, J2, C3 ja punktid) ootavad sind. Proovi lohistada, märkida radu ja mõõta — või alusta oma fotoga.</p><div class="actions"><button class="btn sm primary" data-ban="photo">Lae oma foto</button><button class="btn sm" data-ban="empty">Tühi projekt</button></div>`;
}

/* ---- toasts & modals ---- */
function toast(msg, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = msg;
  const box = $('#toasts'); box.appendChild(t);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => t.remove(), 2600);
}
const modal = $('#modal');
function openModal(html, wide = false) {
  modal.onclick = null;
  modal.innerHTML = `<div class="dlg${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  modal.hidden = false;
  const f = modal.querySelector('[autofocus]') || modal.querySelector('input,button.primary,button');
  if (f) setTimeout(() => { f.focus(); if (f.select) f.select(); }, 10);
}
function closeModal() {
  modal.hidden = true; modal.innerHTML = ''; modal.onclick = null;
  if (S.draft && S.draft.kind === 'calib' && S.draft.b) { S.draft = null; schedule('over'); }
}
function confirmDlg(title, text, ok = 'Jätka', danger = false) {
  return new Promise(res => {
    openModal(`<h2>${title}</h2><p>${text}</p><div class="dlg-foot"><button class="btn" data-r="0">Tühista</button><button class="btn ${danger ? 'danger' : 'primary'}" data-r="1" autofocus>${ok}</button></div>`);
    modal.onclick = e => { const b = e.target.closest('[data-r]'); if (b || e.target === modal) { modal.onclick = null; closeModal(); res(!!(b && b.dataset.r === '1')); } };
  });
}
function openHelp() {
  const K = [['V', 'Vali'], ['H / tühik', 'Liiguta vaadet'], ['T', 'Rada'], ['J', 'Lisa jalg'], ['P', 'Punkt'], ['M', 'Mõõt'], ['O', 'Kontuur'], ['K', 'Kalibreeri'], ['R / Shift+R', 'Pööra ±90°'], ['Q / E', 'Pööra ±1° (Shift ±15°)'], ['F', 'Teisele poolele'], ['L', 'Raja kiht'], ['Ctrl+D', 'Dubleeri'], ['Del', 'Kustuta'], ['Nooled', 'Nihuta'], ['Ctrl+Z / Ctrl+Y', 'Tagasi / uuesti'], ['Ctrl+S', 'Salvesta projekt'], ['0 / + / −', 'Sobita / suumi'], ['Enter', 'Lõpeta rada'], ['Esc', 'Katkesta']];
  openModal(`<h2>Kiirklahvid</h2><div class="keys">${K.map(([k, l]) => `<div><span>${l}</span><kbd>${k}</kbd></div>`).join('')}</div><p>Hiire rullik suumib kursori ümber, keskmise nupuga lohistamine liigutab vaadet. Puutetundlikul ekraanil suumi kahe sõrmega.</p><div class="dlg-foot"><button class="btn primary" data-close>Selge</button></div>`, true);
}
function closeSideNarrow() { $('#app').classList.remove('side-open'); }
