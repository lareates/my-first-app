/**
 * 车内打盹 · 纯 CSS 三模式场景切换
 */
const NapAmbient = (() => {
  let active = false;

  function setMode(m) {
    const screen = document.getElementById('scene-nap');
    if (!screen) return;
    const mode = m === 'sleep' || m === 'breathe' ? m : 'meditate';
    screen.dataset.auraMode = mode;
  }

  function start(screen, initialMode = 'meditate') {
    if (!screen) screen = document.getElementById('scene-nap');
    if (!screen) return;
    active = true;
    screen.classList.add('nap-ambient-on');
    setMode(initialMode);
  }

  function stop() {
    const screen = document.getElementById('scene-nap');
    if (!screen) return;
    active = false;
    screen.classList.remove('nap-ambient-on');
  }

  return { start, stop, setMode };
})();
