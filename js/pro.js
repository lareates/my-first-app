/**
 * AeroCabin Pro 门禁 · Early Access 邮箱收集（Kit）
 *
 * 调试解锁：localStorage.setItem('aerocabin_pro_unlocked','true'); location.reload()
 * 重置状态：?resetPro=1
 */
const ProGate = (() => {
  const STORAGE_PRO = 'aerocabin_pro_unlocked';
  const STORAGE_LEGACY_PRO = 'isPro';
  const STORAGE_LICENSE = 'aerocabin_license_key';
  const STORAGE_PRO_BACKUP = 'aetheris-pro-backup';
  const STORAGE_WAITLIST = 'aerocabin_waitlist_joined';
  const KIT_FORM_URL = 'https://app.kit.com/forms/9772111/subscriptions';
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

  /**
   * 暂时隐藏所有 Pro 锁定入口（露营、带锁声景、沉浸模式、壁纸切换、ASMR 调音台）
   * 后期恢复：改为 false 即可
   */
  const PRO_LOCKED_UI_HIDDEN = true;

  let modalEl = null;
  let pendingAction = null;
  let submitting = false;

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

  function isWaitlistJoined() {
    try { return localStorage.getItem(STORAGE_WAITLIST) === '1'; } catch { return false; }
  }

  function markWaitlistJoined() {
    try { localStorage.setItem(STORAGE_WAITLIST, '1'); } catch { /* ignore */ }
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

  function applyLockedUiVisibility() {
    document.documentElement.classList.toggle('pro-locked-ui-hidden', PRO_LOCKED_UI_HIDDEN);
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
    const perks = modal.querySelector('.focus-paywall-perks');
    const submitBtn = modal.querySelector('#focus-paywall-submit');
    const dismissBtns = modal.querySelectorAll('.focus-paywall-dismiss');
    const emailInput = modal.querySelector('#focus-paywall-email');
    const emailLabel = modal.querySelector('[for="focus-paywall-email"]');
    const successText = modal.querySelector('.focus-paywall-success-text');

    if (title) title.textContent = t('proTitle', 'AeroCabin Pro');
    if (copy) copy.textContent = t('proCopy', 'Unlock more immersive in-cabin experiences.');
    if (perks) {
      perks.innerHTML = [1, 2, 3, 4].map((i) => `<li>${t(`proPerk${i}`, `Pro perk ${i}`)}</li>`).join('');
    }
    if (emailLabel) emailLabel.textContent = t('proEmailLabel', 'Email');
    if (emailInput) emailInput.placeholder = t('proEmailPlaceholder', 'Enter email for launch updates');
    if (submitBtn) {
      submitBtn.textContent = submitting
        ? t('proSubmitting', 'Submitting…')
        : t('proNotify', 'Notify me');
    }
    dismissBtns.forEach((btn) => {
      btn.textContent = t('proLater', 'Continue exploring');
    });
    if (successText) successText.textContent = t('proWaitlistSuccess', "You're on the list 🌙");
  }

  function setFormStatus(message, type = 'info') {
    const status = ensureModal()?.querySelector('#focus-paywall-status');
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
    status.classList.remove('is-success', 'is-error');
    if (type === 'success') status.classList.add('is-success');
    if (type === 'error') status.classList.add('is-error');
  }

  function setSubmitting(flag) {
    submitting = flag;
    const modal = ensureModal();
    const submitBtn = modal?.querySelector('#focus-paywall-submit');
    const emailInput = modal?.querySelector('#focus-paywall-email');
    if (submitBtn) {
      submitBtn.disabled = flag;
      submitBtn.textContent = flag
        ? t('proSubmitting', 'Submitting…')
        : t('proNotify', 'Notify me');
    }
    if (emailInput) emailInput.disabled = flag;
  }

  function showWaitlistForm() {
    const modal = ensureModal();
    if (!modal) return;
    modal.querySelector('#focus-paywall-body')?.removeAttribute('hidden');
    modal.querySelector('#focus-paywall-success')?.setAttribute('hidden', '');
  }

  function showWaitlistSuccess() {
    const modal = ensureModal();
    if (!modal) return;
    modal.querySelector('#focus-paywall-body')?.setAttribute('hidden', '');
    const success = modal.querySelector('#focus-paywall-success');
    if (success) success.removeAttribute('hidden');
    setFormStatus('');
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
  }

  function submitViaHiddenForm(email) {
    return new Promise((resolve) => {
      let iframe = document.getElementById('kit-submit-frame');
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.name = 'kit-submit-frame';
        iframe.id = 'kit-submit-frame';
        iframe.className = 'kit-submit-frame';
        iframe.tabIndex = -1;
        iframe.setAttribute('aria-hidden', 'true');
        iframe.title = '';
        document.body.appendChild(iframe);
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = KIT_FORM_URL;
      form.target = 'kit-submit-frame';
      form.style.display = 'none';

      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'email_address';
      input.value = email;
      form.appendChild(input);

      document.body.appendChild(form);

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        form.remove();
        resolve(true);
      };

      const timer = window.setTimeout(finish, 2800);
      iframe.addEventListener('load', () => {
        window.clearTimeout(timer);
        finish();
      }, { once: true });

      form.submit();
    });
  }

  async function submitToKit(email) {
    const body = new URLSearchParams();
    body.set('email_address', email);

    try {
      const res = await fetch(KIT_FORM_URL, {
        method: 'POST',
        body,
        headers: { Accept: 'text/html,application/json' },
        mode: 'cors',
      });
      if (res.ok || res.type === 'opaque') return true;
    } catch { /* CORS — fall back to hidden form POST */ }

    return submitViaHiddenForm(email);
  }

  async function handleWaitlistSubmit(e) {
    e?.preventDefault();
    if (submitting) return;

    const modal = ensureModal();
    const emailInput = modal?.querySelector('#focus-paywall-email');
    const email = emailInput?.value?.trim() || '';

    if (!email) {
      setFormStatus(t('proEmailRequired', 'Please enter your email address.'), 'error');
      emailInput?.focus();
      return;
    }
    if (!isValidEmail(email)) {
      setFormStatus(t('proEmailInvalid', 'Please enter a valid email address.'), 'error');
      emailInput?.focus();
      return;
    }

    setSubmitting(true);
    setFormStatus('');

    try {
      await submitToKit(email);
      markWaitlistJoined();
      showWaitlistSuccess();
    } catch (err) {
      console.warn('[ProGate] waitlist submit failed', err);
      setFormStatus(t('proSubmitFail', 'Something went wrong. Please try again.'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  function openPaywall(featureLabel = null, onUnlock) {
    pendingAction = typeof onUnlock === 'function' ? onUnlock : null;
    const modal = ensureModal();
    if (!modal) {
      console.warn('[ProGate] paywall modal missing');
      return false;
    }
    setPaywallCopy();
    setFormStatus('');
    setSubmitting(false);
    if (isWaitlistJoined()) showWaitlistSuccess();
    else showWaitlistForm();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('focus-paywall-open');
    if (!isWaitlistJoined()) modal.querySelector('#focus-paywall-email')?.focus();
    return false;
  }

  function closePaywall() {
    const modal = ensureModal();
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('focus-paywall-open');
    setSubmitting(false);
    pendingAction = null;
  }

  /**
   * @returns {boolean} true = 已放行；false = 已弹出 Early Access 窗
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

      btn.addEventListener('pointerup', run, { capture: true, passive: false });
      btn.addEventListener('click', run, { capture: true });
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
    bindOasisProGate();
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

  function bindSoundscapeProGate() {
    document.querySelectorAll('.nap-sound-chip[data-soundscape]').forEach((btn) => {
      if (btn.dataset.proSoundBound === '1') return;
      btn.dataset.proSoundBound = '1';

      const run = (e) => {
        const id = btn.dataset.soundscape;
        if (!id || !isSoundscapeLocked(id)) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        const label = labelOf(btn) || id;
        requirePro(label, () => {
          document.dispatchEvent(new CustomEvent('aerocabin-soundscape-select', {
            detail: { id },
            bubbles: false,
          }));
        });
      };

      btn.addEventListener('pointerup', run, { capture: true, passive: false });
      btn.addEventListener('click', run, { capture: true });
    });
  }

  function bindOasisProGate() {
    document.querySelectorAll('.pro-panel-veil').forEach((veil) => {
      if (veil.dataset.proVeilBound === '1') return;
      veil.dataset.proVeilBound = '1';

      const run = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        requirePro(t('asmrMixer', 'Create your own cabin soundscape'));
      };

      veil.addEventListener('pointerup', run, { capture: true, passive: false });
      veil.addEventListener('click', run, { capture: true });
    });
  }

  function bindTheaterProGate() {
    document.querySelectorAll('.aura-theater-btn:not(.aura-pro-btn)').forEach((btn) => {
      if (btn.dataset.proTheaterBound === '1') return;
      btn.dataset.proTheaterBound = '1';

      const run = (e) => {
        if (btn.hidden || isPro()) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        const label = btn.dataset.theater === 'cn'
          ? t('theaterCn', 'Immersive Mode')
          : t('theaterYt', 'Immersive Mode');
        requirePro(label);
      };

      btn.addEventListener('pointerup', run, { capture: true, passive: false });
      btn.addEventListener('click', run, { capture: true });
    });
  }

  function bindSceneCardProGate() {
    document.querySelectorAll('.scene-card[data-scene]').forEach((btn) => {
      if (btn.dataset.proSceneBound === '1') return;
      btn.dataset.proSceneBound = '1';

      const run = (e) => {
        const scene = btn.dataset.scene;
        if (!scene || !isSceneLocked(scene)) return;
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
        const label = btn.querySelector('.scene-label')?.textContent?.trim() || scene;
        requirePro(label, () => {
          document.dispatchEvent(new CustomEvent('aerocabin-enter-scene', {
            detail: { scene },
            bubbles: false,
          }));
        });
      };

      btn.addEventListener('pointerup', run, { capture: true, passive: false });
      btn.addEventListener('click', run, { capture: true });
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
        localStorage.removeItem(STORAGE_WAITLIST);
      } else {
        restoreProState();
      }
    } catch {
      restoreProState();
    }

    const modal = ensureModal();
    modal?.querySelector('#focus-paywall-form')?.addEventListener('submit', handleWaitlistSubmit);
    modal?.querySelector('#focus-paywall-email')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleWaitlistSubmit(e);
      }
    });

    modal?.addEventListener('click', (e) => {
      if (e.target.closest('[data-paywall-close]') || e.target.closest('.focus-paywall-backdrop')) {
        e.preventDefault();
        closePaywall();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl?.classList.contains('open')) closePaywall();
    });

    syncAllLocks();
    applyLockedUiVisibility();
    bindProShortcutButtons();
    bindSceneCardProGate();
    bindSoundscapeProGate();
    bindOasisProGate();
    bindTheaterProGate();

    if (typeof I18n !== 'undefined') {
      I18n.onChange(() => {
        syncAllLocks();
        applyLockedUiVisibility();
        bindSoundscapeProGate();
        bindOasisProGate();
        bindTheaterProGate();
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
    PRO_LOCKED_UI_HIDDEN,
    applyLockedUiVisibility,
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => ProGate.init());
} else {
  ProGate.init();
}
