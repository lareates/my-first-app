/** Canvas 环境动画 — 接入全局 Motion 低频调度 */
const Ambient = (() => {
  let canvas, ctx, mode = 'home';
  let blobs = [];
  let stars = [];
  let t0 = 0;
  let unregister = null;
  let focusEnergy = 0; // 0 = 绝对静夜，1 = 星光呼吸最明显
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
    if (mode === 'focus') seedStars();
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

  function seedStars() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const count = reduceMotion ? 48 : 110;
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.5 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + Math.random() * 1.4,
      base: 0.15 + Math.random() * 0.55,
    }));
  }

  function setFocusEnergy(level) {
    focusEnergy = Math.max(0, Math.min(1, Number(level) || 0));
  }

  function setMode(m) {
    mode = m;
    blobs = [];
    stars = [];
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (m === 'focus') {
      seedStars();
      t0 = performance.now();
      return;
    }

    const count = reduceMotion ? 2 : m === 'home' ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const blob = {
        x: w * (0.2 + Math.random() * 0.6),
        y: h * (0.2 + Math.random() * 0.6),
        r: Math.min(w, h) * (0.18 + Math.random() * 0.12),
        hue: m === 'camp' ? 40 : 250 + i * 20,
        alpha: m === 'camp' ? 0.08 : 0.11,
        phase: Math.random() * Math.PI * 2,
        speed: 0.2 + Math.random() * 0.25,
      };
      blob.sprite = makeGlowSprite(blob.r, blob.hue, blob.alpha);
      blobs.push(blob);
    }
    t0 = performance.now();
  }

  function drawFocusStars(now) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const t = (now - t0) / 1000;
    const energy = focusEnergy;

    // 暗夜底色：总音量越低越深、越静
    const lift = 4 + energy * 10;
    ctx.fillStyle = `rgb(${lift}, ${lift + 1}, ${lift + 4})`;
    ctx.fillRect(0, 0, w, h);

    // 微弱紫晕，能量高时才显露
    if (energy > 0.04) {
      const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.4, Math.max(w, h) * 0.55);
      g.addColorStop(0, `rgba(90, 70, 180, ${0.035 + energy * 0.08})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    // 闪烁速度与幅度绑定总音量；近零时近乎静止
    const twinkleSpeed = 0.05 + energy * 2.4;
    const twinkleAmp = 0.04 + energy * 0.72;

    stars.forEach((s) => {
      const pulse = reduceMotion
        ? s.base * (0.35 + energy * 0.65)
        : s.base * (0.28 + twinkleAmp * (0.5 + 0.5 * Math.sin(t * s.speed * twinkleSpeed + s.phase)));
      const a = Math.max(0.02, Math.min(1, pulse * (0.25 + energy * 0.9)));
      ctx.beginPath();
      ctx.fillStyle = `rgba(220, 228, 255, ${a})`;
      ctx.arc(s.x, s.y, s.r * (0.85 + energy * 0.35), 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function draw(now) {
    if (!ctx) return;

    if (mode === 'focus') {
      drawFocusStars(now);
      return;
    }

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
    unregister = Motion.registerLow(draw);
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
    focusEnergy = 0;
  }

  return { start, stop, setMode, setFocusEnergy };
})();
