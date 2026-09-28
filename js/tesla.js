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
  const chromiumLike = /Chrome\//i.test(ua) || /CriOS\//i.test(ua);
  const zhCn = (() => {
    const langs = [navigator.language, ...(navigator.languages || [])].filter(Boolean).map((l) => l.toLowerCase());
    return langs.some((l) => l === 'zh-cn' || l.startsWith('zh-cn'));
  })();

  // 常见车机：Linux Chrome + 触控大屏；或中文区 + 触控大屏
  if (linuxChrome && coarse && carLikeScreen) return true;
  if (zhCn && coarse && noHover && carLikeScreen) return true;
  // OTA 后 UA 可能变化：大屏触控 + Chromium 仍按车机处理
  if (coarse && noHover && carLikeScreen && chromiumLike && !/Android|iPhone|iPad/i.test(ua)) return true;
  return false;
}

/**
 * 是否必须走 YouTube/1905 跳板。
 * 比 isCarBrowser 更宽：触控大屏绝不信任 Fullscreen API（常假成功、看起来像没反应）。
 */
function shouldUseTheaterBounce() {
  if (isCarBrowser()) return true;
  try {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const noHover = window.matchMedia('(hover: none)').matches;
    const w = Math.max(screen.width || 0, screen.height || 0);
    const h = Math.min(screen.width || 0, screen.height || 0);
    if (coarse && noHover && w >= 1000 && h >= 600) return true;
  } catch { /* ignore */ }
  return false;
}

/** 顶层同步跳转（必须在用户手势回调里同步调用；await 之后会被车机静默拦截） */
function navigateTopLevel(url) {
  if (!url) return;
  try {
    window.location.href = url;
  } catch {
    try { window.location.assign(url); } catch { /* ignore */ }
  }
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

function resumeAudioIfNeeded() {
  try {
    if (typeof AudioEngine === 'undefined') return;
    const p = AudioEngine.resume();
    if (p && typeof p.then === 'function') {
      p.then((ctx) => {
        if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      }).catch((e) => {
        console.warn('[Theater] Audio resume skipped', e);
      });
    }
  } catch (e) {
    console.warn('[Theater] Audio resume skipped', e);
  }
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

/** 沉浸模式最终跳转 URL（始终走跳板，不信任 Fullscreen API） */
function getTheaterLaunchUrl(type) {
  if (type === 'cn') {
    const bounce = getChinaTheaterBounceUrl();
    const redirect1905 = `https://www.1905.com/api/redirec.html?redirect_url=${encodeURIComponent(bounce)}`;
    return `https://v.qq.com/search_redirect.html?url=${encodeURIComponent(redirect1905)}`;
  }
  return `https://www.youtube.com/redirect?q=${encodeURIComponent(getTheaterReturnUrl())}`;
}

function enterTeslaTheaterModeChina() {
  navigateTopLevel(getTheaterLaunchUrl('cn'));
}

function enterTeslaTheaterModeViaYouTube() {
  navigateTopLevel(getTheaterLaunchUrl('yt'));
}

/**
 * 车机全屏只能靠外链跳板；失败时绝不改 UI（不藏 Pro / 沉浸模式）
 * 必须在用户手势同步路径调用。
 */
function enterTheaterWithFallback(type) {
  preserveProBeforeRedirect();
  clearTheaterMode();
  if (type === 'cn') enterTeslaTheaterModeChina();
  else enterTeslaTheaterModeViaYouTube();
}

/**
 * 沉浸模式入口：用真实 <a href> 原生导航。
 * OTA 后 JS location / 带 preventDefault 的 touch 处理常被静默拦截；
 * 原生链接点击是目前车机上最稳的方式。
 */
function bindTheaterButton(btn) {
  if (!btn || btn.dataset.theaterBound === '1') return;
  btn.dataset.theaterBound = '1';

  const refreshHref = () => {
    const url = getTheaterLaunchUrl(btn.dataset.theater);
    if (btn.tagName === 'A') {
      btn.setAttribute('href', url);
      btn.setAttribute('rel', 'noreferrer');
    }
    return url;
  };

  const prepare = () => {
    if (btn.hidden) return null;
    preserveProBeforeRedirect();
    clearTheaterMode();
    resumeAudioIfNeeded();
    return refreshHref();
  };

  // 在按下阶段就写好 href，确保抬手导航时属性已就绪
  btn.addEventListener('pointerdown', prepare, { capture: true });
  btn.addEventListener('touchstart', prepare, { capture: true, passive: true });

  btn.addEventListener('click', (e) => {
    if (btn.hidden) {
      e.preventDefault();
      return;
    }
    const url = prepare() || getTheaterLaunchUrl(btn.dataset.theater);
    // 不 preventDefault：保留 <a> 原生跳转；同时同步写 location 作双保险
    try { window.location.href = url; } catch { /* ignore */ }
  }, { capture: true });
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
    const url = getTheaterLaunchUrl(type);
    if (btn.tagName === 'A') {
      btn.setAttribute('href', url);
      btn.setAttribute('rel', 'noreferrer');
    }
    // 隐藏的链接去掉焦点，避免误触
    if (show) btn.removeAttribute('tabindex');
    else btn.setAttribute('tabindex', '-1');
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
