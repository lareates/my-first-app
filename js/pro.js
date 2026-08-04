/**
 * AeroCabin Pro 门禁 · Lemon Squeezy 购买与激活码验证
 *
 * 调试解锁：localStorage.setItem('aerocabin_pro_unlocked','true'); location.reload()
 * 重置状态：?resetPro=1
 */
const ProGate = (() => {
  const STORAGE_PRO = 'aerocabin_pro_unlocked';
  const STORAGE_LEGACY_PRO = 'isPro';
  const STORAGE_INSTANCE = 'aerocabin_instance_id';
  const STORAGE_LICENSE = 'aerocabin_license_key';
  const STORAGE_PRO_BACKUP = 'aetheris-pro-backup';
  const LEMON_CHECKOUT_URL = 'https://aerocabin.lemonsqueezy.com/checkout/buy/688d9670-10a9-45f8-a861-a49cea3e24ad';
  const LEMON_ACTIVATE_URL = 'https://api.lemonsqueezy.com/v1/licenses/activate';
  const KEY_SVG =
    '<svg class="pro-key-icon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="#f5a524" d="M14.5 3a5.5 5.5 0 0 0-5.3 6.9L2 17.1V21h3.9l1.2-1.2 1.4 1.4 2.1-2.1-1.4-1.4L11 15.3A5.5 5.5 0 1 0 14.5 3zm0 3a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z"/></svg>';

  /** 免费声景 */
  const FREE_SOUNDSCAPES = new Set(['woven', 'rain', 'stream']);
  /** 免费场景背景 */
  const FREE_BACKGROUNDS = new Set(['default']);
  /** 免费时长上限（分钟）：超过此值需 Pro（即 20+） */
  const FREE_DURATION_MAX_MIN = 15;
  /** 需 Pro 解锁的场景 */
  const PRO_SCENES = new Set(['camp']);

  const MSG = {
    success: '✨ AeroCabin Pro Successfully Activated!',
    fail: 'Invalid license key or activation limit reached.',
  };

  let modalEl = null;
  let pendingAction = null;
  let activating = false;

  function saveLicenseKey(key) {
    if (!key) return;
    try { localStorage.setItem(STORAGE_LICENSE, key.trim()); } catch { /* ignore */ }
  }

  function restoreProState() {
    migrateLegacyPro();
    if (isPro()) return;

    try {
      if (sessionStorage.getItem(STORAGE_PRO_BACKUP) === '1') {
        setPro(true);
        sessionStorage.removeItem(STORAGE_PRO_BACKUP);
        return;
      }
    } catch { /* ignore */ }

    try {
      const q = new URLSearchParams(location.search);
      if (q.get('pro') === '1') {
        setPro(true);
        q.delete('pro');
        const next = q.toString();
        history.replaceState({}, '', location.pathname + (next ? `?${next}` : '') + location.hash);
        return;
      }
    } catch { /* ignore */ }

    try {
      if (localStorage.getItem(STORAGE_LICENSE)) setPro(true);
    } catch { /* ignore */ }
  }

  function preserveForNavigation() {
    if (!isPro()) return;
    try { sessionStorage.setItem(STORAGE_PRO_BACKUP, '1'); } catch { /* ignore */ }
  }

  function migrateLegacyPro() {
    if (localStorage.getItem(STORAGE_PRO) === 'true') return;
    if (localStorage.getItem(STORAGE_LEGACY_PRO) === 'true') {
      localStorage.setItem(STORAGE_PRO, 'true');
      localStorage.removeItem(STORAGE_LEGACY_PRO);
    }
  }

  function isPro() {
    migrateLegacyPro();
    return localStorage.getItem(STORAGE_PRO) === 'true';
  }

  function setPro(flag) {
    if (flag) localStorage.setItem(STORAGE_PRO, 'true');
    else {
      localStorage.removeItem(STORAGE_PRO);
      localStorage.removeItem(STORAGE_LEGACY_PRO);
    }
  }

  function getInstanceName() {
    let id = localStorage.getItem(STORAGE_INSTANCE);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? `aerocabin-${crypto.randomUUID()}`
        : `aerocabin-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(STORAGE_INSTANCE, id);
    }
    return id;
  }

  function isSoundscapeLocked(id) {
    if (isPro()) return false;
    return !FREE_SOUNDSCAPES.has(id);
  }

  function isBackgroundLocked(id) {
    if (isPro()) return false;
    return !FREE_BACKGROUNDS.has(id);
  }

  function isDurationLocked(min) {
    if (isPro()) return false;
    return Number(min) > FREE_DURATION_MAX_MIN;
  }

  function isSceneLocked(sceneId) {
    if (isPro()) return false;
    return PRO_SCENES.has(sceneId);
  }

  function ensureModal() {
    if (modalEl && document.body.contains(modalEl)) return modalEl;
    modalEl = document.getElementById('focus-paywall');
    return modalEl;
  }

  function t(key, paramsOrFallback) {
    const params = paramsOrFallback && typeof paramsOrFallback === 'object' && !Array.isArray(paramsOrFallback)
      ? paramsOrFallback
      : undefined;
    if (typeof I18n !== 'undefined') return I18n.t(key, params);
    if (params?.feature) return `Unlock Pro — ${params.feature}`;
    return typeof paramsOrFallback === 'string' ? paramsOrFallback : key;
  }

  function setPaywallCopy() {
    const modal = ensureModal();
    if (!modal) return;
    const title = modal.querySelector('#focus-paywall-title');
    const copy = modal.querySelector('.focus-paywall-copy');
    const eyebrow = modal.querySelector('.focus-paywall-eyebrow');
    const note = modal.querySelector('.focus-paywall-note');
    const perks = modal.querySelector('.focus-paywall-perks');
    const buy = modal.querySelector('#focus-paywall-buy');
    const dismiss = modal.querySelector('.focus-paywall-dismiss');
    const licenseToggle = modal.querySelector('#focus-paywall-license-toggle');
    const licenseBlock = modal.querySelector('#focus-paywall-license-block');
    const priceLabel = modal.querySelector('.focus-paywall-price-label');
    const price = modal.querySelector('.focus-paywall-price');
    const licenseLabel = modal.querySelector('[for="focus-paywall-key"]');
    const licenseInput = modal.querySelector('#focus-paywall-key');
    const activateBtn = modal.querySelector('#focus-paywall-activate');

    if (eyebrow) eyebrow.textContent = t('proEyebrow', 'AeroCabin Pro');
    if (title) title.textContent = t('proTitle', 'Unlock the complete cabin experience.');
    if (copy) copy.textContent = t('proCopy', 'More immersive scenes,\nsoundscapes and relaxation modes.');
    if (perks) {
      perks.innerHTML = [1, 2, 3, 4, 5].map((i) => `<li>${t(`proPerk${i}`, `Pro perk ${i}`)}</li>`).join('');
    }
    if (priceLabel) priceLabel.textContent = t('proPriceLabel', 'Founder Price');
    if (price) price.textContent = t('proPrice', '$14.99 Lifetime');
    if (note) note.textContent = t('proNote', 'Paste the license key from your purchase email.');
    if (buy) buy.textContent = t('proBuy', 'Unlock Pro');
    if (dismiss) dismiss.textContent = t('proLater', 'Maybe later');
    if (licenseToggle) licenseToggle.textContent = t('proLicenseToggle', 'Already purchased? Enter license key');
    if (licenseBlock) licenseBlock.hidden = true;
    if (licenseLabel) licenseLabel.textContent = t('proLicenseLabel', 'License key');
    if (licenseInput) licenseInput.placeholder = t('proLicensePlaceholder', 'Paste your license key');
    if (activateBtn) {
      activateBtn.textContent = activating
        ? t('proActivating', 'Activating…')
        : t('proActivate', 'Activate');
    }
  }

  function setActivationStatus(message, type = 'info') {
    const status = ensureModal()?.querySelector('#focus-paywall-status');
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
    status.classList.remove('is-success', 'is-error');
    if (type === 'success') status.classList.add('is-success');
    if (type === 'error') status.classList.add('is-error');
  }

  function setActivating(flag) {
    activating = flag;
    const modal = ensureModal();
    const activateBtn = modal?.querySelector('#focus-paywall-activate');
    const licenseInput = modal?.querySelector('#focus-paywall-key');
    if (activateBtn) {
      activateBtn.disabled = flag;
      activateBtn.textContent = flag
        ? t('proActivating', 'Activating…')
        : t('proActivate', 'Activate');
    }
    if (licenseInput) licenseInput.disabled = flag;
  }

  function openPaywall(featureLabel = null, onUnlock) {
    pendingAction = typeof onUnlock === 'function' ? onUnlock : null;
    const modal = ensureModal();
    if (!modal) {
      console.warn('[ProGate] paywall modal missing');
      return false;
    }
    setPaywallCopy();
    setActivationStatus('');
    setActivating(false);
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('focus-paywall-open');
    modal.querySelector('#focus-paywall-buy')?.focus();
    return false;
  }

  function closePaywall() {
    const modal = ensureModal();
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('focus-paywall-open');
    setActivating(false);
    const licenseBlock = modal.querySelector('#focus-paywall-license-block');
    if (licenseBlock) licenseBlock.hidden = true;
  }

  function unlockPro({ closeDelay = 0 } = {}) {
    setPro(true);
    syncAllLocks();
    const finish = () => {
      closePaywall();
      try { pendingAction?.(); } catch (e) { console.warn('[ProGate] unlock action', e); }
      pendingAction = null;
    };
    if (closeDelay > 0) window.setTimeout(finish, closeDelay);
    else finish();
  }

  async function activateLicense(licenseKey) {
    const body = new URLSearchParams({
      license_key: licenseKey.trim(),
      instance_name: getInstanceName(),
    });

    const res = await fetch(LEMON_ACTIVATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      throw new Error('Invalid response');
    }
    return data;
  }

  async function handleActivate() {
    if (activating) return;
    const modal = ensureModal();
    const licenseInput = modal?.querySelector('#focus-paywall-key');
    const licenseKey = licenseInput?.value?.trim();

    if (!licenseKey) {
      setActivationStatus(t('proLicenseRequired', 'Please enter your license key.'), 'error');
      licenseInput?.focus();
      return;
    }

    setActivating(true);
    setActivationStatus('');

    try {
      const data = await activateLicense(licenseKey);
      if (data?.activated === true) {
        saveLicenseKey(licenseKey);
        setActivationStatus(MSG.success, 'success');
        unlockPro({ closeDelay: 1400 });
        return;
      }
      setActivationStatus(MSG.fail, 'error');
    } catch (e) {
      console.warn('[ProGate] license activate failed', e);
      setActivationStatus(MSG.fail, 'error');
    } finally {
      setActivating(false);
    }
  }

  function openCheckout() {
    window.open(LEMON_CHECKOUT_URL, '_blank', 'noopener,noreferrer');
  }

  /**
   * @returns {boolean} true = 已放行；false = 已弹出付费窗
   */
  function requirePro(featureLabel, onUnlock) {
    if (isPro()) return true;
    openPaywall(featureLabel || t('proFeature', 'Pro'), onUnlock);
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
    el.style.pointerEvents = 'auto';
    if (locked) {
      el.setAttribute('aria-label', t('proLocked', { label }));
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
      markEl(btn, isSoundscapeLocked(id), labelOf(btn));
    });
  }

  function syncBackgroundLocks(root = document) {
    root.querySelectorAll('.bg-sheet-card[data-scene-bg]').forEach((btn) => {
      const id = btn.dataset.sceneBg;
      markEl(btn, isBackgroundLocked(id), labelOf(btn));
    });
  }

  function syncTheaterLocks() {
    document.querySelectorAll('.aura-theater-btn:not([hidden]):not(.aura-pro-btn)').forEach((btn) => {
      markEl(btn, !isPro(), labelOf(btn));
    });
  }

  function syncProShortcutButtons() {
    document.querySelectorAll('.aura-pro-btn').forEach((btn) => {
      const hidden = isPro();
      btn.hidden = hidden;
      btn.toggleAttribute('hidden', hidden);
      btn.setAttribute('aria-hidden', hidden ? 'true' : 'false');
    });
  }

  function bindProShortcutButtons() {
    document.querySelectorAll('.aura-pro-btn').forEach((btn) => {
      if (btn.dataset.proShortcutBound === '1') return;
      btn.dataset.proShortcutBound = '1';

      let last = 0;
      let touchHandled = false;
      const run = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - last < 400) return;
        if (e.type === 'click' && touchHandled) {
          touchHandled = false;
          return;
        }
        last = now;
        if (e.type === 'touchend') touchHandled = true;
        if (isPro()) return;
        openPaywall(t('proFeature', 'Pro'));
      };

      btn.addEventListener('touchend', run, { passive: false });
      btn.addEventListener('click', run);
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
        veil.innerHTML = `<span class="pro-key">${KEY_SVG}</span><span>${t('oasisVeil', 'Create your own cabin soundscape · Pro unlock')}</span>`;
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
      markEl(btn, isDurationLocked(min), labelOf(btn));
    });
  }

  function syncSceneLocks() {
    document.querySelectorAll('.scene-card[data-scene]').forEach((btn) => {
      const id = btn.dataset.scene;
      const label = btn.querySelector('.scene-label')?.textContent?.trim() || labelOf(btn) || id;
      markEl(btn, isSceneLocked(id), label);
    });
  }

  function syncAllLocks() {
    syncSoundscapeLocks();
    syncBackgroundLocks();
    syncTheaterLocks();
    syncProShortcutButtons();
    syncSceneLocks();
    syncOasisLocks();
    syncDurationLocks();
  }

  function init() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.has('resetPro') || q.get('pro') === '0') {
        localStorage.removeItem(STORAGE_PRO);
        localStorage.removeItem(STORAGE_LEGACY_PRO);
        localStorage.removeItem(STORAGE_LICENSE);
      } else {
        restoreProState();
      }
    } catch {
      restoreProState();
    }

    const modal = ensureModal();
    modal?.addEventListener('click', (e) => {
      if (e.target.closest('#focus-paywall-buy')) {
        e.preventDefault();
        openCheckout();
        return;
      }
      if (e.target.closest('#focus-paywall-license-toggle')) {
        e.preventDefault();
        const block = modal.querySelector('#focus-paywall-license-block');
        if (block) {
          block.hidden = !block.hidden;
          if (!block.hidden) block.querySelector('#focus-paywall-key')?.focus();
        }
        return;
      }
      if (e.target.closest('#focus-paywall-activate')) {
        e.preventDefault();
        handleActivate();
        return;
      }
      if (e.target.closest('[data-paywall-close]') || e.target.closest('.focus-paywall-backdrop')) {
        e.preventDefault();
        closePaywall();
      }
    });

    modal?.querySelector('#focus-paywall-key')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleActivate();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl?.classList.contains('open')) closePaywall();
    });

    document.addEventListener('click', (e) => {
      const veil = e.target.closest('.pro-panel-veil');
      if (!veil) return;
      e.preventDefault();
      e.stopPropagation();
      requirePro(t('asmrMixer', 'Create your own cabin soundscape'));
    });

    syncAllLocks();
    bindProShortcutButtons();

    if (typeof I18n !== 'undefined') {
      I18n.onChange(() => {
        syncAllLocks();
        if (modalEl?.classList.contains('open')) {
          setPaywallCopy();
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
    isBackgroundLocked,
    isDurationLocked,
    isSceneLocked,
    syncAllLocks,
    syncSceneLocks,
    syncProShortcutButtons,
    syncDurationLocks,
    syncSoundscapeLocks,
    syncBackgroundLocks,
    syncOasisLocks,
    FREE_SOUNDSCAPES,
    FREE_BACKGROUNDS,
    FREE_DURATION_MAX_MIN,
    preserveForNavigation,
    init,
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ProGate.init());
} else {
  ProGate.init();
}
