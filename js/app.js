const screens = {
  home: document.getElementById('home'),
  nap: document.getElementById('scene-nap'),
  camp: document.getElementById('scene-camp'),
  focus: document.getElementById('scene-focus'),
};

let currentScene = null;
const cleanupFns = [];

initIcons();

['touchstart', 'click'].forEach(evt => {
  document.addEventListener(evt, () => AudioEngine.resume(), { once: true, passive: true });
});

function showScene(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  cleanupFns.forEach(fn => fn());
  cleanupFns.length = 0;

  if (name === 'home') {
    screens.home.classList.add('active');
    currentScene = null;
    AudioEngine.stopAll();
    Ambient.start('home');
    return;
  }

  screens[name]?.classList.add('active');
  currentScene = name;
  if (name !== 'nap' && name !== 'camp') Ambient.start(name);

  BookmarkHint.tryShow(screens[name], cleanupFns);

  if (name === 'nap') {
    Ambient.stop();
    initNap(cleanupFns);
    return;
  }

  if (name === 'camp') {
    Ambient.stop();
    initCamp(cleanupFns);
    return;
  }
  if (name === 'focus') initFocus(cleanupFns);
}

document.querySelectorAll('[data-scene]').forEach(btn => {
  const go = () => showScene(btn.dataset.scene);
  btn.addEventListener('click', go);
  btn.addEventListener('touchend', go);
});
document.querySelectorAll('[data-back]').forEach(btn => {
  const back = () => showScene('home');
  btn.addEventListener('click', back);
  btn.addEventListener('touchend', back);
});

showScene('home');
