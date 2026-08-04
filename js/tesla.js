/** 特斯拉 / 车机浏览器音频解锁 + 浏览器全屏 */
const APP_CANONICAL = 'https://aerocabin.app/';
const THEATER_FLAG = 'aetheris-theater';
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

function theaterLabel() {
  return typeof I18n !== 'undefined' ? I18n.t('theaterCn') : 'Immersive Mode';
}

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

async function tryBrowserFullscreen() {
  try {
    if (isBrowserFullscreenActive()) {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
      return true;
    }
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
  return false;
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
 * 车机触控：全屏按钮需独立绑定 touchend，document 委托在 QtWebEngine 上常失效
 */
function bindTheaterButton(btn) {
  if (!btn || btn.dataset.theaterBound === '1') return;
  btn.dataset.theaterBound = '1';

  let last = 0;
  let touchHandled = false;

  const run = (e) => {
    if (btn.hidden) return;
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

    const type = btn.dataset.theater;
    const label = theaterLabel();

    const enter = async () => {
      await resumeAudioIfNeeded();
      // 车机 QtWebEngine 通常不支持 Fullscreen API，失败则走 Theater 外链回流
      if (await tryBrowserFullscreen()) return;

      preserveProBeforeRedirect();
      if (type === 'cn') enterTeslaTheaterModeChina();
      else enterTeslaTheaterModeViaYouTube();
    };

    const launch = () => {
      if (typeof ProGate !== 'undefined' && !ProGate.requirePro(label, enter)) return;
      enter();
    };

    resumeAudioIfNeeded().finally(launch);
  };

  btn.addEventListener('touchend', run, { passive: false });
  btn.addEventListener('click', run);
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

function isTheaterMode() {
  try {
    if (sessionStorage.getItem(THEATER_FLAG) === '1') return true;
  } catch {}
  const params = new URLSearchParams(location.search);
  if (params.get('theater') === '1') return true;
  const ref = document.referrer || '';
  return (
    ref.startsWith('https://www.youtube.com/') ||
    ref.startsWith('https://youtube.com/') ||
    ref.includes('1905.com') ||
    ref.includes('v.qq.com')
  );
}

function markTheaterMode() {
  try { sessionStorage.setItem(THEATER_FLAG, '1'); } catch {}
  document.documentElement.classList.add('theater-mode');
  try {
    const url = new URL(location.href);
    if (url.searchParams.has('theater')) {
      url.searchParams.delete('theater');
      history.replaceState({}, '', url.pathname + url.search + url.hash);
    }
  } catch {}
}

function enterTeslaTheaterModeChina() {
  const bounce = getChinaTheaterBounceUrl();
  const redirect1905 = `https://www.1905.com/api/redirec.html?redirect_url=${encodeURIComponent(bounce)}`;
  const finalUrl = `https://v.qq.com/search_redirect.html?url=${encodeURIComponent(redirect1905)}`;
  try { sessionStorage.setItem(THEATER_FLAG, '1'); } catch {}
  location.href = finalUrl;
}

function enterTeslaTheaterModeViaYouTube() {
  const target = getTheaterReturnUrl();
  try { sessionStorage.setItem(THEATER_FLAG, '1'); } catch {}
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
  if (isTheaterMode()) markTheaterMode();
  syncTheaterButtons();
  if (typeof I18n !== 'undefined') I18n.onChange(syncTheaterButtons);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheaterModeUi);
} else {
  initTheaterModeUi();
}
