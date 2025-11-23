// ==UserScript==
// @name         Twitch Fullview Player
// @namespace    https://github.com/ShadyDeth/
// @homepageURL  https://github.com/ShadyDeth/Twitch-Fullview-Player
// @version      1.8.1
// @description  Twitch video player that takes up the full view of the web page with chat
// @author       ShadyDeth
// @downloadURL  https://github.com/ShadyDeth/Twitch-Fullview-Player/raw/main/Twitch-Fullview-Player.user.js
// @updateURL    https://github.com/ShadyDeth/Twitch-Fullview-Player/raw/main/Twitch-Fullview-Player.user.js
// @icon         https://www.google.com/s2/favicons?domain=twitch.tv
// @match        *://www.twitch.tv/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const SIDENAV_HOVER_ENABLED = true; // Set to false to disable side nav reveal on hover
  const PAGE_START = (typeof performance !== 'undefined' && performance.now)
    ? performance.now()
    : Date.now();
  const SAFE_FALLBACK_DELAY_MS = 800; // only allow fallback after this long

  const css = `
    :root { --twt-nav-h: 5rem; }

    .side-nav {
      ${SIDENAV_HOVER_ENABLED
        ? `
      position: fixed !important;
      top: var(--twt-nav-h);
      left: 0;
      height: calc(100vh - var(--twt-nav-h));
      transform: translateX(-100%) !important;
      transition: transform 200ms ease !important;
      z-index: 2001 !important;
      pointer-events: none;`
        : `
      display: none !important;`
      }
    }
    ${SIDENAV_HOVER_ENABLED ? `
    .side-nav.twp-visible {
      transform: translateX(0) !important;
      pointer-events: auto;
    }
    :fullscreen .side-nav { display: none !important; }
    ` : ''}

    @media screen and (min-width: 920px) {
      .channel-root--hold-chat + .persistent-player,
      .channel-root--watch-chat + .persistent-player,
      .channel-root__info--with-chat .channel-info-content,
      .channel-root__player--with-chat {
        width: 100% !important;
      }
    }

    .channel-root__main,
    .channel-home-content {
      display: flex !important;
      align-items: flex-start !important;
    }

    .persistent-player,
    .video-player__container {
      max-height: calc(100vh - var(--twt-nav-h)) !important;
      aspect-ratio: 16 / 9 !important;
      z-index: 1001 !important;
    }

    .channel-root__right-column.channel-root__right-column--expanded {
      flex: unset !important;
    }

    :fullscreen .persistent-player,
    :fullscreen .video-player__container {
      max-height: 100vh !important;
      height: 100vh !important;
      width: 100vw !important;
      aspect-ratio: auto !important;
    }

    :fullscreen .channel-root__info {
      display: none !important;
    }

    :fullscreen [data-a-target="right-column__toggle-collapse-btn"] {
      display: none !important;
    }

    [aria-label="Theatre Mode (alt+t)"] {
      display: none !important;
    }

    .channel-root__info {
      overflow-anchor: none !important;
    }

    .toggle-visibility__right-column--expanded {
      transform: none !important;
    }
  `;

  // --------- HELPERS ---------

  function isChannelRootPath() {
    const path = location.pathname.replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);
    // Only /username (no /directory, /username/about, etc.)
    return segments.length === 1;
  }

  function isLiveChannel() {
    if (!isChannelRootPath()) return false;

    // Hard offline markers
    if (document.querySelector('.channel-root__player--offline')) return false;
    if (document.querySelector('[data-a-target="player-overlay-offline"]')) return false;
    if (document.querySelector('[data-a-target="offline-channel-header"]')) return false;

    // DOM live-only indicators
    if (document.querySelector('[data-a-target="stream-live-indicator"]')) return true;
    if (document.querySelector('[data-a-target="animated-channel-viewers-count"]')) return true;
    if (document.querySelector('.live-channel-stream-information')) return true;

    // ---- Safe fallback: only after a short delay, and only if player+chat exist,
    // with NO offline markers (already checked above).
    const now = (typeof performance !== 'undefined' && performance.now)
      ? performance.now()
      : Date.now();
    const elapsed = now - PAGE_START;

    if (elapsed > SAFE_FALLBACK_DELAY_MS) {
      const playerLike = document.querySelector('.video-player__container, .persistent-player');
      const chatColumn = document.querySelector('.channel-root__right-column.channel-root__right-column--expanded');
      if (playerLike && chatColumn) {
        return true;
      }
    }

    // If we don't see explicit live markers and safe fallback didn't trigger, treat as NOT live.
    return false;
  }

  function getLayoutElements() {
    const player =
      document.querySelector('.video-player__container') ||
      document.querySelector('.persistent-player');

    const chat = document.querySelector(
      '.channel-root__right-column.channel-root__right-column--expanded'
    );
    const toggle = document.querySelector('.toggle-visibility__right-column--expanded');
    const info = document.querySelector('.channel-root__info');
    const supportPanel = document.querySelector('.support-panel-container');

    return { player, chat, toggle, info, supportPanel };
  }

  function ensureStyle(isLive) {
    const existing = document.getElementById('twitch-layout-fix-style');

    if (!isLive) {
      if (existing && existing.parentNode) {
        existing.parentNode.removeChild(existing);
      }
      return;
    }

    if (!existing) {
      const style = document.createElement('style');
      style.id = 'twitch-layout-fix-style';
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  // --------- SIDE NAV REVEAL ---------

  function enableSideNavReveal() {
    if (!SIDENAV_HOVER_ENABLED) return;

    let visible = false;

    document.addEventListener('mousemove', (e) => {
      if (document.fullscreenElement) return;
      const sideNav = document.querySelector('.side-nav');
      if (!sideNav) return;

      const isNearLeft = e.clientX <= 50;
      const isBottomExcluded = e.clientY >= (window.innerHeight - 80);

      if (isNearLeft && !isBottomExcluded) {
        if (!visible) {
          sideNav.classList.add('twp-visible');
          visible = true;
        }
      } else {
        if (visible && !sideNav.matches(':hover')) {
          sideNav.classList.remove('twp-visible');
          visible = false;
        }
      }
    });

    document.addEventListener('mouseleave', () => {
      const sideNav = document.querySelector('.side-nav');
      if (sideNav) {
        sideNav.classList.remove('twp-visible');
      }
      visible = false;
    });
  }

  // --------- MAIN LAYOUT UPDATE ---------

  function updateLayout() {
    const live = isLiveChannel();
    ensureStyle(live);

    if (!live || document.fullscreenElement) return;

    const { player, chat, toggle, info, supportPanel } = getLayoutElements();
    if (!player) return;

    // Channel info bar width / push-down
    if (info) {
      setTimeout(() => {
        if (!document.fullscreenElement && document.body.contains(info)) {
          const playerWidth = player.getBoundingClientRect().width;
          info.style.overflowAnchor = 'none';
          info.style.width = `${playerWidth}px`;
          info.style.marginTop = 'calc(100vh - 50px)';
        }
      }, 2000);
    }

    if (chat || toggle) {
      const windowWidth = window.innerWidth;
      const playerWidth = player.getBoundingClientRect().width;
      const chatWidthPx = Math.max(280, windowWidth - playerWidth);
      const rootFontSize =
        parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const chatWidthRem = chatWidthPx / rootFontSize;
      const chatTransform = `translateX(-${chatWidthRem}rem) translateZ(0)`;

      if (chat) {
        chat.style.width = `${chatWidthPx}px`;
        chat.style.maxWidth = `${chatWidthPx}px`;
        chat.style.flex = `0 0 ${chatWidthPx}px`;
        chat.style.setProperty('transform', chatTransform, 'important');
        chat.style.transition = 'none';
      }

      if (toggle) {
        toggle.style.setProperty('transform', chatTransform, 'important');
        toggle.style.transition = 'none';
      }

      if (supportPanel) {
        supportPanel.style.setProperty('z-index', '3002', 'important');
        supportPanel.style.setProperty('transform', chatTransform, 'important');
        supportPanel.style.pointerEvents = 'auto';
      }
    }
  }

  // --------- SPA ROUTE CHANGE HOOKS ---------

  let lastUrl = location.href;

  function handleUrlChange() {
    const current = location.href;
    if (current === lastUrl) return;
    lastUrl = current;
    updateLayout();
  }

  const origPushState = history.pushState;
  history.pushState = function () {
    const ret = origPushState.apply(this, arguments);
    handleUrlChange();
    return ret;
  };

  const origReplaceState = history.replaceState;
  history.replaceState = function () {
    const ret = origReplaceState.apply(this, arguments);
    handleUrlChange();
    return ret;
  };

  window.addEventListener('popstate', handleUrlChange);

  // --------- INIT ---------

  function initFullview() {
    enableSideNavReveal();

    const origFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function () {
      if (
        this.matches(
          'h1.tw-title, h1.CoreText-sc-1txzju1-0.ScTitleText-sc-d9mj2s-0.tw-title'
        )
      ) {
        return;
      }
      return origFocus.apply(this, arguments);
    };

    document.addEventListener(
      'keydown',
      (e) => {
        if (e.altKey && e.key.toLowerCase() === 't') {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      true
    );

    updateLayout();

    window.addEventListener('load', () => {
      updateLayout();
      setTimeout(updateLayout, 1200);
    });

    window.addEventListener('resize', updateLayout);

    const waitForBody = () => {
      if (!document.body) {
        requestAnimationFrame(waitForBody);
        return;
      }
      new MutationObserver(() => {
        if (!document.fullscreenElement) {
          updateLayout();
        }
      }).observe(document.body, { childList: true, subtree: true });
    };
    waitForBody();
  }

  initFullview();
})();
