function initCamp(cleanupFns) {
  initStars(cleanupFns);
  initConstellation(cleanupFns);
  initCompass(cleanupFns);

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
  let pointerX = 0;
  let pointerY = -32;
  let parallaxTicking = false;
  const ac = new AbortController();

  if (isPerseidsSeason() && isNightHour()) {
    badgeEl.textContent = '☄️ 英仙座流星雨';
  }

  function syncTerrainBackground(m) {
    const isTerrain = m === 'terrain';
    const photo = screen.querySelector('.camp-terrain-photo');

    if (isTerrain) {
      Ambient.stop();
      if (!terrainMotionOff && photo) {
        terrainMotionOff = Motion.register((now) => {
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
  });

  constEl.textContent = getConstellationLabel(new Date());
  setCampMode('stars');

  if (!navigator.geolocation) {
    if (statusEl) statusEl.textContent = '此设备不支持地理定位';
    cleanupFns.push(() => { ac.abort(); stopClock(); });
    return;
  }

  if (statusEl) statusEl.textContent = '正在获取 GPS 位置…';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude, altitude, accuracy, altitudeAccuracy } = pos.coords;
      animateFlipTo(flipLat, latitude.toFixed(4) + '°', 1400);
      setTimeout(() => animateFlipTo(flipLng, longitude.toFixed(4) + '°', 1400), 200);
      setTimeout(() => animateFlipTo(flipAcc, accuracy ? Math.round(accuracy) : '—', 1000), 400);

      let elev = altitude;
      if (elev != null && !isNaN(elev)) {
        setTimeout(() => animateFlipTo(flipAlt, Math.round(elev), 1600), 600);
        if (statusEl) statusEl.textContent = `GPS 海拔 · ±${altitudeAccuracy ? Math.round(altitudeAccuracy) : '?'} m`;
        const line0 = metaEl?.querySelectorAll('.aura-meta-line')[0];
        if (line0) line0.textContent = `ALTITUDE / ${Math.round(elev)}M`;
      } else {
        if (statusEl) statusEl.textContent = '查询地形海拔…';
        elev = await fetchElevation(latitude, longitude);
        if (elev != null) {
          animateFlipTo(flipAlt, Math.round(elev), 1600);
          if (statusEl) statusEl.textContent = '地形海拔 · Open-Elevation';
          const line0 = metaEl?.querySelectorAll('.aura-meta-line')[0];
          if (line0) line0.textContent = `ALTITUDE / ${Math.round(elev)}M`;
        } else {
          setFlipValue(flipAlt, '—');
          if (statusEl) statusEl.textContent = '无法获取海拔';
        }
      }
    },
    (err) => {
      const msgs = { 1: '定位被拒绝', 2: '无位置信号', 3: '定位超时' };
      if (statusEl) statusEl.textContent = msgs[err.code] || '定位失败';
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );

  cleanupFns.push(() => {
    ac.abort();
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

  function draw(now) {
    const campScreen = document.getElementById('scene-camp');
    if (campScreen?.dataset.campMode === 'terrain') return;

    ctx.fillStyle = 'rgba(3,5,12,0.25)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const t = now / 1000;

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
  motionOff = Motion.register(draw);
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

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const ox = canvas.width * 0.15;
    const oy = canvas.height * 0.05;
    const scale = Math.min(canvas.width, canvas.height) * 0.55;
    ctx.strokeStyle = 'rgba(240,192,96,0.15)';
    lines.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(ox + dipper[a][0] * scale, oy + dipper[a][1] * scale);
      ctx.lineTo(ox + dipper[b][0] * scale, oy + dipper[b][1] * scale);
      ctx.stroke();
    });
    dipper.forEach(([x, y], i) => {
      ctx.beginPath();
      ctx.arc(ox + x * scale, oy + y * scale, i === 6 ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240,192,96,0.5)';
      ctx.fill();
    });
  }

  resize();
  window.addEventListener('resize', resize);
  cleanupFns.push(() => window.removeEventListener('resize', resize));
}

function initCompass(cleanupFns) {
  const ring = document.getElementById('compass-ring');
  if (!ring) return;
  const smoother = createSmoother(0.1);
  let heading = 0;

  function onOrient(e) {
    const { x, y } = smoother.update(e.gamma || 0, e.beta || 0);
    ring.style.transform = `rotateX(${-y * 0.6}deg) rotateY(${x * 0.6}deg) rotateZ(${heading}deg)`;
  }

  function onHeading(e) {
    if (e.webkitCompassHeading != null) heading = e.webkitCompassHeading;
    else if (e.alpha != null) heading = 360 - e.alpha;
  }

  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', onOrient);
    window.addEventListener('deviceorientation', onHeading);
    cleanupFns.push(() => {
      window.removeEventListener('deviceorientation', onOrient);
      window.removeEventListener('deviceorientation', onHeading);
    });
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      ring.style.cursor = 'pointer';
      ring.addEventListener('click', () => {
        DeviceOrientationEvent.requestPermission().catch(() => {});
      }, { once: true });
    }
  } else {
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 30;
      const y = (e.clientY / window.innerHeight - 0.5) * 30;
      ring.style.transform = `rotateX(${-y * 0.4}deg) rotateY(${x * 0.4}deg)`;
    };
    document.addEventListener('mousemove', onMove);
    cleanupFns.push(() => document.removeEventListener('mousemove', onMove));
  }
}
