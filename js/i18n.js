/**
 * AeroCabin · lightweight i18n (en / zh / fr)
 * Default: en for NA/EU; zh when browser is Chinese; manual override persists.
 */
const I18n = (() => {
  const STORAGE_KEY = 'aetheris-lang';
  const LOCALES = ['en', 'zh', 'fr'];

  const MESSAGES = {
    en: {
      appTitle: 'AeroCabin',
      homeBrand: 'AeroCabin',
      homeTagline: 'A relaxation space made for your Tesla.',
      homeScenesTitle: 'What do you need right now?',
      sceneNap: 'I want to rest',
      sceneNapDesc: 'Nap · Relax · Breathe',
      sceneCamp: "I'm camping",
      sceneCampDesc: 'Stars · Landscapes · Sky',
      sceneFocus: "I'm charging",
      sceneFocusDesc: 'Timer · Soundscapes · ASMR',
      footerPrivacy: 'Privacy',
      footerTerms: 'Terms',
      footerContact: 'Contact',
      homeFooterTagline: 'Made for Tesla owners.',
      langGroup: 'Language',

      back: 'Back',
      play: 'Play',
      soundscapes: 'Soundscapes',
      theaterYt: 'Immersive Mode',
      theaterCn: 'Immersive Mode',
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
      asmrMixer: 'Create your own cabin soundscape',
      oasisFaders: 'Nature faders',
      oasisHint: 'Slide faders · build your soundscape',
      oasisEnergy0: 'Stellar stillness',
      oasisEnergy1: 'Soft starlight',
      oasisEnergy2: 'Flowing galaxy',
      oasisEnergy3: 'Cosmic bloom',
      oasisLayer: '{name} · {val}%',
      oasisVeil: 'Create your own cabin soundscape · Pro unlock',

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

      proEyebrow: 'AeroCabin Pro',
      proShortcut: '✨ Pro',
      proTitle: 'AeroCabin Pro',
      proCopy: 'Unlock more immersive in-cabin experiences.',
      proPerk1: 'More sleep & meditation scenes',
      proPerk2: 'Stars & camping themes',
      proPerk3: 'Custom ASMR mixing',
      proPerk4: 'Early access to new content',
      proEmailLabel: 'Email',
      proEmailPlaceholder: 'Enter email for launch updates',
      proNotify: 'Notify me',
      proSubmitting: 'Submitting…',
      proEmailRequired: 'Please enter your email address.',
      proEmailInvalid: 'Please enter a valid email address.',
      proSubmitFail: 'Something went wrong. Please try again.',
      proWaitlistSuccess: "You're on the list 🌙",
      proLater: 'Continue exploring',
      proFeature: 'Pro feature',
      proLocked: '{label} (Pro required)',

      bookmarkHint: 'Tap browser ★ (top-right) to bookmark',

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
      appTitle: 'AeroCabin',
      homeBrand: 'AeroCabin',
      homeTagline: '为 Tesla 打造的车内放松空间',
      homeScenesTitle: '你现在想做什么？',
      sceneNap: '我想休息',
      sceneNapDesc: '小睡 · 放松 · 呼吸',
      sceneCamp: '我在露营',
      sceneCampDesc: '星空 · 地形 · 天象',
      sceneFocus: '我在充电',
      sceneFocusDesc: '倒计时 · 白噪音 · ASMR',
      footerPrivacy: '隐私政策',
      footerTerms: '服务条款',
      footerContact: '联系',
      homeFooterTagline: '为 Tesla 车主而设计',
      langGroup: '语言',

      back: '返回',
      play: '播放',
      soundscapes: '声景选择',
      theaterYt: '沉浸模式',
      theaterCn: '沉浸模式',
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
      asmrMixer: '创建你的专属环境声音',
      oasisFaders: '自然环境推子',
      oasisHint: '轻推推子 · 叠出你的解压声场',
      oasisEnergy0: '星空静谧',
      oasisEnergy1: '星光缓息',
      oasisEnergy2: '星河流动',
      oasisEnergy3: '星野盛放',
      oasisLayer: '{name} · {val}%',
      oasisVeil: '创建你的专属环境声音 · Pro 解锁',

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

      proEyebrow: 'AeroCabin Pro',
      proShortcut: '✨ Pro',
      proTitle: 'AeroCabin Pro',
      proCopy: '解锁更多沉浸式车内体验',
      proPerk1: '更多睡眠与冥想场景',
      proPerk2: '星空与露营主题',
      proPerk3: '自定义 ASMR 混音',
      proPerk4: '优先体验新内容',
      proEmailLabel: '邮箱',
      proEmailPlaceholder: '输入邮箱，获取上线通知',
      proNotify: '通知我',
      proSubmitting: '提交中…',
      proEmailRequired: '请输入邮箱地址。',
      proEmailInvalid: '请输入有效的邮箱地址。',
      proSubmitFail: '提交失败，请稍后再试。',
      proWaitlistSuccess: '已加入等候名单 🌙',
      proLater: '继续体验',
      proFeature: 'Pro 功能',
      proLocked: '{label}（需 Pro 解锁）',

      bookmarkHint: '请点击浏览器右上角 ★ 收藏本站',

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
      appTitle: 'AeroCabin',
      homeBrand: 'AeroCabin',
      homeTagline: 'Un espace de détente pensé pour votre Tesla.',
      homeScenesTitle: 'De quoi avez-vous besoin maintenant ?',
      sceneNap: 'Je veux me reposer',
      sceneNapDesc: 'Sieste · Détente · Respiration',
      sceneCamp: 'Je suis en camping',
      sceneCampDesc: 'Étoiles · Paysages · Ciel',
      sceneFocus: 'Je suis en charge',
      sceneFocusDesc: 'Minuterie · Ambiances · ASMR',
      footerPrivacy: 'Confidentialité',
      footerTerms: 'Conditions',
      footerContact: 'Contact',
      homeFooterTagline: 'Conçu pour les propriétaires Tesla.',
      langGroup: 'Langue',

      back: 'Retour',
      play: 'Lecture',
      soundscapes: 'Ambiances',
      theaterYt: 'Mode immersif',
      theaterCn: 'Mode immersif',
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
      asmrMixer: 'Créez votre ambiance sonore de cabine',
      oasisFaders: 'Faders nature',
      oasisHint: 'Réglez les faders · composez votre ambiance',
      oasisEnergy0: 'Calme stellaire',
      oasisEnergy1: 'Lueur douce',
      oasisEnergy2: 'Galaxie fluide',
      oasisEnergy3: 'Cosmos vibrant',
      oasisLayer: '{name} · {val} %',
      oasisVeil: 'Ambiance sonore de cabine · Pro',

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

      proEyebrow: 'AeroCabin Pro',
      proShortcut: '✨ Pro',
      proTitle: 'AeroCabin Pro',
      proCopy: 'Débloquez plus d’expériences immersives en cabine.',
      proPerk1: 'Plus de scènes sommeil & méditation',
      proPerk2: 'Thèmes étoiles & camping',
      proPerk3: 'Mixage ASMR personnalisé',
      proPerk4: 'Accès anticipé aux nouveautés',
      proEmailLabel: 'E-mail',
      proEmailPlaceholder: 'E-mail pour être averti du lancement',
      proNotify: 'Me prévenir',
      proSubmitting: 'Envoi…',
      proEmailRequired: 'Veuillez saisir votre adresse e-mail.',
      proEmailInvalid: 'Veuillez saisir une adresse e-mail valide.',
      proSubmitFail: 'Une erreur est survenue. Réessayez.',
      proWaitlistSuccess: 'Vous êtes inscrit(e) 🌙',
      proLater: 'Continuer l’expérience',
      proFeature: 'Fonction Pro',
      proLocked: '{label} (Pro requis)',

      bookmarkHint: 'Appuyez sur ★ du navigateur pour favori',

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
