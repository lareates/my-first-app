function initCamp(cleanupFns) {
  Ambient.stop();
  initStars(cleanupFns);
  const compass = initCompass(cleanupFns);

  const screen = document.getElementById('scene-camp');
  const parallax = document.getElementById('camp-parallax');
  const clockEl = document.getElementById('camp-clock');
  const flipAlt = document.getElementById('flip-altitude');
  const flipLat = document.getElementById('flip-lat');
  const flipLng = document.getElementById('flip-lng');
  const flipAcc = document.getElementById('flip-accuracy');
  const sysStatusEl = document.getElementById('camp-sys-status');
  const statusEl = document.getElementById('camp-status');
  const constEl = document.getElementById('camp-constellation');
  const badgeEl = document.getElementById('camp-badge');
  const metaEl = document.getElementById('camp-meta');
  const playBtn = document.getElementById('camp-play');
  const volInput = document.getElementById('camp-volume');
  const volFill = document.getElementById('camp-volume-fill');

  let campMode = 'stars';
  let playing = false;
  let terrainMotionOff = null;
  let terrainApplied = false;
  let bootStart = 0;
  let bootTargets = null;
  let bootStatusText = '';
  let cancelSkitter = null;
  let settleTimer = null;
  let geoResolving = false;
  let pointerX = 0;
  let pointerY = -32;
  let parallaxTicking = false;
  const ac = new AbortController();
  const BOOT_MS = 2500;

  if (isPerseidsSeason() && isNightHour()) {
    badgeEl.textContent = I18n.t('campPerseids');
  }

  function setSysActive(on) {
    sysStatusEl?.classList.toggle('active', !!on);
  }

  function syncGeoForMode(m) {
    if (m === 'terrain' || m === 'orient') CampGeo.start();
  }

  function clearBootTimers() {
    cancelSkitter?.();
    cancelSkitter = null;
    if (settleTimer) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
  }

  function placeholderTargets() {
    return [
      { el: flipAlt, target: '----' },
      { el: flipLat, target: '--.----°' },
      { el: flipLng, target: '---.----°' },
      { el: flipAcc, target: '---' },
    ];
  }

  function beginSkitter(entries) {
    cancelSkitter?.();
    cancelSkitter = runDataSkitter(entries, {
      duration: 120000,
      settle: 0,
    });
  }

  function settleToTargets(entries, statusText) {
    clearBootTimers();
    cancelSkitter = runDataSkitter(entries, {
      duration: 0,
      settle: 420,
      onSettle: () => {
        setSysActive(true);
        terrainApplied = true;
        if (statusEl && statusText) statusEl.textContent = statusText;
        const alt = entries.find(e => e.el === flipAlt)?.target;
        if (alt && alt !== '—' && alt !== '----') {
          const line0 = metaEl?.querySelectorAll('.aura-meta-line')[0];
          if (line0) line0.textContent = `ALTITUDE / ${alt}M`;
        }
      },
    });
  }

  function trySettleBoot() {
    if (!bootTargets || terrainApplied || campMode !== 'terrain') return;
    const wait = Math.max(0, BOOT_MS - (performance.now() - bootStart));
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (campMode !== 'terrain' || !bootTargets) return;
      settleToTargets(bootTargets, bootStatusText);
    }, wait);
  }

  function startTerrainBoot() {
    clearBootTimers();
    terrainApplied = false;
    geoResolving = false;
    bootTargets = null;
    bootStatusText = '';
    bootStart = performance.now();
    setSysActive(false);
    beginSkitter(placeholderTargets());
    if (statusEl) {
      statusEl.textContent = CampGeo.isDenied()
        ? '定位被拒绝 · 请在浏览器设置中允许'
        : '系统初始化 · 扫描定位链路…';
    }
  }

  async function applyTerrainFromPosition(pos) {
    if (!pos || terrainApplied || geoResolving || campMode !== 'terrain') return;
    geoResolving = true;

    const { latitude, longitude, altitude, accuracy, altitudeAccuracy, heading } = pos.coords;
    if (heading != null && !isNaN(heading) && heading >= 0) {
      compass.setGpsHeading(heading);
    }
    // 同步经纬度给天体罗盘（缓存命中时也可能先走地形）
    compass.setPosition(latitude, longitude);

    const ageMin = pos.cachedAt ? Math.round((Date.now() - pos.cachedAt) / 60000) : 0;
    const cacheNote = pos.cachedAt && ageMin > 0 ? ` · 缓存 ${ageMin} 分钟前` : '';
    const latStr = latitude.toFixed(4) + '°';
    const lngStr = longitude.toFixed(4) + '°';
    const accStr = accuracy != null && !isNaN(accuracy) ? String(Math.round(accuracy)) : '—';

    let elev = altitude;
    let statusText = '';
    if (elev != null && !isNaN(elev)) {
      statusText = `GPS 海拔 · ±${altitudeAccuracy ? Math.round(altitudeAccuracy) : '?'} m${cacheNote}`;
    } else {
      if (statusEl) statusEl.textContent = `扫描链路 · 查询地形海拔…${cacheNote}`;
      elev = await fetchElevation(latitude, longitude);
      if (campMode !== 'terrain' || terrainApplied) {
        geoResolving = false;
        return;
      }
      statusText = elev != null
        ? `地形海拔 · Open-Elevation${cacheNote}`
        : `无法获取海拔${cacheNote}`;
    }

    bootTargets = [
      { el: flipAlt, target: elev != null && !isNaN(elev) ? String(Math.round(elev)) : '—' },
      { el: flipLat, target: latStr },
      { el: flipLng, target: lngStr },
      { el: flipAcc, target: accStr },
    ];
    bootStatusText = statusText;
    beginSkitter(bootTargets);
    trySettleBoot();
  }

  function handleGeoUpdate(pos, err) {
    if (err) {
      const msgs = { 1: '定位被拒绝 · 请在浏览器设置中允许', 2: '无位置信号', 3: '定位超时' };
      if (campMode === 'terrain' && statusEl) {
        statusEl.textContent = msgs[err.code] || '定位失败';
      }
      if (campMode === 'orient') compass.setGeoError(err);
      return;
    }
    if (campMode === 'terrain') applyTerrainFromPosition(pos);
    if (campMode === 'orient') {
      compass.setPosition(pos.coords.latitude, pos.coords.longitude);
    }
  }

  CampGeo.subscribe(handleGeoUpdate);

  function syncTerrainBackground() {
    // 地形与星空共用 Canvas 星空背景，不再切换照片层
    terrainMotionOff?.();
    terrainMotionOff = null;
  }

  function setCampMode(m) {
    campMode = m;
    screen.dataset.campMode = m;
    screen.querySelectorAll('[data-camp-panel]').forEach(p => {
      p.classList.toggle('active', p.dataset.campPanel === m);
    });
    screen.querySelectorAll('#camp-modes .horizon-mode').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.campMode === m);
    });
    const labels = { stars: 'MODE / STARS', terrain: 'MODE / TERRAIN', orient: 'MODE / CELESTIAL' };
    const lines = metaEl?.querySelectorAll('.aura-meta-line');
    if (lines?.[2]) lines[2].textContent = labels[m];
    syncTerrainBackground();
    syncGeoForMode(m);
    if (m === 'terrain') {
      startTerrainBoot();
    } else if (m === 'stars' && statusEl) {
      clearBootTimers();
      setSysActive(false);
      statusEl.textContent = I18n.t('campTerrainHint');
    } else {
      clearBootTimers();
      setSysActive(false);
    }
    if (m === 'orient') compass.onOrientModeActive();
    else compass.onOrientModeInactive?.();
    if (playing) AudioEngine.startCampAudio(m, parseInt(volInput.value, 10));
  }

  function toggleCampPlay() {
    playing = !playing;
    setPlayIcon(playBtn, playing);
    playBtn.classList.toggle('playing', playing);
    if (playing) {
      AudioEngine.startCampAudio(campMode, parseInt(volInput.value, 10));
    } else {
      AudioEngine.stopCampAudio();
    }
  }

  bindCarPlay(playBtn, toggleCampPlay);

  screen.addEventListener('click', (e) => {
    const modeBtn = e.target.closest('button[data-camp-mode]');
    if (modeBtn) {
      e.preventDefault();
      setCampMode(modeBtn.dataset.campMode);
    }
  }, { signal: ac.signal });

  volInput.addEventListener('input', () => {
    volFill.style.width = `${volInput.value}%`;
    if (playing) AudioEngine.setCampVolume(parseInt(volInput.value, 10));
  }, { signal: ac.signal });

  const onMove = (e) => {
    pointerX = (e.clientX / window.innerWidth - 0.5) * 7;
    pointerY = -32 + (e.clientY / window.innerHeight - 0.5) * 7;
    if (parallaxTicking) return;
    parallaxTicking = true;
    requestAnimationFrame(() => {
      parallax.style.transform = `translate(${pointerX}px, ${pointerY}px)`;
      parallaxTicking = false;
    });
  };
  document.addEventListener('mousemove', onMove, { signal: ac.signal });

  const stopClock = startClock(() => {
    const now = new Date();
    clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    syncEveningAmbience(now);
  });

  function syncEveningAmbience(now = new Date()) {
    const evening = isEveningHour(now);
    screen.classList.toggle('camp-evening', evening);
    const rim = document.getElementById('camp-evening-rim');
    if (rim) rim.classList.toggle('active', evening);
  }

  syncEveningAmbience();

  constEl.textContent = getConstellationLabel(new Date());
  setCampMode('stars');

  if (!navigator.geolocation && statusEl) {
    statusEl.textContent = '此设备不支持地理定位';
  }

  cleanupFns.push(() => {
    ac.abort();
    clearBootTimers();
    CampGeo.stop();
    terrainMotionOff?.();
    stopClock();
    AudioEngine.stopCampAudio();
  });
}

function getConstellationLabel(d) {
  const m = d.getMonth() + 1;
  const h = d.getHours();
  if (m >= 3 && m <= 5) return '可见星座 · 狮子座 · 牧夫座';
  if (m >= 6 && m <= 8) return '可见星座 · 天蝎座 · 夏季大三角';
  if (m >= 9 && m <= 11) return '可见星座 · 飞马座 · 仙女座';
  if (h >= 21 || h < 4) return '可见星座 · 猎户座 · 北斗七星';
  return '可见星座 · 季节自动匹配';
}

function initStars(cleanupFns) {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: false });
  let layers = { far: [], mid: [], near: [] };
  let meteors = [];
  let motionOff = null;
  let meteorTimer = null;
  let dpr = 1;
  let lastNow = 0;
  let driftT = 0;
  let nebula = null;

  const LAYER = {
    far: {
      share: 0.6,
      rMin: 0.3, rMax: 0.6,
      aMin: 0.1, aMax: 0.3,
      speedMin: 0.00035, speedMax: 0.0007,
      drift: 0.004,
      colors: [[210, 215, 230]],
      glow: false,
    },
    mid: {
      share: 0.3,
      rMin: 0.7, rMax: 1.0,
      aMin: 0.3, aMax: 0.6,
      speedMin: 0.00055, speedMax: 0.0011,
      drift: 0.009,
      colors: [[170, 195, 255], [255, 236, 200], [200, 210, 240]],
      glow: false,
    },
    near: {
      share: 0.1,
      rMin: 1.2, rMax: 1.8,
      aMin: 0.5, aMax: 0.8,
      speedMin: 0.0012, speedMax: 0.0022,
      drift: 0.016,
      colors: [[245, 248, 255], [255, 245, 220]],
      glow: true,
    },
  };

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedStars(w, h);
    buildNebula(w, h);
  }

  function buildNebula(w, h) {
    nebula = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.42, Math.max(w, h) * 0.72);
    nebula.addColorStop(0, 'rgba(13, 16, 33, 0.6)');
    nebula.addColorStop(0.45, 'rgba(8, 10, 22, 0.28)');
    nebula.addColorStop(0.78, 'rgba(2, 2, 4, 0.08)');
    nebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
  }

  function pickColor(palette) {
    return palette[Math.floor(Math.random() * palette.length)];
  }

  function makeStar(w, h, cfg) {
    const ox = (Math.random() - 0.5) * w;
    const oy = (Math.random() - 0.5) * h;
    const dist = Math.hypot(ox, oy) || 1;
    const [cr, cg, cb] = pickColor(cfg.colors);
    return {
      nx: ox / dist,
      ny: oy / dist,
      dist,
      r: cfg.rMin + Math.random() * (cfg.rMax - cfg.rMin),
      aMin: cfg.aMin,
      aSpan: cfg.aMax - cfg.aMin,
      phase: Math.random() * Math.PI * 2,
      speed: cfg.speedMin + Math.random() * (cfg.speedMax - cfg.speedMin),
      driftRate: cfg.drift * (0.7 + Math.random() * 0.6),
      cr, cg, cb,
      glow: cfg.glow,
    };
  }

  function seedStars(w, h) {
    const total = 68 + Math.floor(Math.random() * 13); // 68–80
    const farN = Math.round(total * LAYER.far.share);
    const midN = Math.round(total * LAYER.mid.share);
    const nearN = Math.max(1, total - farN - midN);
    layers = {
      far: Array.from({ length: farN }, () => makeStar(w, h, LAYER.far)),
      mid: Array.from({ length: midN }, () => makeStar(w, h, LAYER.mid)),
      near: Array.from({ length: nearN }, () => makeStar(w, h, LAYER.near)),
    };
  }

  function scheduleMeteor() {
    clearTimeout(meteorTimer);
    const delay = 60000 + Math.random() * 60000;
    meteorTimer = setTimeout(() => {
      spawnMeteor();
      scheduleMeteor();
    }, delay);
  }

  function spawnMeteor() {
    const campScreen = document.getElementById('scene-camp');
    if (!campScreen?.classList.contains('active')) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const deg = 30 + Math.random() * 15;
    const angle = (deg * Math.PI) / 180;
    meteors.push({
      x: Math.random() * w * 0.85,
      y: Math.random() * h * 0.35,
      angle,
      len: 90 + Math.random() * 70,
      speed: 14 + Math.random() * 10,
      age: 0,
      life: 0.55 + Math.random() * 0.25,
    });
  }

  function drawMeteor(m) {
    const progress = m.age / m.life;
    let alpha;
    if (progress < 0.12) alpha = progress / 0.12;
    else if (progress > 0.55) alpha = Math.max(0, 1 - (progress - 0.55) / 0.45);
    else alpha = 1;
    alpha *= 0.55;

    const tx = m.x - Math.cos(m.angle) * m.len;
    const ty = m.y - Math.sin(m.angle) * m.len;
    const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
    g.addColorStop(0, `rgba(220, 228, 255, ${alpha})`);
    g.addColorStop(0.35, `rgba(180, 195, 240, ${alpha * 0.35})`);
    g.addColorStop(1, 'rgba(140, 160, 220, 0)');

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.1;
    ctx.shadowColor = `rgba(200, 210, 255, ${alpha * 0.45})`;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.restore();
  }

  function drawLayer(list, cx, cy, rot, dt, maxDist) {
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      s.dist += s.driftRate * dt;
      if (s.dist > maxDist) {
        s.dist = 16 + Math.random() * 48;
        const ang = Math.random() * Math.PI * 2;
        s.nx = Math.cos(ang);
        s.ny = Math.sin(ang);
      }

      const lx = s.nx * s.dist;
      const ly = s.ny * s.dist;
      const x = cx + lx * cos - ly * sin;
      const y = cy + lx * sin + ly * cos;

      const twinkle = 0.5 + 0.5 * Math.sin(driftT * 1000 * s.speed + s.phase);
      const alpha = s.aMin + twinkle * s.aSpan;

      if (s.glow) {
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(255,255,255,0.3)';
      } else {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      }

      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${s.cr}, ${s.cg}, ${s.cb}, ${alpha})`;
      ctx.fill();
    }
  }

  function draw(now) {
    const campScreen = document.getElementById('scene-camp');
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dt = lastNow ? Math.min(0.05, (now - lastNow) / 1000) : 0.016;
    lastNow = now;
    driftT += dt;

    if (!campScreen?.classList.contains('active')) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    if (nebula) {
      ctx.fillStyle = nebula;
      ctx.fillRect(0, 0, w, h);
    }

    const cx = w * 0.5;
    const cy = h * 0.42;
    const rot = driftT * 0.0018;
    const maxDist = Math.hypot(w, h) * 0.72;

    ctx.save();
    drawLayer(layers.far, cx, cy, rot * 0.45, dt, maxDist);
    drawLayer(layers.mid, cx, cy, rot * 0.75, dt, maxDist);
    drawLayer(layers.near, cx, cy, rot, dt, maxDist);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    ctx.restore();

    meteors = meteors.filter(m => {
      m.age += dt;
      m.x += Math.cos(m.angle) * m.speed * (dt * 60);
      m.y += Math.sin(m.angle) * m.speed * (dt * 60);
      if (m.age >= m.life) return false;
      drawMeteor(m);
      return true;
    });
  }

  resize();
  scheduleMeteor();
  motionOff = Motion.register(draw);
  window.addEventListener('resize', resize);
  cleanupFns.push(() => {
    motionOff?.();
    clearTimeout(meteorTimer);
    window.removeEventListener('resize', resize);
  });
}

function initCompass(cleanupFns) {
  const wrap = document.getElementById('compass-wrap');
  const needle = document.getElementById('compass-needle');
  const headingEl = document.getElementById('compass-heading');
  const phaseEl = document.getElementById('compass-phase');
  const statusEl = document.getElementById('compass-status');
  if (!needle || !headingEl) {
    return {
      setGpsHeading() {},
      setGeoError() {},
      setGeoHint() {},
      setPosition() {},
      onOrientModeActive() {},
    };
  }

  let lat = null;
  let lng = null;
  let active = false;
  let tickTimer = null;
  let needleAngle = 0;

  function formatHMS(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function dayOffset(base, days) {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  }

  function computeCycle(now) {
    if (typeof SunCalc === 'undefined') return null;
    if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return null;

    const today = SunCalc.getTimes(now, lat, lng);
    const tomorrow = SunCalc.getTimes(dayOffset(now, 1), lat, lng);
    const yesterday = SunCalc.getTimes(dayOffset(now, -1), lat, lng);

    const sunrise = today.sunrise;
    const sunset = today.sunset;
    if (!sunrise || !sunset || isNaN(sunrise) || isNaN(sunset)) return null;

    // 白天：日出 ≤ 现在 < 日落 → 倒计时至今日日落
    if (now >= sunrise && now < sunset) {
      const span = sunset - sunrise;
      const progress = span > 0 ? (now - sunrise) / span : 0;
      return {
        mode: 'day',
        label: '距日落',
        remainMs: sunset - now,
        target: sunset,
        progress: Math.min(1, Math.max(0, progress)),
      };
    }

    // 日出前：倒计时至今日日出（昨夜延续）
    if (now < sunrise) {
      const nightStart = yesterday.sunset || new Date(sunrise.getTime() - 12 * 3600 * 1000);
      const span = sunrise - nightStart;
      const progress = span > 0 ? (now - nightStart) / span : 0;
      return {
        mode: 'night',
        label: '距日出',
        remainMs: sunrise - now,
        target: sunrise,
        progress: Math.min(1, Math.max(0, progress)),
      };
    }

    // 日落后：倒计时至明日日出
    const nextRise = tomorrow.sunrise;
    const nightStart = sunset;
    const span = nextRise - nightStart;
    const progress = span > 0 ? (now - nightStart) / span : 0;
    return {
      mode: 'night',
      label: '距日出',
      remainMs: nextRise - now,
      target: nextRise,
      progress: Math.min(1, Math.max(0, progress)),
    };
  }

  function setNeedle(progress) {
    // 昼夜循环进度映射到 360°；累计角度避免跨 0° 时 CSS 绕远路
    const target = ((progress % 1) + 1) % 1 * 360;
    let delta = target - (((needleAngle % 360) + 360) % 360);
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    needleAngle += delta;
    needle.style.transform = `translate(-50%, -85%) rotateZ(${needleAngle}deg)`;
  }

  function render(now = new Date()) {
    if (!active) return;

    if (typeof SunCalc === 'undefined') {
      if (headingEl) headingEl.textContent = '--:--:--';
      if (phaseEl) phaseEl.textContent = '天体库加载中';
      if (statusEl) statusEl.textContent = '正在加载 SunCalc…';
      return;
    }

    if (lat == null || lng == null) {
      if (headingEl) headingEl.textContent = '--:--:--';
      if (phaseEl) phaseEl.textContent = '等待定位';
      if (statusEl) statusEl.textContent = '等待 GPS · 天体定位';
      wrap?.setAttribute('data-astro-mode', 'night');
      return;
    }

    const cycle = computeCycle(now);
    if (!cycle) {
      if (headingEl) headingEl.textContent = '--:--:--';
      if (phaseEl) phaseEl.textContent = '计算中';
      if (statusEl) statusEl.textContent = '天体时刻解算失败';
      return;
    }

    wrap?.setAttribute('data-astro-mode', cycle.mode);
    if (phaseEl) phaseEl.textContent = cycle.label;
    if (headingEl) headingEl.textContent = formatHMS(cycle.remainMs);
    setNeedle(cycle.progress);
    if (statusEl) {
      statusEl.textContent = '[ ASTRONOMICAL POSITIONING ACTIVE ]';
      statusEl.style.opacity = '0.7';
    }
  }

  function startTick() {
    stopTick();
    active = true;
    render();
    tickTimer = setInterval(() => render(), 1000);
  }

  function stopTick() {
    active = false;
    if (tickTimer) {
      clearInterval(tickTimer);
      tickTimer = null;
    }
  }

  function setPosition(latitude, longitude) {
    if (latitude == null || longitude == null || isNaN(latitude) || isNaN(longitude)) return;
    lat = latitude;
    lng = longitude;
    if (active) render();
  }

  function setGeoError(err) {
    if (!statusEl) return;
    const msgs = {
      1: '定位被拒绝 · 无法计算天体时刻',
      2: '无 GPS 信号 · 等待定位',
      3: '定位超时 · 重试中',
    };
    statusEl.textContent = msgs[err?.code] || '定位失败 · 天体罗盘待机';
    statusEl.style.opacity = '0.75';
  }

  function setGeoHint(msg) {
    if (statusEl && lat == null) statusEl.textContent = msg;
  }

  function onOrientModeActive() {
    startTick();
    if (lat == null && statusEl) {
      statusEl.textContent = '等待 GPS · 天体定位';
    }
  }

  function onOrientModeInactive() {
    stopTick();
  }

  // 兼容旧调用：忽略航向
  function setGpsHeading() {}

  cleanupFns.push(stopTick);

  return {
    setGpsHeading,
    setGeoError,
    setGeoHint,
    setPosition,
    onOrientModeActive,
    onOrientModeInactive,
  };
}
