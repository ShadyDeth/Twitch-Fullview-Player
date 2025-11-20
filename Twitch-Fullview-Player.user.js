// ==UserScript==
// @name         Twitch Fullview Player
// @namespace    https://github.com/ShadyDeth/
// @homepageURL  https://github.com/ShadyDeth/Twitch-Fullview-Player
// @version      1.7.0
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

  const SIDENAV_HOVER_ENABLED = true; // set to false to hide left side-nav
  const BOOTSTRAP_TIMEOUT_MS = 6000;
  const INIT_DELAY_MS = 0; // adjust delay if layout fails to change

  const BAD_STATUS_SELECTOR = `
    .channel-status-info.channel-status-info--offline,
    .channel-status-info.channel-status-info--autohost
  `;

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
    .side-nav.twp-visible { transform: translateX(0) !important; pointer-events: auto; }
    :fullscreen .side-nav { display: none !important; }
    ` : ''}
    @media screen and (min-width: 920px) {
      .channel-root--hold-chat + .persistent-player,
      .channel-root--watch-chat + .persistent-player,
      .channel-root__info--with-chat .channel-info-content,
      .channel-root__player--with-chat { width: 100% !important; }
    }
    html[data-twp-live="1"] .channel-root__main,
    html[data-twp-live="1"] .channel-home-content {
      display: flex !important;
      align-items: flex-start !important;
    }
    .persistent-player,
    .video-player__container {
      max-height: calc(100vh - var(--twt-nav-h)) !important;
      aspect-ratio: 16 / 9 !important;
      z-index: 1001 !important;
    }
    .channel-root__right-column.channel-root__right-column--expanded { flex: unset !important; }
    :fullscreen .persistent-player,
    :fullscreen .video-player__container {
      max-height: 100vh !important;
      height: 100vh !important;
      width: 100vw !important;
      aspect-ratio: auto !important;
    }
    :fullscreen .channel-root__info { display: none !important; }
    [aria-label="Theatre Mode (alt+t)"] { display: none !important; }
    .channel-root__info { overflow-anchor: none !important; }
    .toggle-visibility__right-column--expanded { transform: none !important; }
    .tw-overlay,
    .tw-dialog-layer,
    div[role="dialog"],
    [data-a-target="tw-dialog-layer"],
    [data-test-selector="simple-dropdown__menu"],
    [data-test-selector*="popover"],
    [data-a-target*="popover"] { z-index: 3000 !important; }
    html[data-twp-live="1"] .support-panel-container { z-index: 3005 !important; }
  `;

  let initialized = false;
  let disabledForStatus = false;
  let adjustScheduled = false;
  let pendingInitTimeout = null;

  function ensureStyle() {
    let style = document.getElementById('twitch-layout-fix-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'twitch-layout-fix-style';
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  function enableSideNavReveal() {
    if (!SIDENAV_HOVER_ENABLED) return;
    let visible = false;
    document.addEventListener('mousemove', (e) => {
      if (!initialized) return;
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
      if (sideNav) sideNav.classList.remove('twp-visible');
      visible = false;
    });
  }

  function hasPlayer() {
    return document.querySelector('.video-player__container, .persistent-player');
  }

  function hasChatColumn() {
    return document.querySelector(
      '.channel-root__right-column.channel-root__right-column--expanded,' +
      '.toggle-visibility__right-column--expanded'
    );
  }

  function hasWatchRoot() {
    return document.querySelector('.channel-root--watch-chat, .channel-root--hold-chat');
  }

  function hasLiveWatchLayout() {
    return !!(hasWatchRoot() && hasPlayer() && hasChatColumn());
  }

  function isBadStatus() {
    return document.querySelector(BAD_STATUS_SELECTOR);
  }

  function adjustChat() {
    adjustScheduled = false;
    if (isBadStatus()) return;
    if (document.querySelector('.channel-root__player--offline')) return;
    const player = document.querySelector('.video-player__container') || document.querySelector('.persistent-player');
    if (!player) return;
    const chat = document.querySelector('.channel-root__right-column.channel-root__right-column--expanded');
    const toggle = document.querySelector('.toggle-visibility__right-column--expanded');
    const info = document.querySelector('.channel-root__info');
    if (info) {
      setTimeout(() => {
        if (isBadStatus()) return;
        if (!document.fullscreenElement && document.body.contains(info)) {
          const playerWidth = player.getBoundingClientRect().width;
          info.style.overflowAnchor = 'none';
          info.style.width = `${playerWidth}px`;
          info.style.marginTop = `calc(100vh - 50px)`;
        }
      }, 2000);
    }
    if (chat || toggle) {
      const windowWidth = window.innerWidth;
      const playerWidth = player.getBoundingClientRect().width;
      let chatWidthPx = Math.max(280, windowWidth - playerWidth);
      const rootFontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const chatWidthRem = chatWidthPx / rootFontSize;
      const chatTransform = `translateX(-${chatWidthRem}rem) translateZ(0)`;
      if (chat) {
        chat.style.width = `${chatWidthPx}px`;
        chat.style.maxWidth = `${chatWidthPx}px`;
        chat.style.flex = `0 0 ${chatWidthPx}px`;
        chat.style.setProperty('transform', chatTransform, 'important');
        chat.style.transition = 'none';
      }
      if (toggle && !document.fullscreenElement) {
        toggle.style.setProperty('transform', chatTransform, 'important');
        toggle.style.transition = 'none';
      }
      const supportPanel = document.querySelector('.support-panel-container');
      if (supportPanel) {
        supportPanel.style.setProperty('transform', `translateX(-${chatWidthPx}px)`, 'important');
        supportPanel.style.zIndex = '3005';
      }
    }
  }

  function scheduleAdjustChat() {
    if (adjustScheduled) return;
    adjustScheduled = true;
    setTimeout(adjustChat, 50);
  }

  function initFullview() {
    if (initialized || disabledForStatus) return;
    initialized = true;
    document.documentElement.setAttribute('data-twp-live', '1');
    ensureStyle();
    enableSideNavReveal();
    adjustChat();
    const origFocus = HTMLElement.prototype.focus;
    HTMLElement.prototype.focus = function () {
      if (this.matches('h1.tw-title, h1.CoreText-sc-1txzju1-0.ScTitleText-sc-d9mj2s-0.tw-title')) return;
      return origFocus.apply(this, arguments);
    };
    document.addEventListener('keydown', (e) => {
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
    window.addEventListener('load', () => setTimeout(scheduleAdjustChat, 1200));
    window.addEventListener('resize', scheduleAdjustChat);
    new MutationObserver(() => {
      if (!document.fullscreenElement) scheduleAdjustChat();
    }).observe(document.body, { childList: true, subtree: true });
  }

  function scheduleInitWithDelay() {
    if (pendingInitTimeout || initialized || disabledForStatus) return;
    pendingInitTimeout = setTimeout(() => {
      pendingInitTimeout = null;
      if (initialized || disabledForStatus) return;
      if (isBadStatus()) {
        disabledForStatus = true;
        return;
      }
      if (hasLiveWatchLayout()) initFullview();
    }, INIT_DELAY_MS);
  }

  function bootstrap() {
    if (!document.documentElement) return;
    let observer;
    const checkState = () => {
      if (initialized || disabledForStatus) {
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        return;
      }
      if (isBadStatus()) {
        disabledForStatus = true;
        if (observer) {
          observer.disconnect();
          observer = null;
        }
        if (pendingInitTimeout) {
          clearTimeout(pendingInitTimeout);
          pendingInitTimeout = null;
        }
        return;
      }
      if (hasLiveWatchLayout()) scheduleInitWithDelay();
    };
    observer = new MutationObserver(checkState);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('readystatechange', () => {
      if (document.readyState === 'interactive' || document.readyState === 'complete') checkState();
    });
    setTimeout(() => {
      if (observer) {
        observer.disconnect();
        observer = null;
      }
      checkState();
    }, BOOTSTRAP_TIMEOUT_MS);
  }

  bootstrap();
})();