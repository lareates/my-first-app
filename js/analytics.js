/**
 * Umami Analytics · 安全事件上报
 */
function trackEvent(name) {
  if (window.umami && typeof window.umami.track === 'function') {
    window.umami.track(name);
  }
}
