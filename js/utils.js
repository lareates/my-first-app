const pad = (n) => String(n).padStart(2, '0');

function formatDate(d) {
  const tag = (typeof I18n !== 'undefined') ? I18n.localeTag() : 'en-US';
  return d.toLocaleDateString(tag, { weekday: 'long', month: 'long', day: 'numeric' });
}

function startClock(updateFn, interval = 1000) {
  updateFn();
  const id = setInterval(updateFn, interval);
  return () => clearInterval(id);
}

/** 低通滤波 — 陀螺仪平滑 */
function createSmoother(alpha = 0.12) {
  let x = 0, y = 0;
  return {
    update(nx, ny) {
      x = x + alpha * (nx - x);
      y = y + alpha * (ny - y);
      return { x, y };
    },
    reset() { x = 0; y = 0; },
  };
}

/** 星际穿越风格 Flip 数字 */
function setFlipValue(el, value) {
  const str = String(value);
  const prev = el.dataset.value || '';
  if (prev === str) return;
  el.dataset.value = str;

  const chars = str.split('');
  const existing = el.querySelectorAll('.flip-digit');
  existing.forEach((d, i) => {
    if (i >= chars.length) { d.remove(); return; }
    const inner = d.querySelector('.flip-inner');
    if (inner.textContent !== chars[i]) {
      d.classList.add('flipping');
      setTimeout(() => {
        inner.textContent = chars[i];
        d.classList.remove('flipping');
      }, 280);
    }
  });

  for (let i = existing.length; i < chars.length; i++) {
    const digit = document.createElement('span');
    digit.className = 'flip-digit';
    const inner = document.createElement('span');
    inner.className = 'flip-inner';
    inner.textContent = chars[i];
    digit.appendChild(inner);
    el.appendChild(digit);
  }
}

/** 无翻牌动画的即时写入 — 供高频 Data Skitter 使用 */
function setFlipInstant(el, value) {
  if (!el) return;
  const str = String(value);
  el.dataset.value = str;
  const chars = str.split('');
  let digits = el.querySelectorAll('.flip-digit');

  while (digits.length > chars.length) {
    digits[digits.length - 1].remove();
    digits = el.querySelectorAll('.flip-digit');
  }
  for (let i = digits.length; i < chars.length; i++) {
    const digit = document.createElement('span');
    digit.className = 'flip-digit';
    const inner = document.createElement('span');
    inner.className = 'flip-inner';
    digit.appendChild(inner);
    el.appendChild(digit);
  }
  digits = el.querySelectorAll('.flip-digit');
  for (let i = 0; i < chars.length; i++) {
    const inner = digits[i].querySelector('.flip-inner');
    if (inner && inner.textContent !== chars[i]) inner.textContent = chars[i];
    digits[i].classList.remove('flipping');
  }
}

function skitterNoise(template) {
  const DIGITS = '0123456789';
  let out = '';
  for (let i = 0; i < template.length; i++) {
    const ch = template[i];
    if (ch >= '0' && ch <= '9') out += DIGITS[(Math.random() * 10) | 0];
    else out += ch;
  }
  return out;
}

/**
 * 飞船系统初始化 · Data Skitter
 * 高频乱码滚动 → 减速 → 锁定真实值
 * @returns cancel function
 */
function runDataSkitter(entries, {
  duration = 2500,
  settle = 420,
  onSettle,
} = {}) {
  const list = (entries || []).filter(e => e?.el);
  if (!list.length) return () => {};

  let rafId = 0;
  let cancelled = false;
  let lastTick = 0;
  const start = performance.now();
  const endSkitter = start + duration;
  const endSettle = endSkitter + settle;

  list.forEach(({ el, target }) => {
    el.classList.add('skittering');
    const tpl = String(target ?? '0000');
    setFlipInstant(el, skitterNoise(tpl));
  });

  function blendToward(template, target, t) {
    const src = skitterNoise(template);
    const dst = String(target);
    const len = Math.max(src.length, dst.length);
    let out = '';
    for (let i = 0; i < len; i++) {
      const a = src[i] ?? '';
      const b = dst[i] ?? '';
      if (!b) { out += a; continue; }
      if (b < '0' || b > '9') { out += b; continue; }
      out += Math.random() > t ? (a >= '0' && a <= '9' ? a : b) : b;
    }
    return out;
  }

  function frame(now) {
    if (cancelled) return;

    if (now < endSkitter) {
      // ~40fps 高频乱码，避免每帧打满主线程
      if (now - lastTick >= 24) {
        lastTick = now;
        list.forEach(({ el, target }) => {
          setFlipInstant(el, skitterNoise(String(target ?? '0000')));
        });
      }
      rafId = requestAnimationFrame(frame);
      return;
    }

    if (now < endSettle) {
      const t = (now - endSkitter) / settle;
      const eased = 1 - Math.pow(1 - t, 3);
      if (now - lastTick >= 32 + eased * 40) {
        lastTick = now;
        list.forEach(({ el, target }) => {
          const tpl = String(target ?? '0000');
          setFlipInstant(el, blendToward(tpl, tpl, eased));
        });
      }
      rafId = requestAnimationFrame(frame);
      return;
    }

    list.forEach(({ el, target }) => {
      el.classList.remove('skittering');
      setFlipInstant(el, target ?? '—');
    });
    onSettle?.();
  }

  rafId = requestAnimationFrame(frame);

  return () => {
    cancelled = true;
    if (rafId) cancelAnimationFrame(rafId);
    list.forEach(({ el }) => el.classList.remove('skittering'));
  };
}

/** 从 0 快速跳动到目标值 */
function animateFlipTo(el, target, duration = 1200) {
  const isNum = !isNaN(parseFloat(target));
  if (!isNum) {
    setFlipValue(el, target);
    return;
  }
  const end = Math.round(parseFloat(target));
  const start = performance.now();
  let last = -1;

  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = Math.round(end * eased);
    if (val !== last) {
      setFlipValue(el, val);
      last = val;
    }
    if (t < 1) requestAnimationFrame(tick);
    else setFlipValue(el, end);
  }
  setFlipValue(el, '0');
  requestAnimationFrame(tick);
}

async function fetchElevation(lat, lng) {
  try {
    const res = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lng}`
    );
    const data = await res.json();
    return data.results?.[0]?.elevation ?? null;
  } catch {
    return null;
  }
}

function isPerseidsSeason(d = new Date()) {
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m === 7 && day >= 17) return true;
  if (m === 8 && day <= 24) return true;
  return false;
}

function isNightHour(d = new Date()) {
  const h = d.getHours();
  return h >= 21 || h < 5;
}

function isEveningHour(d = new Date()) {
  return d.getHours() >= 20;
}

/** 露营场景 · 统一地理定位（懒加载、缓存、避免重复弹窗） */
const CampGeo = (() => {
  const DENIED_KEY = 'camp-geo-denied';
  const CACHE_KEY = 'camp-geo-cache';
  const CACHE_TTL = 10 * 60 * 1000;

  let watchId = null;
  let lastPos = null;
  const listeners = new Set();

  function readCache() {
    try {
      const d = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (!d || Date.now() - d.ts > CACHE_TTL) return null;
      return d;
    } catch {
      return null;
    }
  }

  function writeCache(pos) {
    const c = pos.coords;
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      latitude: c.latitude,
      longitude: c.longitude,
      altitude: c.altitude,
      accuracy: c.accuracy,
      altitudeAccuracy: c.altitudeAccuracy,
      heading: c.heading,
      speed: c.speed,
      ts: Date.now(),
    }));
  }

  function posFromCache(d) {
    return {
      coords: {
        latitude: d.latitude,
        longitude: d.longitude,
        altitude: d.altitude,
        accuracy: d.accuracy,
        altitudeAccuracy: d.altitudeAccuracy,
        heading: d.heading,
        speed: d.speed,
      },
      cachedAt: d.ts,
    };
  }

  function emit(pos, err) {
    listeners.forEach(fn => fn(pos, err));
  }

  function start() {
    if (!navigator.geolocation) {
      emit(null, { code: 0, message: 'unsupported' });
      return;
    }
    if (localStorage.getItem(DENIED_KEY)) {
      emit(null, { code: 1, message: 'denied' });
      return;
    }

    if (lastPos) emit(lastPos);
    else {
      const cached = readCache();
      if (cached) {
        lastPos = posFromCache(cached);
        emit(lastPos);
      }
    }

    if (watchId != null) return;

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        lastPos = pos;
        writeCache(pos);
        emit(pos);
      },
      (err) => {
        if (err.code === 1) localStorage.setItem(DENIED_KEY, '1');
        emit(null, err);
      },
      { enableHighAccuracy: true, maximumAge: 60000, timeout: 20000 }
    );
  }

  function stop() {
    if (watchId != null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
    listeners.clear();
    lastPos = null;
  }

  function subscribe(fn) {
    listeners.add(fn);
    if (lastPos) fn(lastPos);
    else {
      const cached = readCache();
      if (cached) fn(posFromCache(cached));
    }
    return () => listeners.delete(fn);
  }

  function resetDenied() {
    localStorage.removeItem(DENIED_KEY);
  }

  return { start, stop, subscribe, resetDenied, isDenied: () => !!localStorage.getItem(DENIED_KEY) };
})();
