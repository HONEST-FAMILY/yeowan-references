(() => {
  const html = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const A = '../assets/';
  const E_OUT = 'cubic-bezier(.19,1,.22,1)';
  const E_IO = 'cubic-bezier(.76,0,.24,1)';
  const E_HOVER = 'cubic-bezier(.22,1,.36,1)';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const kf = (base, dt) => 1 - Math.pow(1 - base, dt * 60);
  const easeIO = (p) => (p < .5 ? 8 * p * p * p * p : 1 - Math.pow(-2 * p + 2, 4) / 2);
  const easeOut = (p) => 1 - Math.pow(1 - p, 4);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isPhone = () => innerWidth <= 760;

  let STAYS = [];
  let KOREA = null;
  let PHOTOS = [];
  const byId = new Map();

  const tasks = new Set();
  let lastT = performance.now();
  const loop = (now) => {
    const dt = Math.min(.05, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    tasks.forEach((t) => t(dt, now));
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  function initRoll(root = document) {
    $$('[data-roll]', root).forEach((el) => {
      if (el.dataset.rolled) return;
      el.dataset.rolled = '1';
      const t = el.textContent.trim();
      const r = document.createElement('span');
      r.className = 'roll';
      const a = document.createElement('span');
      a.className = 'roll-a';
      a.textContent = t;
      const b = document.createElement('span');
      b.className = 'roll-b';
      b.textContent = t;
      b.setAttribute('aria-hidden', 'true');
      r.append(a, b);
      el.textContent = '';
      el.append(r);
    });
  }

  function prepSplit(el) {
    const words = [];
    Array.from(el.childNodes).forEach((n) => {
      if (n.nodeType === 3) {
        n.textContent.split(/(\s+)/).forEach((p) => {
          if (!p) return;
          if (/^\s+$/.test(p)) {
            if (words.length) words[words.length - 1]._space = true;
          } else {
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = p;
            words.push(s);
          }
        });
      } else if (n.nodeType === 1) {
        if (n.tagName !== 'BR') n.classList.add('w');
        words.push(n);
      }
    });
    el._words = words;
  }

  function layoutSplit(el) {
    const words = el._words;
    if (!words) return;
    el.textContent = '';
    words.forEach((w) => {
      el.append(w);
      if (w._space) el.append(' ');
    });
    const fs = parseFloat(getComputedStyle(el).fontSize) || 16;
    const lines = [];
    let cur = null;
    let top = 0;
    words.forEach((w) => {
      if (w.tagName === 'BR') {
        cur = null;
        return;
      }
      const t = w.offsetTop;
      if (!cur || t - top > fs * .5) {
        cur = [];
        lines.push(cur);
        top = t;
      }
      cur.push(w);
    });
    el.textContent = '';
    lines.forEach((ln, i) => {
      const L = document.createElement('span');
      L.className = 'line';
      const I = document.createElement('span');
      I.className = 'line-in';
      I.style.setProperty('--li', i);
      ln.forEach((w, j) => {
        I.append(w);
        if (j < ln.length - 1 && w._space) I.append(' ');
      });
      L.append(I);
      el.append(L);
    });
    el.classList.add('is-split');
  }

  const splits = $$('[data-split]');
  function splitAll() {
    splits.forEach((el) => {
      try {
        if (!el._words) prepSplit(el);
        layoutSplit(el);
      } catch (e) {
        el.classList.add('is-split', 'is-in');
      }
    });
  }

  function countUp(el, dur = 1400) {
    const end = parseInt(el.dataset.count, 10);
    const fin = el.textContent;
    if (reduced || !end) {
      el.textContent = fin;
      return;
    }
    const t0 = performance.now();
    const task = (dt, now) => {
      const p = clamp((now - t0) / dur, 0, 1);
      el.textContent = p >= 1 ? fin : String(Math.round(end * easeOut(p)));
      if (p >= 1) tasks.delete(task);
    };
    el.textContent = '0';
    tasks.add(task);
  }

  function reveal(el) {
    if (el.classList.contains('is-in')) return;
    el.classList.add('is-in');
    if (el.dataset.count) countUp(el);
  }

  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        reveal(e.target);
        revealIO.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -7% 0px' });

  const pending = $$('[data-split],[data-eyebrow],[data-rise],[data-clip],[data-count]').filter((el) => !el.closest('.hero'));
  function revealRemaining() {
    pending.forEach((el) => {
      if (!el.classList.contains('is-in')) {
        reveal(el);
        revealIO.unobserve(el);
      }
    });
  }

  const Smooth = (() => {
    const on = fine && !reduced && navigator.maxTouchPoints === 0;
    let y = scrollY;
    let target = scrollY;
    let max = 0;
    let lastSet = -9999;
    let active = false;
    let tween = null;
    const measure = () => {
      max = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      target = clamp(target, 0, max);
    };
    const innerScrollable = (node, dy) => {
      while (node && node.nodeType === 1 && node !== document.body && node !== html) {
        const cs = getComputedStyle(node);
        if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 1) {
          if (dy > 0 ? node.scrollTop + node.clientHeight < node.scrollHeight - 1 : node.scrollTop > 0) return true;
        }
        if (node.tagName === 'TEXTAREA' || node.tagName === 'SELECT') return true;
        node = node.parentNode;
      }
      return false;
    };
    const setY = (v) => {
      lastSet = v;
      window.scrollTo(0, v);
    };
    const onWheel = (e) => {
      if (html.classList.contains('is-locked')) return;
      if (e.ctrlKey) return;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (innerScrollable(e.target, e.deltaY)) return;
      e.preventDefault();
      let d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1);
      d = clamp(d, -240, 240);
      if (tween) tween = null;
      if (!active) {
        y = scrollY;
        target = scrollY;
      }
      target = clamp(target + d, 0, max);
      active = true;
    };
    const onScroll = () => {
      if (Math.abs(scrollY - lastSet) > 2.5) {
        y = target = scrollY;
        active = false;
        tween = null;
      }
    };
    const tick = (dt, now) => {
      if (tween) {
        const p = clamp((now - tween.t0) / tween.dur, 0, 1);
        y = tween.from + (tween.to - tween.from) * easeIO(p);
        target = y;
        setY(y);
        if (p >= 1) tween = null;
        return;
      }
      if (!active) return;
      y += (target - y) * kf(.1, dt);
      if (Math.abs(target - y) < .4) {
        y = target;
        active = false;
      }
      setY(y);
    };
    if (on) {
      measure();
      addEventListener('wheel', onWheel, { passive: false });
      addEventListener('scroll', onScroll, { passive: true });
      addEventListener('resize', measure);
      new ResizeObserver(measure).observe(document.body);
      tasks.add(tick);
    }
    const to = (Y) => {
      if (reduced) {
        window.scrollTo(0, Y);
        return;
      }
      if (!on) {
        window.scrollTo({ top: Y, behavior: 'smooth' });
        return;
      }
      measure();
      const from = scrollY;
      const dest = clamp(Y, 0, max);
      const dist = Math.abs(dest - from);
      tween = { from, to: dest, t0: performance.now(), dur: clamp(900 + dist * .18, 900, 1600) };
      active = false;
      y = target = from;
    };
    return { on, to, measure };
  })();

  const nav = $('#nav');
  let navLast = scrollY;
  let navAcc = 0;
  let menuOpen = false;
  const navUpdate = () => {
    const y = scrollY;
    const d = y - navLast;
    navLast = y;
    nav.classList.toggle('is-solid', y > 30);
    if (menuOpen) return;
    if ((d > 0 && navAcc < 0) || (d < 0 && navAcc > 0)) navAcc = 0;
    navAcc += d;
    if (y < 120 || navAcc < -30) nav.classList.remove('is-hidden');
    else if (navAcc > 60) nav.classList.add('is-hidden');
  };
  addEventListener('scroll', navUpdate, { passive: true });

  const burger = $('.nav-burger');
  const menu = $('#menu');
  $$('.menu .mi').forEach((m, i) => m.style.setProperty('--i', i));
  const lockSync = () => html.classList.toggle('is-locked', menuOpen || detailState.open);
  function setMenu(open) {
    menuOpen = open;
    menu.classList.toggle('is-open', open);
    html.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
    menu.setAttribute('aria-hidden', String(!open));
    nav.classList.remove('is-hidden');
    lockSync();
  }
  burger.addEventListener('click', () => setMenu(!menuOpen));

  function scrollToHash(hash) {
    const el = hash === '#top' ? document.body : document.querySelector(hash);
    if (!el) return;
    const Y = hash === '#top' ? 0 : el.getBoundingClientRect().top + scrollY;
    Smooth.to(Y);
  }

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const h = a.getAttribute('href');
    if (h.length < 2 || h.startsWith('#stay-')) return;
    e.preventDefault();
    if (menuOpen) {
      setMenu(false);
      setTimeout(() => scrollToHash(h), 380);
    } else {
      scrollToHash(h);
    }
  });

  function initMagnetic(root = document) {
    if (!fine || reduced) return;
    $$('.magnetic', root).forEach((el) => {
      if (el._mag) return;
      el._mag = true;
      const label = el.querySelector('.roll');
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        el.style.transform = `translate(${dx * 8}px, ${dy * 7}px)`;
        if (label) label.style.transform = `translate(${dx * 4}px, ${dy * 3.5}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transform = '';
        if (label) label.style.transform = '';
      });
    });
  }

  function makePeek(el, opts = {}) {
    const media = $('.peek-media', el);
    const nameEl = $('.peek-meta b', el);
    const regEl = $('.peek-meta span', el);
    const st = { x: 0, y: 0, tx: 0, ty: 0, rot: 0, shown: false, key: null, follow: !!opts.follow, snap: true };
    const set = (key, src, name, region) => {
      if (st.key === key) return;
      st.key = key;
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.src = src;
      media.append(img);
      if (st.shown && !reduced) {
        img.animate([{ clipPath: 'inset(100% 0 0 0)', transform: 'translateY(24%)' }, { clipPath: 'inset(0% 0 0 0)', transform: 'translateY(0)' }], { duration: 650, easing: E_OUT });
      }
      const old = $$('img', media).slice(0, -1);
      setTimeout(() => old.forEach((o) => o.remove()), st.shown ? 680 : 0);
      if (nameEl) nameEl.textContent = name || '';
      if (regEl) regEl.textContent = region || '';
    };
    const show = () => {
      if (st.shown) return;
      st.shown = true;
      st.snap = true;
      el.classList.add('is-on');
    };
    const hide = () => {
      if (!st.shown) return;
      st.shown = false;
      el.classList.remove('is-on');
    };
    const move = (x, y) => {
      st.tx = x;
      st.ty = y;
      if (st.snap) {
        st.x = x;
        st.y = y;
        st.rot = 0;
        st.snap = false;
      }
    };
    tasks.add((dt) => {
      if (!st.shown && Math.abs(st.rot) < .01) return;
      const k = st.follow && !reduced ? kf(.16, dt) : 1;
      const px = st.x;
      st.x += (st.tx - st.x) * k;
      st.y += (st.ty - st.y) * k;
      const v = dt > 0 ? (st.x - px) / (dt * 60) : 0;
      const rt = reduced ? 0 : clamp(v * .35, -6, 6);
      st.rot += (rt - st.rot) * kf(.12, dt);
      el.style.transform = `translate3d(${st.x.toFixed(1)}px, ${st.y.toFixed(1)}px, 0) rotate(${st.rot.toFixed(2)}deg)`;
    });
    return { el, set, show, hide, move, st, get shown() { return st.shown; } };
  }

  function buildMap(container, list, prefix, refEl) {
    const ref = refEl || container;
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('viewBox', KOREA.viewBox || '0 0 1000 1233');
    svg.setAttribute('class', 'map-svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const d = KOREA.paths.join(' ');
    svg.innerHTML = `<defs><pattern id="${prefix}-dots" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="5.5" cy="5.5" r="1.4" fill="rgba(244,240,232,.17)"></circle></pattern></defs><path class="map-land" d="${d}"></path><path class="map-grain" d="${d}" fill="url(#${prefix}-dots)"></path><g class="map-dots"></g>`;
    const g = $('.map-dots', svg);
    const dots = new Map();
    list.forEach((s) => {
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', s.x);
      c.setAttribute('cy', s.y);
      c.setAttribute('r', 5);
      c.setAttribute('class', 'map-dot');
      g.append(c);
      dots.set(s.id, c);
    });
    container.prepend(svg);
    const pat = $('pattern', svg);
    const patDot = $('pattern circle', svg);
    let pos = [];
    const size = () => {
      const w = container.offsetWidth;
      if (!w) return;
      const sc = w / 1000;
      const r = (isPhone() ? 2.7 : 3.3) / sc;
      dots.forEach((c) => c.setAttribute('r', r.toFixed(2)));
      const step = (isPhone() ? 6 : 7.5) / sc;
      pat.setAttribute('width', step.toFixed(2));
      pat.setAttribute('height', step.toFixed(2));
      patDot.setAttribute('cx', (step / 2).toFixed(2));
      patDot.setAttribute('cy', (step / 2).toFixed(2));
      patDot.setAttribute('r', (.85 / sc).toFixed(2));
    };
    const measure = () => {
      const cr = ref.getBoundingClientRect();
      pos = list.map((s) => {
        const c = dots.get(s.id);
        const r = c.getBoundingClientRect();
        return { s, c, x: r.left + r.width / 2 - cr.left, y: r.top + r.height / 2 - cr.top };
      });
    };
    const nearest = (x, y, maxD, filter) => {
      let best = null;
      let bd = maxD * maxD;
      pos.forEach((p) => {
        if (filter && !filter(p.s)) return;
        const dd = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
        if (dd < bd) {
          bd = dd;
          best = p;
        }
      });
      return best;
    };
    let activeDot = null;
    const setActive = (id) => {
      const c = id == null ? null : dots.get(id);
      if (c === activeDot) return;
      if (activeDot) activeDot.classList.remove('is-on');
      activeDot = c;
      if (c) {
        c.classList.add('is-on');
        c.parentNode.append(c);
      }
    };
    size();
    return { svg, dots, size, measure, nearest, setActive, get pos() { return pos; } };
  }

  const CLUSTERS = [
    { r: '경기 가평군', n: '가평', dx: -110, dy: 70 },
    { r: '경북 경주시', n: '경주', dx: 70, dy: 92 },
    { r: '강원 춘천시', n: '춘천', dx: 92, dy: -62 },
    { r: '경북 포항시', n: '포항', dx: 76, dy: -86 },
    { r: '경기 포천시', n: '포천', dx: -84, dy: -84 },
    { r: '전북 완주군', n: '완주', dx: -120, dy: 26 },
  ];

  const hero = $('.hero');
  const heroMapEl = $('#hero-map');
  const heroTilt = $('.hero-map-tilt');
  const heroLines = $('.hero-lines');
  const heroLabels = $('.hero-labels');
  const heroNum = $('#hero-num');
  let heroMap = null;
  let heroPeek = null;
  let labelEls = [];

  function buildHeroLabels() {
    heroLabels.textContent = '';
    labelEls = CLUSTERS.map((c, i) => {
      const cnt = STAYS.filter((s) => s.region === c.r).length;
      const el = document.createElement('div');
      el.className = 'map-label';
      el.innerHTML = `<span class="ml-in" style="--li:${i}"><b>${c.n}</b><span>${cnt}</span></span>`;
      heroLabels.append(el);
      return el;
    });
  }

  function placeHeroLabels() {
    if (!heroMap) return;
    const mr = heroMapEl.getBoundingClientRect();
    const hr = hero.getBoundingClientRect();
    const W = mr.width;
    const H = mr.height;
    const f = clamp(W / 690, .55, 1.2);
    heroLines.setAttribute('viewBox', `0 0 ${W.toFixed(1)} ${H.toFixed(1)}`);
    let out = '';
    CLUSTERS.forEach((c, i) => {
      const ps = heroMap.pos.filter((p) => p.s.region === c.r);
      if (!ps.length) return;
      const cx = ps.reduce((a, p) => a + p.x, 0) / ps.length;
      const cy = ps.reduce((a, p) => a + p.y, 0) / ps.length;
      const el = labelEls[i];
      const lw = el.offsetWidth;
      const lh = el.offsetHeight;
      let ax = cx + c.dx * f;
      const ay = cy + c.dy * f;
      const minX = hr.left - mr.left + 10;
      const maxX = hr.right - mr.left - 10;
      let left = c.dx < 0 ? ax - lw - 6 : ax + 6;
      if (left < minX) {
        left = minX;
        ax = left + lw + 6 > cx ? ax : left + lw + 6;
      }
      if (left + lw > maxX) {
        left = maxX - lw;
        if (c.dx > 0) ax = Math.min(ax, left - 6);
      }
      if (c.dx > 0 && ax > left) ax = left - 4;
      if (c.dx < 0 && ax < left + lw) ax = left + lw + 4;
      el.style.transform = `translate(${left.toFixed(1)}px, ${(ay - lh / 2).toFixed(1)}px)`;
      const rr = 13 * clamp(f, .7, 1);
      const ang = Math.atan2(ay - cy, ax - cx);
      const sx = cx + Math.cos(ang) * rr;
      const sy = cy + Math.sin(ang) * rr;
      out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rr.toFixed(1)}" pathLength="1" style="--li:${i}"></circle><line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ax.toFixed(1)}" y2="${ay.toFixed(1)}" pathLength="1" style="--li:${i}"></line>`;
    });
    heroLines.innerHTML = out;
  }

  function heroIntro() {
    const steps = [$('.hero-eyebrow'), $('.hero-title'), $('.hero-unit'), $('.hero-sub'), $('.hero-cta')];
    steps.forEach((el, i) => {
      if (!el) return;
      el.style.setProperty('--d', `${i * 110}ms`);
      requestAnimationFrame(() => el.classList.add('is-in'));
    });
    if (!heroMap) return;
    if (reduced) {
      heroNum.textContent = String(STAYS.length);
      hero.classList.add('is-labels');
      return;
    }
    const HQ = { x: 573.5, y: 185.5 };
    const sorted = heroMap.pos.slice().sort((a, b) => Math.hypot(a.s.x - HQ.x, a.s.y - HQ.y) - Math.hypot(b.s.x - HQ.x, b.s.y - HQ.y));
    const n = sorted.length;
    const delays = sorted.map((p, i) => 420 + 2000 * (1 - Math.cbrt(1 - i / n)));
    sorted.forEach((p, i) => {
      p.c.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 900, delay: delays[i], easing: E_OUT, fill: 'backwards' });
    });
    const t0 = performance.now();
    let shownN = -1;
    heroNum.textContent = '0';
    const task = (dt, now) => {
      const el = now - t0;
      let k = 0;
      while (k < n && delays[k] <= el) k++;
      if (k !== shownN) {
        shownN = k;
        heroNum.textContent = String(k);
      }
      if (k >= n) {
        heroNum.textContent = String(STAYS.length);
        tasks.delete(task);
        setTimeout(() => hero.classList.add('is-labels'), 250);
      }
    };
    tasks.add(task);
  }

  function initHero() {
    heroMap = buildMap(heroTilt, STAYS, 'hm', heroMapEl);
    heroPeek = makePeek($('#hero-peek'), { follow: fine });
    buildHeroLabels();
    heroMap.measure();
    placeHeroLabels();
    let heroHover = null;
    const local = (e) => {
      const r = heroMapEl.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, r };
    };
    const heroBox = () => hero.getBoundingClientRect();
    const showPeekFor = (p, mx, my) => {
      const s = p.s;
      heroMap.setActive(s.id);
      heroPeek.set(s.id, A + s.thumb, s.name, s.region);
      const hb = heroBox();
      const mr = heroMapEl.getBoundingClientRect();
      const offX = mr.left - hb.left;
      const offY = mr.top - hb.top;
      const pw = heroPeek.el.offsetWidth || 230;
      const ph = heroPeek.el.offsetHeight || 190;
      let x;
      let y;
      if (fine) {
        x = mx + offX + 26;
        y = my + offY + 20;
        if (x + pw > hb.width - 12) x = mx + offX - pw - 26;
        if (y + ph > hb.height - 12) y = my + offY - ph - 20;
      } else {
        x = clamp(p.x + offX - pw / 2, 12, hb.width - pw - 12);
        y = p.y + offY - ph - 18;
        if (y < 70) y = p.y + offY + 18;
      }
      heroPeek.move(x, y);
      heroPeek.show();
      heroHover = s;
    };
    const clear = () => {
      heroMap.setActive(null);
      heroPeek.hide();
      heroHover = null;
    };
    if (fine) {
      hero.addEventListener('pointermove', (e) => {
        if (e.target.closest('.hero-copy, .nav')) {
          clear();
          return;
        }
        const l = local(e);
        const p = heroMap.nearest(l.x, l.y, 26);
        if (p) showPeekFor(p, l.x, l.y);
        else clear();
      });
      hero.addEventListener('pointerleave', clear);
      hero.addEventListener('click', (e) => {
        if (!heroHover || e.target.closest('a, button')) return;
        const c = heroMap.dots.get(heroHover.id);
        openDetail(heroHover, { el: c, dot: true });
      });
    } else {
      hero.addEventListener('click', (e) => {
        if (e.target.closest('.peek')) {
          if (heroHover) openDetail(heroHover, { el: $('.peek-media', heroPeek.el), radius: 14 });
          return;
        }
        if (e.target.closest('a, button')) return;
        const l = local(e);
        const p = heroMap.nearest(l.x, l.y, 30);
        if (p) showPeekFor(p, l.x, l.y);
        else clear();
      });
    }
    addEventListener('scroll', () => {
      if (heroHover && scrollY > innerHeight * .5) clear();
    }, { passive: true });
  }

  function initMarquee() {
    const track = $('#marquee-track');
    if (!track) return;
    const items = STAYS.filter((s) => s.featured).sort((a, b) => a.order - b.order);
    const one = items.map((s) => `<div class="mq-item"><img src="${A + s.logo}" alt="" loading="lazy"><span>${esc(s.name)}</span></div>`).join('');
    track.innerHTML = one + one;
    if (reduced) return;
    let x = 0;
    let half = 0;
    let vis = false;
    let dir = -1;
    let dirT = -1;
    let lastY = scrollY;
    let vel = 0;
    let hoverF = 1;
    let hoverT = 1;
    const measureM = () => { half = track.scrollWidth / 2; };
    measureM();
    addEventListener('resize', measureM);
    new IntersectionObserver((es) => { vis = es[0].isIntersecting; if (vis) measureM(); }).observe(track);
    if (fine) {
      track.addEventListener('pointerenter', () => { hoverT = .25; });
      track.addEventListener('pointerleave', () => { hoverT = 1; });
    }
    tasks.add((dt) => {
      const y = scrollY;
      const dy = y - lastY;
      lastY = y;
      if (!vis || !half) return;
      if (dy > .5) dirT = -1;
      else if (dy < -.5) dirT = 1;
      dir += (dirT - dir) * kf(.06, dt);
      vel += (Math.abs(dy) - vel) * kf(.12, dt);
      hoverF += (hoverT - hoverF) * kf(.08, dt);
      x += (0.6 + Math.min(vel, 60) * .35) * dir * hoverF * dt * 60;
      if (x <= -half) x += half;
      if (x > 0) x -= half;
      track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
    });
  }

  function initServices() {
    const list = $('#svc-list');
    const rows = $$('.svc', list);
    const syncAria = () => {
      const desk = innerWidth > 960;
      rows.forEach((r) => {
        const b = $('.svc-head', r);
        b.setAttribute('aria-expanded', String(desk || r.classList.contains('is-open')));
        if (desk) b.setAttribute('tabindex', '-1');
        else b.removeAttribute('tabindex');
      });
    };
    syncAria();
    addEventListener('resize', syncAria);
    rows.forEach((r, idx) => {
      $('.svc-head', r).addEventListener('click', () => {
        if (innerWidth > 960) return;
        const after = rows.slice(idx + 1);
        const before = after.map((x) => x.getBoundingClientRect().top);
        const open = !r.classList.contains('is-open');
        r.classList.toggle('is-open', open);
        $('.svc-head', r).setAttribute('aria-expanded', String(open));
        if (!reduced) {
          after.forEach((x, i) => {
            const d = before[i] - x.getBoundingClientRect().top;
            if (Math.abs(d) > 1) x.animate([{ transform: `translateY(${d}px)` }, { transform: 'none' }], { duration: 700, easing: E_OUT });
          });
        }
      });
    });
    if (!fine) return;
    const peek = makePeek($('#svc-peek'), { follow: true });
    let lx = 0;
    let ly = 0;
    let inside = false;
    const update = () => {
      if (innerWidth <= 960) {
        peek.hide();
        return;
      }
      const el = document.elementFromPoint(lx, ly);
      const row = el && el.closest('.svc');
      if (!inside || !row || !list.contains(row)) {
        peek.hide();
        return;
      }
      peek.set(row.dataset.photo, row.dataset.photo);
      const pw = 280;
      const ph = 350;
      let x = lx + 36;
      if (x + pw > innerWidth - 16) x = lx - pw - 36;
      const y = clamp(ly - ph / 2, 80, innerHeight - ph - 16);
      peek.move(x, y);
      peek.show();
    };
    list.addEventListener('pointermove', (e) => {
      lx = e.clientX;
      ly = e.clientY;
      inside = true;
      update();
    });
    list.addEventListener('pointerleave', () => {
      inside = false;
      peek.hide();
    });
    addEventListener('scroll', () => { if (inside) update(); }, { passive: true });
  }

  const TYPES = ['풀빌라', '카라반', '글램핑', '키즈', '애견', '기타'];
  const F = { type: 'all', sido: 'all', sort: 'featured', view: 'list', shown: 12 };
  const PAGE = 12;
  const grid = $('#grid');
  const cardCache = new Map();
  let fmap = null;
  let fpeek = null;

  function filtered() {
    let l = STAYS.filter((s) => (F.type === 'all' || s.types.includes(F.type)) && (F.sido === 'all' || s.sido === F.sido));
    const fo = (s) => (s.featured ? s.order : 1000);
    if (F.sort === 'featured') l.sort((a, b) => fo(a) - fo(b) || b.year - a.year || a.name.localeCompare(b.name, 'ko'));
    else if (F.sort === 'recent') l.sort((a, b) => b.year - a.year || fo(a) - fo(b) || a.name.localeCompare(b.name, 'ko'));
    else l.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    return l;
  }

  function cardEl(s) {
    let el = cardCache.get(s.id);
    if (el) return el;
    el = document.createElement('a');
    el.className = 'card';
    el.href = `#stay-${s.id}`;
    el.dataset.id = s.id;
    el.innerHTML = `<div class="card-media"><img class="thumb" src="${A + s.thumb}" alt="" loading="lazy" decoding="async"><span class="card-logo"><img src="${A + s.logo}" alt="" loading="lazy" decoding="async"></span></div><div class="card-meta"><h3>${esc(s.name)}</h3><p>${esc(s.region)}</p><ul class="tags">${s.types.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>`;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      openDetail(s, { el: $('.card-media', el), radius: isPhone() ? 12 : 14 });
    });
    if (fine && !reduced) {
      const img = $('.thumb', el);
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        img.style.setProperty('--px', `${(((e.clientX - r.left) / r.width) - .5) * -16}px`);
        img.style.setProperty('--py', `${(((e.clientY - r.top) / r.height) - .5) * -12}px`);
      });
      el.addEventListener('pointerleave', () => {
        img.style.setProperty('--px', '0px');
        img.style.setProperty('--py', '0px');
      });
    }
    cardCache.set(s.id, el);
    return el;
  }

  function revealCard(el, delay) {
    el.classList.remove('is-pre');
    if (reduced) return;
    const m = $('.card-media', el);
    const img = $('.thumb', el);
    const meta = $('.card-meta', el);
    const R = isPhone() ? 12 : 14;
    m.animate([{ clipPath: `inset(100% 0 0 0 round ${R}px)` }, { clipPath: `inset(0% 0 0 0 round ${R}px)` }], { duration: 1150, delay, easing: E_OUT, fill: 'backwards' });
    img.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 1600, delay, easing: E_OUT, fill: 'backwards' });
    meta.animate([{ clipPath: 'inset(0 0 100% 0)', transform: 'translateY(14px)' }, { clipPath: 'inset(0 0 0% 0)', transform: 'translateY(0)' }], { duration: 1000, delay: delay + 140, easing: E_OUT, fill: 'backwards' });
  }

  const cardIO = new IntersectionObserver((entries) => {
    let k = 0;
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      cardIO.unobserve(e.target);
      revealCard(e.target, Math.min(k++, 7) * 75);
    });
  }, { rootMargin: '0px 0px -4% 0px' });

  function renderList(mode) {
    const list = filtered();
    const next = list.slice(0, F.shown);
    $('#finder-count').textContent = String(list.length);
    $('#more-btn').parentElement.hidden = list.length <= F.shown;
    const vh = innerHeight;
    const prev = new Map();
    const olds = Array.from(grid.children);
    olds.forEach((el) => prev.set(+el.dataset.id, el.getBoundingClientRect()));
    const nextIds = new Set(next.map((s) => s.id));
    const wrap = grid.parentElement;
    const wr = wrap.getBoundingClientRect();
    const ghosts = [];
    if (!reduced && mode === 'filter') {
      olds.forEach((el) => {
        if (nextIds.has(+el.dataset.id)) return;
        const r = prev.get(+el.dataset.id);
        if (r.bottom < 0 || r.top > vh) return;
        const g = el.cloneNode(true);
        g.classList.add('card-ghost');
        g.removeAttribute('href');
        g.setAttribute('aria-hidden', 'true');
        g.style.left = `${r.left - wr.left}px`;
        g.style.top = `${r.top - wr.top}px`;
        g.style.width = `${r.width}px`;
        ghosts.push(g);
      });
    }
    const els = next.map(cardEl);
    grid.replaceChildren(...els);
    ghosts.forEach((g) => {
      wrap.append(g);
      const a = g.animate([{ clipPath: 'inset(0 0 0% 0)' }, { clipPath: 'inset(100% 0 0 0)' }], { duration: 340, easing: E_IO, fill: 'forwards' });
      a.onfinish = () => g.remove();
    });
    if (reduced) {
      els.forEach((el) => el.classList.remove('is-pre'));
      return;
    }
    let k = 0;
    els.forEach((el) => {
      const id = +el.dataset.id;
      const r0 = prev.get(id);
      if (r0 && mode !== 'init') {
        const r1 = el.getBoundingClientRect();
        const dx = r0.left - r1.left;
        const dy = r0.top - r1.top;
        const seen = (r1.bottom > 0 && r1.top < vh) || (r0.bottom > 0 && r0.top < vh);
        if ((Math.abs(dx) > 1 || Math.abs(dy) > 1) && seen) {
          el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: 700, easing: E_HOVER });
        }
        return;
      }
      if (el.classList.contains('is-pre')) cardIO.unobserve(el);
      el.classList.add('is-pre');
      const r1 = el.getBoundingClientRect();
      if (mode === 'filter' && r1.bottom > 0 && r1.top < vh) {
        revealCard(el, 140 + Math.min(k++, 7) * 70);
      } else {
        cardIO.observe(el);
      }
    });
  }

  function syncMapDots() {
    if (!fmap) return;
    const ids = new Set(filtered().map((s) => s.id));
    fmap.dots.forEach((c, id) => c.classList.toggle('is-off', !ids.has(id)));
  }

  function initFinderMap() {
    if (fmap) return;
    const box = $('#finder-map');
    fmap = buildMap(box, STAYS, 'fm');
    fpeek = makePeek($('#finder-peek'), { follow: fine });
    const viewMap = $('#view-map');
    let hov = null;
    const loc = (e) => {
      const r = box.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const ok = (s) => !fmap.dots.get(s.id).classList.contains('is-off');
    const peekAt = (p, mx, my) => {
      const vr = viewMap.getBoundingClientRect();
      const br = box.getBoundingClientRect();
      const ox = br.left - vr.left;
      const oy = br.top - vr.top;
      fpeek.set(p.s.id, A + p.s.thumb, p.s.name, p.s.region);
      const pw = fpeek.el.offsetWidth || 230;
      const ph = fpeek.el.offsetHeight || 190;
      let x = mx + ox + 24;
      let y = my + oy + 18;
      if (x + pw > vr.width) x = mx + ox - pw - 24;
      if (y + ph > vr.height) y = my + oy - ph - 18;
      fpeek.move(x, y);
      fpeek.show();
    };
    if (fine) {
      box.addEventListener('pointermove', (e) => {
        const l = loc(e);
        const p = fmap.nearest(l.x, l.y, 24, ok);
        if (p) {
          hov = p.s;
          fmap.setActive(p.s.id);
          peekAt(p, l.x, l.y);
          box.style.cursor = 'pointer';
        } else {
          hov = null;
          fmap.setActive(null);
          fpeek.hide();
          box.style.cursor = '';
        }
      });
      box.addEventListener('pointerleave', () => {
        hov = null;
        fmap.setActive(null);
        fpeek.hide();
      });
    }
    box.addEventListener('click', (e) => {
      let s = hov;
      if (!fine) {
        const l = loc(e);
        const p = fmap.nearest(l.x, l.y, 30, ok);
        s = p ? p.s : null;
        if (p) fmap.setActive(p.s.id);
      }
      if (!s) return;
      fpeek.hide();
      openDetail(s, { el: fmap.dots.get(s.id), dot: true });
    });
  }

  function setView(v) {
    if (F.view === v) return;
    F.view = v;
    const seg = $('.seg');
    seg.classList.toggle('is-map', v === 'map');
    $$('.seg-btn', seg).forEach((b) => {
      const on = b.dataset.view === v;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    const vl = $('#view-list');
    const vm = $('#view-map');
    if (v === 'map') {
      vl.hidden = true;
      vm.hidden = false;
      initFinderMap();
      fmap.size();
      syncMapDots();
      fmap.measure();
      if (!reduced) {
        const box = $('#finder-map');
        box.animate([{ clipPath: 'inset(100% 0 0 0 round 24px)', transform: 'translateY(40px)' }, { clipPath: 'inset(0% 0 0 0 round 0px)', transform: 'translateY(0)' }], { duration: 1100, easing: E_OUT });
        let k = 0;
        Array.from(fmap.dots.values()).filter((c) => !c.classList.contains('is-off')).sort(() => 0).forEach((c) => {
          c.animate([{ transform: 'scale(0)' }, { transform: 'scale(1)' }], { duration: 800, delay: 300 + (k++) * 6, easing: E_OUT, fill: 'backwards' });
        });
      }
    } else {
      vm.hidden = true;
      vl.hidden = false;
      if (fpeek) fpeek.hide();
      const vh = innerHeight;
      let k = 0;
      Array.from(grid.children).forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh && !el.classList.contains('is-pre')) revealCard(el, Math.min(k++, 7) * 70);
      });
    }
  }

  function initFinder() {
    const chipsBox = $('#type-chips');
    const counts = {};
    TYPES.forEach((t) => { counts[t] = STAYS.filter((s) => s.types.includes(t)).length; });
    const chipDefs = [{ v: 'all', l: '전체', c: STAYS.length }].concat(TYPES.map((t) => ({ v: t, l: t, c: counts[t] })));
    chipsBox.innerHTML = chipDefs.map((d) => `<button type="button" class="chip-btn${d.v === 'all' ? ' is-on' : ''}" data-type="${esc(d.v)}" aria-pressed="${d.v === 'all'}">${esc(d.l)}<small>${d.c}</small></button>`).join('');
    chipsBox.addEventListener('click', (e) => {
      const b = e.target.closest('.chip-btn');
      if (!b || b.dataset.type === F.type) return;
      F.type = b.dataset.type;
      $$('.chip-btn', chipsBox).forEach((x) => {
        const on = x === b;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', String(on));
      });
      applyFilter();
    });
    const sel = $('#sido-select');
    const sc = {};
    STAYS.forEach((s) => { sc[s.sido] = (sc[s.sido] || 0) + 1; });
    const sidos = Object.keys(sc).sort((a, b) => sc[b] - sc[a] || a.localeCompare(b, 'ko'));
    sel.innerHTML = `<option value="all">전체 지역</option>` + sidos.map((s) => `<option value="${esc(s)}">${esc(s)} (${sc[s]})</option>`).join('');
    sel.addEventListener('change', () => {
      F.sido = sel.value;
      applyFilter();
    });
    $('#sort-select').addEventListener('change', (e) => {
      F.sort = e.target.value;
      applyFilter();
    });
    $$('.seg-btn').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('#more-btn').addEventListener('click', () => {
      F.shown += PAGE;
      renderList('more');
      Smooth.measure();
    });
    renderList('init');
  }

  function applyFilter() {
    F.shown = PAGE;
    renderList('filter');
    syncMapDots();
    if (fmap && F.view === 'map') fmap.measure();
    Smooth.measure();
  }

  const detail = $('#detail');
  const panel = $('.detail-panel', detail);
  const photoBox = $('.detail-photo', detail);
  const backdrop = $('.detail-backdrop', detail);
  const dImg = $('#detail-img');
  const detailState = { open: false, stay: null, src: null, lastFocus: null, busy: false, pushed: false };

  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function initBooking() {
    const bin = $('#book-in');
    const bout = $('#book-out');
    const today = new Date();
    bin.min = ymd(today);
    const t2 = new Date(today);
    t2.setDate(t2.getDate() + 1);
    bout.min = ymd(t2);
    bin.addEventListener('change', () => {
      if (!bin.value) return;
      const d = new Date(`${bin.value}T00:00:00`);
      d.setDate(d.getDate() + 1);
      bout.min = ymd(d);
      if (!bout.value || bout.value <= bin.value) bout.value = ymd(d);
    });
    let g = 2;
    const out = $('#g-val');
    const minus = $('#g-minus');
    const plus = $('#g-plus');
    const sync = () => {
      out.textContent = String(g);
      minus.disabled = g <= 1;
      plus.disabled = g >= 20;
    };
    minus.addEventListener('click', () => { g = Math.max(1, g - 1); sync(); });
    plus.addEventListener('click', () => { g = Math.min(20, g + 1); sync(); });
    sync();
  }

  function fillDetail(s) {
    dImg.src = A + s.thumb;
    dImg.alt = `${s.name} 사진`;
    const lg = $('#detail-logo');
    lg.src = A + s.logo;
    lg.alt = `${s.name} 로고`;
    $('#detail-region').textContent = s.region;
    $('#detail-name').textContent = s.name;
    $('#detail-types').innerHTML = s.types.map((t) => `<li>${esc(t)}</li>`).join('');
    $('#detail-region2').textContent = s.region;
    $('#detail-types2').textContent = s.types.join(' · ') || '-';
    $('#detail-year').textContent = `${s.year}년`;
    $('#book-go').href = s.url;
    $('#book-home').href = s.url;
    $$('.detail-info > *', detail).forEach((el, i) => el.style.setProperty('--i', i));
    $('.detail-scroll', detail).scrollTop = 0;
    $('.detail-info', detail).scrollTop = 0;
  }

  function srcRectOf(src) {
    if (!src || !src.el || !src.el.isConnected) return null;
    const r = src.el.getBoundingClientRect();
    if (!r.width && !r.height && !src.dot) return null;
    if (src.dot) {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      return { left: cx - 7, top: cy - 7, width: 14, height: 14, right: cx + 7, bottom: cy + 7, radius: 7 };
    }
    if (r.bottom < 0 || r.top > innerHeight || r.width < 2) return null;
    return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom, radius: src.radius || 14 };
  }

  function flipFrom(src, tgt) {
    const s = Math.max(src.width / tgt.width, src.height / tgt.height);
    const ix = Math.max(0, (tgt.width * s - src.width) / (2 * s));
    const iy = Math.max(0, (tgt.height * s - src.height) / (2 * s));
    const tx = (src.left + src.width / 2) - (tgt.left + tgt.width / 2);
    const ty = (src.top + src.height / 2) - (tgt.top + tgt.height / 2);
    return { transform: `translate(${tx}px, ${ty}px) scale(${s})`, clip: `inset(${iy}px ${ix}px ${iy}px ${ix}px round ${src.radius / s}px)` };
  }

  const panelRadius = () => (isPhone() ? 0 : 22);
  const photoRadius = () => {
    if (isPhone()) return '0px';
    return '22px 0px 0px 22px';
  };

  function focusables() {
    return $$('a[href], button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])', detail).filter((el) => el.offsetParent !== null || el === document.activeElement);
  }

  function openDetail(s, src, push = true) {
    if (detailState.open || detailState.busy) return;
    if (menuOpen) setMenu(false);
    detailState.open = true;
    detailState.stay = s;
    detailState.src = src;
    detailState.lastFocus = document.activeElement;
    fillDetail(s);
    if (push) {
      history.pushState({ stay: s.id }, '', `#stay-${s.id}`);
      detailState.pushed = true;
    } else {
      detailState.pushed = false;
    }
    detail.hidden = false;
    lockSync();
    detail.classList.remove('is-ready');
    const sr = srcRectOf(src);
    const done = () => {
      detail.classList.add('is-ready');
      detailState.busy = false;
      $('.detail-close', detail).focus({ preventScroll: true });
    };
    if (reduced || !sr) {
      if (!reduced) {
        panel.animate([{ clipPath: `inset(100% 0 0 0 round ${panelRadius()}px)` }, { clipPath: `inset(0% 0 0 0 round ${panelRadius()}px)` }], { duration: 800, easing: E_IO });
        backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'linear' });
        detailState.busy = true;
        setTimeout(done, 520);
      } else {
        done();
      }
      return;
    }
    detailState.busy = true;
    const tgt = photoBox.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const fly = document.createElement('div');
    fly.className = 'fly';
    fly.innerHTML = `<img src="${A + s.thumb}" alt="">`;
    Object.assign(fly.style, { width: `${tgt.width}px`, height: `${tgt.height}px`, transform: `translate(${tgt.left}px, ${tgt.top}px)` });
    fly.style.left = `${tgt.left}px`;
    fly.style.top = `${tgt.top}px`;
    fly.style.transform = '';
    document.body.append(fly);
    photoBox.style.visibility = 'hidden';
    const from = flipFrom(sr, tgt);
    const dur = 820;
    fly.animate([{ transform: from.transform, clipPath: from.clip }, { transform: 'translate(0px, 0px) scale(1)', clipPath: `inset(0px 0px 0px 0px round ${photoRadius()})` }], { duration: dur, easing: E_IO, fill: 'forwards' });
    panel.animate([
      { clipPath: `inset(${sr.top - pr.top}px ${pr.right - sr.right}px ${pr.bottom - sr.bottom}px ${sr.left - pr.left}px round ${sr.radius}px)` },
      { clipPath: `inset(0px 0px 0px 0px round ${panelRadius()}px)` },
    ], { duration: dur, easing: E_IO });
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: dur * .8, easing: 'linear' });
    setTimeout(() => {
      photoBox.style.visibility = '';
      fly.remove();
      done();
    }, dur);
  }

  function closeDetail() {
    if (!detailState.open || detailState.busy) return;
    if (detailState.pushed && history.state && history.state.stay) {
      history.back();
      return;
    }
    if (location.hash.startsWith('#stay-')) history.replaceState(null, '', location.pathname + location.search);
    doClose();
  }

  function doClose() {
    if (!detailState.open) return;
    detailState.busy = true;
    const finish = () => {
      detail.hidden = true;
      detail.classList.remove('is-ready');
      detailState.open = false;
      detailState.busy = false;
      detailState.pushed = false;
      lockSync();
      const lf = detailState.lastFocus;
      if (lf && lf.isConnected && lf !== document.body) lf.focus({ preventScroll: true });
      if (heroMap) heroMap.setActive(null);
      if (fmap) fmap.setActive(null);
      if (heroPeek) heroPeek.hide();
    };
    if (reduced) {
      finish();
      return;
    }
    const sr = srcRectOf(detailState.src);
    const tgt = photoBox.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    detail.classList.remove('is-ready');
    const dur = 700;
    backdrop.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur, easing: 'linear', fill: 'forwards' });
    if (sr && tgt.bottom > 0 && tgt.height > 0) {
      const fly = document.createElement('div');
      fly.className = 'fly';
      fly.innerHTML = `<img src="${dImg.src}" alt="">`;
      Object.assign(fly.style, { left: `${tgt.left}px`, top: `${tgt.top}px`, width: `${tgt.width}px`, height: `${tgt.height}px` });
      document.body.append(fly);
      photoBox.style.visibility = 'hidden';
      const from = flipFrom(sr, tgt);
      fly.animate([{ transform: 'translate(0px, 0px) scale(1)', clipPath: `inset(0px 0px 0px 0px round ${photoRadius()})` }, { transform: from.transform, clipPath: from.clip }], { duration: dur, easing: E_IO, fill: 'forwards' });
      const pa = panel.animate([
        { clipPath: `inset(0px 0px 0px 0px round ${panelRadius()}px)` },
        { clipPath: `inset(${sr.top - pr.top}px ${pr.right - sr.right}px ${pr.bottom - sr.bottom}px ${sr.left - pr.left}px round ${sr.radius}px)` },
      ], { duration: dur, easing: E_IO, fill: 'forwards' });
      setTimeout(() => {
        fly.remove();
        photoBox.style.visibility = '';
        pa.cancel();
        backdrop.getAnimations().forEach((a) => a.cancel());
        finish();
      }, dur);
    } else {
      const pa = panel.animate([{ clipPath: `inset(0% 0 0 0 round ${panelRadius()}px)` }, { clipPath: `inset(100% 0 0 0 round ${panelRadius()}px)` }], { duration: 450, easing: E_IO, fill: 'forwards' });
      setTimeout(() => {
        pa.cancel();
        backdrop.getAnimations().forEach((a) => a.cancel());
        finish();
      }, 450);
    }
  }

  detail.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) closeDetail();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (detailState.open) {
        e.preventDefault();
        closeDetail();
      } else if (menuOpen) {
        setMenu(false);
        burger.focus();
      }
      return;
    }
    if (e.key === 'Tab' && detailState.open) {
      const f = focusables();
      if (!f.length) return;
      const first = f[0];
      const lastF = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !detail.contains(document.activeElement))) {
        e.preventDefault();
        lastF.focus();
      } else if (!e.shiftKey && (document.activeElement === lastF || !detail.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  const stayFromHash = () => {
    const m = location.hash.match(/^#stay-(\d+)$/);
    return m ? byId.get(+m[1]) : null;
  };
  addEventListener('popstate', () => {
    const s = stayFromHash();
    if (detailState.open && !s) {
      if (detailState.busy) setTimeout(doClose, 860);
      else doClose();
    } else if (!detailState.open && s) {
      openDetail(s, null, false);
    }
  });

  const NEEDS = {
    consult: { label: '컨설팅', title: '컨설팅이 필요해요', opts: ['키즈', '애견', '풀빌라', '글램핑', '일반펜션', '기타'] },
    ad: { label: '광고', title: '광고하고 싶어요', opts: ['온라인 여행사(OTA) 플랫폼 입점 및 예약관리', '전화 예약 관리', '사회관계망서비스(SNS) 마케팅', '인플루언서 제휴(어필리에이트) 마케팅', '기업 및 단체 휴양지 매칭', '매출 분석 및 결과보고'] },
    web: { label: '홈페이지 제작', title: '홈페이지 제작하고 싶어요', opts: ['신규', '리뉴얼'] },
    photo: { label: '촬영', title: '촬영하고 싶어요', opts: ['사진', '영상'] },
  };
  const REGIONS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

  function initInquiry() {
    const Q = { needs: [], subs: { consult: [], ad: [], web: [], photo: [] }, region: '' };
    const subsBox = $('#subs');
    const empty = $('#sub-empty');
    subsBox.innerHTML = Object.keys(NEEDS).map((k) => `<div class="sub-group" data-group="${k}" hidden><h4>${esc(NEEDS[k].title)}</h4><div class="opts">${NEEDS[k].opts.map((o) => `<button type="button" class="opt" data-k="${k}" data-v="${esc(o)}" aria-pressed="false">${esc(o)}</button>`).join('')}</div></div>`).join('');
    $('#region-chips').innerHTML = REGIONS.map((r) => `<button type="button" class="opt" data-region="${r}" aria-pressed="false">${r}</button>`).join('');
    const order = Object.keys(NEEDS);
    $$('.need input').forEach((inp) => {
      inp.addEventListener('change', () => {
        const k = inp.value;
        const card = inp.closest('.need');
        card.classList.toggle('is-on', inp.checked);
        if (inp.checked) Q.needs.push(k);
        else Q.needs = Q.needs.filter((x) => x !== k);
        Q.needs.sort((a, b) => order.indexOf(a) - order.indexOf(b));
        const grp = $(`[data-group="${k}"]`, subsBox);
        grp.hidden = !inp.checked;
        if (inp.checked && !reduced) {
          grp.animate([{ clipPath: 'inset(0 0 100% 0)', transform: 'translateY(-10px)' }, { clipPath: 'inset(0 0 0% 0)', transform: 'translateY(0)' }], { duration: 800, easing: E_OUT });
        }
        empty.hidden = Q.needs.length > 0;
        summary();
      });
    });
    subsBox.addEventListener('click', (e) => {
      const b = e.target.closest('.opt');
      if (!b) return;
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on));
      b.classList.toggle('is-on', on);
      const arr = Q.subs[b.dataset.k];
      if (on) arr.push(b.dataset.v);
      else arr.splice(arr.indexOf(b.dataset.v), 1);
      const all = NEEDS[b.dataset.k].opts;
      arr.sort((x, y) => all.indexOf(x) - all.indexOf(y));
      summary();
    });
    $('#region-chips').addEventListener('click', (e) => {
      const b = e.target.closest('.opt');
      if (!b) return;
      const v = b.dataset.region;
      Q.region = Q.region === v ? '' : v;
      $$('#region-chips .opt').forEach((x) => {
        const on = x.dataset.region === Q.region;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', String(on));
      });
      summary();
    });
    ['#f-company', '#f-name', '#f-phone'].forEach((id) => $(id).addEventListener('input', summary));
    function summary() {
      const rows = [];
      rows.push(['필요한 도움', Q.needs.map((k) => NEEDS[k].label).join(', ')]);
      const det = Q.needs.filter((k) => Q.subs[k].length).map((k) => `${NEEDS[k].label}: ${Q.subs[k].join(', ')}`);
      rows.push(['세부 항목', det.join(' / ')]);
      rows.push(['지역', Q.region]);
      $('#sum-list').innerHTML = rows.map(([k, v]) => `<div><dt>${k}</dt><dd class="${v ? '' : 'is-empty'}">${v ? esc(v) : '선택 전'}</dd></div>`).join('');
      const company = $('#f-company').value.trim();
      const name = $('#f-name').value.trim();
      const phone = $('#f-phone').value.trim();
      const lines = [
        `필요한 도움: ${Q.needs.map((k) => NEEDS[k].title).join(', ') || '-'}`,
        ...Q.needs.map((k) => `${NEEDS[k].label} 세부 항목: ${Q.subs[k].join(', ') || '-'}`),
        `지역: ${Q.region || '-'}`,
        `회사명: ${company || '-'}`,
        `담당자명: ${name || '-'}`,
        `연락처: ${phone || '-'}`,
      ];
      const subj = `[상담 문의] ${Q.needs.map((k) => NEEDS[k].label).join(' · ') || '여행의완성'}${company ? ` - ${company}` : ''}`;
      $('#mail-btn').href = `mailto:yeowan@yeowan.kr?subject=${encodeURIComponent(subj)}&body=${encodeURIComponent(lines.join('\n'))}`;
    }
    summary();
  }

  function initScrubs() {
    const inq = $('#inquiry');
    const wm = $('#wordmark');
    const letters = $$('span', wm);
    let inqTop = 0;
    let wmTop = 0;
    let wmH = 1;
    const cache = () => {
      inqTop = inq.getBoundingClientRect().top + scrollY;
      const r = wm.getBoundingClientRect();
      wmTop = r.top + scrollY;
      wmH = r.height || 1;
    };
    cache();
    addEventListener('resize', cache);
    new ResizeObserver(cache).observe(document.body);
    if (reduced) {
      inq.style.setProperty('--r', '0px');
      return;
    }
    let lastR = -1;
    let lastP = -1;
    tasks.add(() => {
      const y = scrollY;
      const vh = innerHeight;
      const t = inqTop - y;
      if (t < vh * 1.2 && t > -vh) {
        const p = clamp(1 - t / vh, 0, 1);
        const R = isPhone() ? 32 : 56;
        const r = Math.round(R * (1 - easeOut(p)) * 10) / 10;
        if (r !== lastR) {
          lastR = r;
          inq.style.setProperty('--r', `${r}px`);
        }
      }
      const wt = wmTop - y;
      if (wt < vh + 40) {
        const p = clamp((vh - wt) / (wmH * 1.15), 0, 1);
        if (Math.abs(p - lastP) > .0005) {
          lastP = p;
          letters.forEach((l, i) => {
            const q = clamp(p * 1.7 - i * .14, 0, 1);
            const e = easeOut(q);
            l.style.transform = e >= 1 ? 'none' : `translate3d(0, ${((1 - e) * 105).toFixed(2)}%, 0)`;
          });
        }
      }
    });
  }

  let lastW = innerWidth;
  let rzT = 0;
  addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      if (innerWidth !== lastW) {
        lastW = innerWidth;
        splitAll();
      }
      if (heroMap) {
        heroMap.size();
        heroMap.measure();
        placeHeroLabels();
      }
      if (fmap && F.view === 'map') {
        fmap.size();
        fmap.measure();
      }
      Smooth.measure();
    }, 160);
  });

  addEventListener('scroll', () => {
    if (scrollY + innerHeight >= document.documentElement.scrollHeight - 6) revealRemaining();
  }, { passive: true });

  initRoll();
  initMagnetic();

  const fontsReady = Promise.race([
    document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve(),
    new Promise((r) => setTimeout(r, 1800)),
  ]);

  const dataReady = Promise.all([
    fetch(`${A}stays.json`).then((r) => r.json()),
    fetch(`${A}korea.json`).then((r) => r.json()),
    fetch(`${A}photos.json`).then((r) => r.json()),
  ]).then(([s, k, p]) => {
    STAYS = s;
    KOREA = k;
    PHOTOS = p;
    STAYS.forEach((x) => byId.set(x.id, x));
    return true;
  }).catch(() => false);

  fontsReady.then(() => {
    splitAll();
    if (reduced) {
      $$('[data-split],[data-eyebrow],[data-rise],[data-clip]').forEach((el) => el.classList.add('is-in'));
    } else {
      pending.forEach((el) => revealIO.observe(el));
    }
    return dataReady;
  }).then((ok) => {
    if (ok) {
      try { initHero(); } catch (e) { heroMap = null; }
      initMarquee();
      initFinder();
      initInquiry();
      initBooking();
    }
    initServices();
    initScrubs();
    initMagnetic();
    heroIntro();
    Smooth.measure();
    const s = stayFromHash();
    if (s) {
      history.replaceState(null, '', location.pathname + location.search);
      history.pushState({ stay: s.id }, '', `#stay-${s.id}`);
      openDetail(s, null, false);
      detailState.pushed = true;
    }
  });
})();
