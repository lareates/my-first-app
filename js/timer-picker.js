const DURATION_OPTIONS = [
  { min: 1 },
  { min: 5 },
  { min: 10 },
  { min: 15 },
  { min: 20 },
  { min: 30 },
  { min: 40 },
  { min: 60 },
];

const CUSTOM_DURATION_MIN = 1;
const CUSTOM_DURATION_MAX = 180;

function createTimerPicker({ triggerEl, defaultMin = 10, onChange, signal, bindTrigger = true }) {
  let selectedMin = defaultMin;
  let customDraft = 65;
  let sheetOpenedAt = 0;
  let stepHoldTimer = null;
  let stepHoldInterval = null;

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
      <div class="timer-sheet-custom" hidden>
        <p class="timer-sheet-custom-label"></p>
        <div class="timer-sheet-custom-row">
          <button type="button" class="timer-sheet-step" data-step="-1" aria-label="">−</button>
          <div class="timer-sheet-custom-value" aria-live="polite">
            <span class="timer-sheet-custom-num"></span>
            <span class="timer-sheet-custom-unit"></span>
          </div>
          <button type="button" class="timer-sheet-step" data-step="1" aria-label="">+</button>
        </div>
        <button type="button" class="timer-sheet-custom-confirm"></button>
        <p class="timer-sheet-custom-hint"></p>
      </div>
    </div>
  `;
  document.body.appendChild(sheet);

  const grid = sheet.querySelector('.timer-sheet-grid');
  const titleEl = sheet.querySelector('.timer-sheet-title');
  const subEl = sheet.querySelector('.timer-sheet-sub');
  const panelEl = sheet.querySelector('.timer-sheet-panel');
  const customPanel = sheet.querySelector('.timer-sheet-custom');
  const customLabel = sheet.querySelector('.timer-sheet-custom-label');
  const customNum = sheet.querySelector('.timer-sheet-custom-num');
  const customUnit = sheet.querySelector('.timer-sheet-custom-unit');
  const customHint = sheet.querySelector('.timer-sheet-custom-hint');
  const customConfirm = sheet.querySelector('.timer-sheet-custom-confirm');
  const stepMinus = sheet.querySelector('.timer-sheet-step[data-step="-1"]');
  const stepPlus = sheet.querySelector('.timer-sheet-step[data-step="1"]');

  DURATION_OPTIONS.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'timer-sheet-option';
    btn.dataset.min = opt.min;
    if (opt.min === defaultMin) btn.classList.add('active');
    grid.appendChild(btn);
  });

  const customBtn = document.createElement('button');
  customBtn.type = 'button';
  customBtn.className = 'timer-sheet-option timer-sheet-option--custom';
  customBtn.dataset.custom = '1';
  grid.appendChild(customBtn);

  function isPreset(min) {
    return DURATION_OPTIONS.some((opt) => opt.min === Number(min));
  }

  function clampCustom(n) {
    return Math.min(CUSTOM_DURATION_MAX, Math.max(CUSTOM_DURATION_MIN, Math.round(Number(n)) || CUSTOM_DURATION_MIN));
  }

  function renderCustomValue() {
    customNum.textContent = String(customDraft);
    stepMinus.disabled = customDraft <= CUSTOM_DURATION_MIN;
    stepPlus.disabled = customDraft >= CUSTOM_DURATION_MAX;
  }

  function applySheetCopy() {
    if (typeof I18n === 'undefined') return;
    titleEl.textContent = I18n.t('timerPickTitle');
    subEl.textContent = I18n.t('timerPickSub');
    panelEl.setAttribute('aria-label', I18n.t('timerPickTitle'));
    grid.querySelectorAll('.timer-sheet-option:not([data-custom])').forEach((btn) => {
      btn.textContent = I18n.durationMin(parseInt(btn.dataset.min, 10));
    });
    customBtn.textContent = I18n.t('durationCustom');
    customLabel.textContent = I18n.t('durationCustomLabel');
    customUnit.textContent = I18n.t('durationCustomUnit');
    customConfirm.textContent = I18n.t('durationCustomConfirm');
    customHint.textContent = I18n.t('durationCustomHint', {
      min: CUSTOM_DURATION_MIN,
      max: CUSTOM_DURATION_MAX,
    });
    stepMinus.setAttribute('aria-label', I18n.t('durationCustomDec'));
    stepPlus.setAttribute('aria-label', I18n.t('durationCustomInc'));
  }

  function syncActive() {
    grid.querySelectorAll('.timer-sheet-option').forEach((btn) => {
      if (btn.dataset.custom === '1') {
        btn.classList.toggle('active', !isPreset(selectedMin));
      } else {
        btn.classList.toggle('active', parseInt(btn.dataset.min, 10) === selectedMin);
      }
    });
  }

  function stopStepHold() {
    if (stepHoldTimer) {
      clearTimeout(stepHoldTimer);
      stepHoldTimer = null;
    }
    if (stepHoldInterval) {
      clearInterval(stepHoldInterval);
      stepHoldInterval = null;
    }
  }

  function nudgeCustom(delta) {
    customDraft = clampCustom(customDraft + delta);
    renderCustomValue();
  }

  function startStepHold(delta) {
    stopStepHold();
    nudgeCustom(delta);
    stepHoldTimer = setTimeout(() => {
      stepHoldInterval = setInterval(() => nudgeCustom(delta), 80);
    }, 380);
  }

  function showCustomPanel(prefill) {
    customDraft = clampCustom(prefill ?? (isPreset(selectedMin) ? 65 : selectedMin));
    renderCustomValue();
    customPanel.hidden = false;
  }

  function hideCustomPanel() {
    stopStepHold();
    customPanel.hidden = true;
  }

  function open() {
    closeAllSheets();
    applySheetCopy();
    syncActive();
    hideCustomPanel();
    sheetOpenedAt = Date.now();
    sheet.hidden = false;
    requestAnimationFrame(() => {
      sheet.classList.add('open');
      document.body.classList.add('timer-sheet-open');
    });
  }

  function close() {
    stopStepHold();
    sheet.classList.remove('open');
    sheet.hidden = true;
    hideCustomPanel();
    document.body.classList.remove('timer-sheet-open');
  }

  function select(min) {
    const n = clampCustom(min);
    selectedMin = n;
    syncActive();
    onChange(selectedMin);
    close();
  }

  function commitCustom() {
    select(customDraft);
  }

  const opts = signal ? { signal } : {};
  if (bindTrigger && triggerEl) {
    bindCarTap(triggerEl, () => {
      markTimerTap();
      open();
    }, opts);
  }

  function handleOption(target) {
    const opt = target.closest('.timer-sheet-option');
    if (!opt || !sheet.contains(opt)) return false;
    if (opt.dataset.custom === '1') {
      showCustomPanel();
      return true;
    }
    hideCustomPanel();
    select(parseInt(opt.dataset.min, 10));
    return true;
  }

  function onStepPointerDown(e) {
    const btn = e.currentTarget;
    if (btn.disabled) return;
    e.preventDefault();
    const delta = parseInt(btn.dataset.step, 10);
    startStepHold(delta);
  }

  [stepMinus, stepPlus].forEach((btn) => {
    btn.addEventListener('pointerdown', onStepPointerDown, opts);
    btn.addEventListener('pointerup', stopStepHold, opts);
    btn.addEventListener('pointercancel', stopStepHold, opts);
    btn.addEventListener('pointerleave', stopStepHold, opts);
    btn.addEventListener('lostpointercapture', stopStepHold, opts);
    // Prevent click from double-firing after pointerdown nudge
    btn.addEventListener('click', (e) => e.preventDefault(), opts);
  });

  sheet.addEventListener('touchend', (e) => {
    if (!sheet.classList.contains('open')) return;
    if (e.target.matches('[data-close]')) {
      e.preventDefault();
      close();
      return;
    }
    if (e.target.closest('.timer-sheet-step')) return;
    if (e.target.closest('.timer-sheet-custom-confirm')) {
      if (Date.now() - sheetOpenedAt < SHEET_TAP_GUARD_MS) return;
      e.preventDefault();
      e.stopPropagation();
      commitCustom();
      return;
    }
    if (e.target.closest('.timer-sheet-custom')) return;
    if (Date.now() - sheetOpenedAt < SHEET_TAP_GUARD_MS) return;
    if (handleOption(e.target)) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, { passive: false, ...opts });

  sheet.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) {
      close();
      return;
    }
    if (e.target.closest('.timer-sheet-step')) return;
    if (e.target.closest('.timer-sheet-custom-confirm')) {
      if (Date.now() - sheetOpenedAt < SHEET_TAP_GUARD_MS) return;
      e.preventDefault();
      commitCustom();
      return;
    }
    if (e.target.closest('.timer-sheet-custom')) return;
    if (Date.now() - sheetOpenedAt < SHEET_TAP_GUARD_MS) return;
    handleOption(e.target);
  }, opts);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) close();
  }, opts);

  document.addEventListener('pointerup', stopStepHold, opts);
  document.addEventListener('pointercancel', stopStepHold, opts);

  if (typeof I18n !== 'undefined') {
    I18n.onChange(applySheetCopy);
  }
  applySheetCopy();
  renderCustomValue();

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
