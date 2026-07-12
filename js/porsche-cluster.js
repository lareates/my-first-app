/**
 * Porsche 911 · 五连仪表盘
 * 秒针转速表 / 电子时钟 / 番茄·专注·系统三表
 */
const PorscheCluster = (() => {
  let root = null;
  let needles = [];
  let ticking = false;
  let ignition = false;
  let rafOff = null;
  let lastSec = -1;
  let getFocusState = () => ({
    timerMode: 'countdown',
    timerSeconds: 0,
    timerInitial: 1200,
    timerRunning: false,
    todayMinutes: 0,
  });

  const SWEEP = 270; // 可视扫角
  const ZERO = -135; // 零位（左下）

  function degFromRatio(ratio) {
    const r = Math.max(0, Math.min(1, ratio));
    return ZERO + r * SWEEP;
  }

  function buildTicks(container, count = 60, majorEvery = 10) {
    if (!container || container.dataset.built) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i <= count; i++) {
      const ratio = i / count;
      const angle = degFromRatio(ratio);
      const tick = document.createElement('span');
      const isMajor = i % majorEvery === 0;
      tick.className = `porsche-tick${isMajor ? ' major' : ''}`;
      tick.style.transform = `rotate(${angle}deg)`;
      frag.appendChild(tick);
    }
    // 仅大表盘标注数字，避免小表盘拥挤
    if (count >= 48) {
      for (let i = 0; i <= count; i += majorEvery) {
        const ratio = i / count;
        const angle = degFromRatio(ratio);
        const num = document.createElement('span');
        num.className = 'porsche-tick-num';
        num.textContent = String(i);
        const rad = (angle - 90) * Math.PI / 180;
        const r = 32;
        num.style.left = `calc(50% + ${Math.cos(rad) * r}%)`;
        num.style.top = `calc(50% + ${Math.sin(rad) * r}%)`;
        num.style.transform = 'translate(-50%, -50%)';
        frag.appendChild(num);
      }
    }
    container.appendChild(frag);
    container.dataset.built = '1';
  }

  function setNeedle(el, deg, { instant = false, tick = false } = {}) {
    if (!el) return;
    if (instant) {
      el.style.transition = 'none';
      el.style.transform = `rotate(${deg}deg)`;
      void el.offsetWidth;
      el.style.transition = '';
    } else {
      el.style.transform = `rotate(${deg}deg)`;
    }
    el.classList.toggle('tick-jitter', !!tick);
    if (tick) {
      clearTimeout(el._tickTimer);
      el._tickTimer = setTimeout(() => el.classList.remove('tick-jitter'), 90);
    }
  }

  function runIgnition() {
    if (!root || ignition) return;
    ignition = true;
    root.classList.add('igniting');
    const list = root.querySelectorAll('.porsche-needle');
    list.forEach(n => {
      n.style.transition = 'transform 1.5s cubic-bezier(0.2, 0.8, 0.2, 1)';
      setNeedle(n, degFromRatio(1));
    });

    setTimeout(() => {
      list.forEach(n => {
        n.style.transition = 'transform 0.85s cubic-bezier(0.33, 1, 0.68, 1)';
        setNeedle(n, degFromRatio(0));
      });
      setTimeout(() => {
        list.forEach(n => {
          n.style.transition = 'none';
        });
        root.classList.remove('igniting');
        ignition = false;
        lastSec = -1;
        renderLive(true);
      }, 900);
    }, 1550);
  }

  function tomatoRatio(state) {
    if (state.timerMode === 'stopwatch') {
      return Math.min(1, state.timerSeconds / (25 * 60));
    }
    const init = state.timerInitial || 1;
    const left = Math.max(0, state.timerSeconds);
    return Math.max(0, Math.min(1, 1 - left / init));
  }

  function todayRatio(mins) {
    return Math.max(0, Math.min(1, mins / 120));
  }

  function sysRatio() {
    // 环境感知占位：用内存近似（不可用则用时间波动）
    try {
      if (performance.memory) {
        const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
        return Math.max(0.15, Math.min(0.92, usedJSHeapSize / jsHeapSizeLimit));
      }
    } catch {}
    const t = Date.now() / 1000;
    return 0.35 + 0.15 * Math.sin(t / 17);
  }

  function renderLive(force) {
    if (!root || !root.classList.contains('active') || ignition) return;
    const now = new Date();
    const state = getFocusState();

    // 中央转速表 → 秒针（含毫秒微动 + 整秒 Tick）
    const sec = now.getSeconds() + now.getMilliseconds() / 1000;
    const tach = root.querySelector('[data-gauge="seconds"] .porsche-needle');
    const whole = now.getSeconds();
    setNeedle(tach, degFromRatio(sec / 60), { tick: whole !== lastSec });
    if (whole !== lastSec) lastSec = whole;

    // 时速表 → 数字时钟
    const clockEl = root.querySelector('[data-gauge="clock"] .porsche-digital');
    if (clockEl) {
      clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
    const clockNeedle = root.querySelector('[data-gauge="clock"] .porsche-needle');
    const dayProgress = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) / 86400;
    setNeedle(clockNeedle, degFromRatio(dayProgress));

    // 番茄进度
    const tomatoNeedle = root.querySelector('[data-gauge="tomato"] .porsche-needle');
    const tomatoRead = root.querySelector('[data-gauge="tomato"] .porsche-mini-read');
    const tr = tomatoRatio(state);
    setNeedle(tomatoNeedle, degFromRatio(tr));
    if (tomatoRead) {
      tomatoRead.textContent = state.timerRunning
        ? formatFocusShort(state.timerSeconds)
        : 'READY';
    }

    // 今日专注
    const todayNeedle = root.querySelector('[data-gauge="today"] .porsche-needle');
    const todayRead = root.querySelector('[data-gauge="today"] .porsche-mini-read');
    setNeedle(todayNeedle, degFromRatio(todayRatio(state.todayMinutes)));
    if (todayRead) todayRead.textContent = `${state.todayMinutes}m`;

    // 系统 / 环境
    const sysNeedle = root.querySelector('[data-gauge="sys"] .porsche-needle');
    const sysRead = root.querySelector('[data-gauge="sys"] .porsche-mini-read');
    const sr = sysRatio();
    setNeedle(sysNeedle, degFromRatio(sr));
    if (sysRead) sysRead.textContent = `${Math.round(sr * 100)}%`;
  }

  function formatFocusShort(s) {
    const m = Math.floor(Math.abs(s) / 60);
    const sec = Math.abs(s) % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function startLoop() {
    if (ticking) return;
    ticking = true;
    rafOff = Motion.register((now) => {
      renderLive(false);
    });
  }

  function stopLoop() {
    ticking = false;
    rafOff?.();
    rafOff = null;
  }

  function show() {
    if (!root) return;
    root.classList.add('active');
    root.hidden = false;
    root.setAttribute('aria-hidden', 'false');
    startLoop();
    runIgnition();
  }

  function hide() {
    if (!root) return;
    root.classList.remove('active', 'igniting');
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    ignition = false;
    stopLoop();
  }

  function mount(container) {
    if (!container) return;
    root = container;
    root.querySelectorAll('.porsche-ticks').forEach(el => {
      const count = parseInt(el.dataset.ticks || '60', 10);
      const major = parseInt(el.dataset.major || '10', 10);
      buildTicks(el, count, major);
    });
    needles = [...root.querySelectorAll('.porsche-needle')];
    needles.forEach(n => setNeedle(n, degFromRatio(0), { instant: true }));
  }

  function init({ clusterEl, stateGetter, cleanupFns }) {
    getFocusState = stateGetter || getFocusState;
    mount(clusterEl);
    hide();
    cleanupFns?.push(() => {
      stopLoop();
    });
  }

  return { init, show, hide, renderLive, runIgnition };
})();
