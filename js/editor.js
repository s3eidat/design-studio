/* Design Studio editor: canvas interaction, panels, dialogs and keyboard shortcuts. */
(function () {
  "use strict";
  const DS = window.DS, C = DS.core, R = DS.render, IO = DS.io, $ = S3.$, $$ = S3.$$, h = S3.h;
  const ED = DS.ed = {
    doc: null, pi: 0, sel: [], zoom: 1, panX: 0, panY: 0, hist: new C.History(150), editing: null, hover: null,
    guides: [], marquee: null, label: null, clip: null, fonts: ["Inter"], userFonts: [], snap: S3.store("ds.snap") !== false, tab: "templates"
  };
  const stage = $("#stage"), cv = $("#cv"), ctx = cv.getContext("2d"), ta = $("#textEdit");
  let dpr = 1, vw = 300, vh = 300;
  const page = () => ED.doc.pages[ED.pi];
  const selObjs = () => ED.sel.map(id => C.find(page(), id)).filter(Boolean);
  const isTyping = el => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r1 = v => Math.round(v * 10) / 10;
  const SVGNS = "http://www.w3.org/2000/svg";
  function svgEl(attrs, inner) {
    const el = document.createElementNS(SVGNS, "svg");
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    el.innerHTML = inner; return el;
  }
  function icon(id) { return svgEl({ "class": "i", "aria-hidden": "true" }, '<use href="#' + S3.esc(id) + '"/>'); }

  // ================= view =================
  function resizeCanvas() {
    const r = stage.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1; vw = Math.max(50, r.width); vh = Math.max(50, r.height);
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    cv.style.width = vw + "px"; cv.style.height = vh + "px";
    if ((!ED.fitted || !ED.userZoom) && ED.doc) fit(); else draw();
  }
  function fit() {
    const pad = vw < 500 ? 16 : 44;
    ED.zoom = clamp(Math.min((vw - pad * 2) / ED.doc.w, (vh - pad * 2) / ED.doc.h), 0.02, 8);
    ED.panX = (vw - ED.doc.w * ED.zoom) / 2; ED.panY = (vh - ED.doc.h * ED.zoom) / 2;
    ED.fitted = true; ED.userZoom = false; zoomLabel(); placeText(); draw();
  }
  function toPage(sx, sy) { return { x: (sx - ED.panX) / ED.zoom, y: (sy - ED.panY) / ED.zoom }; }
  function toScreen(x, y) { return { x: x * ED.zoom + ED.panX, y: y * ED.zoom + ED.panY }; }
  function zoomAt(z, sx, sy) {
    z = clamp(z, 0.02, 8); const p = toPage(sx, sy); ED.userZoom = true;
    ED.zoom = z; ED.panX = sx - p.x * z; ED.panY = sy - p.y * z; zoomLabel(); placeText(); draw();
  }
  function zoomLabel() { $("#zLabel").textContent = Math.round(ED.zoom * 100) + "%"; }
  function local(e) { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  let raf = 0;
  function draw() { if (!raf) raf = requestAnimationFrame(paint); }
  R.onImage = () => { draw(); thumbsSoon(); };
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function paint() {
    raf = 0;
    const d = ED.doc; if (!d) return;
    const z = ED.zoom, accent = css("--accent") || "#3dd6d0";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.save(); ctx.translate(ED.panX, ED.panY); ctx.scale(z, z);
    ctx.save(); ctx.shadowColor = "rgba(0,0,0,0.28)"; ctx.shadowBlur = 22; ctx.shadowOffsetY = 6;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, d.w, d.h); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, d.w, d.h); ctx.clip();
    R.drawPage(ctx, d, page(), { doc: d, scale: z * dpr, editor: true, skip: ED.editing });
    ctx.restore(); ctx.restore();
    overlays(accent);
  }
  function screenPoly(o) { return C.corners(o).map(p => toScreen(p.x, p.y)); }
  function strokePoly(pts, color, w, dash) {
    ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath();
    ctx.setLineDash(dash || []); ctx.lineWidth = w; ctx.strokeStyle = color; ctx.stroke(); ctx.setLineDash([]);
  }
  function lineBox(o) { return o.type === "line" ? { x: o.x, y: o.y + o.h / 2 - Math.max(o.h, 4 / ED.zoom) / 2, w: o.w, h: Math.max(o.h, 4 / ED.zoom), rot: o.rot } : o; }
  function overlays(accent) {
    const sel = selObjs();
    if (ED.hover && ED.sel.indexOf(ED.hover) < 0 && !ED.drag) { const o = C.find(page(), ED.hover); if (o) strokePoly(screenPoly(lineBox(o)), accent, 1.5); }
    sel.forEach(o => strokePoly(screenPoly(lineBox(o)), o.locked ? "#9aa3ad" : accent, sel.length > 1 ? 1 : 1.5, o.locked ? [4, 3] : null));
    if (ED.editing) return;
    if (sel.length > 1) { const b = C.unionBox(sel); strokePoly(screenPoly(b), accent, 1, [5, 4]); }
    handles().forEach(hd => {
      ctx.beginPath();
      if (hd.k === "rot") { ctx.arc(hd.x, hd.y, 7, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = accent; ctx.stroke();
        ctx.beginPath(); ctx.arc(hd.x, hd.y, 3.2, -2.4, 1.6); ctx.stroke(); }
      else if (hd.k === "e" || hd.k === "w" || hd.k === "n" || hd.k === "s") {
        ctx.save(); ctx.translate(hd.x, hd.y); ctx.rotate(hd.rot * Math.PI / 180);
        const vert = hd.k === "e" || hd.k === "w"; R.rrect(ctx, vert ? -3.5 : -9, vert ? -9 : -3.5, vert ? 7 : 18, vert ? 18 : 7, 3.5);
        ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.stroke(); ctx.restore();
      } else { ctx.arc(hd.x, hd.y, 6, 0, Math.PI * 2); ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.stroke(); }
    });
    ctx.strokeStyle = "#ff3d8b"; ctx.lineWidth = 1;
    ED.guides.forEach(g => {
      ctx.beginPath();
      if (g.axis === "x") { const s = toScreen(g.at, 0); ctx.moveTo(Math.round(s.x) + 0.5, 0); ctx.lineTo(Math.round(s.x) + 0.5, vh); }
      else { const s = toScreen(0, g.at); ctx.moveTo(0, Math.round(s.y) + 0.5); ctx.lineTo(vw, Math.round(s.y) + 0.5); }
      ctx.stroke();
    });
    if (ED.marquee) {
      const m = ED.marquee, a = toScreen(m.x, m.y);
      ctx.fillStyle = "rgba(61,214,208,0.10)"; ctx.fillRect(a.x, a.y, m.w * ED.zoom, m.h * ED.zoom);
      ctx.strokeStyle = accent; ctx.strokeRect(a.x + 0.5, a.y + 0.5, m.w * ED.zoom, m.h * ED.zoom);
    }
    if (ED.label) {
      ctx.font = "600 12px Inter, system-ui, sans-serif"; const tw = ctx.measureText(ED.label.t).width + 14;
      const x = clamp(ED.label.x - tw / 2, 4, vw - tw - 4), y = clamp(ED.label.y, 4, vh - 26);
      ctx.fillStyle = "rgba(20,23,27,0.92)"; ctx.beginPath(); R.rrect(ctx, x, y, tw, 22, 6); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.textBaseline = "middle"; ctx.textAlign = "left"; ctx.fillText(ED.label.t, x + 7, y + 11.5);
    }
  }

  function handles() {
    const sel = selObjs().filter(o => !o.locked);
    if (!sel.length || sel.length !== ED.sel.length) return [];
    let o, kinds;
    if (sel.length === 1) {
      o = lineBox(sel[0]);
      kinds = sel[0].type === "line" ? ["e", "w"] : sel[0].type === "text" ? ["nw", "ne", "se", "sw", "e", "w"] : ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
      const sw = o.w * ED.zoom, sh = o.h * ED.zoom;
      if (sel[0].type !== "line" && (sw < 28 || sh < 28)) kinds = kinds.filter(k => k.length === 2);
    } else { o = C.unionBox(sel); o.rot = 0; kinds = ["nw", "ne", "se", "sw"]; }
    const c = C.center(o), r = o.rot || 0, P = { n: [0.5, 0], s: [0.5, 1], e: [1, 0.5], w: [0, 0.5], nw: [0, 0], ne: [1, 0], se: [1, 1], sw: [0, 1] };
    const out = kinds.map(k => { const p = C.rotPt(o.x + o.w * P[k][0], o.y + o.h * P[k][1], c.x, c.y, r), s = toScreen(p.x, p.y); return { k: k, x: s.x, y: s.y, rot: r }; });
    const top = C.rotPt(c.x, o.y, c.x, c.y, r), st = toScreen(top.x, top.y), ux = Math.sin(r * Math.PI / 180), uy = -Math.cos(r * Math.PI / 180);
    out.push({ k: "rot", x: st.x + ux * 28, y: st.y + uy * 28, rot: r });
    return out;
  }
  function handleAt(sx, sy) {
    const hs = handles();
    for (let i = hs.length - 1; i >= 0; i--) if (Math.hypot(hs[i].x - sx, hs[i].y - sy) <= (hs[i].k.length === 1 ? 11 : 10)) return hs[i];
    return null;
  }
  const CURS = ["ns-resize", "nesw-resize", "ew-resize", "nwse-resize"];
  function cursorFor(k, rot) {
    if (k === "rot") return "grab";
    const base = { n: 0, ne: 1, e: 2, se: 3, s: 0, sw: 1, w: 2, nw: 3 }[k];
    return CURS[(base + Math.round(((rot % 180) + 180) % 180 / 45)) % 4];
  }

  // ================= history / saving =================
  let commitT = 0, saveT = 0;
  function commit() {
    clearTimeout(commitT);
    if (ED.hist.commit(ED.doc)) { dirty(); thumbsSoon(); layersSoon(); }
    undoButtons();
  }
  function commitSoon() { clearTimeout(commitT); commitT = setTimeout(commit, 400); }
  function undoButtons() { $("#btnUndo").disabled = !ED.hist.canUndo(); $("#btnRedo").disabled = !ED.hist.canRedo(); }
  function saveState(t, kind) { const s = $("#saveState"); s.textContent = t; s.className = "chip ds-save" + (kind ? " " + kind : ""); }
  function dirty() { saveState("Saving…"); clearTimeout(saveT); saveT = setTimeout(autosave, 700); }
  function thumbData(doc) {
    try { const k = Math.min(240 / doc.w, 240 / doc.h), c = R.pageCanvas(doc, doc.pages[0], k, {}); return c.toDataURL("image/jpeg", 0.7); } catch (e) { return ""; }
  }
  function autosave() {
    const d = ED.doc;
    return IO.store.put({ id: d.id, name: d.name, updated: Date.now(), w: d.w, h: d.h, pages: d.pages.length, thumb: thumbData(d), doc: d })
      .then(() => { saveState("Saved on this device", "ok"); S3.store("ds.last", d.id); if (ED.tab === "designs") renderDesigns(); })
      .catch(() => saveState("Not saved: browser storage blocked", "warn"));
  }
  function undo() { finishText(); if (ED.hist.undo(ED.doc)) afterHistory(); }
  function redo() { finishText(); if (ED.hist.redo(ED.doc)) afterHistory(); }
  function afterHistory() {
    ED.pi = Math.min(ED.pi, ED.doc.pages.length - 1);
    ED.sel = ED.sel.filter(id => C.find(page(), id));
    $("#docName").value = ED.doc.name;
    undoButtons(); dirty(); selectionChanged(); renderPages(); fitIfSizeChanged();
  }
  let lastSize = "";
  function fitIfSizeChanged() { const s = ED.doc.w + "x" + ED.doc.h; if (s !== lastSize) { lastSize = s; fit(); } }

  // ================= open / new =================
  function openDoc(doc, opts) {
    finishText();
    ED.doc = doc; ED.pi = 0; ED.sel = []; ED.hover = null;
    R.fitAll(doc);
    ED.hist.reset(doc); undoButtons();
    $("#docName").value = doc.name;
    lastSize = doc.w + "x" + doc.h; ED.fitted = false; fit();
    IO.registerDocFonts(doc).then(() => { R.clearCache(); R.fitAll(doc); draw(); thumbsSoon(); buildProps(); });
    renderPages(); selectionChanged(); renderAssets();
    S3.store("ds.last", doc.id);
    if (!opts || !opts.quiet) saveState(opts && opts.saved ? "Saved on this device" : "Not saved yet", opts && opts.saved ? "ok" : "");
    if (opts && opts.save) autosave();
  }
  function newBlank(size) {
    const d = C.newDoc(size.w, size.h, size.name || "Untitled design");
    d.print = size.print ? C.clone(size.print) : null;
    openDoc(d, { save: true });
  }

  // ================= selection =================
  function select(ids) { ED.sel = ids; selectionChanged(); }
  function selectionChanged() { buildProps(); renderLayers(); draw(); }

  // ================= pointer interaction =================
  const pointers = new Map();
  let spaceDown = false, lastDown = null;
  cv.addEventListener("pointerdown", e => {
    stage.focus({ preventScroll: true });
    if (ED.editing) finishText();
    const s = local(e); pointers.set(e.pointerId, s);
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      revertDrag();
      ED.drag = { type: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: ED.zoom, pa: toPage(mx, my) };
      return;
    }
    if (e.button === 1 || spaceDown) { e.preventDefault(); ED.drag = { type: "pan", sx: s.x, sy: s.y, px: ED.panX, py: ED.panY }; cv.style.cursor = "grabbing"; return; }
    if (e.button !== 0) return;
    const p = toPage(s.x, s.y), hd = handleAt(s.x, s.y);
    if (hd) { startTransform(hd, p); return; }
    const o = C.hitTest(page().objects, p.x, p.y, 3 / ED.zoom);
    const multi = e.shiftKey || e.ctrlKey || e.metaKey;
    if (o) {
      const was = ED.sel.indexOf(o.id) >= 0;
      if (multi) { select(was ? ED.sel.filter(id => id !== o.id) : ED.sel.concat(o.id)); if (was) return; }
      else if (!was) select([o.id]);
      const items = selObjs().filter(x => !x.locked);
      ED.drag = { type: "move", start: p, was: was && !multi, id: o.id, moved: false,
        items: items.map(x => ({ o: x, x: x.x, y: x.y })), box: items.length ? C.unionBox(items) : null,
        targets: C.snapTargets(page(), ED.doc.w, ED.doc.h, ED.sel) };
    } else {
      if (!multi && ED.sel.length) select([]);
      ED.drag = { type: "marquee", start: p, base: multi ? ED.sel.slice() : [] };
    }
    lastDown = { t: Date.now(), x: s.x, y: s.y };
  });
  function revertDrag() {   // a second finger cancels a half-done move/resize
    const d = ED.drag; if (!d || !d.orig) return;
    d.orig.forEach(it => Object.assign(it.o, C.clone(it.state)));
  }
  function startTransform(hd, p) {
    const sel = selObjs();
    ED.drag = { type: hd.k === "rot" ? "rotate" : "resize", hd: hd.k, start: p, moved: false,
      orig: sel.map(o => ({ o: o, state: C.clone(o) })), box: sel.length > 1 ? C.unionBox(sel) : null };
    if (hd.k === "rot") { const b = sel.length > 1 ? ED.drag.box : sel[0], c = C.center(b); ED.drag.c = c; ED.drag.a0 = Math.atan2(p.y - c.y, p.x - c.x) * 180 / Math.PI; }
  }
  cv.addEventListener("pointermove", e => {
    const s = local(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, s);
    const d = ED.drag;
    if (!d) { hover(s); return; }
    const p = toPage(s.x, s.y);
    if (d.type === "pinch") {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()], dist = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ED.zoom = clamp(d.z0 * dist / d.d0, 0.02, 8); ED.userZoom = true; ED.panX = mx - d.pa.x * ED.zoom; ED.panY = my - d.pa.y * ED.zoom;
      zoomLabel(); draw(); return;
    }
    if (d.type === "pan") { ED.userZoom = true; ED.panX = d.px + s.x - d.sx; ED.panY = d.py + s.y - d.sy; placeText(); draw(); return; }
    if (d.type === "marquee") {
      const m = { x: Math.min(d.start.x, p.x), y: Math.min(d.start.y, p.y), w: Math.abs(p.x - d.start.x), h: Math.abs(p.y - d.start.y) };
      ED.marquee = m;
      const hits = page().objects.filter(o => !o.hidden && !o.locked && C.boxesIntersect(C.aabb(o), m)).map(o => o.id);
      ED.sel = d.base.concat(hits.filter(id => d.base.indexOf(id) < 0)); draw(); return;
    }
    if (d.type === "move") {
      let dx = p.x - d.start.x, dy = p.y - d.start.y;
      if (!d.moved && Math.hypot(dx, dy) * ED.zoom < 3) return;
      if (!d.box) return;
      d.moved = true;
      if (e.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      ED.guides = [];
      if (ED.snap && !e.altKey) {
        const sn = C.snapBox({ x: d.box.x + dx, y: d.box.y + dy, w: d.box.w, h: d.box.h }, d.targets, 6 / ED.zoom);
        dx += sn.dx; dy += sn.dy; ED.guides = sn.guides;
      }
      d.items.forEach(it => { it.o.x = it.x + dx; it.o.y = it.y + dy; });
      ED.label = { t: "X " + Math.round(d.box.x + dx) + "  Y " + Math.round(d.box.y + dy), x: s.x, y: s.y + 22 };
      draw(); geomFields(); return;
    }
    d.moved = true;
    if (d.type === "resize") doResize(d, p, e.shiftKey, s);
    if (d.type === "rotate") doRotate(d, p, e.shiftKey, s);
    draw(); geomFields();
  });
  function doResize(d, p, shift, s) {
    if (d.orig.length === 1) {
      const o = d.orig[0].o, st = d.orig[0].state, corner = d.hd.length === 2;
      const keepDefault = o.type === "image" || o.type === "icon" || o.type === "group" || o.type === "text";
      const keep = corner && (o.type === "text" || keepDefault !== shift);
      const nb = C.resizeBox(st, d.hd, p, keep, 2);
      if (o.type === "text") {
        if (corner) {
          const k = nb.w / st.w;
          o.size = Math.max(1, st.size * k); o.ls = (st.ls || 0) * k; o.strokeW = (st.strokeW || 0) * k;
          if (st.shadow) o.shadow = { x: st.shadow.x * k, y: st.shadow.y * k, blur: st.shadow.blur * k, color: st.shadow.color };
          Object.assign(o, nb); R.fitText(o);
        } else {
          o.w = nb.w; o.x = nb.x; R.fitText(o);
          if (!st.rot) o.y = st.y; else { const c = C.center(nb); o.y = c.y - o.h / 2; o.x = c.x - o.w / 2; }
        }
      } else if (o.type === "line") { o.x = nb.x; o.y = nb.y; o.w = nb.w; }
      else if (o.type === "group") {
        o.children = C.clone(st.children); C.scaleGroupChildren(o, nb.w / st.w, nb.h / st.h);
        Object.assign(o, nb);
      } else Object.assign(o, nb);
      ED.label = { t: Math.round(o.w) + " × " + Math.round(o.h), x: s.x, y: s.y + 22 };
    } else {
      const B = d.box, nb = C.resizeBox({ x: B.x, y: B.y, w: B.w, h: B.h, rot: 0 }, d.hd, p, true, 4), k = nb.w / B.w;
      const ax = d.hd.indexOf("w") >= 0 ? B.x + B.w : B.x, ay = d.hd.indexOf("n") >= 0 ? B.y + B.h : B.y;
      const nax = d.hd.indexOf("w") >= 0 ? nb.x + nb.w : nb.x, nay = d.hd.indexOf("n") >= 0 ? nb.y + nb.h : nb.y;
      d.orig.forEach(it => {
        const o = it.o, st = it.state; Object.assign(o, C.clone(st));
        const c = C.center(st), ncx = nax + (c.x - ax) * k, ncy = nay + (c.y - ay) * k;
        o.w = st.w * k; if (o.type !== "line") o.h = st.h * k;
        C.scaleProps(o, k); if (o.type === "group") C.scaleGroupChildren(o, k, k);
        o.x = ncx - o.w / 2; o.y = ncy - o.h / 2;
        if (o.type === "text") { R.fitText(o); o.y = ncy - o.h / 2; }
      });
      ED.label = { t: Math.round(nb.w) + " × " + Math.round(nb.h), x: s.x, y: s.y + 22 };
    }
  }
  function doRotate(d, p, shift, s) {
    const a = Math.atan2(p.y - d.c.y, p.x - d.c.x) * 180 / Math.PI;
    if (d.orig.length === 1) {
      const o = d.orig[0].o;
      o.rot = C.snapAngle(a + 90, shift);
      if (o.rot > 180) o.rot -= 360;
      ED.label = { t: Math.round(o.rot) + "°", x: s.x, y: s.y + 26 };
    } else {
      let da = a - d.a0; if (shift) da = Math.round(da / 15) * 15;
      d.orig.forEach(it => {
        const o = it.o, st = it.state, c = C.center(st), nc = C.rotPt(c.x, c.y, d.c.x, d.c.y, da);
        o.x = nc.x - st.w / 2; o.y = nc.y - st.h / 2; o.rot = ((st.rot || 0) + da) % 360;
      });
      ED.label = { t: Math.round(da) + "°", x: s.x, y: s.y + 26 };
    }
  }
  function endPointer(e) {
    pointers.delete(e.pointerId);
    const d = ED.drag; if (!d) return;
    if (d.type === "pinch") { if (pointers.size === 0) ED.drag = null; return; }
    ED.drag = null; ED.guides = []; ED.marquee = null; ED.label = null;
    cv.style.cursor = "";
    if (d.type === "marquee") selectionChanged();
    else if (d.moved && d.type !== "pan") { commit(); geomFields(); }
    else if (d.type === "move" && d.was && e.type === "pointerup") {
      const o = C.find(page(), d.id);
      if (o && o.type === "text" && ED.sel.length === 1) startText(o);
    }
    draw();
  }
  cv.addEventListener("pointerup", endPointer);
  cv.addEventListener("pointercancel", endPointer);
  cv.addEventListener("pointerleave", () => { if (!ED.drag && ED.hover) { ED.hover = null; draw(); } });
  function hover(s) {
    if (spaceDown) { cv.style.cursor = "grab"; return; }
    const hd = handleAt(s.x, s.y);
    if (hd) { cv.style.cursor = cursorFor(hd.k, hd.rot); if (ED.hover) { ED.hover = null; draw(); } return; }
    const p = toPage(s.x, s.y), o = C.hitTest(page().objects, p.x, p.y, 3 / ED.zoom), id = o ? o.id : null;
    cv.style.cursor = o ? (o.locked ? "default" : "move") : "default";
    if (id !== ED.hover) { ED.hover = id; draw(); }
  }
  cv.addEventListener("dblclick", e => {
    const s = local(e), p = toPage(s.x, s.y), o = C.hitTest(page().objects, p.x, p.y, 3 / ED.zoom);
    if (!o) return;
    if (o.type === "text") startText(o);
    else if (o.type === "image" && !o.locked) pickImageFor(o.id);
  });
  stage.addEventListener("wheel", e => {
    e.preventDefault();
    const s = local(e), unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? vh : 1;
    if (e.ctrlKey || e.metaKey) zoomAt(ED.zoom * Math.exp(-e.deltaY * unit * 0.0022), s.x, s.y);
    else { ED.panX -= (e.shiftKey ? e.deltaY : e.deltaX) * unit; ED.panY -= (e.shiftKey ? 0 : e.deltaY) * unit; ED.userZoom = true; placeText(); draw(); }
  }, { passive: false });

  // drop images onto the canvas (onto an image frame fills it)
  stage.addEventListener("dragover", e => { e.preventDefault(); stage.classList.add("is-over"); });
  stage.addEventListener("dragleave", () => stage.classList.remove("is-over"));
  stage.addEventListener("drop", e => {
    e.preventDefault(); stage.classList.remove("is-over");
    const files = [...(e.dataTransfer && e.dataTransfer.files || [])];
    const s = local(e), p = toPage(s.x, s.y);
    const proj = files.find(f => /\.(s3design|json)$/i.test(f.name));
    if (proj) { openFile(proj); return; }
    const imgs = files.filter(f => /^image\//.test(f.type));
    if (!imgs.length) return;
    const t = C.hitTest(page().objects, p.x, p.y, 0);
    addImageFiles(imgs, t && t.type === "image" && !t.locked ? t.id : null, p);
  });

  // ================= text editing (a textarea laid over the text object) =================
  function startText(o) {
    if (!o || o.locked) return;
    ED.editing = o.id; ta.hidden = false; ta.value = o.text; placeText();
    ta.focus(); ta.select(); draw();
  }
  function placeText() {
    if (!ED.editing) return;
    const o = C.find(page(), ED.editing); if (!o) { finishText(); return; }
    const z = ED.zoom, s = toScreen(o.x, o.y), col = typeof o.color === "string" ? o.color : o.color.c[0];
    Object.assign(ta.style, {
      left: s.x + "px", top: s.y + "px", width: Math.max(20, o.w * z) + "px", height: Math.max(o.h, o.size * o.lh) * z + "px",
      font: R.fontCss(o, o.size * z), lineHeight: String(o.lh), letterSpacing: (o.ls || 0) * z + "px", color: col,
      textAlign: o.align, direction: R.textDir(o), textTransform: o.upper ? "uppercase" : "none",
      transform: "rotate(" + (o.rot || 0) + "deg)", textDecoration: o.underline ? "underline" : "none"
    });
  }
  ta.addEventListener("input", () => {
    const o = C.find(page(), ED.editing); if (!o) return;
    o.text = ta.value; R.fitText(o); placeText();
    const pt = $("#pText"); if (pt) pt.value = o.text;
  });
  ta.addEventListener("keydown", e => {
    e.stopPropagation();
    if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); finishText(); stage.focus(); }
  });
  ta.addEventListener("blur", () => finishText());
  function finishText() {
    if (!ED.editing) return;
    const id = ED.editing; ED.editing = null; ta.hidden = true;
    const o = C.find(page(), id);
    if (o && !o.text.trim()) { page().objects = page().objects.filter(x => x.id !== id); ED.sel = ED.sel.filter(x => x !== id); }
    commit(); buildProps(); draw();
  }

  // ================= object commands =================
  function addObject(o, opts) {
    page().objects.push(o); R.fitText(o);
    if (!opts || !opts.keepPos) { o.x = (ED.doc.w - o.w) / 2; o.y = (ED.doc.h - o.h) / 2; }
    select([o.id]); commit();
    return o;
  }
  const base = () => Math.min(ED.doc.w, ED.doc.h);
  function addText(kind) {
    const W = ED.doc.w, b = base();
    const k = { h1: [0.1, 800, "Add a heading"], h2: [0.06, 600, "Add a subheading"], body: [0.035, 400, "Add a little bit of body text"], ar: [0.09, 700, "أضف عنوانًا"] }[kind] || [0.06, 600, "Text"];
    const o = C.make("text", { text: k[2], size: Math.max(8, Math.round(b * k[0])), weight: k[1], w: Math.min(W * 0.8, b * k[0] * k[2].length * 0.62 + 10), color: "#111111" });
    if (kind === "ar") o.dir = "rtl";
    addObject(o); if (vw > 0) startText(o);
  }
  function addCombo(i) {
    const b = base();
    const combos = [
      () => [C.make("text", { text: "BIG SALE", size: b * 0.14, weight: 900, color: "#ffe14d", strokeW: b * 0.008, stroke: "#151515", w: b * 0.8 })],
      () => [C.make("text", { text: "“Make it simple, but significant.”", size: b * 0.055, font: "Georgia", italic: true, weight: 400, color: "#2b2420", w: b * 0.7, lh: 1.3 })],
      () => [C.make("text", { text: "NEW ARRIVALS", size: b * 0.03, weight: 700, ls: b * 0.008, color: "#ffffff", bgc: "#111111", w: b * 0.45 })]
    ];
    addObject(combos[i]()[0]);
  }
  function addShape(shape) {
    const b = base() * 0.3;
    const o = C.make("shape", { shape: shape, w: shape === "arrow" ? b * 1.5 : b, h: shape === "arrow" ? b * 0.7 : b, fill: "#3dd6d0" });
    if (shape === "rect") o.radius = 0;
    addObject(o);
  }
  function addLine(kind) {
    const o = C.make("line", { w: base() * 0.4, h: Math.max(2, base() * 0.006), stroke: "#111111" });
    if (kind === "dash") o.dash = "dash"; if (kind === "dot") o.dash = "dot"; if (kind === "arrow") o.end = "arrow";
    addObject(o);
  }
  function addIcon(name) { const b = base() * 0.18; addObject(C.make("icon", { icon: name, w: b, h: b, color: "#111111", sw: 2 })); }
  function deleteSel() {
    const ids = selObjs().filter(o => !o.locked).map(o => o.id); if (!ids.length) return;
    page().objects = page().objects.filter(o => ids.indexOf(o.id) < 0); select([]); commit();
  }
  function cloneWithIds(o) { const c = C.clone(o); c.id = C.uid(); if (c.children) c.children = c.children.map(cloneWithIds); return c; }
  function duplicateSel() {
    const sel = selObjs(); if (!sel.length) return;
    const off = Math.max(10, base() * 0.02), out = sel.map(o => { const c = cloneWithIds(o); c.x += off; c.y += off; c.locked = false; return c; });
    page().objects = page().objects.concat(out); select(out.map(o => o.id)); commit();
  }
  function copySel(cut) {
    const sel = selObjs(); if (!sel.length) return;
    const assets = {};
    (function walk(list) { list.forEach(o => { if (o.type === "image" && o.src && ED.doc.assets[o.src]) assets[o.src] = ED.doc.assets[o.src]; if (o.children) walk(o.children); }); })(sel);
    ED.clip = { objs: C.clone(sel), assets: assets, n: 0 };
    if (cut) deleteSel(); else S3.toast(sel.length + (sel.length > 1 ? " objects" : " object") + " copied");
  }
  function paste() {
    if (!ED.clip) return;
    Object.keys(ED.clip.assets).forEach(k => { if (!ED.doc.assets[k]) ED.doc.assets[k] = ED.clip.assets[k]; });
    ED.clip.n++;
    const off = ED.clip.n * Math.max(10, base() * 0.02), out = ED.clip.objs.map(o => { const c = cloneWithIds(o); c.x += off; c.y += off; return c; });
    page().objects = page().objects.concat(out); select(out.map(o => o.id)); commit(); renderAssets();
  }
  function groupSel() {
    if (ED.sel.length < 2) return;
    const g = C.group(page(), ED.sel); if (g) { select([g.id]); commit(); }
  }
  function ungroupSel() {
    const gs = selObjs().filter(o => o.type === "group"); if (!gs.length) return;
    let ids = [];
    gs.forEach(g => { ids = ids.concat(C.ungroup(page(), g.id).map(o => o.id)); });
    select(ids); commit();
  }
  function order(dir) { if (!ED.sel.length) return; C.reorder(page(), ED.sel, dir); commit(); renderLayers(); draw(); }
  function toggleLock() {
    const sel = selObjs(); if (!sel.length) return;
    const lock = !sel.every(o => o.locked); sel.forEach(o => { o.locked = lock; }); commit(); buildProps(); draw();
    S3.toast(lock ? "Locked: it can't be moved until you unlock it" : "Unlocked");
  }
  function nudge(dx, dy) {
    const sel = selObjs().filter(o => !o.locked); if (!sel.length) return;
    sel.forEach(o => { o.x += dx; o.y += dy; }); draw(); geomFields(); commitSoon();
  }
  function flip(axis) { selObjs().forEach(o => { if (axis === "x") o.flipX = !o.flipX; else o.flipY = !o.flipY; }); commit(); draw(); }
  function alignSel(how) { const sel = selObjs().filter(o => !o.locked); if (!sel.length) return; C.align(sel, how, ED.doc.w, ED.doc.h); commit(); draw(); geomFields(); }
  function distributeSel(ax) { C.distribute(selObjs().filter(o => !o.locked), ax); commit(); draw(); }

  // ================= images =================
  const RASTER = /^image\/(png|jpeg|webp|gif)$/;
  function loadImg(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("Could not read this image")); im.src = src; }); }
  // Images are kept as data: URLs inside the design. Very large photos are scaled to 3000 px; SVG is rasterised.
  async function prepImage(file) {
    if (file.size > 60e6) throw new Error(file.name + " is larger than 60 MB");
    let url = await S3.readFile(file, "dataurl");
    const svg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
    if (!svg && !RASTER.test(file.type)) throw new Error(file.name + ": use PNG, JPG, WebP, GIF or SVG");
    if (svg) url = "data:image/svg+xml;base64," + url.split(",")[1];
    const im = await loadImg(url);
    let w = im.naturalWidth || 800, hh = im.naturalHeight || 600;
    const max = 3000, k = Math.min(1, max / Math.max(w, hh)) * (svg ? Math.min(4, Math.max(1, 1600 / Math.max(w, hh))) : 1);
    if (svg || k < 1) {
      const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(hh * k);
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      url = file.type === "image/jpeg" ? c.toDataURL("image/jpeg", 0.92) : c.toDataURL("image/png");
      w = c.width; hh = c.height;
    }
    if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(url)) throw new Error("Unsupported image");
    return { url: url, w: w, h: hh };
  }
  async function addImageFiles(files, targetId, at) {
    let added = 0, last = null;
    for (const f of files) {
      try {
        const im = await prepImage(f), id = C.uid("a");
        ED.doc.assets[id] = im.url;
        const t = targetId ? C.find(page(), targetId) : null;
        if (t && added === 0) { t.src = id; last = t; }
        else {
          const k = Math.min(ED.doc.w * 0.6 / im.w, ED.doc.h * 0.6 / im.h, 1e9);
          const o = C.make("image", { src: id, w: im.w * k, h: im.h * k });
          const cx = at ? at.x : ED.doc.w / 2, cy = at ? at.y : ED.doc.h / 2;
          o.x = cx - o.w / 2 + added * 20; o.y = cy - o.h / 2 + added * 20;
          page().objects.push(o); last = o;
        }
        added++;
      } catch (err) { S3.toast(err.message || String(err), "error"); }
    }
    if (last) { select([last.id]); commit(); renderAssets(); draw(); }
  }
  let imgTarget = null;
  const imgInput = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml", hidden: true });
  document.body.appendChild(imgInput);
  imgInput.addEventListener("change", () => { const f = [...imgInput.files]; imgInput.value = ""; if (f.length) addImageFiles(f.slice(0, 1), imgTarget); });
  function pickImageFor(id) { imgTarget = id; imgInput.click(); }
  function renderAssets() {
    const grid = $("#assetGrid"); if (!grid || !ED.doc) return;
    grid.innerHTML = "";
    const ids = Object.keys(ED.doc.assets);
    if (!ids.length) { grid.appendChild(h("p", { "class": "faint ds-p", text: "No images in this design yet." })); return; }
    ids.forEach(id => {
      const b = h("button", { "class": "ds-asset", type: "button", title: "Add to page" }, [h("img", { src: ED.doc.assets[id], alt: "Uploaded image" })]);
      b.addEventListener("click", () => {
        loadImg(ED.doc.assets[id]).then(im => {
          const k = Math.min(ED.doc.w * 0.5 / im.naturalWidth, ED.doc.h * 0.5 / im.naturalHeight);
          const t = selObjs()[0];
          if (t && t.type === "image" && ED.sel.length === 1 && !t.src) { t.src = id; commit(); draw(); return; }
          addObject(C.make("image", { src: id, w: im.naturalWidth * k, h: im.naturalHeight * k }));
        });
      });
      grid.appendChild(b);
    });
  }

  // ================= properties panel =================
  const PAL = ["#111111", "#ffffff", "#6b7280", "#ef4444", "#f97316", "#f5b971", "#ffd23f", "#22c55e", "#0e9f9a", "#3dd6d0", "#3b82f6", "#1d4ed8", "#8b5cf6", "#e0457b"];
  function hex6(c) {
    if (typeof c !== "string") return "#000000";
    c = c.trim();
    let m = /^#([0-9a-f])([0-9a-f])([0-9a-f])/i.exec(c);
    if (/^#[0-9a-f]{6}/i.test(c)) return c.slice(0, 7).toLowerCase();
    if (m) return ("#" + m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toLowerCase();
    m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/i.exec(c);
    if (m) return "#" + [m[1], m[2], m[3]].map(v => (+v).toString(16).padStart(2, "0")).join("");
    return "#000000";
  }
  function docColors() {
    const set = [];
    function add(c) { if (typeof c === "string" && C.isColor(c)) { const x = hex6(c); if (set.indexOf(x) < 0) set.push(x); } else if (c && c.c) c.c.forEach(add); }
    ED.doc.pages.forEach(p => { add(p.bg); (function walk(l) { l.forEach(o => { add(o.fill); add(o.color); if (o.strokeW || o.type === "line") add(o.stroke); if (o.children) walk(o.children); }); })(p.objects); });
    return set.slice(0, 12);
  }
  // live(): apply a change to every selected object (or the page), redraw, commit shortly after.
  function live(fn, now) { selObjs().forEach(o => { fn(o); R.fitText(o); }); draw(); geomFields(); if (now) commit(); else commitSoon(); }
  function fieldWrap(label, el, cls) { return h("label", { "class": "field ds-f" + (cls ? " " + cls : "") }, [h("span", { text: label }), el]); }
  function numIn(label, val, onSet, o) {
    o = o || {};
    const el = h("input", { "class": "input", type: "number", step: o.step || 1, value: r1(val), "data-geo": o.geo || null, inputmode: "decimal" });
    if (o.min != null) el.min = o.min; if (o.max != null) el.max = o.max;
    el.addEventListener("input", () => { const v = parseFloat(el.value); if (isFinite(v)) onSet(o.min != null ? Math.max(o.min, v) : v); });
    el.addEventListener("change", commit);
    return fieldWrap(label, el, "ds-num");
  }
  function rangeIn(label, val, min, max, step, onSet, fmt) {
    const out = h("output", { text: fmt ? fmt(val) : String(r1(val)) });
    const el = h("input", { type: "range", min: min, max: max, step: step, value: val, "aria-label": label });
    el.addEventListener("input", () => { const v = parseFloat(el.value); out.textContent = fmt ? fmt(v) : String(r1(v)); onSet(v); });
    el.addEventListener("change", commit);
    return h("label", { "class": "field ds-f ds-range" }, [h("span", { "class": "row between" }, [h("span", { text: label }), out]), el]);
  }
  function colorIn(label, val, onSet, opts) {
    opts = opts || {};
    const pick = h("input", { type: "color", value: hex6(val), "aria-label": label });
    const txt = h("input", { "class": "input mono", value: typeof val === "string" ? val : "", maxlength: 32, "aria-label": label + " (hex)", spellcheck: "false" });
    pick.addEventListener("input", () => { txt.value = pick.value; onSet(pick.value); });
    pick.addEventListener("change", commit);
    txt.addEventListener("change", () => { const v = txt.value.trim(); if (C.isColor(v)) { pick.value = hex6(v); onSet(v); commit(); } else if (opts.none && !v) { onSet(""); commit(); } else S3.toast("Use a colour like #ff8800", "error"); });
    const sw = h("div", { "class": "ds-sw" });
    const cols = docColors().concat(PAL.filter(c => docColors().indexOf(c) < 0)).slice(0, 18);
    cols.forEach(c => {
      const b = h("button", { type: "button", title: c, "aria-label": "Use " + c, style: "background:" + c });
      b.addEventListener("click", () => { pick.value = c; txt.value = c; onSet(c); commit(); });
      sw.appendChild(b);
    });
    if (opts.none) { const b = h("button", { type: "button", "class": "ds-none", title: "None", "aria-label": "No colour" }); b.addEventListener("click", () => { txt.value = ""; onSet(""); commit(); }); sw.insertBefore(b, sw.firstChild); }
    return h("div", { "class": "ds-f" }, [h("span", { "class": "ds-flabel", text: label }), h("div", { "class": "ds-color" }, [pick, txt]), sw]);
  }
  function fillIn(label, val, onSet, allowNone) {
    const wrap = h("div", { "class": "stack ds-fill" });
    const mode = !val ? "none" : typeof val === "object" ? "grad" : "solid";
    const opts = [["solid", "Solid"], ["grad", "Gradient"]].concat(allowNone ? [["none", "None"]] : []);
    const s = segIn(label, opts, mode, v => {
      const cur = typeof val === "object" && val ? val : null, c0 = cur ? cur.c[0] : (val || "#3dd6d0");
      val = v === "none" ? "" : v === "grad" ? { t: "lin", a: 135, c: [hex6(c0), cur ? cur.c[1] : "#1d4ed8"] } : (cur ? cur.c[0] : c0 || "#3dd6d0");
      onSet(C.clone(val)); commit(); body();
    });
    const inner = h("div", { "class": "stack" });
    function body() {
      inner.innerHTML = "";
      if (val && typeof val === "object") {
        inner.appendChild(colorIn("From", val.c[0], c => { val.c[0] = c; onSet(C.clone(val)); }));
        inner.appendChild(colorIn("To", val.c[1], c => { val.c[1] = c; onSet(C.clone(val)); }));
        inner.appendChild(rangeIn("Angle", val.a, 0, 360, 5, a => { val.a = a; onSet(C.clone(val)); }, v => Math.round(v) + "°"));
      } else if (val) inner.appendChild(colorIn("Colour", val, c => { val = c; onSet(c); }));
    }
    body(); wrap.appendChild(s); wrap.appendChild(inner);
    return wrap;
  }
  function segIn(label, opts, val, onSet) {
    const g = h("div", { "class": "seg ds-seg", role: "group", "aria-label": label });
    opts.forEach(o => {
      const b = h("button", { type: "button", "aria-pressed": String(o[0] === val), title: o[2] || o[1] }, [o[3] ? icon(o[3]) : o[1]]);
      if (o[3]) b.setAttribute("aria-label", o[1]);
      b.addEventListener("click", () => { $$("button", g).forEach(x => x.setAttribute("aria-pressed", String(x === b))); onSet(o[0]); });
      g.appendChild(b);
    });
    return h("div", { "class": "ds-f" }, [label ? h("span", { "class": "ds-flabel", text: label }) : null, g]);
  }
  function selectIn(label, opts, val, onSet) {
    const el = h("select", { "class": "select" });
    opts.forEach(o => { if (o.group) { const og = h("optgroup", { label: o.group }); o.items.forEach(it => og.appendChild(h("option", { value: it[0], text: it[1], style: it[2] || null }))); el.appendChild(og); } else el.appendChild(h("option", { value: o[0], text: o[1] })); });
    el.value = val;
    el.addEventListener("change", () => { onSet(el.value); commit(); });
    return fieldWrap(label, el);
  }
  function toggleBtn(label, iconId, on, onSet, txt) {
    const b = h("button", { type: "button", "class": "btn small ds-tg", "aria-pressed": String(!!on), title: label, "aria-label": label }, [iconId ? icon(iconId) : h("b", { text: txt })]);
    b.addEventListener("click", () => { const v = b.getAttribute("aria-pressed") !== "true"; b.setAttribute("aria-pressed", String(v)); onSet(v); commit(); });
    return b;
  }
  function act(label, iconId, fn, disabled) {
    const b = h("button", { type: "button", "class": "btn ghost icon small", title: label, "aria-label": label, disabled: !!disabled }, [icon(iconId)]);
    b.addEventListener("click", fn); return b;
  }
  function section(title, kids, open) {
    return h("section", { "class": "ds-sec" }, [title ? h("h3", { text: title }) : null].concat(kids));
  }
  function geomFields() {
    const o = selObjs()[0]; if (!o || ED.sel.length !== 1) return;
    $$("[data-geo]").forEach(el => { if (document.activeElement === el) return; const k = el.getAttribute("data-geo"); el.value = r1(o[k] || 0); });
  }
  function weightName(w) { return { 100: "Thin", 200: "Extra light", 300: "Light", 400: "Regular", 500: "Medium", 600: "Semibold", 700: "Bold", 800: "Extra bold", 900: "Black" }[w] || w; }

  function buildProps() {
    const P = $("#props"); if (!P || !ED.doc) return;
    P.innerHTML = "";
    const sel = selObjs();
    if (!sel.length) { pageProps(P); return; }
    const o = sel[0], one = sel.length === 1, same = sel.every(x => x.type === o.type);
    const title = one ? ({ text: "Text", shape: "Shape", line: "Line", icon: "Icon", image: "Image", group: "Group" }[o.type]) : sel.length + " selected";
    const locked = sel.every(x => x.locked);
    P.appendChild(h("div", { "class": "row between ds-phead" }, [h("h2", { text: title }), h("div", { "class": "row ds-acts" }, [
      act("Duplicate (Ctrl+D)", "i-copy", duplicateSel),
      act(locked ? "Unlock" : "Lock (Ctrl+Shift+L)", locked ? "i-lock" : "d-unlock", toggleLock),
      act("Delete (Del)", "i-trash", deleteSel, locked)
    ])]));
    if (locked) { P.appendChild(h("p", { "class": "faint ds-p", text: "Locked. Unlock it to move or edit." })); return; }
    // arrange
    const arr = [act("Bring forward (Ctrl+])", "d-up", () => order("up")), act("Send backward (Ctrl+[)", "d-down", () => order("down")),
      act("Bring to front (Ctrl+Shift+])", "d-front", () => order("top")), act("Send to back (Ctrl+Shift+[)", "d-back", () => order("bottom")),
      act("Flip horizontal", "d-fliph", () => flip("x")), act("Flip vertical", "d-flipv", () => flip("y"))];
    if (sel.length > 1) arr.push(act("Group (Ctrl+G)", "d-group", groupSel));
    if (sel.some(x => x.type === "group")) arr.push(act("Ungroup (Ctrl+Shift+G)", "d-ungroup", ungroupSel));
    P.appendChild(section("Arrange", [h("div", { "class": "ds-btnrow" }, arr)]));
    const al = [["left", "d-al-l", "Align left"], ["hcenter", "d-al-c", "Align centre"], ["right", "d-al-r", "Align right"], ["top", "d-al-t", "Align top"], ["vcenter", "d-al-m", "Align middle"], ["bottom", "d-al-b", "Align bottom"]]
      .map(a => act(a[2] + (one ? " (to page)" : ""), a[1], () => alignSel(a[0])));
    if (sel.length >= 3) { al.push(act("Distribute horizontally", "d-dist-h", () => distributeSel("h"))); al.push(act("Distribute vertically", "d-dist-v", () => distributeSel("v"))); }
    P.appendChild(section(one ? "Align to page" : "Align", [h("div", { "class": "ds-btnrow" }, al)]));

    if (same && o.type === "text") textProps(P, o);
    if (same && o.type === "shape") shapeProps(P, o);
    if (same && o.type === "line") lineProps(P, o);
    if (same && o.type === "icon") iconProps(P, o);
    if (same && o.type === "image") imageProps(P, o, one);

    if (one) {
      P.appendChild(section("Position and size", [h("div", { "class": "ds-geo" }, [
        numIn("X", o.x, v => live(x => { x.x = v; }), { geo: "x" }), numIn("Y", o.y, v => live(x => { x.y = v; }), { geo: "y" }),
        numIn("W", o.w, v => live(x => {
          if (x.type === "group") C.scaleGroupChildren(x, v / x.w, 1);
          x.w = Math.max(1, v);
        }), { geo: "w", min: 1 }),
        o.type === "text" || o.type === "line" ? numIn(o.type === "line" ? "Thick" : "H", o.h, v => live(x => { if (x.type === "line") x.h = Math.max(0.5, v); }), { geo: "h", min: 0.5, step: o.type === "line" ? 0.5 : 1 })
          : numIn("H", o.h, v => live(x => { if (x.type === "group") C.scaleGroupChildren(x, 1, v / x.h); x.h = Math.max(1, v); }), { geo: "h", min: 1 }),
        numIn("Rotate°", o.rot || 0, v => live(x => { x.rot = v % 360; }), { geo: "rot" })
      ])]));
    }
    P.appendChild(section("Effects", [
      rangeIn("Transparency", Math.round((1 - (o.op == null ? 1 : o.op)) * 100), 0, 100, 1, v => live(x => { x.op = 1 - v / 100; }), v => Math.round(v) + "%"),
      shadowProps(o)
    ]));
  }
  function shadowProps(o) {
    const wrap = h("div", { "class": "stack" }), inner = h("div", { "class": "stack" });
    const chk = h("input", { type: "checkbox" }); chk.checked = !!o.shadow;
    chk.addEventListener("change", () => {
      const b = base();
      live(x => { x.shadow = chk.checked ? { x: 0, y: Math.round(b * 0.012), blur: Math.round(b * 0.03), color: "rgba(0,0,0,0.35)" } : null; }, true);
      body();
    });
    function body() {
      inner.innerHTML = ""; const s = selObjs()[0].shadow; if (!s) return;
      const sh = (k, v) => live(x => { if (x.shadow) x.shadow[k] = v; });
      inner.appendChild(h("div", { "class": "ds-geo" }, [numIn("X", s.x, v => sh("x", v)), numIn("Y", s.y, v => sh("y", v)), numIn("Blur", s.blur, v => sh("blur", Math.max(0, v)), { min: 0 })]));
      inner.appendChild(colorIn("Shadow colour", s.color, c => sh("color", c)));
    }
    wrap.appendChild(h("label", { "class": "check" }, [chk, " Shadow"])); wrap.appendChild(inner); body();
    return wrap;
  }
  function fontOptions(cur) {
    const user = ED.userFonts.slice(), dev = ED.fonts.filter(f => user.indexOf(f) < 0), groups = [];
    if (user.length) groups.push({ group: "Your fonts", items: user.map(f => [f, f, "font-family:" + R.fontStack(f)]) });
    if (cur && user.indexOf(cur) < 0 && dev.indexOf(cur) < 0) dev.unshift(cur);
    groups.push({ group: "On this device", items: dev.map(f => [f, f, "font-family:" + R.fontStack(f)]) });
    return groups;
  }
  function textProps(P, o) {
    const area = h("textarea", { "class": "textarea prose", id: "pText", dir: "auto", rows: 3, "aria-label": "Text", spellcheck: "true" });
    area.value = o.text;
    area.addEventListener("input", () => live(x => { x.text = area.value; }));
    area.addEventListener("change", commit);
    const tg = h("div", { "class": "ds-btnrow" }, [
      toggleBtn("Bold", null, o.weight >= 600, v => live(x => { x.weight = v ? 700 : 400; }), "B"),
      toggleBtn("Italic", null, o.italic, v => live(x => { x.italic = v; }), "I"),
      toggleBtn("Underline", null, o.underline, v => live(x => { x.underline = v; }), "U"),
      toggleBtn("Uppercase", null, o.upper, v => live(x => { x.upper = v; }), "Aa")
    ]);
    tg.children[1].classList.add("ds-it"); tg.children[2].classList.add("ds-ul");
    P.appendChild(section("Text", [area,
      selectIn("Font", fontOptions(o.font), o.font, v => live(x => { x.font = v; ensureDocFont(v); })),
      h("div", { "class": "ds-geo" }, [
        numIn("Size", o.size, v => live(x => { x.size = Math.max(1, v); }), { min: 1, step: 1 }),
        selectIn("Weight", [100, 200, 300, 400, 500, 600, 700, 800, 900].map(w => [String(w), weightName(w)]), String(o.weight), v => live(x => { x.weight = +v; }))
      ]),
      tg,
      segIn("Align", [["left", "Left", "Align left", "d-al-l"], ["center", "Centre", "Align centre", "d-al-c"], ["right", "Right", "Align right", "d-al-r"]], o.align, v => live(x => { x.align = v; }, true)),
      segIn("Direction", [["auto", "Auto"], ["ltr", "LTR"], ["rtl", "RTL"]], o.dir || "auto", v => live(x => { x.dir = v; }, true)),
      fillIn("Colour", o.color, v => live(x => { x.color = v || "#111111"; })),
      rangeIn("Line spacing", o.lh, 0.6, 3, 0.05, v => live(x => { x.lh = v; }), v => v.toFixed(2)),
      rangeIn("Letter spacing", o.ls || 0, -Math.round(o.size * 0.1), Math.round(o.size * 0.5), 0.5, v => live(x => { x.ls = v; }))
    ]));
    P.appendChild(section("Outline and highlight", [
      rangeIn("Outline", o.strokeW || 0, 0, Math.max(10, Math.round(o.size * 0.15)), 0.5, v => live(x => { x.strokeW = v; })),
      colorIn("Outline colour", o.stroke || "#000000", c => live(x => { x.stroke = c; })),
      colorIn("Highlight", o.bgc || "", c => live(x => { x.bgc = c; }), { none: true })
    ]));
  }
  function shapeProps(P, o) {
    P.appendChild(section("Shape", [
      selectIn("Type", C.SHAPES.map(s => [s, s.charAt(0).toUpperCase() + s.slice(1)]), o.shape, v => live(x => { x.shape = v; })),
      fillIn("Fill", o.fill, v => live(x => { x.fill = v; }), true),
      rangeIn("Border", o.strokeW || 0, 0, Math.max(20, Math.round(base() * 0.03)), 0.5, v => live(x => { x.strokeW = v; })),
      colorIn("Border colour", o.stroke, c => live(x => { x.stroke = c; })),
      o.shape === "rect" ? rangeIn("Corner radius", o.radius || 0, 0, Math.round(Math.min(o.w, o.h) / 2), 1, v => live(x => { x.radius = v; })) : null
    ].filter(Boolean)));
  }
  function lineProps(P, o) {
    const caps = [["none", "None"], ["arrow", "Arrow"], ["dot", "Dot"]];
    P.appendChild(section("Line", [
      colorIn("Colour", o.stroke, c => live(x => { x.stroke = c; })),
      rangeIn("Thickness", o.h, 0.5, Math.max(20, Math.round(base() * 0.03)), 0.5, v => live(x => { const c = x.y + x.h / 2; x.h = v; x.y = c - v / 2; })),
      segIn("Style", [["solid", "Solid"], ["dash", "Dashed"], ["dot", "Dotted"]], o.dash, v => live(x => { x.dash = v; }, true)),
      h("div", { "class": "ds-geo" }, [selectIn("Start", caps, o.start, v => live(x => { x.start = v; })), selectIn("End", caps, o.end, v => live(x => { x.end = v; }))])
    ]));
  }
  function iconProps(P, o) {
    P.appendChild(section("Icon", [
      selectIn("Icon", Object.keys(DS.ICONS).map(k => [k, k.replace(/-/g, " ")]), o.icon, v => live(x => { x.icon = v; })),
      colorIn("Colour", o.color, c => live(x => { x.color = c; })),
      segIn("Style", [["stroke", "Outline"], ["fill", "Filled"]], o.style, v => live(x => { x.style = v; }, true)),
      rangeIn("Line width", o.sw || 2, 0.5, 4, 0.25, v => live(x => { x.sw = v; }))
    ]));
  }
  function imageProps(P, o, one) {
    const fx = o.fx || {};
    const setfx = (k, v) => live(x => { x.fx = x.fx || {}; x.fx[k] = v; });
    const rep = h("button", { type: "button", "class": "btn small" }, [icon("i-image"), o.src ? "Replace image" : "Choose image"]);
    rep.addEventListener("click", () => pickImageFor(o.id));
    const reset = h("button", { type: "button", "class": "btn ghost small", text: "Reset adjustments" });
    reset.addEventListener("click", () => { live(x => { x.fx = { b: 100, c: 100, s: 100, g: 0, blur: 0 }; }, true); buildProps(); });
    P.appendChild(section("Image", [one ? rep : null,
      segIn("Fit", [["cover", "Fill frame"], ["contain", "Fit"], ["stretch", "Stretch"]], o.fit, v => live(x => { x.fit = v; }, true)),
      rangeIn("Corner radius", o.radius || 0, 0, Math.round(Math.min(o.w, o.h) / 2), 1, v => live(x => { x.radius = v; })),
      rangeIn("Brightness", fx.b == null ? 100 : fx.b, 0, 200, 1, v => setfx("b", v), v => Math.round(v) + "%"),
      rangeIn("Contrast", fx.c == null ? 100 : fx.c, 0, 200, 1, v => setfx("c", v), v => Math.round(v) + "%"),
      rangeIn("Saturation", fx.s == null ? 100 : fx.s, 0, 200, 1, v => setfx("s", v), v => Math.round(v) + "%"),
      rangeIn("Black and white", fx.g || 0, 0, 100, 1, v => setfx("g", v), v => Math.round(v) + "%"),
      rangeIn("Blur", fx.blur || 0, 0, 30, 0.5, v => setfx("blur", v)),
      reset
    ].filter(Boolean)));
  }
  function pageProps(P) {
    const d = ED.doc, pg = page();
    P.appendChild(h("div", { "class": "row between ds-phead" }, [h("h2", { text: "Page " + (ED.pi + 1) + " of " + d.pages.length })]));
    const rs = h("button", { type: "button", "class": "btn small" }, [icon("d-resize"), "Resize design"]);
    rs.addEventListener("click", () => sizeDialog("resize"));
    P.appendChild(section("Size", [h("p", { "class": "ds-p", text: sizeText(d) }), rs]));
    P.appendChild(section("Background", [fillIn("Background", pg.bg, v => { page().bg = v || "#ffffff"; draw(); commitSoon(); })]));
    const all = h("button", { type: "button", "class": "btn small ghost", text: "Apply background to all pages" });
    all.addEventListener("click", () => { const bg = C.clone(page().bg); d.pages.forEach(p => { p.bg = C.clone(bg); }); commit(); draw(); S3.toast("Background applied to every page"); });
    if (d.pages.length > 1) P.appendChild(all);
    const snap = h("input", { type: "checkbox" }); snap.checked = ED.snap;
    snap.addEventListener("change", () => { ED.snap = snap.checked; S3.store("ds.snap", ED.snap); });
    P.appendChild(section("Editor", [h("label", { "class": "check" }, [snap, " Snap to page and objects (hold Alt to skip)"]),
      h("p", { "class": "faint ds-p", text: "Click an object to edit it. Double-click text to type. Drag on empty space to select several. Ctrl + scroll to zoom, scroll to pan, hold Space to drag the view." })]));
  }
  function sizeText(d) {
    return Math.round(d.w) + " × " + Math.round(d.h) + " px" + (d.print ? "  ·  " + r1(d.print.wmm) + " × " + r1(d.print.hmm) + " mm" : "");
  }

  // ================= layers =================
  let layersT = 0;
  function layersSoon() { clearTimeout(layersT); layersT = setTimeout(renderLayers, 60); }
  function objLabel(o) {
    if (o.name) return o.name;
    if (o.type === "text") return (R.displayText(o).replace(/\s+/g, " ").trim() || "Text").slice(0, 40);
    if (o.type === "shape") return o.shape.charAt(0).toUpperCase() + o.shape.slice(1);
    if (o.type === "icon") return "Icon: " + o.icon;
    if (o.type === "image") return o.src ? "Image" : "Image frame (empty)";
    if (o.type === "group") return "Group of " + o.children.length;
    return "Line";
  }
  const GLYPH = { text: "d-text", shape: "d-shapes", line: "d-dist-v", icon: "i-heart", image: "i-image", group: "d-group" };
  function renderLayers() {
    const list = $("#layerList"); if (!list || ED.tab !== "layers" || !ED.doc) return;
    list.innerHTML = "";
    const objs = page().objects.slice().reverse();
    if (!objs.length) { list.appendChild(h("p", { "class": "faint ds-p", text: "This page is empty." })); return; }
    objs.forEach(o => {
      const row = h("div", { "class": "ds-layer" + (ED.sel.indexOf(o.id) >= 0 ? " on" : "") + (o.hidden ? " off" : ""), draggable: "true", "data-id": o.id, role: "button", tabindex: "0" });
      const eye = act(o.hidden ? "Show" : "Hide", o.hidden ? "d-eyeoff" : "d-eye", e => { e.stopPropagation(); o.hidden = !o.hidden; if (o.hidden) ED.sel = ED.sel.filter(x => x !== o.id); commit(); selectionChanged(); });
      const lk = act(o.locked ? "Unlock" : "Lock", o.locked ? "i-lock" : "d-unlock", e => { e.stopPropagation(); o.locked = !o.locked; commit(); selectionChanged(); });
      lk.classList.toggle("ds-dim", !o.locked);
      row.appendChild(icon(GLYPH[o.type])); row.appendChild(h("span", { "class": "grow ds-lname", text: objLabel(o), dir: "auto" }));
      row.appendChild(lk); row.appendChild(eye);
      row.addEventListener("click", e => {
        if (o.hidden) return;
        if (e.shiftKey || e.ctrlKey || e.metaKey) select(ED.sel.indexOf(o.id) >= 0 ? ED.sel.filter(x => x !== o.id) : ED.sel.concat(o.id));
        else select([o.id]);
      });
      row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); row.click(); } });
      row.addEventListener("dragstart", e => { e.dataTransfer.setData("text/x-ds-layer", o.id); e.dataTransfer.effectAllowed = "move"; row.classList.add("drag"); });
      row.addEventListener("dragend", () => row.classList.remove("drag"));
      row.addEventListener("dragover", e => { e.preventDefault(); row.classList.add("over"); });
      row.addEventListener("dragleave", () => row.classList.remove("over"));
      row.addEventListener("drop", e => {
        e.preventDefault(); row.classList.remove("over");
        const id = e.dataTransfer.getData("text/x-ds-layer"); if (!id || id === o.id) return;
        const arr = page().objects, from = C.indexOf(page(), id), moving = arr.splice(from, 1)[0], to = C.indexOf(page(), o.id);
        arr.splice(from > to ? to + 1 : to, 0, moving);
        commit(); renderLayers(); draw();
      });
      list.appendChild(row);
    });
  }

  // ================= pages =================
  let thumbsT = 0;
  function thumbsSoon() { clearTimeout(thumbsT); thumbsT = setTimeout(renderPages, 250); }
  function renderPages() {
    const strip = $("#pageStrip"); if (!strip || !ED.doc) return;
    strip.innerHTML = "";
    const d = ED.doc, th = 46, k = th / d.h, tw = Math.max(20, Math.min(110, d.w * k));
    d.pages.forEach((p, i) => {
      const c = R.pageCanvas(d, p, Math.min(k, tw / d.w) * (window.devicePixelRatio || 1), {});
      c.style.width = Math.round(Math.min(tw, d.w * k)) + "px"; c.style.height = Math.round(Math.min(th, d.h * tw / d.w)) + "px";
      const b = h("button", { type: "button", "class": "ds-pg" + (i === ED.pi ? " on" : ""), title: "Page " + (i + 1), "aria-label": "Page " + (i + 1), "aria-current": i === ED.pi ? "page" : null }, [c, h("span", { text: String(i + 1) })]);
      b.addEventListener("click", () => goPage(i));
      strip.appendChild(b);
    });
    const add = h("button", { type: "button", "class": "ds-pg ds-add", title: "Add page", "aria-label": "Add page" }, [icon("i-plus")]);
    add.addEventListener("click", addPage);
    strip.appendChild(add);
    $("#pgDel").disabled = d.pages.length < 2; $("#pgLeft").disabled = ED.pi === 0; $("#pgRight").disabled = ED.pi >= d.pages.length - 1;
  }
  function goPage(i) {
    finishText();
    ED.pi = clamp(i, 0, ED.doc.pages.length - 1); ED.sel = []; renderPages(); selectionChanged();
  }
  function addPage() { const p = C.newPage(); p.bg = C.clone(page().bg); ED.doc.pages.splice(ED.pi + 1, 0, p); commit(); goPage(ED.pi + 1); }
  function dupPage() {
    const p = C.clone(page()); p.id = C.uid("p"); p.objects = p.objects.map(cloneWithIds);
    ED.doc.pages.splice(ED.pi + 1, 0, p); commit(); goPage(ED.pi + 1);
  }
  function delPage() {
    if (ED.doc.pages.length < 2) return;
    if (page().objects.length && !confirm("Delete page " + (ED.pi + 1) + "? You can undo this.")) return;
    ED.doc.pages.splice(ED.pi, 1); commit(); goPage(Math.min(ED.pi, ED.doc.pages.length - 1));
  }
  function movePage(dir) {
    const j = ED.pi + dir, ps = ED.doc.pages; if (j < 0 || j >= ps.length) return;
    const t = ps[ED.pi]; ps[ED.pi] = ps[j]; ps[j] = t; ED.pi = j; commit(); renderPages();
  }

  // ================= left panels =================
  function setTab(t) {
    ED.tab = t;
    $$(".ds-rail button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tab === t)));
    $$("#leftPanel [data-panel]").forEach(s => { s.hidden = s.dataset.panel !== t; });
    if (t === "layers") renderLayers();
    if (t === "designs") renderDesigns();
    if (t === "uploads") renderAssets();
    if (t === "templates") renderTemplates();
    S3.store("ds.tab", t);
  }
  let tplDone = false;
  function renderTemplates() {
    if (tplDone) return; tplDone = true;
    const grid = $("#tplGrid");
    DS.TEMPLATES.forEach(tpl => {
      const size = DS.SIZES.filter(z => z.id === tpl.size)[0];
      const b = h("button", { type: "button", "class": "ds-tpl", title: tpl.name + " · " + size.name }, [h("span", { "class": "ds-tthumb" }), h("b", { text: tpl.name, dir: "auto" }), h("span", { "class": "faint", text: size.name })]);
      b.addEventListener("click", () => {
        openDoc(DS.fromTemplate(tpl), { save: true });
        S3.toast("Opened “" + tpl.name + "”. Your previous design is in Designs.");
      });
      grid.appendChild(b);
      setTimeout(() => {   // thumbnails drawn lazily so the page loads fast
        const d = DS.fromTemplate(tpl), k = Math.min(240 / d.w, 240 / d.h), c = R.pageCanvas(d, d.pages[0], k, { editor: true });
        b.firstChild.appendChild(c);
      }, 30);
    });
  }
  function buildStaticPanels() {
    const ta1 = $("#textAdds");
    [["h1", "Add a heading", "ds-th1"], ["h2", "Add a subheading", "ds-th2"], ["body", "Add a little bit of body text", "ds-th3"], ["ar", "أضف عنوانًا عربيًا", "ds-th2"]].forEach(t => {
      const b = h("button", { type: "button", "class": "btn ds-tadd " + t[2], dir: "auto" }, [t[1]]); b.addEventListener("click", () => addText(t[0])); ta1.appendChild(b);
    });
    const cb = $("#textCombos");
    [["BIG SALE", "ds-c1"], ["“Make it simple, but significant.”", "ds-c2"], ["NEW ARRIVALS", "ds-c3"]].forEach((t, i) => {
      const b = h("button", { type: "button", "class": "btn ds-tadd " + t[1] }, [t[0]]); b.addEventListener("click", () => addCombo(i)); cb.appendChild(b);
    });
    function thumb(draw, label) {
      const c = document.createElement("canvas"), k = 2; c.width = 64 * k; c.height = 64 * k;
      const x = c.getContext("2d"); x.scale(k, k); draw(x);
      const b = h("button", { type: "button", "class": "ds-el", title: label, "aria-label": label }, [c]); return b;
    }
    const sg = $("#shapeGrid");
    C.SHAPES.forEach(s => {
      const b = thumb(x => { x.translate(32, 32); const o = C.make("shape", { shape: s, w: s === "arrow" ? 50 : 42, h: s === "arrow" ? 26 : 42, fill: "#3dd6d0" }); x.fillStyle = "#3dd6d0"; x.fill(R.shapePath(o)); }, "Add " + s);
      b.addEventListener("click", () => addShape(s)); sg.appendChild(b);
    });
    const lg = $("#lineGrid");
    [["solid", "Line"], ["dash", "Dashed line"], ["dot", "Dotted line"], ["arrow", "Arrow"]].forEach(l => {
      const b = thumb(x => { x.translate(32, 32); const o = C.make("line", { w: 46, h: 3, stroke: "#9aa3ad", dash: l[0] === "arrow" ? "solid" : l[0], end: l[0] === "arrow" ? "arrow" : "none" }); R.drawObject(x, Object.assign(o, { x: -23, y: -1.5 }), { doc: ED.doc }); }, l[1]);
      b.addEventListener("click", () => addLine(l[0])); lg.appendChild(b);
    });
    const ig = $("#iconGrid");
    Object.keys(DS.ICONS).forEach(k => {
      const b = h("button", { type: "button", "class": "ds-el ds-ic", title: k.replace(/-/g, " "), "aria-label": "Add icon " + k.replace(/-/g, " "), "data-k": k },
        [svgEl({ viewBox: "0 0 24 24", "aria-hidden": "true" }, '<path d="' + S3.esc(DS.ICONS[k]) + '"/>')]);
      b.addEventListener("click", () => addIcon(k)); ig.appendChild(b);
    });
    $("#iconSearch").addEventListener("input", e => { const q = e.target.value.trim().toLowerCase(); $$(".ds-ic", ig).forEach(b => { b.hidden = q && b.dataset.k.indexOf(q) < 0; }); });
    S3.drop($("#imgDrop"), files => addImageFiles(files), { accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg", multiple: true });
  }

  // ================= designs list =================
  function renderDesigns() {
    const list = $("#designList");
    IO.store.list().then(items => {
      list.innerHTML = "";
      if (!items.length) { list.appendChild(h("p", { "class": "faint ds-p", text: "Nothing saved yet. Designs save themselves as you work." })); return; }
      items.forEach(it => {
        const open = h("button", { type: "button", "class": "ds-dthumb", title: "Open", "aria-label": "Open " + it.name }, [it.thumb ? h("img", { src: it.thumb, alt: "" }) : null]);
        const del = act("Delete from this browser", "i-trash", () => {
          if (!confirm("Delete “" + it.name + "” from this browser? This cannot be undone.")) return;
          IO.store.del(it.id).then(() => { if (it.id === ED.doc.id) saveState("Deleted from this browser (still open)", "warn"); renderDesigns(); });
        });
        const dup = act("Duplicate", "i-copy", () => IO.store.get(it.id).then(rec => { if (!rec) return; const d = IO.openProject(JSON.stringify(rec.doc)); d.id = C.uid("d"); d.name = rec.name + " (copy)"; openDoc(d, { save: true }); }));
        open.addEventListener("click", () => openStored(it.id));
        const when = new Date(it.updated);
        list.appendChild(h("div", { "class": "ds-design" + (it.id === ED.doc.id ? " on" : "") }, [open, h("div", { "class": "grow ds-dmeta" }, [
          h("b", { text: it.name, dir: "auto" }), h("span", { "class": "faint", text: Math.round(it.w) + " × " + Math.round(it.h) + (it.pages > 1 ? " · " + it.pages + " pages" : "") }),
          h("span", { "class": "faint", text: when.toLocaleDateString() + " " + when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) })
        ]), h("div", { "class": "ds-dacts" }, [dup, del])]));
      });
    }).catch(() => { list.innerHTML = ""; list.appendChild(h("p", { "class": "faint ds-p", text: "Browser storage is blocked (private mode?). Use Save file to keep your work." })); });
  }
  function openStored(id) {
    return IO.store.get(id).then(rec => {
      if (!rec) { S3.toast("That design is gone", "error"); return; }
      const d = IO.openProject(JSON.stringify(rec.doc)); d.id = rec.id;
      openDoc(d, { saved: true }); renderDesigns();
    });
  }

  // ================= dialogs =================
  function modal(title, body, foot) {
    const m = h("div", { "class": "s3-modal ds-modal", role: "dialog", "aria-modal": "true", "aria-label": title });
    const x = h("button", { type: "button", "class": "btn ghost icon", "aria-label": "Close" }, [icon("i-x")]);
    const sheet = h("div", { "class": "s3-sheet ds-sheet" }, [h("div", { "class": "row between" }, [h("h2", { text: title }), x]), body, foot ? h("div", { "class": "row ds-foot" }, foot) : null]);
    m.appendChild(sheet);
    function close() { m.remove(); document.removeEventListener("keydown", onKey, true); stage.focus({ preventScroll: true }); }
    function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
    m.addEventListener("click", e => { if (e.target === m) close(); });
    x.addEventListener("click", close);
    document.addEventListener("keydown", onKey, true);
    document.body.appendChild(m);
    const f = sheet.querySelector("button.primary") || x; f.focus({ preventScroll: true }); sheet.scrollTop = 0;
    return { el: m, close: close };
  }
  const modalOpen = () => !!document.querySelector(".s3-modal");
  function sizeDialog(mode) {
    const d = ED.doc, isResize = mode === "resize";
    let pick = null;
    const grid = h("div", { "class": "ds-sizes" });
    let lastGroup = "";
    DS.SIZES.forEach(s => {
      if (s.group !== lastGroup) { grid.appendChild(h("h3", { text: s.group })); lastGroup = s.group; }
      const ratio = s.w / s.h, bw = ratio >= 1 ? 30 : 30 * ratio, bh = ratio >= 1 ? 30 / ratio : 30;
      const b = h("button", { type: "button", "class": "ds-size", "aria-pressed": "false" }, [
        h("span", { "class": "ds-ratio" }, [h("i", { style: "width:" + bw + "px;height:" + bh + "px" })]),
        h("span", {}, [h("b", { text: s.name }), h("span", { "class": "faint", text: s.w + " × " + s.h + " px" })])]);
      b.addEventListener("click", () => { $$(".ds-size", grid).forEach(x => x.setAttribute("aria-pressed", String(x === b))); pick = s; wI.value = s.w; hI.value = s.h; unit.value = "px"; });
      b.addEventListener("dblclick", go);
      grid.appendChild(b);
    });
    const wI = h("input", { "class": "input", type: "number", min: 16, max: 20000, value: Math.round(d ? d.w : 1080) });
    const hI = h("input", { "class": "input", type: "number", min: 16, max: 20000, value: Math.round(d ? d.h : 1080) });
    const unit = h("select", { "class": "select" }, [h("option", { value: "px", text: "px" }), h("option", { value: "mm", text: "mm" }), h("option", { value: "in", text: "in" })]);
    let curUnit = "px";
    unit.addEventListener("change", () => {
      const f = { px: 1, mm: DS.MM, in: 96 }, a = f[curUnit], b2 = f[unit.value];
      wI.value = r1(wI.value * a / b2); hI.value = r1(hI.value * a / b2); curUnit = unit.value; pick = null;
      $$(".ds-size", grid).forEach(x => x.setAttribute("aria-pressed", "false"));
    });
    [wI, hI].forEach(el => el.addEventListener("input", () => { pick = null; $$(".ds-size", grid).forEach(x => x.setAttribute("aria-pressed", "false")); }));
    const scale = h("input", { type: "checkbox", checked: true });
    const custom = h("div", { "class": "ds-custom" }, [h("label", { "class": "field" }, ["Width", wI]), h("span", { "class": "ds-x", text: "×" }), h("label", { "class": "field" }, ["Height", hI]), h("label", { "class": "field" }, ["Unit", unit])]);
    const body = h("div", { "class": "stack" }, [
      isResize ? h("p", { "class": "ds-p", text: "Now " + sizeText(d) + ". Free, as many times as you like." }) : null,
      grid, h("h3", { text: "Custom size" }), custom,
      isResize ? h("label", { "class": "check" }, [scale, " Scale the content to fit the new size"]) : null
    ]);
    function size() {
      if (pick) return pick;
      const f = { px: 1, mm: DS.MM, in: 96 }[unit.value], w = Math.round(wI.value * f), hh = Math.round(hI.value * f);
      if (!(w >= 16 && hh >= 16 && w <= 20000 && hh <= 20000)) { S3.toast("Size must be between 16 and 20000 px", "error"); return null; }
      const mm = unit.value === "px" ? null : { wmm: unit.value === "mm" ? +wI.value : wI.value * 25.4, hmm: unit.value === "mm" ? +hI.value : hI.value * 25.4 };
      return { name: "Custom " + w + " × " + hh, w: w, h: hh, print: mm };
    }
    function go(copy) {
      const s = size(); if (!s) return;
      dlg.close();
      if (!isResize) { newBlank({ w: s.w, h: s.h, print: s.print, name: "Untitled " + (s.name || "").replace(/ \(.*\)$/, "").toLowerCase() }); return; }
      if (copy === true) {
        const nd = IO.openProject(IO.projectJson(ED.doc)); nd.id = C.uid("d"); nd.name = ED.doc.name + " (" + s.w + "×" + s.h + ")";
        C.resizeDoc(nd, s.w, s.h, scale.checked); nd.print = s.print ? C.clone(s.print) : null; R.fitAll(nd);
        openDoc(nd, { save: true }); S3.toast("Resized copy created. The original is in Designs.");
      } else {
        C.resizeDoc(ED.doc, s.w, s.h, scale.checked); ED.doc.print = s.print ? C.clone(s.print) : null; R.fitAll(ED.doc);
        commit(); fitIfSizeChanged(); renderPages(); buildProps(); S3.toast("Resized to " + s.w + " × " + s.h);
      }
      S3.done();
    }
    const create = h("button", { type: "button", "class": "btn primary", text: isResize ? "Resize" : "Create design" });
    create.addEventListener("click", () => go(false));
    const foot = [h("span", { "class": "grow" })];
    if (isResize) { const cp = h("button", { type: "button", "class": "btn", text: "Resize a copy" }); cp.addEventListener("click", () => go(true)); foot.push(cp); }
    foot.push(create);
    const dlg = modal(isResize ? "Resize design" : "New design", body, foot);
  }

  function exportDialog() {
    finishText();
    const d = ED.doc, multi = d.pages.length > 1, isPrint = !!d.print;
    const st = Object.assign({ fmt: "png", scale: isPrint ? 3.125 : 1, q: 0.92, transp: false, all: true, lossless: false, pdfScale: isPrint ? 3.125 : 2 }, S3.store("ds.export") || {});
    const info = h("p", { "class": "ds-p ds-info" });
    const body = h("div", { "class": "stack" });
    function scales() {
      return isPrint ? [[1, "96 DPI (screen)"], [1.5625, "150 DPI"], [2.0833, "200 DPI"], [3.125, "300 DPI (print)"], [4.1667, "400 DPI"]]
        : [[0.5, "0.5×"], [1, "1× (original)"], [1.5, "1.5×"], [2, "2×"], [3, "3×"], [4, "4×"]];
    }
    function render() {
      body.innerHTML = "";
      body.appendChild(segIn("File type", [["png", "PNG"], ["jpg", "JPG"], ["pdf", "PDF"]], st.fmt, v => { st.fmt = v; render(); }));
      if (multi) body.appendChild(segIn("Pages", [["all", "All " + d.pages.length + " pages"], ["one", "Only page " + (ED.pi + 1)]], st.all ? "all" : "one", v => { st.all = v === "all"; upd(); }));
      const key = st.fmt === "pdf" ? "pdfScale" : "scale";
      const sl = scales(); if (!sl.some(s => Math.abs(s[0] - st[key]) < 0.01)) st[key] = sl[isPrint ? 3 : 1][0];
      body.appendChild(selectIn(st.fmt === "pdf" ? "Quality" : isPrint ? "Resolution" : "Size", sl.map(s => [String(s[0]), s[1]]), String(sl.filter(s => Math.abs(s[0] - st[key]) < 0.01)[0][0]), v => { st[key] = +v; upd(); }));
      if (st.fmt === "jpg" || (st.fmt === "pdf" && !st.lossless)) body.appendChild(rangeIn("JPEG quality", Math.round(st.q * 100), 50, 100, 1, v => { st.q = v / 100; }, v => Math.round(v) + "%"));
      if (st.fmt === "png") { const c = h("input", { type: "checkbox", checked: st.transp }); c.addEventListener("change", () => { st.transp = c.checked; }); body.appendChild(h("label", { "class": "check" }, [c, " Transparent background"])); }
      if (st.fmt === "pdf") { const c = h("input", { type: "checkbox", checked: st.lossless }); c.addEventListener("change", () => { st.lossless = c.checked; render(); }); body.appendChild(h("label", { "class": "check" }, [c, " Lossless pages (sharper, bigger file)"])); }
      body.appendChild(info); upd();
    }
    function upd() {
      const n = multi && st.all ? d.pages.length : 1, sc = st.fmt === "pdf" ? st.pdfScale : st.scale, sz = IO.exportSize(d, sc);
      let t = sz.w + " × " + sz.h + " px";
      if (st.fmt === "pdf") { const pt = IO.pageSizePt(d); t = n + (n > 1 ? " pages" : " page") + ", " + r1(pt.w / 72 * 25.4) + " × " + r1(pt.h / 72 * 25.4) + " mm, pages rendered at " + t + ". Latin text stays selectable."; }
      else if (n > 1) t = n + " images of " + t + " in a .zip";
      info.textContent = t + ". No watermark.";
      if (sz.w * sz.h > 120e6) info.textContent += " Very large: may fail on some devices.";
    }
    render();
    const go = h("button", { type: "button", "class": "btn primary" }, [icon("i-download"), "Download"]);
    go.addEventListener("click", () => {
      S3.store("ds.export", st);
      go.disabled = true; go.lastChild.textContent = "Working…";
      runExport(st).then(() => { dlg.close(); S3.done(); }).catch(err => { S3.toast(err.message || String(err), "error"); go.disabled = false; go.lastChild.textContent = "Download"; });
    });
    const dlg = modal("Download", body, [h("span", { "class": "grow" }), go]);
  }
  async function runExport(st) {
    const d = ED.doc, pages = d.pages.length > 1 && st.all ? d.pages : [page()], name = IO.slug(d.name);
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await R.ensureImages(d);
    if (st.fmt === "pdf") {
      const bytes = await IO.pdfBytes(d, pages, { scale: st.pdfScale, quality: st.q, lossless: st.lossless });
      S3.download(new Blob([bytes], { type: "application/pdf" }), name + ".pdf"); S3.toast("PDF downloaded"); return;
    }
    const opts = { format: st.fmt, scale: st.scale, quality: st.q, transparent: st.transp }, ext = st.fmt === "jpg" ? ".jpg" : ".png";
    if (pages.length === 1) {
      const bytes = await IO.rasterPage(d, pages[0], opts);
      S3.download(new Blob([bytes], { type: st.fmt === "jpg" ? "image/jpeg" : "image/png" }), name + (d.pages.length > 1 ? "-" + (ED.pi + 1) : "") + ext);
    } else {
      const files = [];
      for (let i = 0; i < pages.length; i++) files.push({ name: name + "-" + String(i + 1).padStart(2, "0") + ext, data: await IO.rasterPage(d, pages[i], opts) });
      S3.download(await IO.zipFiles(files), name + ".zip");
    }
    S3.toast("Downloaded");
  }
  function shortcutsDialog() {
    const rows = [["Ctrl + Z / Ctrl + Shift + Z", "Undo / redo"], ["Ctrl + C / X / V", "Copy / cut / paste (paste images too)"], ["Ctrl + D", "Duplicate"], ["Delete", "Delete"],
      ["Ctrl + A", "Select all"], ["Shift + click, drag on empty space", "Select several"], ["Ctrl + G / Ctrl + Shift + G", "Group / ungroup"],
      ["Ctrl + ] / Ctrl + [", "Forward / backward (add Shift: front / back)"], ["Ctrl + Shift + L", "Lock / unlock"], ["Arrows (Shift = 10 px)", "Nudge"],
      ["Enter or double-click", "Edit text"], ["Esc", "Finish editing / deselect"], ["T  R  O  L", "Add text, rectangle, ellipse, line"],
      ["Shift while resizing / rotating", "Free ratio / 15° steps"], ["Alt while dragging", "Move without snapping"],
      ["Ctrl + scroll, Ctrl + = / -", "Zoom"], ["Ctrl + 0", "Fit page"], ["Space + drag, scroll", "Pan"], ["Page Up / Page Down", "Previous / next page"],
      ["Ctrl + S", "Save project file"], ["Ctrl + E", "Download"]];
    const tb = h("table", { "class": "tbl" }, [h("tbody", {}, rows.map(r => h("tr", {}, [h("td", {}, [h("kbd", { text: r[0] })]), h("td", { text: r[1] })])))]);
    modal("Keyboard shortcuts", h("div", { "class": "tbl-wrap" }, [tb]));
  }

  // ================= files =================
  function saveFile() {
    finishText();
    S3.download(IO.projectJson(ED.doc), IO.slug(ED.doc.name) + ".s3design", "application/json");
    S3.toast("Project file saved. Open it here any time."); S3.done();
  }
  function openFile(f) {
    if (f.size > 120e6) { S3.toast("That file is too large", "error"); return; }
    S3.readFile(f, "text").then(t => {
      const d = IO.openProject(t); d.id = C.uid("d");
      openDoc(d, { save: true }); S3.toast("Opened “" + d.name + "”");
    }).catch(err => S3.toast(err.message || "Could not open that file", "error"));
  }

  // ================= fonts =================
  function ensureDocFont(fam) {
    if (ED.userFonts.indexOf(fam) < 0 || (ED.doc.fonts || []).some(f => f.family === fam)) return;
    IO.store.fonts().then(all => { const f = (all || []).filter(x => x.family === fam)[0]; if (f) { ED.doc.fonts.push({ family: f.family, data: f.data }); dirty(); } }).catch(() => {});
  }
  async function loadFontFile(file) {
    if (file.size > 12e6) { S3.toast("Font files over 12 MB are not supported", "error"); return; }
    const bytes = new Uint8Array(await S3.readFile(file));
    let fam = IO.cleanFamily(file.name);
    try { await IO.registerFont(fam, bytes); } catch (e) { S3.toast("That doesn't look like a font file this browser can read", "error"); return; }
    const data = IO.b64(bytes);
    if (ED.userFonts.indexOf(fam) < 0) ED.userFonts.push(fam);
    ED.doc.fonts = (ED.doc.fonts || []).filter(f => f.family !== fam).concat({ family: fam, data: data });
    IO.store.putFont({ family: fam, data: data }).catch(() => {});
    const sel = selObjs().filter(o => o.type === "text");
    if (sel.length) live(o => { o.font = fam; }, true);
    dirty(); buildProps(); S3.toast("Font “" + fam + "” loaded" + (sel.length ? " and applied" : ""));
  }
  async function moreFonts() {
    if (!window.queryLocalFonts) { S3.toast("This browser doesn't offer a full font list. Fonts it can see are already in the menu.", "error"); return; }
    try {
      const list = await window.queryLocalFonts(), fams = [];
      list.forEach(f => { const n = IO.cleanFamily(f.family + ".x"); if (fams.indexOf(n) < 0) fams.push(n); });
      const before = ED.fonts.length;
      ED.fonts = ED.fonts.concat(fams.filter(f => ED.fonts.indexOf(f) < 0)).sort((a, b) => a === "Inter" ? -1 : b === "Inter" ? 1 : a.localeCompare(b));
      fontInfo(); buildProps(); S3.toast((ED.fonts.length - before) + " more fonts added to the menu");
    } catch (e) { S3.toast("Font access was not allowed", "error"); }
  }
  function fontInfo() { $("#fontInfo").textContent = ED.fonts.length + " fonts found on this device" + (ED.userFonts.length ? ", " + ED.userFonts.length + " of yours" : "") + ". Load your own .ttf, .otf or .woff file any time, free."; }

  // ================= keyboard =================
  document.addEventListener("keydown", e => {
    if (modalOpen()) return;
    if (e.key === " " && !isTyping(e.target)) { if (!spaceDown) { spaceDown = true; cv.style.cursor = "grab"; } if (e.target === stage || e.target === document.body) e.preventDefault(); }
    if (isTyping(e.target)) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey, onEditor = e.target === stage || e.target === document.body || stage.contains(e.target) || e.target.closest(".ds-app");
    if (!onEditor) return;
    if (mod && !e.altKey) {
      const lk = k.toLowerCase();
      if (lk === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((lk === "z" && e.shiftKey) || lk === "y") { e.preventDefault(); redo(); }
      else if (lk === "c") copySel(false);
      else if (lk === "x") { copySel(true); }
      else if (lk === "d") { e.preventDefault(); duplicateSel(); }
      else if (lk === "a") { e.preventDefault(); select(page().objects.filter(o => !o.hidden && !o.locked).map(o => o.id)); }
      else if (lk === "g") { e.preventDefault(); if (e.shiftKey) ungroupSel(); else groupSel(); }
      else if (lk === "l" && e.shiftKey) { e.preventDefault(); toggleLock(); }
      else if (e.code === "BracketRight") { e.preventDefault(); order(e.shiftKey ? "top" : "up"); }
      else if (e.code === "BracketLeft") { e.preventDefault(); order(e.shiftKey ? "bottom" : "down"); }
      else if (k === "=" || k === "+") { e.preventDefault(); zoomAt(ED.zoom * 1.25, vw / 2, vh / 2); }
      else if (k === "-") { e.preventDefault(); zoomAt(ED.zoom / 1.25, vw / 2, vh / 2); }
      else if (k === "0") { e.preventDefault(); fit(); }
      else if (k === "1") { e.preventDefault(); zoomAt(1, vw / 2, vh / 2); }
      else if (lk === "s") { e.preventDefault(); saveFile(); }
      else if (lk === "e") { e.preventDefault(); exportDialog(); }
      return;
    }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); deleteSel(); }
    else if (k === "Escape") { if (ED.sel.length) select([]); }
    else if (k === "Enter" && (e.target === stage || e.target === document.body)) { const o = selObjs()[0]; if (o && o.type === "text" && ED.sel.length === 1) { e.preventDefault(); startText(o); } }
    else if (k.indexOf("Arrow") === 0) {
      if (!ED.sel.length) return;
      e.preventDefault(); const st = e.shiftKey ? 10 : 1;
      nudge(k === "ArrowLeft" ? -st : k === "ArrowRight" ? st : 0, k === "ArrowUp" ? -st : k === "ArrowDown" ? st : 0);
    }
    else if (k === "PageDown") { e.preventDefault(); goPage(ED.pi + 1); }
    else if (k === "PageUp") { e.preventDefault(); goPage(ED.pi - 1); }
    else if (!e.altKey && (k === "t" || k === "T")) { e.preventDefault(); addText("h2"); }
    else if (!e.altKey && (k === "r" || k === "R")) { e.preventDefault(); addShape("rect"); }
    else if (!e.altKey && (k === "o" || k === "O")) { e.preventDefault(); addShape("ellipse"); }
    else if (!e.altKey && (k === "l" || k === "L")) { e.preventDefault(); addLine("solid"); }
    else if (k === "?") shortcutsDialog();
  });
  document.addEventListener("keyup", e => { if (e.key === " ") { spaceDown = false; cv.style.cursor = ""; } });
  document.addEventListener("paste", e => {
    if (isTyping(e.target) || modalOpen()) return;
    const files = [...(e.clipboardData && e.clipboardData.files || [])].filter(f => /^image\//.test(f.type));
    if (files.length) { e.preventDefault(); addImageFiles(files); return; }
    const txt = e.clipboardData && e.clipboardData.getData("text/plain");
    if (ED.clip) { e.preventDefault(); paste(); }
    else if (txt && txt.trim()) { e.preventDefault(); const b = base(); addObject(C.make("text", { text: txt.slice(0, 5000), size: Math.round(b * 0.04), weight: 400, w: ED.doc.w * 0.7 })); }
  });
  document.addEventListener("copy", e => { if (!isTyping(e.target) && !modalOpen() && ED.sel.length && !window.getSelection().toString()) { e.preventDefault(); copySel(false); } });

  // ================= wiring =================
  $$(".ds-rail button").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
  $("#btnUndo").addEventListener("click", undo);
  $("#btnRedo").addEventListener("click", redo);
  $("#btnNew").addEventListener("click", () => sizeDialog("new"));
  $("#btnNew2").addEventListener("click", () => sizeDialog("new"));
  $("#btnResize").addEventListener("click", () => sizeDialog("resize"));
  $("#btnSave").addEventListener("click", saveFile);
  $("#btnExport").addEventListener("click", exportDialog);
  $("#btnKeys").addEventListener("click", shortcutsDialog);
  $("#btnOpen input").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) openFile(f); });
  $("#docName").addEventListener("input", () => { ED.doc.name = $("#docName").value.slice(0, 120) || "Untitled design"; commitSoon(); });
  $("#zIn").addEventListener("click", () => zoomAt(ED.zoom * 1.25, vw / 2, vh / 2));
  $("#zOut").addEventListener("click", () => zoomAt(ED.zoom / 1.25, vw / 2, vh / 2));
  $("#zLabel").addEventListener("click", fit);
  $("#zFit").addEventListener("click", fit);
  $("#pgDup").addEventListener("click", dupPage);
  $("#pgDel").addEventListener("click", delPage);
  $("#pgLeft").addEventListener("click", () => movePage(-1));
  $("#pgRight").addEventListener("click", () => movePage(1));
  $("#fontFile input").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) loadFontFile(f); });
  $("#fontMore").addEventListener("click", moreFonts);
  if (!window.queryLocalFonts) $("#fontMore").hidden = true;
  new ResizeObserver(resizeCanvas).observe(stage);
  window.addEventListener("beforeunload", () => { if ($("#saveState").textContent === "Saving…") { clearTimeout(saveT); autosave(); } });

  async function boot() {
    ED.fonts = IO.detectFonts();
    try { (await IO.store.fonts() || []).forEach(f => { IO.registerFont(f.family, IO.unb64(f.data)).then(() => { if (ED.userFonts.indexOf(f.family) < 0) ED.userFonts.push(f.family); fontInfo(); }).catch(() => {}); }); } catch (e) { /* no storage */ }
    fontInfo();
    buildStaticPanels();
    let opened = false;
    const last = S3.store("ds.last");
    if (last) { try { const rec = await IO.store.get(last); if (rec) { const d = IO.openProject(JSON.stringify(rec.doc)); d.id = rec.id; openDoc(d, { saved: true }); opened = true; } } catch (e) { /* fall through */ } }
    if (!opened) openDoc(DS.fromTemplate(DS.TEMPLATES[0]), { quiet: true });
    setTab(S3.store("ds.tab") || "templates");
    resizeCanvas();
  }
  ED.ready = boot();

  // exported for the self-test / demo
  Object.assign(ED, { openDoc: openDoc, select: select, commit: commit, undo: undo, redo: redo, fit: fit, page: page, addImageFiles: addImageFiles,
    groupSel: groupSel, ungroupSel: ungroupSel, setTab: setTab, toPage: toPage, toScreen: toScreen, buildProps: buildProps, renderPages: renderPages });
})();
