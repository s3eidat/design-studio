/* Design Studio starter templates. All original layouts made for this project; sample names, places
   and numbers are fictional placeholder copy. Text heights are computed when a template is opened. */
(function () {
  "use strict";
  var DS = window.DS = window.DS || {};
  function lin(a, c1, c2) { return { t: "lin", a: a, c: [c1, c2] }; }
  // short builders: t=text, r=rect, e=ellipse, s=shape, i=icon, l=line, im=image frame
  function t(text, x, y, w, size, o) { o = o || {}; o.text = text; o.x = x; o.y = y; o.w = w; o.size = size; o.type = "text"; if (o.weight == null) o.weight = 400; return o; }
  function r(x, y, w, h, fill, o) { o = o || {}; o.type = "shape"; o.shape = "rect"; o.x = x; o.y = y; o.w = w; o.h = h; o.fill = fill; return o; }
  function e(x, y, w, h, fill, o) { o = r(x, y, w, h, fill, o); o.shape = "ellipse"; return o; }
  function s(shape, x, y, w, h, fill, o) { o = r(x, y, w, h, fill, o); o.shape = shape; return o; }
  function i(icon, x, y, w, color, o) { o = o || {}; o.type = "icon"; o.icon = icon; o.x = x; o.y = y; o.w = w; o.h = o.h || w; o.color = color; return o; }
  function l(x, y, w, stroke, h, o) { o = o || {}; o.type = "line"; o.x = x; o.y = y; o.w = w; o.h = h || 2; o.stroke = stroke; return o; }
  function im(x, y, w, h, o) { o = o || {}; o.type = "image"; o.x = x; o.y = y; o.w = w; o.h = h; o.src = ""; return o; }
  var L = { align: "left" };
  function A(o, extra) { var k, v = {}; for (k in L) v[k] = L[k]; for (k in extra || {}) v[k] = extra[k]; for (k in o || {}) v[k] = o[k]; return v; }
  var GEO = "Georgia";

  DS.TEMPLATES = [
    { id: "grand-opening", name: "Grand opening", size: "ig-post", pages: [{ bg: lin(135, "#0f3d3e", "#081c2c"), objects: [
      e(640, -180, 620, 620, "#3dd6d0", { op: 0.18 }), e(-160, 700, 520, 520, "#f5b971", { op: 0.16 }),
      r(90, 90, 900, 900, "", { stroke: "#3dd6d0", strokeW: 3, radius: 36, op: 0.5 }),
      t("NOW OPEN", 140, 190, 800, 34, A({ weight: 600, ls: 12, color: "#3dd6d0" })),
      t("Grand\nOpening", 140, 250, 800, 150, A({ weight: 900, color: "#ffffff", lh: 1 })),
      r(140, 600, 120, 8, "#f5b971", { radius: 4 }),
      t("Join us for coffee, music and 20% off everything this weekend.", 140, 640, 620, 36, A({ color: "#cfe9e7", lh: 1.35 })),
      r(140, 820, 360, 84, "#f5b971", { radius: 42 }),
      t("SAT 14 NOV · 10 AM", 140, 845, 360, 28, { weight: 700, color: "#081c2c" }),
      i("sparkle", 840, 200, 120, "#f5b971", { style: "fill" }), i("sparkle", 790, 350, 50, "#3dd6d0", { style: "fill" })
    ] }] },

    { id: "quote", name: "Quote card", size: "ig-post", pages: [{ bg: "#f4efe6", objects: [
      r(0, 0, 1080, 24, "#c4572f"),
      i("quote", 130, 160, 150, "#c4572f", { style: "fill" }),
      t("Simplicity is the soul of a good design. Remove until it breaks, then add one thing back.", 140, 350, 800, 58,
        A({ font: GEO, italic: true, color: "#2b2420", lh: 1.3 })),
      l(140, 800, 90, "#c4572f", 4),
      t("Sara K., studio founder", 140, 830, 700, 32, A({ weight: 600, color: "#2b2420" })),
      t("@yourhandle", 140, 940, 800, 26, A({ weight: 500, color: "#8a7f76" }))
    ] }] },

    { id: "flash-sale", name: "Flash sale", size: "ig-post", pages: [{ bg: "#ffd23f", objects: [
      s("star", 540, 110, 500, 500, "#ff5a36", { rot: 12 }),
      t("50%", 600, 280, 380, 120, { weight: 900, color: "#ffffff", rot: 12 }),
      t("OFF", 600, 412, 380, 60, { weight: 800, color: "#ffffff", rot: 12 }),
      t("FLASH\nSALE", 90, 120, 520, 140, A({ weight: 900, color: "#151515", lh: 0.95 })),
      t("Every item in store. Today only.", 90, 440, 440, 34, A({ weight: 500, color: "#151515", lh: 1.3 })),
      r(90, 640, 900, 260, "#151515", { radius: 28 }),
      t("Use code", 150, 685, 400, 30, A({ weight: 600, color: "#ffd23f" })),
      t("SUMMER50", 150, 735, 640, 96, A({ weight: 900, color: "#ffffff", ls: 4 })),
      i("cart", 830, 715, 110, "#ffd23f"),
      t("yourshop.com", 90, 950, 900, 30, { weight: 600, color: "#151515" })
    ] }] },

    { id: "event-story", name: "Event story", size: "story", pages: [{ bg: lin(160, "#5b2a86", "#e0457b"), objects: [
      e(-200, -200, 800, 800, "#ffffff", { op: 0.08 }), e(600, 1400, 700, 700, "#ffffff", { op: 0.08 }),
      i("music", 440, 260, 200, "#ffffff", { sw: 1.5 }),
      t("LIVE MUSIC", 90, 540, 900, 64, { weight: 600, ls: 14, color: "#ffd6e5" }),
      t("Night at\nthe Garden", 90, 640, 900, 150, { weight: 900, lh: 1, color: "#ffffff" }),
      r(140, 1060, 800, 420, "#ffffff", { radius: 40, op: 0.96, shadow: { x: 0, y: 24, blur: 60, color: "rgba(40,0,60,0.35)" } }),
      i("calendar", 220, 1130, 70, "#5b2a86"), t("Friday, 20 November", 320, 1140, 580, 44, A({ weight: 700, color: "#2a1340" })),
      i("clock", 220, 1240, 70, "#5b2a86"), t("8:00 PM until late", 320, 1250, 580, 44, A({ weight: 700, color: "#2a1340" })),
      i("pin", 220, 1350, 70, "#5b2a86"), t("Rooftop garden, City Centre", 320, 1360, 580, 40, A({ weight: 500, color: "#2a1340" })),
      t("Free entry · Bring a friend", 90, 1620, 900, 44, { weight: 600, color: "#ffffff" })
    ] }] },

    { id: "ar-offer", name: "Ramadan offer (Arabic)", size: "story", pages: [{ bg: lin(180, "#0b3d2e", "#06261c"), objects: [
      i("octagram", -120, -120, 520, "#d4af37", { op: 0.15, sw: 1 }), i("octagram", 760, 1560, 460, "#d4af37", { op: 0.12, sw: 1 }),
      i("lantern", 400, 230, 280, "#d4af37", { sw: 1.4 }),
      i("moon", 770, 190, 130, "#f3e3a3", { style: "fill" }),
      t("عرض رمضان", 90, 600, 900, 140, { weight: 800, color: "#f3e3a3", dir: "rtl" }),
      t("خصم ٣٠٪ على جميع المنتجات", 90, 810, 900, 64, { weight: 700, color: "#ffffff", dir: "rtl" }),
      r(290, 1000, 500, 4, "#d4af37"),
      t("من ١ إلى ١٥ رمضان", 90, 1050, 900, 52, { weight: 500, color: "#cfe3d8", dir: "rtl" }),
      r(290, 1400, 500, 120, "#d4af37", { radius: 60 }),
      t("تسوّق الآن", 290, 1425, 500, 54, { weight: 800, color: "#06261c", dir: "rtl" }),
      t("متجرك · yourshop.com", 90, 1700, 900, 36, { color: "#9fc4b4", dir: "rtl" })
    ] }] },

    { id: "workshop", name: "Workshop flyer", size: "a4", pages: [{ bg: "#ffffff", objects: [
      r(0, 0, 794, 430, lin(135, "#1d4ed8", "#0e9f9a")), e(520, -120, 420, 420, "#ffffff", { op: 0.1 }),
      t("FREE WORKSHOP", 60, 70, 600, 22, A({ weight: 700, ls: 6, color: "#bfe9ff" })),
      t("Learn to design\nyour own brand", 60, 112, 680, 64, A({ weight: 900, lh: 1.05, color: "#ffffff" })),
      t("A hands-on afternoon for small business owners. Bring a laptop and leave with a logo, colours and a social post kit.", 60, 290, 600, 19, A({ lh: 1.45, color: "#e6f4ff" })),
      t("What you'll learn", 60, 480, 680, 30, A({ weight: 800, color: "#0f172a" })),
      i("check-circle", 60, 545, 34, "#0e9f9a"), t("Picking colours and fonts that work together", 112, 548, 620, 22, A({ weight: 600, color: "#1e293b" })),
      i("check-circle", 60, 615, 34, "#0e9f9a"), t("Making a simple logo you can reuse everywhere", 112, 618, 620, 22, A({ weight: 600, color: "#1e293b" })),
      i("check-circle", 60, 685, 34, "#0e9f9a"), t("Designing posts, flyers and cards in minutes", 112, 688, 620, 22, A({ weight: 600, color: "#1e293b" })),
      r(60, 790, 674, 160, "#f1f5f9", { radius: 18 }),
      i("calendar", 95, 828, 34, "#1d4ed8"), t("Saturday 5 December, 2 to 5 PM", 147, 831, 560, 22, A({ weight: 700, color: "#0f172a" })),
      i("pin", 95, 888, 34, "#1d4ed8"), t("Community Hall, Main Street", 147, 891, 560, 22, A({ weight: 700, color: "#0f172a" })),
      t("Book your seat: hello@example.com · +1 555 0100", 60, 1010, 674, 18, { weight: 500, color: "#475569" }),
      r(0, 1103, 794, 20, lin(90, "#1d4ed8", "#0e9f9a"))
    ] }] },

    { id: "cv", name: "Modern CV", size: "a4", pages: [{ bg: "#ffffff", objects: [
      r(0, 0, 270, 1123, "#1f2937"),
      im(60, 60, 150, 150, { radius: 75 }),
      t("Contact", 40, 250, 200, 15, A({ weight: 700, ls: 3, upper: true, color: "#9ca3af" })),
      i("phone", 40, 290, 18, "#5eead4"), t("+1 555 0100", 68, 290, 190, 13, A({ color: "#e5e7eb" })),
      i("mail", 40, 322, 18, "#5eead4"), t("layla@example.com", 68, 322, 190, 13, A({ color: "#e5e7eb" })),
      i("pin", 40, 354, 18, "#5eead4"), t("Amman, Jordan", 68, 354, 190, 13, A({ color: "#e5e7eb" })),
      i("globe", 40, 386, 18, "#5eead4"), t("laylahaddad.design", 68, 386, 190, 13, A({ color: "#e5e7eb" })),
      t("Skills", 40, 450, 200, 15, A({ weight: 700, ls: 3, upper: true, color: "#9ca3af" })),
      t("Brand identity\nTypography\nLayout and print\nArabic and English design\nIllustration", 40, 482, 200, 13, A({ lh: 1.9, color: "#e5e7eb" })),
      t("Languages", 40, 660, 200, 15, A({ weight: 700, ls: 3, upper: true, color: "#9ca3af" })),
      t("Arabic (native)\nEnglish (fluent)", 40, 692, 200, 13, A({ lh: 1.9, color: "#e5e7eb" })),
      t("Layla Haddad", 310, 60, 440, 44, A({ weight: 800, color: "#111827" })),
      t("Graphic Designer", 310, 118, 440, 20, A({ weight: 500, color: "#0e9f9a" })),
      t("Profile", 310, 190, 440, 15, A({ weight: 700, ls: 3, upper: true, color: "#6b7280" })), l(310, 218, 444, "#e5e7eb", 2),
      t("Designer with six years of experience building brands for cafés, clinics and start-ups. I care about clear layouts, readable type and files that print right the first time.", 310, 232, 444, 14, A({ lh: 1.6, color: "#374151" })),
      t("Experience", 310, 360, 440, 15, A({ weight: 700, ls: 3, upper: true, color: "#6b7280" })), l(310, 388, 444, "#e5e7eb", 2),
      t("Senior Designer, Studio North", 310, 405, 330, 16, A({ weight: 700, color: "#111827" })), t("2022 to now", 600, 407, 154, 13, { align: "right", color: "#6b7280" }),
      t("Led rebrands for twelve local businesses and set up the studio's print checklist.", 310, 432, 444, 13.5, A({ lh: 1.55, color: "#374151" })),
      t("Designer, Bright Media", 310, 500, 330, 16, A({ weight: 700, color: "#111827" })), t("2019 to 2022", 600, 502, 154, 13, { align: "right", color: "#6b7280" }),
      t("Social media campaigns in Arabic and English for retail and healthcare clients.", 310, 527, 444, 13.5, A({ lh: 1.55, color: "#374151" })),
      t("Junior Designer, Paper Lane", 310, 595, 330, 16, A({ weight: 700, color: "#111827" })), t("2018 to 2019", 600, 597, 154, 13, { align: "right", color: "#6b7280" }),
      t("Menus, packaging and signage for a chain of four restaurants.", 310, 622, 444, 13.5, A({ lh: 1.55, color: "#374151" })),
      t("Education", 310, 700, 440, 15, A({ weight: 700, ls: 3, upper: true, color: "#6b7280" })), l(310, 728, 444, "#e5e7eb", 2),
      t("BA Visual Communication", 310, 745, 330, 16, A({ weight: 700, color: "#111827" })), t("2014 to 2018", 600, 747, 154, 13, { align: "right", color: "#6b7280" }),
      t("City University. Graduation project: a bilingual wayfinding system.", 310, 772, 444, 13.5, A({ lh: 1.55, color: "#374151" }))
    ] }] },

    { id: "yt-thumb", name: "YouTube thumbnail", size: "yt-thumb", pages: [{ bg: lin(120, "#ff7a18", "#d7263d"), objects: [
      im(760, 80, 460, 560, { radius: 30, shadow: { x: 0, y: 20, blur: 50, color: "rgba(0,0,0,0.35)" } }),
      t("I TRIED IT\nFOR 30 DAYS", 60, 120, 700, 96, A({ weight: 900, color: "#ffffff", lh: 0.98, strokeW: 7, stroke: "#1a1a1a" })),
      r(60, 470, 430, 90, "#ffe14d", { radius: 16, rot: -3 }),
      t("HONEST RESULTS", 60, 491, 430, 40, { weight: 900, color: "#1a1a1a", rot: -3 }),
      i("arrow-right", 540, 460, 160, "#ffe14d", { sw: 3, rot: -15 })
    ] }] },

    { id: "bcard", name: "Business card (2 sides)", size: "bcard", pages: [
      { bg: "#111827", objects: [
        r(0, 0, 8, 208, "#3dd6d0"),
        t("Sami Nasser", 28, 40, 270, 22, A({ weight: 800, color: "#ffffff" })),
        t("Product Designer", 28, 70, 270, 11, A({ weight: 500, ls: 1, color: "#3dd6d0" })),
        l(28, 102, 40, "#374151", 1.5),
        i("phone", 28, 121, 11, "#9ca3af"), t("+1 555 0100", 46, 119, 250, 10, A({ color: "#e5e7eb" })),
        i("mail", 28, 141, 11, "#9ca3af"), t("sami@example.com", 46, 139, 250, 10, A({ color: "#e5e7eb" })),
        i("globe", 28, 161, 11, "#9ca3af"), t("example.com", 46, 159, 250, 10, A({ color: "#e5e7eb" }))
      ] },
      { bg: lin(135, "#3dd6d0", "#0e9f9a"), objects: [
        e(130, 52, 62, 62, "#111827"),
        t("S", 130, 65, 62, 30, { weight: 900, color: "#3dd6d0" }),
        t("SAMI NASSER STUDIO", 20, 136, 281, 10, { weight: 700, ls: 3, color: "#111827" })
      ] }
    ] },

    { id: "li-banner", name: "LinkedIn banner", size: "li-banner", pages: [{ bg: lin(90, "#0f172a", "#1e3a8a"), objects: (function () {
      var out = [];
      for (var x = 0; x < 6; x++) for (var y = 0; y < 5; y++) out.push(e(1190 + x * 54, 70 + y * 54, 10, 10, "#60a5fa", { op: 0.25 + 0.1 * ((x + y) % 4) }));
      return out.concat([
        r(420, 92, 60, 6, "#60a5fa", { radius: 3 }),
        t("Helping clinics grow with simple, honest marketing", 420, 120, 700, 40, A({ weight: 800, color: "#ffffff", lh: 1.15 })),
        t("Strategy · Design · Content", 420, 250, 700, 22, A({ weight: 500, color: "#93c5fd" }))
      ]);
    })() }] },

    { id: "slides", name: "Presentation (2 slides)", size: "slide", pages: [
      { bg: "#0d0f12", objects: [
        e(1450, -250, 760, 760, lin(135, "#3dd6d0", "#1d4ed8"), { op: 0.9 }),
        r(0, 0, 24, 1080, "#3dd6d0"),
        t("Quarterly Review", 160, 380, 1400, 120, A({ weight: 900, color: "#ffffff" })),
        t("Q3 · Results and next steps", 160, 540, 1400, 44, A({ color: "#a5adb9" })),
        t("Your Company", 160, 940, 900, 30, A({ weight: 600, color: "#6d7581" }))
      ] },
      { bg: "#ffffff", objects: [
        t("Three things we learned", 160, 120, 1600, 72, A({ weight: 800, color: "#0d0f12" })),
        r(160, 320, 480, 560, "#f1f3f6", { radius: 28 }), r(720, 320, 480, 560, "#f1f3f6", { radius: 28 }), r(1280, 320, 480, 560, "#f1f3f6", { radius: 28 }),
        t("01", 210, 370, 380, 96, A({ weight: 900, color: "#0e9f9a" })), t("02", 770, 370, 380, 96, A({ weight: 900, color: "#0e9f9a" })), t("03", 1330, 370, 380, 96, A({ weight: 900, color: "#0e9f9a" })),
        t("Customers want speed", 210, 520, 380, 40, A({ weight: 800, color: "#0d0f12", lh: 1.15 })),
        t("Simple beats clever", 770, 520, 380, 40, A({ weight: 800, color: "#0d0f12", lh: 1.15 })),
        t("Ask before building", 1330, 520, 380, 40, A({ weight: 800, color: "#0d0f12", lh: 1.15 })),
        t("Faster replies did more for reviews than any new feature.", 210, 640, 380, 28, A({ lh: 1.45, color: "#4f5866" })),
        t("The plain landing page beat the animated one.", 770, 640, 380, 28, A({ lh: 1.45, color: "#4f5866" })),
        t("Two short calls saved a month of work on the wrong thing.", 1330, 640, 380, 28, A({ lh: 1.45, color: "#4f5866" }))
      ] }
    ] },

    { id: "certificate", name: "Certificate", size: "a4-land", pages: [{ bg: "#fffdf7", objects: [
      r(30, 30, 1063, 734, "", { stroke: "#b08d3c", strokeW: 6 }), r(52, 52, 1019, 690, "", { stroke: "#b08d3c", strokeW: 1.5 }),
      i("award", 511, 90, 100, "#b08d3c", { sw: 1.5 }),
      t("CERTIFICATE", 100, 210, 923, 64, { font: GEO, weight: 700, ls: 10, color: "#2b2a28" }),
      t("OF ACHIEVEMENT", 100, 292, 923, 24, { weight: 600, ls: 8, color: "#b08d3c" }),
      t("This certificate is proudly presented to", 100, 360, 923, 22, { font: GEO, italic: true, color: "#57534e" }),
      t("Noor Al-Khatib", 100, 400, 923, 72, { font: GEO, italic: true, weight: 700, color: "#1c1917" }),
      l(311, 505, 500, "#b08d3c", 1.5),
      t("for completing the Design Foundations course with distinction.", 150, 525, 823, 22, { lh: 1.4, color: "#57534e" }),
      l(200, 660, 250, "#57534e", 1.5), t("Course Director", 200, 672, 250, 16, { color: "#57534e" }),
      l(673, 660, 250, "#57534e", 1.5), t("Date", 673, 672, 250, 16, { color: "#57534e" })
    ] }] },

    { id: "menu", name: "Restaurant menu", size: "a4", pages: [{ bg: "#1b1a17", objects: (function () {
      var o = [
        t("MENU", 60, 60, 674, 96, { font: GEO, weight: 700, ls: 18, color: "#e9c46a" }),
        t("Fresh · Local · Seasonal", 60, 180, 674, 18, { ls: 4, color: "#bdb5a6" }),
        l(347, 228, 100, "#e9c46a", 2)
      ];
      function sec(title, y, items) {
        o.push(t(title, 80, y, 634, 30, A({ font: GEO, italic: true, color: "#e9c46a" })));
        items.forEach(function (it, k) {
          var yy = y + 48 + k * 74;
          o.push(t(it[0], 80, yy, 520, 19, A({ weight: 600, color: "#f5f0e6" })));
          o.push(t(it[1], 554, yy, 160, 19, { align: "right", weight: 700, color: "#e9c46a" }));
          o.push(t(it[2], 80, yy + 28, 520, 14, A({ color: "#a8a091" })));
        });
      }
      sec("Starters", 270, [["Lentil soup", "4.50", "Red lentils, cumin, lemon"], ["Fattoush", "5.00", "Crisp bread, sumac, garden greens"], ["Hummus plate", "4.00", "Olive oil, warm pita"]]);
      sec("Mains", 545, [["Grilled chicken", "11.00", "Garlic sauce, fries, pickles"], ["Maqluba", "12.50", "Rice, aubergine, toasted nuts"], ["Falafel wrap", "7.00", "Tahini, tomato, mint"]]);
      sec("Desserts", 820, [["Knafeh", "5.50", "Warm cheese, syrup, pistachio"], ["Rice pudding", "3.50", "Rose water, cinnamon"]]);
      o.push(t("Open daily 12 to 11 PM · +1 555 0100", 60, 1060, 674, 14, { color: "#7d7568" }));
      return o;
    })() }] },

    { id: "invite", name: "Birthday invitation", size: "invite", pages: [{ bg: "#fff4f0", objects: [
      e(-80, -80, 260, 260, "#ffd1dc"), e(330, 540, 240, 240, "#cdeffd"), e(380, 40, 50, 50, "#ffe08a"), e(40, 600, 30, 30, "#ffe08a"),
      i("cake", 190, 90, 100, "#e85d75", { sw: 1.6 }),
      t("You're invited", 40, 215, 400, 20, { weight: 700, ls: 4, upper: true, color: "#e85d75" }),
      t("Mia turns 7!", 40, 250, 400, 56, { weight: 900, color: "#2d2a32" }),
      t("Come for cake, games and a lot of balloons.", 70, 330, 340, 18, { lh: 1.45, color: "#5b5560" }),
      r(60, 420, 360, 124, "#ffffff", { radius: 18, shadow: { x: 0, y: 8, blur: 24, color: "rgba(232,93,117,0.18)" } }),
      t("Saturday, 12 December\n3:00 to 6:00 PM\n14 Olive Street", 60, 440, 360, 18, { lh: 1.5, weight: 600, color: "#2d2a32" }),
      t("RSVP to Sara · 555 0100", 40, 590, 400, 15, { color: "#8a8290" })
    ] }] }
  ];

  // Build a full document from a template (fresh ids, defaults filled, text heights measured).
  DS.fromTemplate = function (tpl) {
    var core = DS.core, size = DS.SIZES.filter(function (z) { return z.id === tpl.size; })[0] || DS.SIZES[0];
    var doc = core.newDoc(size.w, size.h, tpl.name);
    doc.print = size.print ? core.clone(size.print) : null;
    doc.pages = tpl.pages.map(function (p) {
      var page = core.newPage(); page.bg = core.clone(p.bg);
      page.objects = p.objects.map(function (o) { var c = core.clone(o), type = c.type; delete c.type; return core.make(type, c); });
      return page;
    });
    if (DS.render) DS.render.fitAll(doc);
    return doc;
  };
})();
