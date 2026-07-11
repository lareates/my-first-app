function initCamp(cleanupFns) {
  initStars(cleanupFns);
  initMilkyWay(cleanupFns);
  initConstellation(cleanupFns);
  const compass = initCompass(cleanupFns);

  const screen = document.getElementById('scene-camp');
  const parallax = document.getElementById('camp-parallax');
  const clockEl = document.getElementById('camp-clock');
  const flipAlt = document.getElementById('flip-altitude');
  const flipLat = document.getElementById('flip-lat');
  const flipLng = document.getElementById('flip-lng');
  const flipAcc = document.getElementById('flip-accuracy');
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
  let pointerX = 0;
  let pointerY = -32;
  let parallaxTicking = false;
  const ac = new AbortController();

  if (isPerseidsSeason() && isNightHour()) {
    badgeEl.textContent = '☄️ 英仙座流星雨';
  }

  function syncGeoForMode(m) {
    if (m === 'terrain' || m === 'orient') CampGeo.start();
  }

  async function applyTerrainFromPosition(pos) {
    if (!pos || terrainApplied) return;
    const { latitude, longitude, altitude, accuracy, altitudeAccuracy, heading } = pos.coords;
    animateFlipTo(flipLat, latitude.toFixed(4) + '°', 1400);
    setTimeout(() => animateFlipTo(flipLng, longitude.toFixed(4) + '°', 1400), 200);
    setTimeout(() => animateFlipTo(flipAcc, accuracy ? Math.round(accuracy) : '—', 1000), 400);

    const ageMin = pos.cachedAt ? Math.round((Date.now() - pos.cachedAt) / 60000) : 0;
    const cacheNote = pos.cachedAt && ageMin > 0 ? ` · 缓存 ${ageMin} 分钟前` : '';

    let elev = altitude;
    if (elev != null && !isNaN(elev)) {
      setTimeout(() => animateFlipTo(flipAlt, Math.round(elev), 1600), 600);
      if (statusEl) statusEl.textContent = `GPS 海拔 · ±${altitudeAccuracy ? Math.round(altitudeAccuracy) : '?'} m${cacheNote}`;
      const line0 = metaEl?.querySelectorAll('.aura-meta-line')[0];
      if (line0) line0.textContent = `ALTITUDE / ${Math.round(elev)}M`;
      terrainApplied = true;
    } else if (!terrainApplied) {
      if (statusEl) statusEl.textContent = `查询地形海拔…${cacheNote}`;
      elev = await fetchElevation(latitude, longitude);
      if (elev != null) {
        animateFlipTo(flipAlt, Math.round(elev), 1600);
        if (statusEl) statusEl.textContent = `地形海拔 · Open-Elevation${cacheNote}`;
        const line0 = metaEl?.querySelectorAll('.aura-meta-line')[0];
        if (line0) line0.textContent = `ALTITUDE / ${Math.round(elev)}M`;
      } else {
        setFlipValue(flipAlt, '—');
        if (statusEl) statusEl.textContent = `无法获取海拔${cacheNote}`;
      }
      terrainApplied = true;
    }

    if (heading != null && !isNaN(heading) && heading >= 0) {
      compass.setGpsHeading(heading);
    }
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
      compass.setGpsHeading(pos.coords.heading);
      if (pos.coords.heading == null || pos.coords.heading < 0) {
        compass.setGeoHint(pos.cachedAt ? '缓存位置 · 航向需移动后更新' : '等待 GPS 航向…');
      }
    }
  }

  CampGeo.subscribe(handleGeoUpdate);

  function syncTerrainBackground(m) {
    const isTerrain = m === 'terrain';
    const photo = screen.querySelector('.camp-terrain-photo');

    if (isTerrain) {
      Ambient.stop();
      if (!terrainMotionOff && photo) {
        terrainMotionOff = Motion.registerLow((now) => {
          if (campMode !== 'terrain') return;
          const t = now / 1000;
          const scale = 1 + Math.sin(t * 0.08) * 0.006;
          const x = Math.sin(t * 0.05) * 4;
          const y = Math.cos(t * 0.04) * 3;
          photo.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;
        });
      }
    } else {
      terrainMotionOff?.();
      terrainMotionOff = null;
      if (photo) photo.style.transform = '';
      if (screen.classList.contains('active')) Ambient.start('camp');
    }
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
    const labels = { stars: 'MODE / STARS', terrain: 'MODE / TERRAIN', orient: 'MODE / ORIENT' };
    const lines = metaEl?.querySelectorAll('.aura-meta-line');
    if (lines?.[2]) lines[2].textContent = labels[m];
    syncTerrainBackground(m);
    syncGeoForMode(m);
    if (m === 'terrain') {
      terrainApplied = false;
      if (statusEl) {
        statusEl.textContent = CampGeo.isDenied()
          ? '定位被拒绝 · 请在浏览器设置中允许'
          : '正在获取 GPS 位置…';
      }
    } else if (m === 'stars' && statusEl) {
      statusEl.textContent = '切换到「地形」查看位置';
    }
    if (m === 'orient') compass.onOrientModeActive();
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
  const ctx = canvas.getContext('2d');
  let stars = [];
  let meteors = [];
  let motionOff = null;
  let rotation = 0;
  const perseids = isPerseidsSeason();

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 280 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.75,
      r: Math.random() * 1.4 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.015 + 0.003,
      trail: [],
      drift: (Math.random() - 0.5) * 0.02,
    }));
  }

  function spawnMeteor() {
    const boost = (isNightHour() ? 1 : 0.3) * (perseids && isNightHour() ? 3 : 1);
    if (Math.random() > 0.003 * boost) return;
    meteors.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.3,
      len: 60 + Math.random() * 120,
      speed: 8 + Math.random() * 12,
      angle: Math.PI / 4 + (Math.random() - 0.5) * 0.3,
      life: 1,
      perseid: perseids && isNightHour(),
    });
  }

  function drawStarsLayer(t) {
    stars.forEach(s => {
      s.x += s.drift * 0.05;
      if (s.x < 0) s.x = canvas.width;
      if (s.x > canvas.width) s.x = 0;
      s.trail.push({ x: s.x, y: s.y });
      if (s.trail.length > 6) s.trail.shift();
      const alpha = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * s.speed * 80 + s.phase));
      if (s.trail.length > 2) {
        ctx.beginPath();
        ctx.moveTo(s.trail[0].x, s.trail[0].y);
        s.trail.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = `rgba(255,255,240,${alpha * 0.08})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,240,${alpha})`;
      ctx.fill();
    });
  }

  function draw(now) {
    const campScreen = document.getElementById('scene-camp');
    if (campScreen?.dataset.campMode === 'terrain') return;

    ctx.fillStyle = 'rgba(3,5,12,0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const t = now / 1000;
    const evening = isEveningHour();

    if (evening) rotation += 0.00008;

    ctx.save();
    if (evening) {
      const cx = canvas.width * 0.5;
      const cy = canvas.height * 0.42;
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.translate(-cx, -cy);
    }
    drawStarsLayer(t);
    ctx.restore();

    spawnMeteor();
    meteors = meteors.filter(m => {
      m.x += Math.cos(m.angle) * m.speed;
      m.y += Math.sin(m.angle) * m.speed;
      m.life -= 0.015;
      const g = ctx.createLinearGradient(m.x, m.y, m.x - Math.cos(m.angle) * m.len, m.y - Math.sin(m.angle) * m.len);
      const c = m.perseid ? 'rgba(255,220,120,' : 'rgba(255,255,255,';
      g.addColorStop(0, c + m.life + ')');
      g.addColorStop(1, c + '0)');
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - Math.cos(m.angle) * m.len, m.y - Math.sin(m.angle) * m.len);
      ctx.strokeStyle = g;
      ctx.lineWidth = m.perseid ? 2 : 1;
      ctx.stroke();
      return m.life > 0;
    });
  }

  resize();
  motionOff = Motion.registerLow(draw);
  window.addEventListener('resize', resize);
  cleanupFns.push(() => {
    motionOff?.();
    window.removeEventListener('resize', resize);
  });
}

function initMilkyWay(cleanupFns) {
  const canvas = document.getElementById('milky-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let motionOff = null;
  let rotation = 0;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function draw(now) {
    const campScreen = document.getElementById('scene-camp');
    if (campScreen?.dataset.campMode === 'terrain' || !isEveningHour()) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    rotation += 0.00005;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w * 0.5, h * 0.38);
    ctx.rotate(rotation - 0.35);
    ctx.translate(-w * 0.5, -h * 0.38);

    const band = ctx.createLinearGradient(0, h * 0.1, w, h * 0.7);
    band.addColorStop(0, 'rgba(120,140,220,0)');
    band.addColorStop(0.35, 'rgba(180,190,255,0.04)');
    band.addColorStop(0.5, 'rgba(220,210,255,0.09)');
    band.addColorStop(0.65, 'rgba(160,170,240,0.05)');
    band.addColorStop(1, 'rgba(100,120,200,0)');

    ctx.fillStyle = band;
    ctx.fillRect(-w * 0.2, h * 0.05, w * 1.4, h * 0.75);

    for (let i = 0; i < 120; i++) {
      const x = (Math.sin(i * 2.7 + now * 0.0001) * 0.5 + 0.5) * w;
      const y = (Math.cos(i * 1.9) * 0.5 + 0.5) * h * 0.55;
      const r = 0.4 + (i % 5) * 0.15;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(230,225,255,${0.02 + (i % 7) * 0.008})`;
      ctx.fill();
    }

    ctx.restore();
  }

  resize();
  motionOff = Motion.registerLow(draw);
  window.addEventListener('resize', resize);
  cleanupFns.push(() => {
    motionOff?.();
    window.removeEventListener('resize', resize);
  });
}

function initConstellation(cleanupFns) {
  const canvas = document.getElementById('constellation-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dipper = [
    [0.55, 0.18], [0.58, 0.22], [0.62, 0.24], [0.66, 0.22],
    [0.70, 0.25], [0.73, 0.30], [0.68, 0.32],
  ];
  const lines = [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[2,5]];
  let motionOff = null;
  let rotation = 0;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function draw(now) {
    const campScreen = document.getElementById('scene-camp');
    const evening = isEveningHour();
    if (campScreen?.dataset.campMode === 'terrain' || !evening) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    rotation += 0.00006;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const ox = canvas.width * 0.15;
    const oy = canvas.height * 0.05;
    const scale = Math.min(canvas.width, canvas.height) * 0.55;
    const cx = ox + 0.64 * scale;
    const cy = oy + 0.24 * scale;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.translate(-cx, -cy);

    const pulse = 0.12 + 0.08 * Math.sin(now * 0.001);
    ctx.strokeStyle = `rgba(240,192,96,${0.12 + pulse})`;
    ctx.shadowColor = 'rgba(240,192,96,0.25)';
    ctx.shadowBlur = 12;
    lines.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(ox + dipper[a][0] * scale, oy + dipper[a][1] * scale);
      ctx.lineTo(ox + dipper[b][0] * scale, oy + dipper[b][1] * scale);
      ctx.stroke();
    });
    dipper.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(ox + x * scale, oy + y * scale, i === 6 ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(240,192,96,${0.45 + pulse})`;
      ctx.fill();
    });
    ctx.restore();
  }

  resize();
  motionOff = Motion.registerLow(draw);
  window.addEventListener('resize', resize);
  cleanupFns.push(() => {
    motionOff?.();
    window.removeEventListener('resize', resize);
  });
}

function initCompass(cleanupFns) {
  const ring = document.getElementById('compass-ring');
  const needle = document.getElementById('compass-needle');
  const headingEl = document.getElementById('compass-heading');
  const statusEl = document.getElementById('compass-status');
  if (!ring || !needle) {
    return { setGpsHeading() {}, setGeoError() {}, setGeoHint() {}, onOrientModeActive() {} };
  }

  const tiltSmoother = createSmoother(0.12);
  let heading = 0;
  let smoothHeading = 0;
  let hasHeading = false;
  let tiltX = 0;
  let tiltY = 0;
  let orientEnabled = false;
  let lastSource = '';

  function applyTransform() {
    ring.style.transform = `rotateX(${tiltY}deg) rotateY(${tiltX}deg)`;
    needle.style.transform = `translate(-50%, -85%) rotateZ(${-heading}deg)`;
    if (headingEl) headingEl.textContent = `${Math.round(heading)}°`;
  }

  function setHeading(h, source) {
    if (h == null || isNaN(h)) return;
    const norm = ((h % 360) + 360) % 360;
    if (!hasHeading) {
      smoothHeading = norm;
      hasHeading = true;
    } else {
      let delta = norm - smoothHeading;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      smoothHeading += delta * 0.18;
      smoothHeading = ((smoothHeading % 360) + 360) % 360;
    }
    heading = smoothHeading;
    lastSource = source;
    applyTransform();
    if (statusEl && source) statusEl.textContent = source;
  }

  function setGpsHeading(h) {
    if (h != null && !isNaN(h) && h >= 0) {
      setHeading(h, 'GPS 航向 · 移动时更新');
    }
  }

  function setGeoError(err) {
    if (!statusEl) return;
    const msgs = { 1: '定位被拒绝 · 无法获取航向', 2: '无 GPS 信号', 3: '定位超时' };
    statusEl.textContent = msgs[err?.code] || '定位失败';
  }

  function setGeoHint(msg) {
    if (statusEl && lastSource !== '陀螺仪指南针') statusEl.textContent = msg;
  }

  function onOrient(e) {
    if (!orientEnabled) return;
    const { x, y } = tiltSmoother.update(e.gamma || 0, e.beta || 0);
    tiltX = x * 0.45;
    tiltY = -y * 0.45;
    applyTransform();
  }

  function onDeviceHeading(e) {
    if (!orientEnabled) return;
    if (e.webkitCompassHeading != null) {
      setHeading(e.webkitCompassHeading, '陀螺仪指南针 · 真北');
    } else if (e.absolute && e.alpha != null) {
      setHeading(360 - e.alpha, '陀螺仪指南针 · 真北');
    }
  }

  function enableOrientation() {
    if (orientEnabled) return;
    orientEnabled = true;
    if (statusEl) statusEl.textContent = '陀螺仪指南针 · 已启用';
  }

  function requestOrientationAccess() {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then(state => { if (state === 'granted') enableOrientation(); })
        .catch(() => {
          if (statusEl) statusEl.textContent = '请允许动作与方向感应';
        });
    } else {
      enableOrientation();
    }
  }

  function onOrientModeActive() {
    requestOrientationAccess();
  }

  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', onOrient);
    window.addEventListener('deviceorientation', onDeviceHeading);
    cleanupFns.push(() => {
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('deviceorientation', onDeviceHeading);
    });
    ring.style.cursor = 'pointer';
    const unlock = () => requestOrientationAccess();
    ring.addEventListener('click', unlock);
    needle.addEventListener('click', unlock);
  } else if (statusEl) {
    statusEl.textContent = '此设备无陀螺仪 · 依赖 GPS 航向';
  }

  applyTransform();

  return { setGpsHeading, setGeoError, setGeoHint, onOrientModeActive };
}
