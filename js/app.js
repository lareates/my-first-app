const screens = {
  home: document.getElementById('home'),
  nap: document.getElementById('scene-nap'),
  camp: document.getElementById('scene-camp'),
  focus: document.getElementById('scene-focus'),
};

let currentScene = null;
const cleanupFns = [];

function showScene(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  cleanupFns.forEach(fn => fn());
  cleanupFns.length = 0;

  if (name === 'home') {
    screens.home.classList.add('active');
    currentScene = null;
    AudioEngine.stopAll();
    return;
  }

  screens[name]?.classList.add('active');
  currentScene = name;

  if (name === 'nap') initNap(cleanupFns);
  if (name === 'camp') initCamp(cleanupFns);
  if (name === 'focus') initFocus(cleanupFns);
}

document.querySelectorAll('[data-scene]').forEach(btn => {
  btn.addEventListener('click', () => showScene(btn.dataset.scene));
});
document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => showScene('home'));
});

showScene('home');
