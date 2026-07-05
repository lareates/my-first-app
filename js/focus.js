let timerMode = 'countdown';
let timerSeconds = 25 * 60;
let timerRunning = false;
let timerInterval = null;
let timerInitial = 25 * 60;
let sessionCount = 0;
let todayMinutes = 0;
let focusMixOn = false;

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
  const notesEl = document.getElementById('quick-notes');
  const bento = document.getElementById('bento-grid');
  const editToggle = document.getElementById('bento-edit-toggle');
  const hiddenTray = document.getElementById('hidden-tray');

  setFocusStatus('idle');

  const stopClock = startClock(() => {
    const now = new Date();
    document.getElementById('focus-clock').textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    document.getElementById('focus-date').textContent = formatDate(now);
  });

  document.getElementById('env-timezone').textContent =
    `时区 ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
  document.getElementById('env-ua').textContent =
    `${navigator.platform} · ${window.innerWidth}×${window.innerHeight}`;

  const notes = localStorage.getItem('ambient-notes');
  if (notes) notesEl.value = notes;
  notesEl.addEventListener('input', () => localStorage.setItem('ambient-notes', notesEl.value));

  sessionEl.textContent = `会话 ${sessionCount} · 今日 ${todayMinutes} 分钟`;

  // Timer modes
  document.querySelectorAll('.timer-mode-tabs .tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.timer-mode-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      timerMode = tab.dataset.mode;
      resetTimer();
      document.getElementById('timer-presets').style.display =
        timerMode === 'countdown' ? 'flex' : 'none';
    };
  });

  document.querySelectorAll('.preset').forEach(p => {
    p.onclick = () => {
      document.querySelectorAll('.preset').forEach(x => x.classList.remove('active'));
      p.classList.add('active');
      timerInitial = parseInt(p.dataset.min) * 60;
      timerSeconds = timerInitial;
      updateTimerDisplay();
    };
  });

  document.getElementById('timer-start').onclick = () => {
    timerRunning ? pauseTimer() : startTimer(sessionEl);
  };
  document.getElementById('timer-reset').onclick = () => {
    resetTimer();
    setFocusStatus('idle');
  };

  // Lo-Fi mix
  const lofiBtn = document.getElementById('lofi-toggle');
  const viz = document.getElementById('visualizer');
  const vols = { lofi: 70, rain: 0, wiper: 0 };

  function getVolumes() {
    return {
      lofi: parseInt(document.getElementById('vol-lofi').value),
      rain: parseInt(document.getElementById('vol-rain').value),
      wiper: parseInt(document.getElementById('vol-wiper').value),
    };
  }

  ['lofi', 'rain', 'wiper'].forEach(name => {
    const input = document.getElementById(`vol-${name}`);
    const label = document.getElementById(`vol-${name}-val`);
    input.addEventListener('input', () => {
      label.textContent = input.value;
      if (focusMixOn) AudioEngine.applyFocusVolumes(getVolumes());
    });
  });

  // Bento layout
  initBentoLayout(bento, editToggle, hiddenTray);

  // Horizon panel nav
  const focusPlayBtn = document.getElementById('focus-play');
  document.querySelectorAll('[data-focus-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-focus-panel]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const id = btn.dataset.focusPanel;
      const panel = document.getElementById(`panel-${id}`);
      panel?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  function syncFocusPlayUI() {
    const icon = focusPlayBtn.querySelector('.material-symbols-outlined');
    icon.textContent = focusMixOn ? 'pause' : 'play_arrow';
    focusPlayBtn.classList.toggle('playing', focusMixOn);
    lofiBtn.setAttribute('aria-pressed', focusMixOn);
    lofiBtn.textContent = focusMixOn ? '暂停' : '播放';
    viz.classList.toggle('playing', focusMixOn);
  }

  async function toggleFocusMix() {
    try {
      await AudioEngine.resume();
    } catch (err) {
      console.error('Audio resume failed:', err);
    }
    focusMixOn = !focusMixOn;
    if (focusMixOn) {
      AudioEngine.playVinylCrackle();
      AudioEngine.startFocusMix(getVolumes());
    } else {
      AudioEngine.stopFocusMix();
    }
    syncFocusPlayUI();
  }

  lofiBtn.onclick = toggleFocusMix;
  focusPlayBtn.addEventListener('click', toggleFocusMix);

  updateTimerDisplay();
  cleanupFns.push(() => {
    pauseTimer();
    stopClock();
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
    const active = document.querySelector('.preset.active');
    timerInitial = active ? parseInt(active.dataset.min) * 60 : 25 * 60;
    timerSeconds = timerInitial;
  }
  updateTimerDisplay();
}

function initBentoLayout(bento, editToggle, hiddenTray) {
  const saved = localStorage.getItem('ambient-bento');
  if (saved) {
    try {
      const { order, hidden, spans } = JSON.parse(saved);
      if (order) reorderCards(bento, order);
      if (spans) applySpans(bento, spans);
      if (hidden) hidden.forEach(id => hideCard(bento, hiddenTray, id));
    } catch {}
  }

  let editMode = false;
  editToggle.onclick = () => {
    editMode = !editMode;
    bento.classList.toggle('edit-mode', editMode);
    editToggle.textContent = editMode ? '完成编辑' : '编辑布局';
  };

  bento.querySelectorAll('.cell-hide').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (!editMode) return;
      const id = btn.closest('.bento-cell').dataset.id;
      hideCard(bento, hiddenTray, id);
      saveBento(bento);
    };
  });

  bento.querySelectorAll('[data-resize]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      if (!editMode) return;
      const cell = btn.closest('.bento-cell');
      const span = parseInt(cell.dataset.span) || 1;
      const next = span >= 4 ? 1 : span === 1 ? 2 : span === 2 ? 4 : 1;
      cell.dataset.span = next;
      saveBento(bento);
    };
  });

  // Drag reorder
  let dragEl = null;
  bento.querySelectorAll('.drag-handle').forEach(handle => {
    handle.addEventListener('pointerdown', (e) => {
      if (!editMode) return;
      dragEl = handle.closest('.bento-cell');
      dragEl.classList.add('dragging');
      dragEl.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
  });

  bento.addEventListener('pointermove', (e) => {
    if (!dragEl) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const target = el?.closest('.bento-cell');
    if (target && target !== dragEl) {
      const nodes = [...bento.children];
      const dragIdx = nodes.indexOf(dragEl);
      const targetIdx = nodes.indexOf(target);
      if (dragIdx < targetIdx) target.after(dragEl);
      else target.before(dragEl);
    }
  });

  bento.addEventListener('pointerup', () => {
    if (dragEl) {
      dragEl.classList.remove('dragging');
      dragEl = null;
      saveBento(bento);
    }
  });
}

function hideCard(bento, tray, id) {
  const cell = bento.querySelector(`[data-id="${id}"]`);
  if (!cell) return;
  cell.classList.add('hidden');
  if (!tray.querySelector(`[data-restore="${id}"]`)) {
    const btn = document.createElement('button');
    btn.dataset.restore = id;
    btn.textContent = `恢复 · ${id}`;
    btn.onclick = () => {
      cell.classList.remove('hidden');
      btn.remove();
      saveBento(bento);
    };
    tray.appendChild(btn);
  }
}

function reorderCards(bento, order) {
  order.forEach(id => {
    const el = bento.querySelector(`[data-id="${id}"]`);
    if (el) bento.appendChild(el);
  });
}

function applySpans(bento, spans) {
  Object.entries(spans).forEach(([id, span]) => {
    const el = bento.querySelector(`[data-id="${id}"]`);
    if (el) el.dataset.span = span;
  });
}

function saveBento(bento) {
  const order = [...bento.querySelectorAll('.bento-cell')].map(c => c.dataset.id);
  const hidden = [...bento.querySelectorAll('.bento-cell.hidden')].map(c => c.dataset.id);
  const spans = {};
  bento.querySelectorAll('.bento-cell').forEach(c => { spans[c.dataset.id] = c.dataset.span; });
  localStorage.setItem('ambient-bento', JSON.stringify({ order, hidden, spans }));
}
