/** 首次进入任一场景时，引导收藏本站（全局仅一次） */
const BOOKMARK_HINT_KEY = 'aetheris-bookmark-hint-seen';

const BookmarkHint = (() => {
  let hintEl = null;

  function getAnchor(screen) {
    return screen.querySelector('.nap-bg-btn-wrap')
      || screen.querySelector('.bookmark-hint-anchor');
  }

  function createHint() {
    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'bookmark-hint';
    hint.hidden = true;
    hint.setAttribute('aria-label', '收藏本站，以便下次快速进入');
    hint.innerHTML = `
      <span class="ico bookmark-hint-star" data-icon="favorite"></span>
      <span class="bookmark-hint-text">收藏我，以便下次快速进入</span>
    `;
    return hint;
  }

  function tryShow(screen, cleanupFns) {
    if (!screen || localStorage.getItem(BOOKMARK_HINT_KEY)) return;

    const anchor = getAnchor(screen);
    if (!anchor) return;

    localStorage.setItem(BOOKMARK_HINT_KEY, '1');

    if (!hintEl) {
      hintEl = createHint();
      initIcons();
    }

    if (hintEl.parentElement !== anchor) {
      hintEl.classList.remove('visible');
      anchor.appendChild(hintEl);
    }

    const ac = new AbortController();
    hintEl.hidden = false;

    const showTimer = setTimeout(() => hintEl.classList.add('visible'), 500);

    let touchHandled = false;
    const dismiss = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'click' && touchHandled) {
        touchHandled = false;
        return;
      }
      if (e.type === 'touchend') touchHandled = true;
      hintEl.classList.remove('visible');
      setTimeout(() => {
        hintEl.hidden = true;
        hintEl.remove();
      }, 360);
      ac.abort();
    };

    hintEl.addEventListener('touchend', dismiss, { signal: ac.signal, passive: false });
    hintEl.addEventListener('click', dismiss, { signal: ac.signal });

    const cleanup = () => {
      clearTimeout(showTimer);
      ac.abort();
      hintEl.classList.remove('visible');
      hintEl.hidden = true;
      hintEl.remove();
    };

    cleanupFns.push(cleanup);
  }

  return { tryShow };
})();
