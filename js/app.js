const screens = {
  home: document.getElementById('home'),
  nap: document.getElementById('scene-nap'),
  camp: document.getElementById('scene-camp'),
  focus: document.getElementById('scene-focus'),
};

let currentScene = null;
const cleanupFns = [];

initIcons();

// 不在首次任意触摸时唤醒 AudioContext，避免车机误切回蓝牙/USB 音乐
// 音频解锁由播放键、调音台、全屏按钮等显式交互负责

function showScene(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  cleanupFns.forEach(fn => fn());
  cleanupFns.length = 0;

  if (name === 'home') {
    screens.home.classList.add('active');
    currentScene = null;
    AudioEngine.stopAll(); // 内部 2.5s 淡出
    Ambient.start('home');
    return;
  }

  screens[name]?.classList.add('active');
  currentScene = name;
  if (name !== 'nap' && name !== 'camp') Ambient.start(name);

  BookmarkHint.tryShow(screens[name], cleanupFns);

  if (name === 'nap') {
    Ambient.stop();
    AuraHeader.onSceneEnter(screens.nap);
    initNap(cleanupFns);
    return;
  }

  if (name === 'camp') {
    Ambient.stop();
    AuraHeader.onSceneEnter(screens.camp);
    initCamp(cleanupFns);
    return;
  }
  if (name === 'focus') {
    AuraHeader.onSceneEnter(screens.focus);
    initFocus(cleanupFns);
    return;
  }
}

document.addEventListener('aerocabin-enter-scene', (e) => {
  const scene = e.detail?.scene;
  if (scene) showScene(scene);
});

document.querySelectorAll('.scene-card[data-scene]').forEach((btn) => {
  const scene = btn.dataset.scene;
  let last = 0;
  let touchHandled = false;
  const go = (e) => {
    if (typeof ProGate !== 'undefined' && ProGate.isSceneLocked(scene)) return;
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - last < 350) return;
    if (e.type === 'click' && touchHandled) {
      touchHandled = false;
      return;
    }
    last = now;
    if (e.type === 'touchend') touchHandled = true;
    showScene(scene);
  };
  btn.addEventListener('touchend', go, { passive: false });
  btn.addEventListener('click', go);
});
document.querySelectorAll('[data-back]').forEach(btn => {
  const back = () => showScene('home');
  btn.addEventListener('click', back);
  btn.addEventListener('touchend', back);
});

showScene('home');
