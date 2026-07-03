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

    const apply = () => {
      const doc = document.documentElement;
      const max = (doc.scrollHeight - window.innerHeight) || 1;
      const t = Math.min(1, Math.max(0, window.scrollY / max));
      const bg = pw(BG, t), ink = pw(INK, t), acc = pw(ACC, t);
      const tint = smooth(t, 0.64, 1);
      if (rootEl) {
        rootEl.style.setProperty('--ink', rgb(ink));
        rootEl.style.setProperty('--accent', rgb(acc));
        rootEl.style.setProperty('--line', `rgba(${acc[0] | 0},${acc[1] | 0},${acc[2] | 0},${(0.18 + 0.4 * tint).toFixed(3)})`);
      }
      if (bgEl) bgEl.style.background = rgb(bg);
      if (glowEl) glowEl.style.opacity = (tint * 0.8).toFixed(3);
      if (eyeEl) eyeEl.style.filter = `drop-shadow(0 0 ${(tint * 18).toFixed(1)}px rgba(214,34,26,${(tint * 0.95).toFixed(2)}))`;
      if (eyeStar) eyeStar.style.transform = `scale(${(1 + tint * 0.5).toFixed(3)})`;
      if (eyeRedEl) eyeRedEl.style.opacity = tint.toFixed(3);
      if (veinsEl) veinsEl.style.opacity = (tint * 0.9).toFixed(3);
      if (eyeLabel) eyeLabel.style.opacity = (tint).toFixed(3);
      if (barEl) barEl.style.width = (t * 100).toFixed(2) + '%';
      if (sunkenEl && sunkenSec) {
        const r = sunkenSec.getBoundingClientRect();
        const vhh = window.innerHeight || 800;
        // 0 as the section enters from the bottom, 1 as it exits the top
        let p = (vhh - r.top) / (vhh + r.height);
        p = Math.max(0, Math.min(1, p));
        // fall the full section height, then overflow:hidden clips it behind the next section
        const fall = p * r.height;
        sunkenEl.style.transform = `translateY(${fall.toFixed(1)}px) rotate(${(p * 5).toFixed(2)}deg)`;
      }
    };
    let ticking = false;
    const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; apply(); }); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    apply();

    // ---- pupil follows cursor / finger, with idle drift ----
    let pupilTarget = { x: 0, y: 0 };
    let pupilCur = { x: 0, y: 0 };
    let lastPointer = 0;

    const setTargetFromPoint = (clientX, clientY) => {
      pupilTarget.x = clientX / window.innerWidth - 0.5;
      pupilTarget.y = clientY / window.innerHeight - 0.5;
      lastPointer = performance.now();
    };
    const onMove = (e) => setTargetFromPoint(e.clientX, e.clientY);
    const onTouch = (e) => {
      const t = e.touches && e.touches[0];
      if (t) setTargetFromPoint(t.clientX, t.clientY);
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('touchstart', onTouch, { passive: true });

    // rAF loop: ease pupil toward target; when no pointer for a bit, drift on a slow lissajous
    const pupils = Array.from(root.querySelectorAll('[data-pupil]'));
    let pupilRAF = null;
    const tick = (now) => {
      const idle = now - lastPointer > 2200;
      if (idle) {
        const s = now / 1000;
        pupilTarget.x = Math.sin(s * 0.6) * 0.42;
        pupilTarget.y = Math.sin(s * 0.9 + 1.3) * 0.32;
      }
      pupilCur.x += (pupilTarget.x - pupilCur.x) * 0.08;
      pupilCur.y += (pupilTarget.y - pupilCur.y) * 0.08;
      pupils.forEach((p) => {
        const amt = parseFloat(p.getAttribute('data-pupil')) || 7;
        p.style.transform = `translate(${(pupilCur.x * amt).toFixed(2)}px, ${(pupilCur.y * amt).toFixed(2)}px)`;
      });
      pupilRAF = requestAnimationFrame(tick);
    };
    pupilRAF = requestAnimationFrame(tick);

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
    const show = (k) => { k.style.opacity = '1'; k.style.transform = 'none'; };
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
      // targeted safety: reveal only items already at/above the fold that IO may have missed
      setTimeout(() => {
        units.forEach((k) => {
          if (k._shown) return;
          if (k.getBoundingClientRect().top < (window.innerHeight || 800)) show(k);
        });
      }, 3500);
    }
  });
})();
