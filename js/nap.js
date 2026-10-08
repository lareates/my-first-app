const NAP_MODES = {
  meditate: {
    title: 'DEEP RELAXATION',
    breathDur: 12,
    meta: ['FREQUENCY / 432HZ', 'ATMOSPHERE / VIOLET', 'INTENSITY / LOW'],
  },
  sleep: {
    title: 'NIGHTFALL SLUMBER',
    breathDur: 12,
    meta: ['FREQUENCY / 1.5HZ', 'ATMOSPHERE / DEEP SPACE', 'INTENSITY / 0.2'],
  },
  breathe: {
    title: 'RHYTHMIC BREATH',
    breathDur: 8,
    meta: ['FREQUENCY / 432HZ', 'ATMOSPHERE / SUNSET', 'INTENSITY / 0.7'],
  },
};

const NAP_SOUND_LABELS = new Proxy({}, {
  get(_, id) {
    return (typeof I18n !== 'undefined') ? I18n.soundscape(id) : id;
  },
});

const MODE_BACKGROUNDS = new Set(['meditate', 'sleep', 'breathe']);
const PHOTO_BACKGROUNDS = new Set(['needles', 'cat']);
const PHOTO_TITLES = {
  needles: 'MISTED PINES',
  cat: 'CANDLE WATCH',
};

function initNap(cleanupFns) {
  const screen = document.getElementById('scene-nap');
  const art = document.getElementById('nap-art');
  const title = document.getElementById('nap-title');
  const timerEl = document.getElementById('nap-session-timer');
  const durationLabelEl = document.getElementById('nap-duration-label');
  const timerBtn = document.getElementById('nap-timer-btn');
  const hintEl = document.getElementById('breath-hint');
  const metaEl = document.getElementById('nap-meta');
  const parallax = document.getElementById('nap-parallax');
  const playBtn = document.getElementById('nap-play');
  const volInput = document.getElementById('nap-volume');
  const volFill = document.getElementById('nap-volume-fill');
  const ringOuter = screen.querySelector('.breath-ring-aura.outer');
  const ringInner = screen.querySelector('.breath-ring-aura.inner');
  const bgBtn = document.getElementById('nap-bg-btn');
  const dawnOverlay = document.getElementById('nap-dawn-overlay');
  const soundscapeEl = document.getElementById('nap-soundscapes');
  const backgroundEl = document.getElementById('nap-backgrounds');

  let napBg = null;

  let mode = 'meditate';
  let background = 'meditate';
  let soundscape = 'woven';
  let playing = false;
  let waking = false;
  const freeDefaultMin = (typeof ProGate !== 'undefined' && !ProGate.isPro()) ? 15 : 20;
  let sessionLengthSec = freeDefaultMin * 60;
  let sessionSec = sessionLengthSec;
  let breathStart = performance.now();
  let sessionInterval;
  let motionOff = null;
  let smoothWave = 0.5;
  let pointerX = 0;
  let pointerY = 0;
  let parallaxTicking = false;
  const ac = new AbortController();
  const typographyEl = screen.querySelector('.aura-typography');

  function isAmbientLayout() {
    return screen.classList.contains('nap-ambient-on') && !screen.classList.contains('nap-has-scene-bg');
  }

  function applyParallax() {
    if (isAmbientLayout()) {
      parallax.style.transform = 'none';
      if (typographyEl) {
        typographyEl.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
      }
      return;
    }
    parallax.style.transform = `translate3d(${pointerX}px, ${-48 + pointerY}px, 0)`;
    if (typographyEl) typographyEl.style.transform = '';
  }

  function renderMeta(cfg) {
    const lines = [
      `SOUNDSCAPE / ${NAP_SOUND_LABELS[soundscape] || soundscape}`,
      ...cfg.meta,
    ];
    metaEl.innerHTML = lines.map(t => `<div class="aura-meta-line">${t}</div>`).join('');
  }

  function syncSoundscapeUi() {
    soundscapeEl?.querySelectorAll('.nap-sound-chip').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.soundscape === soundscape);
    });
  }

  function startPlayback() {
    if (waking) {
      resetWakeState();
      sessionSec = sessionLengthSec;
      updateTimerDisplay();
    }
    if (playing) return;
    playing = true;
    setPlayIcon(playBtn, true);
    playBtn.classList.add('playing');
    breathStart = performance.now();
    attachBreathMotion();
    AudioEngine.startNapAudio(mode, parseInt(volInput.value, 10), soundscape);
    startSession();
  }

  function applySoundscape(sc, autoPlay = false) {
    if (!NAP_SOUND_LABELS[sc]) return;
    soundscape = sc;
    syncSoundscapeUi();
    renderMeta(NAP_MODES[mode]);
    if (autoPlay) {
      if (!playing) startPlayback();
      else AudioEngine.startNapAudio(mode, parseInt(volInput.value, 10), soundscape);
      return;
    }
    if (playing) {
      AudioEngine.startNapAudio(mode, parseInt(volInput.value, 10), soundscape);
    }
  }

  function spawnRain(layer, count, opts) {
    if (!layer || layer.childElementCount) return;
    const frag = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const el = document.createElement('span');
      el.className = 'nap-photo-drop';
      const left = opts.pad + (i / Math.max(1, count - 1)) * (100 - opts.pad * 2)
        + (Math.random() * 2.2 - 1.1);
      const len = opts.minLen + Math.random() * (opts.maxLen - opts.minLen);
      const dur = opts.minDur + Math.random() * (opts.maxDur - opts.minDur);
      el.style.left = `${left.toFixed(2)}%`;
      el.style.height = `${len.toFixed(1)}px`;
      el.style.animationDuration = `${dur.toFixed(2)}s`;
      el.style.animationDelay = `${(-Math.random() * dur).toFixed(2)}s`;
      el.style.setProperty('--drift', `${(Math.random() * opts.drift * 2 - opts.drift).toFixed(2)}px`);
      frag.appendChild(el);
    }
    layer.appendChild(frag);
  }

  function photoLite() {
    let lite = document.documentElement.classList.contains('car-lite');
    if (!lite && typeof isCarBrowser === 'function' && isCarBrowser()) lite = true;
    if (!lite && typeof AudioEngine !== 'undefined' && AudioEngine.LOW_POWER) lite = true;
    if (lite) document.documentElement.classList.add('car-lite');
    return lite;
  }

  function ensurePhotoImage(id) {
    const img = screen.querySelector(`.nap-photo-scene[data-photo-bg="${id}"] .nap-photo-img`);
    const src = img?.dataset.photoSrc;
    if (!img || !src || img.dataset.loaded === '1') return;
    img.dataset.loaded = '1';
    img.style.backgroundImage = `url("${src}")`;
  }

  function ensurePhotoRain() {
    if (photoLite() || screen.dataset.photoRain === '1') return;
    screen.dataset.photoRain = '1';
    spawnRain(screen.querySelector('[data-rain="needles"]'), 22, {
      pad: 2, minLen: 18, maxLen: 42, minDur: 5.5, maxDur: 9.5, drift: 1.8,
    });
    screen.querySelectorAll('.nap-photo-pane[data-pane]').forEach((pane) => {
      spawnRain(pane, pane.classList.contains('pane-br') ? 5 : 7, {
        pad: 6, minLen: 18, maxLen: 40, minDur: 3.8, maxDur: 6.8, drift: 1.6,
      });
    });
  }

  function syncBackgroundUi() {
    backgroundEl?.querySelectorAll('.nap-bg-chip').forEach(btn => {
      const active = btn.dataset.napBg === background;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function sessionTitle() {
    if (PHOTO_BACKGROUNDS.has(background)) return PHOTO_TITLES[background];
    return NAP_MODES[mode]?.title || '';
  }

  function applyVisualMode(m) {
    if (!NAP_MODES[m]) return;
    mode = m;
    const cfg = NAP_MODES[m];
    screen.dataset.auraMode = m;
    if (!waking) title.textContent = sessionTitle();
    screen.style.setProperty('--breath-dur', `${cfg.breathDur}s`);
    renderMeta(cfg);
    if (!isPhotoBackground()) {
      NapAmbient.setMode(m);
      if (!playing) setBreathRest();
    }
    applyParallax();
  }

  function applyBackground(id) {
    if (!MODE_BACKGROUNDS.has(id) && !PHOTO_BACKGROUNDS.has(id)) return;
    background = id;
    syncBackgroundUi();
    if (napBg?.isCustom?.()) napBg.apply('default');

    screen.querySelectorAll('.nap-photo-scene').forEach((el) => {
      el.classList.toggle('is-on', el.dataset.photoBg === id);
    });

    if (PHOTO_BACKGROUNDS.has(id)) {
      photoLite();
      ensurePhotoImage(id);
      ensurePhotoRain();
      screen.classList.add('nap-has-photo-bg');
      screen.dataset.photoBg = id;
      if (!waking) title.textContent = PHOTO_TITLES[id];
      hintEl.style.opacity = '0';
      applyParallax();
      return;
    }

    screen.classList.remove('nap-has-photo-bg');
    delete screen.dataset.photoBg;
    if (!screen.classList.contains('nap-ambient-on')) {
      NapAmbient.start(screen, id);
    }
    applyVisualMode(id);
  }

  function updateTimerDisplay() {
    timerEl.textContent = `${pad(Math.floor(sessionSec / 60))}:${pad(sessionSec % 60)}`;
  }

  function setDuration(min) {
    sessionLengthSec = min * 60;
    sessionSec = sessionLengthSec;
    durationLabelEl.textContent = durationLabel(min);
    updateTimerDisplay();
  }

  function setBreathVisual(wave) {
    smoothWave += (wave - smoothWave) * 0.14;
    const w = smoothWave;
    const outerScale = 1.2 + 0.08 * w;
    const innerScale = 1.05 + 0.06 * (1 - w);
    const artScale = 1 + 0.05 * Math.sin(w * Math.PI);
    ringOuter.style.transform = `translate3d(0,0,0) scale(${outerScale})`;
    ringInner.style.transform = `translate3d(0,0,0) scale(${innerScale})`;
    ringOuter.style.opacity = String(0.65 + 0.35 * w);
    ringInner.style.opacity = String(0.7 + 0.3 * (1 - w));
    art.style.transform = `translate3d(0,0,0) scale(${artScale})`;
  }

  function isPhotoBackground() {
    return screen.classList.contains('nap-has-photo-bg');
  }

  function setBreathRest() {
    setBreathVisual(0.5);
    hintEl.style.opacity = mode === 'breathe' && !isPhotoBackground() ? '0.35' : '0';
  }

  function updateBreathMotion(now) {
    if (!playing) return;
    const visualDur = (NAP_MODES[mode]?.breathDur || 12) * 1000;
    const audioDur = (soundscape === 'wovenBreath' ? 8 : 12) * 1000;
    const elapsedVisual = (now - breathStart) % visualDur;
    const elapsedAudio = (now - breathStart) % audioDur;
    const audioHalf = audioDur / 2;
    const audioPhase = elapsedAudio < audioHalf
      ? elapsedAudio / audioHalf
      : 1 - (elapsedAudio - audioHalf) / audioHalf;
    const wave = 0.5 - 0.5 * Math.cos((elapsedVisual / visualDur) * Math.PI * 2);
    AudioEngine.setBreathPhase(audioPhase);
    setBreathVisual(wave);
    if (mode === 'breathe' && !isPhotoBackground()) {
      const inhale = elapsedVisual < visualDur / 2;
      const visualPhase = inhale
        ? elapsedVisual / (visualDur / 2)
        : 1 - (elapsedVisual - visualDur / 2) / (visualDur / 2);
      hintEl.textContent = inhale ? I18n.t('breathIn') : I18n.t('breathOut');
      hintEl.style.opacity = String(0.5 + visualPhase * 0.5);
    }
  }

  function attachBreathMotion() {
    if (motionOff) return;
    motionOff = Motion.register(updateBreathMotion);
  }

  function detachBreathMotion() {
    motionOff?.();
    motionOff = null;
    setBreathRest();
  }

  function startSession() {
    if (sessionInterval) return;
    sessionInterval = setInterval(() => {
      if (!playing || waking) return;
      sessionSec--;
      if (sessionSec <= 0) {
        sessionSec = 0;
        updateTimerDisplay();
        triggerGentleWake();
        return;
      }
      updateTimerDisplay();
    }, 1000);
  }

  function triggerGentleWake() {
    if (waking) return;
    waking = true;
    playing = false;
    setPlayIcon(playBtn, false);
    playBtn.classList.remove('playing');
    detachBreathMotion();

    const lowPower = typeof AudioEngine !== 'undefined' && AudioEngine.LOW_POWER;
    if (lowPower) {
      screen.classList.add('nap-wake-lite');
      napBg?.pauseMotion?.();
    }

    screen.classList.add('nap-waking');
    title.textContent = I18n.t('gentleWakeTitle');
    hintEl.textContent = I18n.t('gentleWakeHint');
    hintEl.style.opacity = '0.85';

    AudioEngine.fadeOutNapAudio(lowPower ? 4 : 8);
    if (lowPower) {
      dawnOverlay?.classList.add('active');
      setTimeout(() => AudioEngine.playBirdChorus(), 600);
    } else {
      requestAnimationFrame(() => dawnOverlay?.classList.add('active'));
      setTimeout(() => AudioEngine.playBirdChorus(), 2000);
    }
  }

  function resetWakeState() {
    waking = false;
    screen.classList.remove('nap-waking', 'nap-wake-lite');
    dawnOverlay?.classList.remove('active');
    title.textContent = sessionTitle();
    hintEl.style.opacity = mode === 'breathe' && !isPhotoBackground() ? '0.35' : '0';
    if (mode === 'breathe' && !isPhotoBackground()) hintEl.textContent = I18n.t('breathIn');
  }

  function togglePlay() {
    if (waking) {
      resetWakeState();
      sessionSec = sessionLengthSec;
      updateTimerDisplay();
    }
    playing = !playing;
    setPlayIcon(playBtn, playing);
    playBtn.classList.toggle('playing', playing);
    if (playing) {
      breathStart = performance.now();
      attachBreathMotion();
      AudioEngine.startNapAudio(mode, parseInt(volInput.value, 10), soundscape);
      startSession();
    } else {
      detachBreathMotion();
      AudioEngine.stopNapAudio();
    }
  }

  const timerPicker = createTimerPicker({
    triggerEl: timerBtn,
    defaultMin: freeDefaultMin,
    bindTrigger: false,
    onChange: (min) => {
      if (waking) resetWakeState();
      setDuration(min);
    },
    signal: ac.signal,
  });
  setDuration(freeDefaultMin);
  if (typeof ProGate !== 'undefined') ProGate.syncSoundscapeLocks();

  function closeNapSheets() {
    napBg?.closeSheet?.();
    closeAllSheets();
  }

  bindCarTap(timerBtn, () => {
    markTimerTap();
    closeNapSheets();
    timerPicker.open();
  }, { signal: ac.signal });

  timerBtn.addEventListener('touchstart', (e) => {
    markTimerTap();
    e.stopPropagation();
  }, { capture: true, signal: ac.signal, passive: true });

  bindCarPlay(playBtn, togglePlay);

  const onSoundscapeUnlock = (e) => {
    const sc = e.detail?.id;
    if (!sc || !screen.classList.contains('active')) return;
    unlockAndPlay(() => applySoundscape(sc, true));
  };
  document.addEventListener('aerocabin-soundscape-select', onSoundscapeUnlock);
  cleanupFns.push(() => document.removeEventListener('aerocabin-soundscape-select', onSoundscapeUnlock));

  let lastPanelTap = 0;
  let panelTouchHandled = false;

  function handleNapPanelTap(e) {
    if (e.type === 'click' && panelTouchHandled) {
      panelTouchHandled = false;
      return;
    }
    if (e.type === 'touchend') panelTouchHandled = true;

    const bgBtnTap = e.target.closest('button[data-nap-bg]');
    const soundBtn = e.target.closest('button[data-soundscape]');
    if (!bgBtnTap && !soundBtn) return;

    const now = Date.now();
    if (now - lastPanelTap < 400) return;
    lastPanelTap = now;

    e.preventDefault();
    e.stopPropagation();
    closeNapSheets();

    if (bgBtnTap) {
      applyBackground(bgBtnTap.dataset.napBg);
      return;
    }

    const sc = soundBtn.dataset.soundscape;
    const label = NAP_SOUND_LABELS[sc] || sc;
    if (typeof ProGate !== 'undefined' && ProGate.isSoundscapeLocked(sc)) {
      ProGate.requirePro(label, () => unlockAndPlay(() => applySoundscape(sc, true)));
      return;
    }
    unlockAndPlay(() => applySoundscape(sc, true));
  }

  screen.addEventListener('click', handleNapPanelTap, { signal: ac.signal });
  screen.addEventListener('touchend', handleNapPanelTap, { signal: ac.signal, passive: false });

  initIcons();

  // 壁纸面板打开时 z-index 更高，需在捕获阶段拦截声景/模式点击
  document.addEventListener('click', (e) => {
    if (!napBg?.isSheetOpen?.()) return;
    if (!e.target.closest('#scene-nap')) return;
    const bgBtnTap = e.target.closest('button[data-nap-bg]');
    const soundBtn = e.target.closest('button[data-soundscape]');
    if (!bgBtnTap && !soundBtn) return;
    handleNapPanelTap(e);
  }, { capture: true, signal: ac.signal });

  document.addEventListener('touchend', (e) => {
    if (!napBg?.isSheetOpen?.()) return;
    if (!e.target.closest('#scene-nap')) return;
    const bgBtnTap = e.target.closest('button[data-nap-bg]');
    const soundBtn = e.target.closest('button[data-soundscape]');
    if (!bgBtnTap && !soundBtn) return;
    handleNapPanelTap(e);
  }, { capture: true, signal: ac.signal, passive: false });

  volInput.addEventListener('input', () => {
    volFill.style.width = `${volInput.value}%`;
    AudioEngine.setNapVolume(parseInt(volInput.value, 10));
  }, { signal: ac.signal });

  const onMove = (e) => {
    pointerX = (e.clientX / window.innerWidth - 0.5) * 10;
    pointerY = (e.clientY / window.innerHeight - 0.5) * 10;
    if (parallaxTicking) return;
    parallaxTicking = true;
    requestAnimationFrame(() => {
      applyParallax();
      parallaxTicking = false;
    });
  };
  document.addEventListener('mousemove', onMove, { signal: ac.signal });

  napBg = initNapBackground(screen, bgBtn, cleanupFns);
  applyBackground('meditate');
  syncSoundscapeUi();
  setBreathRest();
  applyParallax();

  I18n.onChange(() => {
    renderMeta(NAP_MODES[mode]);
    durationLabelEl.textContent = durationLabel(Math.round(sessionLengthSec / 60));
    if (typeof ProGate !== 'undefined') {
      ProGate.syncSoundscapeLocks();
      I18n.applyDom(document.getElementById('nap-soundscapes'));
      I18n.applyDom(backgroundEl);
    }
    if (!playing && !waking && mode === 'breathe' && !isPhotoBackground()) {
      hintEl.textContent = I18n.t('breathIn');
    }
  });

  cleanupFns.push(() => {
    ac.abort();
    detachBreathMotion();
    timerPicker.destroy();
    clearInterval(sessionInterval);
    AudioEngine.stopNapAudio();
    NapAmbient.stop();
  });
}
