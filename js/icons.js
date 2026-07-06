/** 内联 SVG 图标 — 不依赖 Google Fonts，适配特斯拉车机 */
const ICONS = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 6.5v11l9-5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6.5" y="5.5" width="4" height="13" rx="1.2"/><rect x="13.5" y="5.5" width="4" height="13" rx="1.2"/></svg>',
  volume: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10h3l4-4v12l-4-4H4z"/><path d="M15 9.5a3.5 3.5 0 010 5"/><path d="M17.5 7a7 7 0 010 10"/></svg>',
  meditate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.2"/><path d="M12 8.2v3.1"/><path d="M8 14.3l4-2.1 4 2.1"/><path d="M9.2 19l2.8-4.3 2.8 4.3"/><path d="M6.8 12.2h2.1M15.1 12.2h2.1"/></svg>',
  sleep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4.5A7.5 7.5 0 1019 17a6.8 6.8 0 01-4.5-12.5z"/><path d="M16.8 6.8h3.2M18.4 5.2v3.2"/></svg>',
  breathe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 12c1.9-3.7 4.4-5.5 7.5-5.5s5.6 1.8 7.5 5.5c-1.9 3.7-4.4 5.5-7.5 5.5S6.4 15.7 4.5 12z"/><circle cx="12" cy="12" r="2.2"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5l2.2 5 5.3.5-4 3.5 1.2 5.2L12 15l-4.7 2.7 1.2-5.2-4-3.5 5.3-.5z"/></svg>',
  terrain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 17.5l4.8-6.8 3.6 4.8 2.7-3.4 5.9 5.4"/><path d="M3.5 17.5h17"/><circle cx="17.6" cy="6.8" r="1.5"/></svg>',
  compass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M14.9 9.1l-1.8 5-5 1.8 1.8-5z"/><path d="M12 3.5v1.8"/></svg>',
  timer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3.5h6"/><path d="M12 8v4.2l2.8 1.8"/><circle cx="12" cy="13" r="7.5"/></svg>',
  headphones: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13.5v4a1.8 1.8 0 001.8 1.8H8.5V12H6.8A1.8 1.8 0 005 13.8z"/><path d="M19 13.5v4a1.8 1.8 0 01-1.8 1.8H15.5V12h1.7a1.8 1.8 0 011.8 1.8z"/><path d="M5 13a7 7 0 0114 0"/></svg>',
  notes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4.5h6l4 4v11H7z"/><path d="M13 4.5v4h4"/><path d="M10 12.5h4.5M10 16h4.5"/></svg>',
  wallpaper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="M7 14.5l2.5-2.5 2 2 3-3.5 2.5 3"/><circle cx="9" cy="9.5" r="1.2" fill="currentColor" stroke="none"/></svg>',
  moon: '<svg viewBox="0 0 48 48"><defs><linearGradient id="gMoon" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#c3c0ff"/><stop offset="100%" stop-color="#3626ce"/></linearGradient></defs><circle cx="24" cy="24" r="20" fill="url(#gMoon)" opacity=".9"/><circle cx="30" cy="18" r="16" fill="#121414"/></svg>',
  tent: '<svg viewBox="0 0 48 48"><defs><linearGradient id="gTent" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stop-color="#f0c060"/><stop offset="100%" stop-color="#e67e22"/></linearGradient></defs><path d="M6 38 L24 10 L42 38 Z" fill="url(#gTent)"/><path d="M24 10 L24 38" stroke="#fff" stroke-width="1" opacity=".3"/></svg>',
  bolt: '<svg viewBox="0 0 48 48"><defs><linearGradient id="gBolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d2bbff"/><stop offset="100%" stop-color="#a78bfa"/></linearGradient></defs><path d="M28 4 L14 26 h10 l-4 18 18-24 H28 z" fill="url(#gBolt)"/></svg>',
};

function initIcons() {
  document.querySelectorAll('[data-icon]').forEach(el => {
    const name = el.dataset.icon;
    if (ICONS[name]) el.innerHTML = ICONS[name];
  });
}

function setPlayIcon(btn, playing) {
  const el = btn?.querySelector('[data-icon="play"], [data-play-icon]');
  if (!el) return;
  el.innerHTML = playing ? ICONS.pause : ICONS.play;
}
