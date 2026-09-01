/** SEO 落地页 CTA · Umami 埋点（不阻断跳转） */
(function () {
  function bindCta(el) {
    const eventName = el.dataset.trackEvent;
    if (!eventName) return;

    let last = 0;
    let touchHandled = false;

    const run = (e) => {
      if (e.type === 'click' && touchHandled) {
        touchHandled = false;
        return;
      }
      const now = Date.now();
      if (now - last < 400) return;
      last = now;
      if (e.type === 'touchend') touchHandled = true;
      if (typeof trackEvent === 'function') trackEvent(eventName);
    };

    el.addEventListener('touchend', run, { passive: true });
    el.addEventListener('click', run);
  }

  document.querySelectorAll('[data-track-event]').forEach(bindCta);
})();
