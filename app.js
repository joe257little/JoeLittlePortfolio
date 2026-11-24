/* Portfolio app. All content lives in the #site-data JSON inside index.html.
   Visitors see a read-only site. The owner (and editors) get an "Edit site" button that adds, edits,
   reorders and removes work, uploads pictures, and publishes the result as a new version of this page. */
(function () {
  'use strict';

  var HEAD_HTML = "<title>Joseph Little Portfolio</title><meta name=\"claude:viewport-fit-sides\" content=\"cover\"><link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin><link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,100..900;1,100..900&family=IBM+Plex+Mono:wght@400;500&display=swap\"><link rel=\"stylesheet\" href=\"style.css\"><script>document.documentElement.classList.add('js')</script>";
  var SKELETON_OPEN = "<!doctype html><html><head><meta charset=utf8><meta name=viewport content=\"width=device-width,initial-scale=1,viewport-fit=cover\"><style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n";
  var SKELETON_CLOSE = '</body></html>';
  var EMAIL = 'joe257little@gmail.com';
  var PHONE = '07775 448943', PHONE_TEL = '+447775448943';
  var PAGE_KEYS = ['radio', 'live', 'film', 'brand', 'programming'];
  var PAGE_LABELS = { film: 'Film & Documentary Sound', radio: 'Radio & Podcasts', live: 'Live Production', programming: 'Programming & Curation', brand: 'Brand Activations & Project Management' };
  var DRAFT_KEY = 'portfolio-draft-v1';

  var app = document.getElementById('app');
  var PUBLISHED = JSON.parse(document.getElementById('site-data').textContent);
  var S = clone(PUBLISHED);
  var ED = { can: false, on: false, artifact: null, assets: null, dirty: false, status: '' };
  var pendingScroll = null;
  var lastRoute = null;
  var confirmKey = null;

  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
  function imgSrc(id) { return /\.(jpe?g|png|gif|webp)$/i.test(String(id)) ? String(id) : 'img/u/' + encodeURIComponent(id) + '.jpg'; }
  function initials(t) { return String(t || '?').replace(/^the\s+/i, '').split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join('').toUpperCase(); }

  /* ---------------------------------------------------------------- routing */
  function routeKey() {
    var h = location.hash.replace('#', '');
    for (var i = 0; i < PAGE_KEYS.length; i++) if (S.pages[PAGE_KEYS[i]].route === h) return PAGE_KEYS[i];
    return 'home';
  }
  function pageOf(entryId) {
    for (var i = 0; i < PAGE_KEYS.length; i++) if ((S.order[PAGE_KEYS[i]] || []).indexOf(entryId) > -1) return PAGE_KEYS[i];
    return null;
  }
  function goto(key, scrollId) {
    pendingScroll = scrollId || null;
    var route = key === 'home' ? 'home' : S.pages[key].route;
    if (location.hash.replace('#', '') === route) render(); else location.hash = route;
  }
  function scrollToId(id) {
    var el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------------------------------------------------------- views */
  function topbar(current) {
    var links = PAGE_KEYS.map(function (k) {
      var p = S.pages[k];
      return '<a href="#' + p.route + '"' + (k === current ? ' aria-current="page"' : '') + '>' + esc(p.nav) + '</a>';
    }).join('') + '<a href="#contact" data-scroll="contact">Contact</a>';
    return '<header class="topbar"><div class="wrap"><a class="mark" href="#home">Joseph <b>Little</b></a>' +
      '<button class="menu-btn" type="button" data-act="menu" aria-expanded="false" aria-controls="nav">Menu</button>' +
      '<nav class="nav" id="nav" aria-label="Main">' + links + '</nav></div></header>';
  }
  function contactBlock() {
    return '<section class="contact" id="contact"><div class="wrap"><p class="section-label">Contact</p><div class="contact-row">' +
      '<a class="email" id="email-text" href="mailto:' + EMAIL + '">' + EMAIL + '</a>' +
      '<button class="btn" type="button" data-act="copy-email">Copy address</button></div>' +
      '<p class="phone-row"><a class="phone" href="tel:' + PHONE_TEL + '">' + PHONE + '</a></p></div></section>' +
      '<div class="wrap fine label">&copy; Joseph Little</div>';
  }
  function norm(t) { return String(t || '').toLowerCase().replace(/[\u2018\u2019]/g, "'"); }
  // find the first project that is about this client: title, client line or details first, then the description
  function matchEntry(name) {
    var n = norm(name); if (!n) return null;
    var re = new RegExp('(^|[^a-z0-9])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9]|$)');
    var ids = [];
    PAGE_KEYS.forEach(function (k) { (S.order[k] || []).forEach(function (id) { if (S.entries[id] && ids.indexOf(id) < 0) ids.push(id); }); });
    for (var i = 0; i < ids.length; i++) {
      var e = S.entries[ids[i]];
      var hay = norm(e.title + ' ' + e.meta + ' ' + (e.facts || []).map(function (f) { return f[1]; }).join(' '));
      if (re.test(hay)) return ids[i];
    }
    for (var j = 0; j < ids.length; j++) {
      if (re.test(norm((S.entries[ids[j]].copy || []).join(' ')))) return ids[j];
    }
    return null;
  }
  // "Name" links to the matching project automatically; "Name|https://..." links to that address
  function clientsLine(list) {
    return (list || []).map(function (raw) {
      var parts = String(raw).split('|'), name = parts[0].trim(), url = safeUrl(parts[1]);
      if (url) return '<a class="cl" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(name) + '</a>';
      var id = matchEntry(name);
      return id ? '<a class="cl" href="#" data-goto="' + esc(id) + '">' + esc(name) + '</a>' : esc(name);
    }).join(' <span>/</span> ');
  }
  function edBtn(act, label, extra) {
    return ED.on ? '<button class="btn ed-btn" type="button" data-act="' + act + '"' + (extra || '') + '>' + esc(label) + '</button>' : '';
  }

  function frameOk(f) { return !!(f && typeof f === 'object' && isFinite(f.cx) && isFinite(f.cy) && isFinite(f.z) && f.a > 0); }
  // crop of a picture inside a box (bar = box width / height): which point is centred and how far it is zoomed in
  function frameLim(z, s) { return (z * s - 1) / (2 * z * s); }
  function frameStyle(f, bar) {
    if (!frameOk(f)) return '';
    var z = Math.max(1, Math.min(4, f.z)), k = f.a / bar, sx = Math.max(k, 1), sy = Math.max(1 / k, 1);
    var cx = Math.min(0.5 + frameLim(z, sx), Math.max(0.5 - frameLim(z, sx), f.cx)), cy = Math.min(0.5 + frameLim(z, sy), Math.max(0.5 - frameLim(z, sy), f.cy));
    var w = z * sx, h = z * sy, l = 0.5 - cx * w, t = 0.5 - cy * h;
    return 'position:absolute;max-width:none;object-fit:fill;width:' + (w * 100).toFixed(2) + '%;height:' + (h * 100).toFixed(2) + '%;left:' + (l * 100).toFixed(2) + '%;top:' + (t * 100).toFixed(2) + '%';
  }
  function frameAttr(f, bar) { var st = frameStyle(f, bar); return st ? ' style="' + st + '"' : ''; }
  function picId(p) { return p && typeof p === 'object' ? p.id : p; }
  function picUrl(p) { return p && typeof p === 'object' ? safeUrl(p.url) : ''; }
  function packPics(arr) {
    return (arr || []).filter(function (p) { return picId(p); }).map(function (p) { var u = (p.url || '').trim(); if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u; var hasF = frameOk(p.f); if (safeUrl(u)) return hasF ? { id: p.id, url: u, f: p.f } : { id: p.id, url: u }; return hasF ? { id: p.id, url: '', f: p.f } : p.id; });
  }
  function linkTag(u) {
    var h = ''; try { h = new URL(u).hostname.replace(/^www\./, ''); } catch (e) { /* ignore */ }
    if (/mixcloud\.com$/.test(h)) return 'Listen on Mixcloud';
    if (/spotify\.com$/.test(h)) return 'Listen on Spotify';
    if (/instagram\.com$/.test(h)) return 'View on Instagram';
    if (/youtube\.com$|youtu\.be$/.test(h)) return 'Watch on YouTube';
    return 'Open link';
  }
  function ytId(u) {
    var m = String(u || '').match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/);
    return m ? m[1] : '';
  }
  function videosHtml(e, act, extra) { var vp = videoParts(e, act, extra); return (vp.tiles || vp.slot) ? '<div class="yt-grid">' + vp.tiles + vp.slot + '</div>' : ''; }
  function videoParts(e, act, extra, mixed) {
    var vs = (e.videos || []).filter(function (v) { return v && ytId(v.url); }), vkeys = tokKeys('v:', vs.map(function (v) { return ytId(v.url); }));
    var tiles = vs.map(function (v, ix) {
      var id = ytId(v.url);
      var tg = ED.on ? 'div' : 'a';
      return '<' + tg + ' class="yt"' + (ED.on ? '' : ' href="' + esc(safeUrl(v.url) || ('https://www.youtube.com/watch?v=' + id)) + '" target="_blank" rel="noopener noreferrer"') + '>' +
        '<span class="yt-frame"><img class="yt-img" src="thumbs/' + id + '.jpg" data-yt="' + id + '" alt="" loading="lazy"><span class="yt-play" aria-hidden="true"></span>' + (ED.on ? (mixed ? '\u0001' : mvBtns('vid', ix, vs.length, act, extra)) : '') + '</span>' +
        '<span class="yt-cap">' + esc(v.title || 'Watch on YouTube') + '</span></' + tg + '>';
    });
    var slot = ED.on ? '<button class="g-slot yt-slot" type="button" data-act="' + act + '"' + (extra || '') + '><span>+</span>Add YouTube films</button>' : '';
    return { tiles: tiles.join(''), items: tiles.map(function (h, i) { return { key: vkeys[i], html: h }; }), slot: slot };
  }
  function parseVideos(text) {
    return String(text || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var bar = l.lastIndexOf('|'), title = bar > -1 ? l.slice(0, bar).trim() : '', u = (bar > -1 ? l.slice(bar + 1) : l).trim();
      if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
      return ytId(u) ? { url: u, title: title } : null;
    }).filter(Boolean);
  }
  function videosText(list) { return (list || []).map(function (v) { return (v.title ? v.title + ' | ' : '') + v.url; }).join('\n'); }
  function reelHtml(k, P, dflt) {
    var vs = (P.carousel || []).filter(function (v) { return v && ytId(v.url); });
    if (!vs.length && !ED.on) return '';
    var loop = !ED.on && vs.length >= 4;
    var tiles = [0, 1, 2].slice(0, loop ? 3 : 1).map(function (copy) { return vs.map(function (v) {
      var id = ytId(v.url);
      return '<a class="reel-tile' + (copy ? ' reel-clone' : '') + '"' + (copy ? ' aria-hidden="true" tabindex="-1"' : '') + ' href="' + esc(safeUrl(v.url) || ('https://www.youtube.com/watch?v=' + id)) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="yt-frame"><img class="yt-img" src="thumbs/' + id + '.jpg" data-yt="' + id + '" alt="" loading="lazy" draggable="false"><span class="yt-play" aria-hidden="true"></span></span>' +
        '<span class="reel-cap">' + esc(v.title || 'Watch on YouTube') + '</span></a>';
    }).join(''); }).join('');
    return '<section class="reel" aria-label="' + esc(P.carouselTitle || dflt || 'Films') + '"><div class="wrap"><p class="section-label">' + esc(P.carouselTitle || dflt || 'Films') + '</p></div>' +
      '<div class="reel-wrap"><button class="reel-btn reel-prev" type="button" data-reel="-1" aria-label="Scroll films left">&#8249;</button>' +
      '<div class="reel-track" tabindex="0"' + (loop ? ' data-loop="1"' : '') + '>' + tiles + '</div>' +
      '<button class="reel-btn reel-next" type="button" data-reel="1" aria-label="Scroll films right">&#8250;</button></div>' +
      (ED.on ? '<div class="wrap">' + (k === 'home' ? edBtn('edit-home', 'Edit the highlights shown here') : edBtn('edit-page', 'Edit the films shown here', ' data-page="' + k + '"')) + '</div>' : '') + '</section>';
  }
  function isVid(v) { return typeof v === 'string' && v.indexOf('v:') === 0; }
  function bgSrc(v) { if (isVid(v)) { var r = v.slice(2); return r.indexOf('.') > -1 ? r : imgSrc(r); } return imgSrc(v); }
  function heroBg(id, f) {
    if (!id) return '';
    if (f && f.ar && !isVid(id)) return '<div class="hero-bg" aria-hidden="true" data-focus="' + [f.fx, f.fy, f.ar, f.zoom || 1, f.tx, f.ty].join(',') + '" style="background-image:url(' + imgSrc(id) + ');background-repeat:no-repeat">' + [3, 6, 11, 18].map(function (b, n) { return '<i class="hero-blur b' + n + '" style="background-image:url(' + imgSrc(id) + ');background-repeat:no-repeat;--blur:' + (f.blur != null ? Math.round(b * f.blur / 9) : b) + 'px"></i>'; }).join('') + '</div>';
    if (isVid(id)) return '<video class="hero-bg" aria-hidden="true" src="' + bgSrc(id) + '" autoplay muted loop playsinline preload="auto" disablepictureinpicture></video>';
    return '<div class="hero-bg" aria-hidden="true" style="background-image:url(' + imgSrc(id) + ')"></div>';
  }
  function gallery(pics, act, extra, label) { var gp = galleryParts(pics, act, extra, label, 4 / 3); return (gp.tiles || gp.slot) ? '<div class="gallery">' + gp.tiles + gp.slot + '</div>' : ''; }
  function tokKeys(prefix, ids) { var seen = {}; return ids.map(function (id) { var k = prefix + id; seen[k] = (seen[k] || 0) + 1; return seen[k] > 1 ? k + '#' + seen[k] : k; }); }
  function mixSeq(e) {
    var pics = tokKeys('p:', (e.pics || []).filter(picId).map(picId)), vids = tokKeys('v:', (e.videos || []).filter(function (v) { return v && ytId(v.url); }).map(function (v) { return ytId(v.url); }));
    var base = e.vfirst ? vids.concat(pics) : pics.concat(vids);
    if (!e.mix || !e.mix.length) return base;
    var seq = e.mix.filter(function (t, i) { return base.indexOf(t) > -1 && e.mix.indexOf(t) === i; });
    base.forEach(function (t) { if (seq.indexOf(t) < 0) seq.push(t); });
    return seq;
  }
  function mvBtns(kind, ix, n, act, extra) {
    if (n < 2) return '';
    return '<span class="g-mv">' + (ix > 0 ? '<button type="button" class="g-mvb" data-mv="' + kind + '" data-d="-1" data-i="' + ix + '" data-mvact="' + act + '"' + (extra || '') + ' aria-label="Move earlier">&#8592;</button>' : '') +
      (ix < n - 1 ? '<button type="button" class="g-mvb" data-mv="' + kind + '" data-d="1" data-i="' + ix + '" data-mvact="' + act + '"' + (extra || '') + ' aria-label="Move later">&#8594;</button>' : '') + '</span>';
  }
  function galleryParts(pics, act, extra, label, bar, mixed) {
    var list = (pics || []).filter(picId), keys = tokKeys('p:', list.map(picId));
    var tiles = list.map(function (p, ix) {
      var id = picId(p), url = picUrl(p);
      var rmb = ED.on ? (function () { var ck = 'pic:' + act + ':' + ((/data-id="([^"]*)"/.exec(extra || '') || [])[1] || (/data-page="([^"]*)"/.exec(extra || '') || [])[1] || '') + ':' + ix, sure = confirmKey === ck; return '<button type="button" class="g-rm' + (sure ? ' sure' : '') + '" data-rm="' + act + '"' + (extra || '') + ' data-i="' + ix + '" data-ck="' + esc(ck) + '" aria-label="Remove this picture">' + (sure ? 'Click again to remove' : '&times;') + '</button>'; })() : '';
      var mvb = ED.on ? (mixed ? '\u0001' : mvBtns('pic', ix, list.length, act, extra)) : '';
      rmb += mvb;
      /* while editing, tiles are plain boxes (not links) so the arrow and remove buttons never trigger the link */
      if (ED.on) return '<div class="g-item' + (url ? ' has-link' : '') + '"><img src="' + imgSrc(id) + '" alt="" loading="lazy"' + frameAttr(p.f, bar) + '>' + (url ? '<span class="g-tag">' + esc(linkTag(url)) + ' &#8599;</span>' : '') + rmb + '</div>';
      return url
        ? '<a class="g-item has-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer"><img src="' + imgSrc(id) + '" alt="" loading="lazy"' + frameAttr(p.f, bar) + '><span class="g-tag">' + esc(linkTag(url)) + ' &#8599;</span></a>'
        : '<a class="g-item" href="' + esc(imgSrc(id)) + '" target="_blank" rel="noopener"><img src="' + imgSrc(id) + '" alt="" loading="lazy"' + frameAttr(p.f, bar) + '></a>';
    });
    var slot = ED.on ? '<button class="g-slot" type="button" data-act="' + act + '"' + (extra || '') + '><span>+</span>' + esc(label || 'Add pictures') + '</button>' : '';
    return { tiles: tiles.join(''), items: tiles.map(function (h, i) { return { key: keys[i], html: h }; }), slot: slot };
  }

  function viewHome() {
    var h = S.home;
    var cats = PAGE_KEYS.map(function (k, i) {
      var p = S.pages[k];
      return '<a class="cat" href="#' + p.route + '"><span class="n">' + ('0' + (i + 1)).slice(-2) + '</span><span class="t">' + esc(p.title) +
        '</span><span class="d">' + esc(p.blurb) + '</span><span class="a" aria-hidden="true">&#8594;</span></a>';
    }).join('');
    var sel = (h.featured || []).filter(function (id) { return S.entries[id] && (S.entries[id].img || (S.entries[id].pics && S.entries[id].pics.length)); }).map(function (id) {
      var e = S.entries[id];
      var pic = e.img || (e.pics && picId(e.pics[0])), pf = e.img ? e.imgF : (e.pics && e.pics[0] && e.pics[0].f); var im = pic ? '<img src="' + imgSrc(pic) + '" alt="" loading="lazy"' + frameAttr(pf, 0.8) + '>' : '<span class="ph-i">' + esc(initials(e.title)) + '</span>';
      return '<a href="#" data-goto="' + esc(id) + '"><div class="im">' + im + '</div><div class="c">' + esc(e.title) + '</div></a>';
    }).join('');
    return topbar('home') + '<main>' +
      '<section class="home-hero' + (h.bg ? ' has-bg' : '') + '">' + heroBg(h.bg, h.bgFocus) + '<div class="wrap"><h1 class="name">Joseph<b>Little</b></h1>' +
      '<p class="roles mono label">' + esc(h.roles).replace(/ \/ /g, ' &nbsp;/&nbsp; ') + '</p>' +
      '<p class="home-intro">' + esc(h.tagline) + '</p>' +
      (h.note ? '<p class="home-note">' + esc(h.note) + '</p>' : '') +
      (ED.on ? '<div class="links">' + edBtn('edit-home', 'Edit home text and background picture') + '</div>' : '') + '</div></section>' +
      reelHtml('home', h, 'Highlights') +
      '<section class="home-cats"><div class="wrap"><nav class="cats" aria-label="Work">' + cats + '</nav></div></section>' +
      (((h.pics || []).length || ED.on) ? '<section class="home-block"><div class="wrap">' + gallery(h.pics, 'edit-home', '', 'Add home page pictures') + '</div></section>' : '') +
      (sel ? '<section class="home-block"><div class="wrap"><p class="section-label">Selected work</p><div class="sel">' + sel + '</div></div></section>' : '') +
      '<section class="home-block"><div class="wrap"><p class="section-label">Clients and partners</p><p class="clients">' + clientsLine(h.clients) + '</p></div></section>' +
      '</main>' + contactBlock();
  }

  function linksHtml(e) {
    var ls = (e.links || []).map(function (l) {
      var u = safeUrl(l[1]);
      return u ? '<a class="btn" href="' + esc(u) + '" target="_blank" rel="noopener noreferrer">' + esc(l[0] || 'Link') + ' <span aria-hidden="true">&#8599;</span></a>' : '';
    }).join('');
    return ls ? '<div class="links">' + ls + '</div>' : '';
  }

  function tools(pageKey, id, i, n) {
    if (!ED.on) return '';
    var ck = pageKey + ':' + id;
    return '<div class="ed-tools" data-page="' + pageKey + '" data-id="' + esc(id) + '">' +
      '<button class="btn ed-btn" type="button" data-act="edit">Edit</button>' +
      '<button class="btn ed-btn" type="button" data-act="up"' + (i === 0 ? ' disabled' : '') + ' aria-label="Move up">&#8593;</button>' +
      '<button class="btn ed-btn" type="button" data-act="down"' + (i === n - 1 ? ' disabled' : '') + ' aria-label="Move down">&#8595;</button>' +
      '<button class="btn ed-btn" type="button" data-act="remove">' + (confirmKey === ck ? 'Click again to remove' : 'Remove from page') + '</button></div>';
  }

  function entryHtml(id, num, pageKey, lead, i, n) {
    var e = S.entries[id];
    var compact = e.size === 'compact';
    var cls = 'project' + (lead ? ' is-lead' : '') + (compact ? ' compact' : '');
    var head = '<div class="p-head"><div class="p-meta"><span class="rank">No. ' + num + '</span>' + (e.meta ? '<span class="label">' + esc(e.meta) + '</span>' : '') + '</div>' +
      '<h2 class="p-title">' + esc(e.title) + '</h2>' + (e.role ? '<p class="p-role mono">Role: ' + esc(e.role) + '</p>' : '') + '</div>';
    var paras = (e.copy || []).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('');
    var facts = (e.facts && e.facts.length) ? '<dl class="facts">' + e.facts.map(function (f) { return '<div><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>'; }).join('') + '</dl>' : '';
    var todo = e.todo && ED.on ? '<p class="todo">' + esc(e.todo) + '</p>' : '';
    var fig = '';
    if (e.img) fig = '<figure class="shot" style="--w:' + Math.min(360, Math.round((e.w || 280) * 1.3)) + 'px"><img src="' + imgSrc(e.img) + '" alt="' + esc(e.alt || e.title) + '" loading="lazy"></figure>';
    else if (ED.on) fig = '<button type="button" class="shot ph" data-act="edit" data-page="' + pageKey + '" data-id="' + esc(id) + '"><span>' + esc(e.ph || initials(e.title)) + '</span><small>+ Add picture</small></button>';
    var body = fig
      ? '<div class="cols has-fig">' + fig + '<div class="copy">' + paras + facts + linksHtml(e) + todo + '</div></div>'
      : '<div class="cols no-fig"><div class="copy">' + paras + linksHtml(e) + todo + '</div>' + facts + '</div>';
    return '<section class="' + cls + '" id="e-' + esc(id) + '"><div class="wrap">' + head + body + mediaHtml(e, id, pageKey) + tools(pageKey, id, i, n) + '</div></section>';
  }

  // films and pictures share one grid (pictures cropped to match the films) so they sit on the same rows
  function mediaHtml(e, id, pageKey) {
    var extra = ' data-page="' + pageKey + '" data-id="' + esc(id) + '"';
    var vp = (e.videos && e.videos.length) || pageKey === 'film' ? videoParts(e, 'edit', extra) : { tiles: '', slot: '' };
    if (!vp.tiles) return (vp.slot ? '<div class="yt-grid">' + vp.slot + '</div>' : '') + gallery(e.pics, 'edit', extra, 'Add pictures');
    var gp = galleryParts(e.pics, 'edit', extra, 'Add pictures', 16 / 9, true); vp = videoParts(e, 'edit', extra, true);
    var byKey = {}; gp.items.concat(vp.items).forEach(function (it) { byKey[it.key] = it.html; });
    var seq = mixSeq(e), n = seq.length;
    var tiles = seq.map(function (k, ix) {
      var mvh = ED.on && n > 1 ? '<span class="g-mv">' + (ix > 0 ? '<button type="button" class="g-mvb" data-mv="mix" data-d="-1" data-key="' + esc(k) + '" data-id="' + esc(id) + '" aria-label="Move earlier">&#8592;</button>' : '') + (ix < n - 1 ? '<button type="button" class="g-mvb" data-mv="mix" data-d="1" data-key="' + esc(k) + '" data-id="' + esc(id) + '" aria-label="Move later">&#8594;</button>' : '') + '</span>' : '';
      return (byKey[k] || '').replace('\u0001', mvh);
    }).join('');
    return '<div class="yt-grid media-mixed' + ' cols-' + (e.cols || (n >= 7 ? 5 : 3)) + '">' + tiles + gp.slot + vp.slot + '</div>';
  }

  var NEXT = {}; PAGE_KEYS.forEach(function (k, i) { NEXT[k] = PAGE_KEYS[i + 1] || 'home'; });

  function viewPage(k) {
    var P = S.pages[k];
    var ids = (S.order[k] || []).filter(function (id) { return S.entries[id]; });
    var main = ids.filter(function (id) { return S.entries[id].size !== 'brief'; });
    var brief = ids.filter(function (id) { return S.entries[id].size === 'brief'; });
    var leadId = null;
    main.forEach(function (id) { if (!leadId && S.entries[id].size === 'full') leadId = id; });
    var index = main.map(function (id, i) {
      var e = S.entries[id];
      return '<li><a href="#' + P.route + '" data-scroll="e-' + esc(id) + '"><span class="n">' + ('0' + (i + 1)).slice(-2) + '</span><span class="t">' + esc(e.title) + '</span><span class="m">' + esc(e.meta) + '</span></a></li>';
    }).join('');
    var chapters = main.map(function (id, i) { return entryHtml(id, i + 1, k, id === leadId, i, main.length); }).join('');
    var also = brief.map(function (id, i) {
      var e = S.entries[id];
      return '<div class="brief" id="e-' + esc(id) + '">' + (e.img ? '<figure class="shot brief-shot"><img src="' + imgSrc(e.img) + '" alt="' + esc(e.alt || e.title) + '" loading="lazy"></figure>' : '') + '<h3>' + esc(e.title) + '</h3>' + (e.copy || []).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + linksHtml(e) + gallery(e.pics, 'edit', ' data-page="' + k + '" data-id="' + esc(id) + '"', 'Add pictures') + tools(k, id, i, brief.length) + '</div>';
    }).join('');
    var nk = NEXT[k];
    var nextTitle = nk === 'home' ? 'Back to the start' : S.pages[nk].title;
    var nextHref = nk === 'home' ? '#home' : '#' + S.pages[nk].route;
    return topbar(k) + '<main>' +
      '<section class="page-hero' + (P.bg ? ' has-bg' : '') + '">' + heroBg(P.bg, P.bgFocus) + '<div class="wrap"><h1 class="page-title">' + esc(P.title) + '</h1><p class="page-intro">' + esc(P.intro) + '</p>' +
      (P.clients && P.clients.length ? '<div class="clients-strip"><span class="label">' + esc(P.clientsLabel || 'Worked with') + '</span><p class="clients">' + clientsLine(P.clients) + '</p></div>' : '') +
      (ED.on ? '<div class="links">' + edBtn('edit-page', 'Edit page text and background picture', ' data-page="' + k + '"') + '</div>' : '') + '</div></section>' +
      reelHtml(k, P) +
      (((P.pics || []).length || ED.on) ? '<section class="page-pics"><div class="wrap">' + gallery(P.pics, 'edit-page', ' data-page="' + k + '"', 'Add pictures for this page') + '</div></section>' : '') +
      (main.length > 1 ? '<section class="index-wrap"><div class="wrap"><p class="section-label">On this page</p><ol class="index">' + index + '</ol></div></section>' : '') +
      chapters +
      (ED.on ? '<section class="also"><div class="wrap">' + edBtn('add', 'Add work to this page', ' data-page="' + k + '"') + '</div></section>' : '') +
      (also ? '<section class="also"><div class="wrap"><p class="section-label">Also</p><div class="also-grid">' + also + '</div></div></section>' : '') +
      '</main><a class="next" href="' + nextHref + '"><div class="wrap"><span class="label">Next</span><span class="t">' + esc(nextTitle) + ' &#8594;</span></div></a>' +
      contactBlock();
  }

  // places a picture so that a chosen point (for example a face) sits at a chosen spot in the hero while still covering it
  function layoutBg() {
    var el = document.querySelector('.hero-bg[data-focus]'); if (!el) return;
    var p = el.getAttribute('data-focus').split(',').map(Number);
    var fx = p[0], fy = p[1], ar = p[2], zoom = p[3], tx = p[4], ty = p[5];
    var W = el.clientWidth, H = el.clientHeight; if (!W || !H || !ar) return;
    var S = Math.max(W, H * ar) * Math.max(1, zoom), Hi = S / ar;
    var ox = Math.min(0, Math.max(W - S, tx * W - fx * S)), oy = Math.min(0, Math.max(H - Hi, ty * H - fy * Hi));
    el.style.backgroundSize = S.toFixed(1) + 'px ' + Hi.toFixed(1) + 'px';
    el.style.backgroundPosition = ox.toFixed(1) + 'px ' + oy.toFixed(1) + 'px';
    var bls = el.querySelectorAll('.hero-blur');
    for (var k = 0; k < bls.length; k++) { bls[k].style.backgroundSize = S.toFixed(1) + 'px ' + Hi.toFixed(1) + 'px'; bls[k].style.backgroundPosition = (ox + 60).toFixed(1) + 'px ' + (oy + 60).toFixed(1) + 'px'; }
  }
  window.addEventListener('resize', layoutBg);
  function fadeHero() {
    var bg = document.querySelector('.hero-bg'); if (!bg) return;
    var hero = bg.parentNode, h = Math.max(240, hero.offsetHeight * 0.9);
    var o = Math.max(0, Math.min(1, 1 - (window.pageYOffset || 0) / h));
    bg.style.opacity = o.toFixed(3); bg.style.visibility = o <= 0 ? 'hidden' : 'visible';
    if (bg.tagName === 'VIDEO') { if (o <= 0 || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) { if (!bg.paused) bg.pause(); } else if (bg.paused) { var pr = bg.play(); if (pr && pr.catch) pr.catch(function () {}); } }
  }
  var fadeQueued = false;
  window.addEventListener('scroll', function () { if (fadeQueued) return; fadeQueued = true; requestAnimationFrame(function () { fadeQueued = false; fadeHero(); }); }, { passive: true });
  window.addEventListener('resize', fadeHero);

  function render() {
    var key = routeKey();
    var changed = key !== lastRoute;
    lastRoute = key;
    app.innerHTML = key === 'home' ? viewHome() : viewPage(key);
    document.title = (key === 'home' ? 'Joseph Little Portfolio' : S.pages[key].title + ' | Joseph Little');
    if (pendingScroll) { var id = pendingScroll; pendingScroll = null; setTimeout(function () { scrollToId(id); }, 30); }
    else if (changed) window.scrollTo(0, 0);
    renderBar();
    layoutBg();
    fadeHero();
  }

  /* ---------------------------------------------------------------- edit bar */
  var barEl = document.createElement('div');
  barEl.className = 'edbar';
  document.body.appendChild(barEl);
  function renderBar() {
    if (!ED.can) { barEl.innerHTML = ''; barEl.hidden = true; return; }
    barEl.hidden = false;
    if (!ED.on) {
      barEl.innerHTML = '<button class="btn" type="button" data-act="toggle-edit">Edit site</button>';
      return;
    }
    barEl.innerHTML = '<span class="mono">' + (ED.status ? esc(ED.status) : (ED.dirty ? 'Unpublished changes' : 'Editing. No changes yet')) + '</span>' +
      '<span class="edbar-btns">' +
      '<button class="btn" type="button" data-act="publish"' + (ED.dirty ? '' : ' disabled') + '>Publish changes</button>' +
      '<button class="btn" type="button" data-act="discard"' + (ED.dirty ? '' : ' disabled') + '>Discard</button>' +
      '<button class="btn" type="button" data-act="toggle-edit">Done</button></span>';
  }
  function setStatus(t) { ED.status = t; renderBar(); }

  function changed() {
    ED.dirty = JSON.stringify(S) !== JSON.stringify(PUBLISHED);
    try {
      if (ED.dirty) localStorage.setItem(DRAFT_KEY, JSON.stringify({ base: PUBLISHED, data: S }));
      else localStorage.removeItem(DRAFT_KEY);
    } catch (e) { /* storage is optional */ }
    ED.status = '';
    render();
  }

  /* ---------------------------------------------------------------- publish */
  function buildDocument(state) {
    var json = JSON.stringify(state).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    return SKELETON_OPEN + HEAD_HTML + '<div id="app"></div><script type="application/json" id="site-data">' + json + '</scr' + 'ipt><script src="app.js" defer></scr' + 'ipt>' + SKELETON_CLOSE;
  }
  function publish() {
    if (!ED.artifact || !ED.dirty) return;
    setStatus('Publishing...');
    ED.artifact.publish(buildDocument(S)).then(function () {
      setStatus('Published. Reloading...');
    }, function (err) {
      var c = err && err.code;
      if (c === 'conflict') setStatus('A newer version was published elsewhere. Reloading...');
      else if (c === 'not_writer' || c === 'not_granted' || c === 'capability_disabled' || c === 'consent_required') { ED.can = false; ED.on = false; render(); }
      else if (c === 'too_large') setStatus('The page is too large to publish. Remove some pictures.');
      else if (c === 'rate_limited') setStatus('Publishing too fast. Wait a moment and try again.');
      else setStatus('Could not publish. Your changes are kept here, try again.');
    });
  }
  function discard() {
    S = clone(PUBLISHED);
    changed();
  }

  /* ---------------------------------------------------------------- ordering */
  function moveEntry(page, id, dir) {
    var list = S.order[page];
    var grp = S.entries[id].size === 'brief';
    var same = list.filter(function (x) { return S.entries[x] && (S.entries[x].size === 'brief') === grp; });
    var pos = same.indexOf(id), tgt = same[pos + dir];
    if (tgt == null) return;
    var a = list.indexOf(id), b = list.indexOf(tgt);
    list[a] = tgt; list[b] = id;
    changed();
  }
  function removeEntry(page, id) {
    S.order[page] = S.order[page].filter(function (x) { return x !== id; });
    var used = Object.keys(S.order).some(function (k) { return S.order[k].indexOf(id) > -1; });
    if (!used) { delete S.entries[id]; S.home.featured = (S.home.featured || []).filter(function (x) { return x !== id; }); }
    confirmKey = null;
    changed();
  }

  /* ---------------------------------------------------------------- modal editor */
  var modalRoot = document.createElement('div');
  document.body.appendChild(modalRoot);
  var form = null;

  function closeModal() { modalRoot.innerHTML = ''; form = null; document.body.classList.remove('modal-open'); }
  function openModal(html) { modalRoot.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>'; document.body.classList.add('modal-open'); var f = modalRoot.querySelector('input,textarea,select'); if (f) f.focus(); }

  function linkRow(l, u) {
    return '<div class="lrow"><input type="text" name="ll" placeholder="Label, e.g. Listen on Spotify" value="' + esc(l) + '" aria-label="Link label">' +
      '<input type="text" name="lu" placeholder="https://..." value="' + esc(u) + '" aria-label="Link address">' +
      '<button class="btn" type="button" data-m="rmlink" aria-label="Remove link">&times;</button></div>';
  }

  function openEntryForm(id, pageKey) {
    var isNew = !id;
    var e = isNew ? { title: '', role: '', meta: '', size: 'full', copy: [], facts: [], links: [], img: null, w: 0, alt: '' } : S.entries[id];
    form = { id: id, isNew: isNew, img: e.img || null, imgF: frameOk(e.imgF) ? e.imgF : null, w: e.w || 0, pics: normPics(e.pics), uploading: false, defaultPage: pageKey };
    var onPages = isNew ? [pageKey] : Object.keys(S.order).filter(function (k) { return S.order[k].indexOf(id) > -1; });
    var pagesBoxes = PAGE_KEYS.map(function (k) {
      return '<label class="chk"><input type="checkbox" name="pg" value="' + k + '"' + (onPages.indexOf(k) > -1 ? ' checked' : '') + '> ' + esc(PAGE_LABELS[k]) + '</label>';
    }).join('');
    var rows = (e.links.length ? e.links : [['', '']]).map(function (l) { return linkRow(l[0], l[1]); }).join('');
    var facts = e.facts.map(function (f) { return f[0] + ': ' + f[1]; }).join('\n');
    var featured = !isNew && (S.home.featured || []).indexOf(id) > -1;
    var picHtml = ED.assets
      ? '<input type="file" id="pic" accept="image/*"><div class="pic-prev" id="pic-prev">' + picPrev() + '</div><p class="m-help" id="pic-msg"></p>'
      : '<p class="m-help">Picture upload is not available in this view.</p>';
    openModal('<form class="m-card" id="entry-form" novalidate><h2>' + (isNew ? 'Add work' : 'Edit work') + '</h2>' +
      '<label>Title<input type="text" name="title" value="' + esc(e.title) + '" required></label>' +
      '<label>Role<input type="text" name="role" value="' + esc(e.role) + '" placeholder="e.g. Sound Engineer"></label>' +
      '<label>Client or label<input type="text" name="meta" value="' + esc(e.meta) + '" placeholder="e.g. BBC"></label>' +
      '<label>Description<textarea name="copy" rows="6">' + esc((e.copy || []).join('\n\n')) + '</textarea><span class="m-help">Leave a blank line between paragraphs.</span></label>' +
      '<label>Details<textarea name="facts" rows="3" placeholder="Client: BBC&#10;Format: Weekly, live">' + esc(facts) + '</textarea><span class="m-help">One per line, written as Label: value.</span></label>' +
      '<fieldset><legend>Links</legend><div id="lrows">' + rows + '</div><button class="btn" type="button" data-m="addlink">Add another link</button></fieldset>' +
      '<fieldset><legend>YouTube films (shown as thumbnails under the text)</legend><textarea name="videos" rows="4" placeholder="https://www.youtube.com/watch?v=...&#10;Film title | https://youtu.be/...">' + esc((e.videos || []).map(function (v) { return (v.title ? v.title + ' | ' : '') + v.url; }).join('\n')) + '</textarea><span class="m-help">One link per line. Optionally write a title first, then | and the link. Thumbnails have to be added to the site first, so send new links to Claude and the picture will appear.</span></fieldset>' +
      '<fieldset><legend>Main picture (beside the text)</legend>' + picHtml + '</fieldset>' +
      '<fieldset><legend>More pictures (as many as you like)</legend>' + picsField() + '</fieldset>' +
      '<fieldset><legend>Show on</legend>' + pagesBoxes +
      (isNew ? '<label>Place it<select name="pos"><option value="bottom">At the bottom of the page</option><option value="top">At the top of the page (becomes the lead)</option></select></label>' : '') +
      '<label class="chk"><input type="checkbox" name="feat"' + (featured ? ' checked' : '') + '> Feature in Selected work on the home page</label></fieldset>' +
      '<label>Layout<select name="size"><option value="full"' + (e.size === 'full' ? ' selected' : '') + '>Full project</option><option value="compact"' + (e.size === 'compact' ? ' selected' : '') + '>Short section</option><option value="brief"' + (e.size === 'brief' ? ' selected' : '') + '>Brief mention (listed under Also)</option></select></label>' +
      '<label>Tiles per row when pictures and films share a grid<select name="cols"><option value="">Automatic</option>' + [3, 4, 5].map(function (c) { return '<option value="' + c + '"' + (e.cols === c ? ' selected' : '') + '>' + c + ' across</option>'; }).join('') + '</select></label>' +
      '<p class="m-err" id="m-err" role="alert"></p>' +
      '<div class="m-actions"><button class="btn" type="button" data-m="cancel">Cancel</button><button class="btn" type="submit" id="m-save">Save</button></div></form>');
  }
  /* picture framing editor: drag to move, slider to zoom */
  var frameRoot = document.createElement('div'); document.body.appendChild(frameRoot);
  var fr = null;
  function frApply() {
    var img = document.getElementById('fr-img'); if (!img || !fr) return;
    var z = fr.z, k = fr.a / fr.bar, sx = Math.max(k, 1), sy = Math.max(1 / k, 1);
    fr.cx = Math.min(0.5 + frameLim(z, sx), Math.max(0.5 - frameLim(z, sx), fr.cx)); fr.cy = Math.min(0.5 + frameLim(z, sy), Math.max(0.5 - frameLim(z, sy), fr.cy));
    img.setAttribute('style', frameStyle({ cx: fr.cx, cy: fr.cy, z: fr.z, a: fr.a }, fr.bar));
  }
  function openFrame(kind, i) {
    if (!form) return;
    var src = kind === 'main' ? form.img : (form.pics[i] && form.pics[i].id); if (!src) return;
    var cur = kind === 'main' ? form.imgF : form.pics[i].f;
    var im = new Image();
    im.onload = function () {
      var main = kind === 'main';
      fr = { kind: kind, i: i, bar: main ? 0.8 : picBar(), a: im.naturalWidth / im.naturalHeight, cx: frameOk(cur) ? cur.cx : 0.5, cy: frameOk(cur) ? cur.cy : 0.5, z: frameOk(cur) ? cur.z : 1 };
      frameRoot.innerHTML = '<div class="modal fr-modal" role="dialog" aria-modal="true"><div class="m-card fr-card"><h2>Frame picture</h2>' +
        '<p class="m-help">' + (main ? 'This is how the picture is cropped in Selected work on the home page. Beside the text it always shows in full.' : 'This is how the picture is cropped in the grid (it matches the YouTube thumbnails when the entry has films). Clicking it still opens the whole picture.') + ' Drag the picture to move it, and use the slider to zoom in.</p>' +
        '<div class="fr-box" id="fr-box" tabindex="0" style="aspect-ratio:' + fr.bar.toFixed(4) + ';--frw:' + (main ? '300px' : '460px') + '"><img id="fr-img" src="' + imgSrc(src) + '" alt="" draggable="false"></div>' +
        '<label>Zoom<input type="range" id="fr-z" min="1" max="3" step="0.01" value="' + fr.z + '"></label>' +
        '<div class="m-actions"><button class="btn" type="button" data-fr="reset">Reset</button><button class="btn" type="button" data-fr="cancel">Cancel</button><button class="btn" type="button" data-fr="done">Done</button></div></div></div>';
      frApply();
    };
    im.onerror = function () { var m = document.getElementById(kind === 'main' ? 'pic-msg' : 'pics-msg'); if (m) m.textContent = 'Could not load that picture to frame it.'; };
    im.src = imgSrc(src);
  }
  function closeFrame() { fr = null; frameRoot.innerHTML = ''; }
  frameRoot.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('[data-fr]'); if (!b || !fr) return;
    var a = b.getAttribute('data-fr');
    if (a === 'cancel') closeFrame();
    else if (a === 'reset') { fr.cx = 0.5; fr.cy = 0.5; fr.z = 1; document.getElementById('fr-z').value = 1; frApply(); }
    else if (a === 'done') {
      var r3 = function (n) { return Math.round(n * 1000) / 1000; };
      var out = (fr.z <= 1.001 && Math.abs(fr.cx - 0.5) < 0.002 && Math.abs(fr.cy - 0.5) < 0.002) ? null : { cx: r3(fr.cx), cy: r3(fr.cy), z: r3(fr.z), a: r3(fr.a) };
      if (fr.kind === 'main') { form.imgF = out; var pp = document.getElementById('pic-prev'); if (pp) pp.innerHTML = picPrev(); }
      else if (form.pics[fr.i]) { if (out) form.pics[fr.i].f = out; else delete form.pics[fr.i].f; var ps = document.getElementById('pics-prev'); if (ps) ps.innerHTML = picsPrev(); }
      closeFrame();
    }
  });
  frameRoot.addEventListener('input', function (ev) { if (fr && ev.target.id === 'fr-z') { fr.z = parseFloat(ev.target.value) || 1; frApply(); } });
  (function () {
    var drag = null;
    frameRoot.addEventListener('pointerdown', function (ev) { var box = ev.target.closest && ev.target.closest('#fr-box'); if (!box || !fr) return; drag = { x: ev.clientX, y: ev.clientY, w: box.clientWidth, h: box.clientHeight }; try { box.setPointerCapture(ev.pointerId); } catch (e) {} ev.preventDefault(); });
    frameRoot.addEventListener('pointermove', function (ev) {
      if (!drag || !fr) return;
      var dx = ev.clientX - drag.x, dy = ev.clientY - drag.y; drag.x = ev.clientX; drag.y = ev.clientY;
      var k = fr.a / fr.bar, sx = Math.max(k, 1), sy = Math.max(1 / k, 1);
      fr.cx -= dx / (drag.w * fr.z * sx); fr.cy -= dy / (drag.h * fr.z * sy); frApply();
    });
    var end = function () { drag = null; };
    frameRoot.addEventListener('pointerup', end); frameRoot.addEventListener('pointercancel', end);
    frameRoot.addEventListener('keydown', function (ev) {
      if (!fr || !ev.target.closest || !ev.target.closest('#fr-box')) return;
      var d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key]; if (!d) return;
      ev.preventDefault(); fr.cx += d[0] * 0.02; fr.cy += d[1] * 0.02; frApply();
    });
  })();

  function bgField() {
    return ED.assets
      ? '<input type="file" id="bgpic" accept="image/*,video/mp4,video/webm,video/quicktime"><div class="pic-prev" id="bg-prev">' + bgPrev() + '</div><p class="m-help" id="bg-msg">A wide picture works best. A moving GIF stays animated, and a short MP4 video plays silently on a loop. It sits dimmed behind the title and fades away as visitors scroll down.</p>'
      : '<p class="m-help">Picture upload is not available in this view.</p>';
  }
  function bgPrev() {
    return form && form.bg ? (isVid(form.bg) ? '<video src="' + bgSrc(form.bg) + '" muted loop autoplay playsinline style="width:150px;height:auto"></video>' : '<img src="' + imgSrc(form.bg) + '" alt="">') + ' <button class="btn" type="button" data-m="rmbg">Remove background</button>' : '';
  }
  function normPics(a) { return (a || []).filter(picId).map(function (p) { var o = { id: picId(p), url: (p && p.url) || '' }; if (p && frameOk(p.f)) o.f = p.f; return o; }); }
  function picsField() {
    return ED.assets
      ? '<input type="file" id="pics" accept="image/*" multiple><div class="pic-prev" id="pics-prev">' + picsPrev() + '</div>' + linkOptions() + '<p class="m-help" id="pics-msg">You can choose several at once. They appear in a grid under the text. Add a link under any picture, such as its Mixcloud address, and visitors who click it will go there.</p>'
      : '<p class="m-help">Picture upload is not available in this view.</p>';
  }
  function linkOptions() {
    var e = form && form.id && S.entries[form.id];
    return '<datalist id="dl-links">' + ((e && e.links) || []).map(function (l) { return '<option value="' + esc(l[1]) + '">' + esc(l[0]) + '</option>'; }).join('') + '</datalist>';
  }
  function picBar() {
    var ta = modalRoot.querySelector('textarea[name="videos"]');
    var has = !!(ta && ta.value.split('\n').some(function (l) { var b = l.lastIndexOf('|'); return ytId((b > -1 ? l.slice(b + 1) : l).trim()); }));
    return has ? 16 / 9 : 4 / 3;
  }
  function picsPrev() {
    var bar = picBar();
    return ((form && form.pics) || []).map(function (p, i) {
      return '<span class="pp"><span class="pp-img" style="aspect-ratio:' + bar.toFixed(4) + '"><img src="' + imgSrc(p.id) + '" alt=""' + frameAttr(p.f, bar) + '><button class="btn" type="button" data-m="rmpics" data-i="' + i + '" aria-label="Remove picture ' + (i + 1) + '">&times;</button></span>' +
        '<input class="pp-url" type="text" data-i="' + i + '" list="dl-links" placeholder="Link for this picture (optional)" value="' + esc(p.url) + '" aria-label="Link for picture ' + (i + 1) + '">' +
        '<button class="btn pp-frame" type="button" data-m="frame" data-t="pic" data-i="' + i + '">' + (frameOk(p.f) ? 'Framing set, adjust' : 'Frame picture') + '</button></span>';
    }).join('');
  }
  function picPrev() {
    return form && form.img ? '<img src="' + imgSrc(form.img) + '" alt=""> <button class="btn" type="button" data-m="frame" data-t="main">' + (frameOk(form.imgF) ? 'Framing set, adjust' : 'Frame for home page') + '</button> <button class="btn" type="button" data-m="rmpic">Remove picture</button>' : '';
  }

  function prepImage(file, maxSide) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var im = new Image();
      var keep = file.type === 'image/gif' && file.size <= 18 * 1024 * 1024;
      im.onload = function () {
        if (keep) { URL.revokeObjectURL(url); resolve({ blob: file, w: im.naturalWidth }); return; }
        var max = maxSide || 1400, sc = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
        var w = Math.max(1, Math.round(im.naturalWidth * sc)), h = Math.max(1, Math.round(im.naturalHeight * sc));
        var c = document.createElement('canvas'); c.width = w; c.height = h;
        var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(im, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? resolve({ blob: b, w: w }) : reject(new Error('encode')); }, 'image/jpeg', 0.86);
      };
      im.onerror = function () { URL.revokeObjectURL(url); reject(new Error('read')); };
      im.src = url;
    });
  }
  function onPick(input) {
    var f = input.files && input.files[0];
    if (!f || !ED.assets) return;
    var msg = document.getElementById('pic-msg'), save = document.getElementById('m-save');
    msg.textContent = 'Uploading...'; form.uploading = true; save.disabled = true;
    prepImage(f).then(function (r) { return ED.assets.upload(r.blob, { type: r.blob.type || 'image/jpeg' }).then(function (res) { form.img = res.id; form.w = r.w; form.imgF = null; }); })
      .then(function () { msg.textContent = 'Uploaded.'; document.getElementById('pic-prev').innerHTML = picPrev(); },
        function (err) { msg.textContent = (err && err.code === 'too_large') ? 'That file is too large.' : 'Could not read or upload that picture. Try a JPEG or PNG.'; })
      .then(function () { form.uploading = false; save.disabled = false; input.value = ''; });
  }

  function onPickBg(input) {
    var f = input.files && input.files[0];
    if (!f || !ED.assets || !form) return;
    var msg = document.getElementById('bg-msg'), save = document.getElementById('m-save');
    msg.textContent = 'Uploading...'; form.uploading = true; if (save) save.disabled = true;
    var isV = /^video\//.test(f.type);
    if (isV && f.size > 19 * 1024 * 1024) { msg.textContent = 'That video is too large. Keep it under about 19 MB.'; form.uploading = false; if (save) save.disabled = false; input.value = ''; return; }
    (isV ? ED.assets.upload(f, { type: f.type }).then(function (res) { form.bg = 'v:' + res.id; })
         : prepImage(f, 2200).then(function (r) { return ED.assets.upload(r.blob, { type: r.blob.type || 'image/jpeg' }).then(function (res) { form.bg = res.id; }); }))
      .then(function () { msg.textContent = 'Uploaded.'; document.getElementById('bg-prev').innerHTML = bgPrev(); },
        function (err) { msg.textContent = (err && err.code === 'too_large') ? 'That file is too large.' : 'Could not read or upload that picture. Try a JPEG or PNG.'; })
      .then(function () { form.uploading = false; if (save) save.disabled = false; input.value = ''; });
  }

  function onPickMany(input) {
    var files = Array.prototype.slice.call(input.files || []);
    if (!files.length || !ED.assets || !form) return;
    var msg = document.getElementById('pics-msg'), save = document.getElementById('m-save'), prev = document.getElementById('pics-prev');
    form.uploading = true; if (save) save.disabled = true;
    var fail = 0, n = 0;
    files.reduce(function (p, f) {
      return p.then(function () {
        msg.textContent = 'Uploading ' + (++n) + ' of ' + files.length + '...';
        return prepImage(f).then(function (r) { return ED.assets.upload(r.blob, { type: r.blob.type || 'image/jpeg' }); })
          .then(function (res) { form.pics.push({ id: res.id, url: '' }); prev.innerHTML = picsPrev(); }, function () { fail++; });
      });
    }, Promise.resolve()).then(function () {
      msg.textContent = fail ? (fail + ' picture' + (fail > 1 ? 's' : '') + ' could not be uploaded. Try JPEG or PNG.') : 'Uploaded.';
      form.uploading = false; if (save) save.disabled = false; input.value = '';
    });
  }

  function slug(t) { return String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'work'; }
  function newId(title) { var id; do { id = slug(title) + '-' + Math.random().toString(36).slice(2, 6); } while (S.entries[id]); return id; }

  function saveEntry(fd) {
    var title = (fd.get('title') || '').trim(), err = document.getElementById('m-err');
    var pages = fd.getAll('pg');
    if (!title) { err.textContent = 'Add a title.'; return; }
    if (!pages.length) { err.textContent = 'Choose at least one page to show it on.'; return; }
    var copy = (fd.get('copy') || '').split(/\n\s*\n/).map(function (s) { return s.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
    var facts = (fd.get('facts') || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
      var i = s.indexOf(':'); return i > 0 ? [s.slice(0, i).trim(), s.slice(i + 1).trim()] : ['Note', s];
    });
    var ll = fd.getAll('ll'), lu = fd.getAll('lu'), links = [];
    for (var i = 0; i < lu.length; i++) {
      var u = (lu[i] || '').trim(); if (!u) continue;
      if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
      if (!safeUrl(u)) continue;
      links.push([(ll[i] || '').trim() || 'Link', u]);
    }
    var videos = (fd.get('videos') || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean).map(function (l) {
      var bar = l.lastIndexOf('|'), title = bar > -1 ? l.slice(0, bar).trim() : '', u = (bar > -1 ? l.slice(bar + 1) : l).trim();
      if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
      return ytId(u) ? { url: u, title: title } : null;
    }).filter(Boolean);
    var old = form.isNew ? {} : S.entries[form.id];
    var id = form.isNew ? newId(title) : form.id;
    S.entries[id] = {
      title: title, role: (fd.get('role') || '').trim(), meta: (fd.get('meta') || '').trim(), size: fd.get('size') || 'full',
      copy: copy, facts: facts, links: links, img: form.img || null, imgF: (form.img && frameOk(form.imgF)) ? form.imgF : undefined, w: form.img ? form.w : 0, pics: packPics(form.pics), videos: videos, vfirst: old.vfirst ? true : undefined, mix: old.mix && old.mix.length ? old.mix : undefined, cols: parseInt(fd.get('cols'), 10) || undefined,
      alt: old.alt || '', ph: form.img ? '' : (old.ph || ''), todo: ''
    };
    var pos = fd.get('pos') || 'bottom';
    PAGE_KEYS.forEach(function (k) {
      var has = S.order[k].indexOf(id) > -1, want = pages.indexOf(k) > -1;
      if (want && !has) { if (pos === 'top') S.order[k].unshift(id); else S.order[k].push(id); }
      if (!want && has) S.order[k] = S.order[k].filter(function (x) { return x !== id; });
    });
    var feat = !!fd.get('feat'), f = S.home.featured || (S.home.featured = []);
    var at = f.indexOf(id);
    if (feat && at < 0) f.unshift(id);
    if (!feat && at > -1) f.splice(at, 1);
    closeModal();
    changed();
  }

  function openPageForm(k) {
    var P = S.pages[k];
    form = { page: k, bg: P.bg || null, pics: normPics(P.pics), uploading: false };
    openModal('<form class="m-card" id="page-form" novalidate><h2>Edit page text</h2>' +
      '<label>Page introduction<textarea name="intro" rows="4">' + esc(P.intro) + '</textarea></label>' +
      '<label>Short description on the home page<input type="text" name="blurb" value="' + esc(P.blurb) + '"></label>' +
      '<label>Clients line, separated by commas (leave empty for none)<input type="text" name="clients" value="' + esc((P.clients || []).join(', ')) + '"><span class="m-help">A name links to the project that mentions it, or write Name|https://address</span></label>' +
      '<label>Heading above the clients line<input type="text" name="clabel" value="' + esc(P.clientsLabel || '') + '" placeholder="Worked with"></label>' +
      '<fieldset><legend>Background picture behind the title</legend>' + bgField() + '</fieldset>' +
      '<fieldset><legend>Pictures at the top of this page</legend>' + picsField() + '</fieldset>' +
      ((k === 'film' || (P.carousel && P.carousel.length)) ? '<fieldset><legend>Films carousel at the top of this page</legend><label>Heading above the carousel<input type="text" name="ctitle" value="' + esc(P.carouselTitle || 'Films') + '"></label><textarea name="carousel" rows="8" placeholder="Film title | https://www.youtube.com/watch?v=...">' + esc(videosText(P.carousel)) + '</textarea><span class="m-help">One film per line: the title, then |, then the YouTube link. The thumbnail has to be added to the site first, so send new links to Claude and the picture will appear.</span></fieldset>' : '') +
      '<p class="m-err" id="m-err" role="alert"></p><div class="m-actions"><button class="btn" type="button" data-m="cancel">Cancel</button><button class="btn" type="submit" id="m-save">Save</button></div></form>');
  }
  function savePage(fd) {
    var P = S.pages[form.page];
    P.intro = (fd.get('intro') || '').trim(); P.blurb = (fd.get('blurb') || '').trim();
    P.clients = (fd.get('clients') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    P.clientsLabel = (fd.get('clabel') || '').trim(); P.pics = packPics(form.pics); if ((form.bg || null) !== (P.bg || null)) delete P.bgFocus; P.bg = form.bg || null;
    if (fd.has('carousel')) P.carousel = parseVideos(fd.get('carousel'));
    if (fd.has('ctitle')) P.carouselTitle = (fd.get('ctitle') || '').trim() || 'Films';
    closeModal(); changed();
  }
  function openHomeForm() {
    var h = S.home;
    form = { home: true, bg: S.home.bg || null, pics: normPics(S.home.pics), uploading: false };
    openModal('<form class="m-card" id="home-form" novalidate><h2>Edit home text</h2>' +
      '<label>Tagline<textarea name="tagline" rows="4">' + esc(h.tagline) + '</textarea></label>' +
      '<label>Note under the tagline (optional)<input type="text" name="note" value="' + esc(h.note) + '"></label>' +
      '<label>Roles line, separated by slashes<input type="text" name="roles" value="' + esc(h.roles) + '"></label>' +
      '<label>Clients and partners, separated by commas<textarea name="clients" rows="3">' + esc((h.clients || []).join(', ')) + '</textarea><span class="m-help">A name links to the project that mentions it. To link a name to a web address instead, write Name|https://address</span></label>' +
      '<fieldset><legend>Background picture behind the name</legend>' + bgField() + '</fieldset>' +
      '<fieldset><legend>Pictures on the home page</legend>' + picsField() + '</fieldset>' +
      '<fieldset><legend>Highlights carousel above the contents</legend><label>Heading above the carousel<input type="text" name="ctitle" value="' + esc(h.carouselTitle || 'Highlights') + '"></label><textarea name="carousel" rows="8" placeholder="Film title | https://www.youtube.com/watch?v=...">' + esc(videosText(h.carousel)) + '</textarea><span class="m-help">One film per line: the title, then |, then the YouTube link. The thumbnail has to be added to the site first, so send new links to Claude and the picture will appear.</span></fieldset>' +
      '<div class="m-actions"><button class="btn" type="button" data-m="cancel">Cancel</button><button class="btn" type="submit" id="m-save">Save</button></div></form>');
  }
  function saveHome(fd) {
    var h = S.home;
    h.tagline = (fd.get('tagline') || '').trim(); h.note = (fd.get('note') || '').trim(); h.roles = (fd.get('roles') || '').trim();
    h.clients = (fd.get('clients') || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    h.pics = packPics(form.pics); if ((form.bg || null) !== (h.bg || null)) delete h.bgFocus; h.bg = form.bg || null;
    h.carousel = parseVideos(fd.get('carousel')); h.carouselTitle = (fd.get('ctitle') || '').trim() || 'Highlights';
    closeModal(); changed();
  }

  /* ---------------------------------------------------------------- events */
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    var mv = t.closest && t.closest('[data-mv]');
    if (mv) {
      ev.preventDefault(); ev.stopPropagation();
      var kind = mv.getAttribute('data-mv'), mact = mv.getAttribute('data-mvact'), mid = mv.getAttribute('data-id');
      if (kind === 'mix') {
        var ent = S.entries[mid], seq = ent ? mixSeq(ent) : [], p0 = seq.indexOf(mv.getAttribute('data-key')), p1 = p0 + parseInt(mv.getAttribute('data-d'), 10);
        if (ent && p0 > -1 && p1 >= 0 && p1 < seq.length) { var tt = seq[p0]; seq[p0] = seq[p1]; seq[p1] = tt; ent.mix = seq; delete ent.vfirst; confirmKey = null; changed(); }
        return;
      }
      var mhost = mact === 'edit-home' ? S.home : mact === 'edit-page' ? S.pages[mv.getAttribute('data-page')] : S.entries[mid];
      var mi = parseInt(mv.getAttribute('data-i'), 10), md = parseInt(mv.getAttribute('data-d'), 10), field = kind === 'vid' ? 'videos' : 'pics';
      if (mhost) {
        var arr = (mhost[field] || []).filter(function (x) { return kind === 'vid' ? (x && ytId(x.url)) : picId(x); }), j = mi + md;
        if (j >= 0 && j < arr.length) { var tmp = arr[mi]; arr[mi] = arr[j]; arr[j] = tmp; mhost[field] = arr; confirmKey = null; changed(); }
      }
      return;
    }
    var rb = t.closest && t.closest('[data-rm]');
    if (rb) {
      ev.preventDefault(); ev.stopPropagation();
      var ck = rb.getAttribute('data-ck'), at = rb.getAttribute('data-rm'), ix = parseInt(rb.getAttribute('data-i'), 10);
      if (confirmKey !== ck) { confirmKey = ck; render(); return; }
      var host = at === 'edit-home' ? S.home : at === 'edit-page' ? S.pages[rb.getAttribute('data-page')] : S.entries[rb.getAttribute('data-id')];
      if (host) { host.pics = (host.pics || []).filter(picId); host.pics.splice(ix, 1); }
      confirmKey = null; changed(); return;
    }
    var m = t.closest && t.closest('[data-m]');
    if (m) {
      var a = m.getAttribute('data-m');
      if (a === 'cancel') closeModal();
      else if (a === 'addlink') { document.getElementById('lrows').insertAdjacentHTML('beforeend', linkRow('', '')); }
      else if (a === 'rmlink') { var row = m.closest('.lrow'); if (document.querySelectorAll('.lrow').length > 1) row.remove(); else row.querySelectorAll('input').forEach(function (i) { i.value = ''; }); }
      else if (a === 'rmbg') { form.bg = null; document.getElementById('bg-prev').innerHTML = ''; }
      else if (a === 'rmpics') { form.pics.splice(parseInt(m.getAttribute('data-i'), 10), 1); document.getElementById('pics-prev').innerHTML = picsPrev(); }
      else if (a === 'frame') openFrame(m.getAttribute('data-t'), parseInt(m.getAttribute('data-i'), 10));
      else if (a === 'rmpic') { form.img = null; form.imgF = null; form.w = 0; document.getElementById('pic-prev').innerHTML = ''; }
      return;
    }
    var sc = t.closest && t.closest('[data-scroll]');
    if (sc) { ev.preventDefault(); scrollToId(sc.getAttribute('data-scroll')); var nav = document.getElementById('nav'); if (nav) nav.classList.remove('open'); return; }
    var g = t.closest && t.closest('[data-goto]');
    if (g) { ev.preventDefault(); var id = g.getAttribute('data-goto'), pk = pageOf(id); if (pk) goto(pk, 'e-' + id); return; }
    var b = t.closest && t.closest('[data-act]');
    if (b) {
      var act = b.getAttribute('data-act');
      var tl = b.closest('.ed-tools');
      var page = tl ? tl.getAttribute('data-page') : b.getAttribute('data-page');
      var eid = tl ? tl.getAttribute('data-id') : b.getAttribute('data-id');
      if (act === 'menu') { var n = document.getElementById('nav'); var o = n.classList.toggle('open'); b.setAttribute('aria-expanded', o ? 'true' : 'false'); }
      else if (act === 'copy-email') copyEmail(b);
      else if (act === 'toggle-edit') { ED.on = !ED.on; confirmKey = null; render(); }
      else if (act === 'publish') publish();
      else if (act === 'discard') discard();
      else if (act === 'add') openEntryForm(null, page);
      else if (act === 'edit') openEntryForm(eid, page);
      else if (act === 'up') moveEntry(page, eid, -1);
      else if (act === 'down') moveEntry(page, eid, 1);
      else if (act === 'remove') { var ck = page + ':' + eid; if (confirmKey === ck) removeEntry(page, eid); else { confirmKey = ck; render(); } }
      else if (act === 'edit-page') openPageForm(page);
      else if (act === 'edit-home') openHomeForm();
    }
  });
  document.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = ev.target;
    if (form && form.uploading) return;
    if (f.id === 'entry-form') saveEntry(new FormData(f));
    else if (f.id === 'page-form') savePage(new FormData(f));
    else if (f.id === 'home-form') saveHome(new FormData(f));
  });
  document.addEventListener('change', function (ev) { var t = ev.target; if (!t) return; if (t.id === 'pic') onPick(t); else if (t.id === 'pics') onPickMany(t); else if (t.id === 'bgpic') onPickBg(t); });
  document.addEventListener('input', function (ev) { var t = ev.target; if (t && t.classList && t.classList.contains('pp-url') && form && form.pics) { var p = form.pics[parseInt(t.getAttribute('data-i'), 10)]; if (p) p.url = t.value; } });
  document.addEventListener('error', function (ev) {
    var t = ev.target;
    if (!t || !t.classList || !t.classList.contains('yt-img')) return;
    var id = t.getAttribute('data-yt');
    if (t.src.indexOf('/thumbs/') > -1) t.src = 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg';
    else if (t.src.indexOf('maxresdefault') > -1) t.src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
    else t.parentNode.classList.add('yt-fail');
  }, true);
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { if (fr) closeFrame(); else if (form) closeModal(); } });
  document.addEventListener('click', function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-reel]') : null;
    if (b) { var tr = b.parentNode.querySelector('.reel-track'); reelAuto.until = Date.now() + 2800; if (tr) tr.scrollBy({ left: parseInt(b.getAttribute('data-reel'), 10) * Math.max(200, tr.clientWidth * 0.8), behavior: 'smooth' }); return; }
    if (reelMoved) { var t = ev.target.closest ? ev.target.closest('.reel-tile') : null; if (t) { ev.preventDefault(); ev.stopPropagation(); } reelMoved = false; }
  }, true);
  var reelDrag = null, reelMoved = false;
  var reelAuto = { hover: false, until: 0, last: 0, pos: 0, el: null, still: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)') };
  document.addEventListener('mouseover', function (ev) { reelAuto.hover = !!(ev.target.closest && ev.target.closest('.reel-wrap')); });
  document.addEventListener('mouseleave', function () { reelAuto.hover = false; });
  ['touchstart', 'touchmove', 'touchend', 'wheel'].forEach(function (n) {
    document.addEventListener(n, function (ev) { if (ev.target.closest && ev.target.closest('.reel-wrap')) reelAuto.until = Date.now() + (n === 'touchend' ? 3500 : 4500); }, { passive: true });
  });
  function reelKeyboard() { try { var a = document.activeElement; return !!(a && a.closest && a.closest('.reel-wrap') && a.matches(':focus-visible')); } catch (e) { return false; } }
  function reelTick(ts) {
    requestAnimationFrame(reelTick);
    var dt = reelAuto.last ? Math.min(64, ts - reelAuto.last) : 16; reelAuto.last = ts;
    var tr = document.querySelector('.reel-track[data-loop]');
    if (!tr) { reelAuto.el = null; return; }
    var tiles = tr.querySelectorAll('.reel-tile'), n = tiles.length / 3;
    if (n < 2) return;
    var setW = tiles[n].offsetLeft - tiles[0].offsetLeft;
    if (setW < tr.clientWidth * 1.2) return;
    if (tr !== reelAuto.el) { reelAuto.el = tr; tr.scrollLeft = setW; reelAuto.pos = setW; }
    var now = Date.now(), moving = now < reelAuto.until;
    var r = tr.getBoundingClientRect(), seen = r.bottom > 0 && r.top < window.innerHeight;
    var paused = reelAuto.hover || moving || reelDrag || form || document.hidden || !seen || (reelAuto.still && reelAuto.still.matches) || reelKeyboard();
    var sl = tr.scrollLeft;
    if (Math.abs(sl - reelAuto.pos) > 3) reelAuto.pos = sl;
    if (paused) reelAuto.pos = sl; else { reelAuto.pos += dt * 0.036; tr.scrollLeft = reelAuto.pos; sl = reelAuto.pos; }
    if (!moving) {
      if (sl >= setW * 1.5) { reelAuto.pos = sl - setW; tr.scrollLeft = reelAuto.pos; }
      else if (sl < setW * 0.5) { reelAuto.pos = sl + setW; tr.scrollLeft = reelAuto.pos; }
    }
  }
  requestAnimationFrame(reelTick);
  document.addEventListener('pointerdown', function (ev) {
    if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
    var tr = ev.target.closest ? ev.target.closest('.reel-track') : null; if (!tr) return;
    reelDrag = { tr: tr, x: ev.clientX, left: tr.scrollLeft, moved: false }; reelMoved = false;
  });
  document.addEventListener('pointermove', function (ev) {
    if (!reelDrag) return;
    var dx = ev.clientX - reelDrag.x;
    if (!reelDrag.moved && Math.abs(dx) > 6) { reelDrag.moved = true; reelDrag.tr.classList.add('dragging'); }
    if (reelDrag.moved) reelDrag.tr.scrollLeft = reelDrag.left - dx;
  });
  function endReelDrag() { if (!reelDrag) return; reelDrag.tr.classList.remove('dragging'); reelMoved = reelDrag.moved; reelDrag = null; if (reelMoved) setTimeout(function () { reelMoved = false; }, 60); }
  document.addEventListener('pointerup', endReelDrag);
  document.addEventListener('pointercancel', endReelDrag);
  window.addEventListener('hashchange', render);

  function copyEmail(btn) {
    var done = function (m) { btn.textContent = m; setTimeout(function () { btn.textContent = 'Copy address'; }, 1800); };
    var sel = function () { var el = document.getElementById('email-text'); if (el) { var r = document.createRange(); r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } done('Selected'); };
    try { navigator.clipboard.writeText(EMAIL).then(function () { done('Copied'); }, sel); } catch (e) { sel(); }
  }

  /* ---------------------------------------------------------------- boot */
  render();

  // restore an unpublished draft for editors only, once we know who is viewing
  function restoreDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY); if (!raw) return;
      var d = JSON.parse(raw), cur = JSON.stringify(PUBLISHED);
      if (JSON.stringify(d.data) === cur) { localStorage.removeItem(DRAFT_KEY); return; }
      if (JSON.stringify(d.base) === cur) { S = d.data; ED.dirty = true; ED.on = true; render(); }
      else localStorage.removeItem(DRAFT_KEY);
    } catch (e) { /* ignore */ }
  }
  if (window.claude && typeof window.claude.use === 'function') {
    Promise.all([window.claude.use('user'), window.claude.use('artifact'), window.claude.use('assets')]).then(function (r) {
      var user = r[0]; ED.artifact = r[1]; ED.assets = r[2];
      if (!user || !ED.artifact) return;
      return user.canEdit().then(function (ok) {
        if (!ok) return;
        ED.can = true; renderBar(); restoreDraft();
      });
    }).catch(function () { /* stay read-only */ });
  }
})();
