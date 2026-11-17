/* Portfolio admin — edits content/content.json (+ assets_src/media/media.json and uploaded files) in the private
   source repo through the GitHub API, one commit per save. The repo's Action then builds, checks and deploys.
   No framework, no third-party code: the owner's token never leaves this page except to api.github.com. */
(function () {
  'use strict';

  var REPO = 'Suya020504/portfolio-site';
  var BRANCH = 'main';
  var FILE = { content: 'content/content.json', media: 'assets_src/media/media.json' };
  var API = 'https://api.github.com';
  var SITE = 'https://suya0504.vercel.app/';
  var TOKEN_KEY = 'pf-admin-token';
  var DRAFT_KEY = 'pf-admin-draft';
  var PHONE = /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/;
  var SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  var SCHEMA = window.ADMIN_SCHEMA || [];
  var BY_KEY = {};
  SCHEMA.forEach(function (c) { BY_KEY[c.key] = c; });

  var S = {
    token: '', head: '', tree: '', data: null, media: null, base: null, baseMedia: null,
    raw: { content: '', media: '' }, eol: { content: '\n', media: '\n' },
    blobs: {}, col: SCHEMA.length ? SCHEMA[0].key : '', sel: null, q: '', busy: false
  };

  // ------------------------------------------------------------------ small helpers
  function $(sel, root) { return (root || document).querySelector(sel); }
  function h(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'on') Object.keys(v).forEach(function (ev) { n.addEventListener(ev, v[ev]); });
      else if (k === 'cls') n.className = v;
      else if (v === true) n.setAttribute(k, '');
      else n.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function ser(o, eol) { var t = JSON.stringify(o, null, 2) + '\n'; return eol === '\r\n' ? t.replace(/\n/g, '\r\n') : t; }
  function today() { var d = new Date(); function p(n) { return (n < 10 ? '0' : '') + n; } return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function isEmpty(v) { return v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length); }
  function slugify(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40); }
  function stamp() { return Date.now().toString(36); }

  var toastTimer;
  function toast(msg, kind) {
    var t = $('#toast');
    t.textContent = msg; t.className = 'toast' + (kind ? ' ' + kind : ''); t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, kind === 'error' ? 9000 : 4000);
  }
  function setStatus(text, href, kind) {
    var s = $('#status'); s.textContent = ''; s.className = 'status' + (kind ? ' ' + kind : '');
    if (href) s.appendChild(h('a', { href: href, target: '_blank', rel: 'noopener', text: text }));
    else s.textContent = text;
  }

  // ------------------------------------------------------------------ GitHub API
  function errorText(status, body) {
    if (status === 401) return '토큰이 맞지 않거나 만료됐어요. 다시 로그인해 주세요.';
    if (status === 403) return '권한이 없어요. 토큰에 portfolio-site의 Contents: Read and write 권한이 있는지 확인해 주세요.';
    if (status === 404) return '저장소를 찾을 수 없어요. 토큰의 저장소 선택에 portfolio-site가 있는지 확인해 주세요.';
    if (status === 409 || status === 422) return '다른 곳에서 먼저 저장됐어요. 새로고침 후 다시 시도해 주세요.';
    return 'GitHub 오류 ' + status + ': ' + String(body || '').slice(0, 160);
  }
  function gh(path, opt) {
    opt = opt || {};
    var headers = { 'Authorization': 'Bearer ' + S.token, 'Accept': opt.accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opt.body) headers['Content-Type'] = 'application/json';
    return fetch(API + path, { method: opt.method || 'GET', headers: headers, body: opt.body ? JSON.stringify(opt.body) : undefined, cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) return r.text().then(function (t) { var e = new Error(errorText(r.status, t)); e.status = r.status; throw e; });
        if (opt.text) return r.text();
        return r.status === 204 ? null : r.json();
      });
  }
  function rawFile(path, ref) {
    var p = path.split('/').map(encodeURIComponent).join('/');
    return gh('/repos/' + REPO + '/contents/' + p + '?ref=' + encodeURIComponent(ref), { accept: 'application/vnd.github.raw+json', text: true });
  }

  // ------------------------------------------------------------------ login / load
  function storedToken() {
    try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }
  function storeToken(tok, remember) {
    try { (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, tok); } catch (e) { /* private mode: keep in memory */ }
  }
  function forgetToken() {
    try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }

  function login(tok, remember) {
    S.token = tok.trim();
    var err = $('#login-error'); err.hidden = true;
    return gh('/repos/' + REPO).then(function () {
      storeToken(S.token, remember);
      $('#login').hidden = true; $('#app').hidden = false;
      return load(true);
    }).catch(function (e) {
      S.token = ''; err.textContent = e.message; err.hidden = false;
    });
  }

  function load(offerDraft) {
    setStatus('불러오는 중…');
    return gh('/repos/' + REPO + '/git/ref/heads/' + BRANCH).then(function (ref) {
      var head = ref.object.sha;
      return gh('/repos/' + REPO + '/git/commits/' + head).then(function (commit) {
        return Promise.all([rawFile(FILE.content, head), rawFile(FILE.media, head)]).then(function (txt) {
          S.head = head; S.tree = commit.tree.sha;
          S.raw.content = txt[0]; S.raw.media = txt[1];
          S.eol.content = txt[0].indexOf('\r\n') >= 0 ? '\r\n' : '\n';
          S.eol.media = txt[1].indexOf('\r\n') >= 0 ? '\r\n' : '\n';
          S.base = JSON.parse(txt[0]); S.baseMedia = JSON.parse(txt[1]);
          S.data = clone(S.base); S.media = clone(S.baseMedia); S.blobs = {};
          if (offerDraft) restoreDraft();
          S.sel = null; closeDrawer(); renderAll();
          setStatus('최신 내용 · ' + head.slice(0, 7));
        });
      });
    }).catch(function (e) { setStatus(e.message, null, 'error'); toast(e.message, 'error'); if (e.status === 401) logout(); });
  }

  // ------------------------------------------------------------------ dirty state + drafts
  function contentDirty() { return ser(S.data, '\n') !== ser(S.base, '\n'); }
  function mediaDirty() { return ser(S.media, '\n') !== ser(S.baseMedia, '\n'); }
  function blobCount() { return Object.keys(S.blobs).length; }
  function isDirty() { return contentDirty() || mediaDirty() || blobCount() > 0; }
  function colDirty(key) {
    if (key === 'projects' && mediaDirty()) return true;
    return JSON.stringify(S.data[key]) !== JSON.stringify(S.base[key]);
  }
  function changed() {
    var dirty = isDirty();
    $('#save').disabled = !dirty || S.busy; $('#discard').disabled = !dirty || S.busy;
    $('#save').textContent = dirty ? '저장하고 배포 (' + changeSummary().length + ')' : '저장하고 배포';
    renderNav();
    try {
      if (dirty) localStorage.setItem(DRAFT_KEY, JSON.stringify({ head: S.head, data: S.data, media: S.media, at: Date.now() }));
      else localStorage.removeItem(DRAFT_KEY);
    } catch (e) { /* storage full or blocked: no draft */ }
  }
  function restoreDraft() {
    var d;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || !d.data) return;
    if (d.head !== S.head) {
      if (window.confirm('예전에 저장하지 않은 변경이 있지만, 그사이 사이트 내용이 바뀌었어요. 버릴까요?\n(취소를 누르면 지금 최신 내용을 그대로 두고 예전 변경은 보관해요)')) localStorage.removeItem(DRAFT_KEY);
      return;
    }
    if (window.confirm('저장하지 않은 변경이 있어요. 이어서 편집할까요?\n(올린 사진·영상 파일은 다시 올려야 해요)')) {
      S.data = d.data; S.media = d.media || S.media;
    } else localStorage.removeItem(DRAFT_KEY);
  }

  function changeSummary() {
    var out = [];
    SCHEMA.forEach(function (c) {
      var a = S.base[c.key], b = S.data[c.key];
      if (JSON.stringify(a) === JSON.stringify(b)) return;
      if (Array.isArray(a) && Array.isArray(b)) {
        var as = a.map(function (x) { return JSON.stringify(x); }), bs = b.map(function (x) { return JSON.stringify(x); });
        var add = bs.filter(function (x) { return as.indexOf(x) < 0; }).length, del = as.filter(function (x) { return bs.indexOf(x) < 0; }).length;
        var mod = Math.min(add, del); add -= mod; del -= mod;
        var parts = [];
        if (add) parts.push('+' + add); if (mod) parts.push('~' + mod); if (del) parts.push('-' + del);
        if (!parts.length) parts.push('순서');
        out.push(c.label + ' ' + parts.join(' '));
      } else out.push(c.label + ' 수정');
    });
    if (mediaDirty() && !out.some(function (x) { return x.indexOf('프로젝트') === 0; })) out.push('프로젝트 사진');
    if (blobCount()) out.push('파일 ' + blobCount() + '개');
    return out;
  }

  // ------------------------------------------------------------------ rendering: nav + list
  function count(c) {
    var v = S.data[c.key];
    if (c.kind === 'map') return v ? Object.keys(v).length : 0;
    if (c.kind === 'object') return '';
    return Array.isArray(v) ? v.length : 0;
  }
  function renderNav() {
    var nav = $('#nav'); nav.textContent = '';
    SCHEMA.forEach(function (c) {
      var b = h('button', { type: 'button', cls: 'nav-item' + (c.key === S.col ? ' is-on' : ''), 'aria-current': c.key === S.col ? 'page' : null,
        on: { click: function () { S.col = c.key; S.sel = null; S.q = ''; $('#search').value = ''; closeDrawer(); renderAll(); } } },
        [h('span', { cls: 'nav-icon', 'aria-hidden': 'true', text: c.icon }), h('span', { cls: 'nav-label', text: c.label }),
         colDirty(c.key) ? h('span', { cls: 'dot', title: '저장하지 않은 변경' }) : null,
         h('span', { cls: 'nav-count', text: String(count(c)) })]);
      nav.appendChild(b);
    });
  }

  function itemsOf(c) {
    if (c.kind === 'object') return [{ key: c.key, item: S.data[c.key] || {}, title: '프로필 편집', sub: (S.data[c.key] || {}).nameKo || '' }];
    if (c.kind === 'map') {
      var m = S.data[c.key] || {};
      return Object.keys(m).map(function (k) { return { key: k, item: m[k], title: (m[k] && m[k].title) || k, sub: k }; });
    }
    return (S.data[c.key] || []).map(function (x, i) { return { key: i, item: x, title: c.title(x), sub: c.sub(x) }; });
  }

  function flags(c, x) {
    var f = [];
    if (x.highlight) f.push(['★ 대표', 'star']);
    if (x.featured) f.push(['대표', 'star']);
    if (x.lead) f.push(['대표 기사', 'star']);
    if (c.key === 'talks') f.push(isFuture(x.date) ? ['예정', 'sky'] : ['지남·숨김', 'mute']);
    if (x.photo && x.photo.src) f.push(['사진', 'mint']);
    if (x.video && x.video.src) f.push(['영상', 'mint']);
    if (c.key === 'projects' && x.id && S.media[x.id] && S.media[x.id].length) f.push(['사진 ' + S.media[x.id].length, 'mint']);
    return f;
  }
  function isFuture(d) {
    var m = String(d || '').match(/(\d{4})\.(\d{2})(?:\.(\d{2}))?/);
    if (!m) return false;
    var key = m[1] + '-' + m[2] + '-' + (m[3] || '01');
    return key >= today();
  }

  function renderAll() { renderNav(); renderList(); changed(); }

  function renderList() {
    var c = BY_KEY[S.col]; if (!c) return;
    $('#col-icon').textContent = c.icon; $('#col-title').textContent = c.label;
    $('#col-help').textContent = c.help || '';
    $('#add').hidden = c.kind === 'object' || c.kind === 'map';
    var list = $('#list'); list.textContent = '';
    var q = S.q.trim().toLowerCase();
    var rows = itemsOf(c).filter(function (r) { return !q || JSON.stringify(r.item).toLowerCase().indexOf(q) >= 0; });
    $('#col-count').textContent = c.kind ? '' : rows.length + (q ? ' / ' + count(c) : '') + '개';
    if (!rows.length) { list.appendChild(h('p', { cls: 'empty', text: q ? '검색 결과가 없어요.' : '아직 항목이 없어요. ‘＋ 새 항목’으로 추가하세요.' })); return; }
    rows.forEach(function (r) {
      var base = c.kind === 'map' ? (S.base[c.key] || {})[r.key] : c.kind === 'object' ? S.base[c.key] : null;
      var dirty = c.kind ? JSON.stringify(base) !== JSON.stringify(r.item) : false;
      var row = h('div', { cls: 'row' + (S.sel === r.key ? ' is-sel' : ''), role: 'listitem', tabindex: '0',
        on: { click: function () { openDrawer(r.key); }, keydown: function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openDrawer(r.key); } } } },
        [typeof r.key === 'number' ? h('span', { cls: 'row-n', text: String(r.key + 1) }) : null,
         h('div', { cls: 'row-main' }, [h('span', { cls: 'row-title', text: r.title }), r.sub ? h('span', { cls: 'row-sub', text: r.sub }) : null]),
         h('div', { cls: 'row-flags' }, flags(c, r.item || {}).map(function (f) { return h('span', { cls: 'flag ' + f[1], text: f[0] }); })
           .concat(dirty ? [h('span', { cls: 'dot', title: '저장하지 않은 변경' })] : []))]);
      list.appendChild(row);
    });
  }

  // ------------------------------------------------------------------ drawer + forms
  function current() {
    var c = BY_KEY[S.col];
    if (S.sel === null) return null;
    if (c.kind === 'object') { if (!S.data[c.key]) S.data[c.key] = {}; return S.data[c.key]; }
    if (c.kind === 'map') return (S.data[c.key] || {})[S.sel];
    return (S.data[c.key] || [])[S.sel];
  }
  function closeDrawer() { $('#drawer').hidden = true; document.body.classList.remove('drawer-open'); S.sel = null; }
  function openDrawer(key) {
    S.sel = key; var c = BY_KEY[S.col]; var item = current(); if (!item) return;
    var arr = !c.kind;
    $('#drawer-title').textContent = c.kind === 'map' ? '섹션: ' + key : c.kind === 'object' ? c.label : c.title(item);
    ['up', 'down', 'dup', 'del'].forEach(function (a) { $('[data-act="' + a + '"]').hidden = !arr; });
    var form = $('#form'); form.textContent = '';
    renderFields(form, item, c.fields, c, function () { if (arr) $('#drawer-title').textContent = c.title(item); renderList(); changed(); });
    renderExtras(form, item, c.fields);
    $('#drawer').hidden = false; document.body.classList.add('drawer-open');
    renderList();
    var first = form.querySelector('input, textarea, select'); if (first && window.innerWidth > 900) first.focus({ preventScroll: true });
  }

  function setVal(obj, k, v, keepEmpty) {
    if (isEmpty(v) && !keepEmpty) { if (Object.prototype.hasOwnProperty.call(obj, k)) delete obj[k]; }
    else obj[k] = v;
  }

  function fieldWrap(f, control, extra) {
    return h('div', { cls: 'field' + (f.req ? ' req' : '') }, [
      h('span', { cls: 'field-label', text: f.l + (f.req ? ' *' : '') }), control,
      f.hint ? h('span', { cls: 'hint', text: f.hint }) : null].concat(extra || []));
  }

  function renderFields(root, obj, fields, c, onChange) {
    fields.forEach(function (f) {
      var node = FIELD[f.t] ? FIELD[f.t](obj, f, c, onChange) : FIELD.text(obj, f, c, onChange);
      if (node) root.appendChild(node);
    });
  }

  function inputField(obj, f, c, onChange, type) {
    var v = obj[f.k];
    var inp = h('input', { type: type || 'text', value: v === undefined || v === null ? '' : String(v), spellcheck: f.t === 'text' ? null : 'false',
      placeholder: f.t === 'date' ? '2026.11.18' : f.t === 'url' ? 'https://' : null, inputmode: f.t === 'number' ? 'numeric' : null });
    var prev = v;
    inp.addEventListener('input', function () {
      var raw = inp.value;
      var val = f.t === 'number' ? (raw.trim() === '' ? '' : Number(raw)) : raw;
      if (f.t === 'number' && raw.trim() !== '' && isNaN(val)) return;
      if (f.slug && c && c.key === 'projects' && f.k === 'id') renameMedia(prev, raw);
      setVal(obj, f.k, val, f.req);
      prev = raw;
      inp.classList.toggle('bad', !validOne(f, raw));
      onChange();
    });
    inp.classList.toggle('bad', !validOne(f, inp.value));
    return fieldWrap(f, inp);
  }
  function validOne(f, v) {
    v = String(v || '');
    if (f.req && !v.trim()) return false;
    if (!v) return true;
    if (f.slug) return SLUG.test(v);
    if (f.t === 'date') return /^\d{4}(\.\d{2}(\.\d{2})?)?/.test(v);
    if (f.t === 'url') return /^(https?:\/\/|#|\/)/.test(v);
    return true;
  }
  function renameMedia(oldId, newId) {
    if (!oldId || oldId === newId || !S.media[oldId] || S.media[newId]) return;
    S.media[newId] = S.media[oldId]; delete S.media[oldId];
  }

  var FIELD = {
    text: function (o, f, c, ch) { return inputField(o, f, c, ch, 'text'); },
    url: function (o, f, c, ch) { return inputField(o, f, c, ch, 'url'); },
    date: function (o, f, c, ch) { return inputField(o, f, c, ch, 'text'); },
    number: function (o, f, c, ch) { return inputField(o, f, c, ch, 'text'); },
    textarea: function (o, f, c, ch) {
      var ta = h('textarea', { rows: '3' }); ta.value = o[f.k] || '';
      ta.addEventListener('input', function () { setVal(o, f.k, ta.value, f.req); autosize(ta); ch(); });
      setTimeout(function () { autosize(ta); }, 0);
      return fieldWrap(f, ta);
    },
    lines: function (o, f, c, ch) {
      var ta = h('textarea', { rows: '3' }); ta.value = (Array.isArray(o[f.k]) ? o[f.k] : []).join('\n');
      ta.addEventListener('input', function () {
        setVal(o, f.k, ta.value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean), false); autosize(ta); ch();
      });
      setTimeout(function () { autosize(ta); }, 0);
      return fieldWrap(f, ta);
    },
    tags: function (o, f, c, ch) {
      var inp = h('input', { type: 'text', value: (Array.isArray(o[f.k]) ? o[f.k] : []).join(', ') });
      inp.addEventListener('input', function () {
        var arr = inp.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        if (f.numeric) arr = arr.map(Number).filter(function (n) { return !isNaN(n); });
        setVal(o, f.k, arr, false); ch();
      });
      return fieldWrap(f, inp);
    },
    bool: function (o, f, c, ch) {
      var cb = h('input', { type: 'checkbox' }); cb.checked = o[f.k] === true;
      cb.addEventListener('change', function () {
        if (cb.checked) o[f.k] = true; else if (Object.prototype.hasOwnProperty.call(o, f.k)) o[f.k] = false;
        ch();
      });
      return h('label', { cls: 'field check' }, [cb, ' ' + f.l]);
    },
    select: function (o, f, c, ch) {
      var sel = h('select');
      var opts = (f.req ? [] : [['', '(선택 안 함)']]).concat(f.options);
      if (o[f.k] && !f.options.some(function (x) { return x[0] === o[f.k]; })) opts.push([o[f.k], o[f.k]]);
      opts.forEach(function (x) { var op = h('option', { value: x[0], text: x[1] }); if (String(o[f.k] || '') === x[0]) op.selected = true; sel.appendChild(op); });
      sel.addEventListener('change', function () { setVal(o, f.k, sel.value, f.req); ch(); });
      return fieldWrap(f, sel);
    },
    multi: function (o, f, c, ch) {
      var box = h('div', { cls: 'multi' });
      f.options.forEach(function (x) {
        var cb = h('input', { type: 'checkbox', value: x[0] }); cb.checked = Array.isArray(o[f.k]) && o[f.k].indexOf(x[0]) >= 0;
        cb.addEventListener('change', function () {
          var vals = f.options.map(function (y) { return y[0]; }).filter(function (v) { var e = box.querySelector('input[value="' + v + '"]'); return e && e.checked; });
          setVal(o, f.k, vals, false); ch();
        });
        box.appendChild(h('label', { cls: 'chip-check' }, [cb, ' ' + x[1]]));
      });
      return fieldWrap(f, box);
    },
    ref: function (o, f, c, ch) {
      var sel = h('select');
      var target = S.data[f.ref] || [];
      var opts = [['', '(연결 안 함)']].concat(target.filter(function (x) { return x && x.id; }).map(function (x) {
        return [x.id, x.id + ' — ' + (BY_KEY[f.ref] ? BY_KEY[f.ref].title(x) : x.id)];
      }));
      if (o[f.k] && !opts.some(function (x) { return x[0] === o[f.k]; })) opts.push([o[f.k], o[f.k] + ' (없는 ID)']);
      opts.forEach(function (x) { var op = h('option', { value: x[0], text: x[1] }); if (String(o[f.k] || '') === x[0]) op.selected = true; sel.appendChild(op); });
      sel.addEventListener('change', function () { setVal(o, f.k, sel.value, false); ch(); });
      return fieldWrap(f, sel);
    },
    object: function (o, f, c, ch) {
      var sub = o[f.k] && typeof o[f.k] === 'object' ? o[f.k] : {};
      var box = h('fieldset', { cls: 'group' }, [h('legend', { text: f.l })]);
      renderFields(box, sub, f.fields, c, function () {
        if (isEmpty(sub)) { if (o[f.k]) delete o[f.k]; } else o[f.k] = sub;
        ch();
      });
      return box;
    },
    objects: function (o, f, c, ch) {
      var box = h('fieldset', { cls: 'group' }, [h('legend', { text: f.l })]);
      var listEl = h('div', { cls: 'subs' });
      function arr() { if (!Array.isArray(o[f.k])) o[f.k] = []; return o[f.k]; }
      function sync() { if (Array.isArray(o[f.k]) && !o[f.k].length) delete o[f.k]; ch(); }
      function draw() {
        listEl.textContent = '';
        (Array.isArray(o[f.k]) ? o[f.k] : []).forEach(function (it, i) {
          var card = h('div', { cls: 'sub' });
          var tools = h('div', { cls: 'sub-tools' }, [
            h('span', { cls: 'sub-n', text: String(i + 1) }),
            h('button', { type: 'button', cls: 'icon-btn sm', title: '위로', text: '↑', on: { click: function () { move(arr(), i, -1); draw(); sync(); } } }),
            h('button', { type: 'button', cls: 'icon-btn sm', title: '아래로', text: '↓', on: { click: function () { move(arr(), i, 1); draw(); sync(); } } }),
            h('button', { type: 'button', cls: 'icon-btn sm danger', title: '빼기', text: '✕', on: { click: function () { arr().splice(i, 1); draw(); sync(); } } })]);
          card.appendChild(tools);
          renderFields(card, it, f.fields, c, ch);
          listEl.appendChild(card);
        });
      }
      draw();
      box.appendChild(listEl);
      box.appendChild(h('button', { type: 'button', cls: 'btn sm', text: '＋ 추가', on: { click: function () { arr().push({}); draw(); ch(); } } }));
      return box;
    },
    image: function (o, f, c, ch) {
      var prev = h('img', { cls: 'thumb', alt: '' });
      var path = h('input', { type: 'text', value: o[f.k] || '', placeholder: f.folder + '/파일.webp', spellcheck: 'false' });
      var file = h('input', { type: 'file', accept: 'image/*' });
      function show() { var v = o[f.k]; prev.hidden = !v; if (v) prev.src = assetUrl(v); }
      path.addEventListener('input', function () { setVal(o, f.k, path.value.trim(), false); show(); ch(); });
      file.addEventListener('change', function () {
        var fl = file.files && file.files[0]; if (!fl) return;
        toWebp(fl, f.maxW || 1440).then(function (img) {
          var rel = f.folder + '/' + (slugify(fl.name.replace(/\.[^.]+$/, '')) || 'photo') + '-' + stamp() + '.webp';
          S.blobs['assets_src/' + rel] = { b64: img.b64, url: img.url };
          o[f.k] = rel; path.value = rel; show(); ch(); toast('사진을 올릴 준비가 됐어요. 저장하면 함께 올라가요.');
        }).catch(function () { toast('이 사진은 읽을 수 없어요. JPG·PNG·WEBP로 올려 주세요.', 'error'); });
      });
      show();
      return fieldWrap(f, h('div', { cls: 'image-field' }, [prev, h('div', { cls: 'image-inputs' }, [file, path])]));
    },
    file: function (o, f, c, ch) {
      var info = h('span', { cls: 'hint', text: o[f.k] ? '현재: ' + o[f.k] : '' });
      var file = h('input', { type: 'file', accept: f.accept || '*/*' });
      var name = h('input', { type: 'text', value: o[f.k] || '', placeholder: '파일 이름', spellcheck: 'false' });
      name.addEventListener('input', function () { setVal(o, f.k, name.value.trim(), false); ch(); });
      file.addEventListener('change', function () {
        var fl = file.files && file.files[0]; if (!fl) return;
        if (fl.size > 90 * 1024 * 1024) { toast('90MB보다 큰 파일은 올릴 수 없어요. 용량을 줄여 주세요.', 'error'); return; }
        info.textContent = '읽는 중…';
        readDataUrl(fl).then(function (url) {
          var ext = (fl.name.match(/\.[a-z0-9]+$/i) || ['.bin'])[0].toLowerCase();
          var nm = (slugify(fl.name.replace(/\.[^.]+$/, '')) || 'file') + ext;
          S.blobs[f.folder + '/' + nm] = { b64: url.split(',')[1], url: null };
          o[f.k] = nm; name.value = nm; info.textContent = '올릴 준비됨: ' + nm + ' (' + Math.round(fl.size / 1048576) + 'MB)'; ch();
        });
      });
      return fieldWrap(f, h('div', { cls: 'image-inputs' }, [file, name]), [info]);
    },
    gallery: function (o, f, c, ch) {
      var box = h('fieldset', { cls: 'group' }, [h('legend', { text: f.l })]);
      var grid = h('div', { cls: 'gallery' });
      var up = h('input', { type: 'file', accept: 'image/*', multiple: true });
      function pid() { return o.id; }
      function items() { return (pid() && S.media[pid()]) || []; }
      function draw() {
        grid.textContent = '';
        if (!pid()) { grid.appendChild(h('p', { cls: 'hint', text: '먼저 ID를 적으면 사진을 올릴 수 있어요.' })); return; }
        items().forEach(function (g, i) {
          var cap = h('input', { type: 'text', value: g.caption || '', placeholder: '사진 설명(캡션)' });
          cap.addEventListener('input', function () { setVal(g, 'caption', cap.value, false); ch(); });
          var alt = h('input', { type: 'text', value: g.alt || '', placeholder: '대체 텍스트(무엇이 보이는지)' });
          alt.addEventListener('input', function () { setVal(g, 'alt', alt.value, false); ch(); });
          grid.appendChild(h('div', { cls: 'g-item' }, [
            h('img', { src: assetUrl(g.thumb || g.src), alt: '' }),
            h('div', { cls: 'sub-tools' }, [
              h('span', { cls: 'sub-n', text: i === 0 ? '표지' : String(i + 1) }),
              h('button', { type: 'button', cls: 'icon-btn sm', title: '앞으로', text: '←', on: { click: function () { move(S.media[pid()], i, -1); fixCover(); draw(); ch(); } } }),
              h('button', { type: 'button', cls: 'icon-btn sm', title: '뒤로', text: '→', on: { click: function () { move(S.media[pid()], i, 1); fixCover(); draw(); ch(); } } }),
              h('button', { type: 'button', cls: 'icon-btn sm danger', title: '빼기', text: '✕', on: { click: function () {
                S.media[pid()].splice(i, 1); if (!S.media[pid()].length) delete S.media[pid()]; fixCover(); draw(); ch(); } } })]),
            cap, alt]));
        });
      }
      function fixCover() { (S.media[pid()] || []).forEach(function (g, i) { g.cover = i === 0; }); }
      up.addEventListener('change', function () {
        if (!pid()) { toast('먼저 프로젝트 ID를 적어 주세요.', 'error'); return; }
        var files = Array.prototype.slice.call(up.files || []);
        var chain = Promise.resolve();
        files.forEach(function (fl) {
          chain = chain.then(function () {
            return Promise.all([toWebp(fl, 1440), toWebp(fl, 640)]).then(function (r) {
              var base = 'media/' + pid() + '/' + (slugify(fl.name.replace(/\.[^.]+$/, '')) || 'photo') + '-' + stamp();
              S.blobs['assets_src/' + base + '.webp'] = { b64: r[0].b64, url: r[0].url };
              S.blobs['assets_src/' + base + '.thumb.webp'] = { b64: r[1].b64, url: r[1].url };
              if (!S.media[pid()]) S.media[pid()] = [];
              S.media[pid()].push({ src: base + '.webp', thumb: base + '.thumb.webp', w: r[0].w, h: r[0].h, caption: '', alt: '', kind: 'photo', cover: false });
            });
          });
        });
        chain.then(function () { fixCover(); draw(); ch(); up.value = ''; toast('사진 ' + files.length + '장을 올릴 준비가 됐어요.'); })
          .catch(function () { toast('읽을 수 없는 사진이 있어요.', 'error'); });
      });
      draw();
      box.appendChild(grid);
      box.appendChild(h('label', { cls: 'btn sm file-btn' }, ['＋ 사진 올리기', up]));
      return box;
    }
  };

  function renderExtras(root, item, fields) {
    var known = {}; fields.forEach(function (f) { known[f.k] = true; });
    var extra = {};
    Object.keys(item).forEach(function (k) { if (!known[k] && k.charAt(0) !== '_') extra[k] = item[k]; });
    if (!Object.keys(extra).length) return;
    var ta = h('textarea', { rows: '4', spellcheck: 'false', cls: 'mono' }); ta.value = JSON.stringify(extra, null, 2);
    var err = h('span', { cls: 'hint' });
    ta.addEventListener('change', function () {
      var v;
      try { v = JSON.parse(ta.value || '{}'); } catch (e) { err.textContent = 'JSON 형식이 맞지 않아요.'; ta.classList.add('bad'); return; }
      ta.classList.remove('bad'); err.textContent = '';
      Object.keys(extra).forEach(function (k) { if (!(k in v)) delete item[k]; });
      Object.keys(v).forEach(function (k) { if (k.charAt(0) !== '_') item[k] = v[k]; });
      extra = v; renderList(); changed();
    });
    root.appendChild(h('details', { cls: 'extras' }, [h('summary', { text: '기타 필드 (고급)' }), ta, err]));
  }

  function autosize(ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight + 2, 420) + 'px'; }
  function move(arr, i, d) { var j = i + d; if (!arr || j < 0 || j >= arr.length) return; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }

  function assetUrl(rel) {
    var staged = S.blobs['assets_src/' + rel];
    return staged && staged.url ? staged.url : '../assets/' + rel;
  }
  function readDataUrl(blob) {
    return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(blob); });
  }
  function toWebp(file, maxW) {
    return createImageBitmap(file).then(function (bmp) {
      var sc = Math.min(1, maxW / bmp.width), w = Math.round(bmp.width * sc), hh = Math.round(bmp.height * sc);
      var cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
      cv.getContext('2d').drawImage(bmp, 0, 0, w, hh);
      return new Promise(function (res) { cv.toBlob(res, 'image/webp', 0.82); }).then(function (blob) {
        if (!blob) throw new Error('webp');
        return readDataUrl(blob).then(function (url) { return { w: w, h: hh, url: url, b64: url.split(',')[1] }; });
      });
    });
  }

  // ------------------------------------------------------------------ item actions
  function itemAction(act) {
    var c = BY_KEY[S.col]; var arr = S.data[c.key]; var i = S.sel;
    if (act === 'close') { closeDrawer(); renderList(); return; }
    if (!Array.isArray(arr) || typeof i !== 'number') return;
    if (act === 'up' || act === 'down') { var j = i + (act === 'up' ? -1 : 1); if (j < 0 || j >= arr.length) return; move(arr, i, act === 'up' ? -1 : 1); S.sel = j; renderList(); changed(); return; }
    if (act === 'dup') {
      var copy = clone(arr[i]);
      if (copy.id) copy.id = copy.id + '-copy';
      arr.splice(i + 1, 0, copy); openDrawer(i + 1); changed(); toast('복제했어요. ID를 바꿔 주세요.'); return;
    }
    if (act === 'del') {
      if (!window.confirm('‘' + c.title(arr[i]) + '’ 항목을 삭제할까요?\n저장하기 전까지는 ‘변경 취소’로 되돌릴 수 있어요.')) return;
      var gone = arr.splice(i, 1)[0];
      if (c.key === 'projects' && gone && gone.id && S.media[gone.id] && window.confirm('이 프로젝트의 사진 목록도 함께 지울까요?')) delete S.media[gone.id];
      closeDrawer(); renderList(); changed(); toast('삭제했어요. 저장하면 사이트에서도 빠져요.');
    }
  }
  function addItem() {
    var c = BY_KEY[S.col]; if (!c || c.kind) return;
    if (!Array.isArray(S.data[c.key])) S.data[c.key] = [];
    var item = c.make ? c.make() : {};
    if (c.key === 'projects') { item.order = S.data.projects.reduce(function (m, p) { return Math.max(m, Number(p.order) || 0); }, 0) + 1; S.data.projects.push(item); openDrawer(S.data.projects.length - 1); }
    else { S.data[c.key].unshift(item); openDrawer(0); }
    S.q = ''; $('#search').value = ''; changed();
  }

  // ------------------------------------------------------------------ validation + save
  function validate() {
    var errs = [];
    SCHEMA.forEach(function (c) {
      if (c.kind) return;
      var arr = S.data[c.key] || [], seen = {};
      arr.forEach(function (x, i) {
        c.fields.forEach(function (f) {
          var v = x[f.k];
          if (f.req && isEmpty(v)) errs.push({ col: c.key, i: i, msg: c.label + ' ' + (i + 1) + '번 ‘' + c.title(x) + '’: ' + f.l + ' 비어 있음' });
          if (f.slug && v) {
            if (!SLUG.test(v)) errs.push({ col: c.key, i: i, msg: c.label + ' ‘' + v + '’: ID는 영문 소문자·숫자·하이픈만' });
            if (seen[v]) errs.push({ col: c.key, i: i, msg: c.label + ' ID ‘' + v + '’가 겹쳐요' });
            seen[v] = true;
          }
        });
      });
    });
    if (PHONE.test(ser(S.data, '\n'))) errs.push({ msg: '전화번호처럼 보이는 숫자가 있어요. 공개 사이트에 올릴 수 없어요.' });
    return errs;
  }

  function save() {
    if (S.busy || !isDirty()) return;
    var errs = validate();
    if (errs.length) {
      toast(errs.slice(0, 3).map(function (e) { return e.msg; }).join('\n') + (errs.length > 3 ? '\n…외 ' + (errs.length - 3) + '건' : ''), 'error');
      var e0 = errs[0]; if (e0.col !== undefined) { S.col = e0.col; renderAll(); openDrawer(e0.i); }
      return;
    }
    var summary = changeSummary();
    var message = 'admin: ' + summary.join(' · ');
    S.busy = true; changed(); setStatus('저장 중…');
    var entries = [], R = '/repos/' + REPO;
    var contentChanged = contentDirty(), mediaChanged = mediaDirty();
    if (contentChanged) { S.data.meta = S.data.meta || {}; S.data.meta.lastUpdated = today(); }

    gh(R + '/git/ref/heads/' + BRANCH).then(function (ref) {
      if (ref.object.sha === S.head) return null;
      // someone else pushed meanwhile: fine unless they touched the same files
      return Promise.all([rawFile(FILE.content, ref.object.sha), rawFile(FILE.media, ref.object.sha)]).then(function (t) {
        if (t[0] !== S.raw.content || t[1] !== S.raw.media) {
          var e = new Error('그사이 다른 곳에서 내용이 바뀌었어요. ‘새로고침’ 후 다시 저장해 주세요. 지금 변경은 임시 저장돼 있어요.'); e.conflict = true; throw e;
        }
        return gh(R + '/git/commits/' + ref.object.sha).then(function (cm) { S.head = ref.object.sha; S.tree = cm.tree.sha; });
      });
    }).then(function () {
      if (contentChanged) entries.push({ path: FILE.content, mode: '100644', type: 'blob', content: ser(S.data, S.eol.content) });
      if (mediaChanged) entries.push({ path: FILE.media, mode: '100644', type: 'blob', content: ser(S.media, S.eol.media) });
      var paths = Object.keys(S.blobs);
      var chain = Promise.resolve();
      paths.forEach(function (p) {
        chain = chain.then(function () {
          setStatus('파일 올리는 중… ' + p.split('/').pop());
          return gh(R + '/git/blobs', { method: 'POST', body: { content: S.blobs[p].b64, encoding: 'base64' } })
            .then(function (b) { entries.push({ path: p, mode: '100644', type: 'blob', sha: b.sha }); });
        });
      });
      return chain;
    }).then(function () {
      return gh(R + '/git/trees', { method: 'POST', body: { base_tree: S.tree, tree: entries } });
    }).then(function (tree) {
      return gh(R + '/git/commits', { method: 'POST', body: { message: message, tree: tree.sha, parents: [S.head] } })
        .then(function (cm) { return gh(R + '/git/refs/heads/' + BRANCH, { method: 'PATCH', body: { sha: cm.sha, force: false } }).then(function () { return { commit: cm, tree: tree }; }); });
    }).then(function (r) {
      S.head = r.commit.sha; S.tree = r.tree.sha;
      S.raw.content = ser(S.data, S.eol.content); S.raw.media = ser(S.media, S.eol.media);
      S.base = clone(S.data); S.baseMedia = clone(S.media); S.blobs = {};
      try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
      S.busy = false; renderAll(); if (S.sel !== null) openDrawer(S.sel);
      toast('저장했어요: ' + summary.join(' · '));
      watchDeploy(r.commit.sha);
    }).catch(function (e) {
      S.busy = false; changed();
      setStatus(e.message, null, 'error'); toast(e.message, 'error');
    });
  }

  // The owner's PC (build/auto_deploy.py, every 5 min) builds and publishes; the site's version.json then names the
  // source commit it was built from. Done when that commit is ours or a later one.
  function watchDeploy(sha) {
    var tries = 0, started = Date.now();
    setStatus('저장 완료 · PC가 빌드·배포하는 중… (보통 5–8분)');
    function done(v) {
      var src = v && v.source ? b32hex(v.source) : '';
      if (!src) return Promise.resolve(false);
      if (src === sha) return Promise.resolve(true);
      return gh('/repos/' + REPO + '/compare/' + sha + '...' + src)
        .then(function (c) { return c.status === 'ahead' || c.status === 'identical'; }).catch(function () { return false; });
    }
    function tick() {
      tries++;
      fetch('../version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; }).then(done).then(function (ok) {
          if (ok) return setStatus('배포 완료 · 사이트에 반영됐어요 ↗', SITE, 'ok');
          var min = Math.round((Date.now() - started) / 60000);
          if (min < 20) { setStatus('저장 완료 · PC가 빌드·배포하는 중… (' + min + '분 경과, 보통 5–8분)'); return void setTimeout(tick, 15000); }
          setStatus('저장은 됐지만 20분째 배포가 안 됐어요. PC가 꺼져 있거나 검사에서 막혔을 수 있어요.', null, 'warn');
        });
    }
    setTimeout(tick, 20000);
  }

  // version.json stores the commit id in base32 (A-Z, 2-7) so the privacy guard never sees digit runs
  function b32hex(s) {
    var A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', bits = '', hex = '';
    String(s).toUpperCase().replace(/=+$/, '').split('').forEach(function (ch) {
      var v = A.indexOf(ch); if (v >= 0) bits += ('00000' + v.toString(2)).slice(-5);
    });
    for (var i = 0; i + 8 <= bits.length; i += 8) hex += ('0' + parseInt(bits.slice(i, i + 8), 2).toString(16)).slice(-2);
    return hex.length === 40 ? hex : '';
  }

  function logout() {
    if (isDirty() && !window.confirm('저장하지 않은 변경이 있어요. 그래도 로그아웃할까요? (변경은 이 브라우저에 임시 저장돼요)')) return;
    forgetToken(); S.token = ''; location.reload();
  }

  // ------------------------------------------------------------------ wiring
  function init() {
    $('#login-form').addEventListener('submit', function (ev) { ev.preventDefault(); login($('#token').value, $('#remember').checked); });
    $('#logout').addEventListener('click', logout);
    $('#add').addEventListener('click', addItem);
    $('#save').addEventListener('click', save);
    $('#discard').addEventListener('click', function () {
      if (!window.confirm('저장하지 않은 변경을 모두 버릴까요?')) return;
      S.data = clone(S.base); S.media = clone(S.baseMedia); S.blobs = {}; closeDrawer(); renderAll(); toast('변경을 버렸어요.');
    });
    $('#search').addEventListener('input', function () { S.q = this.value; renderList(); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () { itemAction(b.getAttribute('data-act')); });
    });
    document.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && !$('#drawer').hidden) { closeDrawer(); renderList(); }
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's' && !$('#app').hidden) { ev.preventDefault(); save(); }
    });
    window.addEventListener('beforeunload', function (ev) { if (S.data && isDirty()) { ev.preventDefault(); ev.returnValue = ''; } });
    var tok = storedToken();
    if (tok) { $('#login').hidden = true; $('#app').hidden = false; S.token = tok; load(true); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
