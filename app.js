/* Design Studio — self-test and demo. The editor itself lives in js/ (core, render, io, editor). */
(function () {
  "use strict";
  var DS = window.DS;

  // A sample "photo" drawn in code (no stock images): a sunset over hills.
  function samplePhoto(w, h) {
    var c = document.createElement("canvas"); c.width = w; c.height = h;
    var x = c.getContext("2d"), g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "#2b1055"); g.addColorStop(0.45, "#d53369"); g.addColorStop(0.75, "#ffb36b"); g.addColorStop(1, "#ffd9a0");
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = "rgba(255,240,200,0.95)"; x.beginPath(); x.arc(w * 0.6, h * 0.55, w * 0.16, 0, Math.PI * 2); x.fill();
    [["#3a1c4a", 0.62, 0.08], ["#24123a", 0.72, 0.12], ["#140a24", 0.84, 0.1]].forEach(function (l, i) {
      x.fillStyle = l[0]; x.beginPath(); x.moveTo(0, h);
      for (var k = 0; k <= 12; k++) x.lineTo(k / 12 * w, h * l[1] - Math.sin(k * 1.3 + i * 2) * h * l[2] * (0.6 + 0.4 * Math.cos(k + i)));
      x.lineTo(w, h); x.closePath(); x.fill();
    });
    x.strokeStyle = "rgba(20,10,36,0.9)"; x.lineWidth = w * 0.012; x.lineCap = "round";
    x.beginPath(); x.moveTo(w * 0.3, h * 0.9); x.lineTo(w * 0.3, h * 0.74); x.stroke();     // a little signpost
    x.beginPath(); x.moveTo(w * 0.22, h * 0.76); x.lineTo(w * 0.38, h * 0.75); x.stroke();
    return c.toDataURL("image/jpeg", 0.9);
  }

  window.S3_DEMO = async function () {
    await DS.ed.ready;
    var tpl = DS.TEMPLATES.filter(function (t) { return t.id === "yt-thumb"; })[0], d = DS.fromTemplate(tpl);
    d.assets.demo = samplePhoto(460, 560);
    var frame = d.pages[0].objects.filter(function (o) { return o.type === "image"; })[0];
    frame.src = "demo";
    d.name = "My first thumbnail";
    DS.ed.openDoc(d, { quiet: true });
    DS.ed.setTab("templates");
    var title = d.pages[0].objects.filter(function (o) { return o.type === "text"; })[0];
    DS.ed.select([title.id]);
    await DS.render.ensureImages(d);
    await new Promise(function (r) { setTimeout(r, 150); });
  };

  window.S3_SELFTEST = async function () {
    var C = DS.core, R = DS.render, IO = DS.io, fails = [];
    function ok(c, m) { if (!c) fails.push(m); }
    function near(a, b, e) { return Math.abs(a - b) <= (e || 1e-6); }

    // 1. scene graph + history: add, move, undo, redo
    var d = C.newDoc(1000, 1000, "t"), H = new C.History();
    H.reset(d);
    var a = C.make("shape", { x: 100, y: 100, w: 200, h: 100 });
    d.pages[0].objects.push(a); H.commit(d);
    d.pages[0].objects[0].x = 300; H.commit(d);
    H.undo(d); ok(d.pages[0].objects[0].x === 100, "undo move");
    H.undo(d); ok(d.pages[0].objects.length === 0, "undo add");
    ok(!H.undo(d), "undo past start");
    H.redo(d); H.redo(d); ok(d.pages[0].objects[0].x === 300, "redo");
    ok(!H.commit(d), "no-op commit ignored");

    // 2. group / ungroup keep world geometry (with the group rotated)
    var p = d.pages[0]; p.objects = [];
    var b1 = C.make("shape", { x: 100, y: 100, w: 100, h: 50, rot: 30 }), b2 = C.make("shape", { x: 400, y: 300, w: 80, h: 80 });
    p.objects.push(b1, b2);
    var c1 = C.corners(b1), g = C.group(p, [b1.id, b2.id]);
    ok(p.objects.length === 1 && g.children.length === 2, "group");
    g.rot = 90;
    var gc = C.center(g), out = C.ungroup(p, g.id);
    ok(p.objects.length === 2, "ungroup count");
    var exp = c1.map(function (q) { return C.rotPt(q.x, q.y, gc.x, gc.y, 90); }), got = C.corners(out[0]);
    ok(exp.every(function (q, i) { return near(q.x, got[i].x) && near(q.y, got[i].y); }), "ungroup keeps rotated geometry");
    C.reorder(p, [out[1].id], "bottom"); ok(p.objects[0].id === out[1].id, "send to back");

    // 3. hit-testing with rotation
    var r = C.make("shape", { x: 100, y: 100, w: 200, h: 50, rot: 90 });     // centre (200,125): covers x 175..225, y 25..225
    ok(C.hit(r, 200, 40), "hit inside rotated box");
    ok(!C.hit(r, 120, 125), "miss outside rotated box");
    ok(C.hitTest([C.make("shape", { x: 0, y: 0, w: 500, h: 500 }), r], 200, 220) === r, "topmost wins");
    var hid = C.make("shape", { x: 0, y: 0, w: 10, h: 10, hidden: true }); ok(C.hitTest([hid], 5, 5) === null, "hidden not hit");

    // 4. resize a rotated object: the opposite edge stays put
    var q = C.make("shape", { x: 0, y: 0, w: 100, h: 50, rot: 90 }), wm = C.rotPt(0, 25, 50, 25, 90);
    var nb = C.resizeBox(q, "e", { x: 50, y: 150 }, false), nw = C.rotPt(nb.x, nb.y + nb.h / 2, nb.x + nb.w / 2, nb.y + nb.h / 2, 90);
    ok(near(nb.w, 175) && near(nb.h, 50) && near(nw.x, wm.x) && near(nw.y, wm.y), "rotated resize keeps anchor");
    var kb = C.resizeBox(C.make("shape", { x: 0, y: 0, w: 100, h: 50 }), "se", { x: 300, y: 60 }, true);
    ok(near(kb.w, 300) && near(kb.h, 150) && near(kb.x, 0), "corner resize keeps ratio");

    // 5. snapping maths
    var t = C.snapTargets({ objects: [] }, 1080, 1080, []);
    var s = C.snapBox({ x: 487, y: 10, w: 100, h: 100 }, t, 5);
    ok(s.dx === 3 && s.dy === 0 && s.guides.length === 1 && s.guides[0].at === 540, "snap to page centre");
    var s2 = C.snapBox({ x: 1, y: 1076, w: 50, h: 2 }, t, 5);
    ok(s2.dx === -1 && s2.dy === 2, "snap to edges");
    var t2 = C.snapTargets({ objects: [C.make("shape", { id: "z1", x: 600, y: 600, w: 100, h: 100 })] }, 1080, 1080, []);
    ok(C.snapBox({ x: 702, y: 300, w: 50, h: 50 }, t2, 5).dx === -2, "snap to another object's edge");
    ok(C.snapAngle(88, false) === 90 && C.snapAngle(37, true) === 30 && C.snapAngle(37.24, false) === 37.2, "angle snap");

    // 6. align + distribute + resize design
    var al = [C.make("shape", { x: 10, y: 0, w: 10, h: 10 }), C.make("shape", { x: 50, y: 40, w: 20, h: 10 }), C.make("shape", { x: 200, y: 0, w: 10, h: 10 })];
    C.distribute(al, "h"); ok(near(al[1].x, 100), "distribute");
    C.align(al, "top", 0, 0); ok(al.every(function (o) { return o.y === 0; }), "align top");
    var rd = C.newDoc(1000, 1000); rd.pages[0].objects.push(C.make("text", { x: 0, y: 0, w: 1000, h: 100, size: 50 }));
    C.resizeDoc(rd, 2000, 500, true);
    ok(rd.w === 2000 && near(rd.pages[0].objects[0].x, 750) && near(rd.pages[0].objects[0].size, 25), "resize design scales content");

    // 7. text layout: wrapping and direction
    var tx = C.make("text", { text: "one two three four five six", size: 20, w: 60 }); R.fitText(tx);
    ok(R.layoutText(tx).lines.length >= 3 && tx.h >= 20 * 1.2 * 3 - 0.01, "text wraps");
    ok(R.textDir({ text: "  مرحبا hello" }) === "rtl" && R.textDir({ text: "Hi مرحبا" }) === "ltr" && R.textDir({ text: "x", dir: "rtl" }) === "rtl", "text direction");

    // 8. export dimensions and pixels
    var ed = C.newDoc(300, 200, "x");
    ed.pages[0].objects.push(C.make("shape", { x: 10, y: 10, w: 50, h: 50, fill: "#ff0000" }));
    var png = await IO.rasterPage(ed, ed.pages[0], { format: "png", scale: 2 }), sz = IO.pngSize(png);
    ok(sz.w === 600 && sz.h === 400, "PNG export size at 2x");
    var cv = R.pageCanvas(ed, ed.pages[0], 2, {}), px = cv.getContext("2d").getImageData(70, 70, 1, 1).data, px2 = cv.getContext("2d").getImageData(300, 300, 1, 1).data;
    ok(px[0] > 250 && px[1] < 5 && px2[0] > 250 && px2[1] > 250, "rendered pixels");
    var tc = R.pageCanvas(ed, ed.pages[0], 1, { transparent: true }); ok(tc.getContext("2d").getImageData(250, 150, 1, 1).data[3] === 0, "transparent background");
    var jpg = await IO.rasterPage(ed, ed.pages[0], { format: "jpg", scale: 0.5, quality: 0.8 });
    ok(jpg[0] === 0xFF && jpg[1] === 0xD8, "JPEG bytes");
    if (window.createImageBitmap) { var bm = await createImageBitmap(new Blob([jpg], { type: "image/jpeg" })); ok(bm.width === 150 && bm.height === 100, "JPEG size at 0.5x"); }
    var pd = C.newDoc(794, 1123, "print"); pd.print = { wmm: 210, hmm: 297 };
    var dpi = IO.pngWithDpi(await IO.rasterPage(pd, pd.pages[0], { format: "png", scale: 0.1 }), 300);
    ok(String.fromCharCode(dpi[37], dpi[38], dpi[39], dpi[40]) === "pHYs", "PNG carries DPI");

    // 9. project save -> open round trip (template with Arabic, gradient, image, two pages)
    var tdoc = DS.fromTemplate(DS.TEMPLATES.filter(function (x) { return x.id === "ar-offer"; })[0]);
    var tiny = document.createElement("canvas"); tiny.width = tiny.height = 2;
    tdoc.assets.a1 = tiny.toDataURL("image/png");
    tdoc.pages.push(C.newPage()); tdoc.pages[1].objects.push(C.make("image", { src: "a1", x: 1, y: 2, w: 30, h: 40, fx: { b: 120, c: 90, s: 100, g: 0, blur: 0 } }));
    tdoc.pages[1].objects.push(C.make("shape", { shape: "star", fill: { t: "lin", a: 45, c: ["#ff0000", "#0000ff"] }, shadow: { x: 1, y: 2, blur: 3, color: "rgba(0,0,0,0.5)" } }));
    var back = IO.openProject(IO.projectJson(tdoc));
    ok(C.stable(back) === C.stable(tdoc), "project round trip is lossless");

    // 10. malicious project files are rejected or neutralised
    var evil = { format: "s3design", version: 1, name: "<img src=x onerror=alert(1)>", w: 1e9, h: "abc",
      assets: { good: tiny.toDataURL("image/png"), svg: "data:image/svg+xml;base64,PHN2Zz4=", js: "javascript:alert(1)", "../x": "data:image/png;base64,AAAA" },
      fonts: [{ family: 'Evil"; } body { x', data: "AAAA" }, { family: "x", data: "not base64!!" }],
      pages: [{ bg: "url(javascript:alert(1))", objects: [
        { type: "script", x: 1 },
        { type: "text", text: "<b>hi</b>", font: 'Arial"; background:url(//evil.example/x)', size: -5, color: "expression(alert(1))", x: "NaN", weight: 950 },
        { type: "image", src: "js", x: 0, y: 0, w: 10, h: 10 }, { type: "image", src: "svg" }, { type: "image", src: "good" },
        JSON.parse('{"type":"shape","__proto__":{"polluted":1},"shape":"<svg>","fill":{"t":"lin","c":["red","#fff"]},"onclick":"alert(1)"}'),
        { type: "group", children: [{ type: "group", children: [{ type: "group", children: [{ type: "group", children: [{ type: "group", children: [{ type: "group", children: [{ type: "group", children: [{ type: "shape" }] }] }] }] }] }] }] }
      ] }] };
    var sd = C.sanitizeProject(JSON.stringify(evil)), ob = sd.pages[0].objects;
    ok(sd.w === 20000 && sd.h === 1080, "numbers clamped");
    ok(Object.keys(sd.assets).join() === "good", "only raster data: images kept");
    ok(sd.fonts.length === 1 && !/["{};]/.test(sd.fonts[0].family), "font names cleaned");
    ok(sd.pages[0].bg === "#ffffff", "bad background dropped");
    ok(ob.length === 5, "unknown types and over-deep groups dropped");
    ok(ob[0].text === "<b>hi</b>" && !/["();:\/]/.test(ob[0].font) && ob[0].size === 1 && ob[0].color === "#111111" && ob[0].x === 0 && ob[0].weight === 900, "text fields sanitised");
    ok(ob[1].src === "" && ob[2].src === "" && ob[3].src === "good", "image sources checked");
    ok(ob[4].shape === "rect" && ob[4].fill === "#cccccc" && !("onclick" in ob[4]) && ({}).polluted === undefined, "shape fields whitelisted");
    var span = S3.h("span", { text: ob[0].text }); ok(span.innerHTML === "&lt;b&gt;hi&lt;/b&gt;", "text shown as text, never HTML");
    ["not json", "[]", "{}", '{"format":"other"}', '{"format":"s3design","version":99}'].forEach(function (bad) {
      var threw = false; try { C.sanitizeProject(bad); } catch (e) { threw = true; } ok(threw, "rejects " + bad);
    });

    // 11. PDF: page count and size
    var pdoc = C.newDoc(794, 1123, "pdf"); pdoc.print = { wmm: 210, hmm: 297 }; pdoc.pages.push(C.newPage());
    pdoc.pages[0].objects.push(C.make("text", { text: "Hello PDF", x: 100, y: 100, w: 400, size: 40 })); R.fitAll(pdoc);
    var bytes = await IO.pdfBytes(pdoc, pdoc.pages, { scale: 0.5, quality: 0.8 });
    var L = await PDFLib.PDFDocument.load(bytes), ps = L.getPage(0).getSize();
    ok(L.getPageCount() === 2 && near(ps.width, 595.28, 0.05) && near(ps.height, 841.89, 0.05), "PDF A4 two pages");
    var sdoc = C.newDoc(1080, 1080, "s"), sb = await IO.pdfBytes(sdoc, sdoc.pages, { scale: 0.2, lossless: true });
    var sp = (await PDFLib.PDFDocument.load(sb)).getPage(0).getSize(); ok(near(sp.width, 810, 0.01), "PDF screen size in points");

    // 12. every template builds and survives the validator
    ok(DS.TEMPLATES.length >= 12, "at least 12 templates");
    DS.TEMPLATES.forEach(function (tp) {
      var td = DS.fromTemplate(tp);
      ok(td.pages[0].objects.length > 0 && C.sanitizeProject(IO.projectJson(td)).pages[0].objects.length === td.pages[0].objects.length, "template " + tp.id);
    });
    ok(Object.keys(DS.ICONS).every(function (k) { try { return !!new Path2D(DS.ICONS[k]); } catch (e) { return false; } }), "icons parse");

    return fails.length ? fails : true;
  };
})();
