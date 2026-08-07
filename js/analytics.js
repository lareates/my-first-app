/**
 * Umami Analytics · 轻量事件封装（不阻塞车机主线程）
 */
const Analytics = (() => {
  const SCENE_EVENTS = {
    nap: 'nap_click',
    camp: 'camp_click',
    focus: 'charge_click',
  };

  function track(eventName, data) {
    if (!eventName) return;
    const send = () => {
      try {
        const tracker = typeof umami !== 'undefined' ? umami : window.umami;
        if (tracker && typeof tracker.track === 'function') {
          tracker.track(eventName, data);
        }
      } catch { /* ignore */ }
    };
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(send, { timeout: 2500 });
    } else {
      setTimeout(send, 0);
    }
  }

  function trackScene(scene) {
    const eventName = SCENE_EVENTS[scene];
    if (eventName) track(eventName);
  }

  return { track, trackScene, SCENE_EVENTS };
})();
