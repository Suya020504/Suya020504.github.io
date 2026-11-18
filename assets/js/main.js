/* 이연수 portfolio — progressive enhancement only. Every piece of content is in the HTML;
   if this file fails to load, the page still shows everything (filters simply stay hidden). */
(function () {
  'use strict';
  var doc = document;
  var root = doc.documentElement;
  root.classList.add('js');

  var mq = function (q) { return window.matchMedia ? window.matchMedia(q) : { matches: false }; };
  var reduceMotion = mq('(prefers-reduced-motion: reduce)').matches;
  var toArray = function (list) { return Array.prototype.slice.call(list || []); };

  function storeSet(key, val) { try { window.localStorage.setItem(key, val); } catch (e) { /* storage blocked */ } }

  /* ---------- theme toggle (initial value is applied by the inline <head> script) ---------- */
  var themeBtn = doc.querySelector('[data-theme-toggle]');
  var darkMq = mq('(prefers-color-scheme: dark)');
  function currentTheme() {
    var t = root.getAttribute('data-theme');
    if (t === 'light' || t === 'dark') return t;
    return darkMq.matches ? 'dark' : 'light';
  }
  function syncThemeBtn() {
    if (themeBtn) themeBtn.setAttribute('aria-pressed', currentTheme() === 'dark' ? 'true' : 'false');
  }
  if (themeBtn) {
    syncThemeBtn();
    themeBtn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      storeSet('theme', next);
      syncThemeBtn();
    });
    if (darkMq.addEventListener) darkMq.addEventListener('change', syncThemeBtn);
  }

  /* ---------- top bar: mobile menu + "더 보기" disclosure ---------- */
  var header = doc.querySelector('.site-header');
  var menuBtn = doc.querySelector('[data-menu-toggle]');
  var nav = doc.getElementById('primary-nav');
  var navMore = doc.querySelector('[data-nav-more]');
  var moreBtn = navMore ? navMore.querySelector('[data-nav-more-btn]') : null;
  var moreList = moreBtn ? doc.getElementById(moreBtn.getAttribute('aria-controls')) : null;
  var isEsc = function (e) { return e.key === 'Escape' || e.key === 'Esc'; };
  function menuOpen() { return !!menuBtn && menuBtn.getAttribute('aria-expanded') === 'true'; }
  function moreOpen() { return !!moreBtn && moreBtn.getAttribute('aria-expanded') === 'true'; }
  function moreLinks() { return moreList ? toArray(moreList.querySelectorAll('a')) : []; }
  function setMore(open, returnFocus) {
    if (!moreBtn) return;
    moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (navMore) navMore.classList.toggle('is-open', open);
    if (!open && returnFocus) moreBtn.focus();
  }
  function setMenu(open, returnFocus) {
    if (!header || !menuBtn) return;
    header.classList.toggle('nav-open', open);
    setMore(false, false); // phones: style.css lists the 더 보기 items flat in the panel (no toggle), keep it collapsed
    menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false'); // fixed aria-label "메뉴": state comes from aria-expanded only
    if (open) {
      var first = nav && nav.querySelector('a');
      if (first) first.focus({ preventScroll: true }); // opening the panel must not move the page (scrollspy keeps its tab)
    } else if (returnFocus) {
      menuBtn.focus();
    }
  }
  if (header && menuBtn && nav) {
    menuBtn.addEventListener('click', function () { setMenu(!menuOpen(), false); });
    nav.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('a') && menuOpen()) setMenu(false, false); });
    var desk = mq('(min-width: 861px)'); // style.css: hamburger at max-width 860px
    if (desk.addEventListener) desk.addEventListener('change', function (m) { if (m.matches && menuOpen()) setMenu(false, false); });
  }
  if (moreBtn && moreList) {
    moreBtn.addEventListener('click', function () { setMore(!moreOpen(), false); });
    // keyboard: ↓ on the button opens and focuses the first item; ↑/↓/Home/End move inside the list
    navMore.addEventListener('keydown', function (e) {
      var links = moreLinks();
      var i = links.indexOf(doc.activeElement);
      if (e.target === moreBtn && (e.key === 'ArrowDown' || e.key === 'Down')) {
        e.preventDefault(); setMore(true, false); if (links[0]) links[0].focus();
      } else if (i > -1 && (e.key === 'ArrowDown' || e.key === 'Down')) {
        e.preventDefault(); links[(i + 1) % links.length].focus();
      } else if (i > -1 && (e.key === 'ArrowUp' || e.key === 'Up')) {
        e.preventDefault(); if (i > 0) links[i - 1].focus(); else if (moreBtn.offsetParent) moreBtn.focus();
      } else if (i > -1 && e.key === 'Home') {
        e.preventDefault(); links[0].focus();
      } else if (i > -1 && e.key === 'End') {
        e.preventDefault(); links[links.length - 1].focus();
      }
    });
    moreList.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a') && !menuOpen()) setMore(false, false);
    });
    navMore.addEventListener('focusout', function (e) {
      if (!menuOpen() && moreOpen() && e.relatedTarget && !navMore.contains(e.relatedTarget)) setMore(false, false);
    });
  }
  // one Esc handler: the open dropdown closes first (focus back on "더 보기"), then the phone menu
  doc.addEventListener('keydown', function (e) {
    if (!isEsc(e)) return;
    if (moreOpen() && !menuOpen()) { e.preventDefault(); setMore(false, true); }
    else if (menuOpen()) { e.preventDefault(); setMenu(false, true); }
  });
  doc.addEventListener('click', function (e) {
    if (menuOpen()) { if (header && !header.contains(e.target)) setMenu(false, false); return; }
    if (moreOpen() && navMore && !navMore.contains(e.target)) setMore(false, false);
  });

  /* ---------- scrollspy (index only: links carry data-spy="sectionId otherId") ---------- */
  var spyLinks = toArray(doc.querySelectorAll('[data-spy]'));
  if (spyLinks.length && 'IntersectionObserver' in window) {
    var owner = {};
    var order = [];
    spyLinks.forEach(function (a) {
      (a.getAttribute('data-spy') || '').split(/\s+/).forEach(function (id) {
        var el = id && doc.getElementById(id);
        if (el) { owner[id] = a; order.push(el); }
      });
    });
    order.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; }); // document order
    var inBand = {};
    var markActive = function () {
      var active = null;
      // scrolled to the very bottom: the last section owns the tab even if it is too short to reach the band
      var atEnd = window.innerHeight + (window.pageYOffset || 0) >= doc.documentElement.scrollHeight - 4;
      if (atEnd && order.length) active = owner[order[order.length - 1].id];
      order.forEach(function (el) { if (!active && inBand[el.id]) active = owner[el.id]; });
      spyLinks.forEach(function (a) {
        if (a === active) a.setAttribute('aria-current', 'location');
        else a.removeAttribute('aria-current');
      });
      if (navMore) navMore.classList.toggle('has-current', !!(active && navMore.contains(active)));
    };
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { inBand[en.target.id] = en.isIntersecting; });
      markActive();
    }, { rootMargin: '-38% 0px -58% 0px' });
    order.forEach(function (el) { spy.observe(el); });
    window.addEventListener('scroll', function () {
      var atEnd = window.innerHeight + (window.pageYOffset || 0) >= doc.documentElement.scrollHeight - 4;
      if (atEnd !== markActive.lastEnd) { markActive.lastEnd = atEnd; markActive(); }
    }, { passive: true });
  }

  /* ---------- project filter (chips aria-pressed, 수상작만 toggle, aria-live count, ?cat= sync) ---------- */
  var archive = doc.querySelector('[data-archive]');
  if (archive) {
    var bar = archive.querySelector('[data-filters]');
    var cards = toArray(archive.querySelectorAll('[data-card]'));
    var countEl = archive.querySelector('[data-count]');
    var emptyEl = archive.querySelector('[data-empty]');
    var catBtns = bar ? toArray(bar.querySelectorAll('[data-cat]')) : [];
    var awardBtn = bar ? bar.querySelector('[data-award-toggle]') : null;
    var featWrap = archive.querySelector('[data-featured-wrap]');
    var featBtn = archive.querySelector('[data-featured-toggle]');
    var nFeatured = cards.filter(function (c) { return c.hasAttribute('data-featured'); }).length;
    var phone = mq('(max-width: 720px)');
    var validCats = catBtns.map(function (b) { return b.getAttribute('data-cat'); });
    var state = { cat: 'all', award: false, showFeatured: false };
    try {
      var params = new URLSearchParams(window.location.search);
      var qc = params.get('cat');
      if (qc && validCats.indexOf(qc) > -1) state.cat = qc;
      state.award = params.get('award') === '1';
    } catch (e) { /* old browser: keep defaults */ }

    var apply = function (syncUrl) {
      var shown = 0;
      var isDefault = state.cat === 'all' && !state.award;
      // phones: the portfolio projects are already shown above, so the default view folds them away
      var fold = isDefault && phone.matches && nFeatured > 0 && !state.showFeatured;
      archive.classList.toggle('fold-featured', fold);
      cards.forEach(function (card) {
        var cats = (card.getAttribute('data-cats') || '').split(/\s+/);
        var ok = (state.cat === 'all' || cats.indexOf(state.cat) > -1) &&
                 (!state.award || card.getAttribute('data-award') === '1');
        card.hidden = !ok;
        if (ok && !(fold && card.hasAttribute('data-featured'))) shown += 1;
      });
      catBtns.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-cat') === state.cat ? 'true' : 'false'); });
      if (awardBtn) awardBtn.setAttribute('aria-pressed', state.award ? 'true' : 'false');
      if (featWrap) featWrap.hidden = !(isDefault && phone.matches && nFeatured > 0);
      if (featBtn) featBtn.setAttribute('aria-pressed', state.showFeatured ? 'true' : 'false');
      if (countEl) {
        // name the active filter so the live region makes sense on its own
        var active = catBtns.filter(function (b) { return b.getAttribute('data-cat') === state.cat; })[0];
        var label = (active ? (active.getAttribute('data-label') || active.textContent) : '전체') + (state.award ? ' · 수상작' : '');
        if (isDefault && !fold) countEl.textContent = '전체 ' + cards.length + '개 프로젝트';
        else if (fold) countEl.textContent = '전체 ' + cards.length + '개 중 ' + shown + '개 표시 · 대표 프로젝트 ' + nFeatured + '개는 포트폴리오에 있습니다';
        else countEl.textContent = label + ': ' + cards.length + '개 중 ' + shown + '개 표시';
      }
      if (emptyEl) emptyEl.hidden = shown !== 0;
      if (syncUrl && window.history && window.history.replaceState) {
        try {
          var url = new URL(window.location.href);
          if (state.cat === 'all') url.searchParams.delete('cat'); else url.searchParams.set('cat', state.cat);
          if (state.award) url.searchParams.set('award', '1'); else url.searchParams.delete('award');
          window.history.replaceState(null, '', url.pathname + url.search + url.hash);
        } catch (e) { /* ignore */ }
      }
    };
    catBtns.forEach(function (b) {
      b.addEventListener('click', function () { state.cat = b.getAttribute('data-cat'); apply(true); });
    });
    if (awardBtn) awardBtn.addEventListener('click', function () { state.award = !state.award; apply(true); });
    if (featBtn) featBtn.addEventListener('click', function () { state.showFeatured = !state.showFeatured; apply(false); });
    if (phone.addEventListener) phone.addEventListener('change', function () { apply(false); });
    toArray(archive.querySelectorAll('[data-filter-reset]')).forEach(function (b) {
      b.addEventListener('click', function () {
        state.cat = 'all'; state.award = false; apply(true);
        if (catBtns[0]) catBtns[0].focus();
      });
    });
    if (bar) bar.hidden = false;
    apply(false);
  }

  /* ---------- reveal on scroll (skipped entirely under reduced motion) ---------- */
  var revealEls = toArray(doc.querySelectorAll('.reveal'));
  if (!reduceMotion && revealEls.length && 'IntersectionObserver' in window) {
    root.classList.add('reveal-ready');
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); rio.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
    revealEls.forEach(function (el) { rio.observe(el); });
  }

  /* ---------- hero: pause the endless light drift + glass float while the hero is off-screen ---------- */
  var hero = doc.querySelector('.hero');
  if (hero && !reduceMotion && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      hero.classList.toggle('is-offscreen', !entries[entries.length - 1].isIntersecting);
    }).observe(hero);
  }

  /* ---------- slide figure zoom via <dialog> (links still open the image without JS) ---------- */
  var dlg = doc.querySelector('[data-zoom-dialog]');
  if (dlg && typeof dlg.showModal === 'function') {
    var stage = dlg.querySelector('[data-zoom-stage]');
    var cap = dlg.querySelector('[data-zoom-caption]');
    var closeBtn = dlg.querySelector('[data-zoom-close]');
    var opener = null;
    doc.addEventListener('click', function (e) {
      var a = e.target.closest ? e.target.closest('[data-zoom]') : null;
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      opener = a;
      var thumb = a.querySelector('img');
      var img = doc.createElement('img');
      img.src = a.getAttribute('href');
      img.alt = thumb ? thumb.alt : '';
      img.decoding = 'async';
      // natural size (data-w / data-h): reserves the space before the file arrives and caps the zoom at 100%
      var w = parseInt(a.getAttribute('data-w'), 10), h = parseInt(a.getAttribute('data-h'), 10);
      if (w > 0 && h > 0) {
        img.width = w; img.height = h;
        img.style.setProperty('--zw', w + 'px');
        img.style.setProperty('--zh', h + 'px');
      }
      stage.textContent = '';
      stage.appendChild(img);
      if (cap) cap.textContent = a.getAttribute('data-caption') || '';
      dlg.showModal();
      root.classList.add('no-scroll');
      if (closeBtn) closeBtn.focus();
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    if (closeBtn) closeBtn.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('close', function () {
      root.classList.remove('no-scroll');
      stage.textContent = '';
      if (opener) opener.focus();
    });
  }

  /* ---------- header shadow + back-to-top ---------- */
  var toTop = doc.querySelector('[data-to-top]');
  if (toTop) {
    toTop.hidden = false;
    toTop.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      var mark = doc.querySelector('.wordmark');
      if (mark) mark.focus({ preventScroll: true });
    });
  }
  var ticking = false;
  function onScroll() {
    ticking = false;
    var y = window.pageYOffset || doc.documentElement.scrollTop || 0;
    if (header) header.classList.toggle('is-scrolled', y > 8);
    if (toTop) toTop.classList.toggle('is-visible', y > 900);
  }
  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------- v2.8 hero gradient (WebGL)
     Four colours from the theme tokens (--shader-1..4) drift slowly; re-read on theme change.
     Half resolution, ~30fps, paused off screen; under reduced motion it is not started (aurora stays). */
  (function () {
    var cv = doc.querySelector('.hero-shader');
    if (!cv || reduceMotion) return;
    var gl = cv.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;
    var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    var FS = 'precision mediump float;uniform vec2 r;uniform float t;uniform vec3 c0;uniform vec3 c1;uniform vec3 c2;uniform vec3 c3;' +
      'vec2 h(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return -1.+2.*fract(sin(p)*43758.5453);}' +
      'float n(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(dot(h(i),f),dot(h(i+vec2(1.,0.)),f-vec2(1.,0.)),u.x),mix(dot(h(i+vec2(0.,1.)),f-vec2(0.,1.)),dot(h(i+vec2(1.,1.)),f-vec2(1.,1.)),u.x),u.y);}' +
      'void main(){vec2 uv=gl_FragCoord.xy/r;vec2 q=uv*vec2(r.x/r.y,1.);' +
      'float a=n(q*1.05+vec2(t*.04,t*.026));float b=n(q*1.45-vec2(t*.03,-t*.022)+3.1);float c=n(q*.75+vec2(-t*.018,t*.035)+7.3);' +
      'vec3 col=mix(c0,c1,smoothstep(-.3,.7,a+uv.x*.85-.35));col=mix(col,c2,smoothstep(-.1,.8,b+(1.-uv.y)*.5-.3)*.8);' +
      'col=mix(col,c3,smoothstep(.1,.95,c+uv.y*.3)*.5);float g=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);col+=(g-.5)*.012;' +
      'gl_FragColor=vec4(col,1.);}';
    function sh(type, src) { var x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); return x; }
    var pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var uR = gl.getUniformLocation(pr, 'r'), uT = gl.getUniformLocation(pr, 't');
    function hex(v) { v = (v || '').trim().replace('#', ''); var n = parseInt(v, 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
    function colours() {
      var cs = getComputedStyle(root);
      ['c0', 'c1', 'c2', 'c3'].forEach(function (k, i) { gl.uniform3fv(gl.getUniformLocation(pr, k), hex(cs.getPropertyValue('--shader-' + (i + 1)))); });
      last = 0;
    }
    var visible = true, last = 0, t0 = performance.now(), seed = Math.random() * 50;
    colours();
    new MutationObserver(colours).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    var dm = mq('(prefers-color-scheme: dark)'); if (dm.addEventListener) dm.addEventListener('change', colours);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(cv);
    function frame(now) {
      if (visible && !doc.hidden && now - last > 33) {
        last = now;
        var w = Math.max(1, Math.round(cv.clientWidth * .5)), h = Math.max(1, Math.round(cv.clientHeight * .5));
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
        gl.uniform2f(uR, w, h); gl.uniform1f(uT, seed + (now - t0) / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      window.requestAnimationFrame(frame);
    }
    cv.classList.add('is-live');
    if (cv.parentElement) cv.parentElement.classList.add('has-shader');
    window.requestAnimationFrame(frame);
  })();

  /* ---------------------------------------------------------------- v2.8 periodic table: light one group */
  toArray(doc.querySelectorAll('[data-ptable]')).forEach(function (tb) {
    var els = toArray(tb.querySelectorAll('.el')), keys = toArray(tb.querySelectorAll('.pt-legend li'));
    function show(g) {
      tb.classList.add('is-focus');
      els.concat(keys).forEach(function (x) { x.classList.toggle('is-on', x.getAttribute('data-g') === g); });
    }
    function reset() { tb.classList.remove('is-focus'); els.concat(keys).forEach(function (x) { x.classList.remove('is-on'); }); }
    els.concat(keys).forEach(function (x) {
      x.addEventListener('mouseenter', function () { show(x.getAttribute('data-g')); });
      x.addEventListener('focus', function () { show(x.getAttribute('data-g')); });
      x.addEventListener('blur', reset);
    });
    tb.addEventListener('mouseleave', reset);
  });

  /* ---------------------------------------------------------------- v2.8 pointer spotlight (fine pointers) */
  if (!reduceMotion && mq('(hover: hover) and (pointer: fine)').matches) {
    doc.addEventListener('pointermove', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('.pf-card, .peak') : null;
      if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', Math.round(e.clientX - r.left) + 'px');
      el.style.setProperty('--my', Math.round(e.clientY - r.top) + 'px');
    }, { passive: true });
  }

  /* ---------------------------------------------------------------- v3 ask panel ("talking portfolio")
     Answers come from the page's JSON (built from content.json). Typing effect; optional Korean speech. */
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var synth = window.speechSynthesis || null, koVoice = null, voiceOn = false;
  function pickVoice() {
    if (!synth) return;
    koVoice = (synth.getVoices() || []).filter(function (v) { return /^ko([-_]|$)/i.test(v.lang); })[0] || null;
    toArray(doc.querySelectorAll('[data-voice]')).forEach(function (b) { b.hidden = !koVoice; });
  }
  if (synth) { pickVoice(); if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice); }
  function speak(text) {
    return new Promise(function (resolve) {
      if (!voiceOn || !synth || !koVoice) return resolve();
      var u = new SpeechSynthesisUtterance(text.replace(/[→·]/g, ' '));
      u.voice = koVoice; u.lang = koVoice.lang;
      var done = false, fin = function () { if (!done) { done = true; resolve(); } };
      u.onend = fin; u.onerror = fin; setTimeout(fin, 1200 + text.length * 170);
      synth.speak(u);
    });
  }
  toArray(doc.querySelectorAll('[data-voice]')).forEach(function (b) {
    b.addEventListener('click', function () {
      voiceOn = !voiceOn;
      toArray(doc.querySelectorAll('[data-voice]')).forEach(function (x) { x.setAttribute('aria-pressed', voiceOn ? 'true' : 'false'); });
      if (!voiceOn && synth) synth.cancel();
    });
  });
  toArray(doc.querySelectorAll('[data-talk]')).forEach(function (panel) {
    var dataEl = panel.querySelector('[data-talk-data]');
    if (!dataEl) return;
    var data = JSON.parse(dataEl.textContent), cast = data.cast || {};
    var log = panel.querySelector('[data-talk-log]'), chipsEl = panel.querySelector('[data-talk-chips]');
    var status = panel.querySelector('[data-talk-status]'), idle = status ? status.getAttribute('data-idle') : '';
    var speaker = panel.querySelector('[data-speaker]');
    var busy = false, hurry = false, queued = null, started = false;
    var pause = function (ms) { return hurry ? Promise.resolve() : wait(ms); };
    function setSpeaking(on) {
      if (speaker) speaker.classList.toggle('is-speaking', on);
      panel.classList.toggle('is-busy', on);
      if (status) status.textContent = on ? (cast.me && cast.me.name ? cast.me.name + ' 님이 답변하는 중' : '답변하는 중') : idle;
    }
    function scroll() { log.scrollTop = log.scrollHeight; }
    async function say(line) {
      var mine = line.who === 'visitor';
      var row = doc.createElement('div');
      row.className = 'msg' + (mine ? ' is-me' : '');
      if (!mine) {
        var av = doc.createElement('span'); av.className = 'msg-av';
        var t = panel.querySelector('template[data-cast="me"]');
        if (t) av.appendChild(t.content.cloneNode(true));
        row.appendChild(av);
      }
      var bubble = doc.createElement('div'); bubble.className = 'msg-bubble';
      if (!mine) { var nm = doc.createElement('span'); nm.className = 'msg-name'; nm.textContent = (cast.me && cast.me.name) || ''; bubble.appendChild(nm); }
      var text = doc.createElement('span'); bubble.appendChild(text);
      row.appendChild(bubble); log.appendChild(row); scroll();
      if (mine || reduceMotion || hurry) {
        text.textContent = line.text;
        if (!mine && voiceOn && !hurry) { setSpeaking(true); await speak(line.text); setSpeaking(false); }
      } else {
        setSpeaking(true);
        var dots = doc.createElement('span'); dots.className = 'typing'; dots.innerHTML = '<i></i><i></i><i></i>'; dots.setAttribute('aria-hidden', 'true');
        text.appendChild(dots);
        await pause(480);
        text.textContent = ''; text.setAttribute('aria-hidden', 'true');
        var spoken = speak(line.text), chs = Array.from(line.text), talking = voiceOn && koVoice;
        var per = talking ? 58 : 18, step = !talking && chs.length > 36 ? 2 : 1;
        for (var i = step; i <= chs.length + step - 1 && !hurry; i += step) {
          text.textContent = chs.slice(0, i).join('');
          if (i % 8 === 0) scroll();
          await pause(per);
        }
        text.textContent = line.text; text.removeAttribute('aria-hidden');
        await spoken; setSpeaking(false);
      }
      if (line.link) {
        var a = doc.createElement('a'); a.className = 'msg-link'; a.href = line.link.href; a.textContent = line.link.label; bubble.appendChild(a);
      }
      scroll();
      await pause(mine ? 200 : 280);
    }
    async function run(lines) {
      busy = true;
      for (var i = 0; i < lines.length; i++) await say(lines[i]);
      busy = false; hurry = false; setSpeaking(false);
      if (queued) { var next = queued; queued = null; run(next); }
    }
    function start() { if (!started) { started = true; run(data.intro || []); } }
    (data.chips || []).forEach(function (c) {
      var b = doc.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = c.q;
      b.addEventListener('click', function () {
        var ans = (c.a || []).slice();
        if (c.link && ans.length) ans[ans.length - 1] = { who: ans[ans.length - 1].who, text: ans[ans.length - 1].text, link: c.link };
        var lines = [{ who: 'visitor', text: c.q }].concat(ans);
        start();
        if (busy) { hurry = true; queued = lines; if (synth && voiceOn) synth.cancel(); return; }
        run(lines);
      });
      chipsEl.appendChild(b);
    });
    log.setAttribute('aria-live', 'polite');
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) {
        if (en.some(function (x) { return x.isIntersecting; })) { setTimeout(start, reduceMotion ? 0 : 500); io.disconnect(); }
      }, { threshold: 0.3 });
      io.observe(panel);
    } else start();
  });

  /* ---------------------------------------------------------------- v3 project cover-flow
     Native scroll + snap; cards turn slightly away from the centre. Drag (mouse), swipe (touch), arrows/keys.
     Advances every 5s while nobody interacts; stops off screen and under reduced motion. */
  toArray(doc.querySelectorAll('[data-rail]')).forEach(function (railEl) {
    var track = railEl.querySelector('.rail-track');
    var items = toArray(track.children), count = railEl.querySelector('[data-rail-count]');
    if (!items.length) return;
    var cur = 0, raf = 0, busyR = false, visible = true, idleT = 0;
    function update() {
      raf = 0;
      var tr = track.getBoundingClientRect(), mid = tr.left + tr.width / 2, half = tr.width / 2, best = 0, bestD = Infinity;
      items.forEach(function (it, i) {
        var r = it.getBoundingClientRect(), c = r.left + r.width / 2, d = (c - mid) / half, ad = Math.min(1, Math.abs(d));
        if (!reduceMotion) {
          it.style.setProperty('--ry', (Math.max(-1, Math.min(1, d)) * -14).toFixed(2) + 'deg');
          it.style.setProperty('--s', (1 - ad * 0.1).toFixed(3));
        }
        it.style.setProperty('--o', (1 - ad * 0.35).toFixed(3));
        if (Math.abs(c - mid) < bestD) { bestD = Math.abs(c - mid); best = i; }
      });
      items.forEach(function (it, i) { it.classList.toggle('is-center', i === best); });
      cur = best;
      if (count) count.textContent = (cur + 1) + ' / ' + items.length;
    }
    function queue() { if (!raf) raf = window.requestAnimationFrame(update); }
    function go(i) {
      i = (i + items.length) % items.length;
      var it = items[i];
      track.scrollTo({ left: it.offsetLeft - (track.clientWidth - it.offsetWidth) / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
    function hold() { busyR = true; clearTimeout(idleT); idleT = setTimeout(function () { busyR = false; }, 8000); }
    track.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    var prev = railEl.querySelector('[data-rail-prev]'), next = railEl.querySelector('[data-rail-next]');
    if (prev) prev.addEventListener('click', function () { hold(); go(cur - 1); });
    if (next) next.addEventListener('click', function () { hold(); go(cur + 1); });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); hold(); go(cur + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); hold(); go(cur - 1); }
    });
    railEl.addEventListener('pointerenter', function () { busyR = true; clearTimeout(idleT); });
    railEl.addEventListener('pointerleave', hold);
    railEl.addEventListener('focusin', function () { busyR = true; clearTimeout(idleT); });
    railEl.addEventListener('focusout', hold);
    track.addEventListener('touchstart', hold, { passive: true });
    var down = false, sx = 0, sl = 0, moved = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; sx = e.clientX; sl = track.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add('is-drag'); }
      if (moved) track.scrollLeft = sl - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      if (moved) { track.classList.remove('is-drag'); hold(); go(cur); }
    });
    track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(railEl);
    if (!reduceMotion) setInterval(function () { if (visible && !busyR && !doc.hidden) go(cur + 1); }, 5000);
    update();
  });

  /* ---------------------------------------------------------------- v3 footer: name in dots, pushed by the pointer */
  toArray(doc.querySelectorAll('[data-dots]')).forEach(function (wrap) {
    var canvas = wrap.querySelector('canvas'), label = wrap.querySelector('span');
    if (!canvas || !canvas.getContext) return;
    var ctx2 = canvas.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    var pts = [], W = 0, H = 0, mouse = { x: -9999, y: -9999 }, rafD = 0, gap = 7, R = 90;
    function colours() { var cs = getComputedStyle(root); return { base: cs.getPropertyValue('--dots-base').trim() || '#C9DDE5', hot: cs.getPropertyValue('--dots-hot').trim() || '29,111,150' }; }
    var col = colours();
    function build() {
      W = wrap.clientWidth; H = wrap.clientHeight;
      if (!W || !H) return;
      canvas.width = W * dpr; canvas.height = H * dpr; canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      var off = doc.createElement('canvas'); off.width = W; off.height = H;
      var o = off.getContext('2d'), fs = Math.min(H * 0.9, W / 6);
      o.font = '800 ' + fs + "px 'Pretendard Variable', Pretendard, sans-serif";
      o.textAlign = 'center'; o.textBaseline = 'middle'; o.fillStyle = '#000';
      o.fillText(label ? label.textContent : 'Lee Yeonsoo', W / 2, H / 2 + fs * 0.04);
      var px = o.getImageData(0, 0, W, H).data;
      pts = []; gap = W < 600 ? 5 : 7;
      for (var y = gap / 2; y < H; y += gap) for (var x = gap / 2; x < W; x += gap) {
        if (px[(Math.floor(y) * W + Math.floor(x)) * 4 + 3] > 128) pts.push({ hx: x, hy: y, x: x, y: y, vx: 0, vy: 0 });
      }
      wrap.classList.add('is-live'); draw();
    }
    function draw() {
      ctx2.setTransform(dpr, 0, 0, dpr, 0, 0); ctx2.clearRect(0, 0, W, H);
      var moving = false;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < R * R) { var d = Math.sqrt(d2) || 1, f = (1 - d / R) * 2.4; p.vx += dx / d * f; p.vy += dy / d * f; }
        p.vx += (p.hx - p.x) * 0.06; p.vy += (p.hy - p.y) * 0.06; p.vx *= 0.82; p.vy *= 0.82; p.x += p.vx; p.y += p.vy;
        if (Math.abs(p.vx) + Math.abs(p.vy) > 0.02) moving = true;
        var offd = Math.min(1, Math.sqrt((p.x - p.hx) * (p.x - p.hx) + (p.y - p.hy) * (p.y - p.hy)) / 18);
        ctx2.fillStyle = offd > 0.15 ? 'rgba(' + col.hot + ',' + (0.45 + offd * 0.55).toFixed(2) + ')' : col.base;
        ctx2.beginPath(); ctx2.arc(p.x, p.y, gap * 0.3, 0, 6.2832); ctx2.fill();
      }
      rafD = 0;
      if ((moving || mouse.x > -9000) && !reduceMotion) rafD = window.requestAnimationFrame(draw);
    }
    function kick() { if (!rafD && !reduceMotion) rafD = window.requestAnimationFrame(draw); }
    wrap.addEventListener('pointermove', function (e) { var r = wrap.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; kick(); });
    wrap.addEventListener('pointerleave', function () { mouse.x = mouse.y = -9999; kick(); });
    new MutationObserver(function () { col = colours(); draw(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 150); });
    (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(build);
  });

  /* ---------------------------------------------------------------- v3.10 hero background: flowing words (option E)
     Three rows of large keywords drift sideways in opposite directions behind the hero, like a motion poster:
     outlined in sky, the middle row filled faintly in mint. Rows come from data-rows ("A|B|C", built from
     content). ~30fps, paused off screen; reduced motion draws one still frame. Colours: --star / --star-2. */
  toArray(doc.querySelectorAll('[data-stars]')).forEach(function (cv) {
    var g = cv.getContext && cv.getContext('2d');
    if (!g) return;
    var host = cv.parentElement, dpr = Math.min(2, window.devicePixelRatio || 1);
    var W = 0, H = 0, rows = [], visible = true, last = 0, t0 = performance.now();
    var col = { a: '29,111,150', b: '26,122,96' };
    var FONT = "'Pretendard Variable', Pretendard, sans-serif";
    var words = (cv.getAttribute('data-rows') || 'DATA · AI · AX|AI 서비스 기획|FROM DATA TO SERVICE').split('|')
      .map(function (w) { return w.trim(); }).filter(Boolean);
    function readColours() {
      var cs = getComputedStyle(root);
      col.a = cs.getPropertyValue('--star').trim() || col.a;
      col.b = cs.getPropertyValue('--star-2').trim() || col.b;
    }
    function rgba(c, a) { return 'rgba(' + c + ',' + Math.max(0, Math.min(1, a)).toFixed(3) + ')'; }
    function setFont(px) {
      g.font = '800 ' + px + 'px ' + FONT;
      if (g.letterSpacing !== undefined) g.letterSpacing = Math.round(-px * 0.02) + 'px';
    }
    function build() {
      W = cv.clientWidth; H = cv.clientHeight;
      if (!W || !H) return;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      var wide = W >= 860;
      // wide: three bands over the whole hero (the mask fades them behind the copy); phones: the band behind the portrait
      var big = wide ? Math.max(64, Math.min(124, W * 0.075)) : Math.max(42, W * 0.13);
      var ys = wide ? [0.27, 0.56, 0.86] : [0.10, 0.19, 0.28];
      rows = words.slice(0, 3).map(function (w, i) {
        var px = i === 1 ? big * 0.6 : big, txt = w + '  ·  ';
        setFont(px);
        return { txt: txt, px: px, w: Math.max(40, g.measureText(txt).width), y: ys[i] * H + px * 0.36,
                 dir: i % 2 ? -1 : 1, v: (wide ? 24 : 16) * (i === 1 ? 0.8 : 1), kind: i };
      });
      draw(performance.now());
    }
    function draw(now) {
      var t = (now - t0) / 1000;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      rows.forEach(function (r) {
        setFont(r.px);
        var off = ((t * r.v * r.dir) % r.w + r.w) % r.w - r.w;
        if (r.kind === 1) g.fillStyle = rgba(col.b, 0.12);
        else { g.strokeStyle = rgba(r.kind ? col.b : col.a, r.kind ? 0.3 : 0.24); g.lineWidth = 1.2; }
        for (var x = off; x < W; x += r.w) {
          if (r.kind === 1) g.fillText(r.txt, x, r.y); else g.strokeText(r.txt, x, r.y);
        }
      });
    }
    function loop(now) {
      if (visible && !doc.hidden && now - last >= 33) { last = now; draw(now); }
      window.requestAnimationFrame(loop);
    }
    readColours();
    new MutationObserver(function () { readColours(); draw(performance.now()); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    var dm = mq('(prefers-color-scheme: dark)'); if (dm.addEventListener) dm.addEventListener('change', function () { readColours(); draw(performance.now()); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }).observe(cv);
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 200); });
    build();
    (doc.fonts && doc.fonts.ready ? doc.fonts.ready : Promise.resolve()).then(build);
    cv.classList.add('is-live');
    if (host) host.classList.add('has-stars');
    if (!reduceMotion) window.requestAnimationFrame(loop);
  });

  /* ---------------------------------------------------------------- v3.5 archive page tabs (archive.html)
     Without JS every panel is listed; with JS one panel shows at a time, chosen by the URL hash. */
  (function () {
    var bar = doc.querySelector('[data-arch-tabs]');
    if (!bar) return;
    var tabs = toArray(bar.querySelectorAll('[data-arch-tab]')), panels = toArray(doc.querySelectorAll('[data-arch-panel]'));
    if (!tabs.length) return;
    root.classList.add('arch-js');
    function show(id, focus) {
      var target = null;
      if (!panels.some(function (p) { return p.id === id; })) {
        // a deep link such as #press-xyz: open the panel that holds it, then bring it into view
        var el = id ? doc.getElementById(id) : null;
        var host = el && el.closest ? el.closest('[data-arch-panel]') : null;
        if (host) { target = el; id = host.id; } else id = tabs[0].getAttribute('data-arch-tab');
      }
      tabs.forEach(function (t) { var on = t.getAttribute('data-arch-tab') === id; t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; });
      panels.forEach(function (p) { p.hidden = p.id !== id; });
      if (focus) { var cur = tabs.filter(function (t) { return t.getAttribute('data-arch-tab') === id; })[0]; if (cur) cur.focus(); }
      if (target) target.scrollIntoView({ block: 'start' });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function (e) {
        e.preventDefault();
        var id = t.getAttribute('data-arch-tab');
        if (history.replaceState) history.replaceState(null, '', '#' + id);
        show(id, false);
        bar.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
      });
      t.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
        n.click(); n.focus();
      });
    });
    window.addEventListener('hashchange', function () { show(location.hash.slice(1), false); });
    show(location.hash.slice(1), false);
  })();
})();
