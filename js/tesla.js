/** 特斯拉 / 车机浏览器音频解锁 */
async function unlockAndPlay(playFn) {
  try {
    const ctx = await AudioEngine.resume();
    if (ctx && ctx.state === 'suspended') await ctx.resume();
    playFn();
  } catch (e) {
    console.error('Audio unlock failed', e);
  }
}

function showAudioToast(show, msg) {
  return { show, msg };
}

function bindCarPlay(btn, toggleFn) {
  let last = 0;
  const run = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - last < 400) return;
    last = now;
    unlockAndPlay(toggleFn);
  };
  btn.addEventListener('click', run);
  btn.addEventListener('touchend', run);
}
