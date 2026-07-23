/**
 * Aetheris Pro 门禁
 * 复用 Heritage 付费弹窗骨架，给声景 / 时长 / 剧院全屏 / Oasis 调音台加锁
 *
 * 调试解锁：localStorage.setItem('isPro','true'); location.reload()
 */
const ProGate = (() => {
  const STORAGE_PRO = 'isPro';
  const LEMON_CHECKOUT_URL = 'https://aetheris.lemonsqueezy.com/checkout/buy/heritage-themes';
  const KEY_SVG =
    '<svg class="pro-key-icon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="#f5a524" d="M14.5 3a5.5 5.5 0 0 0-5.3 6.9L2 17.1V21h3.9l1.2-1.2 1.4 1.4 2.1-2.1-1.4-1.4L11 15.3A5.5 5.5 0 1 0 14.5 3zm0 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>';

  /** 免费声景（红框外） */
  const FREE_SOUNDSCAPES = new Set(['woven', 'rain', 'stream']);
  /** 免费时长上限（分钟）：超过此值需 Pro（即 20+） */
  const FREE_DURATION_MAX_MIN = 15;

  let modalEl = null;
  let pendingAction = null;

  function isPro() {
    return localStorage.getItem(STORAGE_PRO) === 'true';
  }

  function setPro(flag) {
    if (flag) localStorage.setItem(STORAGE_PRO, 'true');
    else localStorage.removeItem(STORAGE_PRO);
  }

  function isSoundscapeLocked(id) {
    if (isPro()) return false;
    return !FREE_SOUNDSCAPES.has(id);
  }

  function isDurationLocked(min) {
    if (isPro()) return false;
    return Number(min) > FREE_DURATION_MAX_MIN;
  }

  function ensureModal() {
    if (modalEl && document.body.contains(modalEl)) return modalEl;
    modalEl = document.getElementById('focus-paywall');
    return modalEl;
  }

  function setPaywallCopy(featureLabel) {
    const modal = ensureModal();
    if (!modal) return;
    const feature = featureLabel || (typeof I18n !== 'undefined' ? I18n.t('proFeature') : 'Pro');
    const title = modal.querySelector('#focus-paywall-title');
    const copy = modal.querySelector('.focus-paywall-copy');
    const eyebrow = modal.querySelector('.focus-paywall-eyebrow');
    const note = modal.querySelector('.focus-paywall-note');
    const preview = modal.querySelector('#focus-paywall-preview');
    const perks = modal.querySelector('.focus-paywall-perks');
    const buy = modal.querySelector('#focus-paywall-lemon');
    const dismiss = modal.querySelector('.focus-paywall-dismiss');
    if (typeof I18n !== 'undefined') {
      if (eyebrow) eyebrow.textContent = I18n.t('proEyebrow');
      if (title) title.textContent = I18n.t('proTitle');
      if (copy) copy.textContent = I18n.t('proCopy', { feature });
      if (perks) {
        perks.innerHTML = `
          <li>${I18n.t('proPerk1')}</li>
          <li>${I18n.t('proPerk2')}</li>
          <li>${I18n.t('proPerk3')}</li>
        `;
      }
      if (note) note.textContent = I18n.t('proNote');
      if (preview) preview.textContent = I18n.t('proPreview');
      if (buy) buy.textContent = I18n.t('proBuy');
      if (dismiss) dismiss.textContent = I18n.t('proLater');
      return;
    }
    if (eyebrow) eyebrow.textContent = 'AETHERIS PRO';
    if (title) title.textContent = 'Unlock Pro';
    if (copy) copy.textContent = `Unlock Pro — ${feature}`;
    if (preview) preview.textContent = 'Preview unlock (dev)';
  }

  function openPaywall(featureLabel = null, onUnlock) {
    pendingAction = typeof onUnlock === 'function' ? onUnlock : null;
    const modal = ensureModal();
    if (!modal) {
      console.warn('[ProGate] paywall modal missing');
      return false;
    }
    setPaywallCopy(featureLabel || (typeof I18n !== 'undefined' ? I18n.t('proFeature') : 'Pro'));
    const lemon = modal.querySelector('#focus-paywall-lemon');
    if (lemon) lemon.href = LEMON_CHECKOUT_URL;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('focus-paywall-open');
    return false;
  }

  function closePaywall() {
    const modal = ensureModal();
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('focus-paywall-open');
  }

  function unlockPreview() {
    setPro(true);
    closePaywall();
    syncAllLocks();
    try { pendingAction?.(); } catch (e) { console.warn('[ProGate] unlock action', e); }
    pendingAction = null;
  }

  /**
   * @returns {boolean} true = 已放行；false = 已弹出付费窗
   */
  function requirePro(featureLabel, onUnlock) {
    if (isPro()) return true;
    openPaywall(featureLabel || (typeof I18n !== 'undefined' ? I18n.t('proFeature') : 'Pro'), onUnlock);
    return false;
  }

  function labelOf(el) {
    const key = el.querySelector?.('.pro-key');
    if (!key) return (el.textContent || '').trim();
    return Array.from(el.childNodes)
      .filter((n) => n !== key)
      .map((n) => n.textContent || '')
      .join('')
      .trim();
  }

  function markEl(el, locked, title) {
    if (!el) return;
    const label = title || labelOf(el) || '功能';
    el.classList.toggle('pro-locked', locked);
    el.setAttribute('data-pro-locked', locked ? '1' : '0');
    if (locked) {
      el.setAttribute('aria-label', typeof I18n !== 'undefined'
        ? I18n.t('proLocked', { label })
        : `${label} (Pro required)`);
      if (!el.querySelector('.pro-key')) {
        const badge = document.createElement('span');
        badge.className = 'pro-key';
        badge.setAttribute('aria-hidden', 'true');
        badge.innerHTML = KEY_SVG;
        el.prepend(badge);
      }
    } else {
      el.querySelector('.pro-key')?.remove();
      el.setAttribute('aria-label', label);
    }
  }

  function syncSoundscapeLocks() {
    document.querySelectorAll('.nap-sound-chip[data-soundscape]').forEach((btn) => {
      const id = btn.dataset.soundscape;
      const locked = isSoundscapeLocked(id);
      markEl(btn, locked, labelOf(btn));
    });
  }

  function syncTheaterLocks() {
    document.querySelectorAll('.aura-theater-btn:not([hidden])').forEach((btn) => {
      markEl(btn, !isPro(), labelOf(btn));
    });
  }

  function syncOasisLocks() {
    const consoleEl = document.getElementById('panel-oasis');
    if (!consoleEl) return;
    const locked = !isPro();
    consoleEl.classList.toggle('pro-locked-panel', locked);
    let veil = consoleEl.querySelector('.pro-panel-veil');
    if (locked) {
      if (!veil) {
        veil = document.createElement('button');
        veil.type = 'button';
        veil.className = 'pro-panel-veil';
        veil.innerHTML = `<span class="pro-key">${KEY_SVG}</span><span>${typeof I18n !== 'undefined' ? I18n.t('oasisVeil') : 'ASMR Mixer · Pro'}</span>`;
        consoleEl.appendChild(veil);
      }
      document.querySelectorAll('.oasis-slider').forEach((input) => {
        input.disabled = true;
        input.closest('.oasis-fader')?.classList.add('pro-locked');
      });
    } else {
      veil?.remove();
      document.querySelectorAll('.oasis-slider').forEach((input) => {
        input.disabled = false;
        input.closest('.oasis-fader')?.classList.remove('pro-locked');
      });
    }
  }

  function syncDurationLocks(root = document) {
    root.querySelectorAll('.timer-sheet-option[data-min]').forEach((btn) => {
      const min = parseInt(btn.dataset.min, 10);
      const locked = isDurationLocked(min);
      markEl(btn, locked, labelOf(btn));
    });
  }

  function syncAllLocks() {
    syncSoundscapeLocks();
    syncTheaterLocks();
    syncOasisLocks();
    syncDurationLocks();
  }

  function init() {
    // 预览用：http://localhost:8080/?resetPro=1 可清掉本机解锁状态
    try {
      const q = new URLSearchParams(location.search);
      if (q.has('resetPro') || q.get('pro') === '0') {
        localStorage.removeItem(STORAGE_PRO);
      }
    } catch (_) { /* ignore */ }

    const modal = ensureModal();
    modal?.addEventListener('click', (e) => {
      if (e.target.closest('[data-paywall-preview]')) {
        e.preventDefault();
        unlockPreview();
        return;
      }
      if (e.target.closest('[data-paywall-close]') || e.target.closest('.focus-paywall-backdrop')) {
        e.preventDefault();
        closePaywall();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl?.classList.contains('open')) closePaywall();
    });

    // Oasis 遮罩点击
    document.addEventListener('click', (e) => {
      const veil = e.target.closest('.pro-panel-veil');
      if (!veil) return;
      e.preventDefault();
      e.stopPropagation();
      requirePro(typeof I18n !== 'undefined' ? I18n.t('asmrMixer') : 'ASMR Mixer');
    });

    syncAllLocks();
    if (typeof I18n !== 'undefined') {
      I18n.onChange(() => {
        syncAllLocks();
        if (modalEl?.classList.contains('open')) {
          setPaywallCopy(typeof I18n !== 'undefined' ? I18n.t('proFeature') : 'Pro');
        }
      });
    }
  }

  return {
    isPro,
    setPro,
    requirePro,
    openPaywall,
    closePaywall,
    isSoundscapeLocked,
    isDurationLocked,
    syncAllLocks,
    syncDurationLocks,
    syncSoundscapeLocks,
    syncOasisLocks,
    FREE_SOUNDSCAPES,
    FREE_DURATION_MAX_MIN,
    init,
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ProGate.init());
} else {
  ProGate.init();
}