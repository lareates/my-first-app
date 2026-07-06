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

  let napBg = null;

  let mode = 'meditate';
  let playing = false;
  let sessionLengthSec = 10 * 60;
  let sessionSec = sessionLengthSec;
  let breathStart = performance.now();
  let sessionInterval;
  let motionOff = null;
  let pointerX = 0;
  let pointerY = -48;
  let parallaxTicking = false;
  const ac = new AbortController();

  function applyMode(m) {
    if (!NAP_MODES[m]) return;
    mode = m;
    const cfg = NAP_MODES[m];
    screen.dataset.auraMode = m;
    setNapArt(art, m);
    title.textContent = cfg.title;
    sessionSec = sessionLengthSec;
    updateTimerDisplay();
    screen.style.setProperty('--breath-dur', `${cfg.breathDur}s`);

    if (!napBg?.isCustom()) {
      screen.querySelectorAll('.aura-bg-layer[data-bg]').forEach(layer => {
        layer.classList.toggle('active', layer.dataset.bg === m);
      });
    }

    metaEl.innerHTML = cfg.meta.map(t => `<div class="aura-meta-line">${t}</div>`).join('');

    screen.querySelectorAll('#nap-modes .horizon-mode').forEach(btn => {
      const active = btn.dataset.napMode === m;
      btn.classList.toggle('active', active);
      btn.classList.toggle('mode-secondary', active && m === 'sleep');
    });

    if (playing) {
      AudioEngine.startNapAudio(m, parseInt(volInput.value, 10));
    }
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
    const outerScale = 1.2 + 0.08 * wave;
    const innerScale = 1.05 + 0.06 * (1 - wave);
    const artScale = 1 + 0.05 * Math.sin(wave * Math.PI);
    ringOuter.style.transform = `scale(${outerScale})`;
    ringInner.style.transform = `scale(${innerScale})`;
    ringOuter.style.opacity = String(0.65 + 0.35 * wave);
    ringInner.style.opacity = String(0.7 + 0.3 * (1 - wave));
    art.style.transform = `scale(${artScale})`;
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
      if (!playing) return;
      sessionSec--;
      if (sessionSec < 0) sessionSec = sessionLengthSec;
      updateTimerDisplay();
    }, 1000);
  }

  function togglePlay() {
    playing = !playing;
    setPlayIcon(playBtn, playing);
    playBtn.classList.toggle('playing', playing);
    if (playing) {
      breathStart = performance.now();
      attachBreathMotion();
      AudioEngine.startNapAudio(mode, parseInt(volInput.value, 10));
      startSession();
    } else {
      detachBreathMotion();
      AudioEngine.stopNapAudio();
    }
  }

  const timerPicker = createTimerPicker({
    triggerEl: timerBtn,
    defaultMin: 10,
    onChange: setDuration,
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
    }
  }, { signal: ac.signal });

  volInput.addEventListener('input', () => {
    volFill.style.width = `${volInput.value}%`;
    AudioEngine.setNapVolume(parseInt(volInput.value, 10));
  }, { signal: ac.signal });

  const onMove = (e) => {
    pointerX = (e.clientX / window.innerWidth - 0.5) * 10;
    pointerY = -48 + (e.clientY / window.innerHeight - 0.5) * 10;
    if (parallaxTicking) return;
    parallaxTicking = true;
    requestAnimationFrame(() => {
      parallax.style.transform = `translate(${pointerX}px, ${pointerY}px)`;
      parallaxTicking = false;
    });
  };
  document.addEventListener('mousemove', onMove, { signal: ac.signal });

  applyMode('meditate');
  durationLabelEl.textContent = durationLabel(10);
  setBreathRest();

  cleanupFns.push(() => {
    ac.abort();
    detachBreathMotion();
    timerPicker.destroy();
    clearInterval(sessionInterval);
    AudioEngine.stopNapAudio();
  });
}
