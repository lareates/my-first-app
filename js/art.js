/** 本地 SVG 视觉 — 不依赖外部图片 */
const NAP_SVG = {
  meditate: `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="mg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#c3c0ff" stop-opacity="0.9"/>
        <stop offset="60%" stop-color="#3626ce" stop-opacity="0.4"/>
        <stop offset="100%" stop-color="#0c0f0f" stop-opacity="0"/>
      </radialGradient>
      <filter id="blur"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <circle cx="160" cy="160" r="140" fill="url(#mg)" opacity="0.6"/>
    ${[0,30,60,90,120,150].map(a => `<ellipse cx="160" cy="160" rx="90" ry="35" fill="none" stroke="#c3c0ff" stroke-width="0.8" opacity="0.35" transform="rotate(${a} 160 160)"/>`).join('')}
    <circle cx="160" cy="160" r="50" fill="#d2bbff" opacity="0.25" filter="url(#blur)"/>
    <circle cx="160" cy="160" r="20" fill="#e2e2e2" opacity="0.5"/>
  </svg>`,

  sleep: `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="sg" cx="50%" cy="40%" r="55%">
        <stop offset="0%" stop-color="#7b61ff" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="#050607" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="160" cy="160" r="150" fill="url(#sg)"/>
    <path d="M200 90 Q240 160 200 230 Q120 230 120 160 Q120 90 200 90" fill="none" stroke="#c3c0ff" stroke-width="1.2" opacity="0.5"/>
    <circle cx="175" cy="145" r="55" fill="#1a1030" opacity="0.8"/>
    <circle cx="195" cy="130" r="50" fill="#0c0f0f"/>
    ${Array.from({length:12},(_,i)=>{const a=i*30*Math.PI/180; const x=160+100*Math.cos(a); const y=160+100*Math.sin(a); return `<circle cx="${x}" cy="${y}" r="2" fill="#c3c0ff" opacity="0.4"/>`;}).join('')}
  </svg>`,

  breathe: `<svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#ff9900" stop-opacity="0.35"/>
        <stop offset="50%" stop-color="#3626ce" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#0c0f0f" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <circle cx="160" cy="160" r="130" fill="url(#bg)"/>
    ${[0,45,90,135].map(a => `<circle cx="160" cy="160" r="70" fill="none" stroke="#ff9900" stroke-width="1" opacity="0.2" transform="rotate(${a} 160 160)"/>`).join('')}
    <circle cx="160" cy="160" r="45" fill="none" stroke="#d2bbff" stroke-width="1.5" opacity="0.5"/>
    <circle cx="160" cy="160" r="25" fill="#ff9900" opacity="0.2"/>
    <circle cx="160" cy="160" r="8" fill="#e2e2e2" opacity="0.6"/>
  </svg>`,
};

function setNapArt(el, mode) {
  if (!el) return;
  el.innerHTML = NAP_SVG[mode] || NAP_SVG.meditate;
}
