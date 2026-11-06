/* Structural Diagrams: a small vector editor for competition structure diagrams.
 * Plain browser JavaScript, no build step. Office standards live in standards.js. */
(function () {
  'use strict';

  const S = window.STANDARDS;
  const L = S.label;
  const TYPES = S.types;
  const TYPE_ORDER = Object.keys(TYPES);
  const STORE_KEY = 'structural-diagrams.project.v1';
  const STORE_SKETCH = 'structural-diagrams.sketch.v1';
  const RECT_KINDS = ['rect', 'floors', 'truss', 'piles'];
  const ANNOT_KINDS = ['callout', 'text', 'legend'];

  const $ = (s, r = document) => r.querySelector(s);
  const f = (n) => Math.round(n * 100) / 100;
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ------------------------------------------------------------------ tools
  const I = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const TOOLS = [
    { id: 'select', key: 'v', name: 'Select & move', hint: 'Click to select, drag to move. Drag handles to reshape. Arrow keys nudge.', icon: I('<path d="M5 3l14 8-6 1.5L10 19z"/>') },
    { id: 'pan', key: 'h', name: 'Pan', hint: 'Drag to pan. You can also hold Space or use the middle mouse button.', icon: I('<path d="M8 13V5.5a1.5 1.5 0 013 0V12m0-1V4.5a1.5 1.5 0 013 0V12m0-6.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-5-2.7L3.5 15a1.5 1.5 0 012.5-1.6L8 15"/>') },
    'sep',
    { id: 'line', key: 'l', type: 'slab', name: 'Line', hint: 'Drag to draw a line. Hold Shift for horizontal/vertical/45°.', icon: I('<path d="M4 20L20 4"/>') },
    { id: 'poly', key: 'p', type: 'steel', name: 'Polyline / curve', hint: 'Click to add points. Double-click or Enter to finish, click the first point to close. Esc cancels.', icon: I('<path d="M3 19l5-9 5 5 8-11"/><circle cx="3" cy="19" r="1"/><circle cx="8" cy="10" r="1"/><circle cx="13" cy="15" r="1"/>') },
    { id: 'rect', key: 'r', type: 'core', name: 'Rectangle / core', hint: 'Drag a rectangle. Set bracing (X, zigzag, ladder) in the panel.', icon: I('<rect x="6" y="3" width="12" height="18"/><path d="M6 3l12 6M18 9L6 15M6 15l12 6"/>') },
    { id: 'floors', key: 'f', type: 'slab', name: 'Floor slabs', hint: 'Drag the area covered by the floors; set the number of floors in the panel.', icon: I('<path d="M4 5h16M4 9.5h16M4 14h16M4 18.5h16"/>') },
    { id: 'truss', key: 't', type: 'steel', name: 'Truss', hint: 'Drag the truss outline; set panels and pattern in the panel.', icon: I('<path d="M2 7h20M2 17h20M2 7v10M22 7v10M2 17l5-10 5 10 5-10 5 10"/>') },
    { id: 'piles', key: 'i', type: 'pile', name: 'Piles', hint: 'Drag the pile group area; set the number of piles in the panel.', icon: I('<path d="M3 4h18M6 4v16M10 4v16M14 4v16M18 4v16"/>') },
    'sep',
    { id: 'callout', key: 'c', name: 'Label / callout', hint: 'Press on the element and drag to where the text should go. Pick the text from the glossary.', icon: I('<circle cx="5" cy="17" r="2"/><path d="M6.5 15.5L11 7h10M13 11h7"/>') },
    { id: 'text', key: 'x', name: 'Text', hint: 'Click to place free text (e.g. a title).', icon: I('<path d="M5 6V4h14v2M12 4v16M9 20h6"/>') },
    { id: 'legend', key: 'g', name: 'Legend', hint: 'Click to place a legend of the element types used in the drawing.', icon: I('<rect x="3" y="4" width="5" height="4"/><rect x="3" y="10" width="5" height="4"/><rect x="3" y="16" width="5" height="4"/><path d="M11 6h10M11 12h8M11 18h9"/>') },
  ];
  const toolById = (id) => TOOLS.find((t) => t && t.id === id);

  // ------------------------------------------------------------------ state
  function newProject() {
    const [w, h] = S.pages.A3;
    return { v: 1, name: 'Untitled diagram', lang: 'en', labelStyle: 'caps',
      page: { size: 'A3', orient: 'landscape', w, h }, grid: 5, snap: true, showGrid: true,
      underlay: null, items: [], nextId: 1 };
  }

  let P = null;           // the project (everything that is saved / undone)
  let sketchSrc = null;   // underlay image data URL (kept outside undo history)
  const ui = { tool: 'select', type: 'slab', sel: null, view: { x: 0, y: 0, k: 1 }, drag: null, draft: null, space: false, snapPt: null };
  let undoStack = [], redoStack = [];

  function snapshot() { return JSON.stringify(P); }
  function checkpoint() { undoStack.push(snapshot()); if (undoStack.length > 150) undoStack.shift(); redoStack = []; updateUndoButtons(); }
  function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); P = JSON.parse(undoStack.pop()); afterStateChange(); }
  function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); P = JSON.parse(redoStack.pop()); afterStateChange(); }
  function afterStateChange() {
    if (ui.sel && ui.sel !== '__underlay' && !getItem(ui.sel)) ui.sel = null;
    if (ui.sel === '__underlay' && !P.underlay) ui.sel = null;
    renderAll(); persist();
  }
  function updateUndoButtons() { $('#btn-undo').disabled = !undoStack.length; $('#btn-redo').disabled = !redoStack.length; }

  let persistTimer = null;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try { localStorage.setItem(STORE_KEY, snapshot()); } catch (e) { /* storage unavailable */ }
    }, 300);
  }
  function persistSketch() {
    try { if (sketchSrc) localStorage.setItem(STORE_SKETCH, sketchSrc); else localStorage.removeItem(STORE_SKETCH); }
    catch (e) { toast('The sketch is too large to keep between sessions. Use Save to keep it with the project.'); }
  }
  function restore() {
    try {
      const s = localStorage.getItem(STORE_KEY);
      if (s) { P = Object.assign(newProject(), JSON.parse(s)); sketchSrc = localStorage.getItem(STORE_SKETCH); return true; }
    } catch (e) { /* ignore */ }
    return false;
  }

  const getItem = (id) => P.items.find((i) => i.id === id);
  const selItem = () => (ui.sel && ui.sel !== '__underlay' ? getItem(ui.sel) : null);
  function addItem(it) { it.id = 'e' + (P.nextId++); P.items.push(it); return it; }

  // ------------------------------------------------------------------ text
  const mctx = document.createElement('canvas').getContext('2d');
  function textW(str, size, weight) { mctx.font = `${weight || 400} ${size}px ${S.font}`; return mctx.measureText(str).width; }

  function calloutText(it) {
    const t = (it.text && it.text[P.lang]) || {};
    const other = (it.text && it.text[P.lang === 'en' ? 'de' : 'en']) || {};
    const title = t.title || other.title || '';
    const sub = (t.title ? t.sub : other.sub) || '';
    return { title, sub: sub ? sub.split('\n') : [] };
  }

  /** Lines of a callout label with their size, weight and baseline offset. */
  function labelLines(it) {
    const { title, sub } = calloutText(it);
    const caps = P.labelStyle === 'caps';
    const lines = [];
    if (caps) {
      lines.push({ t: title.toUpperCase(), size: L.titleSize, w: L.titleWeight });
      sub.forEach((s) => lines.push({ t: s, size: L.subSize, w: 400 }));
    } else {
      lines.push({ t: title, size: L.plainSize, w: 400 });
      sub.forEach((s) => lines.push({ t: s, size: L.plainSize, w: 400 }));
    }
    let y = lines[0].size * 0.35;
    lines.forEach((ln, i) => { if (i) y += ln.size * L.lineHeight + (caps && i === 1 ? 1 : 0); ln.dy = y; });
    return lines;
  }

  // ------------------------------------------------------------------ geometry → SVG
  function strokeAttrs(t, opt = {}) {
    const fill = opt.nofill ? 'none' : (opt.fill || t.fill || 'none');
    let a = `stroke="${opt.stroke || t.stroke}" stroke-width="${opt.width || t.width}" fill="${fill}" stroke-linejoin="round" stroke-linecap="${t.cap || 'butt'}"`;
    if (t.dash && !opt.nodash) a += ` stroke-dasharray="${t.dash}"`;
    return a;
  }

  function pathD(pts, closed, smooth) {
    if (!pts.length) return '';
    if (!smooth || pts.length < 3) return 'M' + pts.map((p) => f(p[0]) + ' ' + f(p[1])).join(' L') + (closed ? ' Z' : '');
    const n = pts.length;
    const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d + (closed ? ' Z' : '');
  }

  function infillD(it) {
    const { x, y, w, h } = it, n = Math.max(1, it.n | 0);
    const vert = h >= w;
    let d = '';
    if (vert) {
      const ph = h / n;
      for (let i = 0; i < n; i++) {
        const y0 = y + i * ph, y1 = y0 + ph;
        if (it.infill === 'x') d += `M${f(x)} ${f(y0)}L${f(x + w)} ${f(y1)}M${f(x + w)} ${f(y0)}L${f(x)} ${f(y1)}`;
        if (it.infill === 'zigzag') d += (i ? '' : `M${f(x)} ${f(y)}`) + `L${f(i % 2 ? x : x + w)} ${f(y1)}`;
        if (it.infill === 'ladder' && i) d += `M${f(x)} ${f(y0)}H${f(x + w)}`;
      }
    } else {
      const pw = w / n;
      for (let i = 0; i < n; i++) {
        const x0 = x + i * pw, x1 = x0 + pw;
        if (it.infill === 'x') d += `M${f(x0)} ${f(y)}L${f(x1)} ${f(y + h)}M${f(x0)} ${f(y + h)}L${f(x1)} ${f(y)}`;
        if (it.infill === 'zigzag') d += (i ? '' : `M${f(x)} ${f(y + h)}`) + `L${f(x1)} ${f(i % 2 ? y + h : y)}`;
        if (it.infill === 'ladder' && i) d += `M${f(x0)} ${f(y)}V${f(y + h)}`;
      }
    }
    return d;
  }

  function trussD(it) {
    const { x, y, w, h } = it, n = Math.max(1, it.n | 0), pw = w / n, pat = it.pattern || 'pratt';
    let d = `M${f(x)} ${f(y)}H${f(x + w)}M${f(x)} ${f(y + h)}H${f(x + w)}M${f(x)} ${f(y)}V${f(y + h)}M${f(x + w)} ${f(y)}V${f(y + h)}`;
    for (let i = 0; i < n; i++) {
      const x0 = x + i * pw, x1 = x0 + pw;
      if (i && pat !== 'warren') d += `M${f(x0)} ${f(y)}V${f(y + h)}`;
      if (pat === 'pratt') d += (x0 + pw / 2 < x + w / 2) ? `M${f(x1)} ${f(y)}L${f(x0)} ${f(y + h)}` : `M${f(x0)} ${f(y)}L${f(x1)} ${f(y + h)}`;
      if (pat === 'warren') d += i % 2 ? `M${f(x0)} ${f(y + h)}L${f(x1)} ${f(y)}` : `M${f(x0)} ${f(y)}L${f(x1)} ${f(y + h)}`;
      if (pat === 'x') d += `M${f(x0)} ${f(y)}L${f(x1)} ${f(y + h)}M${f(x0)} ${f(y + h)}L${f(x1)} ${f(y)}`;
    }
    return d;
  }

  function linesD(it, vertical) {
    const { x, y, w, h } = it, n = Math.max(1, it.n | 0);
    let d = '';
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1);
      d += vertical ? `M${f(x + t * w)} ${f(y)}V${f(y + h)}` : `M${f(x)} ${f(y + t * h)}H${f(x + w)}`;
    }
    return d;
  }

  /** A member drawn with a real thickness: outline stroke underneath, fill stroke on top. */
  function bandBody(d, t, thick) {
    const b = t.band || {}, fill = b.fill || t.swatch || t.stroke, out = b.outline || '#6e6e6e', ow = 0.5;
    return `<path d="${d}" fill="none" stroke="${out}" stroke-width="${f(thick + 2 * ow)}" stroke-linejoin="miter" stroke-linecap="square"/>` +
      `<path d="${d}" fill="none" stroke="${fill}" stroke-width="${f(thick)}" stroke-linejoin="miter" stroke-linecap="square"/>`;
  }
  const lineBody = (it, d, t, nofill) => (it.thick > 0 ? bandBody(d, t, it.thick) : `<path d="${d}" ${strokeAttrs(t, { nofill })}/>`);

  /** Returns { body, hit } SVG strings for an item. hit is only used in the editor. */
  function renderItem(it) {
    const t = TYPES[it.type] || TYPES.slab;
    switch (it.kind) {
      case 'path': {
        const d = pathD(it.pts, it.closed, it.smooth);
        const body = it.thick > 0 && !it.closed ? bandBody(d, t, it.thick) : `<path d="${d}" ${strokeAttrs(t, { nofill: !it.closed || it.nofill })}/>`;
        return { body, hit: `<path class="hit" d="${d}" stroke-width="${10 / ui.view.k}"/>` + (it.closed && !it.nofill ? `<path class="hit-area" d="${d}"/>` : '') };
      }
      case 'rect': {
        const { x, y, w, h } = it;
        let body = `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" ${strokeAttrs(t, { nofill: it.nofill })}/>`;
        if (it.infill && it.infill !== 'none') {
          const lw = it.infill === 'ladder' ? t.width : Math.max(0.4, t.width * 0.6);
          body += `<path d="${infillD(it)}" ${strokeAttrs(t, { nofill: true, width: lw, nodash: true })}/>`;
        }
        return { body, hit: rectHit(it) };
      }
      case 'floors': return { body: lineBody(it, linesD(it, false), t, true), hit: rectHit(it) };
      case 'piles': return { body: lineBody(it, linesD(it, true), t, true), hit: rectHit(it) };
      case 'truss': return { body: `<path d="${trussD(it)}" ${strokeAttrs(t, { nofill: true })}/>`, hit: rectHit(it) };
      case 'callout': return renderCallout(it);
      case 'text': return renderText(it);
      case 'legend': return renderLegend(it);
    }
    return { body: '', hit: '' };
  }
  const rectHit = (it) => `<rect class="hit-area" x="${f(it.x)}" y="${f(it.y)}" width="${f(Math.max(it.w, 4))}" height="${f(Math.max(it.h, 4))}"/>`;

  function calloutGeom(it) {
    const lines = labelLines(it);
    const right = it.lx >= it.ax;
    const ex = right ? it.lx - L.gap : it.lx + L.gap;
    let d;
    const shoulder = (right ? -1 : 1) * Math.min(12, Math.abs(ex - it.ax));
    if (Math.abs(it.ay - it.ly) < 0.01) d = `M${f(it.ax)} ${f(it.ay)}L${f(ex)} ${f(it.ly)}`;
    else if (it.leader === 'elbow') d = `M${f(it.ax)} ${f(it.ay)}V${f(it.ly)}H${f(ex)}`;
    else if (it.leader === 'direct') d = `M${f(it.ax)} ${f(it.ay)}L${f(ex)} ${f(it.ly)}`;
    else d = `M${f(it.ax)} ${f(it.ay)}L${f(ex + shoulder)} ${f(it.ly)}H${f(ex)}`;
    const wMax = Math.max(...lines.map((ln) => textW(ln.t, ln.size, ln.w)), 10);
    const bx = right ? it.lx : it.lx - wMax;
    const by = it.ly - lines[0].size * 0.7;
    const bh = lines[lines.length - 1].dy + lines[lines.length - 1].size * 0.3 + lines[0].size * 0.7;
    return { lines, right, d, box: { x: bx, y: by, w: wMax, h: bh } };
  }

  function renderCallout(it) {
    const g = calloutGeom(it);
    const anchor = g.right ? 'start' : 'end';
    let text = `<text x="${f(it.lx)}" y="${f(it.ly)}" text-anchor="${anchor}" fill="${L.textColor}" font-family="${esc(S.font)}">`;
    g.lines.forEach((ln) => { text += `<tspan x="${f(it.lx)}" y="${f(it.ly + ln.dy)}" font-size="${ln.size}" font-weight="${ln.w}">${esc(ln.t)}</tspan>`; });
    text += '</text>';
    const body = `<path d="${g.d}" fill="none" stroke="${L.leaderColor}" stroke-width="${L.leaderWidth}"/>` +
      `<circle cx="${f(it.ax)}" cy="${f(it.ay)}" r="${L.dotRadius}" fill="#ffffff" stroke="${L.leaderColor}" stroke-width="${L.leaderWidth}"/>` + text;
    const b = g.box;
    const hit = `<path class="hit" d="${g.d}" stroke-width="${8 / ui.view.k}"/><rect class="hit-area" x="${f(b.x)}" y="${f(b.y)}" width="${f(b.w)}" height="${f(b.h)}"/>`;
    return { body, hit };
  }

  function renderText(it) {
    const str = (it.text && (it.text[P.lang] || it.text.en || it.text.de)) || '';
    const size = it.size || 14;
    const lines = str.split('\n');
    let body = `<text x="${f(it.x)}" y="${f(it.y)}" font-size="${size}" font-weight="${it.bold ? 700 : 400}" fill="${L.textColor}" font-family="${esc(S.font)}">`;
    lines.forEach((ln, i) => { body += `<tspan x="${f(it.x)}" y="${f(it.y + i * size * L.lineHeight)}">${esc(ln)}</tspan>`; });
    body += '</text>';
    const w = Math.max(...lines.map((ln) => textW(ln, size, it.bold ? 700 : 400)), 10);
    return { body, hit: `<rect class="hit-area" x="${f(it.x)}" y="${f(it.y - size * 0.8)}" width="${f(w)}" height="${f(lines.length * size * L.lineHeight)}"/>` };
  }

  function usedTypes() {
    const used = new Set(P.items.filter((i) => !ANNOT_KINDS.includes(i.kind)).map((i) => i.type));
    return TYPE_ORDER.slice().reverse().filter((t) => used.has(t) && t !== 'ground');
  }

  function renderLegend(it) {
    const types = usedTypes();
    const s = L.legendSwatch, size = L.legendSize, row = s + 6;
    let body = '', w = 60;
    (types.length ? types : ['core']).forEach((tid, i) => {
      const t = TYPES[tid], y = it.y + i * row;
      const name = t.name[P.lang] || t.name.en;
      body += `<rect x="${f(it.x)}" y="${f(y)}" width="${s}" height="${s}" fill="${t.swatch || t.stroke}"/>`;
      body += `<text x="${f(it.x + s + 8)}" y="${f(y + s * 0.82)}" font-size="${size}" font-style="italic" fill="${L.textColor}" font-family="${esc(S.font)}">${esc(name)}</text>`;
      w = Math.max(w, s + 8 + textW(name, size));
    });
    const h = Math.max(types.length, 1) * row;
    return { body, hit: `<rect class="hit-area" x="${f(it.x)}" y="${f(it.y)}" width="${f(w)}" height="${f(h)}"/>` };
  }

  // ------------------------------------------------------------------ rendering
  const svg = $('#canvas');
  const stage = $('#stage');

  function renderCanvas() {
    const v = ui.view, k = v.k, { w, h } = P.page;
    let out = `<defs><pattern id="grid" width="${P.grid}" height="${P.grid}" patternUnits="userSpaceOnUse"><path d="M${P.grid} 0H0V${P.grid}" fill="none" stroke="#e6e6e3" stroke-width="${0.6 / k}"/></pattern>` +
      `<pattern id="grid10" width="${P.grid * 10}" height="${P.grid * 10}" patternUnits="userSpaceOnUse"><path d="M${P.grid * 10} 0H0V${P.grid * 10}" fill="none" stroke="#d4d4d0" stroke-width="${0.8 / k}"/></pattern></defs>`;
    out += `<g transform="translate(${f(v.x)} ${f(v.y)}) scale(${k})">`;
    out += `<rect x="0" y="0" width="${f(w)}" height="${f(h)}" fill="#fff" style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.18))"/>`;
    if (P.showGrid && P.grid * k >= 4) out += `<rect width="${f(w)}" height="${f(h)}" fill="url(#grid)" pointer-events="none"/>`;
    if (P.showGrid) out += `<rect width="${f(w)}" height="${f(h)}" fill="url(#grid10)" pointer-events="none"/>`;

    if (P.underlay && P.underlay.visible && sketchSrc) {
      const u = P.underlay;
      out += `<image href="${sketchSrc}" x="${f(u.x)}" y="${f(u.y)}" width="${f(u.w)}" height="${f(u.h)}" opacity="${u.opacity}" preserveAspectRatio="none"${u.locked ? ' pointer-events="none"' : ' data-underlay="1"'}/>`;
    }

    for (const tid of TYPE_ORDER) {
      for (const it of P.items) {
        if (it.type !== tid || ANNOT_KINDS.includes(it.kind)) continue;
        const r = renderItem(it);
        out += `<g data-id="${it.id}">${r.body}${r.hit}</g>`;
      }
    }
    for (const it of P.items) {
      if (!ANNOT_KINDS.includes(it.kind)) continue;
      const r = renderItem(it);
      out += `<g data-id="${it.id}">${r.body}${r.hit}</g>`;
    }

    if (ui.draft) {
      const r = renderItem(ui.draft);
      out += `<g opacity="0.85" pointer-events="none">${r.body}</g>`;
    }
    out += `<g id="overlay"></g>`;
    if (ui.snapPt) out += `<circle class="snap-mark" cx="${f(ui.snapPt[0])}" cy="${f(ui.snapPt[1])}" r="${5 / k}" stroke-width="${1.2 / k}" pointer-events="none"/>`;
    out += '</g>';
    svg.innerHTML = out;
    renderSelection();
  }

  function renderSelection() {
    const ov = $('#overlay', svg);
    if (!ov || !ui.sel) return;
    const k = ui.view.k, hs = 7 / k;
    let out = '';
    const handle = (x, y, h, cls = '') => `<rect class="handle ${cls}" data-h="${h}" x="${f(x - hs / 2)}" y="${f(y - hs / 2)}" width="${f(hs)}" height="${f(hs)}" stroke-width="${1.2 / k}"/>`;
    if (ui.sel === '__underlay') {
      const u = P.underlay;
      out += `<rect class="sel-box" x="${f(u.x)}" y="${f(u.y)}" width="${f(u.w)}" height="${f(u.h)}" stroke-width="${1 / k}" pointer-events="none"/>`;
      out += handle(u.x + u.w, u.y + u.h, 'u');
      ov.innerHTML = out; return;
    }
    const it = selItem(); if (!it) return;
    const g = svg.querySelector(`g[data-id="${it.id}"]`);
    if (g) {
      const b = g.getBBox();
      out += `<rect class="sel-box" x="${f(b.x - 3 / k)}" y="${f(b.y - 3 / k)}" width="${f(b.width + 6 / k)}" height="${f(b.height + 6 / k)}" stroke-width="${1 / k}" pointer-events="none"/>`;
    }
    if (it.kind === 'path') it.pts.forEach((p, i) => { out += handle(p[0], p[1], 'v:' + i, 'vtx'); });
    if (RECT_KINDS.includes(it.kind)) {
      out += handle(it.x, it.y, 'c:nw') + handle(it.x + it.w, it.y, 'c:ne') + handle(it.x, it.y + it.h, 'c:sw') + handle(it.x + it.w, it.y + it.h, 'c:se');
    }
    if (it.kind === 'callout') out += handle(it.ax, it.ay, 'a', 'vtx') + handle(it.lx, it.ly, 'l');
    ov.innerHTML = out;
  }

  function renderAll() {
    renderCanvas(); renderPanel(); renderTop(); renderStatus(); updateUndoButtons();
  }

  // ------------------------------------------------------------------ export
  function layerId(name) { return name.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, ''); }

  function buildExportSVG(forPdf) {
    const { w, h } = P.page;
    const fontStack = forPdf ? 'helvetica' : esc(S.font);
    // jsPDF only has the standard PDF fonts: map the family to Helvetica and weights to normal/bold.
    const fix = (s) => (forPdf ? s.split(esc(S.font)).join('helvetica').replace(/font-weight="(\d+)"/g, (m, w) => `font-weight="${+w >= 500 ? 'bold' : 'normal'}"`) : s);
    let body = '';
    for (const tid of TYPE_ORDER) {
      const items = P.items.filter((i) => i.type === tid && !ANNOT_KINDS.includes(i.kind));
      if (!items.length) continue;
      body += `<g id="${layerId(TYPES[tid].name.en)}">` + items.map((i) => renderItem(i).body).join('') + '</g>';
    }
    const groups = { callout: 'Labels', legend: 'Legend', text: 'Text' };
    for (const kind of ['callout', 'legend', 'text']) {
      const items = P.items.filter((i) => i.kind === kind);
      if (items.length) body += `<g id="${groups[kind]}">` + items.map((i) => fix(renderItem(i).body)).join('') + '</g>';
    }
    const size = forPdf ? `width="${f(w)}" height="${f(h)}"` : `width="${f(w)}pt" height="${f(h)}pt"`;
    return `<svg xmlns="http://www.w3.org/2000/svg" ${size} viewBox="0 0 ${f(w)} ${f(h)}" font-family="${fontStack}">${body}</svg>`;
  }

  function fileBase() { return (P.name || 'diagram').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'diagram'; }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function exportSVG() {
    const s = '<?xml version="1.0" encoding="UTF-8"?>\n' + buildExportSVG(false);
    download(new Blob([s], { type: 'image/svg+xml' }), `${fileBase()}_${P.lang.toUpperCase()}.svg`);
    toast('SVG exported. Each material is a named group; open it in Illustrator to edit.');
  }

  async function copySVG() {
    const s = buildExportSVG(false);
    try {
      await navigator.clipboard.writeText(s);
      toast('Copied. In Illustrator press Ctrl+V / Cmd+V to paste editable vectors.');
    } catch (e) {
      toast('The browser blocked clipboard access. Use Export SVG instead.');
    }
  }

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  async function exportPDF() {
    try {
      if (!window.jspdf) await loadScript('js/vendor/jspdf.umd.min.js');
      if (!window.svg2pdf) await loadScript('js/vendor/svg2pdf.umd.min.js');
      const { w, h } = P.page;
      const doc = new window.jspdf.jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'pt', format: [w, h] });
      const holder = document.createElement('div');
      holder.style.cssText = 'position:fixed;left:-99999px;top:0';
      holder.innerHTML = buildExportSVG(true);
      document.body.appendChild(holder);
      await doc.svg(holder.firstChild, { x: 0, y: 0, width: w, height: h });
      holder.remove();
      doc.setProperties({ title: P.name, creator: 'Structural Diagrams' });
      doc.save(`${fileBase()}_${P.lang.toUpperCase()}.pdf`);
      toast('PDF exported (vector, text stays editable).');
    } catch (e) {
      console.error(e);
      toast('PDF export failed: ' + e.message);
    }
  }

  function saveProject() {
    const data = { app: 'structural-diagrams', version: 1, project: P, sketch: sketchSrc };
    download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `${fileBase()}.sdiag.json`);
    toast('Project saved. Share the .sdiag.json file so colleagues can keep editing it.');
  }

  function openProject(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const data = JSON.parse(r.result);
        if (!data.project || !Array.isArray(data.project.items)) throw new Error('not a diagram project');
        checkpoint();
        P = Object.assign(newProject(), data.project);
        sketchSrc = data.sketch || null;
        persistSketch(); ui.sel = null; fitView(); afterStateChange();
        toast(`Opened "${P.name}".`);
      } catch (e) { toast('This file is not a Structural Diagrams project (.sdiag.json).'); }
    };
    r.readAsText(file);
  }

  let sketchPdf = null; // { doc, page, pages } for the last imported PDF (not saved)

  async function importPdf(file) {
    try {
      if (!window.pdfjsLib) await loadScript('js/vendor/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/vendor/pdf.worker.min.js';
      const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
      sketchPdf = { doc, page: 1, pages: doc.numPages, name: file.name };
      await renderPdfPage(1, true);
      if (doc.numPages > 1) toast(`PDF has ${doc.numPages} pages. Choose the page in the Sketch underlay panel.`);
    } catch (e) { console.error(e); toast('Could not read this PDF: ' + e.message); }
  }

  async function renderPdfPage(n, fresh) {
    toast('Rendering PDF page ' + n + '…');
    const page = await sketchPdf.doc.getPage(n);
    const vp1 = page.getViewport({ scale: 1 });
    const scale = Math.min(4, 3200 / Math.max(vp1.width, vp1.height));
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    sketchPdf.page = n;
    placeSketch(c.toDataURL('image/jpeg', 0.85), c.width, c.height, fresh || !P.underlay);
  }

  function placeSketch(src, iw, ih, refit) {
    checkpoint();
    const { w, h } = P.page;
    if (refit || !P.underlay) {
      const s = Math.min((w * 0.9) / iw, (h * 0.9) / ih);
      const uw = iw * s, uh = ih * s;
      P.underlay = { x: (w - uw) / 2, y: (h - uh) / 2, w: uw, h: uh, opacity: 0.45, visible: true, locked: true };
    } else {
      P.underlay.h = P.underlay.w * ih / iw;
    }
    sketchSrc = src; persistSketch(); persist();
    renderAll();
    toast('Sketch placed underneath and locked. Unlock it in the panel to move or scale it.');
  }

  function importSketch(file) {
    if (file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) { importPdf(file); return; }
    if (!file || !file.type.startsWith('image/')) { toast('Import a PDF, PNG or JPG of the sketch.'); return; }
    sketchPdf = null;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => placeSketch(r.result, img.width, img.height, true);
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }

  // ------------------------------------------------------------------ view
  function fitView() {
    const r = stage.getBoundingClientRect();
    const { w, h } = P.page;
    const k = Math.min((r.width - 60) / w, (r.height - 60) / h);
    ui.view = { k, x: (r.width - w * k) / 2, y: (r.height - h * k) / 2 };
  }
  function zoomAt(factor, cx, cy) {
    const v = ui.view, k2 = Math.max(0.05, Math.min(40, v.k * factor));
    v.x = cx - ((cx - v.x) * k2) / v.k; v.y = cy - ((cy - v.y) * k2) / v.k; v.k = k2;
    renderCanvas(); renderStatus();
  }
  function toWorld(e) {
    const r = svg.getBoundingClientRect();
    return [(e.clientX - r.left - ui.view.x) / ui.view.k, (e.clientY - r.top - ui.view.y) / ui.view.k];
  }

  // ------------------------------------------------------------------ snapping
  function snapPoints(excludeId) {
    const pts = [];
    for (const it of P.items) {
      if (it.id === excludeId) continue;
      if (it.kind === 'path') pts.push(...it.pts);
      if (RECT_KINDS.includes(it.kind)) pts.push([it.x, it.y], [it.x + it.w, it.y], [it.x, it.y + it.h], [it.x + it.w, it.y + it.h], [it.x + it.w / 2, it.y], [it.x + it.w / 2, it.y + it.h]);
    }
    return pts;
  }
  function snap(p, excludeId, extra) {
    ui.snapPt = null;
    if (!P.snap || ui.altKey) return p;
    const tol = 8 / ui.view.k;
    let best = null, bd = tol;
    for (const q of snapPoints(excludeId).concat(extra || [])) {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d < bd) { bd = d; best = q; }
    }
    if (best) { ui.snapPt = best; return [best[0], best[1]]; }
    const g = P.grid;
    return [Math.round(p[0] / g) * g, Math.round(p[1] / g) * g];
  }
  function ortho(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.hypot(dx, dy);
    return [a[0] + Math.round(Math.cos(ang) * len * 1000) / 1000, a[1] + Math.round(Math.sin(ang) * len * 1000) / 1000];
  }
  const snapDelta = (d) => (P.snap && !ui.altKey ? Math.round(d / P.grid) * P.grid : d);

  // ------------------------------------------------------------------ editing helpers
  function translateItem(it, o, dx, dy) {
    if (it.kind === 'path') it.pts = o.pts.map((p) => [p[0] + dx, p[1] + dy]);
    else if (it.kind === 'callout') { it.ax = o.ax + dx; it.ay = o.ay + dy; it.lx = o.lx + dx; it.ly = o.ly + dy; }
    else { it.x = o.x + dx; it.y = o.y + dy; }
  }
  function normRect(a, b) { return { x: Math.min(a[0], b[0]), y: Math.min(a[1], b[1]), w: Math.abs(b[0] - a[0]), h: Math.abs(b[1] - a[1]) }; }

  function defaultsFor(kind) {
    switch (kind) {
      case 'rect': return { infill: 'none', n: 8, nofill: false };
      case 'floors': return { n: 10 };
      case 'truss': return { n: 6, pattern: 'pratt' };
      case 'piles': return { n: 6 };
    }
    return {};
  }

  function calloutColumns(exclude) { return P.items.filter((i) => i.kind === 'callout' && i.id !== exclude).map((i) => i.lx); }
  function snapLabel(it, p) {
    let [lx, ly] = p;
    const tol = 8 / ui.view.k;
    for (const c of calloutColumns(it.id)) if (Math.abs(c - lx) < tol) { lx = c; break; }
    if (Math.abs(ly - it.ay) < tol) ly = it.ay;
    return [lx, ly];
  }

  function deleteSel() {
    if (!ui.sel) return;
    checkpoint();
    if (ui.sel === '__underlay') { P.underlay = null; sketchSrc = null; persistSketch(); }
    else P.items = P.items.filter((i) => i.id !== ui.sel);
    ui.sel = null; renderAll(); persist();
  }
  function duplicateSel() {
    const it = selItem(); if (!it) return;
    checkpoint();
    const c = clone(it); const off = P.grid * 4;
    translateItem(c, clone(c), off, off);
    addItem(c); ui.sel = c.id; renderAll(); persist();
  }
  function alignLabels() {
    const right = P.items.filter((i) => i.kind === 'callout' && i.lx >= i.ax);
    const left = P.items.filter((i) => i.kind === 'callout' && i.lx < i.ax);
    if (!right.length && !left.length) { toast('There are no labels to align yet.'); return; }
    checkpoint();
    if (right.length) { const x = Math.max(...right.map((i) => i.lx)); right.forEach((i) => (i.lx = x)); }
    if (left.length) { const x = Math.min(...left.map((i) => i.lx)); left.forEach((i) => (i.lx = x)); }
    renderAll(); persist();
    toast('Labels aligned to one column on each side.');
  }

  // ------------------------------------------------------------------ pointer input
  svg.addEventListener('pointerdown', (e) => {
    svg.setPointerCapture(e.pointerId);
    ui.altKey = e.altKey;
    const sp = [e.clientX, e.clientY];
    if (e.button === 1 || ui.space || ui.tool === 'pan') {
      ui.drag = { mode: 'pan', sp, v: { ...ui.view } }; stage.classList.add('panning'); return;
    }
    if (e.button !== 0) return;
    const raw = toWorld(e);
    const tool = ui.tool;

    if (tool === 'select') {
      const h = e.target.closest('[data-h]');
      if (h) {
        const it = selItem();
        checkpoint();
        ui.drag = { mode: 'handle', h: h.dataset.h, o: it ? clone(it) : clone(P.underlay), start: raw, moved: false };
        return;
      }
      const g = e.target.closest('g[data-id]');
      if (g) {
        ui.sel = g.dataset.id;
        checkpoint();
        ui.drag = { mode: 'move', o: clone(getItem(ui.sel)), start: raw, moved: false };
        renderCanvas(); renderPanel(); return;
      }
      if (e.target.dataset && e.target.dataset.underlay) {
        ui.sel = '__underlay'; checkpoint();
        ui.drag = { mode: 'move-underlay', o: clone(P.underlay), start: raw, moved: false };
        renderCanvas(); renderPanel(); return;
      }
      ui.sel = null; renderCanvas(); renderPanel(); return;
    }

    const p = snap(raw);
    const type = ui.type;
    if (tool === 'line') { ui.draft = { kind: 'path', type, pts: [p, p.slice()], closed: false }; ui.drag = { mode: 'draw-line', start: p }; }
    else if (RECT_KINDS.includes(tool)) { ui.draft = Object.assign({ kind: tool, type, x: p[0], y: p[1], w: 0, h: 0 }, defaultsFor(tool)); ui.drag = { mode: 'draw-rect', start: p }; }
    else if (tool === 'poly') {
      if (!ui.draft) ui.draft = { kind: 'path', type, pts: [p, p.slice()], closed: false, smooth: false };
      else {
        const first = ui.draft.pts[0];
        if (ui.draft.pts.length > 2 && Math.hypot(first[0] - p[0], first[1] - p[1]) < 8 / ui.view.k) { ui.draft.pts.pop(); ui.draft.closed = true; finishPoly(); return; }
        ui.draft.pts[ui.draft.pts.length - 1] = p; ui.draft.pts.push(p.slice());
      }
    }
    else if (tool === 'callout') {
      ui.draft = { kind: 'callout', ax: p[0], ay: p[1], lx: p[0], ly: p[1], leader: 'angled', key: '', text: { en: { title: 'Label', sub: '' }, de: { title: 'Beschriftung', sub: '' } } };
      ui.drag = { mode: 'draw-callout', start: p };
    }
    else if (tool === 'text') {
      checkpoint();
      const it = addItem({ kind: 'text', x: p[0], y: p[1], size: 14, bold: true, text: { en: 'Title', de: 'Titel' } });
      ui.sel = it.id; setTool('select'); renderAll(); persist(); focusFirstInput(); return;
    }
    else if (tool === 'legend') {
      checkpoint();
      const it = addItem({ kind: 'legend', x: p[0], y: p[1] });
      ui.sel = it.id; setTool('select'); renderAll(); persist(); return;
    }
    renderCanvas();
  });

  svg.addEventListener('pointermove', (e) => {
    ui.altKey = e.altKey;
    const d = ui.drag;
    if (d && d.mode === 'pan') {
      ui.view.x = d.v.x + e.clientX - d.sp[0]; ui.view.y = d.v.y + e.clientY - d.sp[1]; renderCanvas(); return;
    }
    const raw = toWorld(e);
    renderStatus(raw);
    if (!d) {
      if (ui.tool === 'poly' && ui.draft) {
        let p = snap(raw);
        const pts = ui.draft.pts;
        if (e.shiftKey && pts.length > 1) p = ortho(pts[pts.length - 2], p);
        pts[pts.length - 1] = p; renderCanvas();
      } else if (ui.tool !== 'select' && ui.tool !== 'pan') {
        const before = ui.snapPt; snap(raw);
        if (before !== ui.snapPt) renderCanvas();
      }
      return;
    }
    if (d.mode === 'draw-line') {
      let p = snap(raw); if (e.shiftKey) p = ortho(d.start, p);
      ui.draft.pts[1] = p;
    } else if (d.mode === 'draw-rect') {
      Object.assign(ui.draft, normRect(d.start, snap(raw)));
    } else if (d.mode === 'draw-callout') {
      const [lx, ly] = snapLabel(ui.draft, raw); ui.draft.lx = lx; ui.draft.ly = ly;
    } else if (d.mode === 'move') {
      const it = getItem(ui.sel); if (!it) return;
      let dx = snapDelta(raw[0] - d.start[0]), dy = snapDelta(raw[1] - d.start[1]);
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      d.moved = d.moved || dx || dy; translateItem(it, d.o, dx, dy);
    } else if (d.mode === 'move-underlay') {
      const u = P.underlay; u.x = d.o.x + raw[0] - d.start[0]; u.y = d.o.y + raw[1] - d.start[1]; d.moved = true;
    } else if (d.mode === 'handle') {
      d.moved = true; dragHandle(d, raw, e);
    }
    renderCanvas();
  });

  function dragHandle(d, raw, e) {
    if (d.h === 'u') {
      const u = P.underlay, o = d.o;
      const s = Math.max(0.05, (raw[0] - o.x) / o.w);
      u.w = o.w * s; u.h = o.h * s; return;
    }
    const it = selItem(); if (!it) return;
    if (d.h.startsWith('v:')) {
      const i = +d.h.slice(2);
      let p = snap(raw, it.id, it.pts.filter((_, j) => j !== i));
      const nb = it.pts[i - 1] || it.pts[i + 1];
      if (e.shiftKey && nb) p = ortho(nb, p);
      it.pts[i] = p;
    } else if (d.h.startsWith('c:')) {
      const c = d.h.slice(2), o = d.o;
      const fx = c.includes('w') ? o.x + o.w : o.x, fy = c.includes('n') ? o.y + o.h : o.y;
      Object.assign(it, normRect([fx, fy], snap(raw, it.id)));
    } else if (d.h === 'a') { const p = snap(raw, it.id); it.ax = p[0]; it.ay = p[1]; }
    else if (d.h === 'l') { const [lx, ly] = snapLabel(it, raw); it.lx = lx; it.ly = ly; }
  }

  svg.addEventListener('pointerup', () => {
    const d = ui.drag; ui.drag = null; stage.classList.remove('panning');
    if (!d) return;
    if (d.mode === 'pan') return;
    if (['move', 'move-underlay', 'handle'].includes(d.mode)) {
      if (!d.moved) { undoStack.pop(); updateUndoButtons(); }
      else persist();
      renderAll(); return;
    }
    const dr = ui.draft; ui.draft = null; ui.snapPt = null;
    if (d.mode === 'draw-line') {
      const [a, b] = dr.pts;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1) { checkpoint(); ui.sel = addItem(dr).id; persist(); }
    } else if (d.mode === 'draw-rect') {
      if (dr.w > 1 && dr.h > 1) { checkpoint(); ui.sel = addItem(dr).id; persist(); }
      else if (dr.kind === 'floors' && dr.w > 1) { dr.n = 1; checkpoint(); ui.sel = addItem(dr).id; persist(); }
    } else if (d.mode === 'draw-callout') {
      if (Math.hypot(dr.lx - dr.ax, dr.ly - dr.ay) < 4) {
        const cols = calloutColumns().filter((c) => c > dr.ax);
        dr.lx = cols.length ? Math.min(...cols) : Math.min(dr.ax + 80, P.page.w - 120); dr.ly = dr.ay;
      }
      checkpoint(); ui.sel = addItem(dr).id; persist();
      renderAll(); const sel = $('#glossary-pick'); if (sel) sel.focus(); return;
    }
    renderAll();
  });

  svg.addEventListener('dblclick', () => { if (ui.tool === 'poly' && ui.draft) { ui.draft.pts.pop(); finishPoly(); } });

  function finishPoly() {
    const dr = ui.draft; ui.draft = null;
    if (!dr) return;
    // remove duplicate trailing points from the double click
    while (dr.pts.length > 2) {
      const a = dr.pts[dr.pts.length - 1], b = dr.pts[dr.pts.length - 2];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.5) dr.pts.pop(); else break;
    }
    if (dr.pts.length >= 2) { checkpoint(); ui.sel = addItem(dr).id; persist(); }
    renderAll();
  }

  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey || Math.abs(e.deltaY) >= 40 || e.deltaMode) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    else { ui.view.x -= e.deltaX; ui.view.y -= e.deltaY; renderCanvas(); }
  }, { passive: false });

  // ------------------------------------------------------------------ keyboard
  const typing = () => { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'); };
  window.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); return; }
    if (typing()) return;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSel(); return; }
    if (mod) return;
    if (e.key === ' ') { ui.space = true; stage.classList.add('panning'); e.preventDefault(); return; }
    if (e.key === 'Escape') { ui.draft = null; ui.drag = null; ui.sel = null; ui.snapPt = null; renderAll(); return; }
    if (e.key === 'Enter' && ui.draft && ui.tool === 'poly') { ui.draft.pts.pop(); finishPoly(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSel(); return; }
    if (e.key === '0') { fitView(); renderCanvas(); return; }
    if (e.key === '+' || e.key === '=') { const r = svg.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); return; }
    if (e.key === '-') { const r = svg.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); return; }
    if (e.key.startsWith('Arrow') && ui.sel) {
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
      const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
      checkpoint();
      if (ui.sel === '__underlay') { P.underlay.x += dx; P.underlay.y += dy; }
      else { const it = selItem(); translateItem(it, clone(it), dx, dy); }
      renderCanvas(); persist(); return;
    }
    const t = TOOLS.find((x) => x && x.key === e.key.toLowerCase());
    if (t) setTool(t.id);
  });
  window.addEventListener('keyup', (e) => { if (e.key === ' ') { ui.space = false; stage.classList.remove('panning'); } });

  window.addEventListener('paste', (e) => {
    if (typing()) return;
    const file = [...(e.clipboardData ? e.clipboardData.files : [])].find((x) => x.type.startsWith('image/'));
    if (file) { e.preventDefault(); importSketch(file); }
  });
  stage.addEventListener('dragover', (e) => e.preventDefault());
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0]; if (!file) return;
    if (file.name.endsWith('.json')) openProject(file); else importSketch(file);
  });

  // ------------------------------------------------------------------ toolbar & top bar
  function setTool(id) {
    if (ui.tool === 'poly' && id !== 'poly' && ui.draft) finishPoly();
    ui.tool = id; ui.draft = null; ui.snapPt = null;
    const t = toolById(id);
    if (t.type) ui.type = t.type;
    stage.classList.toggle('t-select', id === 'select');
    stage.classList.toggle('t-pan', id === 'pan');
    stage.classList.toggle('t-draw', id !== 'select' && id !== 'pan');
    renderToolbar(); renderTypes(); renderStatus(); renderCanvas();
  }

  function renderToolbar() {
    $('#toolbar').innerHTML = TOOLS.map((t) => (t === 'sep' ? '<div class="sep"></div>' :
      `<button class="tool${ui.tool === t.id ? ' on' : ''}" data-tool="${t.id}" title="${esc(t.name)} (${t.key.toUpperCase()})" aria-label="${esc(t.name)}">${t.icon}<span class="k">${t.key.toUpperCase()}</span></button>`)).join('');
  }
  $('#toolbar').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) setTool(b.dataset.tool); });

  function renderTop() {
    document.querySelectorAll('#seg-lang button').forEach((b) => b.classList.toggle('on', b.dataset.lang === P.lang));
    document.querySelectorAll('#seg-style button').forEach((b) => b.classList.toggle('on', b.dataset.style === P.labelStyle));
    const n = $('#project-name'); if (document.activeElement !== n) n.value = P.name;
    document.title = (P.name ? P.name + ' · ' : '') + 'Structural Diagrams';
  }
  $('#seg-lang').addEventListener('click', (e) => { const b = e.target.closest('[data-lang]'); if (!b || b.dataset.lang === P.lang) return; checkpoint(); P.lang = b.dataset.lang; renderAll(); persist(); });
  $('#seg-style').addEventListener('click', (e) => { const b = e.target.closest('[data-style]'); if (!b || b.dataset.style === P.labelStyle) return; checkpoint(); P.labelStyle = b.dataset.style; renderAll(); persist(); });
  $('#project-name').addEventListener('change', (e) => { checkpoint(); P.name = e.target.value.trim() || 'Untitled diagram'; renderTop(); persist(); });

  $('#btn-new').addEventListener('click', () => {
    checkpoint();
    P = newProject(); sketchSrc = null; persistSketch(); ui.sel = null; fitView(); renderAll(); persist();
    toast('New diagram. Undo brings the previous one back.');
  });
  $('#btn-open').addEventListener('click', () => $('#file-open').click());
  $('#file-open').addEventListener('change', (e) => { if (e.target.files[0]) openProject(e.target.files[0]); e.target.value = ''; });
  $('#btn-save').addEventListener('click', saveProject);
  $('#btn-undo').addEventListener('click', undo);
  $('#btn-redo').addEventListener('click', redo);
  $('#btn-sketch').addEventListener('click', () => $('#file-sketch').click());
  $('#file-sketch').addEventListener('change', (e) => { importSketch(e.target.files[0]); e.target.value = ''; });
  $('#btn-svg').addEventListener('click', exportSVG);
  $('#btn-pdf').addEventListener('click', exportPDF);
  $('#btn-copy').addEventListener('click', copySVG);
  $('#zoom-in').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(1.25, r.width / 2, r.height / 2); });
  $('#zoom-out').addEventListener('click', () => { const r = svg.getBoundingClientRect(); zoomAt(0.8, r.width / 2, r.height / 2); });
  $('#zoom-fit').addEventListener('click', () => { fitView(); renderCanvas(); renderStatus(); });

  // ------------------------------------------------------------------ panel
  function renderTypes() {
    const it = selItem();
    const cur = it && !ANNOT_KINDS.includes(it.kind) ? it.type : ui.type;
    $('#type-list').innerHTML = TYPE_ORDER.slice().reverse().map((tid) => {
      const t = TYPES[tid];
      const sw = t.fill && t.fill !== 'none'
        ? `background:${t.fill};border:${Math.min(t.width, 2)}px ${t.dash ? 'dashed' : 'solid'} ${t.stroke}`
        : `background:linear-gradient(${t.stroke},${t.stroke}) center/100% ${Math.max(1.5, Math.min(t.width * 1.4, 5))}px no-repeat`;
      return `<button class="type${tid === cur ? ' on' : ''}" data-type="${tid}"><span class="sw" style="${sw}"></span><span>${esc(t.name[P.lang] || t.name.en)}</span></button>`;
    }).join('');
  }
  $('#type-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-type]'); if (!b) return;
    ui.type = b.dataset.type;
    const it = selItem();
    if (it && !ANNOT_KINDS.includes(it.kind) && it.type !== ui.type) { checkpoint(); it.type = ui.type; renderCanvas(); persist(); }
    renderTypes();
  });

  const KIND_NAMES = { path: 'Line', rect: 'Rectangle', floors: 'Floor slabs', truss: 'Truss', piles: 'Piles', callout: 'Label', text: 'Text', legend: 'Legend' };

  function num(label, prop, val, min, max, step = 1) {
    return `<div class="row"><label for="p-${prop}">${label}</label><input id="p-${prop}" type="number" data-prop="${prop}" value="${val}" min="${min}" max="${max}" step="${step}"></div>`;
  }
  function sel(label, prop, val, opts) {
    return `<div class="row"><label for="p-${prop}">${label}</label><select id="p-${prop}" data-prop="${prop}">${opts.map(([v, n]) => `<option value="${v}"${v === val ? ' selected' : ''}>${n}</option>`).join('')}</select></div>`;
  }
  function chk(label, prop, val) {
    return `<label class="check"><input type="checkbox" data-prop="${prop}"${val ? ' checked' : ''}> ${label}</label>`;
  }

  function renderPanel() {
    renderTypes();
    const body = $('#sel-body'), title = $('#sel-title');
    const it = selItem();
    if (ui.sel === '__underlay') {
      title.textContent = 'Selection: sketch';
      body.innerHTML = '<p class="hint">Drag to move the sketch, drag the corner handle to scale it. Lock it in the underlay section when it is in place.</p>';
    } else if (!it) {
      title.textContent = 'Selection';
      const t = toolById(ui.tool);
      body.innerHTML = `<p class="hint">${esc(t.hint)}</p><p class="hint">Nothing selected. Pick an element type above before drawing, or click an element to edit it.</p>`;
    } else {
      title.textContent = 'Selection: ' + KIND_NAMES[it.kind];
      let h = '';
      if ((it.kind === 'path' && !it.closed) || it.kind === 'floors' || it.kind === 'piles') {
        h += num('Thickness (pt)', 'thick', it.thick || 0, 0, 100, 0.5) + '<p class="hint">0 = single line. Above 0 the member is drawn as a filled band with outline.</p>';
      }
      if (it.kind === 'path') h += chk('Closed shape', 'closed', it.closed) + chk('Smooth curve', 'smooth', it.smooth) + (it.closed ? chk('No fill', 'nofill', it.nofill) : '') +
        `<p class="hint">${it.pts.length} points. Drag the square handles to reshape.</p>`;
      if (it.kind === 'rect') h += sel('Bracing', 'infill', it.infill || 'none', [['none', 'None'], ['x', 'X-bracing'], ['zigzag', 'Zigzag (EBF)'], ['ladder', 'Ladder / coupling beams']]) +
        (it.infill && it.infill !== 'none' ? num('Panels', 'n', it.n, 1, 200) : '') + chk('No fill (outline only)', 'nofill', it.nofill);
      if (it.kind === 'floors') h += num('Floors', 'n', it.n, 1, 300);
      if (it.kind === 'piles') h += num('Piles', 'n', it.n, 1, 200);
      if (it.kind === 'truss') h += num('Panels', 'n', it.n, 1, 100) + sel('Pattern', 'pattern', it.pattern, [['pratt', 'Pratt'], ['warren', 'Warren'], ['x', 'X-braced'], ['vierendeel', 'Vierendeel']]);
      if (RECT_KINDS.includes(it.kind)) h += `<div class="row"><label>Size</label><span class="hint">${f(it.w)} × ${f(it.h)} pt</span></div>`;
      if (it.kind === 'callout') h += calloutPanel(it);
      if (it.kind === 'text') {
        h += ['en', 'de'].map((lg) => `<div class="lang-block${P.lang === lg ? ' cur' : ''}"><span class="tag">${lg.toUpperCase()}</span><textarea data-prop="text.${lg}" rows="2">${esc(it.text[lg] || '')}</textarea></div>`).join('');
        h += num('Size (pt)', 'size', it.size, 4, 200, 0.5) + chk('Bold', 'bold', it.bold);
      }
      if (it.kind === 'legend') h += '<p class="hint">Lists every element type used in the drawing, in the current language. It updates automatically.</p>';
      h += `<div class="btns"><button data-act="dup">Duplicate</button><button data-act="del">Delete</button></div>`;
      body.innerHTML = h;
    }
    renderUnderlayPanel(); renderPagePanel();
  }

  function calloutPanel(it) {
    const groups = {};
    S.glossary.forEach((g) => { (groups[g.group] = groups[g.group] || []).push(g); });
    let opts = `<option value="">Custom text</option>`;
    for (const [gname, list] of Object.entries(groups)) {
      opts += `<optgroup label="${esc(gname)}">` + list.map((g) => `<option value="${g.id}"${g.id === it.key ? ' selected' : ''}>${esc((g[P.lang] || g.en).title)}</option>`).join('') + '</optgroup>';
    }
    let h = `<div class="field"><label for="glossary-pick">From glossary</label><select id="glossary-pick" style="width:100%">${opts}</select></div>`;
    h += ['en', 'de'].map((lg) => {
      const t = it.text[lg] || { title: '', sub: '' };
      const missing = !t.title ? `<span class="warn"> missing</span>` : '';
      return `<div class="lang-block${P.lang === lg ? ' cur' : ''}"><span class="tag">${lg === 'en' ? 'ENGLISH' : 'DEUTSCH'}</span>${missing}
        <input type="text" data-prop="text.${lg}.title" value="${esc(t.title)}" placeholder="Element name" aria-label="${lg} title">
        <textarea data-prop="text.${lg}.sub" rows="2" placeholder="Material / description, one per line" aria-label="${lg} description">${esc(t.sub)}</textarea></div>`;
    }).join('');
    h += sel('Leader', 'leader', it.leader || 'angled', [['angled', 'Angled + shoulder'], ['elbow', 'Vertical then horizontal'], ['direct', 'Straight']]);
    h += `<div class="btns"><button data-act="align">Align all labels</button></div>`;
    return h;
  }

  function setPath(obj, path, val) {
    const ks = path.split('.'); let o = obj;
    for (let i = 0; i < ks.length - 1; i++) { o[ks[i]] = o[ks[i]] || {}; o = o[ks[i]]; }
    o[ks[ks.length - 1]] = val;
  }

  let pendingSnap = null;
  const panel = $('#panel');
  panel.addEventListener('focusin', (e) => { if (e.target.dataset && (e.target.dataset.prop || e.target.dataset.u || e.target.dataset.pg)) pendingSnap = snapshot(); });
  panel.addEventListener('input', (e) => {
    const el = e.target, it = selItem();
    if (el.dataset.prop && it) {
      let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? parseFloat(el.value) : el.value;
      if (el.type === 'number' && !isFinite(v)) return;
      if (el.type === 'checkbox') { checkpoint(); pendingSnap = null; }
      setPath(it, el.dataset.prop, v);
      if (el.dataset.prop.startsWith('text.') && it.kind === 'callout') { it.key = ''; const gp = $('#glossary-pick'); if (gp) gp.value = ''; }
      renderCanvas();
      if (el.type === 'checkbox' || el.tagName === 'SELECT') renderPanel();
      persist();
    }
    if (el.dataset.u && P.underlay) {
      const k = el.dataset.u;
      if (k === 'opacity') P.underlay.opacity = parseFloat(el.value);
      else { checkpoint(); pendingSnap = null; P.underlay[k] = el.checked; if (k === 'locked' && el.checked && ui.sel === '__underlay') ui.sel = null; renderPanel(); }
      renderCanvas(); persist();
    }
  });
  panel.addEventListener('change', (e) => {
    const el = e.target;
    if (el.id === 'glossary-pick') {
      const it = selItem(); if (!it) return;
      const g = S.glossary.find((x) => x.id === el.value);
      checkpoint();
      it.key = el.value;
      if (g) it.text = { en: clone(g.en), de: clone(g.de) };
      renderAll(); persist(); return;
    }
    if (pendingSnap && pendingSnap !== snapshot()) { undoStack.push(pendingSnap); redoStack = []; updateUndoButtons(); }
    pendingSnap = null;
    if (el.dataset.prop) renderPanel();
  });
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act;
    if (a === 'del') deleteSel();
    if (a === 'dup') duplicateSel();
    if (a === 'align') alignLabels();
    if (a === 'sketch') $('#file-sketch').click();
    if (a === 'pdf-prev' && sketchPdf && sketchPdf.page > 1) renderPdfPage(sketchPdf.page - 1);
    if (a === 'pdf-next' && sketchPdf && sketchPdf.page < sketchPdf.pages) renderPdfPage(sketchPdf.page + 1);
    if (a === 'sketch-del') { ui.sel = '__underlay'; deleteSel(); }
    if (a === 'sketch-fit' && P.underlay) {
      checkpoint();
      const u = P.underlay, { w, h } = P.page, s = Math.min((w * 0.9) / u.w, (h * 0.9) / u.h);
      u.w *= s; u.h *= s; u.x = (w - u.w) / 2; u.y = (h - u.h) / 2; renderCanvas(); persist();
    }
  });

  function renderUnderlayPanel() {
    const u = P.underlay, b = $('#underlay-body');
    if (!u || !sketchSrc) {
      b.innerHTML = `<p class="hint">Import the marked-up PDF, a photo or a scan of the sketch and trace over it. You can also paste an image (Ctrl+V) or drop it on the drawing.</p><div class="btns"><button data-act="sketch">Import sketch</button></div>`;
      return;
    }
    const pdfNav = sketchPdf && sketchPdf.pages > 1
      ? `<div class="row"><label>PDF page</label><button data-act="pdf-prev"${sketchPdf.page <= 1 ? ' disabled' : ''}>‹</button><span><b>${sketchPdf.page}</b> / ${sketchPdf.pages}</span><button data-act="pdf-next"${sketchPdf.page >= sketchPdf.pages ? ' disabled' : ''}>›</button></div>` : '';
    b.innerHTML = pdfNav + `<div class="row"><label for="u-op">Opacity</label><input id="u-op" type="range" min="0.05" max="1" step="0.05" value="${u.opacity}" data-u="opacity"></div>
      ${'<label class="check"><input type="checkbox" data-u="visible"' + (u.visible ? ' checked' : '') + '> Show sketch</label>'}
      ${'<label class="check"><input type="checkbox" data-u="locked"' + (u.locked ? ' checked' : '') + '> Locked (unlock to move / scale)</label>'}
      <p class="hint">The sketch is never exported.</p>
      <div class="btns"><button data-act="sketch-fit">Fit to page</button><button data-act="sketch">Replace</button><button data-act="sketch-del">Remove</button></div>`;
  }

  function renderPagePanel() {
    const pg = P.page;
    const sizes = Object.keys(S.pages).map((k) => `<option${pg.size === k ? ' selected' : ''}>${k}</option>`).join('');
    $('#page-body').innerHTML = `
      <div class="row"><label for="pg-size">Format</label><select id="pg-size" data-pg="size">${sizes}</select>
        <select id="pg-orient" data-pg="orient"><option value="landscape"${pg.orient === 'landscape' ? ' selected' : ''}>Landscape</option><option value="portrait"${pg.orient === 'portrait' ? ' selected' : ''}>Portrait</option></select></div>
      <div class="row"><label for="pg-grid">Grid (pt)</label><input id="pg-grid" type="number" min="1" max="100" step="1" value="${P.grid}" data-pg="grid"></div>
      <label class="check"><input type="checkbox" data-pg="snap"${P.snap ? ' checked' : ''}> Snap to grid and points (hold Alt to bypass)</label>
      <label class="check"><input type="checkbox" data-pg="showGrid"${P.showGrid ? ' checked' : ''}> Show grid</label>`;
  }
  $('#page-body').addEventListener('change', (e) => {
    const el = e.target, k = el.dataset.pg; if (!k) return;
    checkpoint(); pendingSnap = null;
    if (k === 'size' || k === 'orient') {
      P.page[k] = el.value;
      const [lw, lh] = S.pages[P.page.size];
      Object.assign(P.page, P.page.orient === 'landscape' ? { w: lw, h: lh } : { w: lh, h: lw });
      fitView();
    } else if (k === 'grid') P.grid = Math.max(1, parseFloat(el.value) || 5);
    else P[k] = el.checked;
    renderAll(); persist();
  });

  function focusFirstInput() { const el = $('#sel-body textarea, #sel-body input'); if (el) { el.focus(); el.select && el.select(); } }

  function renderStatus(p) {
    const t = toolById(ui.tool);
    const pos = p ? `<span>x <b>${f(p[0])}</b> y <b>${f(p[1])}</b> pt</span>` : '';
    $('#status').innerHTML = `<span><b>${esc(t.name)}</b>: ${esc(t.hint)}</span><span style="margin-left:auto">${Math.round(ui.view.k * 100)}%</span>${pos}<span>${P.page.size} ${P.page.orient}</span>`;
  }

  let toastTimer;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 3800);
  }

  window.addEventListener('resize', () => { renderCanvas(); });

  // ------------------------------------------------------------------ example project
  function exampleProject() {
    const p = newProject();
    p.name = 'Example: tower with core';
    const add = (it) => { it.id = 'e' + (p.nextId++); p.items.push(it); return it; };
    add({ kind: 'rect', type: 'ground', x: 300, y: 690, w: 560, h: 140 });
    add({ kind: 'piles', type: 'pile', x: 400, y: 712, w: 340, h: 110, n: 12 });
    add({ kind: 'path', type: 'foundation', pts: [[380, 700], [760, 700], [760, 712], [380, 712]], closed: true });
    add({ kind: 'floors', type: 'slab', x: 380, y: 100, w: 380, h: 580, n: 30 });
    add({ kind: 'floors', type: 'slab', x: 380, y: 620, w: 380, h: 60, n: 4 });
    add({ kind: 'piles', type: 'column', x: 400, y: 100, w: 60, h: 600, n: 3 });
    add({ kind: 'piles', type: 'column', x: 680, y: 100, w: 60, h: 600, n: 3 });
    add({ kind: 'rect', type: 'core', x: 500, y: 60, w: 50, h: 640, infill: 'none', n: 8 });
    add({ kind: 'rect', type: 'core', x: 590, y: 60, w: 50, h: 640, infill: 'none', n: 8 });
    add({ kind: 'rect', type: 'core', x: 550, y: 60, w: 40, h: 640, infill: 'ladder', n: 40, nofill: true });
    add({ kind: 'truss', type: 'steel', x: 400, y: 560, w: 80, h: 40, n: 2, pattern: 'warren' });
    add({ kind: 'path', type: 'envelope', pts: [[370, 92], [770, 92], [770, 690], [370, 690]], closed: true, nofill: true });
    const g = (id) => S.glossary.find((x) => x.id === id);
    const co = (key, ax, ay, ly) => add({ kind: 'callout', ax, ay, lx: 880, ly, leader: 'elbow', key, text: { en: clone(g(key).en), de: clone(g(key).de) } });
    co('flat_slab', 730, 157, 157);
    co('columns_rc', 720, 230, 230);
    co('core_walls_short', 640, 320, 320);
    co('truss', 470, 580, 580);
    co('raft_piles', 700, 706, 706);
    add({ kind: 'legend', x: 70, y: 600 });
    add({ kind: 'text', x: 70, y: 80, size: 16, bold: true, text: { en: 'Structural system', de: 'Tragwerkskonzept' } });
    return p;
  }

  // ------------------------------------------------------------------ boot
  function boot() {
    if (!restore()) P = exampleProject();
    renderToolbar();
    setTool('select');
    fitView();
    renderAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderCanvas());
  }
  boot();
})();
