(() => {
  'use strict';
  const d = document, html = d.documentElement;
  const RM = html.classList.contains('rm');
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const EO = 'cubic-bezier(.19,1,.22,1)', EIO = 'cubic-bezier(.76,0,.24,1)';
  const A = '../assets/';
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const kf = (base, dt) => 1 - Math.pow(1 - base, dt * 60);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const fx = t => ((ax * t + bx) * t + cx) * t;
    const fy = t => ((ay * t + by) * t + cy) * t;
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let lo = 0, hi = 1, t = x;
      for (let i = 0; i < 28; i++) {
        const v = fx(t);
        if (Math.abs(v - x) < 1e-5) break;
        if (v < x) lo = t; else hi = t;
        t = (lo + hi) / 2;
      }
      return fy(t);
    };
  }
  const easeIO = bezier(.76, 0, .24, 1), easeO = bezier(.19, 1, .22, 1);

  const tasks = new Set();
  let locked = false;
  function lock(on) {
    const sw = innerWidth - html.clientWidth;
    locked = on;
    html.classList.toggle('lock', on);
    d.body.style.paddingRight = on && sw > 0 ? sw + 'px' : '';
  }

  const SS = { on: false, y: 0, ty: 0, max: 0, set: -999, anim: null };
  function measureMax() {
    SS.max = Math.max(0, html.scrollHeight - innerHeight);
    if (SS.ty > SS.max) SS.ty = SS.max;
  }
  function innerScrollable(el, dy) {
    while (el && el.nodeType === 1 && el !== d.body && el !== html) {
      const st = getComputedStyle(el);
      if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 1) {
        if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
      }
      el = el.parentElement;
    }
    return false;
  }
  function initSmooth() {
    if (RM || !FINE) return;
    SS.on = true;
    SS.y = SS.ty = scrollY;
    measureMax();
    addEventListener('wheel', e => {
      if (e.ctrlKey || locked) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (innerScrollable(e.target, e.deltaY)) return;
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= innerHeight;
      dy = clamp(dy, -240, 240);
      if (SS.anim) { SS.anim = null; SS.ty = SS.y; }
      SS.ty = clamp(SS.ty + dy, 0, SS.max);
    }, { passive: false });
    addEventListener('scroll', () => {
      if (Math.abs(scrollY - SS.set) > 2) { SS.y = SS.ty = scrollY; SS.anim = null; }
    }, { passive: true });
  }
  function ssUpdate(now, dt) {
    if (!SS.on || locked) return;
    let ny;
    if (SS.anim) {
      const a = SS.anim, p = clamp((now - a.t0) / a.dur, 0, 1);
      ny = a.from + (a.to - a.from) * easeIO(p);
      SS.ty = ny;
      if (p >= 1) SS.anim = null;
    } else {
      const diff = SS.ty - SS.y;
      if (Math.abs(diff) < .4) {
        if (SS.y === SS.ty) return;
        ny = SS.ty;
      } else ny = SS.y + diff * kf(.1, dt);
    }
    SS.y = ny;
    SS.set = ny;
    window.scrollTo(0, ny);
  }
  function scrollToY(y) {
    y = clamp(y, 0, Math.max(0, html.scrollHeight - innerHeight));
    if (SS.on) {
      measureMax();
      const from = scrollY;
      SS.y = from;
      SS.anim = { from, to: y, t0: performance.now(), dur: clamp(900 + Math.abs(y - from) * .12, 900, 1600) };
    } else window.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
  }

  function roll(el) {
    if (!el || el.classList.contains('roll')) return;
    const h = el.innerHTML;
    el.innerHTML = '<span class="roll-i"><span>' + h + '</span><span aria-hidden="true">' + h + '</span></span>';
    el.classList.add('roll');
  }

  function splitWords(root) {
    const walk = node => {
      Array.from(node.childNodes).forEach(n => {
        if (n.nodeType === 3) {
          const parts = n.textContent.split(/(\s+)/);
          const frag = d.createDocumentFragment();
          parts.forEach(p => {
            if (!p) return;
            if (!p.trim()) { frag.appendChild(d.createTextNode(' ')); return; }
            const w = d.createElement('span');
            w.className = 'wd';
            const i = d.createElement('span');
            i.className = 'wd-i';
            i.textContent = p;
            w.appendChild(i);
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === 1 && !n.classList.contains('wd')) walk(n);
      });
    };
    walk(root);
  }
  function indexLines(root) {
    let top = null, li = -1;
    $$('.wd', root).forEach(w => {
      const t = w.getBoundingClientRect().top;
      if (top === null || Math.abs(t - top) > 6) { li++; top = t; }
      w.style.setProperty('--l', Math.min(li, 7));
    });
  }

  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    e.target.classList.add('in');
    if (e.target._in) e.target._in();
  }), { rootMargin: '0px 0px -8% 0px' });
  function watch(el, fn) {
    if (fn) el._in = fn;
    if (RM) { el.classList.add('in'); if (fn) fn(); return; }
    io.observe(el);
  }

  function prepCount(el) {
    el.dataset.orig = el.textContent;
    const m = el.dataset.orig.match(/^(\D*)(\d+)(.*)$/);
    if (m && !RM) el.textContent = m[1] + '0' + m[3];
  }
  function countUp(el) {
    const orig = el.dataset.orig;
    const m = orig.match(/^(\D*)(\d+)(.*)$/);
    if (!m || RM) { el.textContent = orig; return; }
    const pre = m[1], n = +m[2], suf = m[3], t0 = performance.now() + 150, dur = 1500;
    tasks.add(now => {
      const p = clamp((now - t0) / dur, 0, 1);
      if (p >= 1) { el.textContent = orig; return false; }
      el.textContent = pre + Math.round(easeO(p) * n) + suf;
    });
  }

  const nav = $('#nav');
  let navY = 0;
  function navUpdate(y) {
    const solid = y > 30;
    if (solid !== nav._s) { nav._s = solid; nav.classList.toggle('solid', solid); }
    if (menuOpen || locked) { navY = y; return; }
    if (y > navY + 8 && y > innerHeight * .7) { nav.classList.add('hide'); navY = y; }
    else if (y < navY - 8 || y < 80) { nav.classList.remove('hide'); navY = y; }
  }

  const menu = $('#menu'), burger = $('.nav-burger');
  let menuOpen = false, menuT = 0;
  function setMenu(on) {
    if (on === menuOpen) return;
    menuOpen = on;
    clearTimeout(menuT);
    burger.setAttribute('aria-expanded', String(on));
    $('.sr', burger).textContent = on ? '메뉴 닫기' : '메뉴 열기';
    if (on) {
      menu.hidden = false;
      lock(true);
      void menu.offsetWidth;
      menu.classList.add('open');
      nav.classList.remove('hide');
    } else {
      menu.classList.remove('open');
      lock(false);
      menuT = setTimeout(() => { menu.hidden = true; }, RM ? 0 : 470);
    }
  }
  burger.addEventListener('click', () => setMenu(!menuOpen));
  $$('.menu .mi').forEach((m, i) => m.style.setProperty('--i', i));

  const CHIPS = [[1, 11, 24, 10], [2, 22, 23, 3], [15, 18, 21, 9]];
  const WIPES = ['inset(100% 0 0 0)', 'inset(0 0 0 100%)', 'inset(0 100% 0 0)'];
  const ph = n => A + 'photos/' + String(n).padStart(2, '0') + '_s.jpg';
  let heroVis = true;
  function initChips() {
    $$('.hero .chip').forEach((chip, i) => {
      chip.style.setProperty('--ci', i);
      const list = CHIPS[i].map(ph);
      const im = new Image();
      im.alt = '';
      im.decoding = 'async';
      im.src = list[0];
      chip.appendChild(im);
      if (RM) return;
      let k = 0, busy = false;
      const cycle = () => {
        if (busy || d.hidden || !heroVis) return;
        busy = true;
        k = (k + 1) % list.length;
        const nx = new Image();
        nx.alt = '';
        nx.src = list[k];
        const go = () => {
          const prev = $$('img', chip);
          chip.appendChild(nx);
          const a = nx.animate([{ clipPath: WIPES[i], transform: 'scale(1.25)' }, { clipPath: 'inset(0 0 0 0)', transform: 'scale(1)' }], { duration: 1200, easing: EIO });
          prev.forEach(p => p.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.1)' }], { duration: 1200, easing: EIO, fill: 'forwards' }));
          a.onfinish = () => { prev.forEach(p => p.remove()); busy = false; };
        };
        (nx.decode ? nx.decode() : Promise.resolve()).then(go, go);
      };
      setTimeout(() => setInterval(cycle, 3600), 2600 + i * 1200);
    });
    new IntersectionObserver(es => { heroVis = es[0].isIntersecting; }).observe($('.hero'));
  }

  const marquees = [];
  function Marquee(root) {
    const track = $('.mq-track', root), set = track.firstElementChild;
    const base = +root.dataset.speed || 50, dir0 = +root.dataset.dir || 1;
    let w = 0, x = 0, cur = dir0, vis = false, hov = false, slow = 1;
    const measure = () => {
      w = set.getBoundingClientRect().width;
      while (w > 0 && (track.children.length < 2 || (track.children.length - 1) * w < innerWidth + 20)) {
        const c = set.cloneNode(true);
        c.setAttribute('aria-hidden', 'true');
        track.appendChild(c);
      }
      if (w) x = x % w;
      if (x > 0) x -= w;
    };
    measure();
    new IntersectionObserver(es => { vis = es[0].isIntersecting; }).observe(root);
    if (FINE) {
      root.addEventListener('pointerenter', () => { hov = true; });
      root.addEventListener('pointerleave', () => { hov = false; });
    }
    this.measure = measure;
    this.update = (dt, v) => {
      if (!vis || RM || !w) return;
      if (Math.abs(v) > 30) cur += (dir0 * Math.sign(v) - cur) * kf(.06, dt);
      slow += ((hov ? .3 : 1) - slow) * kf(.06, dt);
      x -= (base + Math.min(Math.abs(v), 5000) * .1) * slow * cur * dt;
      if (x <= -w) x += w; else if (x > 0) x -= w;
      track.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    };
  }

  function buildStrip(photos) {
    const set = d.createElement('div');
    set.className = 'mq-set';
    set.innerHTML = photos.map(p => '<figure class="sc"><div class="sc-img"><img src="' + A + p.small + '" alt="' + esc(p.stay + ' ' + p.scene) + '" decoding="async" width="960" height="640"></div><figcaption><b>' + esc(p.stay) + '</b><span>' + esc(p.region) + '</span></figcaption></figure>').join('');
    $('#strip-track').appendChild(set);
  }
  function buildNames(stays) {
    const f = stays.filter(s => s.featured).sort((a, b) => a.order - b.order);
    const set = d.createElement('div');
    set.className = 'mq-set';
    set.innerHTML = f.map(s => '<span class="nm">' + esc(s.name) + '</span><span class="lp"><img src="' + A + s.logo + '" alt="' + esc(s.name) + ' 로고" decoding="async"></span>').join('');
    $('#names-track').appendChild(set);
  }

  const TYPES = ['풀빌라', '카라반', '글램핑', '키즈', '애견'];
  const TCOL = { '풀빌라': 'c-acc', '카라반': 'c-blk', '글램핑': 'c-wht', '키즈': 'c-acc', '애견': 'c-ink' };
  const WPOS = [2, 7, 11, 16, 20];
  let STAYS = [], SORTED = [], filt = '전체', full = false;
  const grid = $('#grid'), more = $('#more'), moreT = $('#more-t');
  const count = t => STAYS.filter(s => s.types.includes(t)).length;
  const byKey = new Map();

  const tio = new IntersectionObserver(es => {
    let i = 0;
    es.filter(e => e.isIntersecting)
      .sort((a, b) => (a.boundingClientRect.top - b.boundingClientRect.top) || (a.boundingClientRect.left - b.boundingClientRect.left))
      .forEach(e => {
        tio.unobserve(e.target);
        const c = $('.clip', e.target);
        c.style.setProperty('--d', Math.min(i++, 8) * 70 + 'ms');
        c.classList.add('in');
      });
  }, { rootMargin: '0px 0px -4% 0px' });

  function makeStayTile(s) {
    const t = d.createElement('article');
    t.className = 'tile' + (s.featured && s.order % 4 === 0 ? ' tile--big' : '');
    t.dataset.key = 's' + s.id;
    const meta = esc(s.region) + (s.types.length ? ' · ' + s.types.map(esc).join(' · ') : '');
    t.innerHTML = '<button class="tile-btn" type="button" data-cursor="view" aria-label="' + esc(s.name) + ' 자세히 보기"><span class="tile-media clip"><span class="tile-zoom"><img src="' + A + s.thumb + '" alt="" loading="lazy" decoding="async"></span><span class="tile-over"><span class="tile-logo"><img src="' + A + s.logo + '" alt="" loading="lazy"></span><span class="tile-name">' + esc(s.name) + '</span><span class="tile-region">' + meta + '</span></span></span></button>';
    $('.tile-btn', t).addEventListener('click', () => openLB(t, s));
    return t;
  }
  function makeTypeTile(type) {
    const t = d.createElement('article');
    t.className = 'tile tile--type' + (type === '풀빌라' ? ' tile--wide' : '');
    t.dataset.key = 't' + type;
    const n = count(type);
    t.innerHTML = '<button class="tile-btn" type="button" aria-label="' + type + ' ' + n + '곳 보기"><span class="tile-face clip ' + TCOL[type] + '"><span class="tf-top"><span>' + n + '곳</span><span aria-hidden="true">↗</span></span><span class="tw">' + type + '</span></span></button>';
    $('.tile-btn', t).addEventListener('click', () => setFilter(filt === type ? '전체' : type));
    return t;
  }
  function itemsFor() {
    const L = filt === '전체' ? SORTED : SORTED.filter(s => s.types.includes(filt));
    const shown = full ? L : L.slice(0, 18);
    const keys = shown.map(s => 's' + s.id);
    if (filt === '전체') WPOS.forEach((p, i) => keys.splice(Math.min(p, keys.length), 0, 't' + TYPES[i]));
    else keys.unshift('t' + filt);
    return { keys, total: L.length };
  }
  function create(k) {
    if (k[0] === 't') return makeTypeTile(k.slice(1));
    return makeStayTile(byKey.get(k));
  }
  function render(animate) {
    const { keys, total } = itemsFor();
    const vh = innerHeight;
    const keep = new Set(keys);
    const cur = $$('.tile', grid).filter(t => !t.classList.contains('leaving'));
    const first = new Map();
    const anim = animate && !RM;
    const gr = grid.getBoundingClientRect();
    if (anim) cur.forEach(t => first.set(t, t.getBoundingClientRect()));
    cur.forEach(t => {
      if (keep.has(t.dataset.key)) return;
      const r = first.get(t);
      if (r && r.bottom > 0 && r.top < vh) {
        t.classList.add('leaving');
        Object.assign(t.style, { position: 'absolute', left: (r.left - gr.left) + 'px', top: (r.top - gr.top) + 'px', width: r.width + 'px', height: r.height + 'px', zIndex: '0', pointerEvents: 'none' });
        t.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: 'inset(100% 0 0 0)' }], { duration: 340, easing: EIO, fill: 'forwards' }).onfinish = () => t.remove();
      } else t.remove();
    });
    const present = new Map(cur.filter(t => keep.has(t.dataset.key)).map(t => [t.dataset.key, t]));
    const nodes = keys.map(k => present.get(k) || create(k));
    nodes.forEach(n => grid.appendChild(n));
    nodes.forEach(n => {
      if (present.has(n.dataset.key)) return;
      if (RM) $('.clip', n).classList.add('in'); else tio.observe(n);
    });
    if (anim) {
      nodes.forEach(n => {
        const f = first.get(n);
        if (!f) return;
        const l = n.getBoundingClientRect();
        const dx = f.left - l.left, dy = f.top - l.top;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        if ((f.bottom < 0 || f.top > vh) && (l.bottom < 0 || l.top > vh)) return;
        n.animate([{ transform: 'translate(' + dx + 'px,' + dy + 'px)' }, { transform: 'none' }], { duration: 700, easing: EIO });
      });
    }
    const showMore = !full && total > 18;
    more.hidden = !showMore;
    if (showMore) {
      const label = total + '곳 전부 보기';
      $$('.roll-i > span', moreT).forEach(s => { s.textContent = label; });
    }
  }
  function buildFilters() {
    const fs = ['전체'].concat(TYPES);
    $('#filters').innerHTML = fs.map(f => '<button class="fchip" type="button" data-f="' + f + '" aria-pressed="' + (f === filt) + '"><span data-roll>' + f + '</span><sup>' + (f === '전체' ? STAYS.length : count(f)) + '</sup></button>').join('');
    $$('#filters .fchip').forEach(b => {
      roll($('[data-roll]', b));
      b.addEventListener('click', () => setFilter(b.dataset.f));
    });
  }
  function setFilter(f) {
    if (f === filt) return;
    filt = f;
    full = false;
    $$('#filters .fchip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
    const fr = $('#filters').getBoundingClientRect();
    render(true);
    if (fr.top < 0) scrollToY(fr.top + scrollY - 96);
  }
  more.addEventListener('click', () => { full = true; render(true); });

  if (FINE && !RM) {
    grid.addEventListener('pointermove', e => {
      const b = e.target.closest('.tile-btn');
      const z = b && $('.tile-zoom', b);
      if (!z) return;
      const r = b.getBoundingClientRect();
      z.style.setProperty('--px', (((e.clientX - r.left) / r.width - .5) * -16).toFixed(1) + 'px');
      z.style.setProperty('--py', (((e.clientY - r.top) / r.height - .5) * -16).toFixed(1) + 'px');
    });
    grid.addEventListener('pointerout', e => {
      const b = e.target.closest('.tile-btn');
      if (!b || b.contains(e.relatedTarget)) return;
      const z = $('.tile-zoom', b);
      if (z) { z.style.removeProperty('--px'); z.style.removeProperty('--py'); }
    });
  }

  const lb = $('#lb'), lbImg = $('#lb-img'), lbMedia = $('.lb-media'), lbBg = $('.lb-bg'), lbClose = $('#lb-close'), lbPanel = $('.lb-panel');
  let lbOpen = false, lbBusy = false, lbTile = null, lbStay = null, lbPending = false, lbPushed = false;
  function flyer(src, r) {
    const f = d.createElement('div');
    f.className = 'lb-fly';
    Object.assign(f.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    const im = new Image();
    im.alt = '';
    im.src = src;
    f.appendChild(im);
    d.body.appendChild(f);
    return f;
  }
  function flipFrames(sr, tr, rs, rt) {
    const k = Math.max(sr.width / tr.width, sr.height / tr.height);
    const ix = Math.max(0, (tr.width - sr.width / k) / 2), iy = Math.max(0, (tr.height - sr.height / k) / 2);
    const dx = (sr.left + sr.width / 2) - (tr.left + tr.width / 2), dy = (sr.top + sr.height / 2) - (tr.top + tr.height / 2);
    return [
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ')', clipPath: 'inset(' + iy + 'px ' + ix + 'px round ' + (rs / k) + 'px)' },
      { transform: 'translate(0px,0px) scale(1)', clipPath: 'inset(0px 0px round ' + rt + 'px)' }
    ];
  }
  function openLB(tile, s, push = true) {
    if (lbOpen || lbBusy) return;
    lbOpen = true;
    lbTile = tile;
    lbStay = s;
    $('#lb-name').textContent = s.name;
    $('#lb-region').textContent = s.region;
    $('#lb-types').innerHTML = s.types.map(t => '<li>' + esc(t) + '</li>').join('');
    const lg = $('#lb-logo');
    lg.src = A + s.logo;
    lg.alt = s.name + ' 로고';
    $('#lb-link').href = s.url;
    lbImg.src = A + s.thumb;
    lbImg.alt = s.name;
    lb.hidden = false;
    lb.classList.remove('show');
    cursor.classList.remove('is-view');
    cu.ts = .4;
    lbPanel.scrollTop = 0;
    lock(true);
    if (push) { history.pushState({ lb: s.id }, ''); lbPushed = true; } else lbPushed = false;
    const done = () => {
      lbBusy = false;
      lbClose.focus({ preventScroll: true });
      if (lbPending) { lbPending = false; closeLB(); }
    };
    if (RM) { lb.classList.add('show'); done(); return; }
    lbBusy = true;
    const src = $('.tile-media', tile), sr = src.getBoundingClientRect(), tr = lbMedia.getBoundingClientRect();
    lbImg.style.opacity = '0';
    lbBg.animate([{ opacity: 0 }, { opacity: .95 }], { duration: 700, easing: EIO });
    const f = flyer(A + s.thumb, tr);
    tile.classList.add('is-src');
    const R = parseFloat(getComputedStyle(src).borderTopLeftRadius) || 12;
    const a = f.animate(flipFrames(sr, tr, R, 18), { duration: 820, easing: EIO, fill: 'forwards' });
    setTimeout(() => lb.classList.add('show'), 340);
    a.onfinish = () => { lbImg.style.opacity = ''; f.remove(); done(); };
  }
  function closeLB() {
    if (!lbOpen) return;
    if (lbBusy) { lbPending = true; return; }
    lbBusy = true;
    lb.classList.remove('show');
    const tile = lbTile, s = lbStay;
    const end = () => {
      lb.hidden = true;
      lbImg.style.opacity = '';
      if (tile) tile.classList.remove('is-src');
      lock(false);
      lbOpen = false;
      lbBusy = false;
      lbPushed = false;
      if (tile && tile.isConnected) $('.tile-btn', tile).focus({ preventScroll: true });
    };
    if (RM) { end(); return; }
    const tr = lbMedia.getBoundingClientRect();
    const src = tile && tile.isConnected ? $('.tile-media', tile) : null;
    const sr = src ? src.getBoundingClientRect() : null;
    const vis = sr && sr.width > 0 && sr.bottom > 0 && sr.top < innerHeight;
    const f = flyer(A + s.thumb, tr);
    lbImg.style.opacity = '0';
    const bg = lbBg.animate([{ opacity: .95 }, { opacity: 0 }], { duration: 720, easing: EIO, fill: 'forwards' });
    let a;
    if (vis) {
      const R = parseFloat(getComputedStyle(src).borderTopLeftRadius) || 12;
      a = f.animate(flipFrames(sr, tr, R, 18).reverse(), { duration: 760, easing: EIO, fill: 'forwards' });
    } else {
      a = f.animate([{ transform: 'translateY(0)', clipPath: 'inset(0% 0 0 0 round 18px)' }, { transform: 'translateY(14%)', clipPath: 'inset(100% 0 0 0 round 18px)' }], { duration: 600, easing: EIO, fill: 'forwards' });
    }
    a.onfinish = () => { f.remove(); bg.cancel(); end(); };
  }
  function requestClose() {
    if (lbPushed && history.state && history.state.lb) history.back();
    else closeLB();
  }
  addEventListener('popstate', () => { if (lbOpen) { lbPushed = false; closeLB(); } });
  lbClose.addEventListener('click', requestClose);
  lb.addEventListener('click', e => { if (e.target === lbPanel || e.target === lbBg) requestClose(); });
  function trap(e) {
    const f = $$('a[href],button:not([disabled])', lb);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (lbOpen) requestClose();
      else if (menuOpen) { setMenu(false); burger.focus(); }
    } else if (e.key === 'Tab' && lbOpen) trap(e);
  });

  function setSvc(r, on) {
    r.classList.toggle('open', on);
    $('.svc-head', r).setAttribute('aria-expanded', String(on));
    $('.svc-body', r).hidden = !on;
  }
  function toggleSvc(r) {
    const rows = $$('.svc'), opening = !r.classList.contains('open');
    const els = rows.concat([$('.names'), $('.contact')]);
    const first = els.map(e => e.getBoundingClientRect().top);
    rows.forEach(x => { if (x !== r && x.classList.contains('open')) setSvc(x, false); });
    setSvc(r, opening);
    if (RM) return;
    const vh = innerHeight;
    els.forEach((e, i) => {
      const t = e.getBoundingClientRect().top, dy = first[i] - t;
      if (Math.abs(dy) < 1 || (t > vh && first[i] > vh)) return;
      e.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: 760, easing: EIO });
    });
    if (opening) {
      const b = $('.svc-body', r);
      b.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], { duration: 760, easing: EIO });
      $$('.svc-lead, .steps li, .svc-note', b).forEach((x, i) => x.animate([{ transform: 'translateY(24px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 900, delay: 140 + Math.min(i, 8) * 70, easing: EO, fill: 'backwards' }));
      peekHide();
    }
  }
  function initServices() {
    $$('.svc').forEach((r, i) => {
      roll($('.svc-t .wd-i', r));
      r.style.setProperty('--d', i * 90 + 'ms');
      watch(r);
      $('.svc-head', r).addEventListener('click', () => toggleSvc(r));
    });
  }

  const peek = $('.peek'), peekIn = $('.peek-in');
  const pk = { x: 0, y: 0, tx: 0, ty: 0, rot: 0, on: false, cur: null, h: 0, init: false };
  function peekShow(src) {
    if (!pk.on) { pk.on = true; peek.classList.add('on'); }
    if (pk.cur === src) return;
    const had = pk.cur;
    pk.cur = src;
    const im = new Image();
    im.alt = '';
    im.src = src;
    const olds = $$('img', peekIn);
    peekIn.appendChild(im);
    if (had && olds.length) {
      im.animate([{ clipPath: 'inset(100% 0 0 0)', transform: 'translateY(30%) scale(1.1)' }, { clipPath: 'inset(0 0 0 0)', transform: 'translateY(0) scale(1)' }], { duration: 700, easing: EIO });
      olds.forEach(o => { o.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-22%)' }], { duration: 700, easing: EIO, fill: 'forwards' }).onfinish = () => o.remove(); });
    } else olds.forEach(o => o.remove());
  }
  function peekHide() {
    if (!pk.on) return;
    pk.on = false;
    pk.cur = null;
    peek.classList.remove('on');
  }
  function initPeek() {
    if (!FINE || RM) return;
    $$('.svc').forEach(r => { const im = new Image(); im.src = r.dataset.peek; });
    const list = $('.svc-list');
    list.addEventListener('pointermove', e => {
      pk.tx = e.clientX;
      pk.ty = e.clientY;
      if (!pk.init) { pk.x = pk.tx; pk.y = pk.ty; pk.init = true; }
      const head = e.target.closest('.svc-head');
      if (head) peekShow(head.parentElement.dataset.peek); else peekHide();
    });
    list.addEventListener('pointerleave', () => { peekHide(); });
  }
  function peekUpdate(dt) {
    if (!pk.init) return;
    const ox = pk.x;
    const k = kf(.14, dt);
    pk.x += (pk.tx - pk.x) * k;
    pk.y += (pk.ty - pk.y) * k;
    const vx = (pk.x - ox) / dt;
    pk.rot += (clamp(vx * .012, -6, 6) - pk.rot) * kf(.12, dt);
    if (!pk.h) pk.h = peek.offsetHeight;
    peek.style.transform = 'translate3d(' + (pk.x + 30).toFixed(1) + 'px,' + (pk.y - pk.h / 2).toFixed(1) + 'px,0) rotate(' + pk.rot.toFixed(2) + 'deg)';
    if (!pk.on && Math.abs(pk.tx - pk.x) < .5 && Math.abs(pk.rot) < .05) pk.init = false;
  }

  const cursor = $('.cursor'), cDot = $('.cursor-dot'), cRing = $('.cursor-ring');
  const cu = { x: -100, y: -100, rx: -100, ry: -100, s: .4, ts: .4, on: false };
  function initCursor() {
    if (!FINE || RM) return;
    html.classList.add('has-cursor');
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      cu.x = e.clientX;
      cu.y = e.clientY;
      if (!cu.on) { cu.on = true; cu.rx = cu.x; cu.ry = cu.y; cursor.classList.add('on'); }
      const t = e.target;
      if (!t || !t.closest) return;
      const v = t.closest('[data-cursor="view"]');
      const inp = t.closest('input,textarea,select');
      const lk = !v && t.closest('a,button');
      cursor.classList.toggle('is-view', !!v);
      cursor.classList.toggle('is-hide', !!inp);
      cu.ts = v ? 1 : lk ? .2 : .4;
    }, { passive: true });
    d.addEventListener('mouseout', e => { if (!e.relatedTarget) { cu.on = false; cursor.classList.remove('on'); } });
  }
  function cursorUpdate(dt) {
    if (!cu.on) return;
    const k = kf(.2, dt);
    cu.rx += (cu.x - cu.rx) * k;
    cu.ry += (cu.y - cu.ry) * k;
    cu.s += (cu.ts - cu.s) * kf(.15, dt);
    cDot.style.transform = 'translate3d(' + cu.x + 'px,' + cu.y + 'px,0)';
    cRing.style.transform = 'translate3d(' + cu.rx.toFixed(1) + 'px,' + cu.ry.toFixed(1) + 'px,0) scale(' + cu.s.toFixed(3) + ')';
  }

  function initMagnetic() {
    if (!FINE || RM) return;
    $$('.magnetic').forEach(el => {
      const inn = $('.mg-in', el);
      let r = null;
      el.addEventListener('pointerenter', () => { r = el.getBoundingClientRect(); });
      el.addEventListener('pointermove', e => {
        if (!r) r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2), my = e.clientY - (r.top + r.height / 2);
        const tx = clamp(mx * .22, -10, 10), ty = clamp(my * .3, -8, 8);
        el.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px)';
        if (inn) inn.style.transform = 'translate(' + (tx * .5).toFixed(1) + 'px,' + (ty * .5).toFixed(1) + 'px)';
      });
      el.addEventListener('pointerleave', () => { r = null; el.style.transform = ''; if (inn) inn.style.transform = ''; });
    });
  }

  const SV = [
    { k: '컨설팅', label: '컨설팅이 필요해요', opts: ['키즈', '애견', '풀빌라', '글램핑', '일반펜션', '기타'] },
    { k: '광고', label: '광고하고 싶어요', opts: ['온라인 여행사(OTA) 플랫폼 입점 및 예약관리', '전화 예약 관리', '사회관계망서비스(SNS) 마케팅', '인플루언서 제휴(어필리에이트) 마케팅', '기업 및 단체 휴양지 매칭', '매출 분석 및 결과보고'] },
    { k: '홈페이지', label: '홈페이지 제작하고 싶어요', opts: ['신규', '리뉴얼'] },
    { k: '촬영', label: '촬영하고 싶어요', opts: ['사진', '영상'] }
  ];
  const picked = new Map();
  function updateSummary() {
    const list = SV.filter(s => picked.has(s.k));
    const box = $('#summary');
    if (!list.length) box.innerHTML = '<h3>선택한 내용</h3><p>위에서 필요한 항목을 골라 주세요.</p>';
    else box.innerHTML = '<h3>선택한 내용</h3><ul>' + list.map(s => {
      const o = Array.from(picked.get(s.k));
      return '<li>' + s.label + (o.length ? ' <span>— ' + o.map(esc).join(', ') + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
    const subj = '[프로젝트 문의] ' + (list.length ? list.map(s => s.k).join('·') : '여행의완성');
    const lines = list.map(s => { const o = Array.from(picked.get(s.k)); return '- ' + s.label + (o.length ? ': ' + o.join(', ') : ''); });
    const body = ['안녕하세요, 여행의완성 프로젝트 문의드립니다.', '', '[문의 항목]'].concat(lines.length ? lines : ['- '], ['', '지역: ', '회사명: ', '담당자명: ', '연락처: ', '이메일: ', '기존 홈페이지: ']).join('\n');
    $('#mail').href = 'mailto:yeowan@yeowan.kr?subject=' + encodeURIComponent(subj) + '&body=' + encodeURIComponent(body);
  }
  function initAsk() {
    $('#toggles').innerHTML = SV.map((s, i) => '<button class="tg" type="button" aria-pressed="false" data-k="' + s.k + '"><span class="tg-top"><span>0' + (i + 1) + '</span><span class="tg-ck" aria-hidden="true"></span></span><span class="tg-b"><span class="tg-k">' + s.k + '</span><span class="tg-s">' + s.label + '</span></span></button>').join('');
    $('#subopts').innerHTML = SV.map(s => '<div class="so" data-k="' + s.k + '" hidden><p class="so-h">' + s.label + '</p><div class="so-list">' + s.opts.map(o => '<button class="oc" type="button" aria-pressed="false" data-o="' + esc(o) + '">' + esc(o) + '</button>').join('') + '</div></div>').join('');
    $$('#toggles .tg').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.k, on = !picked.has(k);
      if (on) picked.set(k, new Set()); else picked.delete(k);
      b.setAttribute('aria-pressed', String(on));
      const so = $('.so[data-k="' + k + '"]');
      so.hidden = !on;
      if (!on) $$('.oc', so).forEach(o => o.setAttribute('aria-pressed', 'false'));
      if (on && !RM) {
        so.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], { duration: 700, easing: EIO });
        $$('.oc', so).forEach((o, i) => o.animate([{ transform: 'translateY(16px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 80 + Math.min(i, 8) * 50, easing: EO, fill: 'backwards' }));
      }
      updateSummary();
    }));
    $$('#subopts .oc').forEach(o => o.addEventListener('click', () => {
      const k = o.closest('.so').dataset.k, set = picked.get(k);
      if (!set) return;
      const v = o.dataset.o, on = !set.has(v);
      if (on) set.add(v); else set.delete(v);
      o.setAttribute('aria-pressed', String(on));
      updateSummary();
    }));
    updateSummary();
  }

  const numbers = $('.numbers'), wm = $('#wm'), wls = $$('.wl > span');
  let numTop = 0, wmTop = 0, wmH = 1, lastRt = -1, lastQ = -1;
  function measure() {
    numTop = numbers.getBoundingClientRect().top + scrollY;
    const r = wm.getBoundingClientRect();
    wmTop = r.top + scrollY;
    wmH = Math.max(1, r.height);
    lastQ = -1;
    lastRt = -1;
  }
  function fitWM() {
    const box = wm.parentElement, cs = getComputedStyle(box);
    const avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    wm.style.fontSize = '100px';
    const w = wm.getBoundingClientRect().width;
    if (w > 0) wm.style.fontSize = (100 * avail / w * .995).toFixed(2) + 'px';
  }
  function scrubs(y) {
    if (RM) return;
    const vh = innerHeight;
    const p = clamp((y + vh - numTop) / (vh * .9), 0, 1);
    const rt = Math.round((1 - p * (2 - p)) * Math.min(innerWidth * .22, 340));
    if (rt !== lastRt) { lastRt = rt; numbers.style.setProperty('--rt', rt + 'px'); }
    const q = clamp((y + vh - wmTop) / (wmH * 1.1), 0, 1);
    if (Math.abs(q - lastQ) > .0005) {
      lastQ = q;
      wls.forEach((s, i) => {
        const lp = clamp((q - i * .07) / (1 - 5 * .07), 0, 1);
        const e = 1 - Math.pow(1 - lp, 3);
        s.style.transform = 'translateY(' + ((1 - e) * 105).toFixed(2) + '%)';
      });
    }
  }

  d.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id === '#') return;
    const el = id === '#top' ? null : $(id);
    if (id !== '#top' && !el) return;
    e.preventDefault();
    if (menuOpen) setMenu(false);
    const y = el ? el.getBoundingClientRect().top + scrollY : 0;
    scrollToY(y);
    if (el) {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
  });

  let last = performance.now(), py = scrollY, vel = 0;
  function tick(now) {
    const dt = clamp((now - last) / 1000, .001, .05);
    last = now;
    ssUpdate(now, dt);
    const y = scrollY;
    const v = (y - py) / dt;
    py = y;
    vel += (v - vel) * kf(.25, dt);
    navUpdate(y);
    if (tasks.size) tasks.forEach(t => { if (t(now, dt) === false) tasks.delete(t); });
    for (const m of marquees) m.update(dt, vel);
    cursorUpdate(dt);
    peekUpdate(dt);
    scrubs(y);
    requestAnimationFrame(tick);
  }

  let rz = 0;
  function onResize() {
    clearTimeout(rz);
    rz = setTimeout(() => {
      $$('.rv-lines').forEach(el => { if (!el.classList.contains('in')) indexLines(el); });
      fitWM();
      measure();
      measureMax();
      marquees.forEach(m => m.measure());
      pk.h = 0;
    }, 150);
  }

  function heroIntro() {
    const hero = $('.hero');
    $$('.hero .rv-fade').forEach((el, i) => el.style.setProperty('--d', (650 + i * 90) + 'ms'));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      hero.classList.add('in');
      $$('.hero .rv-fade').forEach(el => el.classList.add('in'));
    }));
  }

  function init() {
    $$('[data-roll]').forEach(roll);
    $$('.rv-lines').forEach(splitWords);
    $$('[data-count]').forEach(prepCount);
    initSmooth();
    initCursor();
    initMagnetic();
    initServices();
    initPeek();
    initAsk();
    initChips();
    const fontsReady = Promise.race([d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve(), new Promise(r => setTimeout(r, 1200))]);
    fontsReady.then(() => {
      $$('.rv-lines').forEach(el => { indexLines(el); watch(el); });
      $$('.eyebrow').forEach(el => watch(el));
      $$('.rv-fade').filter(el => !el.closest('.hero')).forEach(el => watch(el));
      $$('.num').forEach(n => watch(n, () => countUp($('[data-count]', n))));
      fitWM();
      measure();
      heroIntro();
      marquees.forEach(m => m.measure());
    });
    Promise.all([fetch(A + 'stays.json').then(r => r.json()), fetch(A + 'photos.json').then(r => r.json())]).then(([stays, photos]) => {
      STAYS = stays;
      stays.forEach(s => byKey.set('s' + s.id, s));
      SORTED = stays.slice().sort((a, b) => (b.featured - a.featured) || ((a.featured && b.featured) ? a.order - b.order : 0));
      buildStrip(photos);
      buildNames(stays);
      buildFilters();
      render(false);
      $$('.mq').forEach(m => marquees.push(new Marquee(m)));
      fontsReady.then(() => { marquees.forEach(m => m.measure()); measure(); measureMax(); });
      measure();
      measureMax();
    }).catch(() => {});
    addEventListener('resize', onResize);
    new ResizeObserver(() => { measureMax(); measure(); }).observe(d.body);
    requestAnimationFrame(tick);
  }
  init();
})();
