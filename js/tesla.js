/** 特斯拉 / 车机浏览器音频解锁 + 剧院模式（Theater Mode） */
const APP_CANONICAL = 'https://lareates.github.io/my-first-app/';
const THEATER_FLAG = 'aetheris-theater';
/** 国行全屏跳板：须为「无路径」根站，才能通过 1905 校验（与 s3xy.top 同理） */
const THEATER_BOUNCE_ORIGIN = 'https://lareates.github.io';

async function unlockAndPlay(playFn) {
  try {
    const ctx = await AudioEngine.resume();
    if (ctx && ctx.state === 'suspended') await ctx.resume();
    playFn();
  } catch (e) {
    console.error('Audio unlock failed', e);
  }
}

function showAudioToast(show, msg) {
  return { show, msg };
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
 * 原理说明（与 s3xy / kylehe 博客同类，不经过 s3xy.top）：
 * - 车机顶部白色地址栏是系统 chrome，网页 JS 藏不掉
 * - 国行：腾讯视频 search_redirect → 1905 open redirect → 回流目标站
 * - 1905 校验很粗暴：取「// 之后到第一个 /」的字符串，需以 1905.com 等结尾
 * - 因此目标必须是「根域名 + ?…&www.1905.com」（不能带 /my-first-app/ 路径）
 * - s3xy 能回去是因为它自己就是根域名；我们用 lareates.github.io 根站做跳板再进 App
 */
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
    url.searchParams.set('theater', '1');
    return url.toString();
  } catch {
    return `${APP_CANONICAL}?theater=1`;
  }
}

/**
 * 构造能通过 1905 校验的回流地址（与 s3xy 完全同型）：
 *   https://lareates.github.io?www.1905.com
 * 不能带 /my-first-app/ 路径，否则 1905 会把你踢回电影网首页。
 * 根站 theater-root/index.html 再 302 到真正的 App。
 */
function getChinaTheaterBounceUrl() {
  return `${THEATER_BOUNCE_ORIGIN}?www.1905.com`;
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

/**
 * 国内：与 s3xy「跳转全屏」同一链路，但落地页是我们自己的站
 * 腾讯视频 → 1905 → lareates.github.io 跳板 → my-first-app（全屏态）
 */
function enterTeslaTheaterModeChina() {
  // 编码方式对齐 s3xy：外层 url= 做一次 encode，避免查询串被截断；
  // 同时保持「腾讯视频 → 1905 → 自己的根站」自动跳转（白名单内无需「确认前往」）。
  const bounce = getChinaTheaterBounceUrl();
  const redirect1905 = `https://www.1905.com/api/redirec.html?redirect_url=${encodeURIComponent(bounce)}`;
  const finalUrl = `https://v.qq.com/search_redirect.html?url=${encodeURIComponent(redirect1905)}`;
  try { sessionStorage.setItem(THEATER_FLAG, '1'); } catch {}
  location.href = finalUrl;
}

/** 海外：YouTube redirect → 确认后回流本站 */
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

/** 调试：localStorage.setItem('aetheris-theater-region','cn'|'intl') */
function syncTheaterButtons() {
  const useCn = isChinaBrowserRegion();
  document.querySelectorAll('.aura-theater-btn').forEach((btn) => {
    const type = btn.dataset.theater;
    const show = useCn ? type === 'cn' : type === 'yt';
    btn.hidden = !show;
    btn.toggleAttribute('hidden', !show);
    btn.setAttribute('aria-hidden', show ? 'false' : 'true');
  });
  if (typeof ProGate !== 'undefined') ProGate.syncTheaterLocks();
}

function initTheaterModeUi() {
  if (isTheaterMode()) markTheaterMode();
  syncTheaterButtons();
  if (typeof I18n !== 'undefined') I18n.onChange(syncTheaterButtons);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.aura-theater-btn');
    if (!btn) return;

    e.preventDefault();
    const type = btn.dataset.theater;
    const label = type === 'cn'
      ? (typeof I18n !== 'undefined' ? I18n.t('theaterCn') : 'Tencent Fullscreen')
      : (typeof I18n !== 'undefined' ? I18n.t('theaterYt') : 'YT Fullscreen');

    const enter = () => {
      if (type === 'cn') enterTeslaTheaterModeChina();
      else if (type === 'yt') enterTeslaTheaterModeViaYouTube();
    };

    if (typeof ProGate !== 'undefined' && !ProGate.requirePro(label, enter)) return;
    enter();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheaterModeUi);
} else {
  initTheaterModeUi();
}
