(() => {
  const d = document;
  const html = d.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const OUT = 'cubic-bezier(.19,1,.22,1)';
  const IO = 'cubic-bezier(.76,0,.24,1)';
  const A = '../assets/';
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lk = (base, dt) => 1 - Math.pow(1 - base, dt * 60);
  const pad = n => String(n).padStart(2, '0');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const easeIO = t => (t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
  let vw = innerWidth;
  let vh = innerHeight;
  const narrow = () => vw <= 900;

  const tasks = new Set();

  function tokenize(node, wraps, out) {
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) out.push({ t: n.nodeValue, w: wraps });
      else if (n.nodeType === 1) {
        if (n.tagName === 'BR') out.push({ br: true });
        else tokenize(n, wraps.concat(n), out);
      }
    });
    return out;
  }

  function wordNode(segs) {
    const w = d.createElement('span');
    w.className = 'w';
    segs.forEach(s => {
      let node = d.createTextNode(s.t);
      for (let i = s.w.length - 1; i >= 0; i--) {
        const c = s.w[i].cloneNode(false);
        c.appendChild(node);
        node = c;
      }
      w.appendChild(node);
    });
    return w;
  }

  function split(el) {
    if (!el.__orig) el.__orig = el.cloneNode(true);
    const words = [];
    let cur = null;
    const flush = () => { if (cur && cur.segs.length) words.push(cur); cur = null; };
    const add = (seg, glue) => { if (!cur) cur = { segs: [], glue: !!glue }; cur.segs.push(seg); };
    tokenize(el.__orig, [], []).forEach(tk => {
      if (tk.br) { flush(); words.push('br'); return; }
      tk.t.split(/([ \t\n\r\f]+)/).forEach(p => {
        if (!p) return;
        if (/^[ \t\n\r\f]+$/.test(p)) { flush(); return; }
        const parts = p.length > 8 ? p.split(/(?<=·)/) : [p];
        parts.forEach((q, qi) => {
          if (qi > 0) { flush(); add({ t: q, w: tk.w }, true); }
          else add({ t: q, w: tk.w }, cur ? cur.glue : false);
        });
      });
    });
    flush();
    el.textContent = '';
    let first = true;
    const spans = words.map(wd => {
      if (wd === 'br') { el.appendChild(d.createElement('br')); first = true; return 'br'; }
      if (!first) el.appendChild(wd.glue ? d.createElement('wbr') : d.createTextNode(' '));
      first = false;
      const s = wordNode(wd.segs);
      s.__glue = wd.glue;
      el.appendChild(s);
      return s;
    });
    const lines = [];
    let line = null;
    let top = 0;
    spans.forEach(s => {
      if (s === 'br') { line = null; return; }
      const t = s.offsetTop;
      if (!line || Math.abs(t - top) > 3) { line = []; lines.push(line); top = t; }
      line.push(s);
    });
    el.textContent = '';
    lines.forEach((ln, i) => {
      const o = d.createElement('span');
      o.className = 'ln';
      const inner = d.createElement('span');
      inner.className = 'ln__i';
      inner.style.setProperty('--li', Math.min(i, 7));
      ln.forEach((s, j) => {
        if (j && !s.__glue) inner.appendChild(d.createTextNode(' '));
        inner.appendChild(s);
      });
      o.appendChild(inner);
      el.appendChild(o);
    });
    el.classList.add('is-split');
    el.__sw = el.clientWidth;
  }

  function resplit(force) {
    $$('[data-split].is-split').forEach(el => {
      if (force || el.clientWidth !== el.__sw) split(el);
    });
  }

  function countUp(el) {
    if (el.__counted) return;
    el.__counted = true;
    if (reduced) return;
    const end = parseFloat(el.dataset.count);
    const txt = el.textContent;
    const t0 = performance.now();
    const dur = 1500;
    el.textContent = '0';
    tasks.add(() => {
      const p = clamp((performance.now() - t0) / dur, 0, 1);
      const e = p >= 1 ? 1 : 1 - Math.pow(2, -10 * p);
      if (p >= 1) { el.textContent = txt; return false; }
      el.textContent = String(Math.round(end * e));
      return true;
    });
  }

  function reveal(el) {
    el.classList.add('is-in');
    if (el.hasAttribute('data-count')) countUp(el);
    $$('[data-count]', el).forEach(countUp);
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      reveal(e.target);
      const t = e.target;
      setTimeout(() => { t.style.willChange = ''; }, 1800);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });

  function watch(root) {
    $$('[data-split]', root).forEach(el => { if (!el.classList.contains('is-split')) split(el); });
    $$('[data-reveal], [data-split], [data-count]', root).forEach(el => {
      if (el.__watched) return;
      el.__watched = true;
      if (reduced) reveal(el);
      else io.observe(el);
    });
  }

  const smooth = { on: fine && !reduced, y: scrollY, target: scrollY, max: 0, set: -9, anim: null };

  function measureMax() {
    smooth.max = Math.max(0, html.scrollHeight - innerHeight);
    smooth.target = clamp(smooth.target, 0, smooth.max);
  }

  function innerScrollable(el, dy) {
    while (el && el !== d.body && el !== html && el.nodeType === 1) {
      if (el.scrollHeight > el.clientHeight + 1) {
        const oy = getComputedStyle(el).overflowY;
        if (oy === 'auto' || oy === 'scroll') {
          if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
        }
      }
      if (el.tagName === 'TEXTAREA') return true;
      el = el.parentNode;
    }
    return false;
  }

  function writeScroll(y) {
    smooth.set = y;
    window.scrollTo(0, y);
  }

  if (smooth.on) {
    html.classList.add('is-smooth');
    addEventListener('wheel', e => {
      if (e.ctrlKey || html.classList.contains('is-locked')) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (innerScrollable(e.target, e.deltaY)) return;
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= innerHeight;
      dy = clamp(dy, -240, 240);
      if (smooth.anim) { smooth.anim = null; smooth.target = smooth.y; }
      smooth.target = clamp(smooth.target + dy, 0, smooth.max);
    }, { passive: false });
    addEventListener('scroll', () => {
      if (Math.abs(scrollY - smooth.set) > 2) {
        smooth.y = smooth.target = scrollY;
        smooth.set = scrollY;
        smooth.anim = null;
      }
    }, { passive: true });
  }

  function smoothStep(dt) {
    if (!smooth.on) return;
    if (smooth.anim) {
      const a = smooth.anim;
      const p = clamp((performance.now() - a.t0) / a.dur, 0, 1);
      smooth.y = smooth.target = a.from + (a.to - a.from) * easeIO(p);
      if (p >= 1) smooth.anim = null;
      writeScroll(smooth.y);
      return;
    }
    const diff = smooth.target - smooth.y;
    if (Math.abs(diff) < .5) {
      if (diff !== 0) { smooth.y = smooth.target; writeScroll(smooth.y); }
      return;
    }
    smooth.y += diff * lk(.1, dt);
    writeScroll(smooth.y);
  }

  function scrollToY(y) {
    y = clamp(y, 0, Math.max(0, html.scrollHeight - innerHeight));
    if (reduced) { window.scrollTo(0, y); return; }
    if (!smooth.on) { window.scrollTo({ top: y, behavior: 'smooth' }); return; }
    const dist = Math.abs(y - scrollY);
    smooth.y = scrollY;
    smooth.anim = { from: scrollY, to: y, t0: performance.now(), dur: clamp(900 + dist * .1, 900, 1600) };
  }

  const nav = $('[data-nav]');
  const menu = $('[data-menu]');
  const toggle = $('[data-menu-toggle]');
  const toggleT = $('.nav__toggle-t', toggle);
  let menuOpen = false;
  let menuTimer = 0;

  function openMenu() {
    clearTimeout(menuTimer);
    menuOpen = true;
    menu.hidden = false;
    html.classList.add('menu-open', 'is-locked');
    toggle.setAttribute('aria-expanded', 'true');
    toggleT.textContent = '닫기';
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
    setTimeout(() => { const a = $('a', menu); if (a && menuOpen) a.focus({ preventScroll: true }); }, 320);
  }

  function closeMenu(back) {
    if (!menuOpen) return;
    menuOpen = false;
    menu.classList.remove('is-open');
    html.classList.remove('menu-open', 'is-locked');
    toggle.setAttribute('aria-expanded', 'false');
    toggleT.textContent = '메뉴';
    menuTimer = setTimeout(() => { menu.hidden = true; }, reduced ? 0 : 470);
    if (back) toggle.focus({ preventScroll: true });
  }

  toggle.addEventListener('click', () => (menuOpen ? closeMenu(true) : openMenu()));
  d.addEventListener('keydown', e => {
    if (!menuOpen) return;
    if (e.key === 'Escape') { closeMenu(true); return; }
    if (e.key === 'Tab') {
      const f = [toggle].concat($$('a', menu));
      const i = f.indexOf(d.activeElement);
      e.preventDefault();
      const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length;
      f[n].focus();
    }
  });
  addEventListener('resize', () => { if (menuOpen && innerWidth > 900) closeMenu(false); });

  d.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const t = d.getElementById(id.slice(1));
    if (!t) return;
    e.preventDefault();
    const wasOpen = menuOpen;
    closeMenu(false);
    const y = id === '#top' ? 0 : t.getBoundingClientRect().top + scrollY;
    if (wasOpen) nav.classList.add('is-hidden');
    scrollToY(y);
    if (!t.hasAttribute('tabindex')) t.setAttribute('tabindex', '-1');
    t.focus({ preventScroll: true });
  });

  const SCENES = ['01', '10', '23', '03', '24', '15', '18', '11'];
  const OP = { '01': '74% 50%', '10': '30% 50%', '23': '44% 50%', '03': '52% 50%', '24': '40% 50%', '15': '60% 50%', '18': '50% 50%', '11': '66% 50%' };
  const hero = {
    el: $('[data-hero]'), stage: $('[data-hero-stage]'), list: [], i: 0, t: 0, dur: 6.2,
    busy: false, vis: true, started: false,
    name: $('[data-hero-name]'), region: $('[data-hero-region]'), scene: $('[data-hero-scene]'),
    num: $('[data-hero-num]'), prog: $('[data-hero-prog]')
  };

  function buildHero(photos) {
    SCENES.forEach(n => {
      const p = photos.find(x => x.file === 'photos/' + n + '.jpg');
      if (!p) return;
      const el = d.createElement('div');
      el.className = 'scene';
      el.innerHTML = '<div class="scene__in"><picture><source media="(max-width: 760px)"><img alt="" decoding="async"></picture></div>';
      const img = $('img', el);
      img.alt = p.stay + ' ' + p.scene;
      img.style.setProperty('--op', OP[n] || '50% 50%');
      hero.stage.appendChild(el);
      hero.list.push({ el, inner: $('.scene__in', el), img, src: $('source', el), p, loaded: null, kb: null });
    });
    $('[data-hero-total]').textContent = pad(hero.list.length);
  }

  function loadScene(s) {
    if (!s.loaded) {
      s.src.srcset = A + s.p.small;
      s.img.src = A + s.p.file;
      s.loaded = (s.img.decode ? s.img.decode() : Promise.resolve()).catch(() => {});
    }
    return s.loaded;
  }

  function kenBurns(s, k) {
    if (s.kb) s.kb.cancel();
    s.kb = null;
    if (reduced) return;
    const dir = k % 2 ? -1 : 1;
    const tx = (vw <= 760 ? 2.2 : 1.6) * dir;
    const ty = k % 3 === 0 ? -.7 : .7;
    s.kb = s.img.animate([
      { transform: 'scale(1.2) translate3d(' + (-tx) + '%,' + ty + '%,0)' },
      { transform: 'scale(1.05) translate3d(' + tx + '%,' + (-ty) + '%,0)' }
    ], { duration: (hero.dur + 3.2) * 1000, easing: 'cubic-bezier(.33,.1,.4,1)', fill: 'forwards' });
    if (!hero.vis) s.kb.pause();
  }

  function swapText(el, text, delay) {
    if (!el || el.textContent === text) return;
    if (reduced) { el.textContent = text; return; }
    el.getAnimations().forEach(a => a.cancel());
    const out = el.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,-112%,0)' }], { duration: 620, delay: delay || 0, easing: IO, fill: 'forwards' });
    out.finished.then(() => {
      el.textContent = text;
      const inn = el.animate([{ transform: 'translate3d(0,112%,0)' }, { transform: 'translate3d(0,0,0)' }], { duration: 1150, easing: OUT, fill: 'forwards' });
      out.cancel();
      inn.finished.then(() => inn.cancel()).catch(() => {});
    }).catch(() => {});
  }

  function caption(n) {
    const p = hero.list[n].p;
    swapText(hero.name, p.stay, 0);
    swapText(hero.region, p.region, 90);
    swapText(hero.scene, p.scene, 160);
    swapText(hero.num, pad(n + 1), 0);
  }

  function heroGo(n, dir) {
    const total = hero.list.length;
    n = (n + total) % total;
    if (hero.busy || n === hero.i || !hero.started) return;
    const cur = hero.list[hero.i];
    const nx = hero.list[n];
    hero.busy = true;
    const pv = clamp(hero.t / hero.dur, 0, 1);
    hero.t = 0;
    if (!reduced) {
      hero.prog.animate([{ transform: 'scaleX(' + pv + ')', transformOrigin: '100% 50%' }, { transform: 'scaleX(0)', transformOrigin: '100% 50%' }], { duration: 700, easing: IO });
    }
    hero.prog.style.transform = 'scaleX(0)';
    loadScene(nx).then(() => {
      caption(n);
      if (reduced) {
        cur.el.classList.remove('is-on');
        nx.el.classList.add('is-on');
        hero.i = n;
        hero.busy = false;
        loadScene(hero.list[(n + 1) % total]);
        return;
      }
      nx.el.getAnimations().forEach(a => a.cancel());
      cur.el.style.zIndex = '1';
      nx.el.style.zIndex = '2';
      kenBurns(nx, n);
      const from = dir > 0 ? 'inset(0 0 0 100%)' : 'inset(0 100% 0 0)';
      const wipe = nx.el.animate([{ clipPath: from }, { clipPath: 'inset(0 0% 0 0%)' }], { duration: 1300, easing: IO, fill: 'forwards' });
      const push = cur.inner.animate([{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(' + (-12 * dir) + '%,0,0)' }], { duration: 1300, easing: IO, fill: 'forwards' });
      wipe.finished.then(() => {
        nx.el.classList.add('is-on');
        cur.el.classList.remove('is-on');
        wipe.cancel();
        push.cancel();
        if (cur.kb) { cur.kb.cancel(); cur.kb = null; }
        cur.el.style.zIndex = '';
        nx.el.style.zIndex = '';
        hero.i = n;
        hero.t = 0;
        hero.busy = false;
        loadScene(hero.list[(n + 1) % total]);
      }).catch(() => { hero.busy = false; });
    });
  }

  async function startHero() {
    const first = hero.list[0];
    if (!first) { hero.el.classList.add('is-open', 'is-ready'); html.classList.add('is-loaded'); return; }
    hero.name.textContent = first.p.stay;
    hero.region.textContent = first.p.region;
    hero.scene.textContent = first.p.scene;
    hero.num.textContent = '01';
    await Promise.race([loadScene(first), wait(2600)]);
    first.el.classList.add('is-on');
    kenBurns(first, 0);
    requestAnimationFrame(() => {
      hero.el.classList.add('is-open');
      setTimeout(() => {
        hero.el.classList.add('is-ready');
        html.classList.add('is-loaded');
      }, reduced ? 0 : 520);
    });
    hero.t = reduced ? 0 : -1.2;
    hero.started = true;
    loadScene(hero.list[1]);
  }

  function heroTick(dt) {
    if (!hero.started || reduced || hero.busy || !hero.vis || d.hidden) return;
    hero.t += dt;
    hero.prog.style.transform = 'scaleX(' + clamp(hero.t / hero.dur, 0, 1).toFixed(4) + ')';
    if (hero.t >= hero.dur) heroGo(hero.i + 1, 1);
  }

  $('[data-hero-next]').addEventListener('click', () => heroGo(hero.i + 1, 1));
  $('[data-hero-prev]').addEventListener('click', () => heroGo(hero.i - 1, -1));

  new IntersectionObserver(es => {
    hero.vis = es[0].isIntersecting;
    hero.list.forEach(s => {
      if (!s.kb) return;
      if (hero.vis && s.kb.playState === 'paused') s.kb.play();
      else if (!hero.vis && s.kb.playState === 'running') s.kb.pause();
    });
  }).observe(hero.el);

  const JOURNAL = [
    { id: 33, ph: '18' }, { id: 3, ph: '01' }, { id: 200, ph: '02' }, { id: 164, ph: '24' },
    { id: 161, ph: '09' }, { id: 158, ph: '16' }, { id: 191, ph: '13' }, { id: 194, ph: '17' }, { id: 163, ph: '19' }
  ];
  const NS = 'http://www.w3.org/2000/svg';
  const map = {
    el: $('[data-map]'), zoom: $('[data-map-zoom]'), label: $('[data-map-label]'), labelT: $('[data-map-label-t]'),
    step: $('[data-map-step]'), ready: false, active: -2, items: [], dots: {}, ring: null, route: null, cum: [],
    W: 0, H: 0, s: 1, ox: 0, oy: 0, x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1, rp: 0, rt: 0, dirty: true
  };
  const journal = { el: $('[data-journal]'), list: $('[data-journal-list]'), entries: [], top: 0, bottom: 0 };

  function svgEl(tag, attrs) {
    const n = d.createElementNS(NS, tag);
    Object.keys(attrs).forEach(k => n.setAttribute(k, attrs[k]));
    return n;
  }

  function buildJournal(photos, stays, korea) {
    const byId = {};
    stays.forEach(s => { byId[s.id] = s; });
    map.items = JOURNAL.map(j => ({ stay: byId[j.id], photo: photos.find(p => p.file === 'photos/' + j.ph + '.jpg') })).filter(x => x.stay && x.photo);
    const svg = svgEl('svg', { viewBox: korea.viewBox, 'aria-hidden': 'true', focusable: 'false' });
    const land = svgEl('g', {});
    korea.paths.forEach(pd => land.appendChild(svgEl('path', { d: pd, class: 'map__land' })));
    svg.appendChild(land);
    const pts = map.items.map(it => [it.stay.x, it.stay.y]);
    let total = 0;
    map.cum = [0];
    for (let i = 1; i < pts.length; i++) {
      total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      map.cum.push(total);
    }
    map.cum = map.cum.map(c => (total ? c / total : 0));
    map.route = svgEl('path', { d: 'M' + pts.map(p => p[0] + ',' + p[1]).join(' L'), class: 'map__route', pathLength: '1' });
    svg.appendChild(map.route);
    const jIds = new Set(map.items.map(it => it.stay.id));
    const dg = svgEl('g', {});
    stays.filter(s => !jIds.has(s.id)).forEach(s => dg.appendChild(svgEl('circle', { cx: s.x, cy: s.y, r: 2.6, class: 'dot' })));
    map.items.forEach(it => {
      const c = svgEl('circle', { cx: it.stay.x, cy: it.stay.y, r: 3.2, class: 'dot is-j' });
      map.dots[it.stay.id] = c;
      dg.appendChild(c);
    });
    svg.appendChild(dg);
    map.ring = svgEl('circle', { cx: 0, cy: 0, r: 15, class: 'map__ring' });
    svg.appendChild(map.ring);
    map.zoom.appendChild(svg);

    const frag = d.createDocumentFragment();
    map.items.forEach((it, i) => {
      const s = it.stay;
      const p = it.photo;
      const types = (s.types || []).map(t => '<li>' + esc(t) + '</li>').join('');
      const li = d.createElement('li');
      li.className = 'entry';
      li.innerHTML =
        '<a class="entry__media frame" data-reveal="clip" data-cursor="숙소 보기" href="' + esc(s.url) + '" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">' +
          '<img src="' + A + p.small + '" srcset="' + A + p.small + ' 960w, ' + A + p.file + ' 1920w" sizes="(max-width: 900px) 92vw, 46vw" alt="" loading="lazy" width="1920" height="1280">' +
        '</a>' +
        '<div class="entry__meta">' +
          '<span class="entry__no">' + pad(i + 1) + '</span>' +
          '<h3 class="entry__name" data-split>' + esc(s.name) + '</h3>' +
          '<div class="entry__info" data-reveal="fade"><span>' + esc(s.region) + ' · ' + esc(p.scene) + '</span>' + (types ? '<ul class="entry__types" aria-label="유형">' + types + '</ul>' : '') + '</div>' +
          '<a class="entry__link" data-reveal="fade" href="' + esc(s.url) + '" target="_blank" rel="noopener">숙소 보러 가기 <span aria-hidden="true">↗</span></a>' +
        '</div>';
      $('img', li).alt = s.name + ' ' + p.scene;
      frag.appendChild(li);
    });
    journal.list.appendChild(frag);
    journal.entries = $$('.entry', journal.list).map(el => ({ el, top: 0 }));
    map.ready = true;
    measureMap();
    map.x = map.tx; map.y = map.ty; map.z = map.tz;
    map.dirty = true;
    setActive(-1);
  }

  function measureMap() {
    if (!map.ready) return;
    const W = map.el.clientWidth;
    const H = map.el.clientHeight;
    const padX = narrow() ? 16 : 56;
    const padY = narrow() ? 16 : 64;
    const s = Math.min((W - padX * 2) / 1000, (H - padY * 2) / 1233);
    map.W = W; map.H = H; map.s = s;
    map.ox = (W - 1000 * s) / 2;
    map.oy = (H - 1233 * s) / 2;
    map.zoom.style.width = (1000 * s) + 'px';
    map.zoom.style.height = (1233 * s) + 'px';
    map.Z = narrow() ? 3.1 : 2.2;
    mapTarget(map.active);
    map.dirty = true;
  }

  function mapTarget(i) {
    if (i < 0 || !map.items[i]) {
      map.tx = map.ox; map.ty = map.oy; map.tz = 1;
      return;
    }
    const st = map.items[i].stay;
    const z = map.Z;
    map.tz = z;
    map.tx = map.W * .5 - st.x * map.s * z;
    map.ty = map.H * (narrow() ? .5 : .47) - st.y * map.s * z;
  }

  function setActive(i) {
    if (i === map.active) return;
    const prev = map.items[map.active];
    if (prev) map.dots[prev.stay.id].classList.remove('is-on');
    map.active = i;
    mapTarget(i);
    const it = map.items[i];
    if (it) {
      map.dots[it.stay.id].classList.add('is-on');
      map.ring.style.transition = 'none';
      map.ring.classList.remove('is-on');
      map.ring.setAttribute('cx', it.stay.x);
      map.ring.setAttribute('cy', it.stay.y);
      void map.ring.getBoundingClientRect();
      map.ring.style.transition = '';
      map.ring.classList.add('is-on');
      map.label.classList.remove('is-off');
      map.label.style.visibility = '';
      swapText(map.labelT, pad(i + 1) + '  ' + it.stay.name, 0);
      swapText(map.step, pad(i + 1), 0);
      map.rt = map.cum[i] || 0;
    } else {
      map.ring.classList.remove('is-on');
      map.label.classList.add('is-off');
      if (reduced) map.label.style.visibility = 'hidden';
      swapText(map.step, '00', 0);
      map.rt = 0;
    }
    map.dirty = true;
    if (reduced) { map.x = map.tx; map.y = map.ty; map.z = map.tz; map.rp = map.rt; }
  }

  function mapTick(dt, y) {
    if (!map.ready) return;
    if (y + vh < journal.top - 200 || y > journal.bottom + 200) return;
    let line;
    if (narrow()) {
      const mh = map.el.clientHeight || vh * .4;
      line = y + mh + (vh - mh) * .45;
    } else line = y + vh * .55;
    let a = -1;
    for (let i = 0; i < journal.entries.length; i++) if (journal.entries[i].top <= line) a = i;
    setActive(a);
    const k = reduced ? 1 : lk(.075, dt);
    const dx = map.tx - map.x;
    const dy = map.ty - map.y;
    const dz = map.tz - map.z;
    const dr = map.rt - map.rp;
    if (!map.dirty && Math.abs(dx) < .05 && Math.abs(dy) < .05 && Math.abs(dz) < .0005 && Math.abs(dr) < .0005) return;
    map.dirty = false;
    map.x += dx * k; map.y += dy * k; map.z += dz * k; map.rp += dr * k;
    map.zoom.style.transform = 'translate3d(' + map.x.toFixed(2) + 'px,' + map.y.toFixed(2) + 'px,0) scale(' + map.z.toFixed(4) + ')';
    map.zoom.style.setProperty('--k', (1 / (map.s * map.z)).toFixed(4));
    map.route.style.strokeDashoffset = (1 - map.rp).toFixed(4);
    const it = map.items[map.active];
    if (it) {
      const lx = map.x + it.stay.x * map.s * map.z;
      const ly = map.y + it.stay.y * map.s * map.z;
      const lw = map.label.offsetWidth;
      const left = lx + 22 + lw > map.W - 12 ? lx - 22 - lw : lx + 22;
      map.label.style.transform = 'translate3d(' + left.toFixed(1) + 'px,' + (ly - 17).toFixed(1) + 'px,0)';
    }
  }

  const strip = { track: $('[data-strip]'), list: $('[data-strip-list]'), bar: $('[data-strip-bar]'), v: 0, inertia: false };

  function buildStrip(stays) {
    const feat = stays.filter(s => s.featured).sort((a, b) => (a.order - b.order) || (a.id - b.id));
    const frag = d.createDocumentFragment();
    feat.forEach((s, i) => {
      const li = d.createElement('li');
      li.className = 'card';
      const dl = (Math.min(i, 7) * .07).toFixed(2);
      li.innerHTML =
        '<a class="card__link" href="' + esc(s.url) + '" target="_blank" rel="noopener" draggable="false" data-cursor="숙소 보기">' +
          '<div class="card__media" data-reveal="clip" style="--d:' + dl + 's"><div class="card__zoom"><img src="' + A + s.thumb + '" alt="" loading="lazy" draggable="false" width="717" height="461"></div><span class="card__no">' + pad(i + 1) + '</span></div>' +
          '<div class="card__meta" data-reveal="fade" style="--d:' + (+dl + .14).toFixed(2) + 's"><h3 class="card__name">' + esc(s.name) + '</h3><p class="card__sub"><span>' + esc(s.region) + '</span><span>' + esc((s.types || []).join(' · ')) + '</span></p></div>' +
        '</a>';
      $('img', li).alt = s.name;
      frag.appendChild(li);
    });
    strip.list.appendChild(frag);
    stripBar();
  }

  function stripBar() {
    const t = strip.track;
    const max = t.scrollWidth - t.clientWidth;
    const p = max > 0 ? t.scrollLeft / max : 0;
    strip.bar.style.transform = 'scaleX(' + Math.max(.06, p).toFixed(4) + ')';
  }

  (() => {
    const t = strip.track;
    let down = null;
    let moved = false;
    t.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = { x: e.clientX, sl: t.scrollLeft, lx: e.clientX, lt: performance.now(), id: e.pointerId };
      moved = false;
      strip.inertia = false;
      strip.v = 0;
    });
    addEventListener('pointermove', e => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x;
      if (!moved && Math.abs(dx) > 6) { moved = true; t.classList.add('is-drag'); }
      if (!moved) return;
      t.scrollLeft = down.sl - dx;
      const now = performance.now();
      const span = Math.max(now - down.lt, 1);
      strip.v = (e.clientX - down.lx) / span * 16.7;
      down.lx = e.clientX;
      down.lt = now;
    });
    const up = () => {
      if (!down) return;
      down = null;
      if (moved) {
        strip.inertia = !reduced;
        setTimeout(() => { t.classList.remove('is-drag'); moved = false; }, 0);
      }
    };
    addEventListener('pointerup', up);
    addEventListener('pointercancel', up);
    t.addEventListener('click', e => { if (moved) { e.preventDefault(); e.stopPropagation(); } }, true);
    t.addEventListener('dragstart', e => e.preventDefault());
    t.addEventListener('scroll', stripBar, { passive: true });
  })();

  function stripTick(dt) {
    if (!strip.inertia) return;
    strip.track.scrollLeft -= strip.v * dt * 60;
    strip.v *= Math.pow(.93, dt * 60);
    if (Math.abs(strip.v) < .2) strip.inertia = false;
  }

  const plx = $$('[data-parallax]').map(el => ({ el, amt: parseFloat(el.dataset.parallax) || 8, top: 0, h: 0, last: 99 }));
  const work = { el: $('[data-work]'), top: 0, last: -1 };
  const foot = { band: $('.foot__band'), words: $$('[data-foot-word] .fw > span'), top: 0, h: 0, last: [] };
  const navState = { lastY: scrollY, hidden: false, solid: false };

  function measureAll() {
    vw = innerWidth;
    vh = innerHeight;
    measureMax();
    const sy = scrollY;
    plx.forEach(p => {
      const r = p.el.parentElement.getBoundingClientRect();
      p.top = r.top + sy;
      p.h = r.height;
    });
    work.top = work.el.getBoundingClientRect().top + sy;
    const fb = foot.band.getBoundingClientRect();
    foot.top = fb.top + sy;
    foot.h = fb.height;
    const jr = journal.el.getBoundingClientRect();
    journal.top = jr.top + sy;
    journal.bottom = jr.bottom + sy;
    journal.entries.forEach(en => { en.top = en.el.getBoundingClientRect().top + sy + 40; });
    measureMap();
    stripBar();
  }

  function navTick(y) {
    const dy = y - navState.lastY;
    if (Math.abs(dy) > 6) {
      const hide = dy > 0 && y > 160 && !menuOpen;
      if (hide !== navState.hidden) { navState.hidden = hide; nav.classList.toggle('is-hidden', hide); }
      navState.lastY = y;
    }
    const solid = y > hero.el.offsetHeight - 90;
    if (solid !== navState.solid) { navState.solid = solid; nav.classList.toggle('is-solid', solid); }
  }

  function plxTick(y) {
    plx.forEach(p => {
      if (y + vh < p.top - 50 || y > p.top + p.h + 50) return;
      const prog = (y + vh - p.top) / (vh + p.h);
      const off = Math.round((prog - .5) * 2 * p.amt * 100) / 100;
      if (off === p.last) return;
      p.last = off;
      p.el.style.transform = 'translate3d(0,' + off + '%,0)';
    });
  }

  function workTick(y) {
    const rel = work.top - y;
    if (rel > vh + 10 || rel < -vh) return;
    const maxR = vw <= 760 ? 28 : 72;
    const p = clamp((rel - vh * .12) / (vh * .88), 0, 1);
    const r = Math.round(maxR * p * 10) / 10;
    if (r === work.last) return;
    work.last = r;
    work.el.style.setProperty('--r', r + 'px');
  }

  function footTick(y) {
    if (y + vh < foot.top - 20) return;
    const p = clamp((y + vh - foot.top) / (foot.h * .85), 0, 1);
    foot.words.forEach((w, i) => {
      const lp = clamp((p - i * .12) / .62, 0, 1);
      const e = 1 - Math.pow(1 - lp, 3);
      const v = Math.round((1 - e) * 1060) / 10;
      if (foot.last[i] === v) return;
      foot.last[i] = v;
      w.style.transform = 'translate3d(0,' + v + '%,0)';
    });
  }

  const mags = (fine && !reduced) ? $$('[data-magnetic]').map(el => ({ el, inner: $('.mag__i', el), x: 0, y: 0, tx: 0, ty: 0, on: false })) : [];
  mags.forEach(m => {
    m.el.addEventListener('pointermove', e => {
      const r = m.el.getBoundingClientRect();
      m.tx = clamp((e.clientX - (r.left + r.width / 2)) * .3, -10, 10);
      m.ty = clamp((e.clientY - (r.top + r.height / 2)) * .3, -8, 8);
      m.on = true;
    });
    m.el.addEventListener('pointerleave', () => { m.tx = 0; m.ty = 0; });
  });

  function magTick(dt) {
    const k = lk(.14, dt);
    mags.forEach(m => {
      if (!m.on) return;
      m.x += (m.tx - m.x) * k;
      m.y += (m.ty - m.y) * k;
      if (m.tx === 0 && m.ty === 0 && Math.abs(m.x) < .05 && Math.abs(m.y) < .05) { m.x = 0; m.y = 0; m.on = false; }
      m.el.style.transform = m.on ? 'translate3d(' + m.x.toFixed(2) + 'px,' + m.y.toFixed(2) + 'px,0)' : '';
      if (m.inner) m.inner.style.transform = m.on ? 'translate3d(' + (m.x * .5).toFixed(2) + 'px,' + (m.y * .5).toFixed(2) + 'px,0)' : '';
    });
  }

  const cursor = { el: $('[data-cursor-el]'), on: fine && !reduced, x: -200, y: -200, rx: -200, ry: -200, seen: false };
  if (cursor.on) {
    const ring = $('.cursor__ring', cursor.el);
    const dot = $('.cursor__dot', cursor.el);
    const label = $('[data-cursor-label]', cursor.el);
    cursor.ring = ring;
    cursor.dot = dot;
    html.classList.add('has-cursor');
    cursor.el.classList.add('is-out');
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      cursor.x = e.clientX;
      cursor.y = e.clientY;
      if (!cursor.seen) { cursor.seen = true; cursor.rx = cursor.x; cursor.ry = cursor.y; }
      cursor.el.classList.remove('is-out');
    }, { passive: true });
    d.addEventListener('mouseout', e => { if (!e.relatedTarget) cursor.el.classList.add('is-out'); });
    d.addEventListener('pointerover', e => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const media = t.closest('[data-cursor]');
      const field = t.closest('input[type="text"], input[type="tel"], input[type="email"], textarea');
      const link = t.closest('a, button, label, [tabindex="0"]');
      cursor.el.classList.toggle('is-media', !!media);
      cursor.el.classList.toggle('is-field', !media && !!field);
      cursor.el.classList.toggle('is-link', !media && !field && !!link);
      if (media) label.textContent = media.dataset.cursor;
    });
  }

  function cursorTick(dt) {
    if (!cursor.on || !cursor.seen) return;
    const k = lk(.2, dt);
    cursor.rx += (cursor.x - cursor.rx) * k;
    cursor.ry += (cursor.y - cursor.ry) * k;
    cursor.dot.style.transform = 'translate3d(' + cursor.x + 'px,' + cursor.y + 'px,0)';
    cursor.ring.style.transform = 'translate3d(' + cursor.rx.toFixed(1) + 'px,' + cursor.ry.toFixed(1) + 'px,0)';
  }

  const form = $('[data-ask]');
  const sumBox = $('[data-sum-box]');
  const mail = $('[data-mail]');
  const INFO = [['지역', 'region'], ['회사명', 'company'], ['담당자명', 'person'], ['연락처', 'phone'], ['이메일', 'email'], ['기존홈페이지', 'site']];

  function updateSummary() {
    const items = [];
    $$('.cat', form).forEach(cat => {
      const h = $('.cat__head input', cat);
      cat.classList.toggle('is-on', h.checked);
      if (!h.checked) return;
      items.push([h.value, $$('.chip input:checked', cat).map(x => x.value)]);
    });
    const info = INFO.map(([k, n]) => [k, form.elements[n].value.trim()]).filter(x => x[1]);
    if (!items.length && !info.length) {
      sumBox.innerHTML = '<p class="sum__empty">문의 항목을 고르면 이곳에 정리됩니다.</p>';
    } else {
      const rows = items.map(([c, subs]) => '<li><b>문의 항목</b><span>' + esc(c) + (subs.length ? ' — ' + esc(subs.join(', ')) : '') + '</span></li>')
        .concat(info.map(([k, v]) => '<li><b>' + esc(k) + '</b><span>' + esc(v) + '</span></li>'));
      sumBox.innerHTML = '<ul class="sum__list">' + rows.join('') + '</ul>';
    }
    const subject = '[여행의완성 상담 문의] ' + (items.length ? items.map(x => x[0]).join(' · ') : '프로젝트 문의');
    const body = []
      .concat(items.length ? ['[문의 항목]'].concat(items.map(([c, subs]) => '- ' + c + (subs.length ? ': ' + subs.join(', ') : ''))) : [])
      .concat(info.length ? ['', '[기본 정보]'].concat(info.map(([k, v]) => k + ': ' + v)) : [])
      .join('\n').trim();
    mail.href = 'mailto:yeowan@yeowan.kr?subject=' + encodeURIComponent(subject) + (body ? '&body=' + encodeURIComponent(body) : '');
  }

  $$('.cat', form).forEach(cat => {
    $$('.chip', cat).forEach((c, i) => c.style.setProperty('--ci', i));
    const h = $('.cat__head input', cat);
    h.addEventListener('change', () => {
      if (!h.checked) $$('.chip input', cat).forEach(x => { x.checked = false; });
    });
  });
  form.addEventListener('change', updateSummary);
  form.addEventListener('input', updateSummary);
  form.addEventListener('submit', e => e.preventDefault());
  updateSummary();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(Math.max((now - last) / 1000, 0), .05);
    last = now;
    smoothStep(dt);
    const y = scrollY;
    navTick(y);
    if (!reduced) {
      plxTick(y);
      workTick(y);
      footTick(y);
    }
    heroTick(dt);
    mapTick(dt, y);
    stripTick(dt);
    magTick(dt);
    cursorTick(dt);
    tasks.forEach(fn => { if (fn(dt) === false) tasks.delete(fn); });
    requestAnimationFrame(frame);
  }

  let measureQueued = false;
  const queueMeasure = () => {
    if (measureQueued) return;
    measureQueued = true;
    requestAnimationFrame(() => { measureQueued = false; measureAll(); });
  };
  let rT = 0;
  addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => { vw = innerWidth; vh = innerHeight; resplit(false); measureAll(); }, 160);
  });
  if ('ResizeObserver' in window) new ResizeObserver(queueMeasure).observe(d.body);
  addEventListener('load', queueMeasure);

  const fontsReady = Promise.race([d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve(), wait(1800)]);
  if (d.fonts && d.fonts.addEventListener) {
    let fT = 0;
    d.fonts.addEventListener('loadingdone', () => {
      clearTimeout(fT);
      fT = setTimeout(() => { resplit(true); queueMeasure(); }, 120);
    });
  }
  fontsReady.then(() => { watch(d); measureAll(); });

  const getJSON = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
  const pPhotos = getJSON(A + 'photos.json');
  pPhotos.then(ph => { buildHero(ph); return startHero(); }).catch(() => {
    hero.el.classList.add('is-open', 'is-ready');
    html.classList.add('is-loaded');
  });
  Promise.all([pPhotos, getJSON(A + 'stays.json'), getJSON(A + 'korea.json')]).then(([ph, st, ko]) => {
    buildJournal(ph, st, ko);
    buildStrip(st);
    return fontsReady.then(() => {
      watch(journal.list);
      watch(strip.list);
      measureAll();
    });
  }).catch(() => {});

  measureAll();
  requestAnimationFrame(frame);
})();
