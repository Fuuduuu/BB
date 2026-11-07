/* ================= sample board (procedural photo + half-finished map) ================= */
const SMP_COMPS = [
  // ref, type, x, y (board mm), rot, value, params, placed-in-demo, label [x,y]
  ['J1', 'usbc', 4.6, 25, 90, 'USB-C', {}, true, [4.1, 18.9]],
  ['U2', 'sot223', 22, 12, 180, 'AMS1117-3.3', {}, true, [22, 6.3]],
  ['C1', 'c_smd', 16, 20, 90, '10µ', { size: '0805' }, true, [13.8, 20]],
  ['C2', 'c_smd', 28, 20, 90, '10µ', { size: '0805' }, true, [30.2, 20]],
  ['U1', 'soic', 42, 24, 0, 'ATtiny85', { pins: '8', body: '3.9' }, true, [42, 29]],
  ['R1', 'r_smd', 52, 30, 0, '330', { size: '0805' }, true, [52, 28.3]],
  ['D1', 'led_smd', 58, 30, 180, 'roheline', { size: '0805' }, true, [58, 28.3]],
  ['R2', 'r_smd', 55, 22, 0, '1k', { size: '0805' }, false, [55, 20.6]],
  ['Q1', 'sot23', 62, 22, 0, 'BC847', { pins: '3' }, false, [59.6, 20.4]],
  ['J2', 'hdr1', 70, 25, 90, '', { pins: 4, pitch: '2.54' }, false, [70, 17.8]],
  ['C3', 'c_el', 30, 38, 0, '100µ', { D: '6.3', pitch: '2.5' }, false, [30, 33.6]],
  ['TP1', 'tp', 34, 16, 0, '', {}, false, [36.6, 16]],
  ['TP2', 'tp', 12, 14, 0, '', {}, false, [12, 12.1]],
  ['V1', 'via', 21, 34, 0, '', {}, false, null],
  ['V2', 'via', 18, 17, 0, '', {}, false, null],
  ['V3', 'via', 27, 8.85, 0, '', {}, false, null],
  ['H1', 'hole', 3.5, 3.5, 0, '', { D: '3.2' }, true, null],
  ['H2', 'hole', 72.5, 3.5, 0, '', { D: '3.2' }, false, null],
  ['H3', 'hole', 3.5, 46.5, 0, '', { D: '3.2' }, false, null],
  ['H4', 'hole', 72.5, 46.5, 0, '', { D: '3.2' }, false, null]
];
const SMP_PN = { U1: { 1: 'RESET', 2: 'PB3', 3: 'PB4', 4: 'GND', 5: 'PB0', 6: 'PB1', 7: 'PB2', 8: 'VCC' }, U2: { 1: 'GND', 2: 'VOUT', 3: 'VIN', 4: 'VOUT' }, J2: { 1: 'VCC', 2: 'OUT', 3: 'IO', 4: 'GND' } };
const SMP_TRACES = [
  // net, from, waypoints, to, width, in-demo
  ['VBUS', ['J1', 'A4B9'], [[12.4, 22.6]], ['C1', '1'], .8, true],
  ['VBUS', ['C1', '1'], [[16, 12.55]], ['U2', '3'], .8, true],
  ['VBUS', [16, 14], [], ['TP2', '1'], .5, false],
  ['VBUS', [16, 17], [], ['V2', '1'], .5, false],
  ['GND', ['J1', 'B1A12'], [[12, 28.2], [16, 24.2]], ['C1', '2'], .8, true],
  ['GND', ['C1', '2'], [], ['C2', '2'], .8, true],
  ['GND', ['C2', '2'], [[32, 21], [36.9, 25.9]], ['U1', '4'], .6, false],
  ['GND', ['U1', '4'], [[39.2, 28], [43.2, 32], [59, 32]], ['D1', '1'], .6, false],
  ['GND', ['U2', '1'], [], ['V3', '1'], .8, false],
  ['GND', ['J2', '4'], [[70, 30], [68, 32]], [59, 32], .6, false],
  ['GND', ['Q1', '2'], [], [62.95, 32], .5, false],
  ['GND', ['C3', '2'], [[35.2, 38], [41.2, 32]], [43.2, 32], .6, false],
  ['3V3', ['U2', '4'], [[22, 16.5], [24.5, 19]], ['C2', '1'], .8, true],
  ['3V3', ['C2', '1'], [[41.7, 19]], ['U1', '8'], .6, true],
  ['3V3', ['U1', '8'], [[47.55, 19.345], [68.155, 19.345]], ['J2', '1'], .6, false],
  ['3V3', [34, 19], [], ['TP1', '1'], .5, false],
  ['', ['U1', '6'], [[46.5, 24.635], [51, 29.135]], ['R1', '1'], .4, true],
  ['', ['R1', '2'], [], ['D1', '2'], .4, true],
  ['', ['U1', '7'], [[48.635, 23.365], [50, 22]], ['R2', '1'], .4, false],
  ['', ['R2', '2'], [[60.05, 22]], ['Q1', '1'], .4, false],
  ['', ['Q1', '3'], [[64.73, 23.73]], ['J2', '2'], .4, false],
  ['', ['C3', '1'], [[25, 38]], ['V1', '1'], .6, false]
];

function buildSample() {
  const ppm = 14, M = 48, BW = 76, BH = 50, W = Math.round(BW * ppm + 2 * M), H = Math.round(BH * ppm + 2 * M);
  const B = (x, y) => [M + x * ppm, M + y * ppm];
  const rnd = mulberry(7);
  const specs = SMP_COMPS.map(([ref, type, x, y, rot, value, params, placed, lbl]) => {
    const c = { id: 'tmp', type, ref, value, x: B(x, y)[0], y: B(x, y)[1], rot, side: 'top', params: { ...defaultParams(DEF[type]), ...params }, pn: SMP_PN[ref] || {}, extra: [] };
    return { c, placed, lbl, f: baseFP(type, c.params) };
  });
  const byRef = Object.fromEntries(specs.map(s => [s.c.ref, s]));
  doc = newDoc(); doc.ppm = ppm; touch();
  const pinXY = (ref, pid) => { const s = byRef[ref], p = s.f.pins.find(q => q.id === pid); return l2w(s.c, p.x, p.y); };
  const endXY = e => typeof e[0] === 'string' ? pinXY(e[0], e[1]) : B(e[0], e[1]);

  /* --- photo --- */
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  let gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#3a3631'); gr.addColorStop(1, '#201e1c');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < W * H / 14; i++) { const v = rnd(); g.fillStyle = `rgba(${v > .5 ? 255 : 0},${v > .5 ? 255 : 0},${v > .5 ? 255 : 0},${rnd() * .05})`; g.fillRect(rnd() * W, rnd() * H, 1.4, 1.4); }
  const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  g.save(); g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 26; g.shadowOffsetY = 10; rr(M, M, BW * ppm, BH * ppm, 2 * ppm); g.fillStyle = '#1b5638'; g.fill(); g.restore();
  g.save(); rr(M, M, BW * ppm, BH * ppm, 2 * ppm); g.clip();
  gr = g.createLinearGradient(M, M, M + BW * ppm, M + BH * ppm); gr.addColorStop(0, '#22694a'); gr.addColorStop(.55, '#1c5a3d'); gr.addColorStop(1, '#164a31');
  g.fillStyle = gr; g.fillRect(M, M, BW * ppm, BH * ppm);
  for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rnd() > .5 ? '190,240,200' : '0,20,10'},${rnd() * .07})`; g.fillRect(M + rnd() * BW * ppm, M + rnd() * BH * ppm, 1.2, 1.2); }
  // copper under mask
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const [, a, via, b, w] of SMP_TRACES) {
    const pts = [endXY(a), ...via.map(p => B(p[0], p[1])), endXY(b)];
    g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]));
    g.strokeStyle = '#2e7d50'; g.lineWidth = w * ppm; g.stroke();
    g.strokeStyle = 'rgba(170,230,180,.16)'; g.lineWidth = w * ppm * .35; g.stroke();
  }
  // silkscreen
  g.strokeStyle = '#e6eae0'; g.fillStyle = '#e6eae0'; g.lineWidth = .16 * ppm;
  for (const s of specs) {
    const { c, f, lbl } = s;
    if (DEF[c.type].cat !== 'point' && c.type !== 'usbc') {
      g.save(); g.translate(c.x, c.y); g.rotate(c.rot * DEG); g.scale(ppm, ppm); g.lineWidth = .16;
      const b = f.bbox; g.strokeRect(b.x0 - .35, b.y0 - .35, b.x1 - b.x0 + .7, b.y1 - b.y0 + .7);
      g.restore();
    }
    if (c.type === 'tp') { g.beginPath(); g.arc(c.x, c.y, 1.25 * ppm, 0, 7); g.stroke(); }
    if (lbl) { const [lx, ly] = B(lbl[0], lbl[1]); g.font = `700 ${Math.round(1.25 * ppm)}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.ref, lx, ly); }
  }
  g.font = `700 ${Math.round(1.6 * ppm)}px Arial, sans-serif`; g.textAlign = 'left'; g.fillText('BB-01  rev A', ...B(50, 45));
  g.font = `700 ${Math.round(1.4 * ppm)}px Arial, sans-serif`; g.fillText('+', ...B(25.6, 35.4));
  g.font = `600 ${Math.round(1.1 * ppm)}px Arial, sans-serif`; g.textAlign = 'center'; ['V', 'O', 'I', 'G'].forEach((t, i) => g.fillText(t, ...B(72.6, 21.19 + i * 2.54)));
  // pads (tin)
  for (const s of specs) for (const p of s.f.pins) {
    const [x, y] = l2w(s.c, p.x, p.y), w = p.w * ppm, h = p.h * ppm;
    g.save(); g.translate(x, y); g.rotate(s.c.rot * DEG);
    const pg = g.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); pg.addColorStop(0, '#e2e3dc'); pg.addColorStop(1, '#a9aba3'); g.fillStyle = pg;
    if (p.shape === 'circle' || (p.shape === 'oval' && p.w === p.h)) { g.beginPath(); g.arc(0, 0, w / 2, 0, 7); g.fill(); }
    else { const r = p.shape === 'oval' ? Math.min(w, h) / 2 : Math.min(w, h) * .12; rr(-w / 2, -h / 2, w, h, r); g.fill(); }
    if (p.drill) { g.fillStyle = '#141311'; g.beginPath(); g.arc(0, 0, p.drill / 2 * ppm, 0, 7); g.fill(); }
    g.restore();
  }
  // component bodies
  for (const s of specs) {
    const { c, f } = s, t = c.type, body = f.body[0];
    g.save(); g.translate(c.x, c.y); g.rotate(c.rot * DEG); g.scale(ppm, ppm);
    if (t === 'soic' || t === 'sot223' || t === 'sot23') {
      const b = body; g.fillStyle = '#c7c9c2';
      for (const p of f.pins) {
        if (p.x < b.x || p.x > b.x + b.w) { const x0 = p.x < b.x ? p.x : b.x + b.w, x1 = p.x < b.x ? b.x : p.x; g.fillRect(x0, p.y - p.h * .32, x1 - x0, p.h * .64); }
        else if (p.y < b.y || p.y > b.y + b.h) { const y0 = p.y < b.y ? p.y : b.y + b.h, y1 = p.y < b.y ? b.y : p.y; g.fillRect(p.x - p.w * .36, y0, p.w * .72, y1 - y0); }
      }
      const bg = g.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h); bg.addColorStop(0, '#2c2d30'); bg.addColorStop(1, '#151517');
      g.fillStyle = bg; g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(b.x, b.y, b.w, b.h * .18);
      const d = f.marks.find(m => m.t === 'dot'); if (d) { g.fillStyle = '#0c0c0d'; g.beginPath(); g.arc(d.x, d.y, d.r * 1.3, 0, 7); g.fill(); }
      g.save(); if (t === 'soic') g.rotate(-Math.PI / 2); g.fillStyle = 'rgba(220,220,215,.75)'; g.font = `600 ${t === 'sot23' ? .55 : .75}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t === 'soic' ? 'ATTINY85' : t === 'sot223' ? 'AMS1117' : '1F', 0, 0); g.restore();
    } else if (t === 'r_smd' || t === 'c_smd' || t === 'led_smd') {
      const b = body;
      g.fillStyle = t === 'r_smd' ? '#141414' : t === 'c_smd' ? '#b88b58' : '#e8e3d2'; g.fillRect(b.x, b.y, b.w, b.h);
      g.fillStyle = '#c9cac3'; g.fillRect(b.x, b.y, .32, b.h); g.fillRect(b.x + b.w - .32, b.y, .32, b.h);
      if (t === 'r_smd') { g.fillStyle = '#f2f2ee'; g.font = '600 .6px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.value === '330' ? '331' : '102', 0, .03); }
      if (t === 'led_smd') { g.fillStyle = 'rgba(120,200,120,.85)'; g.fillRect(-.45, -.35, .9, .7); g.fillStyle = '#2f8f3a'; g.fillRect(b.x + .35, b.y, .18, b.h); }
    } else if (t === 'usbc') {
      const b = body, sg = g.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h); sg.addColorStop(0, '#d5d8dc'); sg.addColorStop(.5, '#a7adb3'); sg.addColorStop(1, '#868c92');
      g.fillStyle = sg; g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeStyle = 'rgba(60,64,68,.6)'; g.lineWidth = .08; g.strokeRect(b.x + .3, b.y + .3, b.w - .6, b.h - .6);
      g.fillStyle = '#2b2e31'; g.fillRect(-3.9, 3.2, 7.8, .9);
    } else if (t === 'hdr1') {
      const b = body; g.fillStyle = '#171717'; g.fillRect(b.x, b.y, b.w, b.h);
      for (const p of f.pins) { g.fillStyle = '#d9b552'; g.fillRect(p.x - .32, p.y - .32, .64, .64); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(p.x - .32, p.y - .32, .64, .16); }
    } else if (t === 'c_el') {
      const r = body.r; g.fillStyle = '#1f2c5c'; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
      g.fillStyle = '#9fb1dd'; g.beginPath(); g.arc(0, 0, r, -0.95, 0.95); g.arc(0, 0, r * .82, 0.95, -0.95, true); g.fill();
      const cg = g.createRadialGradient(-r * .3, -r * .3, .2, 0, 0, r * .8); cg.addColorStop(0, '#e6e8eb'); cg.addColorStop(1, '#9ea4ab');
      g.fillStyle = cg; g.beginPath(); g.arc(0, 0, r * .78, 0, 7); g.fill();
      g.strokeStyle = '#7d838a'; g.lineWidth = .12; g.beginPath(); g.moveTo(-r * .45, 0); g.lineTo(r * .45, 0); g.moveTo(0, -r * .45); g.lineTo(0, r * .45); g.stroke();
    }
    g.restore();
  }
  g.restore();
  g.strokeStyle = 'rgba(210,225,190,.25)'; g.lineWidth = 1.5; rr(M, M, BW * ppm, BH * ppm, 2 * ppm); g.stroke();
  const vg = g.createRadialGradient(W * .45, H * .4, Math.min(W, H) * .3, W / 2, H / 2, Math.max(W, H) * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.38)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
  const lg = g.createLinearGradient(0, 0, W, H); lg.addColorStop(0, 'rgba(255,248,230,.07)'); lg.addColorStop(.5, 'rgba(255,255,255,0)'); g.fillStyle = lg; g.fillRect(0, 0, W, H);
  const src = cv.toDataURL('image/jpeg', .9);

  /* --- half-finished map --- */
  const d = newDoc(); d.name = 'Näidisplaat BB-01'; d.ppm = ppm; d.calibrated = true; d.sample = true;
  d.calib = { a: B(0, 0), b: B(BW, 0), mm: BW };
  doc = d;
  const ids = {};
  for (const s of specs) if (s.placed) { const c = addComp(s.c.type, s.c.x, s.c.y, { rot: s.c.rot, value: s.c.value, params: { ...s.c.params }, pn: { ...s.c.pn } }); c.ref = s.c.ref; ids[s.c.ref] = c.id; }
  for (const [net, a, via, b, w, demo] of SMP_TRACES) {
    if (!demo) continue;
    const ep = e => { const q = endXY(e); return typeof e[0] === 'string' && ids[e[0]] ? { c: ids[e[0]], p: e[1], x: f2(q[0]), y: f2(q[1]) } : { x: f2(q[0]), y: f2(q[1]) }; };
    d.traces.push({ id: uid('t'), a: ep(a), b: ep(b), pts: via.map(p => B(p[0], p[1]).map(f2)), w, layer: 'top', net });
  }
  d.dims.push({ id: uid('d'), a: { x: B(0, 0)[0], y: B(0, 0)[1] }, b: { x: B(BW, 0)[0], y: B(BW, 0)[1] }, off: -26 });
  d.dims.push({ id: uid('d'), a: { x: B(0, 0)[0], y: B(0, 0)[1] }, b: { x: B(0, BH)[0], y: B(0, BH)[1] }, off: 26 });
  d.outlines.push({ id: uid('o'), x: M, y: M, w: BW * ppm, h: BH * ppm, dims: false });
  touch();
  img = { src, w: W, h: H, name: 'naidisplaat-bb01.jpg' };
}
