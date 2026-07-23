/**
 * Aetheris Audio Engine
 * 真实采样 + Web Audio 无缝交叉淡化 / 座舱低通 / 立体声漂移
 */
const AudioEngine = (() => {
  const CROSSFADE_SEC = 3.0;
  const FADE_OUT_SEC = 2.5;
  const FADE_IN_SEC = 2.0;
  const LOOKAHEAD_SEC = 30.0; // 提前调度 30 秒，防止车机后台节流
  const SCHEDULER_MS = 1000;

  /** 21 款特斯拉等低性能车机：流媒体循环，避免 decodeAudioData 爆内存 */
  function isLowPowerDevice() {
    try {
      const flag = localStorage.getItem('aetheris-low-power');
      if (flag === '1') return true;
      if (flag === '0') return false;
    } catch { /* ignore */ }
    const ua = navigator.userAgent || '';
    if (/Tesla|QtCarBrowser|QtWebEngine/i.test(ua)) return true;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return true;
    if (navigator.deviceMemory && navigator.deviceMemory <= 4) return true;
    return false;
  }

  const LOW_POWER = isLowPowerDevice();
  const ACTIVE_LOOKAHEAD_SEC = LOW_POWER ? 8 : LOOKAHEAD_SEC;
  const ACTIVE_SCHEDULER_MS = LOW_POWER ? 2000 : SCHEDULER_MS;
  const MAX_BUFFER_CACHE = LOW_POWER ? 2 : 8;
  const DECODE_TIMEOUT_MS = LOW_POWER ? 12000 : 8000;
  const FETCH_TIMEOUT_MS = LOW_POWER ? 20000 : 15000;

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
      gain: 1.0,
      label: 'rain',
    },
    stream: {
      url: 'assets/audio/river.mp3',
      lowpass: 800,
      panDrift: false,
      gain: 1.85,
      label: 'river',
    },
    waves: {
      url: 'assets/audio/waves.mp3',
      lowpass: 550,
      panDrift: true,
      gain: 1.85,
      label: 'waves',
    },
    wind: {
      url: 'assets/audio/wind.mp3',
      lowpass: 400,
      panDrift: true,
      gain: 0.71,
      label: 'wind',
    },
    fireplace: {
      url: 'assets/audio/fireplace.mp3',
      lowpass: 1400,
      panDrift: false,
      gain: 1.17,
      label: 'fireplace',
    },
    birds: {
      url: 'assets/audio/birds.m4a',
      lowpass: 1500,
      panDrift: true,
      gain: 1.85,
      label: 'birds',
    },
    meditation1: {
      url: 'assets/audio/meditation1.m4a',
      lowpass: 900,
      panDrift: true,
      gain: 1.02,
      label: 'meditation1',
    },
    meditation2: {
      url: 'assets/audio/meditation2.m4a',
      lowpass: 700,
      panDrift: true,
      gain: 0.55,
      label: 'meditation2',
    },
    soundbath: {
      url: 'assets/audio/soundbath.m4a',
      lowpass: 1000,
      panDrift: true,
      gain: 0.78,
      label: 'soundbath',
    },
    tibetan: {
      url: 'assets/audio/tibetan.m4a',
      lowpass: 800,
      panDrift: true,
      gain: 0.76,
      label: 'tibetan',
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

  function evictBufferCache() {
    while (bufferCache.size > MAX_BUFFER_CACHE) {
      const oldest = bufferCache.keys().next().value;
      bufferCache.delete(oldest);
    }
  }

  async function loadBuffer(url) {
    ensureCtx();
    if (bufferCache.has(url)) return bufferCache.get(url);
    if (bufferLoading.has(url)) return bufferLoading.get(url);

    const promise = (async () => {
      const controller = new AbortController();
      const fetchTimer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(fetchTimer));
      if (!res.ok) throw new Error(`[Audio] failed to load ${url}: ${res.status}`);
      const raw = await res.arrayBuffer();
      const copy = raw.slice(0);

      const buf = await new Promise((resolve, reject) => {
        let isDone = false;
        const timer = setTimeout(() => {
          if (!isDone) {
            isDone = true;
            reject(new Error(`[Audio] decodeAudioData timeout for ${url}`));
          }
        }, DECODE_TIMEOUT_MS);

        try {
          const p = ctx.decodeAudioData(
            copy,
            (decoded) => {
              if (isDone) return;
              isDone = true;
              clearTimeout(timer);
              resolve(decoded);
            },
            (err) => {
              if (isDone) return;
              isDone = true;
              clearTimeout(timer);
              reject(err);
            }
          );
          if (p && typeof p.catch === 'function') {
            p.catch((err) => {
              if (isDone) return;
              isDone = true;
              clearTimeout(timer);
              reject(err);
            });
          }
        } catch (err) {
          if (isDone) return;
          isDone = true;
          clearTimeout(timer);
          reject(err);
        }
      });

      if (!buf) throw new Error(`[Audio] decoded buffer is null for ${url}`);

      bufferCache.set(url, buf);
      evictBufferCache();
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
      this.buffer = null;
      this.active = false;
      this.generation = 0;
      this.nextStart = 0;
      this.schedulerId = null;
      this.panLfo = null;
      this.userVolume = 1;
      this.presetGain = 1;
      this.fadeToken = 0;
      this.stopTimer = null;
      this.scheduledNodes = new Set();
    }

    _effectiveVolume() {
      // 允许轻度 >1，用于抬升偏安静的采样；上限避免削波
      return Math.max(0, Math.min(1.85, this.userVolume * (this.presetGain || 1)));
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

      this.filter.connect(this.pan);
      this.pan.connect(this.bus);
      this.bus.connect(master);
      this.pan.connect(this.wet);
      this.wet.connect(reverb);
    }

    _teardownGraph() {
      this._stopPanLfo();
      this.scheduledNodes.forEach((node) => {
        try { node.src?.stop(); } catch {}
        try { node.src?.disconnect(); } catch {}
        try { node.gain?.disconnect(); } catch {}
      });
      this.scheduledNodes.clear();

      try { this.filter?.disconnect(); } catch {}
      try { this.pan?.disconnect(); } catch {}
      try { this.wet?.disconnect(); } catch {}
      try { this.bus?.disconnect(); } catch {}
      this.filter = null;
      this.pan = null;
      this.wet = null;
      this.bus = null;
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

    _spawnVoice(when, fadeInSec) {
      if (!this.buffer || !this.active) return;

      const gainNode = ctx.createGain();
      gainNode.connect(this.filter);

      const src = ctx.createBufferSource();
      src.buffer = this.buffer;
      // 严禁 src.loop = true
      src.connect(gainNode);

      // 扣除 0.15 秒，避免 MP3 尾部空白帧导致音量骤降
      const dur = Math.max(1, this.buffer.duration - 0.15);
      const xf = Math.min(CROSSFADE_SEC, Math.max(0.5, dur * 0.35));
      const g = gainNode.gain;
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
      src.stop(t0 + dur + 0.1);

      const nodeObj = { src, gain: gainNode };
      this.scheduledNodes.add(nodeObj);

      // 播放结束后自动清理节点
      src.onended = () => {
        this.scheduledNodes.delete(nodeObj);
        try { src.disconnect(); } catch {}
        try { gainNode.disconnect(); } catch {}
      };
    }

    _scheduleAhead(gen) {
      if (!this.active || gen !== this.generation || !this.buffer) return;

      const dur = Math.max(1, this.buffer.duration - 0.15);
      const xf = Math.min(CROSSFADE_SEC, Math.max(0.5, dur * 0.35));
      const horizon = ctx.currentTime + ACTIVE_LOOKAHEAD_SEC;

      while (this.nextStart < horizon) {
        const fadeIn = this.nextStart <= ctx.currentTime + 0.05 ? 0 : xf;
        this._spawnVoice(this.nextStart, fadeIn);
        this.nextStart += dur - xf;
      }

      this.schedulerId = setTimeout(() => this._scheduleAhead(gen), ACTIVE_SCHEDULER_MS);
    }

    async start(presetKey, volume = 1, { fadeIn = FADE_IN_SEC } = {}) {
      const preset = SAMPLE_PRESETS[presetKey];
      if (!preset) throw new Error(`[Audio] unknown preset ${presetKey}`);

      ensureCtx();
      if (ctx.state === 'suspended') {
        // 防止在非用户手势上下文中 await ctx.resume() 永久挂起
        await Promise.race([
          ctx.resume(),
          new Promise(r => setTimeout(r, 500))
        ]).catch(() => {});
      }

      this.stopImmediate();
      this._buildGraph();

      this.buffer = await loadBuffer(preset.url);
      this.filter.frequency.value = preset.lowpass;
      this.presetGain = typeof preset.gain === 'number' ? preset.gain : 1;
      this.userVolume = Math.max(0, Math.min(1, volume));
      this.active = true;
      this.generation += 1;
      const gen = this.generation;

      if (preset.panDrift) this._startPanDrift();
      else this.pan.pan.value = 0;

      const t = ctx.currentTime;
      this.bus.gain.cancelScheduledValues(t);
      this.bus.gain.setValueAtTime(0, t);
      this.bus.gain.linearRampToValueAtTime(this._effectiveVolume(), t + Math.max(0.05, fadeIn));

      this.nextStart = t;
      this._scheduleAhead(gen);
    }

    setVolume(volume) {
      this.userVolume = Math.max(0, Math.min(1, volume));
      if (!this.bus || !ctx) return;
      const t = ctx.currentTime;
      this.bus.gain.cancelScheduledValues(t);
      this.bus.gain.setTargetAtTime(this._effectiveVolume(), t, 0.12);
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

  /**
   * 车机轻量播放器：HTML5 Audio 循环 + MediaElementSource
   * 不整段 decode 到 PCM，避免阿童木浏览器 OOM / 崩溃
   */
  class MediaLoopPlayer {
    constructor() {
      this.el = null;
      this.source = null;
      this.filter = null;
      this.pan = null;
      this.bus = null;
      this.wet = null;
      this.active = false;
      this.presetGain = 1;
      this.userVolume = 1;
      this.fadeToken = 0;
      this.stopTimer = null;
      this.panLfo = null;
      this.presetKey = null;
    }

    _effectiveVolume() {
      return Math.max(0, Math.min(1.85, this.userVolume * (this.presetGain || 1)));
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
      this.wet.gain.value = LOW_POWER ? 0.1 : 0.18;
      this.filter.connect(this.pan);
      this.pan.connect(this.bus);
      this.bus.connect(master);
      this.pan.connect(this.wet);
      this.wet.connect(reverb);
    }

    _stopPanLfo() {
      if (this.panLfo) {
        try { this.panLfo.stop(); } catch {}
        try { this.panLfo.disconnect(); } catch {}
        this.panLfo = null;
      }
    }

    _startPanDrift() {
      if (LOW_POWER) return;
      this._stopPanLfo();
      const period = 15 + Math.random() * 5;
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

    _waitForMedia(el, timeoutMs = 15000) {
      return new Promise((resolve, reject) => {
        if (el.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
          resolve();
          return;
        }
        let done = false;
        const finish = (fn, arg) => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          el.removeEventListener('canplaythrough', onReady);
          el.removeEventListener('loadeddata', onReady);
          el.removeEventListener('error', onErr);
          fn(arg);
        };
        const onReady = () => finish(resolve);
        const onErr = () => finish(reject, new Error('[Audio] media load error'));
        const timer = setTimeout(() => finish(reject, new Error('[Audio] media load timeout')), timeoutMs);
        el.addEventListener('canplaythrough', onReady, { once: true });
        el.addEventListener('loadeddata', onReady, { once: true });
        el.addEventListener('error', onErr, { once: true });
      });
    }

    _teardownMedia() {
      this._stopPanLfo();
      if (this.el) {
        try { this.el.pause(); } catch {}
        try { this.el.removeAttribute('src'); this.el.load(); } catch {}
        this.el = null;
      }
      try { this.source?.disconnect(); } catch {}
      this.source = null;
      try { this.filter?.disconnect(); } catch {}
      try { this.pan?.disconnect(); } catch {}
      try { this.wet?.disconnect(); } catch {}
      try { this.bus?.disconnect(); } catch {}
      this.filter = null;
      this.pan = null;
      this.wet = null;
      this.bus = null;
    }

    async start(presetKey, volume = 1, { fadeIn = FADE_IN_SEC } = {}) {
      const preset = SAMPLE_PRESETS[presetKey];
      if (!preset) throw new Error(`[Audio] unknown preset ${presetKey}`);

      ensureCtx();
      if (ctx.state === 'suspended') {
        await Promise.race([
          ctx.resume(),
          new Promise((r) => setTimeout(r, 500)),
        ]).catch(() => {});
      }

      this.stopImmediate();
      this._buildGraph();
      this.presetKey = presetKey;
      this.presetGain = typeof preset.gain === 'number' ? preset.gain : 1;
      this.userVolume = Math.max(0, Math.min(1, volume));
      this.filter.frequency.value = preset.lowpass;

      const el = new Audio(preset.url);
      el.loop = true;
      el.preload = 'auto';
      el.playsInline = true;
      if (preset.panDrift) this._startPanDrift();
      else this.pan.pan.value = 0;

      await this._waitForMedia(el);
      this.el = el;
      this.source = ctx.createMediaElementSource(el);
      this.source.connect(this.filter);

      const t = ctx.currentTime;
      this.bus.gain.cancelScheduledValues(t);
      this.bus.gain.setValueAtTime(0, t);
      this.bus.gain.linearRampToValueAtTime(this._effectiveVolume(), t + Math.max(0.05, fadeIn));

      await el.play();
      this.active = true;
    }

    setVolume(volume) {
      this.userVolume = Math.max(0, Math.min(1, volume));
      if (!this.bus || !ctx) return;
      const t = ctx.currentTime;
      this.bus.gain.cancelScheduledValues(t);
      this.bus.gain.setTargetAtTime(this._effectiveVolume(), t, 0.12);
    }

    fadeOut(duration = FADE_OUT_SEC) {
      this.fadeToken += 1;
      const token = this.fadeToken;
      if (!this.bus || !ctx || !this.active) {
        this.stopImmediate();
        return Promise.resolve();
      }

      this.active = false;
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
      if (this.stopTimer) {
        clearTimeout(this.stopTimer);
        this.stopTimer = null;
      }
      this._teardownMedia();
      this.presetKey = null;
    }
  }

  function createSamplePlayer() {
    return LOW_POWER ? new MediaLoopPlayer() : new CrossfadeSamplePlayer();
  }

  // ─── Nap：氛围织境（生成式）+ 真实采样 ───
  const napPlayer = createSamplePlayer();
  let napPreset = 'woven';
  let napMode = 'meditate';
  let napVolume = 0.77;
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

  function startNapAudio(mode = 'meditate', volume = 77, soundscape = 'woven') {
    const sc = NAP_SOUNDSCAPES.includes(soundscape) ? soundscape : 'woven';
    napPreset = sc;
    napMode = mode;
    napVolume = volume / 100;

    // 立即在用户手势上下文中尝试唤醒 AudioContext，防止在 fadeOut 之后唤醒导致浏览器拦截或挂起
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

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
  const campPlayer = createSamplePlayer();
  let campVolume = 0.7;
  let campSwitchChain = Promise.resolve();

  function startCampAudio(mode = 'stars', volume = 70) {
    const key = CAMP_SAMPLE_MAP[mode] || 'wind';
    campVolume = volume / 100;

    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

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

  // ─── Focus / Oasis：五轨真实采样调音台 ───
  // 与 SAMPLE_PRESETS 同步：新增采样自动进入 Oasis 调音台
  const OASIS_KEYS = Object.keys(SAMPLE_PRESETS);
  const oasis = {
    layers: Object.fromEntries(OASIS_KEYS.map((k) => [k, 0])),
    players: Object.fromEntries(OASIS_KEYS.map((k) => [k, null])),
    active: false,
    lastTickAt: 0,
    onEnergy: null,
  };

  function oasisEnergy() {
    const sum = OASIS_KEYS.reduce((acc, k) => acc + (oasis.layers[k] || 0), 0);
    return Math.min(1, sum / OASIS_KEYS.length);
  }

  function notifyOasisEnergy() {
    const e = oasisEnergy();
    try { oasis.onEnergy?.(e); } catch {}
    try { Ambient?.setFocusEnergy?.(e); } catch {}
  }

  function playFaderClick() {
    ensureCtx();
    const now = performance.now();
    if (now - oasis.lastTickAt < 38) return;
    oasis.lastTickAt = now;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 2100 + Math.random() * 900;

    const noise = ctx.createBufferSource();
    const nBuf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.02)), ctx.sampleRate);
    const data = nBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    noise.buffer = nBuf;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2200;
    hp.Q.value = 0.7;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.028, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);

    osc.connect(hp);
    noise.connect(hp);
    hp.connect(g);
    g.connect(master);

    osc.start(t);
    noise.start(t);
    osc.stop(t + 0.04);
    noise.stop(t + 0.04);
  }

  const OASIS_MAX_LAYERS = LOW_POWER ? 3 : OASIS_KEYS.length;

  function oasisActiveLayerCount() {
    return OASIS_KEYS.filter((k) => {
      const v = oasis.layers[k] || 0;
      return v >= 0.008 && oasis.players[k]?.active;
    }).length;
  }

  async function ensureOasisPlayer(key) {
    if (!SAMPLE_PRESETS[key]) return null;
    if (!oasis.players[key]) oasis.players[key] = createSamplePlayer();
    const player = oasis.players[key];
    if (!player.active) {
      try {
        await player.start(key, Math.max(0.001, oasis.layers[key] || 0.001), { fadeIn: 0.8 });
      } catch (err) {
        console.warn('[Audio] oasis start failed', key, err);
        return null;
      }
    }
    return player;
  }

  async function setOasisLayer(key, value01, { tick = false } = {}) {
    if (!OASIS_KEYS.includes(key)) return;
    const v = Math.max(0, Math.min(1, value01));
    oasis.layers[key] = v;
    oasis.active = true;

    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (tick) playFaderClick();

    if (v < 0.008) {
      const p = oasis.players[key];
      if (p?.active) p.fadeOut(1.2);
    } else {
      const existing = oasis.players[key];
      if (LOW_POWER && !existing?.active && oasisActiveLayerCount() >= OASIS_MAX_LAYERS) {
        console.warn('[Audio] oasis layer limit reached on low-power device');
        oasis.layers[key] = 0;
        notifyOasisEnergy();
        return;
      }
      const p = await ensureOasisPlayer(key);
      p?.setVolume(v * 1.0);
    }

    notifyOasisEnergy();
  }

  function setOasisLayers(map = {}, { tick = false } = {}) {
    OASIS_KEYS.forEach((k) => {
      if (map[k] != null) setOasisLayer(k, map[k], { tick: false });
    });
    if (tick) playFaderClick();
    notifyOasisEnergy();
  }

  function stopOasis({ fade = FADE_OUT_SEC } = {}) {
    OASIS_KEYS.forEach((k) => {
      oasis.layers[k] = 0;
      const p = oasis.players[k];
      if (!p) return;
      if (fade <= 0) p.stopImmediate();
      else p.fadeOut(fade);
    });
    oasis.active = false;
    notifyOasisEnergy();
  }

  function onOasisEnergy(fn) {
    oasis.onEnergy = typeof fn === 'function' ? fn : null;
  }

  // 兼容旧 API 名（场景退出 / stopAll 仍调用）
  function startFocusMix() {
    oasis.active = true;
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function stopFocusMix() {
    stopOasis({ fade: FADE_OUT_SEC });
  }

  function applyFocusVolumes() {
    /* legacy no-op — Oasis 使用 setOasisLayer */
  }

  // ─── 过渡音效 ───
  function playBirdChorus() {
    const c = ensureCtx();
    const t = c.currentTime;
    const totalSec = 10;
    // 约 10 秒：多组短促 chirp，左右轻微偏移，疏密交替
    const phrases = [
      [2800, 3200, 2600],
      [3400, 2900],
      [2400, 3100, 3600],
      [2700, 3300],
      [3500, 2800, 3100],
      [2500, 3000],
      [3200, 2700, 3400],
      [2900, 3600],
      [3000, 2550],
      [3150, 3450, 2750],
    ];
    const slot = totalSec / phrases.length;
    phrases.forEach((phrase, pi) => {
      const phraseStart = 0.2 + pi * slot + (Math.random() * 0.2 - 0.05);
      phrase.forEach((f, i) => {
        const start = t + phraseStart + i * (0.15 + Math.random() * 0.07);
        if (start - t > totalSec) return;
        const dur = 0.09 + Math.random() * 0.07;
        const osc = c.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, start);
        osc.frequency.exponentialRampToValueAtTime(f * (0.82 + Math.random() * 0.08), start + dur);
        const g = c.createGain();
        const peak = 0.028 + Math.random() * 0.018;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.exponentialRampToValueAtTime(peak, start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
        const pan = c.createStereoPanner();
        pan.pan.value = (Math.random() * 2 - 1) * 0.55;
        osc.connect(g);
        g.connect(pan);
        pan.connect(master);
        osc.start(start);
        osc.stop(start + dur + 0.04);
      });
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

  /** 预加载采样；车机轻量模式跳过，避免同时 decode 多轨 */
  function preloadAllSamples() {
    if (LOW_POWER) return Promise.resolve();
    ensureCtx();
    const liteKeys = ['rain', 'stream', 'waves', 'wind', 'fireplace'];
    const urls = liteKeys.map((k) => SAMPLE_PRESETS[k].url);
    return Promise.all(
      urls.map((url) => loadBuffer(url).catch((e) => {
        console.warn('[Audio] preload failed', url, e);
      })),
    );
  }

  return {
    resume,
    isLowPowerDevice,
    LOW_POWER,
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
    setOasisLayer,
    setOasisLayers,
    stopOasis,
    playFaderClick,
    onOasisEnergy,
    oasisEnergy,
    OASIS_KEYS,
    playVinylCrackle,
    playSingingBowl,
    playBirdChorus,
    stopAll,
  };
})();
