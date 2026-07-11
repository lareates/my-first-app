let timerMode = 'countdown';
let timerSeconds = 20 * 60;
let timerRunning = false;
let timerInterval = null;
let timerInitial = 20 * 60;
let sessionCount = 0;
let todayMinutes = 0;
let focusMixOn = false;
let focusDurationPicker = null;

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
  const ac = new AbortController();

  setFocusStatus('idle');

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

  const lofiBtn = document.getElementById('lofi-toggle');
  const viz = document.getElementById('visualizer');

  function getVolumes() {
    return {
      lofi: parseInt(document.getElementById('vol-lofi').value, 10),
      rain: parseInt(document.getElementById('vol-rain').value, 10),
      wiper: parseInt(document.getElementById('vol-wiper').value, 10),
    };
  }

  ['lofi', 'rain', 'wiper'].forEach(name => {
    const input = document.getElementById(`vol-${name}`);
    const label = document.getElementById(`vol-${name}-val`);
    input.addEventListener('input', () => {
      label.textContent = input.value;
      if (focusMixOn) AudioEngine.applyFocusVolumes(getVolumes());
    }, { signal: ac.signal });
  });

  function syncFocusPlayUI() {
    lofiBtn.setAttribute('aria-pressed', focusMixOn);
    lofiBtn.textContent = focusMixOn ? '暂停' : '播放';
    viz.classList.toggle('playing', focusMixOn);
  }

  function toggleFocusMix() {
    focusMixOn = !focusMixOn;
    if (focusMixOn) {
      AudioEngine.playVinylCrackle();
      AudioEngine.startFocusMix(getVolumes());
    } else {
      AudioEngine.stopFocusMix();
    }
    syncFocusPlayUI();
  }

  bindCarPlay(lofiBtn, toggleFocusMix);

  updateTimerDisplay();
  cleanupFns.push(() => {
    ac.abort();
    pauseTimer();
    stopClock();
    focusDurationPicker?.destroy();
    if (focusMixOn) AudioEngine.stopFocusMix();
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
          document.getElementById('lofi-track').textContent = '☕ 休息 5 分钟';
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
    document.getElementById('lofi-track').textContent = 'Chill Beats · 本地合成';
  } else {
    const activeMin = focusDurationPicker?.getMinutes() ?? 20;
    timerInitial = activeMin * 60;
    timerSeconds = timerInitial;
  }
  updateTimerDisplay();
}
