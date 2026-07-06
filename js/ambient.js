/** Canvas 环境动画 — 接入全局 Motion 低频调度 */
const Ambient = (() => {
  let canvas, ctx, mode = 'home';
  let blobs = [];
  let t0 = 0;
  let unregister = null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'ambient-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.prepend(canvas);
    ctx = canvas.getContext('2d', { alpha: false });
    window.addEventListener('resize', resize);
    resize();
  }

  function resize() {
    if (!canvas) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.floor(window.innerWidth * ratio);
    canvas.height = Math.floor(window.innerHeight * ratio);
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  function makeGlowSprite(radius, hue, alpha) {
    const size = Math.max(64, Math.round(radius * 2));
    const sprite = document.createElement('canvas');
    sprite.width = size;
    sprite.height = size;
    const sctx = sprite.getContext('2d');
    const g = sctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, `hsla(${hue}, 70%, 58%, ${alpha})`);
    g.addColorStop(0.45, `hsla(${hue}, 62%, 45%, ${alpha * 0.4})`);
    g.addColorStop(1, 'hsla(0,0%,0%,0)');
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, size, size);
    return sprite;
  }

  function setMode(m) {
    mode = m;
    blobs = [];
    const w = window.innerWidth;
    const h = window.innerHeight;
    const count = reduceMotion ? 2 : m === 'home' ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const blob = {
        x: w * (0.2 + Math.random() * 0.6),
        y: h * (0.2 + Math.random() * 0.6),
        r: Math.min(w, h) * (0.18 + Math.random() * 0.12),
        hue: m === 'camp' ? 40 : m === 'focus' ? 270 : 250 + i * 20,
        alpha: m === 'camp' ? 0.08 : 0.11,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.25,
      };
      blob.sprite = makeGlowSprite(blob.r, blob.hue, blob.alpha);
      blobs.push(blob);
    }
    t0 = performance.now();
  }

  function draw(now) {
    if (!ctx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const t = (now - t0) / 1000;

    ctx.fillStyle = '#0c0f0f';
    ctx.fillRect(0, 0, w, h);

    blobs.forEach((b, i) => {
      const pulse = 0.85 + 0.15 * Math.sin(t * b.speed + b.phase);
      const dx = Math.sin(t * 0.12 + i) * 26;
      const dy = Math.cos(t * 0.1 + i * 1.3) * 18;
      const x = b.x + dx;
      const y = b.y + dy;
      const size = b.r * 2 * pulse;
      ctx.globalAlpha = 0.9;
      ctx.drawImage(b.sprite, x - size / 2, y - size / 2, size, size);
    });
    ctx.globalAlpha = 1;

    if (mode === 'nap' || mode === 'home') {
      const particleCount = reduceMotion ? 6 : 10;
      for (let i = 0; i < particleCount; i++) {
        const px = (Math.sin(t * 0.2 + i * 1.7) * 0.5 + 0.5) * w;
        const py = ((t * 12 + i * 120) % h);
        ctx.fillStyle = `rgba(255,255,255,${0.02 + 0.015 * Math.sin(t + i)})`;
        ctx.beginPath();
        ctx.arc(px, py, 1 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function attachLoop() {
    if (unregister) return;
    unregister = Motion.register(draw);
  }

  function detachLoop() {
    unregister?.();
    unregister = null;
  }

  function start(m) {
    ensureCanvas();
    canvas.style.display = 'block';
    setMode(m);
    attachLoop();
  }

  function stop() {
    detachLoop();
    if (canvas) canvas.style.display = 'none';
  }

  return { start, stop, setMode };
})();
