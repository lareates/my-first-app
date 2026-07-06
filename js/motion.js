/** 全局低频动画调度 — 单循环、多订阅，替代分散 rAF / 无限 CSS 动画 */
const Motion = (() => {
  const handlers = new Set();
  let rafId = null;
  let lastTick = 0;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targetFps = reduceMotion ? 10 : 15;
  const minFrameMs = 1000 / targetFps;

  function frame(now) {
    if (handlers.size === 0) {
      rafId = null;
      return;
    }
    if (now - lastTick >= minFrameMs) {
      lastTick = now;
      handlers.forEach(fn => fn(now));
    }
    rafId = requestAnimationFrame(frame);
  }

  function register(fn) {
    handlers.add(fn);
    if (!rafId) {
      lastTick = 0;
      rafId = requestAnimationFrame(frame);
    }
    return () => {
      handlers.delete(fn);
      if (handlers.size === 0 && rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };
  }

  return { register, targetFps };
})();
