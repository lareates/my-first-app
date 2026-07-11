/** 全局动画调度 — 高帧率视觉 + 低频背景分层，接近 Endel 丝滑感 */
const Motion = (() => {
  const handlers = new Set();
  const lowHandlers = new Set();
  let rafId = null;
  let lastHigh = 0;
  let lastLow = 0;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const highFps = reduceMotion ? 12 : isCoarse ? 30 : 60;
  const lowFps = reduceMotion ? 8 : 15;
  const minHighMs = 1000 / highFps;
  const minLowMs = 1000 / lowFps;

  function frame(now) {
    if (handlers.size === 0 && lowHandlers.size === 0) {
      rafId = null;
      return;
    }

    if (handlers.size && now - lastHigh >= minHighMs) {
      lastHigh = now;
      handlers.forEach(fn => fn(now));
    }
    if (lowHandlers.size && now - lastLow >= minLowMs) {
      lastLow = now;
      lowHandlers.forEach(fn => fn(now));
    }

    rafId = requestAnimationFrame(frame);
  }

  function ensureLoop() {
    if (!rafId) {
      lastHigh = 0;
      lastLow = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  function register(fn) {
    handlers.add(fn);
    ensureLoop();
    return () => {
      handlers.delete(fn);
      if (handlers.size === 0 && lowHandlers.size === 0 && rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }

  function registerLow(fn) {
    lowHandlers.add(fn);
    ensureLoop();
    return () => {
      lowHandlers.delete(fn);
      if (handlers.size === 0 && lowHandlers.size === 0 && rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }

  return { register, registerLow, highFps, lowFps };
})();
