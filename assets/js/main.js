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
        var label = (active ? active.textContent : '전체') + (state.award ? ' · 수상작' : '');
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
})();
