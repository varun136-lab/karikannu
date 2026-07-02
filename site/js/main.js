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
    };
    let ticking = false;
    const onScroll = () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; apply(); }); };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    apply();

    // ---- pupil follows cursor ----
    const onMove = (e) => {
      const cx = e.clientX / window.innerWidth - 0.5;
      const cy = e.clientY / window.innerHeight - 0.5;
      root.querySelectorAll('[data-pupil]').forEach((p) => {
        const amt = parseFloat(p.getAttribute('data-pupil')) || 7;
        p.style.transform = `translate(${(cx * amt).toFixed(2)}px, ${(cy * amt).toFixed(2)}px)`;
      });
    };
    window.addEventListener('mousemove', onMove, { passive: true });

    // ---- reveal on scroll: staggered fade + rise + de-blur (titles cascade in) ----
    const EASE = 'cubic-bezier(.22,.61,.36,1)';
    const rev = Array.from(root.querySelectorAll('[data-reveal]'));
    const kidsOf = (el) => {
      let ks = Array.from(el.children);
      // one level deeper if the block is a single wrapper (e.g. a centering div)
      if (ks.length === 1 && ks[0].children.length > 1) ks = Array.from(ks[0].children);
      return ks.length ? ks : [el];
    };
    const prep = (el) => {
      el._rk = kidsOf(el);
      el._rk.forEach((k, i) => {
        k.style.willChange = 'opacity, transform, filter';
        const d = Math.min(i * 85, 620);
        k.style.transition = `opacity .85s ${EASE} ${d}ms, transform 1s ${EASE} ${d}ms, filter 1s ${EASE} ${d}ms`;
      });
    };
    const hide = (el) => { el._rk.forEach(k => { k.style.opacity = '0'; k.style.transform = 'translateY(34px)'; k.style.filter = 'blur(6px)'; }); };
    const show = (el) => { el._rk.forEach(k => { k.style.opacity = '1'; k.style.transform = 'none'; k.style.filter = 'none'; }); };
    const vh = window.innerHeight || 800;
    rev.forEach(prep);
    rev.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.9 && r.bottom > 0) { show(el); el._shown = true; } else { hide(el); }
    });
    const io = new IntersectionObserver((es) => {
      es.forEach((en) => { if (en.isIntersecting) { show(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    rev.forEach((el) => { if (!el._shown) io.observe(el); });
    // failsafe: never leave content hidden
    setTimeout(() => rev.forEach(show), 2600);
  });
})();
