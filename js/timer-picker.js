const DURATION_OPTIONS = [
  { min: 1, label: '1 分钟' },
  { min: 5, label: '5 分钟' },
  { min: 10, label: '10 分钟' },
  { min: 15, label: '15 分钟' },
  { min: 20, label: '20 分钟' },
  { min: 30, label: '30 分钟' },
  { min: 40, label: '40 分钟' },
  { min: 50, label: '50 分钟' },
  { min: 60, label: '1 小时' },
];

function durationLabel(min) {
  const opt = DURATION_OPTIONS.find(o => o.min === min);
  return opt ? opt.label : `${min} 分钟`;
}

function createTimerPicker({ triggerEl, defaultMin = 10, onChange, signal }) {
  let selectedMin = defaultMin;
  const sheet = document.createElement('div');
  sheet.className = 'timer-sheet';
  sheet.innerHTML = `
    <div class="timer-sheet-backdrop" data-close></div>
    <div class="timer-sheet-panel" role="dialog" aria-modal="true" aria-label="选择时长">
      <div class="timer-sheet-handle"></div>
      <p class="timer-sheet-title">选择时长</p>
      <p class="timer-sheet-sub">默认 10 分钟，可随时调整</p>
      <div class="timer-sheet-grid"></div>
    </div>
  `;
  document.body.appendChild(sheet);

  const grid = sheet.querySelector('.timer-sheet-grid');
  DURATION_OPTIONS.forEach(opt => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'timer-sheet-option';
    btn.dataset.min = opt.min;
    btn.textContent = opt.label;
    if (opt.min === defaultMin) btn.classList.add('active');
    grid.appendChild(btn);
  });

  function syncActive() {
    grid.querySelectorAll('.timer-sheet-option').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.min, 10) === selectedMin);
    });
  }

  function open() {
    syncActive();
    sheet.classList.add('open');
    document.body.classList.add('timer-sheet-open');
  }

  function close() {
    sheet.classList.remove('open');
    document.body.classList.remove('timer-sheet-open');
  }

  function select(min) {
    selectedMin = min;
    syncActive();
    onChange(min);
    close();
  }

  const opts = signal ? { signal } : {};
  triggerEl.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    open();
  }, opts);

  sheet.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) {
      close();
      return;
    }
    const opt = e.target.closest('.timer-sheet-option');
    if (opt) select(parseInt(opt.dataset.min, 10));
  }, opts);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheet.classList.contains('open')) close();
  }, opts);

  return {
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
