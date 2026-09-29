/**
 * 统一氛围背景层 — 静态图 + 深色遮罩 + 极轻量 CSS 动态
 * Tesla 优先：无 video / WebGL / 高频 canvas；不可见时暂停；切换后清理旧动态层
 */
const AmbientBackground = (() => {
  const CROSSFADE_MS = 700;
  const PRELOAD_IDLE_MS = 1800;

  let root = null;
  let slotA = null;
  let slotB = null;
  let activeSlot = null;
  let currentSceneId = null;
  let fading = false;
  let visible = true;
  let paused = false;
  let idlePreloadTimer = null;
  let visibilityBound = false;

  const reduceMotion = (() => {
    try {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return false;
    }
  })();

  function performanceTier() {
    const lowPower = typeof AudioEngine !== 'undefined' && !!AudioEngine.LOW_POWER;
    const coarse = (() => {
      try {
        return window.matchMedia('(pointer: coarse)').matches;
      } catch {
        return false;
      }
    })();
    if (reduceMotion) return 'static';
    if (lowPower) return 'static';
    if (coarse) return 'reduced';
    return 'normal';
  }

  function rainCount(tier, density) {
    if (tier === 'static') return 0;
    const base = density === 'very_low' ? 12 : 18;
    if (tier === 'reduced') return Math.max(8, Math.floor(base / 2));
    return Math.min(24, base);
  }

  function ensureRoot(host) {
    if (root && document.body.contains(root)) return root;
    const screen = host || document.getElementById('scene-nap');
    if (!screen) return null;
    let el = document.getElementById('ambient-bg-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ambient-bg-root';
      el.className = 'ambient-bg';
      el.setAttribute('aria-hidden', 'true');
      const dawn = screen.querySelector('#nap-dawn-overlay');
      if (dawn) screen.insertBefore(el, dawn);
      else screen.insertBefore(el, screen.firstChild);
    }
    root = el;
    if (!slotA) {
      slotA = createSlot('a');
      slotB = createSlot('b');
      root.appendChild(slotA);
      root.appendChild(slotB);
      activeSlot = slotA;
    }
    bindVisibility();
    return root;
  }

  function createSlot(key) {
    const slot = document.createElement('div');
    slot.className = 'ambient-bg-slot';
    slot.dataset.slot = key;
    slot.innerHTML = `
      <div class="ambient-bg-fallback"></div>
      <div class="ambient-bg-image"></div>
      <div class="ambient-bg-overlay"></div>
      <div class="ambient-bg-fx" hidden></div>
    `;
    return slot;
  }

  function bindVisibility() {
    if (visibilityBound) return;
    visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      visible = !document.hidden;
      if (visible) resume();
      else pause();
    });
  }

  function clearFx(slot) {
    const fx = slot?.querySelector('.ambient-bg-fx');
    if (!fx) return;
    fx.hidden = true;
    fx.className = 'ambient-bg-fx';
    fx.removeAttribute('data-anim');
    fx.innerHTML = '';
    fx.style.cssText = '';
  }

  function applyStaticLayers(slot, cfg) {
    const fallback = slot.querySelector('.ambient-bg-fallback');
    const image = slot.querySelector('.ambient-bg-image');
    const overlay = slot.querySelector('.ambient-bg-overlay');

    fallback.style.background = cfg.fallbackGradient || '#0a0c10';

    image.style.backgroundImage = '';
    image.classList.remove('is-ready', 'is-failed');
    if (cfg.backgroundImage) {
      const url = cfg.backgroundImage;
      const probe = new Image();
      probe.decoding = 'async';
      probe.onload = () => {
        if (slot.dataset.sceneId !== cfg.id) return;
        image.style.backgroundImage = `url("${url}")`;
        image.classList.add('is-ready');
      };
      probe.onerror = () => {
        if (slot.dataset.sceneId !== cfg.id) return;
        image.style.backgroundImage = '';
        image.classList.add('is-failed');
      };
      probe.src = url;
    }

    const op = typeof cfg.overlay?.opacity === 'number' ? cfg.overlay.opacity : 0.28;
    const grad = cfg.overlay?.gradient
      || 'linear-gradient(to bottom, rgba(5,7,12,0.12), rgba(5,7,12,0.28))';
    overlay.style.opacity = String(op);
    overlay.style.background = grad;
  }

  function buildFx(slot, cfg, tier) {
    clearFx(slot);
    if (tier === 'static' || cfg.reduceMotionFallback && reduceMotion) return;

    const fx = slot.querySelector('.ambient-bg-fx');
    const type = cfg.animationType;
    const dur = Math.max(4, cfg.animationDuration || 8);
    fx.hidden = false;
    fx.dataset.anim = type;
    fx.style.setProperty('--amb-dur', `${dur}s`);

    if (type === 'rain') {
      const n = rainCount(tier, cfg.animationDensity);
      const frag = document.createDocumentFragment();
      for (let i = 0; i < n; i += 1) {
        const drop = document.createElement('span');
        drop.className = 'amb-rain-drop';
        const left = 4 + (i / Math.max(1, n - 1)) * 92 + (Math.random() * 3 - 1.5);
        const len = 10 + Math.random() * 18;
        const delay = -Math.random() * dur;
        const drift = (Math.random() * 1.4 - 0.7).toFixed(2);
        drop.style.left = `${left}%`;
        drop.style.height = `${len}px`;
        drop.style.animationDuration = `${(dur * (0.85 + Math.random() * 0.35)).toFixed(2)}s`;
        drop.style.animationDelay = `${delay.toFixed(2)}s`;
        drop.style.setProperty('--amb-drift', `${drift}px`);
        drop.style.opacity = String(0.12 + Math.random() * 0.14);
        frag.appendChild(drop);
      }
      fx.appendChild(frag);
      return;
    }

    if (type === 'water_shift') {
      const sheen = document.createElement('div');
      sheen.className = 'amb-water-sheen';
      fx.appendChild(sheen);
      if (tier === 'normal') {
        const sheen2 = document.createElement('div');
        sheen2.className = 'amb-water-sheen amb-water-sheen--soft';
        fx.appendChild(sheen2);
      }
      return;
    }

    if (type === 'breathing_wave') {
      const wave = document.createElement('div');
      wave.className = 'amb-tide-band';
      const glow = document.createElement('div');
      glow.className = 'amb-tide-glow';
      fx.appendChild(wave);
      fx.appendChild(glow);
      return;
    }

    if (type === 'soft_sway') {
      const sway = document.createElement('div');
      sway.className = 'amb-sway-veil';
      fx.appendChild(sway);
      return;
    }

    if (type === 'night_glow') {
      const glow = document.createElement('div');
      glow.className = 'amb-night-glow';
      fx.appendChild(glow);
    }
  }

  function setPausedClass(on) {
    root?.classList.toggle('ambient-bg-paused', on);
  }

  function pause() {
    paused = true;
    setPausedClass(true);
  }

  function resume() {
    if (!visible || !currentSceneId) return;
    paused = false;
    setPausedClass(false);
  }

  function preload(url) {
    if (!url) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }

  function scheduleIdlePreload(exceptId) {
    clearTimeout(idlePreloadTimer);
    idlePreloadTimer = window.setTimeout(() => {
      if (typeof SceneBackgroundConfig === 'undefined') return;
      const next = SceneBackgroundConfig.all().find((s) => s.id !== exceptId);
      if (next?.backgroundImage) preload(next.backgroundImage);
    }, PRELOAD_IDLE_MS);
  }

  function markScreen(on) {
    const screen = document.getElementById('scene-nap');
    if (!screen) return;
    screen.classList.toggle('nap-has-ambient-bg', !!on);
  }

  function paintSlot(slot, cfg) {
    slot.dataset.sceneId = cfg.id;
    applyStaticLayers(slot, cfg);
    buildFx(slot, cfg, performanceTier());
  }

  function setScene(sceneId) {
    ensureRoot();
    if (!root || typeof SceneBackgroundConfig === 'undefined') return false;
    const cfg = SceneBackgroundConfig.get(sceneId);
    if (!cfg) {
      stop();
      return false;
    }

    root.hidden = false;
    root.classList.add('is-active');
    markScreen(true);

    if (currentSceneId === sceneId && activeSlot) {
      // 同场景：仅按需刷新动态档位
      buildFx(activeSlot, cfg, performanceTier());
      if (!paused && visible) setPausedClass(false);
      return true;
    }

    const incoming = activeSlot === slotA ? slotB : slotA;
    const outgoing = activeSlot;

    paintSlot(incoming, cfg);
    incoming.classList.add('is-visible');
    incoming.classList.remove('is-hiding');

    if (outgoing && outgoing !== incoming) {
      fading = true;
      outgoing.classList.add('is-hiding');
      outgoing.classList.remove('is-visible');
      window.setTimeout(() => {
        clearFx(outgoing);
        outgoing.classList.remove('is-hiding');
        outgoing.dataset.sceneId = '';
        fading = false;
      }, CROSSFADE_MS);
    }

    activeSlot = incoming;
    currentSceneId = sceneId;
    if (!visible) pause();
    else resume();
    scheduleIdlePreload(sceneId);
    return true;
  }

  function setSoundscape(soundscapeId) {
    if (typeof SceneBackgroundConfig === 'undefined') return false;
    const id = SceneBackgroundConfig.sceneIdForSoundscape(soundscapeId);
    if (!id) {
      stop();
      return false;
    }
    return setScene(id);
  }

  function stop() {
    clearTimeout(idlePreloadTimer);
    currentSceneId = null;
    markScreen(false);
    if (!root) return;
    root.classList.remove('is-active');
    [slotA, slotB].forEach((slot) => {
      if (!slot) return;
      slot.classList.remove('is-visible', 'is-hiding');
      clearFx(slot);
      slot.dataset.sceneId = '';
    });
    fading = false;
  }

  function isActive() {
    return !!currentSceneId;
  }

  function getSceneId() {
    return currentSceneId;
  }

  return {
    setScene,
    setSoundscape,
    stop,
    pause,
    resume,
    isActive,
    getSceneId,
    performanceTier,
    ensureRoot,
  };
})();
