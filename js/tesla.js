/** 特斯拉 / 车机浏览器音频解锁 + 浏览器全屏 */
const APP_CANONICAL = 'https://aerocabin.app/';
const THEATER_FLAG = 'aetheris-theater-bounce';
const THEATER_FLAG_LEGACY = 'aetheris-theater';
/** 国行全屏跳板：须为「无路径」根站，才能通过 1905 校验（与 s3xy.top 同理） */
const THEATER_BOUNCE_ORIGIN = 'https://lareates.github.io';
const THEATER_BOUNCE_HOSTS = new Set([
  'https://aerocabin.app',
  'https://lareates.github.io',
]);

/** 1905 / v.qq 回流：带 ?www.1905.com&to= 时立即跳回应用 */
(function handleTheaterBounce() {
  try {
    const params = new URLSearchParams(location.search);
    const to = params.get('to');
    if (!params.has('www.1905.com') || !to) return;
    let target = to;
    if (to.charAt(0) === '/') target = `${location.origin}${to}`;
    else if (!/^https?:\/\//i.test(to)) target = `${location.origin}/${to.replace(/^\//, '')}`;
    const url = new URL(target);
    if (!url.searchParams.has('theater')) url.searchParams.set('theater', '1');
    location.replace(url.toString());
  } catch (e) {
    console.warn('[Theater] bounce redirect failed', e);
  }
})();

async function unlockAndPlay(playFn) {
  try {
    const ctx = await AudioEngine.resume();
    if (ctx && ctx.state === 'suspended') await ctx.resume();
    playFn();
  } catch (e) {
    console.error('Audio unlock failed', e);
  }
}

function bindCarPlay(btn, toggleFn) {
  if (!btn) return;
  let last = 0;
  let touchHandled = false;
  const run = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - last < 350) return;
    if (e.type === 'click' && touchHandled) {
      touchHandled = false;
      return;
    }
    last = now;
    if (e.type === 'touchend') touchHandled = true;
    unlockAndPlay(toggleFn);
  };
  btn.addEventListener('touchend', run, { passive: false });
  btn.addEventListener('click', run);
}

/**
 * 车机浏览器识别：很多特斯拉 UA 不含 Tesla，需启发式判断。
 * 可强制：localStorage.setItem('aetheris-car-browser','1')
 */
function isCarBrowser() {
  try {
    const flag = localStorage.getItem('aetheris-car-browser');
    if (flag === '1') return true;
    if (flag === '0') return false;
  } catch { /* ignore */ }

  const ua = navigator.userAgent || '';
  if (/Tesla|QtCarBrowser|QtWebEngine/i.test(ua)) return true;

  const coarse = (() => {
    try { return window.matchMedia('(pointer: coarse)').matches; } catch { return false; }
  })();
  const noHover = (() => {
    try { return window.matchMedia('(hover: none)').matches; } catch { return false; }
  })();
  const w = Math.max(screen.width || 0, screen.height || 0);
  const h = Math.min(screen.width || 0, screen.height || 0);
  const carLikeScreen = w >= 1100 && h >= 700;
  const linuxChrome = /Linux/i.test(ua) && /Chrome\//i.test(ua) && !/Android/i.test(ua);
  const zhCn = (() => {
    const langs = [navigator.language, ...(navigator.languages || [])].filter(Boolean).map((l) => l.toLowerCase());
    return langs.some((l) => l === 'zh-cn' || l.startsWith('zh-cn'));
  })();

  // 常见车机：Linux Chrome + 触控大屏；或中文区 + 触控大屏
  if (linuxChrome && coarse && carLikeScreen) return true;
  if (zhCn && coarse && noHover && carLikeScreen) return true;
  return false;
}

function isBounceReferrer() {
  const ref = document.referrer || '';
  return (
    ref.startsWith('https://www.youtube.com/') ||
    ref.startsWith('https://youtube.com/') ||
    ref.includes('1905.com') ||
    ref.includes('v.qq.com')
  );
}

function isConfirmedBounceLanding() {
  const params = new URLSearchParams(location.search);
  return params.get('theater') === '1' || isBounceReferrer();
}

/** 本次会话内已确认从跳板回流；刷新后需再次点击沉浸模式 */
let theaterBounceActive = false;

function buildTheaterReturnQuery() {
  const q = new URLSearchParams(location.search);
  q.set('theater', '1');
  q.delete('resetPro');
  if (typeof ProGate !== 'undefined' && ProGate.isPro()) q.set('pro', '1');
  return q.toString();
}

function preserveProBeforeRedirect() {
  if (typeof ProGate !== 'undefined') ProGate.preserveForNavigation?.();
}

function isBrowserFullscreenActive() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

async function exitBrowserFullscreen() {
  try {
    if (!isBrowserFullscreenActive()) return;
    if (document.exitFullscreen) await document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } catch (e) {
    console.warn('[Theater] exit fullscreen failed', e);
  }
}

async function tryBrowserFullscreen() {
  // 车机 Fullscreen API 常假成功（地址栏仍在），不要用它
  if (isCarBrowser()) return false;
  try {
    if (isBrowserFullscreenActive()) return true;
    const candidates = [document.documentElement, document.body].filter(Boolean);
    for (const el of candidates) {
      try {
        if (el.requestFullscreen) {
          await el.requestFullscreen({ navigationUI: 'hide' });
          if (isBrowserFullscreenActive()) return true;
        }
      } catch { /* try next */ }
      try {
        if (el.webkitRequestFullscreen) {
          el.webkitRequestFullscreen();
          if (isBrowserFullscreenActive()) return true;
        }
      } catch { /* try next */ }
    }
  } catch (e) {
    console.warn('[Theater] Fullscreen API unavailable', e);
  }
  return isBrowserFullscreenActive();
}

async function resumeAudioIfNeeded() {
  try {
    if (typeof AudioEngine === 'undefined') return;
    const ctx = await AudioEngine.resume();
    if (ctx && ctx.state === 'suspended') await ctx.resume();
  } catch (e) {
    console.warn('[Theater] Audio resume skipped', e);
  }
}

/**
 * 车机全屏只能靠外链跳板；失败时绝不改 UI（不藏 Pro / 沉浸模式）
 */
function enterTheaterWithFallback(type) {
  preserveProBeforeRedirect();
  clearTheaterMode();
  let navigated = false;
  window.addEventListener('pagehide', () => { navigated = true; }, { once: true });

  if (type === 'cn') enterTeslaTheaterModeChina();
  else enterTeslaTheaterModeViaYouTube();

  window.setTimeout(() => {
    if (navigated) return;
    clearTheaterMode();
    console.warn('[Theater] bounce redirect did not leave the page');
  }, 1400);
}

function bindTheaterButton(btn) {
  if (!btn || btn.dataset.theaterBound === '1') return;
  btn.dataset.theaterBound = '1';

  let last = 0;

  const run = (e) => {
    if (btn.hidden) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
    const now = Date.now();
    if (now - last < 450) return;
    last = now;

    const type = btn.dataset.theater;

    const enter = async () => {
      await resumeAudioIfNeeded();

      // 车机：只走跳板，绝不用会假成功的 Fullscreen API
      if (isCarBrowser()) {
        enterTheaterWithFallback(type);
        return;
      }

      if (isBrowserFullscreenActive()) {
        await exitBrowserFullscreen();
        return;
      }

      // 桌面 Chrome：浏览器全屏即可，不要加 theater-mode（否则会藏掉顶栏按钮）
      if (await tryBrowserFullscreen()) return;

      enterTheaterWithFallback(type);
    };

    resumeAudioIfNeeded().finally(enter);
  };

  btn.addEventListener('pointerup', run, { capture: true, passive: false });
  btn.addEventListener('touchend', run, { capture: true, passive: false });
  btn.addEventListener('click', run, { capture: true });
}

function getAppUrl() {
  try {
    const path = location.pathname.replace(/index\.html$/i, '');
    const base = `${location.origin}${path.endsWith('/') ? path : `${path}/`}`;
    return base;
  } catch {
    return APP_CANONICAL;
  }
}

function getTheaterReturnUrl() {
  try {
    const url = new URL(getAppUrl());
    url.search = `?${buildTheaterReturnQuery()}`;
    return url.toString();
  } catch {
    const pro = (typeof ProGate !== 'undefined' && ProGate.isPro()) ? '&pro=1' : '';
    return `${APP_CANONICAL}?theater=1${pro}`;
  }
}

/**
 * 构造能通过 1905 校验的回流地址，并带上当前应用路径与 Pro 恢复参数
 */
function getTheaterBounceOrigin() {
  if (THEATER_BOUNCE_HOSTS.has(location.origin)) return location.origin;
  return THEATER_BOUNCE_ORIGIN;
}

function getChinaTheaterBounceUrl() {
  const returnUrl = getTheaterReturnUrl();
  const to = encodeURIComponent(returnUrl);
  return `${getTheaterBounceOrigin()}?www.1905.com&to=${to}`;
}

function isTeslaTheaterReturn() {
  if (theaterBounceActive) return true;
  if (isConfirmedBounceLanding()) {
    theaterBounceActive = true;
    return true;
  }
  return false;
}

/** 仅在跳板回流成功后使用：藏顶栏（浏览器栏已由跳板去掉） */
function markTheaterMode() {
  document.documentElement.classList.add('theater-mode');
  try {
    const url = new URL(location.href);
    if (url.searchParams.has('theater')) {
      url.searchParams.delete('theater');
      history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  } catch {}
}

function clearTheaterMode() {
  theaterBounceActive = false;
  try {
    sessionStorage.removeItem(THEATER_FLAG);
    sessionStorage.removeItem(THEATER_FLAG_LEGACY);
  } catch {}
  document.documentElement.classList.remove('theater-mode');
}

function syncTheaterChrome() {
  // 只有真正从 YouTube/1905 跳板回来才藏顶栏。
  // 绝不能根据 Fullscreen API 藏顶栏：车机会假成功，导致 Pro/沉浸模式消失而地址栏还在。
  if (isTeslaTheaterReturn()) {
    markTheaterMode();
    return;
  }
  clearTheaterMode();
}

function enterTeslaTheaterModeChina() {
  const bounce = getChinaTheaterBounceUrl();
  const redirect1905 = `https://www.1905.com/api/redirec.html?redirect_url=${encodeURIComponent(bounce)}`;
  const finalUrl = `https://v.qq.com/search_redirect.html?url=${encodeURIComponent(redirect1905)}`;
  location.href = finalUrl;
}

function enterTeslaTheaterModeViaYouTube() {
  const target = getTheaterReturnUrl();
  location.href = `https://www.youtube.com/redirect?q=${encodeURIComponent(target)}`;
}

function isChinaBrowserRegion() {
  try {
    const override = localStorage.getItem('aetheris-theater-region');
    if (override === 'cn') return true;
    if (override === 'intl') return false;
  } catch { /* ignore */ }
  const langs = [navigator.language, ...(navigator.languages || [])]
    .filter(Boolean)
    .map((l) => l.toLowerCase());
  if (langs.some((l) => l === 'zh-cn' || l.startsWith('zh-cn'))) return true;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const cnZones = ['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Urumqi', 'Asia/Harbin', 'Asia/Kashgar'];
    if (cnZones.includes(tz)) return true;
  } catch { /* ignore */ }
  return false;
}

function syncTheaterButtons() {
  const useCn = isChinaBrowserRegion();
  document.querySelectorAll('.aura-theater-btn:not(.aura-pro-btn)').forEach((btn) => {
    const type = btn.dataset.theater;
    const show = useCn ? type === 'cn' : type === 'yt';
    btn.hidden = !show;
    btn.toggleAttribute('hidden', !show);
    btn.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (typeof I18n !== 'undefined') {
      btn.textContent = I18n.t(useCn ? 'theaterCn' : 'theaterYt');
    }
    bindTheaterButton(btn);
  });
  if (typeof ProGate !== 'undefined') {
    ProGate.syncTheaterLocks();
    ProGate.syncProShortcutButtons?.();
  }
}

function initTheaterModeUi() {
  try {
    sessionStorage.removeItem(THEATER_FLAG);
    sessionStorage.removeItem(THEATER_FLAG_LEGACY);
  } catch {}
  // 清掉上次假全屏留下的 theater-mode
  if (!isConfirmedBounceLanding()) clearTheaterMode();
  syncTheaterChrome();
  document.addEventListener('fullscreenchange', syncTheaterChrome);
  document.addEventListener('webkitfullscreenchange', syncTheaterChrome);
  syncTheaterButtons();
  if (typeof I18n !== 'undefined') I18n.onChange(syncTheaterButtons);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheaterModeUi);
} else {
  initTheaterModeUi();
}
