(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const root = document;
    const rootEl = document.getElementById('page');

    // ---- color escalation model ----
    const mix = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
    const pw = (stops, t) => {
      for (let i = 0; i < stops.length - 1; i++) {
        const [p0, c0] = stops[i], [p1, c1] = stops[i + 1];
        if (t <= p1) { const f = (t - p0) / ((p1 - p0) || 1); return mix(c0, c1, Math.max(0, Math.min(1, f))); }
      }
      return stops[stops.length - 1][1];
    };
    const rgb = (c) => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    const smooth = (t, a, b) => { let x = Math.max(0, Math.min(1, (t - a) / (b - a))); return x * x * (3 - 2 * x); };

    const BG = [[0, [246, 244, 240]], [0.66, [226, 208, 183]], [0.76, [120, 42, 34]], [0.86, [70, 14, 13]], [1, [22, 7, 10]]];
    const INK = [[0, [27, 36, 64]], [0.68, [30, 36, 58]], [0.76, [239, 215, 200]], [1, [244, 226, 214]]];
    const ACC = [[0, [43, 58, 96]], [0.6, [150, 52, 54]], [0.76, [190, 40, 34]], [1, [222, 44, 34]]];

    const bgEl = root.querySelector('[data-bg]');
    const glowEl = root.querySelector('[data-glow]');
    const barEl = root.querySelector('[data-progress]');
    const eyeEl = root.querySelector('[data-eye]');
    const eyeStar = root.querySelector('[data-eyestar]');
    const eyeLabel = root.querySelector('[data-eyelabel]');
    const eyeRedEl = root.querySelector('[data-eyered]');
    const veinsEl = root.querySelector('[data-veins]');
    const sunkenEl = root.querySelector('[data-sunken]');
    const sunkenSec = sunkenEl ? sunkenEl.closest('section') : null;

    // Cache scroll geometry so the per-frame handler never calls getBoundingClientRect()
    // (a forced synchronous reflow that hitches scrolling, worst when blend layers are busy).
    // Recomputed only on resize / load, not on every scroll frame.
    const geo = { max: 1, secTop: 0, secH: 0 };
    const measure = () => {
      const doc = document.documentElement;
      geo.max = (doc.scrollHeight - window.innerHeight) || 1;
      if (sunkenSec) {
        const y = window.scrollY;
        const r = sunkenSec.getBoundingClientRect();
        geo.secTop = r.top + y; // absolute document offset
        geo.secH = r.height;
      }
    };
    measure();
    if (document.readyState !== 'complete') window.addEventListener('load', measure, { once: true });

    let lastQt = null, lastQp = null;
    const apply = () => {
      const y = window.scrollY;
      const t = Math.min(1, Math.max(0, y / geo.max));
      const tint = smooth(t, 0.64, 1);

      // --- cheap, compositor-friendly updates: safe to run every frame ---
      if (barEl) barEl.style.transform = `scaleX(${t.toFixed(4)})`;
      if (sunkenEl && sunkenSec) {
        // r.top (viewport-relative) derived from cached offset — no layout read
        const rTop = geo.secTop - y;
        let p = (window.innerHeight - rTop) / (window.innerHeight + geo.secH);
        p = Math.max(0, Math.min(1, p));
        sunkenEl.style.transform = `translateY(${(p * geo.secH).toFixed(1)}px) rotate(${(p * 5).toFixed(2)}deg)`;
      }

      // --- EXPENSIVE writes (filter / background / blend-layer opacities) repaint the big
      //     fixed blend-mode layers. Only touch them when the quantized tint actually changes,
      //     so a normal scroll doesn't re-rasterize those layers on every single frame. ---
      const qt = Math.round(tint * 24) / 24;
      const qp = Math.round(t * 24) / 24;
      if (qt === lastQt && qp === lastQp) return;
      lastQt = qt; lastQp = qp;
      const bg = pw(BG, qp), ink = pw(INK, qp), acc = pw(ACC, qp);
      if (rootEl) {
        rootEl.style.setProperty('--ink', rgb(ink));
        rootEl.style.setProperty('--accent', rgb(acc));
        rootEl.style.setProperty('--line', `rgba(${acc[0] | 0},${acc[1] | 0},${acc[2] | 0},${(0.18 + 0.4 * qt).toFixed(3)})`);
      }
      if (bgEl) bgEl.style.background = rgb(bg);
      if (glowEl) glowEl.style.opacity = (qt * 0.8).toFixed(3);
      if (eyeEl) eyeEl.style.filter = qt > 0.01 ? `drop-shadow(0 0 ${(qt * 18).toFixed(1)}px rgba(214,34,26,${(qt * 0.95).toFixed(2)}))` : 'none';
      if (eyeStar) eyeStar.style.transform = `scale(${(1 + qt * 0.5).toFixed(3)})`;
      if (eyeRedEl) eyeRedEl.style.opacity = qt.toFixed(3);
      if (veinsEl) veinsEl.style.opacity = (qt * 0.9).toFixed(3);
      if (eyeLabel) eyeLabel.style.opacity = (qt).toFixed(3);
    };
    let ticking = false;
    let lastScroll = 0;
    const onScroll = () => { lastScroll = performance.now(); if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; apply(); }); };
    const onResize = () => { measure(); onScroll(); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    // reveal transitions change section heights as they fade in — refresh cached geometry after they settle
    setTimeout(measure, 1600);
    apply();

    // ---- paint isolation: keep each section's paint contained, and push every big
    // background/section image onto its own GPU layer so trackpad scroll only COMPOSITES
    // them (moves an existing texture) instead of repainting on each momentum delta. ----
    root.querySelectorAll('section').forEach((sec) => {
      sec.style.contain = 'layout paint';
    });
    root.querySelectorAll('section img').forEach((im) => {
      im.style.transform = (im.style.transform ? im.style.transform + ' ' : '') + 'translateZ(0)';
      im.style.backfaceVisibility = 'hidden';
    });

    // ---- warm-up: fetch + decode every image during idle time shortly after load,
    // so the first swipe never pays lazy-load / decode / first-raster cost mid-scroll ----
    let warmTimer = setTimeout(() => {
      const imgs = [...root.querySelectorAll('img')];
      let i = 0;
      const next = () => {
        if (i >= imgs.length) return;
        const im = imgs[i++];
        im.loading = 'eager';
        const p = im.decode ? im.decode().catch(() => {}) : Promise.resolve();
        p.then(() => { warmTimer = setTimeout(next, 60); });
      };
      next();
    }, 900);

    // ---- pause infinite jitter/glitch animations while their section is offscreen ----
    // They otherwise animate transform/clip-path continuously for the whole page lifetime,
    // keeping the compositor busy and stealing frames from scrolling.
    const animEls = [...root.querySelectorAll('section [style]')].filter((el) => el.style.animationName || el.style.animation);
    if (animEls.length && 'IntersectionObserver' in window) {
      const bySec = new Map();
      animEls.forEach((el) => {
        const sec = el.closest('section');
        if (!sec) return;
        if (!bySec.has(sec)) bySec.set(sec, []);
        bySec.get(sec).push(el);
        el.style.animationPlayState = 'paused';
      });
      const animIO = new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          const els = bySec.get(en.target) || [];
          els.forEach((el) => { el.style.animationPlayState = en.isIntersecting ? 'running' : 'paused'; });
        });
      }, { rootMargin: '20% 0px 20% 0px' });
      [...bySec.keys()].forEach((sec) => animIO.observe(sec));
    }

    // ---- pupil follows cursor / finger ONLY ----
    // No idle animation and no CSS transition: the eye sits in a fixed, filtered, blend-mode
    // layer, so ANY pupil movement forces that whole layer to repaint. We therefore move it
    // only in direct response to input (rAF-coalesced) — while you're scrolling and not
    // touching the eye, the pupil is completely static and costs nothing.
    const pupils = [...root.querySelectorAll('[data-pupil]')];

    let writeQueued = false, pendX = 0, pendY = 0;
    const writePupil = (nx, ny) => {
      pendX = nx; pendY = ny;
      if (writeQueued) return;
      writeQueued = true;
      requestAnimationFrame(() => {
        writeQueued = false;
        pupils.forEach((p) => {
          const amt = parseFloat(p.getAttribute('data-pupil')) || 7;
          p.style.transform = `translate(${(pendX * amt).toFixed(2)}px, ${(pendY * amt).toFixed(2)}px)`;
        });
      });
    };

    // Fine pointer (mouse/trackpad) only: on touch the pupil no longer chases the finger
    // during scroll — that was repainting the fixed eye layer on every touchmove and hitching
    // the scroll. Coarse-pointer devices leave the eye static, staring straight ahead.
    const finePointer = !(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    // While actively scrolling, ignore mousemove entirely: momentum scroll emits synthetic
    // mousemoves, and moving the pupil repaints the filtered eye layer — that repaint is what
    // makes trackpad scroll feel like it "sticks". The eye simply holds still as you scroll.
    const onMove = (e) => {
      if (performance.now() - lastScroll < 180) return;
      writePupil(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    };
    if (finePointer) window.addEventListener('mousemove', onMove, { passive: true });

    // ---- reveal on scroll: each block/card fades + rises as it personally enters view ----
    const EASE = 'cubic-bezier(.22,.61,.36,1)';
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isWrap = (el) => {
      const d = getComputedStyle(el).display;
      return (d === 'flex' || d === 'grid') && el.childElementCount > 1;
    };
    const unitsOf = (host) => {
      let top = Array.from(host.children).filter((c) => c.nodeType === 1);
      // step into a single wrapper (e.g. a centering div)
      if (top.length === 1 && top[0].childElementCount > 1) top = Array.from(top[0].children);
      const out = [];
      top.forEach((c) => {
        // expand a row/grid of cards so each card fades as it enters, not all at once
        if (isWrap(c) && c.childElementCount >= 3) {
          Array.from(c.children).forEach((g) => { if (g.nodeType === 1) out.push(g); });
        } else {
          out.push(c);
        }
      });
      return out.length ? out : [host];
    };
    const hide = (k) => { k.style.opacity = '0'; k.style.transform = 'translateY(22px)'; };
    const show = (k) => {
      k.style.opacity = '1'; k.style.transform = 'none'; k._shown = true;
      // drop GPU promotion once the one-shot reveal is done — avoids permanently-composited layers
      setTimeout(() => { k.style.willChange = 'auto'; }, 900);
    };
    const vh = window.innerHeight || 800;
    const units = [];
    Array.from(root.querySelectorAll('[data-reveal]')).forEach((host) => {
      unitsOf(host).forEach((k, i) => {
        k.style.willChange = 'opacity, transform';
        const d = (i % 3) * 80;
        k.style.transition = `opacity .7s ${EASE} ${d}ms, transform .8s ${EASE} ${d}ms`;
        units.push(k);
      });
    });
    if (reduceMotion) {
      units.forEach(show);
    } else {
      units.forEach((k) => {
        const r = k.getBoundingClientRect();
        if (r.top < vh * 0.92 && r.bottom > 0) { show(k); k._shown = true; } else { hide(k); }
      });
      const io = new IntersectionObserver((es) => {
        es.forEach((en) => { if (en.isIntersecting) { show(en.target); io.unobserve(en.target); } });
      }, { threshold: 0.12, rootMargin: '0px 0px -10% 0px' });
      units.forEach((k) => { if (!k._shown) io.observe(k); });
      // safety net: reveal above-the-fold items IO may have missed (keeps scroll-in for the rest)
      let revTimer = setTimeout(() => {
        units.forEach((k) => {
          if (k._shown) return;
          if (k.getBoundingClientRect().top < (window.innerHeight || 800)) show(k);
        });
      }, 2500);
    }
  });
})();
