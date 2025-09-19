// ==UserScript==
// @name         Twitch Fullview Player
// @namespace    https://github.com/ShadyDeth/
// @homepageURL  https://github.com/ShadyDeth/Twitch-Fullview-Player
// @version      1.4.0
// @description  Twitch video player that takes up the full view of the web page with chat
// @author       ShadyDeth
// @downloadURL  https://github.com/ShadyDeth/Twitch-Fullview-Player/raw/main/Twitch-Fullview-Player.user.js
// @updateURL    https://github.com/ShadyDeth/Twitch-Fullview-Player/raw/main/Twitch-Fullview-Player.user.js
// @icon         https://www.google.com/s2/favicons?domain=twitch.tv
// @match        *://www.twitch.tv/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const css = `
    :root { --twt-nav-h: 5rem; }
    .side-nav { display: none !important; }

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

  function ensureStyle() {
    if (!document.getElementById('twitch-layout-fix-style')) {
      const style = document.createElement('style');
      style.id = 'twitch-layout-fix-style';
      style.textContent = css;
      document.head.appendChild(style);
    }
  }

  function adjustChat() {
    if (document.querySelector('.channel-root__player--offline')) return;

    const player = document.querySelector('.video-player__container') || document.querySelector('.persistent-player');
    if (!player) return;

    const chat = document.querySelector('.channel-root__right-column.channel-root__right-column--expanded');
    const toggle = document.querySelector('.toggle-visibility__right-column--expanded');
    const info = document.querySelector('.channel-root__info');

    if (info) {
      setTimeout(() => {
        if (!document.fullscreenElement && document.body.contains(info)) {
          info.style.overflowAnchor = "none";
          const playerWidth = player.getBoundingClientRect().width;
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
    }
  }

  const origFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function () {
    if (this.matches('h1.tw-title, h1.CoreText-sc-1txzju1-0.ScTitleText-sc-d9mj2s-0.tw-title')) {
      return;
    }
    return origFocus.apply(this, arguments);
  };

  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  ensureStyle();
  adjustChat();
  window.addEventListener('load', () => setTimeout(adjustChat, 1200));
  window.addEventListener('resize', adjustChat);

  new MutationObserver(() => {
    if (!document.fullscreenElement) adjustChat();
  }).observe(document.body, { childList: true, subtree: true });
})();