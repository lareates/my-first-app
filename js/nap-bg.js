const NAP_SCENE_BACKGROUNDS = [
  { id: 'default', thumb: null },
  { id: 'garden', image: 'assets/backgrounds/garden.png' },
  { id: 'coastal', image: 'assets/backgrounds/coastal.png' },
  { id: 'dream', image: 'assets/backgrounds/dream.png' },
];

function initNapBackground(screen, triggerEl, cleanupFns) {
  const stack = document.getElementById('nap-scene-bg');
  if (!stack) return { getId: () => 'default', isCustom: () => false };

  const STORAGE_KEY = 'nap-scene-bg';
  let currentId = localStorage.getItem(STORAGE_KEY) || 'default';
  let motionOff = null;
  let particleCtx = null;
  let particles = [];
  const ac = new AbortController();

  const sheet = document.createElement('div');
  sheet.className = 'timer-sheet bg-sheet';
  sheet.innerHTML = `
    <div class="timer-sheet-backdrop" data-close></div>
    <div class="timer-sheet-panel" role="dialog" aria-modal="true" aria-label="">
      <div class="timer-sheet-handle"></div>
      <p class="timer-sheet-title"></p>
      <p class="timer-sheet-sub"></p>
      <div class="bg-sheet-grid"></div>
    </div>
  `;
  document.body.appendChild(sheet);

  const grid = sheet.querySelector('.bg-sheet-grid');
  const titleEl = sheet.querySelector('.timer-sheet-title');
  const subEl = sheet.querySelector('.timer-sheet-sub');
  const panelEl = sheet.querySelector('.timer-sheet-panel');

  NAP_SCENE_BACKGROUNDS.forEach(bg => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bg-sheet-card';
    btn.dataset.sceneBg = bg.id;
    const thumbInner = bg.image
      ? `<img class="bg-sheet-thumb" src="${bg.image}" alt="">`
      : '<span class="bg-sheet-thumb bg-sheet-thumb-default"></span>';
    btn.innerHTML = `
      ${thumbInner}
      <span class="bg-sheet-card-label"></span>
      <span class="bg-sheet-card-desc"></span>
    `;
    grid.appendChild(btn);
  });

  function applySheetCopy() {
    if (typeof I18n === 'undefined') return;
    titleEl.textContent = I18n.t('napBgTitle');
    subEl.textContent = I18n.t('napBgSub');
    panelEl.setAttribute('aria-label', I18n.t('napBgTitle'));
    grid.querySelectorAll('.bg-sheet-card').forEach((card) => {
      const copy = I18n.napBgCopy(card.dataset.sceneBg);
      card.querySelector('.bg-sheet-card-label').textContent = copy.label;
      card.querySelector('.bg-sheet-card-desc').textContent = copy.desc;
    });
  }

  function isCustom() {
    return currentId !== 'default';
  }

  function syncActiveCards() {
    grid.querySelectorAll('.bg-sheet-card').forEach(card => {
      card.classList.toggle('active', card.dataset.sceneBg === currentId);
    });
    stack.querySelectorAll('.nap-scene-bg-layer').forEach(layer => {
      layer.classList.toggle('active', layer.dataset.sceneBg === currentId);
    });
    screen.classList.toggle('nap-has-scene-bg', isCustom());
    screen.dataset.napSceneBg = currentId;
  }

  function ensureParticles() {
    const layer = stack.querySelector(`[data-scene-bg="${currentId}"]`);
    if (!layer) return null;
    let canvas = layer.querySelector('.nap-bg-particles');
    if (!canvas) return null;
    if (!particleCtx) {
      particleCtx = canvas.getContext('2d');
      particles = Array.from({ length: 18 }, (_, i) => ({
        x: Math.random(),
        y: Math.random(),
        r: 1 + Math.random() * 2,
        speed: 0.02 + Math.random() * 0.04,
        phase: Math.random() * Math.PI * 2,
        i,
      }));
    }
    return { canvas, layer };
  }

  function drawParticles(now) {
    if (!isCustom()) return;
    const pack = ensureParticles();
    if (!pack) return;
    const { canvas } = pack;
    const w = canvas.width = canvas.offsetWidth;
    const h = canvas.height = canvas.offsetHeight;
    if (!w || !h) return;
    const t = now / 1000;
    particleCtx.clearRect(0, 0, w, h);
    particles.forEach(p => {
      const x = ((p.x + Math.sin(t * p.speed + p.phase) * 0.03) % 1) * w;
      const y = ((p.y - t * p.speed * 0.04 + p.phase) % 1) * h;
      const a = 0.08 + 0.12 * (0.5 + 0.5 * Math.sin(t * 0.8 + p.i));
      particleCtx.beginPath();
      particleCtx.arc(x, y, p.r, 0, Math.PI * 2);
      particleCtx.fillStyle = `rgba(255,255,255,${a})`;
      particleCtx.fill();
    });
  }

  function updatePhotoMotion(now) {
    if (!isCustom()) return;
    const layer = stack.querySelector(`[data-scene-bg="${currentId}"]`);
    const photo = layer?.querySelector('.nap-bg-photo');
    if (!photo) return;
    const t = now / 1000;
    const scale = 1 + Math.sin(t * 0.1) * 0.008;
    const x = Math.sin(t * 0.07) * 5;
    const y = Math.cos(t * 0.05) * 4;
    photo.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
    drawParticles(now);
  }

  function attachMotion() {
    if (motionOff || !isCustom()) return;
    motionOff = Motion.registerLow(updatePhotoMotion);
  }

  function detachMotion() {
    motionOff?.();
    motionOff = null;
    particleCtx = null;
  }

  function syncAmbient() {
    const screen = document.getElementById('scene-nap');
    const napMode = screen?.dataset.auraMode || 'meditate';
    if (isCustom()) {
      NapAmbient.stop();
      Ambient.stop();
    } else {
      Ambient.stop();
      NapAmbient.start(screen, napMode);
    }
  }

  function apply(id, persist = true) {
    if (!NAP_SCENE_BACKGROUNDS.some(b => b.id === id)) id = 'default';
    currentId = id;
    if (persist) localStorage.setItem(STORAGE_KEY, id);
    syncActiveCards();
    detachMotion();
    attachMotion();
    syncAmbient();
  }

  function openSheet() {
    applySheetCopy();
    syncActiveCards();
    sheet.classList.add('open');
    document.body.classList.add('timer-sheet-open');
  }

  function closeSheet() {
    sheet.classList.remove('open');
    document.body.classList.remove('timer-sheet-open');
  }

  triggerEl.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openSheet();
  }, { signal: ac.signal });

  sheet.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) {
      closeSheet();
      return;
    }
    const card = e.target.closest('.bg-sheet-card');
    if (card) {
      apply(card.dataset.sceneBg);
      closeSheet();
    }
  }, { signal: ac.signal });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) closeSheet();
  }, { signal: ac.signal });

  apply(currentId, false);
  applySheetCopy();
  if (typeof I18n !== 'undefined') I18n.onChange(applySheetCopy);

  cleanupFns.push(() => {
    ac.abort();
    detachMotion();
    closeSheet();
    sheet.remove();
    NapAmbient.stop();
    screen.classList.remove('nap-has-scene-bg', 'nap-ambient-on');
  });

  return {
    getId: () => currentId,
    isCustom,
    apply,
  };
}
