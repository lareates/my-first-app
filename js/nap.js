const NAP_MODES = {
  meditate: {
    title: 'DEEP RELAXATION',
    breathDur: 12,
    sessionSec: 600,
    meta: ['FREQUENCY / 432HZ', 'ATMOSPHERE / VIOLET', 'INTENSITY / LOW'],
  },
  sleep: {
    title: 'NIGHTFALL SLUMBER',
    breathDur: 12,
    sessionSec: 600,
    meta: ['FREQUENCY / 1.5HZ', 'ATMOSPHERE / DEEP SPACE', 'INTENSITY / 0.2'],
  },
  breathe: {
    title: 'RHYTHMIC BREATH',
    breathDur: 8,
    sessionSec: 600,
    meta: ['FREQUENCY / 432HZ', 'ATMOSPHERE / SUNSET', 'INTENSITY / 0.7'],
  },
};

function initNap(cleanupFns) {
  const screen = document.getElementById('scene-nap');
  const art = document.getElementById('nap-art');
  const title = document.getElementById('nap-title');
  const timerEl = document.getElementById('nap-session-timer');
  const hintEl = document.getElementById('breath-hint');
  const metaEl = document.getElementById('nap-meta');
  const parallax = document.getElementById('nap-parallax');
  const playBtn = document.getElementById('nap-play');
  const playIcon = playBtn?.querySelector('.material-symbols-outlined');
  const volInput = document.getElementById('nap-volume');
  const volFill = document.getElementById('nap-volume-fill');

  let mode = 'meditate';
  let playing = false;
  let sessionSec = 600;
  let breathStart = performance.now();
  let breathAnimId;
  let sessionInterval;
  const ac = new AbortController();

  function applyMode(m) {
    if (!NAP_MODES[m]) return;
    mode = m;
    const cfg = NAP_MODES[m];
    screen.dataset.auraMode = m;
    setNapArt(art, m);
    title.textContent = cfg.title;
    sessionSec = cfg.sessionSec;
    updateTimerDisplay();
    screen.style.setProperty('--breath-dur', `${cfg.breathDur}s`);

    screen.querySelectorAll('.aura-bg-layer[data-bg]').forEach(layer => {
      layer.classList.toggle('active', layer.dataset.bg === m);
    });

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

  function tickBreath() {
    const cfg = NAP_MODES[mode];
    const cycle = cfg.breathDur * 1000;
    const elapsed = (performance.now() - breathStart) % cycle;
    const half = cycle / 2;
    let phase, inhale;
    if (elapsed < half) {
      phase = elapsed / half;
      inhale = true;
    } else {
      phase = 1 - (elapsed - half) / half;
      inhale = false;
    }
    AudioEngine.setBreathPhase(phase);
    if (mode === 'breathe') {
      hintEl.textContent = inhale ? '吸气' : '呼气';
      hintEl.style.opacity = String(0.5 + phase * 0.5);
    }
    breathAnimId = requestAnimationFrame(tickBreath);
  }

  function startSession() {
    if (sessionInterval) return;
    sessionInterval = setInterval(() => {
      if (!playing) return;
      sessionSec--;
      if (sessionSec < 0) sessionSec = NAP_MODES[mode].sessionSec;
      updateTimerDisplay();
      const total = NAP_MODES[mode].sessionSec;
      volFill.style.width = `${((total - sessionSec) / total) * 100}%`;
    }, 1000);
  }

  async function togglePlay() {
    try {
      await AudioEngine.resume();
    } catch (err) {
      console.error('Audio resume failed:', err);
    }
    playing = !playing;
    if (playIcon) playIcon.textContent = playing ? 'pause' : 'play_arrow';
    playBtn.classList.toggle('playing', playing);
    if (playing) {
      AudioEngine.startNapAudio(mode, parseInt(volInput.value, 10));
      startSession();
    } else {
      AudioEngine.stopNapAudio();
    }
  }

  screen.addEventListener('click', (e) => {
    const modeBtn = e.target.closest('button[data-nap-mode]');
    if (modeBtn) {
      e.preventDefault();
      applyMode(modeBtn.dataset.napMode);
      return;
    }
    if (e.target.closest('#nap-play')) {
      e.preventDefault();
      togglePlay();
    }
  }, { signal: ac.signal });

  volInput.addEventListener('input', () => {
    volFill.style.width = `${volInput.value}%`;
    AudioEngine.setNapVolume(parseInt(volInput.value, 10));
  }, { signal: ac.signal });

  const onMove = (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 15;
    const y = (e.clientY / window.innerHeight - 0.5) * 15;
    parallax.style.transform = `translate(${x}px, ${-48 + y}px)`;
  };
  document.addEventListener('mousemove', onMove, { signal: ac.signal });

  applyMode('meditate');
  breathStart = performance.now();
  breathAnimId = requestAnimationFrame(tickBreath);

  cleanupFns.push(() => {
    ac.abort();
    cancelAnimationFrame(breathAnimId);
    clearInterval(sessionInterval);
    AudioEngine.stopNapAudio();
  });
}
