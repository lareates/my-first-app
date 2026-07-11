/**
 * Endel-inspired generative soundscape engine
 * 参考 https://endel.io/ — 实时生成、多层纹理、缓慢调制、非循环感
 */
const AudioEngine = (() => {
  let ctx = null;
  let master = null;
  let reverb = null;
  let reverbSend = null;
  let breathPhase = 0.5;
  let napMode = 'meditate';
  let napVolume = 0.85;

  // ─── 核心基础设施 ───
  function ensureCtx() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = buildImpulse(ctx, 3.2, 2.8);
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.42;
    reverb.connect(reverbSend);
    reverbSend.connect(master);
    return ctx;
  }

  function buildImpulse(c, duration, decay) {
    const len = c.sampleRate * duration;
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (ch === 0 ? 1 : 0.85);
      }
    }
    return buf;
  }

  function noiseBuffer(type = 'pink', seconds = 4) {
    const c = ensureCtx();
    const buf = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'brown') {
          b0 = (b0 + w * 0.004) / 1.004;
          d[i] = b0 * 12;
        } else if (type === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          d[i] = w * 0.35;
        }
      }
    }
    return buf;
  }

  function createBus(volume = 1) {
    const output = ctx.createGain();
    output.gain.value = volume;
    output.connect(master);
    const dry = ctx.createGain();
    dry.gain.value = 0.78;
    dry.connect(output);
    const wet = ctx.createGain();
    wet.gain.value = 0.38;
    wet.connect(reverb);
    const nodes = [];
    const timers = [];
    const lfos = [];
    return {
      dry, wet, output, nodes, timers, lfos,
      stop() {
        timers.forEach(clearTimeout);
        timers.length = 0;
        lfos.forEach(l => { try { l.stop(); } catch {} });
        lfos.length = 0;
        nodes.forEach(n => { try { n.stop?.(); n.disconnect?.(); } catch {} });
        nodes.length = 0;
      },
    };
  }

  function movingPan(bus, speed = 0.04) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = speed;
    const lg = ctx.createGain();
    lg.gain.value = 0.65;
    lfo.connect(lg);
    lg.connect(pan.pan);
    lfo.start();
    bus.lfos.push(lfo);
    return pan;
  }

  function track(bus, node) {
    bus.nodes.push(node);
    return node;
  }

  function startOsc(bus, opts) {
    const osc = ctx.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.value = opts.freq;
    if (opts.detune) osc.detune.value = opts.detune;
    const g = ctx.createGain();
    g.gain.value = opts.gain ?? 0.02;
    osc.connect(g);
    const dest = opts.wet ? bus.wet : bus.dry;
    if (opts.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = opts.pan;
      g.connect(p);
      p.connect(dest);
    } else {
      g.connect(dest);
    }
    osc.start();
    track(bus, osc);
    return { osc, g };
  }

  function slowLfo(hz, depth, target, base = 0) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = hz;
    const lg = ctx.createGain();
    lg.gain.value = depth;
    lfo.connect(lg);
    lg.connect(target);
    lfo.start();
    if (base) target.value = base;
    return lfo;
  }

  /** 春雨车顶 — 粉红噪 + 低通 ~1500Hz */
  function buildRain(bus) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer('pink', 8);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.Q.value = 0.65;
    const g = ctx.createGain();
    g.gain.value = 0.38;
    src.connect(lp);
    lp.connect(g);
    g.connect(bus.dry);
    g.connect(bus.wet);
    src.start();
    track(bus, src);
    bus.mod = () => {};
  }

  /** 溪水潺潺 — 褐噪 + 粉红噪混合，微弱 LFO 调制 */
  function buildStream(bus) {
    const mix = ctx.createGain();
    mix.gain.value = 0.36;
    mix.connect(bus.dry);
    mix.connect(bus.wet);

    const brownSrc = ctx.createBufferSource();
    brownSrc.buffer = noiseBuffer('brown', 8);
    brownSrc.loop = true;
    const brownLp = ctx.createBiquadFilter();
    brownLp.type = 'lowpass';
    brownLp.frequency.value = 480;
    brownLp.Q.value = 0.5;
    const brownG = ctx.createGain();
    brownG.gain.value = 0.72;
    brownSrc.connect(brownLp);
    brownLp.connect(brownG);
    brownG.connect(mix);
    brownSrc.start();
    track(bus, brownSrc);

    const pinkSrc = ctx.createBufferSource();
    pinkSrc.buffer = noiseBuffer('pink', 6);
    pinkSrc.loop = true;
    const pinkBp = ctx.createBiquadFilter();
    pinkBp.type = 'bandpass';
    pinkBp.frequency.value = 420;
    pinkBp.Q.value = 0.35;
    const pinkG = ctx.createGain();
    pinkG.gain.value = 0.28;
    pinkSrc.connect(pinkBp);
    pinkBp.connect(pinkG);
    pinkG.connect(mix);
    pinkSrc.start();
    track(bus, pinkSrc);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.045;
    lfo.connect(lfoG);
    lfoG.connect(mix.gain);
    lfo.start();
    bus.lfos.push(lfo);
    bus.mod = () => {};
  }

  /** 潮汐海滨 — 褐噪底 + 正弦 LFO（~7s 周期）潮汐起伏 */
  function buildWaves(bus) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer('brown', 10);
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    lp.Q.value = 0.45;
    const g = ctx.createGain();
    g.gain.value = 0.42;
    src.connect(lp);
    lp.connect(g);
    g.connect(bus.dry);
    g.connect(bus.wet);
    src.start();
    track(bus, src);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1 / 7;
    const lfoG = ctx.createGain();
    lfoG.gain.value = 0.22;
    lfo.connect(lfoG);
    lfoG.connect(g.gain);
    lfo.start();
    bus.lfos.push(lfo);
    bus.mod = () => {};
  }

  function buildRelax(bus) {
    const chord = [146.83, 174.61, 220, 261.63, 329.63]; // Dm 泛音列
    chord.forEach((f, i) => {
      const { osc, g } = startOsc(bus, { freq: f, type: 'sine', gain: 0.018 - i * 0.002, wet: i > 2 });
      slowLfo(0.03 + i * 0.008, f * 0.003, osc.detune);
      slowLfo(0.02 + i * 0.005, 0.012, g.gain, 0.018 - i * 0.002);
    });

    const airPan = movingPan(bus, 0.025);
    const airSrc = ctx.createBufferSource();
    airSrc.buffer = noiseBuffer('pink', 6);
    airSrc.loop = true;
    const airF = ctx.createBiquadFilter();
    airF.type = 'lowpass';
    airF.frequency.value = 680;
    airF.Q.value = 0.4;
    const airG = ctx.createGain();
    airG.gain.value = 0.045;
    airSrc.connect(airF);
    airF.connect(airG);
    airG.connect(airPan);
    airPan.connect(bus.dry);
    airPan.connect(bus.wet);
    airSrc.start();
    track(bus, airSrc);
    slowLfo(0.05, 200, airF.frequency, 680);

    const mistPan = movingPan(bus, 0.018);
    const mistSrc = ctx.createBufferSource();
    mistSrc.buffer = noiseBuffer('pink', 5);
    mistSrc.loop = true;
    const mistF = ctx.createBiquadFilter();
    mistF.type = 'bandpass';
    mistF.frequency.value = 1400;
    mistF.Q.value = 0.25;
    const mistG = ctx.createGain();
    mistG.gain.value = 0.022;
    mistSrc.connect(mistF);
    mistF.connect(mistG);
    mistG.connect(mistPan);
    mistPan.connect(bus.wet);
    mistSrc.start();
    track(bus, mistSrc);

    addBinaural(bus, 176, 8, 0.012);
    scheduleSoftTones(bus, [146.83, 174.61, 220, 261.63], 9000, 22000, 0.06);
    bus.mod = () => {
      const t = ctx.currentTime;
      const ph = breathPhase;
      airG.gain.setTargetAtTime(0.035 + ph * 0.02, t, 0.6);
      mistG.gain.setTargetAtTime(0.015 + (1 - ph) * 0.015, t, 0.6);
    };
  }

  /** Endel Sleep — 入睡引导旋律 → 极柔噪声床 */
  function buildSleep(bus) {
    const bedPan = movingPan(bus, 0.012);
    const bedSrc = ctx.createBufferSource();
    bedSrc.buffer = noiseBuffer('brown', 8);
    bedSrc.loop = true;
    const bedF = ctx.createBiquadFilter();
    bedF.type = 'lowpass';
    bedF.frequency.value = 140;
    const bedG = ctx.createGain();
    bedG.gain.value = 0;
    bedSrc.connect(bedF);
    bedF.connect(bedG);
    bedG.connect(bedPan);
    bedPan.connect(bus.dry);
    bedPan.connect(bus.wet);
    bedSrc.start();
    track(bus, bedSrc);

    const sub = startOsc(bus, { freq: 48, type: 'sine', gain: 0.018, wet: true });
    slowLfo(0.08, 0.006, sub.g.gain, 0.018);

    addBinaural(bus, 90, 2, 0.008);

    const lull = [130.81, 155.56, 174.61];
    lull.forEach((f, i) => {
      const { g } = startOsc(bus, { freq: f, type: 'triangle', gain: 0, wet: true });
      const t = ctx.currentTime + i * 0.8;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.04, t + 3);
      g.gain.linearRampToValueAtTime(0, t + 12);
    });

    const t0 = ctx.currentTime;
    bedG.gain.setValueAtTime(0, t0);
    bedG.gain.linearRampToValueAtTime(0.055, t0 + 18);
    bedG.gain.linearRampToValueAtTime(0.048, t0 + 40);

    slowLfo(0.015, 30, bedF.frequency, 140);
    bus.mod = () => {};
  }

  /** Endel Breathe — 呼吸同步膨胀垫音 */
  function buildBreath(bus) {
    const root = [110, 130.81, 164.81, 196];
    root.forEach((f, i) => {
      const { osc, g } = startOsc(bus, { freq: f, type: 'sine', gain: 0.01, wet: true });
      slowLfo(0.04 + i * 0.01, f * 0.002, osc.detune);
      bus.breathGains = bus.breathGains || [];
      bus.breathGains.push(g);
    });

    const whooshPan = movingPan(bus, 0.06);
    const whooshSrc = ctx.createBufferSource();
    whooshSrc.buffer = noiseBuffer('pink', 4);
    whooshSrc.loop = true;
    const whooshF = ctx.createBiquadFilter();
    whooshF.type = 'bandpass';
    whooshF.frequency.value = 500;
    whooshF.Q.value = 0.8;
    const whooshG = ctx.createGain();
    whooshG.gain.value = 0;
    whooshSrc.connect(whooshF);
    whooshF.connect(whooshG);
    whooshG.connect(whooshPan);
    whooshPan.connect(bus.dry);
    whooshSrc.start();
    track(bus, whooshSrc);
    bus.whooshG = whooshG;
    bus.whooshF = whooshF;

    addBinaural(bus, 160, 6, 0.01);
    bus.mod = () => {
      const t = ctx.currentTime;
      const ph = breathPhase;
      (bus.breathGains || []).forEach((g, i) => {
        g.gain.setTargetAtTime(0.008 + ph * 0.022 - i * 0.002, t, 0.25);
      });
      whooshG.gain.setTargetAtTime(ph * ph * 0.035, t, 0.2);
      whooshF.frequency.setTargetAtTime(350 + ph * 500, t, 0.25);
    };
  }

  function addBinaural(bus, carrier, beat, gain) {
    const l = startOsc(bus, { freq: carrier, gain: 0, pan: -1 });
    const r = startOsc(bus, { freq: carrier + beat, gain: 0, pan: 1 });
    l.g.gain.value = gain;
    r.g.gain.value = gain;
  }

  function scheduleSoftTones(bus, scale, minMs, maxMs, peak) {
    function play() {
      if (!bus.active) return;
      const f = scale[Math.floor(Math.random() * scale.length)] * (Math.random() > 0.85 ? 2 : 1);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak * (0.5 + Math.random() * 0.5), t + 1.8 + Math.random());
      g.gain.exponentialRampToValueAtTime(0.001, t + 7 + Math.random() * 4);
      osc.connect(g);
      g.connect(bus.wet);
      osc.start(t);
      osc.stop(t + 12);
      bus.timers.push(setTimeout(play, minMs + Math.random() * (maxMs - minMs)));
    }
    play();
  }

  function scheduleRainDrops(bus, gainNode, density = 1) {
    function drop() {
      if (!bus.active) return;
      const t = ctx.currentTime;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.08, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / 400);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 600 + Math.random() * 2000;
      f.Q.value = 1.2;
      const g = ctx.createGain();
      g.gain.value = 0.02 + Math.random() * 0.03;
      const pan = ctx.createStereoPanner();
      pan.pan.value = Math.random() * 2 - 1;
      src.connect(f);
      f.connect(g);
      g.connect(pan);
      pan.connect(gainNode);
      src.start(t);
      src.stop(t + 0.1);
      bus.timers.push(setTimeout(drop, (200 + Math.random() * 800) / density));
    }
    drop();
  }

  // ─── Nap 场景 ───
  const nap = { bus: null, modId: null };

  function stopNapNodes() {
    if (nap.modId) clearInterval(nap.modId);
    nap.bus?.stop();
    nap.bus = null;
  }

  const NAP_SOUNDSCAPES = ['woven', 'rain', 'stream', 'waves'];

  function startNapAudio(mode = 'meditate', volume = 70, soundscape = 'woven') {
    ensureCtx();
    napMode = mode;
    napVolume = volume / 100;
    stopNapNodes();

    const sc = NAP_SOUNDSCAPES.includes(soundscape) ? soundscape : 'woven';
    const bus = createBus(napVolume);
    bus.active = true;
    nap.bus = bus;

    if (sc === 'rain') buildRain(bus);
    else if (sc === 'stream') buildStream(bus);
    else if (sc === 'waves') buildWaves(bus);
    else if (mode === 'sleep') buildSleep(bus);
    else if (mode === 'breathe') buildBreath(bus);
    else buildRelax(bus);

    if (bus.mod && sc === 'woven') {
      nap.modId = setInterval(() => { if (nap.bus?.active) bus.mod(); }, 90);
    }
  }

  function stopNapAudio() {
    if (nap.bus) nap.bus.active = false;
    stopNapNodes();
  }

  function fadeOutNapAudio(duration = 8) {
    if (!nap.bus?.output || !ctx) return Promise.resolve();
    const t = ctx.currentTime;
    nap.bus.active = false;
    nap.bus.output.gain.cancelScheduledValues(t);
    nap.bus.output.gain.setValueAtTime(nap.bus.output.gain.value, t);
    nap.bus.output.gain.linearRampToValueAtTime(0.001, t + duration);
    return new Promise(resolve => {
      setTimeout(() => {
        stopNapNodes();
        resolve();
      }, duration * 1000 + 80);
    });
  }

  function playBirdChorus() {
    const c = ensureCtx();
    const t = c.currentTime;
    const birds = [
      { f: 2800, t: 0, dur: 0.12 },
      { f: 3200, t: 0.35, dur: 0.1 },
      { f: 2400, t: 0.7, dur: 0.14 },
      { f: 3600, t: 1.1, dur: 0.08 },
      { f: 2900, t: 1.6, dur: 0.11 },
      { f: 3100, t: 2.2, dur: 0.09 },
      { f: 2700, t: 2.8, dur: 0.13 },
      { f: 3400, t: 3.4, dur: 0.1 },
    ];
    birds.forEach(b => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(b.f, t + b.t);
      osc.frequency.exponentialRampToValueAtTime(b.f * 0.85, t + b.t + b.dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t + b.t);
      g.gain.linearRampToValueAtTime(0.06, t + b.t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + b.t + b.dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t + b.t);
      osc.stop(t + b.t + b.dur + 0.05);
    });
    [1800, 2200].forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t + i * 0.5);
      g.gain.linearRampToValueAtTime(0.03, t + i * 0.5 + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.5 + 2.5);
      osc.connect(g);
      g.connect(reverbSend);
      osc.start(t + i * 0.5);
      osc.stop(t + i * 0.5 + 3);
    });
  }

  function setNapVolume(v) {
    napVolume = v / 100;
    if (nap.bus?.output) nap.bus.output.gain.setTargetAtTime(napVolume, ctx.currentTime, 0.15);
  }

  function setBreathPhase(p) { breathPhase = Math.max(0, Math.min(1, p)); }

  // ─── Camp 场景 — Endel 户外变体 ───
  const camp = { bus: null };

  function buildCampStars(bus) {
    const nightPan = movingPan(bus, 0.01);
    const night = ctx.createBufferSource();
    night.buffer = noiseBuffer('brown', 6);
    night.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'lowpass';
    nf.frequency.value = 220;
    const ng = ctx.createGain();
    ng.gain.value = 0.04;
    night.connect(nf);
    nf.connect(ng);
    ng.connect(nightPan);
    nightPan.connect(bus.dry);
    nightPan.connect(bus.wet);
    night.start();
    track(bus, night);
    slowLfo(0.02, 40, nf.frequency, 220);

    [65.41, 98, 130.81].forEach((f, i) => {
      startOsc(bus, { freq: f, type: 'sine', gain: 0.008 - i * 0.001, wet: true });
    });

    scheduleSoftTones(bus, [523.25, 659.25, 783.99], 14000, 35000, 0.025);
    scheduleCricket(bus);
  }

  function scheduleCricket(bus) {
    function chirp() {
      if (!bus.active) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(4200 + Math.random() * 800, t);
      osc.frequency.exponentialRampToValueAtTime(2800, t + 0.04);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.008, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(g);
      g.connect(bus.wet);
      osc.start(t);
      osc.stop(t + 0.08);
      bus.timers.push(setTimeout(chirp, 600 + Math.random() * 2400));
    }
    chirp();
  }

  function buildCampTerrain(bus) {
    const windPan = movingPan(bus, 0.035);
    const wind = ctx.createBufferSource();
    wind.buffer = noiseBuffer('pink', 5);
    wind.loop = true;
    const wf1 = ctx.createBiquadFilter();
    wf1.type = 'bandpass';
    wf1.frequency.value = 280;
    wf1.Q.value = 0.5;
    const wf2 = ctx.createBiquadFilter();
    wf2.type = 'lowpass';
    wf2.frequency.value = 600;
    const wg = ctx.createGain();
    wg.gain.value = 0.05;
    wind.connect(wf1);
    wf1.connect(wf2);
    wf2.connect(wg);
    wg.connect(windPan);
    windPan.connect(bus.dry);
    windPan.connect(bus.wet);
    wind.start();
    track(bus, wind);
    slowLfo(0.03, 120, wf1.frequency, 280);
    slowLfo(0.02, 0.02, wg.gain, 0.05);

    startOsc(bus, { freq: 36, type: 'sine', gain: 0.012, wet: true });
    scheduleRainDrops(bus, bus.wet, 0.4);
  }

  function buildCampOrient(bus) {
    const drone = startOsc(bus, { freq: 55, type: 'sine', gain: 0.015, wet: true });
    slowLfo(0.015, 0.004, drone.g.gain, 0.015);

    const rotPan = movingPan(bus, 0.08);
    const hum = ctx.createBufferSource();
    hum.buffer = noiseBuffer('pink', 4);
    hum.loop = true;
    const hf = ctx.createBiquadFilter();
    hf.type = 'bandpass';
    hf.frequency.value = 180;
    hf.Q.value = 2;
    const hg = ctx.createGain();
    hg.gain.value = 0.025;
    hum.connect(hf);
    hf.connect(hg);
    hg.connect(rotPan);
    rotPan.connect(bus.dry);
    hum.start();
    track(bus, hum);
  }

  function startCampAudio(mode = 'stars', volume = 50) {
    ensureCtx();
    stopCampAudio();
    const bus = createBus(volume / 100);
    bus.active = true;
    camp.bus = bus;
    if (mode === 'terrain') buildCampTerrain(bus);
    else if (mode === 'orient') buildCampOrient(bus);
    else buildCampStars(bus);
  }

  function stopCampAudio() {
    if (camp.bus) camp.bus.active = false;
    camp.bus?.stop();
    camp.bus = null;
  }

  function setCampVolume(v) {
    if (camp.bus?.output) camp.bus.output.gain.setTargetAtTime(v / 100, ctx.currentTime, 0.15);
  }

  // ─── Focus — Endel Focus + 环境层 ───
  const focus = { bus: null, layers: { lofi: 0, rain: 0, wiper: 0 } };

  function buildFocusCore(bus) {
    const pulseChord = [130.81, 164.81, 196, 246.94];
    pulseChord.forEach((f, i) => {
      const { osc, g } = startOsc(bus, { freq: f, type: 'triangle', gain: 0.014 - i * 0.002 });
      slowLfo(0.06 + i * 0.01, 0.008, g.gain, 0.014 - i * 0.002);
    });

    const pulseOsc = ctx.createOscillator();
    pulseOsc.type = 'sine';
    pulseOsc.frequency.value = 55;
    const pulseAmp = ctx.createGain();
    pulseAmp.gain.value = 0.008;
    pulseOsc.connect(pulseAmp);
    pulseAmp.connect(bus.dry);
    pulseOsc.start();
    slowLfo(1.1, 0.004, pulseAmp.gain, 0.008);
    track(bus, pulseOsc);

    const focusAir = ctx.createBufferSource();
    focusAir.buffer = noiseBuffer('pink', 4);
    focusAir.loop = true;
    const faF = ctx.createBiquadFilter();
    faF.type = 'lowpass';
    faF.frequency.value = 400;
    bus.lofiBed = ctx.createGain();
    bus.lofiBed.gain.value = 0.04;
    focusAir.connect(faF);
    faF.connect(bus.lofiBed);
    bus.lofiBed.connect(bus.dry);
    focusAir.start();
    track(bus, focusAir);

    scheduleSoftTones(bus, [130.81, 164.81, 196, 261.63], 12000, 28000, 0.035);

    bus.rainBed = ctx.createGain();
    bus.rainBed.gain.value = 0;
    bus.rainBed.connect(bus.wet);
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = noiseBuffer('pink', 5);
    rainSrc.loop = true;
    const rf = ctx.createBiquadFilter();
    rf.type = 'bandpass';
    rf.frequency.value = 750;
    rf.Q.value = 0.35;
    rainSrc.connect(rf);
    rf.connect(bus.rainBed);
    rainSrc.start();
    track(bus, rainSrc);
    scheduleRainDrops(bus, bus.rainBed, 1.2);

    bus.wiperBed = ctx.createGain();
    bus.wiperBed.gain.value = 0;
    bus.wiperBed.connect(bus.dry);
    const wiperSrc = ctx.createBufferSource();
    wiperSrc.buffer = noiseBuffer('white', 3);
    wiperSrc.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 1800;
    wf.Q.value = 3;
    wiperSrc.connect(wf);
    wf.connect(bus.wiperBed);
    wiperSrc.start();
    track(bus, wiperSrc);
    scheduleWiper(bus);
  }

  function scheduleWiper(bus) {
    function swipe() {
      if (!bus.active) return;
      const t = ctx.currentTime;
      const base = bus.wiperBed?.gain.value || 0;
      if (base > 0.001) {
        bus.wiperBed.gain.cancelScheduledValues(t);
        bus.wiperBed.gain.setValueAtTime(base * 0.15, t);
        bus.wiperBed.gain.linearRampToValueAtTime(base, t + 0.12);
        bus.wiperBed.gain.linearRampToValueAtTime(base * 0.15, t + 0.45);
      }
      bus.timers.push(setTimeout(swipe, 1100 + Math.random() * 400));
    }
    swipe();
  }

  function startFocusMix(volumes) {
    ensureCtx();
    focus.layers = { lofi: volumes.lofi ?? 70, rain: volumes.rain ?? 0, wiper: volumes.wiper ?? 0 };
    if (!focus.bus) {
      const bus = createBus(0);
      bus.active = true;
      buildFocusCore(bus);
      focus.bus = bus;
    }
    focus.bus.active = true;
    const t = ctx.currentTime;
    focus.bus.output.gain.cancelScheduledValues(t);
    focus.bus.output.gain.setValueAtTime(focus.bus.output.gain.value, t);
    focus.bus.output.gain.linearRampToValueAtTime(1, t + 0.35);
    applyFocusVolumes(volumes);
  }

  function applyFocusVolumes({ lofi = 70, rain = 0, wiper = 0 }) {
    if (!focus.bus) return;
    focus.layers = { lofi, rain, wiper };
    const t = ctx.currentTime;
    focus.bus.lofiBed?.gain.setTargetAtTime(lofi / 100 * 0.06, t, 0.2);
    focus.bus.rainBed?.gain.setTargetAtTime(rain / 100 * 0.08, t, 0.2);
    focus.bus.wiperBed?.gain.setTargetAtTime(wiper / 100 * 0.05, t, 0.2);
  }

  function stopFocusMix() {
    if (!focus.bus) return;
    focus.bus.active = false;
    const t = ctx.currentTime;
    focus.bus.output.gain.cancelScheduledValues(t);
    focus.bus.output.gain.setValueAtTime(focus.bus.output.gain.value, t);
    focus.bus.output.gain.linearRampToValueAtTime(0.001, t + 0.45);
    setTimeout(() => {
      if (focus.bus && !focus.bus.active) {
        focus.bus.stop();
        focus.bus = null;
      }
    }, 520);
  }

  // ─── 过渡音效 ───
  function playVinylCrackle() {
    const c = ensureCtx();
    const t = c.currentTime;
    [261.63, 329.63, 392].forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.04 / (i + 1), t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      osc.connect(g);
      g.connect(reverbSend);
      osc.start(t);
      osc.stop(t + 2);
    });
  }

  function playSingingBowl() {
    const c = ensureCtx();
    const t = c.currentTime;
    [146.83, 293.66, 440].forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.1 / (i + 1), t + 0.08);
      g.gain.exponentialRampToValueAtTime(0.001, t + 4.5);
      osc.connect(g);
      g.connect(reverbSend);
      osc.start(t);
      osc.stop(t + 5);
    });
  }

  async function resume() {
    const c = ensureCtx();
    if (c.state === 'suspended') await c.resume();
    return c;
  }

  function stopAll() {
    stopNapAudio();
    stopCampAudio();
    stopFocusMix();
    focus.bus?.stop();
    focus.bus = null;
  }

  return {
    resume,
    NAP_SOUNDSCAPES,
    startNapAudio, stopNapAudio, fadeOutNapAudio, setNapVolume, setBreathPhase,
    startCampAudio, stopCampAudio, setCampVolume,
    startFocusMix, stopFocusMix, applyFocusVolumes,
    playVinylCrackle, playSingingBowl, playBirdChorus, stopAll,
  };
})();
