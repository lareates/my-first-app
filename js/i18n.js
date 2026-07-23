/**
 * Aetheris · lightweight i18n (en / zh / fr)
 * Default: en for NA/EU; zh when browser is Chinese; manual override persists.
 */
const I18n = (() => {
  const STORAGE_KEY = 'aetheris-lang';
  const LOCALES = ['en', 'zh', 'fr'];

  const MESSAGES = {
    en: {
      appTitle: 'Aetheris · Cabin Space',
      homeEyebrow: 'Aetheris · Cabin Space',
      homeTitle: 'Choose your<br>moment',
      sceneNap: 'In-car Nap',
      sceneNapDesc: 'Sleep · Meditate · Breathe',
      sceneCamp: 'Outdoor Camp',
      sceneCampDesc: 'Stars · Terrain · Sky',
      sceneFocus: 'Charge & Wait',
      sceneFocusDesc: 'Relief Timer · ASMR Mixer',
      langGroup: 'Language',

      back: 'Back',
      play: 'Play',
      soundscapes: 'Soundscapes',
      theaterYt: '🚀 YT Fullscreen',
      theaterCn: '🚀 Tencent Fullscreen',
      swapBg: 'Change background',
      setDuration: 'Set session duration',
      setCountdown: 'Set countdown duration',
      activeSession: 'Active Session',

      napModeMeditate: 'Meditate',
      napModeSleep: 'Sleep',
      napModeBreathe: 'Breathe',

      soundscape: {
        woven: 'Ambient Woven',
        rain: 'Rain on Roof',
        stream: 'Stream',
        waves: 'Coastal Waves',
        wind: 'Window Breeze',
        fireplace: 'Fireplace',
        birds: 'Forest Birds',
        meditation1: 'Soul Repair',
        meditation2: 'Starry Wind',
        soundbath: 'Hi-Fi Therapy',
        tibetan: 'Singing Bowls',
      },

      oasis: {
        rain: 'Rain',
        stream: 'Stream',
        waves: 'Waves',
        wind: 'Wind',
        fireplace: 'Fireplace',
        birds: 'Birds',
        meditation1: 'Soul',
        meditation2: 'Starwind',
        soundbath: 'Bath',
        tibetan: 'Bowls',
      },

      durationHour: '1 hour',
      durationMin: '{n} min',
      timerPickTitle: 'Select duration',
      timerPickSub: 'Default 10 min · adjust anytime',
      timerCountdown: 'Countdown',
      timerStopwatch: 'Stopwatch',
      timerPomodoro: 'Pomodoro',
      reliefTimer: 'Relief Timer',
      asmrMixer: 'ASMR Mixer',
      oasisFaders: 'Nature faders',
      oasisHint: 'Slide faders · build your soundscape',
      oasisEnergy0: 'Stellar stillness',
      oasisEnergy1: 'Soft starlight',
      oasisEnergy2: 'Flowing galaxy',
      oasisEnergy3: 'Cosmic bloom',
      oasisLayer: '{name} · {val}%',
      oasisVeil: 'ASMR Mixer · Pro unlock',

      breathIn: 'Inhale',
      breathOut: 'Exhale',
      gentleWakeHint: 'Gentle wake · dawn rising',
      gentleWakeTitle: 'GENTLE WAKE',

      focusIdle: 'Standby',
      focusActive: 'Focusing',
      focusBreak: 'Break',
      focusSession: 'Session {n} · {mins} min today',
      timerStart: 'Start',
      timerPause: 'Pause',
      timerReset: 'Reset',
      breakHint: '☕ 5 min break · keep the mix playing',

      campBadge: '⛺ Camp Mode',
      campModeStars: 'Stars',
      campModeTerrain: 'Terrain',
      campModeOrient: 'Sky',
      campStatAlt: 'Altitude',
      campStatLat: 'Latitude',
      campStatLng: 'Longitude',
      campStatAcc: 'Accuracy',
      campTerrainHint: 'Switch to Terrain for location',
      campPerseids: '☄️ Perseid meteor shower',
      campSysActive: '[ SYSTEM ACTIVE ]',

      proEyebrow: 'AETHERIS PRO',
      proTitle: 'Unlock Pro',
      proCopy: '✨ Unlock Aetheris Pro ($4.99) — Enable “{feature}” plus premium soundscapes, long sessions, theater fullscreen & ASMR mixer.',
      proPerk1: 'Premium soundscapes & therapy samples',
      proPerk2: 'Sessions 20 min and longer',
      proPerk3: 'Theater fullscreen · ASMR mixer',
      proPreview: 'Preview unlock (dev)',
      proBuy: 'Buy with Lemon Squeezy · $4.99',
      proLater: 'Maybe later',
      proNote: 'Tap Preview to try first; production will use Lemon Squeezy only.',
      proFeature: 'Pro feature',
      proLocked: '{label} (Pro required)',

      bgPickTitle: 'Choose background',
      bgPickSub: 'Ambient or photo scenes',
      napBgTitle: 'Scene background',
      napBgSub: 'Independent of mode',
      napBgDefault: 'Ambient light',
      napBgDefaultDesc: 'Breathe · Meditate · Sleep',
      napBgGarden: 'Garden dawn',
      napBgGardenDesc: 'Lavender & distant hills',
      napBgCoastal: 'Coastal breeze',
      napBgCoastalDesc: 'Reefs & shallow sea',
      napBgDream: 'Dream fields',
      napBgDreamDesc: 'Floating light & teal lake',
    },
    zh: {
      appTitle: 'Aetheris · 随行空间',
      homeEyebrow: 'Aetheris · 随行空间',
      homeTitle: '选择你的<br>此刻场景',
      sceneNap: '车内打盹',
      sceneNapDesc: '睡眠 · 冥想 · 呼吸',
      sceneCamp: '户外露营',
      sceneCampDesc: '星空 · 地形 · 天象',
      sceneFocus: '充电等人',
      sceneFocusDesc: '解压时钟 · ASMR 调音台',
      langGroup: '语言',

      back: '返回',
      play: '播放',
      soundscapes: '声景选择',
      theaterYt: '🚀 YT 全屏',
      theaterCn: '🚀 腾讯全屏',
      swapBg: '切换背景',
      setDuration: '设置会话时长',
      setCountdown: '设置倒计时时长',
      activeSession: 'Active Session',

      napModeMeditate: '冥想',
      napModeSleep: '睡眠',
      napModeBreathe: '呼吸',

      soundscape: {
        woven: '氛围织境',
        rain: '春雨车顶',
        stream: '溪水潺潺',
        waves: '潮汐海滨',
        wind: '窗外微风',
        fireplace: '壁炉暖火',
        birds: '深林鸟鸣',
        meditation1: '心灵修复',
        meditation2: '星空风吟',
        soundbath: '高保真音疗',
        tibetan: '颂钵音疗',
      },

      oasis: {
        rain: '雨声',
        stream: '溪流',
        waves: '海浪',
        wind: '风声',
        fireplace: '壁炉',
        birds: '鸟鸣',
        meditation1: '心灵',
        meditation2: '星风',
        soundbath: '音疗',
        tibetan: '颂钵',
      },

      durationHour: '1 小时',
      durationMin: '{n} 分钟',
      timerPickTitle: '选择时长',
      timerPickSub: '默认 10 分钟，可随时调整',
      timerCountdown: '倒计时',
      timerStopwatch: '秒表',
      timerPomodoro: '番茄',
      reliefTimer: '解压时钟',
      asmrMixer: 'ASMR 调音台',
      oasisFaders: '自然环境推子',
      oasisHint: '轻推推子 · 叠出你的解压声场',
      oasisEnergy0: '星空静谧',
      oasisEnergy1: '星光缓息',
      oasisEnergy2: '星河流动',
      oasisEnergy3: '星野盛放',
      oasisLayer: '{name} · {val}%',
      oasisVeil: 'ASMR 调音台 · Pro 解锁',

      breathIn: '吸气',
      breathOut: '呼气',
      gentleWakeHint: '温和唤醒 · 晨光渐起',
      gentleWakeTitle: 'GENTLE WAKE',

      focusIdle: '待命中',
      focusActive: '专注中',
      focusBreak: '休息中',
      focusSession: '会话 {n} · 今日 {mins} 分钟',
      timerStart: '开始',
      timerPause: '暂停',
      timerReset: '重置',
      breakHint: '☕ 休息 5 分钟 · 推子可继续轻放',

      campBadge: '⛺ 露营模式',
      campModeStars: '星空',
      campModeTerrain: '地形',
      campModeOrient: '天象',
      campStatAlt: '海拔',
      campStatLat: '纬度',
      campStatLng: '经度',
      campStatAcc: '精度',
      campTerrainHint: '切换到「地形」查看位置',
      campPerseids: '☄️ 英仙座流星雨',
      campSysActive: '[ SYSTEM ACTIVE ]',

      proEyebrow: 'AETHERIS PRO',
      proTitle: '解锁 Pro 体验',
      proCopy: '✨ Unlock Aetheris Pro ($4.99) — 开启「{feature}」及更多疗愈声景、长时倒计时、剧院全屏与 ASMR 调音台。',
      proPerk1: '进阶声景与音疗采样',
      proPerk2: '20 分钟及以上专注时长',
      proPerk3: '剧院全屏 · ASMR 调音台',
      proPreview: '立即预览解锁（开发）',
      proBuy: 'Buy with Lemon Squeezy · $4.99',
      proLater: 'Maybe later',
      proNote: '点「立即预览」可先试用；正式上线后改为仅 Lemon Squeezy 购买。',
      proFeature: 'Pro 功能',
      proLocked: '{label}（需 Pro 解锁）',

      bgPickTitle: '选择背景',
      bgPickSub: '程序化氛围或照片场景',
      napBgTitle: '场景背景',
      napBgSub: '与模式无关，可独立切换',
      napBgDefault: '光景氛围',
      napBgDefaultDesc: '呼吸 · 冥想 · 睡眠',
      napBgGarden: '庭院晨光',
      napBgGardenDesc: '薰衣草与远山',
      napBgCoastal: '海岸微风',
      napBgCoastalDesc: '礁石与浅蓝海面',
      napBgDream: '梦境原野',
      napBgDreamDesc: '浮光与青绿湖泊',
    },
    fr: {
      appTitle: 'Aetheris · Espace Cabine',
      homeEyebrow: 'Aetheris · Espace Cabine',
      homeTitle: 'Choisissez votre<br>moment',
      sceneNap: 'Sieste en voiture',
      sceneNapDesc: 'Sommeil · Méditation · Respiration',
      sceneCamp: 'Camping',
      sceneCampDesc: 'Étoiles · Terrain · Ciel',
      sceneFocus: 'Charge & Attente',
      sceneFocusDesc: 'Minuterie · Console ASMR',
      langGroup: 'Langue',

      back: 'Retour',
      play: 'Lecture',
      soundscapes: 'Ambiances',
      theaterYt: '🚀 YT Plein écran',
      theaterCn: '🚀 Tencent Plein écran',
      swapBg: 'Changer le fond',
      setDuration: 'Durée de session',
      setCountdown: 'Durée du compte à rebours',
      activeSession: 'Session active',

      napModeMeditate: 'Méditer',
      napModeSleep: 'Sommeil',
      napModeBreathe: 'Respirer',

      soundscape: {
        woven: 'Ambiance tissée',
        rain: 'Pluie sur le toit',
        stream: 'Ruisseau',
        waves: 'Vagues côtières',
        wind: 'Brise à la fenêtre',
        fireplace: 'Cheminée',
        birds: 'Oiseaux forestiers',
        meditation1: 'Réparation intérieure',
        meditation2: 'Vent étoilé',
        soundbath: 'Thérapie Hi-Fi',
        tibetan: 'Bols tibétains',
      },

      oasis: {
        rain: 'Pluie',
        stream: 'Ruisseau',
        waves: 'Vagues',
        wind: 'Vent',
        fireplace: 'Feu',
        birds: 'Oiseaux',
        meditation1: 'Âme',
        meditation2: 'Vent',
        soundbath: 'Bain',
        tibetan: 'Bols',
      },

      durationHour: '1 heure',
      durationMin: '{n} min',
      timerPickTitle: 'Choisir la durée',
      timerPickSub: '10 min par défaut · ajustable',
      timerCountdown: 'Compte à rebours',
      timerStopwatch: 'Chronomètre',
      timerPomodoro: 'Pomodoro',
      reliefTimer: 'Minuterie détente',
      asmrMixer: 'Console ASMR',
      oasisFaders: 'Faders nature',
      oasisHint: 'Réglez les faders · composez votre ambiance',
      oasisEnergy0: 'Calme stellaire',
      oasisEnergy1: 'Lueur douce',
      oasisEnergy2: 'Galaxie fluide',
      oasisEnergy3: 'Cosmos vibrant',
      oasisLayer: '{name} · {val} %',
      oasisVeil: 'Console ASMR · Pro',

      breathIn: 'Inspirer',
      breathOut: 'Expirer',
      gentleWakeHint: 'Réveil doux · aube naissante',
      gentleWakeTitle: 'RÉVEIL DOUX',

      focusIdle: 'En attente',
      focusActive: 'Concentration',
      focusBreak: 'Pause',
      focusSession: 'Session {n} · {mins} min aujourd’hui',
      timerStart: 'Démarrer',
      timerPause: 'Pause',
      timerReset: 'Réinitialiser',
      breakHint: '☕ Pause 5 min · le mix continue',

      campBadge: '⛺ Mode camp',
      campModeStars: 'Étoiles',
      campModeTerrain: 'Terrain',
      campModeOrient: 'Ciel',
      campStatAlt: 'Altitude',
      campStatLat: 'Latitude',
      campStatLng: 'Longitude',
      campStatAcc: 'Précision',
      campTerrainHint: 'Passez en Terrain pour la position',
      campPerseids: '☄️ Pluie de Perseides',
      campSysActive: '[ SYSTÈME ACTIF ]',

      proEyebrow: 'AETHERIS PRO',
      proTitle: 'Débloquer Pro',
      proCopy: '✨ Aetheris Pro (4,99 $) — Activez « {feature} » plus ambiances premium, longues sessions, plein écran & console ASMR.',
      proPerk1: 'Ambiances & thérapies premium',
      proPerk2: 'Sessions de 20 min et plus',
      proPerk3: 'Plein écran · Console ASMR',
      proPreview: 'Aperçu (dev)',
      proBuy: 'Acheter via Lemon Squeezy · 4,99 $',
      proLater: 'Plus tard',
      proNote: 'Aperçu pour essai ; achat via Lemon Squeezy en production.',
      proFeature: 'Fonction Pro',
      proLocked: '{label} (Pro requis)',

      bgPickTitle: 'Choisir le fond',
      bgPickSub: 'Ambiance ou photo',
      napBgTitle: 'Fond de scène',
      napBgSub: 'Indépendant du mode',
      napBgDefault: 'Lumière ambiante',
      napBgDefaultDesc: 'Respirer · Méditer · Dormir',
      napBgGarden: 'Aube du jardin',
      napBgGardenDesc: 'Lavande & collines',
      napBgCoastal: 'Brise côtière',
      napBgCoastalDesc: 'Récifs & mer',
      napBgDream: 'Champs oniriques',
      napBgDreamDesc: 'Lumière & lac vert',
    },
  };

  let locale = 'en';
  const listeners = new Set();

  function detectLocale() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && LOCALES.includes(stored)) return stored;
      const q = new URLSearchParams(location.search).get('lang');
      if (q && LOCALES.includes(q)) return q;
    } catch { /* ignore */ }
    const nav = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    if (nav.startsWith('zh')) return 'zh';
    if (nav.startsWith('fr')) return 'fr';
    return 'en';
  }

  function localeTag(loc = locale) {
    if (loc === 'zh') return 'zh-CN';
    if (loc === 'fr') return 'fr-FR';
    return 'en-US';
  }

  function get(obj, path) {
    return path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : null), obj);
  }

  function interpolate(str, params = {}) {
    if (!str || !params) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? params[k] : `{${k}}`));
  }

  function t(key, params) {
    const msg = get(MESSAGES[locale], key) ?? get(MESSAGES.en, key) ?? key;
    return interpolate(msg, params);
  }

  function durationMin(min) {
    const n = Number(min);
    if (n === 60) return t('durationHour');
    return t('durationMin', { n });
  }

  function soundscape(id) {
    return t(`soundscape.${id}`) || id;
  }

  function oasis(id) {
    return t(`oasis.${id}`) || id;
  }

  function applyDom(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = t(key);
    });
    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (!key) return;
      el.innerHTML = t(key);
    });
    root.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria');
      if (!key) return;
      el.setAttribute('aria-label', t(key));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      el.setAttribute('placeholder', t(key));
    });
    root.querySelectorAll('.lang-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === locale);
      btn.setAttribute('aria-pressed', btn.dataset.lang === locale ? 'true' : 'false');
    });
    document.title = t('appTitle');
    document.documentElement.lang = localeTag();
  }

  function setLocale(next) {
    if (!LOCALES.includes(next) || next === locale) return locale;
    locale = next;
    try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* ignore */ }
    applyDom();
    listeners.forEach((fn) => {
      try { fn(locale); } catch (e) { console.warn('[I18n] listener', e); }
    });
    return locale;
  }

  function onChange(fn) {
    if (typeof fn === 'function') listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function init() {
    locale = detectLocale();
    applyDom();
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-lang]');
      if (!btn || !btn.dataset.lang) return;
      e.preventDefault();
      setLocale(btn.dataset.lang);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function napBgCopy(id) {
    const map = {
      default: ['napBgDefault', 'napBgDefaultDesc'],
      garden: ['napBgGarden', 'napBgGardenDesc'],
      coastal: ['napBgCoastal', 'napBgCoastalDesc'],
      dream: ['napBgDream', 'napBgDreamDesc'],
    };
    const keys = map[id];
    if (!keys) return { label: id, desc: '' };
    return { label: t(keys[0]), desc: t(keys[1]) };
  }

  return {
    LOCALES,
    t,
    durationMin,
    soundscape,
    oasis,
    napBgCopy,
    get locale() { return locale; },
    localeTag,
    setLocale,
    applyDom,
    onChange,
    init,
  };
})();

/** @deprecated use I18n.durationMin */
function durationLabel(min) {
  return I18n.durationMin(min);
}
