const DURATION_OPTIONS = [
  { min: 1 },
  { min: 5 },
  { min: 10 },
  { min: 15 },
  { min: 20 },
  { min: 30 },
  { min: 40 },
  { min: 50 },
  { min: 60 },
];

function createTimerPicker({ triggerEl, defaultMin = 10, onChange, signal, bindTrigger = true }) {
  let selectedMin = defaultMin;
  let sheetOpenedAt = 0;
  const sheet = document.createElement('div');
  sheet.className = 'timer-sheet timer-sheet--duration';
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="timer-sheet-backdrop" data-close></div>
    <div class="timer-sheet-panel" role="dialog" aria-modal="true" aria-label="">
      <div class="timer-sheet-handle"></div>
      <p class="timer-sheet-title"></p>
      <p class="timer-sheet-sub"></p>
      <div class="timer-sheet-grid"></div>
    </div>
  `;
  document.body.appendChild(sheet);

  const grid = sheet.querySelector('.timer-sheet-grid');
  const titleEl = sheet.querySelector('.timer-sheet-title');
  const subEl = sheet.querySelector('.timer-sheet-sub');
  const panelEl = sheet.querySelector('.timer-sheet-panel');

  DURATION_OPTIONS.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'timer-sheet-option';
    btn.dataset.min = opt.min;
    if (opt.min === defaultMin) btn.classList.add('active');
    grid.appendChild(btn);
  });

  function applySheetCopy() {
    if (typeof I18n === 'undefined') return;
    titleEl.textContent = I18n.t('timerPickTitle');
    subEl.textContent = I18n.t('timerPickSub');
    panelEl.setAttribute('aria-label', I18n.t('timerPickTitle'));
    grid.querySelectorAll('.timer-sheet-option').forEach((btn) => {
      btn.textContent = I18n.durationMin(parseInt(btn.dataset.min, 10));
    });
  }

  function syncActive() {
    grid.querySelectorAll('.timer-sheet-option').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.min, 10) === selectedMin);
    });
  }

  function open() {
    closeAllSheets();
    applySheetCopy();
    syncActive();
    if (typeof ProGate !== 'undefined') ProGate.syncDurationLocks(sheet);
    sheetOpenedAt = Date.now();
    sheet.hidden = false;
    requestAnimationFrame(() => {
      sheet.classList.add('open');
      document.body.classList.add('timer-sheet-open');
    });
  }

  function close() {
    sheet.classList.remove('open');
    sheet.hidden = true;
    document.body.classList.remove('timer-sheet-open');
  }

  function select(min) {
    selectedMin = min;
    syncActive();
    onChange(min);
    close();
  }

  const opts = signal ? { signal } : {};
  if (bindTrigger && triggerEl) {
    bindCarTap(triggerEl, () => {
      markTimerTap();
      open();
    }, opts);
  }

  sheet.addEventListener('touchend', (e) => {
    if (!sheet.classList.contains('open')) return;
    if (e.target.matches('[data-close]')) {
      e.preventDefault();
      close();
      return;
    }
    if (Date.now() - sheetOpenedAt < SHEET_TAP_GUARD_MS) return;
    const opt = e.target.closest('.timer-sheet-option');
    if (!opt) return;
    e.preventDefault();
    e.stopPropagation();
    const min = parseInt(opt.dataset.min, 10);
    if (typeof ProGate !== 'undefined' && ProGate.isDurationLocked(min)) {
      ProGate.requirePro(I18n.durationMin(min), () => select(min));
      return;
    }
    select(min);
  }, { passive: false, ...opts });

  sheet.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) {
      close();
      return;
    }
    if (Date.now() - sheetOpenedAt < SHEET_TAP_GUARD_MS) return;
    const opt = e.target.closest('.timer-sheet-option');
    if (!opt) return;
    const min = parseInt(opt.dataset.min, 10);
    if (typeof ProGate !== 'undefined' && ProGate.isDurationLocked(min)) {
      e.preventDefault();
      ProGate.requirePro(I18n.durationMin(min), () => select(min));
      return;
    }
    select(min);
  }, opts);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) close();
  }, opts);

  if (typeof I18n !== 'undefined') {
    I18n.onChange(applySheetCopy);
  }
  applySheetCopy();

  return {
    open,
    close,
    getMinutes: () => selectedMin,
    setMinutes(min) {
      selectedMin = min;
      syncActive();
    },
    destroy() {
      close();
      sheet.remove();
    },
  };
}
