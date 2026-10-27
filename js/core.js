/* Design Studio core: scene graph, geometry, snapping, history and project validation.
   Pure logic (no DOM), shared by the editor, the exporters and the self-test. */
(function () {
  "use strict";
  var DS = window.DS = window.DS || {};

  // ---------- ids ----------
  var seq = 0;
  function uid(p) { seq = (seq + 1) % 1e6; return (p || "o") + Date.now().toString(36) + seq.toString(36) + Math.floor(Math.random() * 1296).toString(36); }

  // ---------- geometry ----------
  var RAD = Math.PI / 180;
  function rotPt(x, y, cx, cy, deg) {
    var a = deg * RAD, c = Math.cos(a), s = Math.sin(a), dx = x - cx, dy = y - cy;
    return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
  }
  function center(o) { return { x: o.x + o.w / 2, y: o.y + o.h / 2 }; }
  function corners(o) {
    var c = center(o), r = o.rot || 0;
    return [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]].map(function (p) { return rotPt(p[0], p[1], c.x, c.y, r); });
  }
  // Axis-aligned bounds of a (possibly rotated) object.
  function aabb(o) {
    var cs = corners(o), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    cs.forEach(function (p) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function unionBox(list) {
    if (!list.length) return null;
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    list.forEach(function (o) { var b = aabb(o); x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  // Point inside an object's rotated box, with optional padding (in page units).
  function hit(o, px, py, pad) {
    pad = pad || 0;
    var c = center(o), p = rotPt(px, py, c.x, c.y, -(o.rot || 0));
    var hh = o.type === "line" ? Math.max(o.h, 0) : o.h, yy = o.type === "line" ? o.y + o.h / 2 - hh / 2 : o.y;
    return p.x >= o.x - pad && p.x <= o.x + o.w + pad && p.y >= yy - pad && p.y <= yy + hh + pad;
  }
  // Topmost visible object at a point (objects are drawn in array order, last = top).
  function hitTest(objects, px, py, pad) {
    for (var i = objects.length - 1; i >= 0; i--) {
      var o = objects[i];
      if (o.hidden) continue;
      var p = o.type === "line" ? (pad || 0) * 2.5 : (pad || 0);
      if (hit(o, px, py, p)) return o;
    }
    return null;
  }
  function boxesIntersect(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  // Resize a single (rotated) object by dragging handle `hd` ("nw","n","ne","e","se","s","sw","w")
  // to page point p, keeping the opposite side/corner fixed. keep=true keeps the aspect ratio.
  function resizeBox(o, hd, p, keep, min) {
    min = min || 4;
    var r = o.rot || 0, c = center(o);
    var lp = rotPt(p.x, p.y, c.x, c.y, -r);              // pointer in the object's unrotated frame
    var sx = hd.indexOf("w") >= 0 ? -1 : hd.indexOf("e") >= 0 ? 1 : 0;
    var sy = hd.indexOf("n") >= 0 ? -1 : hd.indexOf("s") >= 0 ? 1 : 0;
    var ax = sx === 0 ? c.x : (sx < 0 ? o.x + o.w : o.x);   // anchor in the unrotated frame
    var ay = sy === 0 ? c.y : (sy < 0 ? o.y + o.h : o.y);
    var w = o.w, h = o.h;
    if (sx) w = Math.max(min, (lp.x - ax) * sx);
    if (sy) h = Math.max(min, (lp.y - ay) * sy);
    if (keep && sx && sy) {
      var k = Math.max(w / o.w, h / o.h); w = Math.max(min, o.w * k); h = Math.max(min, o.h * k);
    } else if (keep && sx && !sy) { h = Math.max(min, o.h * w / o.w); }
    else if (keep && sy && !sx) { w = Math.max(min, o.w * h / o.h); }
    // new centre in the unrotated frame, then rotate back around the old centre
    var ncx = sx === 0 ? c.x : ax + sx * w / 2, ncy = sy === 0 ? c.y : ay + sy * h / 2;
    var wc = rotPt(ncx, ncy, c.x, c.y, r);
    return { x: wc.x - w / 2, y: wc.y - h / 2, w: w, h: h };
  }

  // ---------- snapping ----------
  // Lines an object can snap to: page edges/centre plus other objects' edges/centres.
  function snapTargets(page, W, H, excludeIds) {
    var xs = [0, W / 2, W], ys = [0, H / 2, H];
    page.objects.forEach(function (o) {
      if (o.hidden || excludeIds.indexOf(o.id) >= 0) return;
      var b = aabb(o);
      xs.push(b.x, b.x + b.w / 2, b.x + b.w); ys.push(b.y, b.y + b.h / 2, b.y + b.h);
    });
    return { xs: xs, ys: ys };
  }
  // Snap a moving box. Returns the correction (dx, dy) and the guide lines to draw.
  function snapBox(box, t, thr) {
    function best(vals, lines) {
      var b = null;
      vals.forEach(function (v) { lines.forEach(function (l) { var d = l - v; if (Math.abs(d) <= thr && (!b || Math.abs(d) < Math.abs(b.d))) b = { d: d, at: l }; }); });
      return b;
    }
    var bx = best([box.x, box.x + box.w / 2, box.x + box.w], t.xs);
    var by = best([box.y, box.y + box.h / 2, box.y + box.h], t.ys);
    var g = [];
    if (bx) g.push({ axis: "x", at: bx.at });
    if (by) g.push({ axis: "y", at: by.at });
    return { dx: bx ? bx.d : 0, dy: by ? by.d : 0, guides: g };
  }
  function snapAngle(deg, free) {
    deg = ((deg % 360) + 360) % 360;
    if (free) return Math.round(deg / 15) * 15 % 360;
    for (var a = 0; a <= 360; a += 45) if (Math.abs(deg - a) < 3) return a % 360;
    return Math.round(deg * 10) / 10;
  }

  // ---------- scene graph ----------
  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function newDoc(w, h, name) {
    return { format: "s3design", version: 1, id: uid("d"), name: name || "Untitled design", w: w, h: h, print: null,
      pages: [newPage()], assets: {}, fonts: [] };
  }
  function newPage() { return { id: uid("p"), bg: "#ffffff", objects: [] }; }
  var DEFAULTS = {
    text: { text: "Text", font: "Inter", size: 48, weight: 700, italic: false, underline: false, color: "#111111", align: "center",
      lh: 1.2, ls: 0, dir: "auto", upper: false, strokeW: 0, stroke: "#000000", bgc: "" },
    shape: { shape: "rect", fill: "#3dd6d0", stroke: "#111111", strokeW: 0, radius: 0 },
    line: { stroke: "#111111", dash: "solid", start: "none", end: "none" },
    icon: { icon: "star", color: "#111111", style: "stroke", sw: 2 },
    image: { src: "", fit: "cover", radius: 0, fx: { b: 100, c: 100, s: 100, g: 0, blur: 0 } },
    group: { children: [] }
  };
  function make(type, props) {
    var o = { id: uid(), type: type, x: 0, y: 0, w: 100, h: 100, rot: 0, op: 1, locked: false, hidden: false, flipX: false, flipY: false, shadow: null, name: "" };
    var d = DEFAULTS[type] || {};
    for (var k in d) o[k] = clone(d[k]);
    for (var j in props || {}) o[j] = props[j];
    if (type === "line") o.h = Math.max(1, o.h);
    return o;
  }
  function find(page, id) { for (var i = 0; i < page.objects.length; i++) if (page.objects[i].id === id) return page.objects[i]; return null; }
  function indexOf(page, id) { for (var i = 0; i < page.objects.length; i++) if (page.objects[i].id === id) return i; return -1; }

  // Group: children are stored in the group's local, unrotated frame (relative to its top-left).
  function group(page, ids) {
    var sel = page.objects.filter(function (o) { return ids.indexOf(o.id) >= 0; });
    if (sel.length < 2) return null;
    var b = unionBox(sel), top = Math.max.apply(null, sel.map(function (o) { return indexOf(page, o.id); }));
    var g = make("group", { x: b.x, y: b.y, w: b.w, h: b.h, children: sel.map(function (o) { var c = clone(o); c.x -= b.x; c.y -= b.y; return c; }) });
    var at = top - sel.length + 1;
    page.objects = page.objects.filter(function (o) { return ids.indexOf(o.id) < 0; });
    page.objects.splice(Math.max(0, at), 0, g);
    return g;
  }
  // Children back to page space, applying the group's rotation, flips and opacity.
  function ungroup(page, id) {
    var i = indexOf(page, id), g = page.objects[i];
    if (!g || g.type !== "group") return [];
    var c = center(g), out = g.children.map(function (ch) {
      var o = clone(ch), lc = { x: g.x + ch.x + ch.w / 2, y: g.y + ch.y + ch.h / 2 };
      if (g.flipX) lc.x = 2 * c.x - lc.x;
      if (g.flipY) lc.y = 2 * c.y - lc.y;
      var wc = rotPt(lc.x, lc.y, c.x, c.y, g.rot || 0);
      o.x = wc.x - ch.w / 2; o.y = wc.y - ch.h / 2;
      o.rot = ((ch.rot || 0) * (g.flipX !== g.flipY ? -1 : 1) + (g.rot || 0)) % 360;
      if (g.flipX) o.flipX = !o.flipX;
      if (g.flipY) o.flipY = !o.flipY;
      o.op = (o.op == null ? 1 : o.op) * (g.op == null ? 1 : g.op);
      o.id = uid();
      return o;
    });
    page.objects.splice.apply(page.objects, [i, 1].concat(out));
    return out;
  }
  // Scale an object's own size-dependent properties (font size, stroke, radius) and group children.
  function scaleProps(o, k) {
    if (o.type === "text") { o.size = Math.max(1, o.size * k); o.strokeW = (o.strokeW || 0) * k; o.ls = (o.ls || 0) * k; }
    if (o.type === "shape") { o.strokeW = (o.strokeW || 0) * k; o.radius = (o.radius || 0) * k; }
    if (o.type === "image") o.radius = (o.radius || 0) * k;
    if (o.type === "line") o.h = Math.max(0.5, o.h * k);
    if (o.shadow) { o.shadow.x *= k; o.shadow.y *= k; o.shadow.blur *= k; }
  }
  function scaleGroupChildren(g, kx, ky) {
    g.children.forEach(function (ch) {
      ch.x *= kx; ch.y *= ky;
      if (ch.type === "line") { ch.w *= kx; }
      else { ch.w *= kx; ch.h *= ky; }
      scaleProps(ch, Math.sqrt(Math.abs(kx * ky)));
      if (ch.type === "group") scaleGroupChildren(ch, kx, ky);
    });
  }
  // Move objects in the array (z-order). dir: "up" | "down" | "top" | "bottom".
  function reorder(page, ids, dir) {
    var objs = page.objects, sel = objs.filter(function (o) { return ids.indexOf(o.id) >= 0; }), rest = objs.filter(function (o) { return ids.indexOf(o.id) < 0; });
    if (dir === "top") page.objects = rest.concat(sel);
    else if (dir === "bottom") page.objects = sel.concat(rest);
    else {
      var arr = objs.slice(), step = dir === "up" ? 1 : -1;
      var order = dir === "up" ? arr.map(function (o, i) { return i; }).reverse() : arr.map(function (o, i) { return i; });
      order.forEach(function (i) {
        var j = i + step;
        if (ids.indexOf(arr[i].id) >= 0 && j >= 0 && j < arr.length && ids.indexOf(arr[j].id) < 0) { var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
      });
      page.objects = arr;
    }
  }
  // Align (to the selection box, or to the page when one object) and distribute.
  function align(objs, how, W, H) {
    var ref = objs.length > 1 ? unionBox(objs) : { x: 0, y: 0, w: W, h: H };
    objs.forEach(function (o) {
      var b = aabb(o), dx = 0, dy = 0;
      if (how === "left") dx = ref.x - b.x;
      if (how === "hcenter") dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
      if (how === "right") dx = ref.x + ref.w - (b.x + b.w);
      if (how === "top") dy = ref.y - b.y;
      if (how === "vcenter") dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
      if (how === "bottom") dy = ref.y + ref.h - (b.y + b.h);
      o.x += dx; o.y += dy;
    });
  }
  function distribute(objs, axis) {
    if (objs.length < 3) return;
    var items = objs.map(function (o) { return { o: o, b: aabb(o) }; });
    var k = axis === "h" ? "x" : "y", s = axis === "h" ? "w" : "h";
    items.sort(function (a, b) { return a.b[k] - b.b[k]; });
    var first = items[0].b, last = items[items.length - 1].b;
    var total = items.reduce(function (t, i) { return t + i.b[s]; }, 0);
    var gap = (last[k] + last[s] - first[k] - total) / (items.length - 1), pos = first[k];
    items.forEach(function (i) { i.o[k] += pos - i.b[k]; pos += i.b[s] + gap; });
  }
  // Resize the whole design; scale=true scales and centres the content to fit the new size.
  function resizeDoc(doc, w, h, scale) {
    var k = Math.min(w / doc.w, h / doc.h), ox = (w - doc.w * k) / 2, oy = (h - doc.h * k) / 2;
    if (scale) doc.pages.forEach(function (p) {
      p.objects.forEach(function (o) {
        o.x = o.x * k + ox; o.y = o.y * k + oy; o.w *= k;
        if (o.type !== "line") o.h *= k;
        scaleProps(o, k);
        if (o.type === "group") scaleGroupChildren(o, k, k);
      });
    });
    doc.w = w; doc.h = h;
  }

  // ---------- history (snapshots of pages only: assets never change once added) ----------
  function History(limit) { this.stack = []; this.i = -1; this.limit = limit || 120; }
  History.prototype.snap = function (doc) { return JSON.stringify({ w: doc.w, h: doc.h, print: doc.print, pages: doc.pages, name: doc.name }); };
  History.prototype.reset = function (doc) { this.stack = [this.snap(doc)]; this.i = 0; };
  History.prototype.commit = function (doc) {
    var s = this.snap(doc);
    if (this.stack[this.i] === s) return false;
    this.stack = this.stack.slice(0, this.i + 1); this.stack.push(s);
    if (this.stack.length > this.limit) this.stack.shift();
    this.i = this.stack.length - 1; return true;
  };
  History.prototype.apply = function (doc, s) { var v = JSON.parse(s); doc.w = v.w; doc.h = v.h; doc.print = v.print; doc.pages = v.pages; doc.name = v.name; };
  History.prototype.undo = function (doc) { if (this.i <= 0) return false; this.i--; this.apply(doc, this.stack[this.i]); return true; };
  History.prototype.redo = function (doc) { if (this.i >= this.stack.length - 1) return false; this.i++; this.apply(doc, this.stack[this.i]); return true; };
  History.prototype.canUndo = function () { return this.i > 0; };
  History.prototype.canRedo = function () { return this.i < this.stack.length - 1; };

  // ---------- fills ----------
  // A fill is "#rrggbb" / "rgba(...)" / "" (none) or {t:"lin", a: angle, c: [c1, c2]}.
  var COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)|transparent)$/;
  function isColor(c) { return typeof c === "string" && COLOR.test(c.trim()); }

  // ---------- project file validation ----------
  // Everything from a file is rebuilt field by field from a whitelist: unknown keys are dropped,
  // numbers clamped, strings length-limited, colours checked, image data must be a raster data: URL.
  var LIMITS = { pages: 200, objects: 3000, text: 20000, depth: 6, assetBytes: 40e6, fontBytes: 15e6 };
  var SHAPES = ["rect", "ellipse", "triangle", "diamond", "pentagon", "hexagon", "star", "arrow", "heart"];
  var IMG_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/;
  function num(v, lo, hi, d) { v = Number(v); if (!isFinite(v)) return d; return Math.min(hi, Math.max(lo, v)); }
  function str(v, max, d) { return typeof v === "string" ? v.slice(0, max) : (d == null ? "" : d); }
  function pick(v, list, d) { return list.indexOf(v) >= 0 ? v : d; }
  function bool(v) { return v === true; }
  function color(v, d) { return isColor(v) ? v.trim() : d; }
  function cleanId(v) { return typeof v === "string" && /^[A-Za-z0-9_-]{1,48}$/.test(v) ? v : uid(); }
  function cleanFont(v) {
    var f = str(v, 80, "Inter").replace(/["'`;:{}()<>\\\/@!]/g, "").replace(/\s+/g, " ").trim();
    return f || "Inter";
  }
  function fill(v, d) {
    if (v === "") return "";
    if (v && typeof v === "object" && v.t === "lin" && Array.isArray(v.c) && v.c.length >= 2 && isColor(v.c[0]) && isColor(v.c[1]))
      return { t: "lin", a: num(v.a, -360, 360, 90), c: [v.c[0].trim(), v.c[1].trim()] };
    return color(v, d);
  }
  function cleanShadow(s) {
    if (!s || typeof s !== "object") return null;
    return { x: num(s.x, -2000, 2000, 0), y: num(s.y, -2000, 2000, 6), blur: num(s.blur, 0, 2000, 12), color: color(s.color, "rgba(0,0,0,0.35)") };
  }
  var MAXC = 1e5;
  function cleanObj(o, assets, depth, count) {
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    var type = pick(o.type, ["text", "shape", "line", "icon", "image", "group"], null);
    if (!type || depth > LIMITS.depth) return null;
    if (++count.n > LIMITS.objects) throw new Error("Too many objects in this file");
    var c = make(type);
    c.id = cleanId(o.id);
    c.x = num(o.x, -MAXC, MAXC, 0); c.y = num(o.y, -MAXC, MAXC, 0);
    c.w = num(o.w, 0.5, MAXC, 100); c.h = num(o.h, 0.5, MAXC, 100);
    c.rot = num(o.rot, -360, 360, 0); c.op = num(o.op, 0, 1, 1);
    c.locked = bool(o.locked); c.hidden = bool(o.hidden); c.flipX = bool(o.flipX); c.flipY = bool(o.flipY);
    c.shadow = cleanShadow(o.shadow); c.name = str(o.name, 120);
    if (type === "text") {
      c.text = str(o.text, LIMITS.text, "Text"); c.font = cleanFont(o.font); c.size = num(o.size, 1, 5000, 48);
      c.weight = Math.round(num(o.weight, 100, 900, 400) / 100) * 100; c.italic = bool(o.italic); c.underline = bool(o.underline);
      c.color = fill(o.color, "#111111") || "#111111"; c.align = pick(o.align, ["left", "center", "right"], "center");
      c.lh = num(o.lh, 0.5, 4, 1.2); c.ls = num(o.ls, -200, 2000, 0); c.dir = pick(o.dir, ["auto", "ltr", "rtl"], "auto");
      c.upper = bool(o.upper); c.strokeW = num(o.strokeW, 0, 500, 0); c.stroke = color(o.stroke, "#000000"); c.bgc = color(o.bgc, "");
    } else if (type === "shape") {
      c.shape = pick(o.shape, SHAPES, "rect"); c.fill = fill(o.fill, "#cccccc"); c.stroke = color(o.stroke, "#111111");
      c.strokeW = num(o.strokeW, 0, 2000, 0); c.radius = num(o.radius, 0, MAXC, 0);
    } else if (type === "line") {
      c.stroke = color(o.stroke, "#111111"); c.dash = pick(o.dash, ["solid", "dash", "dot"], "solid");
      c.start = pick(o.start, ["none", "arrow", "dot"], "none"); c.end = pick(o.end, ["none", "arrow", "dot"], "none");
      c.h = num(o.h, 0.5, 2000, 4);
    } else if (type === "icon") {
      c.icon = DS.ICONS && DS.ICONS[o.icon] ? o.icon : "star"; c.color = color(o.color, "#111111");
      c.style = pick(o.style, ["stroke", "fill"], "stroke"); c.sw = num(o.sw, 0.25, 8, 2);
    } else if (type === "image") {
      c.src = typeof o.src === "string" && Object.prototype.hasOwnProperty.call(assets, o.src) ? o.src : "";
      c.fit = pick(o.fit, ["cover", "contain", "stretch"], "cover"); c.radius = num(o.radius, 0, MAXC, 0);
      var fx = o.fx && typeof o.fx === "object" ? o.fx : {};
      c.fx = { b: num(fx.b, 0, 300, 100), c: num(fx.c, 0, 300, 100), s: num(fx.s, 0, 300, 100), g: num(fx.g, 0, 100, 0), blur: num(fx.blur, 0, 100, 0) };
    } else if (type === "group") {
      c.children = (Array.isArray(o.children) ? o.children : []).map(function (ch) { return cleanObj(ch, assets, depth + 1, count); }).filter(Boolean);
      if (!c.children.length) return null;
    }
    return c;
  }
  function sanitizeProject(input) {
    var data = input;
    if (typeof input === "string") { try { data = JSON.parse(input); } catch (e) { throw new Error("This is not a valid project file (bad JSON)"); } }
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("This is not a Design Studio project");
    if (data.format !== "s3design") throw new Error("This is not a Design Studio project (.s3design)");
    if (num(data.version, 0, 1e6, 0) > 1) throw new Error("This project was made by a newer version");
    var assets = {}, total = 0, src = data.assets && typeof data.assets === "object" && !Array.isArray(data.assets) ? data.assets : {};
    Object.keys(src).slice(0, 500).forEach(function (k) {
      var v = src[k];
      if (!/^[A-Za-z0-9_-]{1,48}$/.test(k) || typeof v !== "string" || !IMG_URL.test(v)) return;
      total += v.length; if (total > LIMITS.assetBytes * 1.37) throw new Error("Images in this file are too large");
      assets[k] = v;
    });
    var W = num(data.w, 16, 20000, 1080), H = num(data.h, 16, 20000, 1080);
    var doc = newDoc(W, H, str(data.name, 120, "Untitled design").trim() || "Untitled design");
    doc.id = cleanId(data.id); doc.assets = assets;
    if (data.print && typeof data.print === "object") doc.print = { wmm: num(data.print.wmm, 1, 5000, 210), hmm: num(data.print.hmm, 1, 5000, 297) };
    var pages = Array.isArray(data.pages) ? data.pages.slice(0, LIMITS.pages) : [];
    var count = { n: 0 };
    doc.pages = pages.map(function (p) {
      if (!p || typeof p !== "object") return null;
      return { id: cleanId(p.id), bg: fill(p.bg, "#ffffff"), objects: (Array.isArray(p.objects) ? p.objects : []).map(function (o) { return cleanObj(o, assets, 0, count); }).filter(Boolean) };
    }).filter(Boolean);
    if (!doc.pages.length) doc.pages = [newPage()];
    var fonts = Array.isArray(data.fonts) ? data.fonts.slice(0, 40) : [], fbytes = 0;
    doc.fonts = fonts.map(function (f) {
      if (!f || typeof f.data !== "string" || !/^[A-Za-z0-9+/]+=*$/.test(f.data)) return null;
      fbytes += f.data.length; if (fbytes > LIMITS.fontBytes * 1.37) return null;
      return { family: cleanFont(f.family), data: f.data };
    }).filter(Boolean);
    return doc;
  }
  function serialize(doc) { return JSON.stringify(doc); }

  // Stable stringify (for tests / comparison).
  function stable(v) {
    if (Array.isArray(v)) return "[" + v.map(stable).join(",") + "]";
    if (v && typeof v === "object") return "{" + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ":" + stable(v[k]); }).join(",") + "}";
    return JSON.stringify(v);
  }

  DS.core = {
    uid: uid, rotPt: rotPt, center: center, corners: corners, aabb: aabb, unionBox: unionBox, hit: hit, hitTest: hitTest,
    boxesIntersect: boxesIntersect, resizeBox: resizeBox, snapTargets: snapTargets, snapBox: snapBox, snapAngle: snapAngle,
    clone: clone, newDoc: newDoc, newPage: newPage, make: make, find: find, indexOf: indexOf, group: group, ungroup: ungroup,
    scaleProps: scaleProps, scaleGroupChildren: scaleGroupChildren, reorder: reorder, align: align, distribute: distribute,
    resizeDoc: resizeDoc, History: History, isColor: isColor, sanitizeProject: sanitizeProject, serialize: serialize,
    stable: stable, SHAPES: SHAPES, LIMITS: LIMITS
  };
})();
