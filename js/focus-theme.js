/**
 * Focus Mode · Heritage Theme Switcher
 * 皮肤切换框架 + Pro 付费阻拦（Lemon Squeezy）
 *
 * 暂时隐藏 UI：把 HERITAGE_UI_VISIBLE 改成 true 即可重新显示
 * （主题条 / 预览文案 / 表盘占位 / 付费弹窗 / 911 集群）
 */
const FocusTheme = (() => {
  /** @type {boolean} 改 true 恢复 Heritage 皮肤切换与付费入口 */
  const HERITAGE_UI_VISIBLE = false;

  const themes = ['default', 'porsche-911', 'gtr-rmode'];
  const PRO_THEMES = new Set(['porsche-911', 'gtr-rmode']);
  const STORAGE_THEME = 'aetheris-focus-theme';
  const STORAGE_PRO = 'isPro';
  /** 替换为你的 Lemon Squeezy 结账链接 */
  const LEMON_CHECKOUT_URL = 'https://aetheris.lemonsqueezy.com/checkout/buy/heritage-themes';

  const THEME_META = {
    default: {
      css: 'theme-default',
      label: 'Default',
      hint: 'Zen Soft Clock',
    },
    'porsche-911': {
      css: 'theme-porsche',
      label: 'Porsche 911',
      hint: 'Heritage · Pro',
    },
    'gtr-rmode': {
      css: 'theme-gtr',
      label: 'GTR R-Mode',
      hint: 'Heritage · Pro',
    },
  };

  let currentTheme = 'default';
  let screen = null;
  let previewEl = null;
  let modalEl = null;
  let chipRoot = null;
  let pendingProTheme = 'porsche-911';

  function isPro() {
    return localStorage.getItem(STORAGE_PRO) === 'true';
  }

  /** 开发调试：localStorage.setItem('isPro','true') */
  function setPro(flag) {
    if (flag) localStorage.setItem(STORAGE_PRO, 'true');
    else localStorage.removeItem(STORAGE_PRO);
  }

  function themeCssClass(id) {
    return THEME_META[id]?.css || 'theme-default';
  }

  function readStoredTheme() {
    const saved = localStorage.getItem(STORAGE_THEME);
    if (themes.includes(saved)) return saved;
    return 'default';
  }

  function applyThemeClass(id) {
    if (!screen) return;
    themes.forEach(t => screen.classList.remove(themeCssClass(t)));
    screen.classList.add(themeCssClass(id));
    screen.dataset.focusTheme = id;
  }

  function syncChips() {
    chipRoot?.querySelectorAll('[data-focus-theme]').forEach(btn => {
      const on = btn.dataset.focusTheme === currentTheme;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function syncPreview() {
    if (!previewEl) return;
    const meta = THEME_META[currentTheme] || THEME_META.default;
    previewEl.textContent = `THEME / ${meta.label.toUpperCase()} · ${meta.hint}`;
  }

  function ensureModal() {
    if (modalEl && document.body.contains(modalEl)) return modalEl;
    modalEl = document.getElementById('focus-paywall');
    return modalEl;
  }

  function openPaywall(forTheme = 'porsche-911') {
    pendingProTheme = forTheme;
    const modal = ensureModal();
    if (!modal) {
      console.warn('[FocusTheme] paywall modal missing');
      return;
    }
    const lemon = modal.querySelector('#focus-paywall-lemon');
    if (lemon) lemon.href = LEMON_CHECKOUT_URL;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('focus-paywall-open');
  }

  function closePaywall() {
    const modal = ensureModal();
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('focus-paywall-open');
  }

  function applySkinSideEffects(id) {
    if (id === 'porsche-911' && typeof PorscheCluster !== 'undefined') {
      PorscheCluster.show();
    } else if (typeof PorscheCluster !== 'undefined') {
      PorscheCluster.hide();
    }
  }

  function setTheme(id, { persist = true, force = false } = {}) {
    if (!themes.includes(id)) return false;

    if (!force && PRO_THEMES.has(id) && !isPro()) {
      openPaywall(id);
      return false;
    }

    currentTheme = id;
    applyThemeClass(id);
    syncChips();
    syncPreview();
    if (persist) localStorage.setItem(STORAGE_THEME, id);
    closePaywall();
    applySkinSideEffects(id);
    return true;
  }

  function unlockAndApplyPending() {
    setPro(true);
    const target = PRO_THEMES.has(pendingProTheme) ? pendingProTheme : 'porsche-911';
    setTheme(target, { force: true });
  }

  function applyUiVisibility() {
    document.documentElement.classList.toggle('heritage-ui-off', !HERITAGE_UI_VISIBLE);
  }

  function init(screenEl, cleanupFns) {
    screen = screenEl || document.getElementById('scene-focus');
    if (!screen) return;

    applyUiVisibility();

    chipRoot = document.getElementById('focus-theme-chips');
    previewEl = document.getElementById('focus-theme-preview');
    modalEl = ensureModal();

    const ac = new AbortController();

    // UI 隐藏期间强制默认皮肤；显示时再尊重本地存储 / Pro
    let initial = 'default';
    if (HERITAGE_UI_VISIBLE) {
      initial = readStoredTheme();
      if (PRO_THEMES.has(initial) && !isPro()) initial = 'default';
    }
    setTheme(initial, { persist: false, force: true });

    if (!HERITAGE_UI_VISIBLE) {
      cleanupFns.push(() => {
        document.documentElement.classList.remove('heritage-ui-off');
      });
      return;
    }

    chipRoot?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-focus-theme]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      setTheme(btn.dataset.focusTheme);
    }, { signal: ac.signal });

    modalEl?.addEventListener('click', (e) => {
      if (e.target.closest('[data-paywall-preview]')) {
        e.preventDefault();
        unlockAndApplyPending();
        return;
      }
      if (e.target.closest('[data-paywall-close]')) {
        e.preventDefault();
        closePaywall();
      }
    }, { signal: ac.signal });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalEl?.classList.contains('open')) closePaywall();
    }, { signal: ac.signal });

    cleanupFns.push(() => {
      ac.abort();
      closePaywall();
    });
  }

  return {
    themes,
    get currentTheme() { return currentTheme; },
    get uiVisible() { return HERITAGE_UI_VISIBLE; },
    isPro,
    setPro,
    setTheme,
    openPaywall,
    closePaywall,
    unlockAndApplyPending,
    init,
  };
})();
