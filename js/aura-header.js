/** 休息 / 露营 / 充电：按钮常驻；顶栏底色仅在上滑时显示 */
const AuraHeader = (() => {
  const SCENE_IDS = ['scene-nap', 'scene-camp', 'scene-focus'];
  const SCRIM_CLASS = 'aura-header-scrim-visible';
  const HIDE_DELAY_MS = 4500;
  const SWIPE_MIN_PX = 52;
  const SCRIM_PREVIEW_PX = 28;

  let hideTimer = null;
  /** @type {{ x: number, y: number } | null} */
  let touchStart = null;

  function isImmersive(screen) {
    return screen && SCENE_IDS.includes(screen.id);
  }

  function clearHideTimer() {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  }

  function hideScrim(screen) {
    if (!isImmersive(screen)) return;
    screen.classList.remove(SCRIM_CLASS);
    clearHideTimer();
  }

  function showScrim(screen, { autoHide = true, delay = HIDE_DELAY_MS } = {}) {
    if (!isImmersive(screen) || !screen.classList.contains('active')) return;
    screen.classList.add(SCRIM_CLASS);
    clearHideTimer();
    if (autoHide) hideTimer = window.setTimeout(() => hideScrim(screen), delay);
  }

  function shouldIgnoreTouchTarget(target) {
    return !!target.closest(
      '.aura-horizon, .horizon-bar, .bg-picker, .timer-sheet, .focus-paywall, .bookmark-hint'
    );
  }

  function bindScreen(screen) {
    if (!screen || screen.dataset.auraHeaderBound === '1') return;
    screen.dataset.auraHeaderBound = '1';
    hideScrim(screen);

    screen.addEventListener('touchstart', (e) => {
      if (!screen.classList.contains('active')) return;
      if (shouldIgnoreTouchTarget(e.target)) return;
      const t = e.changedTouches[0];
      touchStart = { x: t.clientX, y: t.clientY };
    }, { passive: true });

    screen.addEventListener('touchmove', (e) => {
      if (!screen.classList.contains('active') || !touchStart) return;
      if (shouldIgnoreTouchTarget(e.target)) return;
      const t = e.changedTouches[0];
      const dy = t.clientY - touchStart.y;
      if (dy < -SCRIM_PREVIEW_PX) showScrim(screen, { autoHide: false });
      else if (dy > SCRIM_PREVIEW_PX) hideScrim(screen);
    }, { passive: true });

    screen.addEventListener('touchend', (e) => {
      if (!screen.classList.contains('active') || !touchStart) return;
      if (shouldIgnoreTouchTarget(e.target)) {
        touchStart = null;
        return;
      }
      const t = e.changedTouches[0];
      const dy = t.clientY - touchStart.y;
      const dx = t.clientX - touchStart.x;
      touchStart = null;
      if (Math.abs(dy) < SWIPE_MIN_PX || Math.abs(dy) < Math.abs(dx) * 1.1) {
        hideScrim(screen);
        return;
      }
      if (dy < 0) showScrim(screen);
      else hideScrim(screen);
    }, { passive: true });

    screen.addEventListener('wheel', (e) => {
      if (!screen.classList.contains('active')) return;
      if (e.deltaY < -8) showScrim(screen);
      else if (e.deltaY > 12) hideScrim(screen);
    }, { passive: true });

    if (screen.id === 'scene-focus') {
      screen.addEventListener('scroll', () => {
        if (!screen.classList.contains('active')) return;
        if (screen.scrollTop > 12) showScrim(screen);
        else hideScrim(screen);
      }, { passive: true });
    }
  }

  function onSceneEnter(screen) {
    hideScrim(screen);
  }

  function init() {
    SCENE_IDS.forEach((id) => bindScreen(document.getElementById(id)));
  }

  return { init, showScrim, hideScrim, onSceneEnter, isImmersive };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AuraHeader.init());
} else {
  AuraHeader.init();
}
