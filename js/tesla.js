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

  if (linuxChrome && coarse && carLikeScreen) return true;
  if (zhCn && coarse && noHover && carLikeScreen) return true;
  if (coarse && noHover && carLikeScreen && chromiumLike && !/Android|iPhone|iPad/i.test(ua)) return true;
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
  return params.get('theater') === '1' || params.has('www.1905.com') || isBounceReferrer();
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

function getTheaterBounceOrigin() {
  // 1905 校验要求「无路径」根站；aerocabin.app 常被拒，统一走 github.io 根站跳板
  return THEATER_BOUNCE_ORIGIN;
}

/**
 * 国行经典跳板（博客同款格式）：
 * redirect_url = https://lareates.github.io/?www.1905.com
 * 不要附加 to= 等额外参数，否则 1905 校验失败会停在自己首页。
 * 根站旧跳板默认会转到 /my-first-app/?theater=1
 */
function buildChina1905RedirectUrl() {
  // 注意：redirect_url 内层不再 encode；由表单提交时浏览器统一编码一次
  return 'https://www.1905.com/api/redirec.html?redirect_url=https://lareates.github.io/?www.1905.com';
}

/** 完整国行触发 URL（等价于地址栏粘贴的经典写法） */
function getChinaTheaterLaunchHref() {
  return 'https://v.qq.com/search_redirect.html?url=' + encodeURIComponent(buildChina1905RedirectUrl());
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
  if (langs.some((l) => l === 'zh-cn' || l.startsWith('zh-cn') || l === 'zh' || l.startsWith('zh-'))) {
    // zh-TW / zh-HK 仍优先海外 YouTube；仅大陆倾向国行
    if (langs.some((l) => l === 'zh-tw' || l.startsWith('zh-tw') || l === 'zh-hk' || l.startsWith('zh-hk'))) {
      /* fall through to tz check */
    } else if (langs.some((l) => l === 'zh-cn' || l.startsWith('zh-cn'))) {
      return true;
    }
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const cnZones = ['Asia/Shanghai', 'Asia/Chongqing', 'Asia/Urumqi', 'Asia/Harbin', 'Asia/Kashgar'];
    if (cnZones.includes(tz)) return true;
  } catch { /* ignore */ }
  return false;
}

/**
 * 用 GET form 原生提交跳转——车机 OTA 后对 JS location / 程序化 a.click 常静默拦截，
 * 但对用户触发的 form submit 仍会导航。
 */
function syncTheaterForm(form) {
  if (!form) return;
  const type = form.dataset.theater;
  const input = form.querySelector('input[data-theater-param]');
  const btn = form.querySelector('.aura-theater-btn');
  form.hidden = false;
  form.removeAttribute('hidden');
  form.setAttribute('aria-hidden', 'false');

  if (type === 'cn') {
    form.action = 'https://v.qq.com/search_redirect.html';
    form.method = 'get';
    if (input) {
      input.name = 'url';
      // 经典格式：redirect_url=根站/?www.1905.com（不要 to=，不要预先 encode 内层）
      input.value = buildChina1905RedirectUrl();
    }
  } else {
    form.action = 'https://www.youtube.com/redirect';
    form.method = 'get';
    if (input) {
      input.name = 'q';
      input.value = getTheaterReturnUrl();
    }
  }

  if (btn) {
    btn.hidden = false;
    btn.removeAttribute('hidden');
    btn.setAttribute('aria-hidden', 'false');
    if (typeof I18n !== 'undefined') {
      btn.textContent = I18n.t(type === 'cn' ? 'theaterCn' : 'theaterYt');
    }
  }
}

function bindTheaterForm(form) {
  if (!form || form.dataset.theaterBound === '1') return;
  form.dataset.theaterBound = '1';

  // 提交前同步刷新参数；国行改用经典完整 URL 跳转（避免错误编码导致停在 1905）
  form.addEventListener('submit', (e) => {
    preserveProBeforeRedirect();
    clearTheaterMode();
    resumeAudioIfNeeded();
    syncTheaterForm(form);
    if (form.dataset.theater === 'cn') {
      e.preventDefault();
      window.location.href = getChinaTheaterLaunchHref();
    }
  });

  const btn = form.querySelector('.aura-theater-btn');
  if (btn) {
    btn.addEventListener('pointerdown', () => syncTheaterForm(form), { passive: true });
    btn.addEventListener('touchstart', () => syncTheaterForm(form), { passive: true });
  }
}

function reorderTheaterForms(container) {
  if (!container) return;
  const preferCn = isChinaBrowserRegion();
  const yt = container.querySelector('form.aura-theater-form[data-theater="yt"]');
  const cn = container.querySelector('form.aura-theater-form[data-theater="cn"]');
  if (!yt || !cn) return;
  if (preferCn && yt.compareDocumentPosition(cn) & Node.DOCUMENT_POSITION_FOLLOWING) {
    container.insertBefore(cn, yt);
  } else if (!preferCn && cn.compareDocumentPosition(yt) & Node.DOCUMENT_POSITION_FOLLOWING) {
    container.insertBefore(yt, cn);
  }
}

function isTeslaTheaterReturn() {
  if (theaterBounceActive) return true;
  if (isConfirmedBounceLanding()) {
    theaterBounceActive = true;
    return true;
  }
  return false;
}

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
  if (isTeslaTheaterReturn()) {
    markTheaterMode();
    return;
  }
  clearTheaterMode();
}

function syncTheaterButtons() {
  // 海外 + 国行两个入口都显示，避免区域误判导致「点了没反应」
  document.querySelectorAll('.aura-theater-actions').forEach((actions) => {
    reorderTheaterForms(actions);
  });

  document.querySelectorAll('form.aura-theater-form[data-theater]').forEach((form) => {
    syncTheaterForm(form);
    bindTheaterForm(form);
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
