/** 特斯拉 / 车机浏览器音频解锁 + 剧院模式（Theater Mode） */
const APP_CANONICAL = 'https://lareates.github.io/my-first-app/';
const THEATER_FLAG = 'aetheris-theater';
const S3XY_HELPER = 'https://s3xy.top';

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
 * 原理说明（与 s3xy / Fullscreen Tesla / testube 同类）：
 * - 车机顶部白色地址栏是系统浏览器 chrome，网页 JS / requestFullscreen 藏不掉
 * - 必须先进入特斯拉「剧院模式 / Theater Mode」（由受信任的媒体站流量触发）
 * - 海外常见：https://www.youtube.com/redirect?q=<目标站>
 * - 国内常见：先用 s3xy.top「跳转全屏」进入剧院壳，再在助手地址栏打开目标站
 *   （助手本质是：触发剧院模式后的自建全屏浏览器壳，不是对本站注入魔法）
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

function isTheaterMode() {
  try {
    if (sessionStorage.getItem(THEATER_FLAG) === '1') return true;
  } catch {}
  const params = new URLSearchParams(location.search);
  if (params.get('theater') === '1') return true;
  const ref = document.referrer || '';
  return ref.startsWith('https://www.youtube.com/') || ref.startsWith('https://youtube.com/');
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
 * 国内：腾讯视频 redirect → 1905.com redirect → 回流本站
 * 利用国行特斯拉自带的「腾讯视频」触发剧院模式。
 */
function enterTeslaTheaterModeChina() {
  const target = getTheaterReturnUrl();
  // 利用 s3xy.top 提供的全屏中转服务
  // 它的原理是：s3xy.top 会下发 cookie，并跳转到 v.qq.com -> 1905.com -> s3xy.top?www.1905.com
  // 最后 s3xy.top 根据 cookie 将页面重定向回我们的 target URL
  const finalUrl = `https://s3xy.top/fullscreen/go?gate=${encodeURIComponent(target)}`;
  try { sessionStorage.setItem(THEATER_FLAG, '1'); } catch {}
  location.href = finalUrl;
}

/** 海外：YouTube redirect → 确认后回流本站 */
function enterTeslaTheaterModeViaYouTube() {
  const target = getTheaterReturnUrl();
  try { sessionStorage.setItem(THEATER_FLAG, '1'); } catch {}
  location.href = `https://www.youtube.com/redirect?q=${encodeURIComponent(target)}`;
}


function initTheaterModeUi() {
  if (isTheaterMode()) markTheaterMode();

  // 绑定所有场景右上角的剧院模式按钮
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.aura-theater-btn');
    if (!btn) return;
    
    e.preventDefault();
    const type = btn.dataset.theater;
    
    // 保持按钮状态不变，只做跳转
    if (type === 'cn') {
      enterTeslaTheaterModeChina();
    } else if (type === 'yt') {
      enterTeslaTheaterModeViaYouTube();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheaterModeUi);
} else {
  initTheaterModeUi();
}
