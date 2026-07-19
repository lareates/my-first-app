let timerMode = 'countdown';
let timerSeconds = 20 * 60;
let timerRunning = false;
let timerInterval = null;
let timerInitial = 20 * 60;
let sessionCount = 0;
let todayMinutes = 0;
let focusDurationPicker = null;

const OASIS_LABELS = {
  rain: '雨声',
  stream: '溪流',
  waves: '海浪',
  wind: '风声',
  fireplace: '壁炉',
  birds: '鸟鸣',
  meditation1: '心灵',
  meditation2: '星风',
  soundbath: '音疗',
  tibetan: '颂钵',
};

function formatTimer(s) {
  const m = Math.floor(Math.abs(s) / 60);
  const sec = Math.abs(s) % 60;
  return `${pad(m)}:${pad(sec)}`;
}

function updateTimerDisplay() {
  document.getElementById('timer-display').textContent = formatTimer(timerSeconds);
}

function setFocusStatus(state) {
  const dot = document.getElementById('focus-dot');
  const text = document.getElementById('focus-status-text');
  dot.className = 'dot';
  if (state === 'focus') {
    dot.classList.add('active');
    text.textContent = '专注中';
  } else if (state === 'break') {
    dot.classList.add('break');
    text.textContent = '休息中';
  } else {
    dot.classList.add('idle');
    text.textContent = '待命中';
  }
}

function triggerCompletionEffects(wasPomodoro) {
  const ripple = document.getElementById('focus-ripple');
  ripple.classList.remove('active');
  void ripple.offsetWidth;
  ripple.classList.add('active');
  AudioEngine.playSingingBowl();
  setTimeout(() => ripple.classList.remove('active'), 2600);
  if (wasPomodoro) setFocusStatus('break');
  else setFocusStatus('idle');
}

function initFocus(cleanupFns) {
  const sessionEl = document.getElementById('focus-session');
  const screen = document.getElementById('scene-focus');
  const ac = new AbortController();

  PorscheCluster.init({
    clusterEl: document.getElementById('porsche-cluster'),
    stateGetter: () => ({
      timerMode,
      timerSeconds,
      timerInitial,
      timerRunning,
      todayMinutes,
    }),
    cleanupFns,
  });

  FocusTheme.init(screen, cleanupFns);

  setFocusStatus('idle');
  Ambient.setFocusEnergy?.(0);

  const stopClock = startClock(() => {
    const now = new Date();
    document.getElementById('focus-clock').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    document.getElementById('focus-date').textContent = formatDate(now);
  });

  const durationBtn = document.getElementById('focus-duration-btn');
  const durationLabelEl = document.getElementById('focus-duration-label');

  function applyCountdownDuration(min) {
    timerInitial = min * 60;
    timerSeconds = timerInitial;
    durationLabelEl.textContent = durationLabel(min);
    updateTimerDisplay();
    focusDurationPicker?.setMinutes(min);
  }

  function syncDurationPickerVisibility() {
    durationBtn.style.display = timerMode === 'countdown' ? 'inline-flex' : 'none';
  }

  sessionEl.textContent = `会话 ${sessionCount} · 今日 ${todayMinutes} 分钟`;

  focusDurationPicker = createTimerPicker({
    triggerEl: durationBtn,
    defaultMin: 20,
    onChange: applyCountdownDuration,
    signal: ac.signal,
  });

  document.querySelectorAll('.timer-mode-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.timer-mode-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      timerMode = tab.dataset.mode;
      resetTimer();
      syncDurationPickerVisibility();
    }, { signal: ac.signal });
  });

  syncDurationPickerVisibility();

  document.getElementById('timer-start').addEventListener('click', () => {
    timerRunning ? pauseTimer() : startTimer(sessionEl);
  }, { signal: ac.signal });

  document.getElementById('timer-reset').addEventListener('click', () => {
    resetTimer();
    setFocusStatus('idle');
  }, { signal: ac.signal });

  // ─── Oasis ASMR 调音台 ───
  const energyEl = document.getElementById('oasis-energy');
  const hintEl = document.getElementById('oasis-hint');
  const lastVals = {};

  function updateEnergyLabel(level) {
    if (!energyEl) return;
    if (level < 0.04) energyEl.textContent = '星空静谧';
    else if (level < 0.35) energyEl.textContent = '星光缓息';
    else if (level < 0.7) energyEl.textContent = '星河流动';
    else energyEl.textContent = '星野盛放';
  }

  function syncFaderFill(input) {
    const fill = document.getElementById(`${input.id}-fill`);
    if (fill) fill.style.height = `${input.value}%`;
  }

  document.querySelectorAll('.oasis-slider').forEach((input) => {
    const key = input.dataset.oasis;
    lastVals[key] = parseInt(input.value, 10);
    syncFaderFill(input);

    const onMove = () => {
      const val = parseInt(input.value, 10);
      const prev = lastVals[key] ?? 0;
      const stepped = Math.abs(val - prev) >= 3 || val === 0 || val === 100;
      lastVals[key] = val;
      syncFaderFill(input);

      AudioEngine.setOasisLayer(key, val / 100, { tick: stepped });
      if (hintEl && val > 0) {
        hintEl.textContent = `${OASIS_LABELS[key] || key} · ${val}%`;
      }
    };

    input.addEventListener('input', onMove, { signal: ac.signal });
    input.addEventListener('change', onMove, { signal: ac.signal });
    // 车机触控：按下立刻解锁 AudioContext
    input.addEventListener('pointerdown', () => {
      AudioEngine.resume?.();
      AudioEngine.playFaderClick?.();
    }, { signal: ac.signal });
  });

  AudioEngine.onOasisEnergy?.((level) => {
    Ambient.setFocusEnergy?.(level);
    updateEnergyLabel(level);
  });
  updateEnergyLabel(0);

  updateTimerDisplay();
  cleanupFns.push(() => {
    ac.abort();
    pauseTimer();
    stopClock();
    focusDurationPicker?.destroy();
    AudioEngine.stopOasis?.({ fade: 1.5 });
    Ambient.setFocusEnergy?.(0);
  });
}

function startTimer(sessionEl) {
  if (timerMode === 'stopwatch') timerInitial = 0;
  timerRunning = true;
  document.getElementById('timer-start').textContent = '暂停';
  setFocusStatus('focus');

  timerInterval = setInterval(() => {
    if (timerMode === 'stopwatch') {
      timerSeconds++;
    } else {
      timerSeconds--;
      if (timerSeconds <= 0) {
        timerSeconds = 0;
        const wasPomodoro = timerMode === 'pomodoro';
        pauseTimer();
        sessionCount++;
        todayMinutes += Math.round((timerInitial || 25 * 60) / 60);
        sessionEl.textContent = `会话 ${sessionCount} · 今日 ${todayMinutes} 分钟`;
        triggerCompletionEffects(wasPomodoro);
        if (wasPomodoro) {
          timerSeconds = 5 * 60;
          timerInitial = 5 * 60;
          const hint = document.getElementById('oasis-hint');
          if (hint) hint.textContent = '☕ 休息 5 分钟 · 推子可继续轻放';
          updateTimerDisplay();
        }
      }
    }
    updateTimerDisplay();
  }, 1000);
}

function pauseTimer() {
  timerRunning = false;
  document.getElementById('timer-start').textContent = '开始';
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
  if (document.getElementById('focus-status-text').textContent !== '休息中') {
    setFocusStatus('idle');
  }
}

function resetTimer() {
  pauseTimer();
  if (timerMode === 'stopwatch') {
    timerSeconds = 0;
    timerInitial = 0;
  } else if (timerMode === 'pomodoro') {
    timerSeconds = 25 * 60;
    timerInitial = 25 * 60;
    const hint = document.getElementById('oasis-hint');
    if (hint) hint.textContent = '轻推推子 · 叠出你的解压声场';
  } else {
    const activeMin = focusDurationPicker?.getMinutes() ?? 20;
    timerInitial = activeMin * 60;
    timerSeconds = timerInitial;
  }
  updateTimerDisplay();
}
