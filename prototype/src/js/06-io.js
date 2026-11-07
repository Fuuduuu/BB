/* ================= files: photo, project, export ================= */
const readURL = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
const readText = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsText(file); });
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Pilti ei saanud avada')); i.src = src; });

async function loadImageFile(file) {
  try {
    let src = await readURL(file), im = await loadImg(src);
    let w = im.naturalWidth, h = im.naturalHeight;
    const MAX = 6000;
    if (Math.max(w, h) > MAX) {
      const k = MAX / Math.max(w, h), cv = document.createElement('canvas');
      cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      src = cv.toDataURL('image/jpeg', .92); w = cv.width; h = cv.height;
      toast('Väga suur foto vähendati 6000 px-ni');
    }
    const fresh = doc.sample;
    if (fresh) { doc = newDoc(); doc.name = (file.name || 'Plaat').replace(/\.[^.]+$/, ''); doc.ppm = f2(w / 100); S.sel.clear(); S.selPin = null; S.hlPinned = null; }
    img = { src, w, h, name: file.name || 'foto' };
    renderImage(); saveImage();
    if (fresh) resetHistory();
    commit(); fitView(); renderBanner();
    if (!doc.calibrated) { setTool('calib'); toast('Foto laetud — nüüd kalibreeri mõõtkava'); }
    else toast('Foto vahetatud, komponendid jäid alles');
  } catch (err) { toast('Seda faili ei õnnestunud pildina avada', 'warn'); }
}
async function handleFiles(files) {
  const f = [...files][0]; if (!f) return;
  if (/\.json$/i.test(f.name) || f.type === 'application/json') return loadProjectFile(f);
  if (f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name)) return loadImageFile(f);
  toast('Toetatud on fotod (JPG, PNG, WebP) ja projektifailid (.json)', 'warn');
}
async function loadProjectFile(f) {
  try {
    const data = JSON.parse(await readText(f));
    if (!data || data.app !== 'pcb-kaardistaja' || !data.doc) throw new Error('vale fail');
    doc = { ...newDoc(), ...data.doc, sample: false };
    img = data.img || null;
    if (data.ui) { Object.assign(ui, data.ui); ui.layers = { ...DEFAULT_LAYERS, ...(data.ui.layers || {}) }; }
    S.sel.clear(); S.selPin = null; S.hlPinned = null; S.draft = null;
    touch(); resetHistory(); renderImage(); saveImage(); renderAll(); fitView(); renderBanner(); queueSave();
    toast(`Avatud: ${doc.name}`);
  } catch (e) { toast('See ei ole PCB Kaardistaja projektifail', 'warn'); }
}
const dlCap = (window.claude && typeof window.claude.use === 'function') ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null);
async function saveFile(name, data, mime) {
  const cap = await Promise.race([dlCap, new Promise(r => setTimeout(() => r(null), 1500))]);
  if (cap) {
    try { await cap.save({ filename: name, data }); toast('Salvestatud: ' + name); return true; }
    catch (e) { if (e && e.code === 'declined') return false; toast('Salvestamine ei õnnestunud: ' + ((e && e.message) || 'tundmatu viga'), 'warn'); return false; }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Salvestatud: ' + name); return true;
  } catch (e) { toast('Brauser ei lubanud faili salvestada', 'warn'); return false; }
}
const safeName = () => (doc.name || 'plaat').trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-') || 'plaat';
function saveProject() {
  const data = JSON.stringify({ app: 'pcb-kaardistaja', v: 1, saved: new Date().toISOString(), doc: { ...doc, sample: false }, img, ui });
  saveFile(safeName() + '.pcbmap.json', data, 'application/json');
}

/* ---- export ---- */
const PAL = { top: '#d23c25', bottom: '#2a64c8', wire: '#c08000', ink: '#16201c', ink2: '#4a5852', pad: '#d0a630', padEdge: '#6a510b', padInk: '#241a03', drill: '#ffffff', body: '#14201b', dim: '#9c2c94', bodyFill: 'rgba(20,32,27,.05)' };
const EXPORT_CSS = `.fp-halo{display:none}.fp-body>*{fill:${PAL.bodyFill};stroke:${PAL.body};stroke-width:.12}.fp-marks>*{fill:none;stroke:${PAL.body};stroke-width:.12}.fp-marks>.dot{fill:${PAL.body};stroke:none}.pad{fill:${PAL.pad};stroke:${PAL.padEdge};stroke-width:.05}.pad.extra{fill:#c9772f}.drill{fill:${PAL.drill}}.lbl{font-family:Consolas,'Courier New',monospace;font-weight:700;fill:${PAL.ink};text-anchor:middle;dominant-baseline:central;stroke:#fff;paint-order:stroke;stroke-linejoin:round}.lbl.val{font-weight:400;fill:${PAL.ink2}}.pinl{font-family:Consolas,monospace;font-weight:700;fill:${PAL.padInk};text-anchor:middle;dominant-baseline:central}.pinn{font-family:Consolas,monospace;fill:${PAL.ink};text-anchor:middle;dominant-baseline:central;stroke:#fff;paint-order:stroke}.t-line{fill:none;stroke-linecap:round;stroke-linejoin:round}.dimg line{stroke:${PAL.dim};fill:none}.dimg polygon{fill:${PAL.dim}}.dimg text{font-family:Consolas,monospace;font-weight:700;fill:${PAL.dim};text-anchor:middle;dominant-baseline:central;stroke:#fff;paint-order:stroke}.o-line{fill:none;stroke:${PAL.dim};stroke-dasharray:${2 * 1}mm 1mm}.o-hit,.hit,.t-hit,.d-hit{display:none}.dimmed{opacity:1}`;
function exportRegion() {
  const o = doc.outlines[0], m = 8 * doc.ppm;
  if (o) return [o.x - m, o.y - m, o.w + 2 * m, o.h + 2 * m];
  const [x0, y0, x1, y1] = contentBounds(); return [x0, y0, x1 - x0, y1 - y0];
}
function buildSVG(withPhoto) {
  const [x, y, w, h] = exportRegion(), ppm = doc.ppm;
  const z = 11 / (1.1 * ppm); // labels ≈ 1.1 mm tall
  const body = sceneMarkup({ export: true, z, pal: PAL });
  // component strokes live inside mm-scaled groups; dimension and outline strokes are in photo pixels
  const css = EXPORT_CSS + `.dimg line,.o-line{stroke-width:${f2(.15 * ppm)}}.o-line{stroke-dasharray:${f2(2 * ppm)} ${f2(1 * ppm)}}`;
  const photo = withPhoto && img ? `<image href="${img.src}" xlink:href="${img.src}" x="0" y="0" width="${img.w}" height="${img.h}" opacity="${ui.opacity}" preserveAspectRatio="none"/>` : '';
  const fs = f2(2.2 * ppm), tb = `<g font-family="Consolas,monospace" fill="${PAL.ink2}" font-size="${f2(1.6 * ppm)}"><text x="${f2(x + w - 2 * ppm)}" y="${f2(y + h - 2 * ppm)}" text-anchor="end"><tspan font-weight="700" font-size="${fs}" fill="${PAL.ink}">${esc(doc.name)}</tspan>  ·  1:1 mm  ·  ${new Date().toLocaleDateString('et-EE')}</text></g>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${f2(w / ppm)}mm" height="${f2(h / ppm)}mm" viewBox="${f2(x)} ${f2(y)} ${f2(w)} ${f2(h)}"><title>${esc(doc.name)}</title><style>${css}</style><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="#ffffff"/>${photo}${body}${tb}</svg>`;
}
const vectorFixup = s => s.replace(/vector-effect="non-scaling-stroke"/g, '');
async function exportPNG(withPhoto) {
  const [x, y, w, h] = exportRegion();
  const k = clamp(4000 / Math.max(w, h), 1, 3), cv = document.createElement('canvas');
  cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  if (withPhoto && img) { const im = await loadImg(img.src); g.globalAlpha = ui.opacity; g.drawImage(im, -x * k, -y * k, img.w * k, img.h * k); g.globalAlpha = 1; }
  const s = buildSVG(false).replace(/<rect x="[^"]+" y="[^"]+" width="[^"]+" height="[^"]+" fill="#ffffff"\/>/, '');
  const url = URL.createObjectURL(new Blob([s], { type: 'image/svg+xml' }));
  try { const im = await loadImg(url); g.drawImage(im, 0, 0, cv.width, cv.height); } finally { URL.revokeObjectURL(url); }
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  return saveFile(safeName() + '.png', blob, 'image/png');
}
const csvCell = v => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csv = rows => '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n');
function netlistCSV() {
  const rows = [['Võrk', 'Tähis', 'Jalg', 'Jala nimi', 'Väärtus', 'Korpus']];
  for (const n of getNets().list) for (const p of n.pins) { const c = compById(p.c), pn = compFP(c).pinMap.get(p.p); rows.push([n.name, c.ref, p.p, pn ? pn.name : '', c.value, fpLabel(c)]); }
  return csv(rows);
}
function netlistText() { return getNets().list.map(n => `${n.name}: ${n.pins.map(p => pinLabel(p.c, p.p)).join(', ')}`).join('\n'); }
function bomCSV() {
  const rows = [['Tähis', 'Väärtus', 'Korpus', 'Pool', 'X (mm)', 'Y (mm)', 'Pööre (°)', 'Jalgu', 'Märkused']];
  const list = [...doc.comps].sort((a, b) => a.ref.localeCompare(b.ref, 'et', { numeric: true }));
  for (const c of list) { const [x, y] = toMM([c.x, c.y]); rows.push([c.ref, c.value, fpLabel(c), c.side === 'bottom' ? 'alumine' : 'pealmine', fmtN(x), fmtN(y), fmtN(c.rot, 1), compFP(c).pins.length, c.note || '']); }
  return csv(rows);
}
function openExport() {
  openModal(`<h2>Ekspordi</h2><p>Mõõtkava ${doc.calibrated ? '<b class="mono">' + fmtN(doc.ppm) + ' px/mm</b>' : '<b>pole kalibreeritud</b> — millimeetrid on hinnangulised'}. Ala: ${doc.outlines.length ? 'plaadi kontuur + 8 mm varu' : 'kogu foto'}.</p>
  <label class="f">Projekti nimi (failinimeks)<input id="exName" value="${esc(doc.name)}" autocomplete="off"></label>
  <label class="chk"><input type="checkbox" id="exPhoto"${S.exPhoto ? ' checked' : ''}> Lisa foto taustaks (SVG ja PNG)</label>
  <div class="ex-grid">
    <button data-ex="svg"><b>Joonis · SVG</b><span>Vektorjoonis mõõtkavas 1:1, prinditav ja avatav CAD-is või Inkscape'is</span></button>
    <button data-ex="png"><b>Pilt · PNG</b><span>Kõrge eraldusvõimega pilt dokumentatsiooni jaoks</span></button>
    <button data-ex="net"><b>Võrguloend · CSV</b><span>Iga võrgu jalad koos nimedega</span></button>
    <button data-ex="bom"><b>Komponendid · CSV</b><span>Tähis, väärtus, korpus, pool ja asukoht mm</span></button>
    <button data-ex="json"><b>Projekt · JSON</b><span>Kogu töö koos fotoga, et hiljem jätkata</span></button>
    <button data-ex="copy"><b>Kopeeri võrguloend</b><span>Tekstina lõikelauale, nt „GND: U1.4, C1.2“</span></button>
  </div>
  <div class="dlg-foot"><button class="btn" data-close>Sulge</button></div>`, true);
}
async function runExport(kind) {
  const withPhoto = S.exPhoto;
  let ok = true;
  if (kind === 'svg') ok = await saveFile(safeName() + '.svg', vectorFixup(buildSVG(withPhoto)), 'image/svg+xml');
  else if (kind === 'png') ok = await exportPNG(withPhoto);
  else if (kind === 'net') ok = await saveFile(safeName() + '-vorgud.csv', netlistCSV(), 'text/csv');
  else if (kind === 'bom') ok = await saveFile(safeName() + '-komponendid.csv', bomCSV(), 'text/csv');
  else if (kind === 'json') { saveProject(); }
  else if (kind === 'copy') {
    const txt = netlistText() || '(võrke pole)';
    try { await navigator.clipboard.writeText(txt); toast('Võrguloend kopeeritud'); }
    catch (e) { openModal(`<h2>Võrguloend</h2><p>Kopeerimine polnud lubatud — vali tekst ja kopeeri käsitsi.</p><textarea class="inp mono" style="height:220px;padding:8px" readonly>${esc(txt)}</textarea><div class="dlg-foot"><button class="btn primary" data-close>Sulge</button></div>`, true); }
  }
  if (ok !== false) { S.exported = true; renderSteps(); }
}

/* ---- calibration dialog ---- */
function openCalib(px) {
  const presets = [['2,54', 'pinnisamm'], ['10,16', '4 sammu'], ['25,4', '1 toll'], ['5', ''], ['10', ''], ['50', ''], ['100', '']];
  openModal(`<h2>Kui pikk see lõik tegelikult on?</h2><p>Märkisid <b class="mono">${fmtN(px, 1)} px</b>. Sisesta sama lõigu tegelik pikkus, nt nihikuga mõõdetud plaadi serv või teadaolev jalgade samm.</p>
  <div class="big-inp"><input id="calMM" inputmode="decimal" placeholder="25,4" autocomplete="off" autofocus><span>mm</span></div>
  <div class="presets">${presets.map(([v, l]) => `<button data-cal="${v}">${v}${l ? ' · ' + l : ''}</button>`).join('')}</div>
  <p id="calOut" class="mono">&nbsp;</p>
  <div class="dlg-foot"><button class="btn" data-calx>Tühista</button><button class="btn primary" data-calok>Rakenda mõõtkava</button></div>`);
  const inp = $('#calMM'), out = $('#calOut');
  const upd = () => { const mm = parseNum(inp.value); out.textContent = mm > 0 ? `= ${fmtN(px / mm, 3)} px/mm · 1 px = ${fmtN(mm / px * 1000, 1)} µm` : ' '; };
  inp.addEventListener('input', upd);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') apply(); });
  const apply = () => {
    const mm = parseNum(inp.value);
    if (!(mm > 0)) { toast('Sisesta pikkus millimeetrites', 'warn'); inp.focus(); return; }
    doc.ppm = Math.round(px / mm * 10000) / 10000;
    doc.calibrated = true; doc.calib = { a: S.draft.a.map(f2), b: S.draft.b.map(f2), mm };
    S.draft = null; closeModal(); commit();
    toast(`Mõõtkava ${fmtN(doc.ppm)} px/mm — komponendid on nüüd õiges suuruses`);
  };
  modal.onclick = e => {
    const p = e.target.closest('[data-cal]');
    if (p) { inp.value = p.dataset.cal; upd(); inp.focus(); return; }
    if (e.target.closest('[data-calok]')) { apply(); return; }
    if (e.target.closest('[data-calx]') || e.target === modal) { modal.onclick = null; S.draft = null; closeModal(); schedule('over'); }
  };
}

/* ---- photo rotate / mirror (keeps everything aligned) ---- */
async function transformImage(kind) {
  if (!img) { toast('Fotot pole veel laetud', 'warn'); return; }
  refreshEndpoints();
  const im = await loadImg(img.src), W = img.w, H = img.h, cv = document.createElement('canvas'), g = cv.getContext('2d');
  if (kind === 'rot') { cv.width = H; cv.height = W; g.translate(H, 0); g.rotate(Math.PI / 2); }
  else { cv.width = W; cv.height = H; g.translate(W, 0); g.scale(-1, 1); }
  g.drawImage(im, 0, 0);
  const src = cv.toDataURL(/^data:image\/png/.test(img.src) ? 'image/png' : 'image/jpeg', .92);
  const T = kind === 'rot' ? ([x, y]) => [f2(H - y), f2(x)] : ([x, y]) => [f2(W - x), f2(y)];
  for (const c of doc.comps) { [c.x, c.y] = T([c.x, c.y]); if (kind === 'rot') c.rot = (c.rot + 90) % 360; else { c.side = c.side === 'bottom' ? 'top' : 'bottom'; c.rot = (360 - c.rot) % 360; } }
  const te = ep => { [ep.x, ep.y] = T([ep.x, ep.y]); };
  for (const t of doc.traces) { te(t.a); te(t.b); t.pts = t.pts.map(T); }
  for (const d of doc.dims) { te(d.a); te(d.b); if (kind === 'flip') d.off = -d.off; }
  for (const o of doc.outlines) { if (kind === 'rot') { const nx = H - (o.y + o.h), ny = o.x; o.x = nx; o.y = ny; [o.w, o.h] = [o.h, o.w]; } else o.x = W - o.x - o.w; }
  if (doc.calib) { doc.calib.a = T(doc.calib.a); doc.calib.b = T(doc.calib.b); }
  img = { ...img, src, w: cv.width, h: cv.height };
  renderImage(); saveImage(); commit(); fitView();
  toast(kind === 'rot' ? 'Foto pööratud 90°' : 'Foto peegeldatud');
}

async function newProject() {
  if (!doc.sample && (doc.comps.length || doc.traces.length)) {
    const ok = await confirmDlg('Alusta uut projekti?', 'Praegune töö kaob brauseri automaatsalvestusest. Kui tahad seda alles hoida, salvesta enne projektifail.', 'Alusta uut', true);
    if (!ok) return;
  }
  doc = newDoc(); img = null; S.sel.clear(); S.selPin = null; S.hlPinned = null; S.draft = null;
  touch(); resetHistory(); renderImage(); saveImage(); renderAll(); renderBanner(); fitView(); queueSave();
  S.step = 'photo'; renderSteps(); renderOptbar();
}
