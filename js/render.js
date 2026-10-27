/* Design Studio renderer: draws a page of the scene graph onto any 2D canvas context.
   The same code draws the editor view, page thumbnails and every export, so what you see is what you get. */
(function () {
  "use strict";
  var DS = window.DS = window.DS || {};
  var RAD = Math.PI / 180;
  var SERIF = /georgia|times|garamond|serif|palatino|baskerville|didot|cambria|constantia|bookman|naskh|amiri|traditional arabic|scheherazade/i;
  var MONO = /mono|courier|consolas|menlo/i;
  function fontStack(f) {
    f = String(f || "Inter").replace(/["\\]/g, "");
    var fb = SERIF.test(f) ? 'Georgia, "Times New Roman", "Noto Naskh Arabic", "Traditional Arabic", serif'
      : MONO.test(f) ? 'ui-monospace, Consolas, "Courier New", monospace'
      : 'Inter, "Segoe UI", Tahoma, "Noto Sans Arabic", "Geeza Pro", system-ui, sans-serif';
    return '"' + f + '", ' + fb;
  }
  function fontCss(o, size) { return (o.italic ? "italic " : "") + (o.weight || 400) + " " + size + "px " + fontStack(o.font); }

  var RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/, LTR = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;
  function textDir(o) {
    if (o.dir === "rtl" || o.dir === "ltr") return o.dir;
    var s = o.text || "";
    for (var i = 0; i < s.length; i++) { var ch = s.charAt(i); if (RTL.test(ch)) return "rtl"; if (LTR.test(ch)) return "ltr"; }
    return "ltr";
  }

  var mctx = null;
  function measureCtx() { if (!mctx) mctx = document.createElement("canvas").getContext("2d"); return mctx; }
  var HAS_LS = (function () { try { return "letterSpacing" in document.createElement("canvas").getContext("2d"); } catch (e) { return false; } })();
  function setLS(ctx, px) { if (HAS_LS) ctx.letterSpacing = (px || 0) + "px"; }

  // ---------- text layout (word wrap, explicit newlines, long words broken by character) ----------
  var cache = {}, cacheN = 0;
  function displayText(o) { return o.upper ? String(o.text || "").toUpperCase() : String(o.text || ""); }
  function layoutText(o) {
    var text = displayText(o), key = [text, o.font, o.size, o.weight, o.italic, Math.round(o.w * 10), o.ls, o.lh, textDir(o)].join("\u0001");
    if (cache[key]) return cache[key];
    var ctx = measureCtx();
    ctx.font = fontCss(o, o.size); setLS(ctx, o.ls); ctx.direction = textDir(o);
    var maxW = Math.max(1, o.w), lines = [];
    function width(s) { return ctx.measureText(s).width; }
    text.split("\n").forEach(function (para) {
      var words = para.split(" "), line = "";
      words.forEach(function (word) {
        var test = line ? line + " " + word : word;
        if (width(test) <= maxW + 0.5 || (!line && width(word) <= maxW + 0.5)) { line = test; return; }
        if (line) { lines.push(line); line = ""; }
        if (width(word) <= maxW + 0.5) { line = word; return; }
        var chars = Array.from(word), part = "";        // a single word wider than the box
        chars.forEach(function (c) { if (part && width(part + c) > maxW + 0.5) { lines.push(part); part = c; } else part += c; });
        line = part;
      });
      lines.push(line);
    });
    var lineH = o.size * (o.lh || 1.2);
    var res = { lines: lines.map(function (s) { return { s: s, w: width(s) }; }), lineH: lineH, h: Math.max(lineH, lines.length * lineH) };
    if (++cacheN > 600) { cache = {}; cacheN = 0; }
    cache[key] = res;
    return res;
  }
  function fitText(o) { if (o.type === "text") o.h = layoutText(o).h; }
  function fitAll(doc) {
    function walk(list) { list.forEach(function (o) { fitText(o); if (o.type === "group") walk(o.children); }); }
    doc.pages.forEach(function (p) { walk(p.objects); });
  }

  // ---------- fills ----------
  function paint(ctx, f, x, y, w, h) {
    if (!f) return null;
    if (typeof f === "string") return f;
    if (f.t === "lin") {
      var a = (f.a || 0) * RAD, vx = Math.sin(a), vy = -Math.cos(a), L = Math.abs(w / 2 * vx) + Math.abs(h / 2 * vy);
      var cx = x + w / 2, cy = y + h / 2, g = ctx.createLinearGradient(cx - vx * L, cy - vy * L, cx + vx * L, cy + vy * L);
      g.addColorStop(0, f.c[0]); g.addColorStop(1, f.c[1]);
      return g;
    }
    return null;
  }

  // ---------- shape paths (local frame: box centred on 0,0) ----------
  function rrect(p, x, y, w, h, r) {
    r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
    p.moveTo(x + r, y); p.lineTo(x + w - r, y); if (r) p.arcTo(x + w, y, x + w, y + r, r);
    p.lineTo(x + w, y + h - r); if (r) p.arcTo(x + w, y + h, x + w - r, y + h, r);
    p.lineTo(x + r, y + h); if (r) p.arcTo(x, y + h, x, y + h - r, r);
    p.lineTo(x, y + r); if (r) p.arcTo(x, y, x + r, y, r);
    p.closePath(); return p;
  }
  function poly(p, pts, w, h) {      // normalise unit points so the polygon fills the box
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    pts.forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); });
    pts.forEach(function (q, i) {
      var X = -w / 2 + (q[0] - x0) / (x1 - x0) * w, Y = -h / 2 + (q[1] - y0) / (y1 - y0) * h;
      if (i) p.lineTo(X, Y); else p.moveTo(X, Y);
    });
    p.closePath(); return p;
  }
  function regular(n, inner) {
    var pts = [], k = inner ? 2 * n : n;
    for (var i = 0; i < k; i++) { var a = (-90 + i * 360 / k) * RAD, r = inner && i % 2 ? inner : 1; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    return pts;
  }
  function shapePath(o) {
    var p = new Path2D(), w = o.w, h = o.h;
    switch (o.shape) {
      case "ellipse": p.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); return p;
      case "triangle": return poly(p, [[0, 0], [1, 1], [-1, 1]], w, h);
      case "diamond": return poly(p, [[0, -1], [1, 0], [0, 1], [-1, 0]], w, h);
      case "pentagon": return poly(p, regular(5), w, h);
      case "hexagon": return poly(p, regular(6).map(function (q) { return [q[1], q[0]]; }), w, h);
      case "star": return poly(p, regular(5, 0.45), w, h);
      case "arrow": return poly(p, [[0, 0.3], [0.6, 0.3], [0.6, 0], [1, 0.5], [0.6, 1], [0.6, 0.7], [0, 0.7]], w, h);
      case "heart": var q = new Path2D(); q.addPath(new Path2D(DS.ICONS.heart), new DOMMatrix().translate(-w / 2, -h / 2).scale(w / 20.8, h / 16).translate(-1.6, -4.5)); return q;
      default: return rrect(p, -w / 2, -h / 2, w, h, o.radius);
    }
  }
  var iconCache = {};
  function iconPath(name) { var d = DS.ICONS[name] || DS.ICONS.star; return iconCache[name] || (iconCache[name] = new Path2D(d)); }

  // ---------- images ----------
  var imgs = {};
  function getImg(doc, id) {
    if (!id || !doc.assets[id]) return null;
    var rec = imgs[id];
    if (!rec || rec.src !== doc.assets[id]) {
      var im = new Image();
      rec = imgs[id] = { src: doc.assets[id], img: im, ok: false };
      im.onload = function () { rec.ok = true; if (DS.render.onImage) DS.render.onImage(); };
      im.src = rec.src;
    }
    return rec.ok ? rec.img : null;
  }
  function ensureImages(doc) {
    return Promise.all(Object.keys(doc.assets).map(function (id) {
      getImg(doc, id);
      var rec = imgs[id];
      return rec.ok ? null : (rec.img.decode ? rec.img.decode().then(function () { rec.ok = true; }, function () {}) : null);
    }));
  }

  // ---------- drawing ----------
  function applyShadow(ctx, sh, scale) {
    if (!sh) return;
    ctx.shadowColor = sh.color; ctx.shadowBlur = sh.blur * scale; ctx.shadowOffsetX = sh.x * scale; ctx.shadowOffsetY = sh.y * scale;
  }
  function noShadow(ctx) { ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }

  function drawText(ctx, o, opt) {
    var lay = layoutText(o), w = o.w, h = o.h, dir = textDir(o);
    if (o.bgc) { var s0 = ctx.shadowColor; ctx.fillStyle = o.bgc; ctx.fillRect(-w / 2, -h / 2, w, h); ctx.shadowColor = s0; }
    ctx.font = fontCss(o, o.size); setLS(ctx, o.ls); ctx.direction = dir; ctx.textBaseline = "middle"; ctx.textAlign = o.align || "center";
    var ax = o.align === "left" ? -w / 2 : o.align === "right" ? w / 2 : 0;
    // letter-spacing adds space after the last glyph too; shift so centred/right text looks centred/right
    var lsFix = HAS_LS && o.ls ? (o.align === "center" ? o.ls / 2 : o.align === "right" ? o.ls : 0) * (dir === "rtl" ? -1 : 1) : 0;
    ctx.fillStyle = paint(ctx, o.color, -w / 2, -h / 2, w, h) || "#000";
    var top = -h / 2 + (h - lay.h) / 2;
    lay.lines.forEach(function (ln, i) {
      var y = top + lay.lineH * (i + 0.5), x = ax + lsFix;
      if (o.strokeW > 0) {
        ctx.save(); ctx.lineJoin = "round"; ctx.miterLimit = 2; ctx.lineWidth = o.strokeW * 2; ctx.strokeStyle = o.stroke || "#000";
        ctx.strokeText(ln.s, x, y); ctx.restore();
        noShadow(ctx);
      }
      ctx.fillText(ln.s, x, y);
      if (o.underline && ln.s) {
        var lw = ln.w, lx = o.align === "left" ? ax : o.align === "right" ? ax - lw : ax - lw / 2;
        ctx.fillRect(lx, y + o.size * 0.36, lw, Math.max(1, o.size / 16));
      }
    });
    setLS(ctx, 0);
  }

  function drawShape(ctx, o, opt) {
    var p = shapePath(o), f = paint(ctx, o.fill, -o.w / 2, -o.h / 2, o.w, o.h);
    if (f) { ctx.fillStyle = f; ctx.fill(p); }
    if (o.strokeW > 0) { if (f) noShadow(ctx); ctx.lineWidth = o.strokeW; ctx.strokeStyle = o.stroke; ctx.lineJoin = "round"; ctx.stroke(p); }
  }

  function drawLine(ctx, o) {
    var w = o.w, t = Math.max(0.5, o.h), ah = t * 3.2, x0 = -w / 2, x1 = w / 2;
    ctx.strokeStyle = o.stroke; ctx.fillStyle = o.stroke; ctx.lineWidth = t;
    ctx.lineCap = o.dash === "dot" ? "round" : "butt";
    ctx.setLineDash(o.dash === "dash" ? [t * 3, t * 2] : o.dash === "dot" ? [0.01, t * 2] : []);
    var s = o.start === "arrow" ? x0 + ah * 0.8 : x0, e = o.end === "arrow" ? x1 - ah * 0.8 : x1;
    ctx.beginPath(); ctx.moveTo(s, 0); ctx.lineTo(e, 0); ctx.stroke(); ctx.setLineDash([]);
    function cap(kind, x, d) {
      if (kind === "arrow") { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x - d * ah, -ah * 0.6); ctx.lineTo(x - d * ah, ah * 0.6); ctx.closePath(); ctx.fill(); }
      if (kind === "dot") { ctx.beginPath(); ctx.arc(x, 0, t * 1.6, 0, Math.PI * 2); ctx.fill(); }
    }
    cap(o.start, x0, -1); cap(o.end, x1, 1);
  }

  function drawIcon(ctx, o) {
    var p = iconPath(o.icon);
    ctx.save(); ctx.translate(-o.w / 2, -o.h / 2); ctx.scale(o.w / 24, o.h / 24);
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = o.color; ctx.fillStyle = o.color; ctx.lineWidth = o.sw || 2;
    if (o.style === "fill") { ctx.fill(p, "evenodd"); noShadow(ctx); ctx.lineWidth = 1; }
    ctx.stroke(p);
    ctx.restore();
  }

  function drawImage(ctx, o, opt) {
    var w = o.w, h = o.h, frame = rrect(new Path2D(), -w / 2, -h / 2, w, h, o.radius), img = getImg(opt.doc, o.src);
    if (!img) {
      if (!opt.editor) return;
      ctx.fillStyle = "rgba(127,140,155,0.28)"; ctx.fill(frame); noShadow(ctx);
      ctx.save(); ctx.clip(frame);
      var k = Math.min(w, h) * 0.32; ctx.translate(-k / 2, -k / 2); ctx.scale(k / 24, k / 24);
      ctx.strokeStyle = "rgba(90,100,115,0.85)"; ctx.lineWidth = 1.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.stroke(new Path2D("M3 5h18v14H3zM8.5 10a1.5 1.5 0 1 0 0-.01M21 15.5l-5-5L5 19"));
      ctx.restore(); return;
    }
    var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, dw = w, dh = h;
    if (o.fit !== "stretch") { var k2 = o.fit === "contain" ? Math.min(w / iw, h / ih) : Math.max(w / iw, h / ih); dw = iw * k2; dh = ih * k2; }
    var fx = o.fx || {}, filt = [];
    if (fx.b != null && fx.b !== 100) filt.push("brightness(" + fx.b + "%)");
    if (fx.c != null && fx.c !== 100) filt.push("contrast(" + fx.c + "%)");
    if (fx.s != null && fx.s !== 100) filt.push("saturate(" + fx.s + "%)");
    if (fx.g) filt.push("grayscale(" + fx.g + "%)");
    if (fx.blur) filt.push("blur(" + (fx.blur * (opt.scale || 1)) + "px)");
    if (ctx.shadowColor !== "transparent" && o.shadow) { ctx.fillStyle = "#000"; ctx.fill(frame); noShadow(ctx); }
    ctx.save(); ctx.clip(frame);
    if (filt.length) ctx.filter = filt.join(" ");
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  }

  function drawObject(ctx, o, opt) {
    if (o.hidden || o.id === opt.skip) return;
    ctx.save();
    ctx.translate(o.x + o.w / 2, o.y + o.h / 2);
    if (o.rot) ctx.rotate(o.rot * RAD);
    if (o.flipX || o.flipY) ctx.scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1);
    ctx.globalAlpha *= o.op == null ? 1 : o.op;
    if (o.type !== "group") applyShadow(ctx, o.shadow, opt.scale || 1);
    if (o.type === "text") {
      if (o.flipX || o.flipY) ctx.scale(o.flipX ? -1 : 1, o.flipY ? -1 : 1);   // text is never mirrored
      drawText(ctx, o, opt);
    }
    else if (o.type === "shape") drawShape(ctx, o, opt);
    else if (o.type === "line") drawLine(ctx, o, opt);
    else if (o.type === "icon") drawIcon(ctx, o, opt);
    else if (o.type === "image") drawImage(ctx, o, opt);
    else if (o.type === "group") { ctx.translate(-o.w / 2, -o.h / 2); o.children.forEach(function (c) { drawObject(ctx, c, opt); }); }
    ctx.restore();
  }

  // Draw a page in page units onto ctx (caller sets the transform). opt: {doc, scale, transparent, editor, skip}
  function drawPage(ctx, doc, page, opt) {
    if (!opt.transparent) { ctx.fillStyle = paint(ctx, page.bg, 0, 0, doc.w, doc.h) || "#ffffff"; ctx.fillRect(0, 0, doc.w, doc.h); }
    page.objects.forEach(function (o) { drawObject(ctx, o, opt); });
  }
  // A page as its own canvas at `scale` output pixels per design pixel.
  function pageCanvas(doc, page, scale, opt) {
    opt = opt || {};
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(doc.w * scale)); c.height = Math.max(1, Math.round(doc.h * scale));
    var ctx = c.getContext("2d");
    ctx.setTransform(c.width / doc.w, 0, 0, c.height / doc.h, 0, 0);
    if (opt.jpeg && opt.transparent) opt.transparent = false;
    drawPage(ctx, doc, page, { doc: doc, scale: scale, transparent: !!opt.transparent, editor: !!opt.editor });
    return c;
  }

  DS.render = {
    fontCss: fontCss, fontStack: fontStack, textDir: textDir, layoutText: layoutText, fitText: fitText, fitAll: fitAll,
    paint: paint, shapePath: shapePath, drawObject: drawObject, drawPage: drawPage, pageCanvas: pageCanvas,
    getImg: getImg, ensureImages: ensureImages, displayText: displayText, rrect: rrect, onImage: null,
    clearCache: function () { cache = {}; cacheN = 0; }
  };
})();
