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

const NAP_SOUND_LABELS = {
  woven: '氛围织境',
  rain: '春雨车顶',
  stream: '溪水潺潺',
  waves: '潮汐海滨',
  wind: '窗外微风',
  fireplace: '壁炉暖火',
  birds: '深林鸟鸣',
  meditation1: '心灵修复',
  meditation2: '星空风吟',
  soundbath: '高保真音疗',
  tibetan: '颂钵音疗',
};

const MODE_SOUND_MAP = {
  meditate: 'woven',
  breathe: 'woven',
  sleep: 'woven',
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

  let napBg = null;

  let mode = 'meditate';
  let soundscape = MODE_SOUND_MAP.meditate;
  let playing = false;
  let waking = false;
  let sessionLengthSec = 20 * 60;
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

  function applyMode(m) {
    if (!NAP_MODES[m]) return;
    mode = m;
    const cfg = NAP_MODES[m];
    screen.dataset.auraMode = m;
    title.textContent = cfg.title;
    sessionSec = sessionLengthSec;
    updateTimerDisplay();
    screen.style.setProperty('--breath-dur', `${cfg.breathDur}s`);

    if (!napBg?.isCustom()) {
      NapAmbient.setMode(m);
    }

    soundscape = MODE_SOUND_MAP[m];
    syncSoundscapeUi();
    renderMeta(cfg);

    screen.querySelectorAll('#nap-modes .horizon-mode').forEach(btn => {
      const active = btn.dataset.napMode === m;
      btn.classList.toggle('active', active);
      btn.classList.toggle('mode-secondary', active && m === 'sleep');
    });

    if (playing) {
      AudioEngine.startNapAudio(m, parseInt(volInput.value, 10), soundscape);
    }
    applyParallax();
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

  function setBreathRest() {
    setBreathVisual(0.5);
    hintEl.style.opacity = mode === 'breathe' ? '0.35' : '0';
  }

  function updateBreathMotion(now) {
    if (!playing) return;
    const cfg = NAP_MODES[mode];
    const cycle = cfg.breathDur * 1000;
    const elapsed = (now - breathStart) % cycle;
    const half = cycle / 2;
    let phase;
    let inhale;
    if (elapsed < half) {
      phase = elapsed / half;
      inhale = true;
    } else {
      phase = 1 - (elapsed - half) / half;
      inhale = false;
    }
    const wave = 0.5 - 0.5 * Math.cos((elapsed / cycle) * Math.PI * 2);
    AudioEngine.setBreathPhase(phase);
    setBreathVisual(wave);
    if (mode === 'breathe') {
      hintEl.textContent = inhale ? '吸气' : '呼气';
      hintEl.style.opacity = String(0.5 + phase * 0.5);
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
    screen.classList.add('nap-waking');
    title.textContent = 'GENTLE WAKE';
    hintEl.textContent = '温和唤醒 · 晨光渐起';
    hintEl.style.opacity = '0.85';

    AudioEngine.fadeOutNapAudio(8);
    requestAnimationFrame(() => dawnOverlay?.classList.add('active'));

    setTimeout(() => AudioEngine.playBirdChorus(), 2000);
    setTimeout(() => AudioEngine.playBirdChorus(), 4500);
  }

  function resetWakeState() {
    waking = false;
    screen.classList.remove('nap-waking');
    dawnOverlay?.classList.remove('active');
    const cfg = NAP_MODES[mode];
    title.textContent = cfg.title;
    hintEl.style.opacity = mode === 'breathe' ? '0.35' : '0';
    if (mode === 'breathe') hintEl.textContent = '吸气';
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
    defaultMin: 20,
    onChange: (min) => {
      if (waking) resetWakeState();
      setDuration(min);
    },
    signal: ac.signal,
  });

  bindCarPlay(playBtn, togglePlay);

  napBg = initNapBackground(screen, bgBtn, cleanupFns);
  initIcons();

  screen.addEventListener('click', (e) => {
    const modeBtn = e.target.closest('button[data-nap-mode]');
    if (modeBtn) {
      e.preventDefault();
      applyMode(modeBtn.dataset.napMode);
      return;
    }
    const soundBtn = e.target.closest('button[data-soundscape]');
    if (soundBtn) {
      e.preventDefault();
      unlockAndPlay(() => applySoundscape(soundBtn.dataset.soundscape, true));
    }
  }, { signal: ac.signal });

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

  applyMode('meditate');
  durationLabelEl.textContent = durationLabel(20);
  setBreathRest();
  applyParallax();

  cleanupFns.push(() => {
    ac.abort();
    detachBreathMotion();
    timerPicker.destroy();
    clearInterval(sessionInterval);
    AudioEngine.stopNapAudio();
    NapAmbient.stop();
  });
}
