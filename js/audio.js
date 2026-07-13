/**
 * Aetheris Audio Engine
 * 真实采样 + Web Audio 无缝交叉淡化 / 座舱低通 / 立体声漂移
 */
const AudioEngine = (() => {
  const CROSSFADE_SEC = 3;
  const FADE_OUT_SEC = 2.5;
  const FADE_IN_SEC = 2;
  const LOOKAHEAD_SEC = 6;
  const SCHEDULER_MS = 500;

  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {GainNode|null} */
  let master = null;
  /** @type {ConvolverNode|null} */
  let reverb = null;
  /** @type {GainNode|null} */
  let reverbSend = null;

  let breathPhase = 0.5;

  /** @type {Map<string, AudioBuffer>} */
  const bufferCache = new Map();
  /** @type {Map<string, Promise<AudioBuffer>>} */
  const bufferLoading = new Map();

  const SAMPLE_PRESETS = {
    rain: {
      url: 'assets/audio/rain.mp3',
      lowpass: 1100,
      panDrift: true,
      label: 'rain',
    },
    stream: {
      url: 'assets/audio/river.mp3',
      lowpass: 800,
      panDrift: false,
      label: 'river',
    },
    waves: {
      url: 'assets/audio/waves.mp3',
      lowpass: 550,
      panDrift: true,
      label: 'waves',
    },
    wind: {
      url: 'assets/audio/wind.mp3',
      lowpass: 400,
      panDrift: true,
      label: 'wind',
    },
    fireplace: {
      url: 'assets/audio/fireplace.mp3',
      lowpass: 1400,
      panDrift: false,
      label: 'fireplace',
    },
  };

  const NAP_SOUNDSCAPES = ['woven', ...Object.keys(SAMPLE_PRESETS)];
  const CAMP_SAMPLE_MAP = {
    stars: 'fireplace',
    terrain: 'wind',
    orient: 'wind',
  };

  function ensureCtx() {
    if (ctx) return ctx;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 1;
    master.connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = buildImpulse(ctx, 2.4, 2.6);
    reverbSend = ctx.createGain();
    reverbSend.gain.value = 0.22;
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
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay) * (ch === 0 ? 1 : 0.88);
      }
    }
    return buf;
  }

  async function loadBuffer(url) {
    ensureCtx();
    if (bufferCache.has(url)) return bufferCache.get(url);
    if (bufferLoading.has(url)) return bufferLoading.get(url);

    const promise = (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`[Audio] failed to load ${url}: ${res.status}`);
      const raw = await res.arrayBuffer();
      // Safari 需要拷贝一份再 decode
      const copy = raw.slice(0);
      const buf = await ctx.decodeAudioData(copy);
      bufferCache.set(url, buf);
      bufferLoading.delete(url);
      return buf;
    })().catch((err) => {
      bufferLoading.delete(url);
      throw err;
    });

    bufferLoading.set(url, promise);
    return promise;
  }

  /**
   * 双 Source 交叉淡化循环播放器
   * 严禁 AudioBufferSourceNode.loop / HTMLMediaElement.loop
   */
  class CrossfadeSamplePlayer {
    constructor() {
      this.filter = null;
      this.pan = null;
      this.bus = null;
      this.wet = null;
      this.voices = [];
      this.buffer = null;
      this.active = false;
      this.generation = 0;
      this.nextStart = 0;
      this.nextVoice = 0;
      this.schedulerId = null;
      this.panLfo = null;
      this.userVolume = 1;
      this.fadeToken = 0;
      this.stopTimer = null;
    }

    _buildGraph() {
      ensureCtx();
      this.bus = ctx.createGain();
      this.bus.gain.value = 0;

      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.Q.value = 0.55;

      this.pan = ctx.createStereoPanner();
      this.pan.pan.value = 0;

      this.wet = ctx.createGain();
      this.wet.gain.value = 0.18;

      this.voices = [0, 1].map(() => {
        const gain = ctx.createGain();
        gain.gain.value = 0;
        gain.connect(this.filter);
        return { gain, src: null };
      });

      this.filter.connect(this.pan);
      this.pan.connect(this.bus);
      this.bus.connect(master);
      this.pan.connect(this.wet);
      this.wet.connect(reverb);
    }

    _teardownGraph() {
      this._stopPanLfo();
      this.voices.forEach((v) => {
        try { v.src?.stop(); } catch {}
        try { v.src?.disconnect(); } catch {}
        try { v.gain.disconnect(); } catch {}
        v.src = null;
      });
      try { this.filter?.disconnect(); } catch {}
      try { this.pan?.disconnect(); } catch {}
      try { this.wet?.disconnect(); } catch {}
      try { this.bus?.disconnect(); } catch {}
      this.filter = null;
      this.pan = null;
      this.wet = null;
      this.bus = null;
      this.voices = [];
    }

    _stopPanLfo() {
      if (this.panLfo) {
        try { this.panLfo.stop(); } catch {}
        try { this.panLfo.disconnect(); } catch {}
        this.panLfo = null;
      }
    }

    _startPanDrift() {
      this._stopPanLfo();
      const period = 15 + Math.random() * 5; // 15–20s
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 1 / period;
      const depth = ctx.createGain();
      depth.gain.value = 0.25;
      lfo.connect(depth);
      depth.connect(this.pan.pan);
      lfo.start();
      this.panLfo = lfo;
    }

    _clearScheduler() {
      if (this.schedulerId != null) {
        clearTimeout(this.schedulerId);
        this.schedulerId = null;
      }
    }

    _spawnVoice(voiceIndex, when, fadeInSec) {
      const voice = this.voices[voiceIndex];
      if (!voice || !this.buffer) return;

      try { voice.src?.stop(when); } catch {}
      try { voice.src?.disconnect(); } catch {}

      const src = ctx.createBufferSource();
      src.buffer = this.buffer;
      // 严禁 src.loop = true
      src.connect(voice.gain);

      const dur = this.buffer.duration;
      const xf = Math.min(CROSSFADE_SEC, Math.max(0.5, dur * 0.35));
      const g = voice.gain.gain;
      const t0 = Math.max(when, ctx.currentTime);

      g.cancelScheduledValues(t0);
      g.setValueAtTime(0, t0);
      if (fadeInSec > 0.001) {
        g.linearRampToValueAtTime(1, t0 + fadeInSec);
      } else {
        g.setValueAtTime(1, t0);
      }
      // 尾部淡出，与下一轨交叉
      const fadeOutAt = t0 + dur - xf;
      g.setValueAtTime(1, fadeOutAt);
      g.linearRampToValueAtTime(0, fadeOutAt + xf);

      src.start(t0);
      src.stop(t0 + dur + 0.05);
      voice.src = src;
    }

    _scheduleAhead(gen) {
      if (!this.active || gen !== this.generation || !this.buffer) return;

      const dur = this.buffer.duration;
      const xf = Math.min(CROSSFADE_SEC, Math.max(0.5, dur * 0.35));
      const horizon = ctx.currentTime + LOOKAHEAD_SEC;

      while (this.nextStart < horizon) {
        const fadeIn = this.nextStart <= ctx.currentTime + 0.05 ? 0 : xf;
        this._spawnVoice(this.nextVoice, this.nextStart, fadeIn);
        this.nextStart += dur - xf;
        this.nextVoice = 1 - this.nextVoice;
      }

      this.schedulerId = setTimeout(() => this._scheduleAhead(gen), SCHEDULER_MS);
    }

    async start(presetKey, volume = 1, { fadeIn = FADE_IN_SEC } = {}) {
      const preset = SAMPLE_PRESETS[presetKey];
      if (!preset) throw new Error(`[Audio] unknown preset ${presetKey}`);

      ensureCtx();
      if (ctx.state === 'suspended') await ctx.resume();

      this.stopImmediate();
      this._buildGraph();

      this.buffer = await loadBuffer(preset.url);
      this.filter.frequency.value = preset.lowpass;
      this.userVolume = Math.max(0, Math.min(1, volume));
      this.active = true;
      this.generation += 1;
      const gen = this.generation;

      if (preset.panDrift) this._startPanDrift();
      else this.pan.pan.value = 0;

      const t = ctx.currentTime;
      this.bus.gain.cancelScheduledValues(t);
      this.bus.gain.setValueAtTime(0, t);
      this.bus.gain.linearRampToValueAtTime(this.userVolume, t + Math.max(0.05, fadeIn));

      this.nextVoice = 0;
      this.nextStart = t;
      this._scheduleAhead(gen);
    }

    setVolume(volume) {
      this.userVolume = Math.max(0, Math.min(1, volume));
      if (!this.bus || !ctx) return;
      const t = ctx.currentTime;
      this.bus.gain.cancelScheduledValues(t);
      this.bus.gain.setTargetAtTime(this.userVolume, t, 0.12);
    }

    /**
     * 平滑淡出后停止
     * @returns {Promise<void>}
     */
    fadeOut(duration = FADE_OUT_SEC) {
      this.fadeToken += 1;
      const token = this.fadeToken;
      if (!this.bus || !ctx || !this.active) {
        this.stopImmediate();
        return Promise.resolve();
      }

      this.active = false;
      this._clearScheduler();

      const t = ctx.currentTime;
      const current = this.bus.gain.value;
      this.bus.gain.cancelScheduledValues(t);
      this.bus.gain.setValueAtTime(current, t);
      this.bus.gain.linearRampToValueAtTime(0, t + Math.max(0.05, duration));

      return new Promise((resolve) => {
        if (this.stopTimer) clearTimeout(this.stopTimer);
        this.stopTimer = setTimeout(() => {
          if (token !== this.fadeToken) {
            resolve();
            return;
          }
          this.stopImmediate();
          resolve();
        }, duration * 1000 + 60);
      });
    }

    stopImmediate() {
      this.active = false;
      this.fadeToken += 1;
      this._clearScheduler();
      if (this.stopTimer) {
        clearTimeout(this.stopTimer);
        this.stopTimer = null;
      }
      this._teardownGraph();
      this.buffer = null;
    }
  }

  // ─── Nap：氛围织境（生成式）+ 真实采样 ───
  const napPlayer = new CrossfadeSamplePlayer();
  let napPreset = 'woven';
  let napMode = 'meditate';
  let napVolume = 0.55;
  let napSwitchChain = Promise.resolve();

  const woven = {
    bus: null,
    dry: null,
    wet: null,
    nodes: [],
    timers: [],
    lfos: [],
    modId: null,
    mod: null,
    breathGains: null,
    whooshG: null,
    whooshF: null,
  };

  function noiseBufferPinkBrown(type = 'pink', seconds = 4) {
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
        } else {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        }
      }
    }
    return buf;
  }

  function wovenTrack(node) {
    woven.nodes.push(node);
    return node;
  }

  function wovenMovingPan(speed = 0.04) {
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = speed;
    const lg = ctx.createGain();
    lg.gain.value = 0.55;
    lfo.connect(lg);
    lg.connect(pan.pan);
    lfo.start();
    woven.lfos.push(lfo);
    return pan;
  }

  function wovenSlowLfo(hz, depth, target, base = 0) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = hz;
    const lg = ctx.createGain();
    lg.gain.value = depth;
    lfo.connect(lg);
    lg.connect(target);
    lfo.start();
    if (base) target.value = base;
    woven.lfos.push(lfo);
    return lfo;
  }

  function wovenStartOsc({ freq, type = 'sine', gain = 0.02, wet = false, pan = null }) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    osc.connect(g);
    const dest = wet ? woven.wet : woven.dry;
    if (pan != null) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(dest);
    } else {
      g.connect(dest);
    }
    osc.start();
    wovenTrack(osc);
    return { osc, g };
  }

  function wovenAddBinaural(carrier, beat, gain) {
    wovenStartOsc({ freq: carrier, gain, pan: -1 });
    wovenStartOsc({ freq: carrier + beat, gain, pan: 1 });
  }

  function wovenScheduleTones(scale, minMs, maxMs, peak) {
    function play() {
      if (!woven.bus) return;
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
      g.connect(woven.wet);
      osc.start(t);
      osc.stop(t + 12);
      woven.timers.push(setTimeout(play, minMs + Math.random() * (maxMs - minMs)));
    }
    play();
  }

  function buildWovenRelax() {
    const chord = [146.83, 174.61, 220, 261.63, 329.63];
    chord.forEach((f, i) => {
      const { osc, g } = wovenStartOsc({ freq: f, type: 'sine', gain: 0.016 - i * 0.002, wet: i > 2 });
      wovenSlowLfo(0.03 + i * 0.008, f * 0.003, osc.detune);
      wovenSlowLfo(0.02 + i * 0.005, 0.01, g.gain, 0.016 - i * 0.002);
    });

    const airPan = wovenMovingPan(0.025);
    const airSrc = ctx.createBufferSource();
    airSrc.buffer = noiseBufferPinkBrown('pink', 6);
    airSrc.loop = true;
    const airF = ctx.createBiquadFilter();
    airF.type = 'lowpass';
    airF.frequency.value = 680;
    airF.Q.value = 0.4;
    const airG = ctx.createGain();
    airG.gain.value = 0.04;
    airSrc.connect(airF);
    airF.connect(airG);
    airG.connect(airPan);
    airPan.connect(woven.dry);
    airPan.connect(woven.wet);
    airSrc.start();
    wovenTrack(airSrc);
    wovenSlowLfo(0.05, 180, airF.frequency, 680);

    const mistPan = wovenMovingPan(0.018);
    const mistSrc = ctx.createBufferSource();
    mistSrc.buffer = noiseBufferPinkBrown('pink', 5);
    mistSrc.loop = true;
    const mistF = ctx.createBiquadFilter();
    mistF.type = 'bandpass';
    mistF.frequency.value = 1400;
    mistF.Q.value = 0.25;
    const mistG = ctx.createGain();
    mistG.gain.value = 0.02;
    mistSrc.connect(mistF);
    mistF.connect(mistG);
    mistG.connect(mistPan);
    mistPan.connect(woven.wet);
    mistSrc.start();
    wovenTrack(mistSrc);

    wovenAddBinaural(176, 8, 0.01);
    wovenScheduleTones([146.83, 174.61, 220, 261.63], 9000, 22000, 0.05);
    woven.mod = () => {
      const t = ctx.currentTime;
      const ph = breathPhase;
      airG.gain.setTargetAtTime(0.03 + ph * 0.018, t, 0.6);
      mistG.gain.setTargetAtTime(0.012 + (1 - ph) * 0.014, t, 0.6);
    };
  }

  function buildWovenSleep() {
    const bedPan = wovenMovingPan(0.012);
    const bedSrc = ctx.createBufferSource();
    bedSrc.buffer = noiseBufferPinkBrown('brown', 8);
    bedSrc.loop = true;
    const bedF = ctx.createBiquadFilter();
    bedF.type = 'lowpass';
    bedF.frequency.value = 140;
    const bedG = ctx.createGain();
    bedG.gain.value = 0;
    bedSrc.connect(bedF);
    bedF.connect(bedG);
    bedG.connect(bedPan);
    bedPan.connect(woven.dry);
    bedPan.connect(woven.wet);
    bedSrc.start();
    wovenTrack(bedSrc);

    const sub = wovenStartOsc({ freq: 48, type: 'sine', gain: 0.016, wet: true });
    wovenSlowLfo(0.08, 0.005, sub.g.gain, 0.016);
    wovenAddBinaural(90, 2, 0.007);

    const lull = [130.81, 155.56, 174.61];
    lull.forEach((f, i) => {
      const { g } = wovenStartOsc({ freq: f, type: 'triangle', gain: 0, wet: true });
      const t = ctx.currentTime + i * 0.8;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + 3);
      g.gain.linearRampToValueAtTime(0, t + 12);
    });

    const t0 = ctx.currentTime;
    bedG.gain.setValueAtTime(0, t0);
    bedG.gain.linearRampToValueAtTime(0.05, t0 + 18);
    bedG.gain.linearRampToValueAtTime(0.042, t0 + 40);
    wovenSlowLfo(0.015, 30, bedF.frequency, 140);
    woven.mod = () => {};
  }

  function buildWovenBreath() {
    const root = [110, 130.81, 164.81, 196];
    woven.breathGains = [];
    root.forEach((f, i) => {
      const { osc, g } = wovenStartOsc({ freq: f, type: 'sine', gain: 0.01, wet: true });
      wovenSlowLfo(0.04 + i * 0.01, f * 0.002, osc.detune);
      woven.breathGains.push(g);
    });

    const whooshPan = wovenMovingPan(0.06);
    const whooshSrc = ctx.createBufferSource();
    whooshSrc.buffer = noiseBufferPinkBrown('pink', 4);
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
    whooshPan.connect(woven.dry);
    whooshSrc.start();
    wovenTrack(whooshSrc);
    woven.whooshG = whooshG;
    woven.whooshF = whooshF;
    wovenAddBinaural(160, 6, 0.009);

    woven.mod = () => {
      const t = ctx.currentTime;
      const ph = breathPhase;
      (woven.breathGains || []).forEach((g, i) => {
        g.gain.setTargetAtTime(0.007 + ph * 0.02 - i * 0.002, t, 0.25);
      });
      whooshG.gain.setTargetAtTime(ph * ph * 0.03, t, 0.2);
      whooshF.frequency.setTargetAtTime(350 + ph * 500, t, 0.25);
    };
  }

  function stopWovenImmediate() {
    if (woven.modId) {
      clearInterval(woven.modId);
      woven.modId = null;
    }
    woven.timers.forEach(clearTimeout);
    woven.timers = [];
    woven.lfos.forEach((l) => {
      try { l.stop(); } catch {}
      try { l.disconnect(); } catch {}
    });
    woven.lfos = [];
    woven.nodes.forEach((n) => {
      try { n.stop?.(); } catch {}
      try { n.disconnect?.(); } catch {}
    });
    woven.nodes = [];
    try { woven.dry?.disconnect(); } catch {}
    try { woven.wet?.disconnect(); } catch {}
    try { woven.bus?.disconnect(); } catch {}
    woven.bus = null;
    woven.dry = null;
    woven.wet = null;
    woven.mod = null;
    woven.breathGains = null;
    woven.whooshG = null;
    woven.whooshF = null;
  }

  function fadeOutWoven(duration = FADE_OUT_SEC) {
    if (!woven.bus || !ctx) {
      stopWovenImmediate();
      return Promise.resolve();
    }
    if (woven.modId) {
      clearInterval(woven.modId);
      woven.modId = null;
    }
    const t = ctx.currentTime;
    const cur = woven.bus.gain.value;
    woven.bus.gain.cancelScheduledValues(t);
    woven.bus.gain.setValueAtTime(cur, t);
    woven.bus.gain.linearRampToValueAtTime(0, t + Math.max(0.05, duration));
    return new Promise((resolve) => {
      setTimeout(() => {
        stopWovenImmediate();
        resolve();
      }, duration * 1000 + 60);
    });
  }

  function startWoven(mode, volume, fadeIn = FADE_IN_SEC) {
    ensureCtx();
    stopWovenImmediate();

    woven.bus = ctx.createGain();
    woven.bus.gain.value = 0;
    woven.bus.connect(master);

    woven.dry = ctx.createGain();
    woven.dry.gain.value = 0.78;
    woven.dry.connect(woven.bus);

    woven.wet = ctx.createGain();
    woven.wet.gain.value = 0.32;
    woven.wet.connect(reverb);

    if (mode === 'sleep') buildWovenSleep();
    else if (mode === 'breathe') buildWovenBreath();
    else buildWovenRelax();

    const t = ctx.currentTime;
    woven.bus.gain.setValueAtTime(0, t);
    woven.bus.gain.linearRampToValueAtTime(Math.max(0, Math.min(1, volume)), t + Math.max(0.05, fadeIn));

    if (woven.mod) {
      woven.modId = setInterval(() => {
        if (woven.bus && woven.mod) woven.mod();
      }, 90);
    }
  }

  function setWovenVolume(volume) {
    if (!woven.bus || !ctx) return;
    const t = ctx.currentTime;
    woven.bus.gain.cancelScheduledValues(t);
    woven.bus.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)), t, 0.12);
  }

  async function stopNapLayers(fade = FADE_OUT_SEC) {
    const jobs = [];
    if (napPlayer.active) jobs.push(fade <= 0 ? (napPlayer.stopImmediate(), null) : napPlayer.fadeOut(fade));
    if (woven.bus) jobs.push(fade <= 0 ? (stopWovenImmediate(), null) : fadeOutWoven(fade));
    await Promise.all(jobs.filter(Boolean));
    if (fade <= 0) {
      napPlayer.stopImmediate();
      stopWovenImmediate();
    }
  }

  function startNapAudio(mode = 'meditate', volume = 55, soundscape = 'woven') {
    const sc = NAP_SOUNDSCAPES.includes(soundscape) ? soundscape : 'woven';
    napPreset = sc;
    napMode = mode;
    napVolume = volume / 100;

    napSwitchChain = napSwitchChain
      .catch(() => {})
      .then(async () => {
        await stopNapLayers(FADE_OUT_SEC);
        if (sc === 'woven') {
          startWoven(mode, napVolume, FADE_IN_SEC);
        } else {
          await napPlayer.start(sc, napVolume, { fadeIn: FADE_IN_SEC });
        }
      })
      .catch((err) => console.warn('[Audio] nap start failed', err));

    return napSwitchChain;
  }

  function stopNapAudio({ fade = FADE_OUT_SEC } = {}) {
    napSwitchChain = napSwitchChain
      .catch(() => {})
      .then(() => stopNapLayers(fade));
    return napSwitchChain;
  }

  function fadeOutNapAudio(duration = 8) {
    return stopNapAudio({ fade: duration });
  }

  function setNapVolume(v) {
    napVolume = v / 100;
    if (napPreset === 'woven') setWovenVolume(napVolume);
    else napPlayer.setVolume(napVolume);
  }

  function setBreathPhase(p) {
    breathPhase = Math.max(0, Math.min(1, p));
  }

  // ─── Camp 场景（采样） ───
  const campPlayer = new CrossfadeSamplePlayer();
  let campVolume = 0.5;
  let campSwitchChain = Promise.resolve();

  function startCampAudio(mode = 'stars', volume = 50) {
    const key = CAMP_SAMPLE_MAP[mode] || 'wind';
    campVolume = volume / 100;
    campSwitchChain = campSwitchChain
      .catch(() => {})
      .then(async () => {
        if (campPlayer.active) await campPlayer.fadeOut(FADE_OUT_SEC);
        await campPlayer.start(key, campVolume, { fadeIn: FADE_IN_SEC });
      })
      .catch((err) => console.warn('[Audio] camp start failed', err));
    return campSwitchChain;
  }

  function stopCampAudio({ fade = FADE_OUT_SEC } = {}) {
    campSwitchChain = campSwitchChain
      .catch(() => {})
      .then(() => {
        if (fade <= 0) {
          campPlayer.stopImmediate();
          return;
        }
        return campPlayer.fadeOut(fade);
      });
    return campSwitchChain;
  }

  function setCampVolume(v) {
    campVolume = v / 100;
    campPlayer.setVolume(campVolume);
  }

  // ─── Focus：轻量生成床 + 可选雨采样层 ───
  const focus = {
    bus: null,
    rainPlayer: null,
    layers: { lofi: 0, rain: 0, wiper: 0 },
    timers: [],
    nodes: [],
  };

  function noiseBuffer(type = 'pink', seconds = 4) {
    const c = ensureCtx();
    const buf = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        if (type === 'white') {
          d[i] = w * 0.28;
        } else {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        }
      }
    }
    return buf;
  }

  function buildFocusCore() {
    ensureCtx();
    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(master);
    focus.bus = bus;
    focus.nodes = [];
    focus.timers = [];

    const chord = [130.81, 164.81, 196, 246.94];
    chord.forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = 0.01 - i * 0.0015;
      osc.connect(g);
      g.connect(bus);
      osc.start();
      focus.nodes.push(osc);
    });

    const air = ctx.createBufferSource();
    air.buffer = noiseBuffer('pink', 4);
    air.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    focus.lofiBed = ctx.createGain();
    focus.lofiBed.gain.value = 0.04;
    air.connect(lp);
    lp.connect(focus.lofiBed);
    focus.lofiBed.connect(bus);
    air.start();
    focus.nodes.push(air);

    focus.wiperBed = ctx.createGain();
    focus.wiperBed.gain.value = 0;
    focus.wiperBed.connect(bus);
    const wiper = ctx.createBufferSource();
    wiper.buffer = noiseBuffer('white', 2);
    wiper.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 1600;
    wf.Q.value = 2.5;
    wiper.connect(wf);
    wf.connect(focus.wiperBed);
    wiper.start();
    focus.nodes.push(wiper);

    function swipe() {
      if (!focus.bus) return;
      const t = ctx.currentTime;
      const base = focus.wiperBed.gain.value;
      if (base > 0.001) {
        focus.wiperBed.gain.cancelScheduledValues(t);
        focus.wiperBed.gain.setValueAtTime(base * 0.2, t);
        focus.wiperBed.gain.linearRampToValueAtTime(base, t + 0.12);
        focus.wiperBed.gain.linearRampToValueAtTime(base * 0.2, t + 0.45);
      }
      focus.timers.push(setTimeout(swipe, 1100 + Math.random() * 400));
    }
    swipe();
  }

  function startFocusMix(volumes) {
    ensureCtx();
    if (!focus.bus) buildFocusCore();
    const t = ctx.currentTime;
    focus.bus.gain.cancelScheduledValues(t);
    focus.bus.gain.setValueAtTime(focus.bus.gain.value, t);
    focus.bus.gain.linearRampToValueAtTime(1, t + FADE_IN_SEC);
    applyFocusVolumes(volumes || focus.layers);
  }

  async function applyFocusVolumes({ lofi = 70, rain = 0, wiper = 0 } = {}) {
    focus.layers = { lofi, rain, wiper };
    if (!focus.bus) return;
    const t = ctx.currentTime;
    focus.lofiBed?.gain.setTargetAtTime(lofi / 100 * 0.055, t, 0.2);
    focus.wiperBed?.gain.setTargetAtTime(wiper / 100 * 0.045, t, 0.2);

    const rainVol = rain / 100 * 0.55;
    if (rainVol > 0.01) {
      if (!focus.rainPlayer) focus.rainPlayer = new CrossfadeSamplePlayer();
      if (!focus.rainPlayer.active) {
        try {
          await focus.rainPlayer.start('rain', rainVol, { fadeIn: FADE_IN_SEC });
        } catch (err) {
          console.warn('[Audio] focus rain failed', err);
        }
      } else {
        focus.rainPlayer.setVolume(rainVol);
      }
    } else if (focus.rainPlayer?.active) {
      focus.rainPlayer.fadeOut(FADE_OUT_SEC);
    }
  }

  function stopFocusMix() {
    if (!focus.bus || !ctx) {
      focus.rainPlayer?.stopImmediate();
      focus.rainPlayer = null;
      return;
    }
    const t = ctx.currentTime;
    focus.bus.gain.cancelScheduledValues(t);
    focus.bus.gain.setValueAtTime(focus.bus.gain.value, t);
    focus.bus.gain.linearRampToValueAtTime(0, t + FADE_OUT_SEC);
    focus.rainPlayer?.fadeOut(FADE_OUT_SEC);

    setTimeout(() => {
      focus.timers.forEach(clearTimeout);
      focus.timers = [];
      focus.nodes.forEach((n) => {
        try { n.stop?.(); } catch {}
        try { n.disconnect?.(); } catch {}
      });
      focus.nodes = [];
      try { focus.bus?.disconnect(); } catch {}
      focus.bus = null;
      focus.lofiBed = null;
      focus.wiperBed = null;
      focus.rainPlayer?.stopImmediate();
      focus.rainPlayer = null;
    }, FADE_OUT_SEC * 1000 + 80);
  }

  // ─── 过渡音效 ───
  function playBirdChorus() {
    const c = ensureCtx();
    const t = c.currentTime;
    const birds = [
      { f: 2800, t: 0, dur: 0.12 },
      { f: 3200, t: 0.35, dur: 0.1 },
      { f: 2400, t: 0.7, dur: 0.14 },
      { f: 3600, t: 1.1, dur: 0.08 },
      { f: 2900, t: 1.6, dur: 0.11 },
    ];
    birds.forEach((b) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(b.f, t + b.t);
      osc.frequency.exponentialRampToValueAtTime(b.f * 0.85, t + b.t + b.dur);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t + b.t);
      g.gain.linearRampToValueAtTime(0.045, t + b.t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + b.t + b.dur);
      osc.connect(g);
      g.connect(master);
      osc.start(t + b.t);
      osc.stop(t + b.t + b.dur + 0.05);
    });
  }

  function playVinylCrackle() {
    const c = ensureCtx();
    const t = c.currentTime;
    [261.63, 329.63, 392].forEach((f, i) => {
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035 / (i + 1), t + 0.15);
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
      g.gain.linearRampToValueAtTime(0.08 / (i + 1), t + 0.08);
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

  function stopAll({ fade = FADE_OUT_SEC } = {}) {
    stopNapAudio({ fade });
    stopCampAudio({ fade });
    stopFocusMix();
  }

  /** 预加载全部采样，减少首次播放等待 */
  function preloadAllSamples() {
    ensureCtx();
    return Promise.all(
      Object.values(SAMPLE_PRESETS).map((p) => loadBuffer(p.url).catch((e) => {
        console.warn('[Audio] preload failed', p.url, e);
      })),
    );
  }

  return {
    resume,
    SAMPLE_PRESETS,
    NAP_SOUNDSCAPES,
    preloadAllSamples,
    startNapAudio,
    stopNapAudio,
    fadeOutNapAudio,
    setNapVolume,
    setBreathPhase,
    startCampAudio,
    stopCampAudio,
    setCampVolume,
    startFocusMix,
    stopFocusMix,
    applyFocusVolumes,
    playVinylCrackle,
    playSingingBowl,
    playBirdChorus,
    stopAll,
  };
})();
