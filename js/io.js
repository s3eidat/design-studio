/* Design Studio I/O: PNG/JPG/PDF/zip export, .s3design project files, IndexedDB autosave, fonts.
   Nothing here touches the network: files are made in memory and handed to the browser as downloads. */
(function () {
  "use strict";
  var DS = window.DS = window.DS || {};

  // ---------- small helpers ----------
  function slug(s) { return (String(s || "design").toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)) || "design"; }
  function toBlob(canvas, type, q) {
    return new Promise(function (res, rej) { canvas.toBlob(function (b) { if (b) res(b); else rej(new Error("The browser could not encode this image (too large?)")); }, type, q); });
  }
  function blobBytes(b) { return b.arrayBuffer().then(function (ab) { return new Uint8Array(ab); }); }
  function b64(bytes) {
    var s = "", CH = 0x8000;
    for (var i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  }
  function unb64(str) { var s = atob(str), out = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out; }
  // Write a pHYs chunk so print apps know the intended DPI.
  function pngWithDpi(bytes, dpi) {
    if (!dpi || bytes.length < 33 || !window.S3) return bytes;
    var ppm = Math.round(dpi / 0.0254), chunk = new Uint8Array(21), dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4); dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
    dv.setUint32(17, S3.crc32(chunk.subarray(4, 17)));
    var out = new Uint8Array(bytes.length + 21);
    out.set(bytes.subarray(0, 33)); out.set(chunk, 33); out.set(bytes.subarray(33), 54);
    return out;
  }
  function pngSize(bytes) { var dv = new DataView(bytes.buffer, bytes.byteOffset); return { w: dv.getUint32(16), h: dv.getUint32(20) }; }

  // ---------- raster export ----------
  // opts: {format: "png"|"jpg", scale, quality, transparent}
  function exportSize(doc, scale) { return { w: Math.max(1, Math.round(doc.w * scale)), h: Math.max(1, Math.round(doc.h * scale)) }; }
  function rasterPage(doc, page, opts) {
    var jpg = opts.format === "jpg";
    var c = DS.render.pageCanvas(doc, page, opts.scale, { transparent: !jpg && opts.transparent, jpeg: jpg });
    return toBlob(c, jpg ? "image/jpeg" : "image/png", jpg ? opts.quality : undefined).then(function (b) {
      if (jpg) return blobBytes(b);
      return blobBytes(b).then(function (bytes) { return doc.print ? pngWithDpi(bytes, Math.round(96 * opts.scale)) : bytes; });
    });
  }
  function zipFiles(files) {
    if (window.JSZip) {
      var z = new JSZip();
      files.forEach(function (f) { z.file(f.name, f.data, { binary: true }); });
      return z.generateAsync({ type: "blob", mimeType: "application/zip" });
    }
    return Promise.resolve(S3.zip(files));
  }

  // ---------- PDF (pdf-lib): one high-resolution image per page + invisible, selectable Latin text ----------
  var WIN_ANSI = /^[\x20-\x7E -ÿ–—‘’“”•…€]*$/;
  function pageSizePt(doc) {
    return doc.print ? { w: doc.print.wmm / 25.4 * 72, h: doc.print.hmm / 25.4 * 72 } : { w: doc.w * 0.75, h: doc.h * 0.75 };
  }
  function pdfBytes(doc, pages, opts) {
    var L = window.PDFLib;
    if (!L) return Promise.reject(new Error("PDF library failed to load"));
    var size = pageSizePt(doc), k = size.w / doc.w;
    return L.PDFDocument.create().then(function (pdf) {
      pdf.setTitle(doc.name); pdf.setCreator("S3eidat Design Studio"); pdf.setProducer("S3eidat Design Studio (pdf-lib)");
      return pdf.embedFont(L.StandardFonts.Helvetica).then(function (font) {
        var chain = Promise.resolve();
        pages.forEach(function (page) {
          chain = chain.then(function () {
            var c = DS.render.pageCanvas(doc, page, opts.scale, {});
            var lossless = !!opts.lossless;
            return toBlob(c, lossless ? "image/png" : "image/jpeg", opts.quality || 0.92).then(blobBytes).then(function (bytes) {
              return lossless ? pdf.embedPng(bytes) : pdf.embedJpg(bytes);
            }).then(function (img) {
              var pg = pdf.addPage([size.w, size.h]);
              pg.drawImage(img, { x: 0, y: 0, width: size.w, height: size.h });
              if (opts.textLayer !== false) addTextLayer(pg, page, font, k, size.h, L);
              c.width = c.height = 1;
            });
          });
        });
        return chain.then(function () { return pdf.save(); });
      });
    });
  }
  function addTextLayer(pg, page, font, k, H, L) {
    page.objects.forEach(function (o) {
      if (o.type !== "text" || o.hidden || Math.abs(o.rot || 0) > 0.01 || DS.render.textDir(o) === "rtl") return;
      var lay = DS.render.layoutText(o), top = o.y + (o.h - lay.h) / 2, size = o.size * k;
      lay.lines.forEach(function (ln, i) {
        if (!ln.s || !WIN_ANSI.test(ln.s)) return;
        try {
          var tw = font.widthOfTextAtSize(ln.s, size), w = ln.w * k;
          var x = o.align === "left" ? o.x * k : o.align === "right" ? (o.x + o.w) * k - w : (o.x + o.w / 2) * k - w / 2;
          var y = H - (top + lay.lineH * (i + 0.5)) * k - size * 0.35;
          pg.drawText(ln.s, { x: x, y: y, size: size * (tw > 0 ? Math.min(3, Math.max(0.3, w / tw)) : 1), font: font, opacity: 0 });
        } catch (e) { /* character the standard font cannot encode: the image still shows it */ }
      });
    });
  }

  // ---------- project files ----------
  function projectJson(doc) { return JSON.stringify(doc); }
  function openProject(text) { var doc = DS.core.sanitizeProject(text); DS.render.fitAll(doc); return doc; }

  // ---------- IndexedDB (designs + uploaded fonts live in this browser only) ----------
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error("No IndexedDB"));
      var rq = indexedDB.open("s3-design-studio", 1);
      rq.onupgradeneeded = function () {
        var d = rq.result;
        if (!d.objectStoreNames.contains("designs")) d.createObjectStore("designs", { keyPath: "id" });
        if (!d.objectStoreNames.contains("fonts")) d.createObjectStore("fonts", { keyPath: "family" });
      };
      rq.onsuccess = function () { res(rq.result); };
      rq.onerror = function () { rej(rq.error); };
    });
    dbp.catch(function () { dbp = null; });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), s = t.objectStore(store), out = fn(s);
        t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error || new Error("Storage aborted")); };
      });
    });
  }
  var store = {
    put: function (rec) { return tx("designs", "readwrite", function (s) { s.put(rec); }); },
    get: function (id) { return tx("designs", "readonly", function (s) { return s.get(id); }); },
    del: function (id) { return tx("designs", "readwrite", function (s) { s.delete(id); }); },
    list: function () {
      return tx("designs", "readonly", function (s) { return s.getAll(); }).then(function (all) {
        return (all || []).map(function (r) { return { id: r.id, name: r.name, updated: r.updated, w: r.w, h: r.h, thumb: r.thumb, pages: r.pages }; })
          .sort(function (a, b) { return b.updated - a.updated; });
      });
    },
    putFont: function (f) { return tx("fonts", "readwrite", function (s) { s.put(f); }); },
    fonts: function () { return tx("fonts", "readonly", function (s) { return s.getAll(); }); }
  };

  // ---------- fonts ----------
  var CANDIDATES = ["Inter", "Arial", "Helvetica", "Helvetica Neue", "Segoe UI", "Roboto", "Open Sans", "Noto Sans", "Ubuntu", "Cantarell",
    "DejaVu Sans", "Liberation Sans", "Verdana", "Tahoma", "Trebuchet MS", "Calibri", "Candara", "Corbel", "Franklin Gothic Medium",
    "Gill Sans", "Futura", "Avenir", "Avenir Next", "Optima", "Century Gothic", "Lucida Sans", "Arial Black", "Impact", "Bahnschrift",
    "Georgia", "Times New Roman", "Times", "Cambria", "Constantia", "Palatino Linotype", "Palatino", "Book Antiqua", "Garamond",
    "Baskerville", "Didot", "Hoefler Text", "Rockwell", "Noto Serif", "DejaVu Serif", "Liberation Serif",
    "Courier New", "Consolas", "Lucida Console", "Menlo", "Monaco", "DejaVu Sans Mono", "Cascadia Code",
    "Comic Sans MS", "Segoe Print", "Segoe Script", "Brush Script MT", "Lucida Handwriting", "Bradley Hand", "Chalkboard", "Marker Felt",
    "Papyrus", "Copperplate", "American Typewriter",
    "Noto Sans Arabic", "Noto Naskh Arabic", "Noto Kufi Arabic", "Arabic Typesetting", "Traditional Arabic", "Simplified Arabic",
    "Sakkal Majalla", "Aldhabi", "Andalus", "Urdu Typesetting", "Geeza Pro", "Al Nile", "Baghdad", "Damascus", "Al Bayan", "Diwan Kufi",
    "Amiri", "Cairo", "Tajawal", "Scheherazade New", "Droid Arabic Naskh", "Dubai"];
  function detectFonts() {
    var c = document.createElement("canvas").getContext("2d"), probe = "mmmmmmmmmmlli WQ@#0 أبجد هوز";
    function w(f) { c.font = "64px " + f; return c.measureText(probe).width; }
    var base = { m: w("monospace"), s: w("serif"), ss: w("sans-serif") };
    return CANDIDATES.filter(function (f) {
      if (f === "Inter") return true;
      var q = '"' + f + '", ';
      return w(q + "monospace") !== base.m || w(q + "serif") !== base.s || w(q + "sans-serif") !== base.ss;
    });
  }
  function cleanFamily(name) { return String(name || "").replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/["'`;:{}()<>\\\/@!]/g, "").replace(/\s+/g, " ").trim().slice(0, 60) || "My font"; }
  function registerFont(family, bytes) {
    if (typeof FontFace !== "function") return Promise.reject(new Error("This browser cannot load font files"));
    var ff = new FontFace(family, bytes);
    return ff.load().then(function (f) { document.fonts.add(f); DS.render.clearCache(); return family; });
  }
  function registerDocFonts(doc) {
    return Promise.all((doc.fonts || []).map(function (f) { return registerFont(f.family, unb64(f.data)).catch(function () { return null; }); }));
  }

  DS.io = {
    slug: slug, toBlob: toBlob, blobBytes: blobBytes, b64: b64, unb64: unb64, pngSize: pngSize, pngWithDpi: pngWithDpi,
    exportSize: exportSize, rasterPage: rasterPage, zipFiles: zipFiles, pdfBytes: pdfBytes, pageSizePt: pageSizePt,
    projectJson: projectJson, openProject: openProject, store: store, detectFonts: detectFonts, cleanFamily: cleanFamily,
    registerFont: registerFont, registerDocFonts: registerDocFonts
  };
})();
