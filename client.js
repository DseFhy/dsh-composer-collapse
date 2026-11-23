/**
 * Browser half of the DSH composer-collapse plugin.
 *
 * States added to the chat composer (the "对话栏"):
 *   full   - the shipped composer, untouched apart from tags and the glass skin
 *   mini   - eased collapse; a liquid-glass summon bar where the composer was
 *   hidden - gone entirely; a liquid-glass recall pill that is always visible
 *
 * Behaviour
 * - Liquid glass (液态玻璃) is always on: one frost recipe shared by the composer
 *   card, the summon bar, the recall pill and the control cluster.
 * - Collapsing reserves a 54px band at the bottom instead of collapsing to zero
 *   height, so the transcript stops above the bubble and never runs under it.
 * - Positions are tracked on demand (scroll / resize / transition), never by a
 *   resident rAF loop: a loop reading getBoundingClientRect every frame forced a
 *   synchronous layout per frame and pinned ~40% of one CPU core.
 * - The control cluster dodges the queued-message bar that sits just above the
 *   composer card; it drops inside the card instead of overlapping.
 * - Clicking the conversation above the composer collapses it.
 *
 * Constraints
 * - The shipped composer is NOT replaced: only tagged with data-dshcc-* and styled.
 * - No build step; react is the only importable module; everything else is DOM.
 * - The loader id must equal the package name in package.json.
 */
window.__ModuleLoader__.load({
  id: '@dsh-local/dsh-composer-collapse',
  factory: function (require) {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    var React = require('react');

    var STYLE_ID = 'dshcc-style';
    var KEY_MODE = 'dshcc.mode';
    var KEY_AUTO = 'dshcc.auto';
    var KEY_WALL = 'dshcc.wall';
    var KEY_DEPTH = 'dshcc.depth';
    var KEY_FOLLOW = 'dshcc.follow';
    var AUTO_DELAY_MS = 2200;
    var CHROME_ATTR = 'data-dshcc-chrome';

    var CSS = [
      /* ---------------- the composer itself ---------------- */
      '[data-dshcc-root]{',
      '  transition:max-height .46s cubic-bezier(.22,1,.36,1), opacity .3s ease,',
      '    transform .46s cubic-bezier(.22,1,.36,1), margin .46s cubic-bezier(.22,1,.36,1);',
      '  will-change:max-height, transform, opacity;',
      '  max-height:2000px;',
      '}',
      /* Keep a 54px band reserved at the bottom instead of collapsing to zero:
         the transcript then stops above the bubble and never runs under it. */
      '[data-dshcc-root][data-dshcc-mode="mini"],',
      '[data-dshcc-root][data-dshcc-mode="hidden"]{',
      '  max-height:54px !important; min-height:54px !important;',
      '  overflow:hidden; background:transparent !important;',
      '  margin:0 !important; padding-top:0 !important; padding-bottom:0 !important;',
      '  transform:none; pointer-events:none !important;',
      '}',
      '[data-dshcc-root][data-dshcc-mode="mini"] [data-composer-card],',
      '[data-dshcc-root][data-dshcc-mode="hidden"] [data-composer-card]{',
      '  opacity:0 !important; pointer-events:none !important;',
      '}',
      '@media (prefers-reduced-motion: reduce){',
      '  [data-dshcc-root]{transition:none !important}',
      '  .dshcc-bubble{animation:none !important}',
      '}',
      /* ---------------- wallpaper pass-through ---------------- */
      'html.dshcc-wall, html.dshcc-wall body{',
      '  background:transparent !important; background-color:transparent !important;',
      '}',
      'html.dshcc-wall #root, html.dshcc-wall #app, html.dshcc-wall .dsh-app{',
      '  background:transparent !important;',
      '}',
      'html.dshcc-wall [data-dshcc-shell]{',
      '  background:transparent !important;',
      '}',
      /* ---------------- one frost recipe for every surface ---------------- */
      ':root{',
      '  --dshcc-blur:8px; --dshcc-sat:1.4; --dshcc-bright:1.02;',
      '  --dshcc-tint:rgba(18,18,24,.42); --dshcc-tint-strong:rgba(18,18,24,.52);',
      '  --dshcc-edge:rgba(255,255,255,.18);',
      '}',
      '.dshcc-glass-surface{',
      '  position:relative; overflow:hidden;',
      '  background:linear-gradient(157deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,.06) 36%,',
      '    rgba(255,255,255,.02) 58%, rgba(255,255,255,.10) 100%), var(--dshcc-tint);',
      '  -webkit-backdrop-filter:blur(var(--dshcc-blur)) saturate(var(--dshcc-sat)) brightness(var(--dshcc-bright));',
      '  backdrop-filter:blur(var(--dshcc-blur)) saturate(var(--dshcc-sat)) brightness(var(--dshcc-bright));',
      '  border:1px solid var(--dshcc-edge);',
      '  box-shadow:inset 0 1px 0 rgba(255,255,255,.30), inset 0 -1px 0 rgba(24,24,30,.38),',
      '    inset 1px 0 0 rgba(255,255,255,.12), inset -1px 0 0 rgba(24,24,30,.24),',
      '    0 10px 30px rgba(0,0,0,.34);',
      '}',
      /* pointer-following specular sheen + soft inner caustics */
      '.dshcc-glass-surface::before{',
      '  content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;',
      '  background:radial-gradient(120px circle at var(--dshcc-mx,50%) var(--dshcc-my,0%),',
      '    rgba(255,255,255,.34), rgba(255,255,255,.08) 42%, transparent 66%);',
      '  opacity:.85; transition:opacity .35s ease;',
      '}',
      '.dshcc-glass-surface::after{',
      '  content:""; position:absolute; inset:0; pointer-events:none; border-radius:inherit;',
      '  background:linear-gradient(105deg, transparent 0%, rgba(255,255,255,.13) 42%,',
      '    transparent 58%); mix-blend-mode:screen; opacity:.55;',
      '}',
      /* ---------------- glass on the shipped composer ---------------- */
      'html.dshcc-glass [data-dshcc-root] [data-composer-card]{',
      '  background:linear-gradient(157deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.05) 40%,',
      '    rgba(255,255,255,.02) 60%, rgba(255,255,255,.09) 100%), var(--dshcc-tint) !important;',
      /* NO backdrop-filter here: a 20px blur over the whole composer re-blurs the
         transcript on every keystroke and scroll tick — the single most expensive
         thing this plugin used to do. A translucent gradient plus inner edges reads
         almost the same and costs nothing. */
      '  border-radius:20px;',
      '  box-shadow:inset 0 1px 0 rgba(255,255,255,.30), inset 0 -1px 0 rgba(24,24,30,.38),',
      '    inset 1px 0 0 rgba(255,255,255,.12), inset -1px 0 0 rgba(24,24,30,.24),',
      '    0 14px 40px rgba(0,0,0,.34);',
      '}',
      'html.dshcc-glass [data-dshcc-root] [data-composer-card] *{',
      '  background-color:transparent !important;',
      '}',
      /* ---------------- summon bar (mini) ---------------- */
      '.dshcc-mini{',
      '  position:fixed; z-index:2147481000; box-sizing:border-box;',
      '  display:flex; align-items:center; gap:9px;',
      '  height:38px; padding:0 14px; border-radius:19px;',
      '  color:rgba(255,255,255,.72); font-size:13px; font-family:inherit;',
      '  cursor:text; user-select:none;',
      '  animation:dshcc-fade .26s ease .3s both;',
      '}',
      '.dshcc-mini:hover{ color:rgba(255,255,255,.95); border-color:rgba(255,255,255,.32); }',
      '.dshcc-mini-arrow{ margin-left:auto; font-size:13px; opacity:.55;',
      '  transition:transform .32s cubic-bezier(.22,1,.36,1), opacity .3s; }',
      '.dshcc-mini:hover .dshcc-mini-arrow{ transform:translateY(-2px); opacity:.95; }',
      /* ---------------- recall pill (hidden) ---------------- */
      '.dshcc-recall{',
      '  position:fixed; z-index:2147481100; box-sizing:border-box;',
      '  display:flex; align-items:center; justify-content:center; gap:8px;',
      '  height:38px; padding:0 14px; border-radius:19px;',
      '  color:rgba(255,255,255,.86); font-size:13px; font-family:inherit;',
      '  cursor:pointer; user-select:none;',
      '  animation:dshcc-fade .26s ease .3s both;',
      '}',
      '.dshcc-recall:hover{ color:#fff; border-color:rgba(255,255,255,.32); }',
      '.dshcc-recall:active{ opacity:.86; }',
      /* the whole chrome breathes like a soap bubble, after the fade settles */
      '.dshcc-bubble{ animation:dshcc-fade .26s ease .3s both; }',
      '@keyframes dshcc-fade{ from{ opacity:0; } to{ opacity:1; } }',
      /* ---------------- full-mode control cluster ---------------- */
      '.dshcc-dock{',
      '  position:fixed; z-index:2147481100; display:flex; gap:6px;',
      '  transform:translate(-100%,-100%); pointer-events:none;',
      '  transition:transform .3s cubic-bezier(.22,1,.36,1);',
      '}',
      '.dshcc-btn{',
      '  pointer-events:auto; width:24px; height:24px; padding:0; border-radius:50%;',
      '  display:grid; place-items:center; cursor:pointer; line-height:1;',
      '  font-family:inherit; font-size:11px;',
      '  color:rgba(255,255,255,.74);',
      '  border:1px solid var(--dshcc-edge);',
      '  background:linear-gradient(157deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,.06) 40%, var(--dshcc-tint-strong));',
      '  -webkit-backdrop-filter:blur(var(--dshcc-blur)) saturate(var(--dshcc-sat)) brightness(var(--dshcc-bright));',
      '  backdrop-filter:blur(var(--dshcc-blur)) saturate(var(--dshcc-sat)) brightness(var(--dshcc-bright));',
      '  box-shadow:inset 0 1px 0 rgba(255,255,255,.30), inset 0 -1px 0 rgba(24,24,30,.38),',
      '    0 6px 16px rgba(0,0,0,.32);',
      '  transition:transform .2s cubic-bezier(.22,1,.36,1), color .2s, border-color .2s;',
      '}',
      '.dshcc-btn:hover{ transform:translateY(-1px) scale(1.1); color:#fff; border-color:rgba(255,255,255,.3); }',
      '.dshcc-btn:active{ transform:scale(.94); }',
      '.dshcc-btn svg{ display:block; }',
    ].join('\n');

    /* ---------------------------------------------------------------- state */

    function readStored(key, fallback) {
      try {
        var value = window.localStorage.getItem(key);
        return value === null ? fallback : value;
      } catch (error) { return fallback; }
    }

    function writeStored(key, value) {
      try { window.localStorage.setItem(key, value); } catch (error) { /* private mode */ }
    }

    var store = (function () {
      var subs = new Set();
      var value = {
        mode: 'full',
        userMode: readStored(KEY_MODE, 'full'),
        auto: readStored(KEY_AUTO, '1') === '1',
        wall: readStored(KEY_WALL, '0') === '1',
        hasCard: false,
      };
      if (value.userMode !== 'mini' && value.userMode !== 'hidden') value.userMode = 'full';
      value.mode = value.userMode;
      return {
        get: function () { return value; },
        set: function (patch) {
          var changed = false;
          for (var key in patch) {
            if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
            if (value[key] !== patch[key]) changed = true;
          }
          if (!changed) return;
          value = Object.assign({}, value, patch);
          subs.forEach(function (fn) { try { fn(); } catch (error) { /* ignore */ } });
        },
        subscribe: function (fn) {
          subs.add(fn);
          return function () { subs.delete(fn); };
        },
      };
    })();

    function useStore() {
      var state = React.useState(store.get());
      React.useEffect(function () {
        return store.subscribe(function () { state[1](store.get()); });
      }, []);
      return state[0];
    }

    /* ------------------------------------------------------------ dom glue */

    function composerCard() { return document.querySelector('[data-composer-card]'); }
    function rootOf(card) { return card === null ? null : card.parentElement; }

    function markRoot(root) {
      if (root !== null && !root.hasAttribute('data-dshcc-root')) root.setAttribute('data-dshcc-root', '');
    }

    /** Glass is always on; the wallpaper pass-through stays switchable. */
    function applyDocumentFlags() {
      var html = document.documentElement;
      html.classList.add('dshcc-glass');
      if (store.get().wall) html.classList.add('dshcc-wall'); else html.classList.remove('dshcc-wall');
    }

    /**
     * Write the mode to the DOM immediately. Recovery must never wait for a
     * later paint frame: a backgrounded/minimized window may never run one.
     */
    function applyModeNow(mode) {
      var root = rootOf(composerCard());
      if (root === null) return false;
      markRoot(root);
      if (root.getAttribute('data-dshcc-mode') !== mode) {
        root.setAttribute('data-dshcc-mode', mode);
        void root.offsetWidth;
        return true;
      }
      return false;
    }

    function draftText(card) {
      var editor = card.querySelector('[contenteditable="true"], textarea');
      if (editor === null) return '';
      if (typeof editor.value === 'string') return editor.value.trim();
      return (editor.innerText || editor.textContent || '').trim();
    }

    function setMode(mode, options) {
      var persist = options === undefined || options.persist !== false;
      if (persist) {
        writeStored(KEY_MODE, mode);
        store.set({ userMode: mode });
      }
      store.set({ mode: mode });
      applyModeNow(mode);
      /* follow the CSS transition, then go idle again */
      pump(760);
    }

    function focusEditor(delay) {
      window.setTimeout(function () {
        var card = composerCard();
        var editor = card === null ? null : card.querySelector('[contenteditable="true"], textarea');
        if (editor !== null && typeof editor.focus === 'function') {
          try { editor.focus(); } catch (error) { /* read-only */ }
        }
      }, delay === undefined ? 60 : delay);
    }

    /* ---------------------------------------------------- live chrome refs */

    var live = {
      mini: null,
      recall: null,
      dock: null,
      raf: 0,
      anchor: null,
      lastCard: null,
      followEl: null,
      followX: 0,
      followY: 0,
      lastSibling: null,
      dockRect: null,
      dockAt: 0,
    };

    function depthFactor() {
      var raw = parseFloat(readStored(KEY_DEPTH, '1'));
      if (!isFinite(raw) || raw <= 0) return 1;
      return Math.min(2.5, raw);
    }

    /* --------------------------------------------------- collision avoiding */

    function isOurChrome(el) {
      return !!(el && el.closest && el.closest('[' + CHROME_ATTR + ']'));
    }

    /** Full-viewport wrappers, our chrome and the collapsed root are not "content". */
    function isBackground(el, ignoreRoot) {
      if (!el) return true;
      if (el === document.documentElement || el === document.body) return true;
      if (isOurChrome(el)) return true;
      if (ignoreRoot && el.closest && el.closest('[data-dshcc-root]') !== null) return true;
      if (el.hasAttribute && el.hasAttribute('data-dshcc-root')) return true;
      var box = el.getBoundingClientRect();
      if (box.width >= window.innerWidth - 4 && box.height >= window.innerHeight - 4) return true;
      return false;
    }

    function contentAt(x, y, ignoreRoot) {
      var stack = document.elementsFromPoint(x, y) || [];
      for (var i = 0; i < stack.length; i++) {
        if (!isBackground(stack[i], ignoreRoot)) return stack[i];
      }
      return null;
    }

    /* ------------------------------------------------------- control cluster */

    /** Keep the cluster off the queued-message bar sitting above the card. */
    function placeDock(cardRect) {
      var el = live.dock;
      if (el === null) return;
      var outsideTop = cardRect.top - 30;
      var outsideLeft = cardRect.right - 2;
      var hit = contentAt(outsideLeft - 14, outsideTop + 12, true);
      if (hit !== null) {
        el.style.left = (cardRect.right - 6) + 'px';
        el.style.top = (cardRect.top + 6) + 'px';
        el.style.transform = 'translate(-100%, 0)';
        return;
      }
      el.style.left = outsideLeft + 'px';
      el.style.top = outsideTop + 'px';
      el.style.transform = 'translate(-100%,-100%)';
    }

    /* ------------------------------------------------------------ frame loop */

    function tiltFor(rect) {
      var depth = depthFactor();
      var vx = (rect.left + rect.width / 2 - window.innerWidth / 2) / (window.innerWidth / 2 || 1);
      var vy = (rect.top + rect.height / 2 - window.innerHeight / 2) / (window.innerHeight / 2 || 1);
      var rotY = (-vx * 2.4 * depth).toFixed(2);
      var rotX = (vy * 1.8 * depth).toFixed(2);
      return 'perspective(760px) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg)';
    }

    /**
     * Mirror the composer's parallax onto the bar that queues messages above it,
     * but only when that bar does not already move by itself.
     */
    function syncFollower(root, cardRect) {
      if (readStored(KEY_FOLLOW, '1') !== '1') return;
      var sibling = root.previousElementSibling;
      if (sibling === null || sibling === live.followEl) {
        if (sibling !== live.followEl) {
          live.followEl = null;
          live.followX = 0;
          live.followY = 0;
          live.lastSibling = null;
        }
      }
      if (sibling === null) return;
      var box = sibling.getBoundingClientRect();
      if (box.height < 16 || box.height > window.innerHeight * 0.4) return;
      if (box.width < cardRect.width * 0.5) return;
      if (cardRect.top - box.bottom > 140) return;
      if (live.lastCard === null) { live.lastCard = cardRect; }
      var dx = cardRect.left - live.lastCard.left;
      var dy = cardRect.top - live.lastCard.top;
      if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) return;
      var sdx = live.lastSibling === null ? 0 : box.left - live.lastSibling.left;
      var sdy = live.lastSibling === null ? 0 : box.top - live.lastSibling.top;
      live.lastSibling = { left: box.left, top: box.top };
      live.followEl = sibling;
      if (Math.abs(sdx) > 0.6 || Math.abs(sdy) > 0.6) {
        sibling.style.transform = '';
        return;
      }
      live.followX += dx;
      live.followY += dy;
      sibling.style.transform = 'translate3d(' + live.followX.toFixed(2) + 'px,' + live.followY.toFixed(2) + 'px,0)';
    }

    var frameQueued = false;
    var pumpUntil = 0;

    /**
     * Coalesce every layout read into a single rAF. The loop is demand driven:
     * nothing is scheduled unless scroll/resize/mode change asks for it, so an
     * idle window costs zero frames (a resident rAF loop reading
     * getBoundingClientRect each frame was burning ~40% of one core).
     */
    function schedule() {
      if (frameQueued) return;
      frameQueued = true;
      live.raf = window.requestAnimationFrame(frame);
    }

    /** Keep painting for a while — used while a CSS transition is running. */
    function pump(ms) {
      var now = window.performance && window.performance.now ? window.performance.now() : Date.now();
      pumpUntil = Math.max(pumpUntil, now + (ms || 720));
      schedule();
    }

    function frame(now) {
      frameQueued = false;
      live.raf = 0;
      if (document.hidden) { pumpUntil = 0; return; }
      paint(now);
      if (now < pumpUntil) schedule(); else pumpUntil = 0;
    }

    function paint(now) {
      var card = composerCard();
      if (card === null) return;
      var root = card.parentElement;
      if (root === null) return;
      markRoot(root);
      var mode = store.get().mode;

      if (mode === 'full') {
        var cardRect = card.getBoundingClientRect();
        if (cardRect.width < 2 || cardRect.height < 2) return;
        var rootRect = root.getBoundingClientRect();
        live.anchor = {
          padLeft: cardRect.left - rootRect.left,
          padBottom: rootRect.bottom - cardRect.bottom,
          width: cardRect.width,
          height: cardRect.height,
        };
        if (live.lastCard !== null) syncFollower(root, cardRect);
        live.lastCard = { left: cardRect.left, top: cardRect.top };
        /* hit-testing is expensive: only when the card actually moved, or on a slow tick */
        var movedX = live.dockRect === null ? 999 : Math.abs(cardRect.right - live.dockRect.right);
        var movedY = live.dockRect === null ? 999 : Math.abs(cardRect.top - live.dockRect.top);
        if (movedX > 0.5 || movedY > 0.5 || now - live.dockAt > 400) {
          placeDock(cardRect);
          live.dockRect = { right: cardRect.right, top: cardRect.top };
          live.dockAt = now;
        }
        return;
      }

      var anchor = live.anchor;
      if (anchor === null || anchor.width < 2) return;
      var rect = root.getBoundingClientRect();
      /* one long capsule, not a full-width bar */
      var width = Math.min(200, Math.max(150, anchor.width - 24));
      var left = rect.left + anchor.padLeft + (anchor.width - width) / 2;
      left = Math.max(12, Math.min(window.innerWidth - width - 12, left));
      /* pinned to the very bottom edge of the session column: floating up over the
         transcript hides the messages, so the bubble stays down and only steps
         aside by one bar height when something occupies the bottom band */
      var bottom = 8;

      var element = mode === 'hidden' ? live.recall : live.mini;
      if (element === null) return;
      var probeWidth = mode === 'hidden' ? Math.min(width, element.offsetWidth || 200) : width;
      var probeLeft = mode === 'hidden' ? left + (width - probeWidth) / 2 : left;
      element.style.left = probeLeft + 'px';
      element.style.width = probeWidth + 'px';
      element.style.bottom = bottom + 'px';
      element.style.transform = tiltFor(rect);
    }

    /* ----------------------------------------------------------- auto shrink */

    function startAutoShrink() {
      var timer = null;
      var cancelled = false;

      function quiet() { if (timer !== null) { window.clearTimeout(timer); timer = null; } }

      function pageUsable() {
        if (typeof document.visibilityState === 'string' && document.visibilityState !== 'visible') return false;
        if (typeof document.hasFocus === 'function' && !document.hasFocus()) return false;
        return true;
      }

      function docked(card) {
        var box = card.getBoundingClientRect();
        return box.height >= 24 && box.top > window.innerHeight * 0.5;
      }

      function evaluate() {
        quiet();
        var current = store.get();
        if (!current.auto || current.mode !== 'full') return;
        if (!pageUsable()) return;
        var card = composerCard();
        if (card === null) return;
        if (card.contains(document.activeElement)) return;
        if (draftText(card) !== '') return;
        if (!docked(card)) return;
        timer = window.setTimeout(function () {
          timer = null;
          if (cancelled) return;
          var now = store.get();
          if (!now.auto || now.mode !== 'full') return;
          var liveCard = composerCard();
          if (liveCard === null) return;
          if (liveCard.contains(document.activeElement) || draftText(liveCard) !== '') return;
          setMode('mini', { persist: false });
        }, AUTO_DELAY_MS);
      }

      var onFocusIn = function () {
        quiet();
        if (store.get().mode === 'mini') setMode('full', { persist: false });
      };
      var onFocusOut = function () { window.setTimeout(evaluate, 80); };
      var onInput = function () {
        if (store.get().mode === 'mini' && draftText(composerCard()) !== '') setMode('full', { persist: false });
        evaluate();
      };
      document.addEventListener('focusin', onFocusIn, true);
      document.addEventListener('focusout', onFocusOut, true);
      document.addEventListener('input', onInput, true);

      var lastCheck = 0;
      var observer = new MutationObserver(function () {
        if (cancelled || timer !== null) return;
        var now = Date.now();
        if (now - lastCheck < 500) return;
        lastCheck = now;
        evaluate();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      var tick = window.setInterval(evaluate, 1500);
      evaluate();

      return function () {
        cancelled = true;
        quiet();
        document.removeEventListener('focusin', onFocusIn, true);
        document.removeEventListener('focusout', onFocusOut, true);
        document.removeEventListener('input', onInput, true);
        observer.disconnect();
        window.clearInterval(tick);
      };
    }

    /* --------------------------------------------------------------- pieces */

    function icon(path) {
      return React.createElement('svg', {
        viewBox: '0 0 16 16', width: 12, height: 12, fill: 'none', stroke: 'currentColor',
        strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
      }, React.createElement('path', { d: path }));
    }

    var ICON_COLLAPSE = 'M3.5 6.5 8 11l4.5-4.5';
    var ICON_EXPAND = 'M3.5 9.5 8 5l4.5 4.5';
    var ICON_HIDE = 'M4 4l8 8M12 4l-8 8';

    function trackPointer(event) {
      var node = event.currentTarget;
      var box = node.getBoundingClientRect();
      var mx = ((event.clientX - box.left) / Math.max(1, box.width)) * 100;
      var my = ((event.clientY - box.top) / Math.max(1, box.height)) * 100;
      node.style.setProperty('--dshcc-mx', mx.toFixed(1) + '%');
      node.style.setProperty('--dshcc-my', my.toFixed(1) + '%');
    }

    function ControlButton(props) {
      return React.createElement('button', {
        type: 'button',
        className: 'dshcc-btn',
        title: props.title,
        'aria-label': props.title,
        onMouseDown: function (event) { event.preventDefault(); },
        onClick: function (event) { event.stopPropagation(); props.onClick(); },
      }, icon(props.d));
    }

    function Chrome(props) {
      useStore();
      var state = store.get();
      if (!state.hasCard) return null;
      var children = [];

      if (state.mode === 'mini') {
        children.push(React.createElement('div', {
          key: 'mini',
          ref: function (el) { live.mini = el; },
          className: 'dshcc-mini dshcc-glass-surface dshcc-bubble',
          role: 'button',
          tabIndex: 0,
          title: '展开对话栏 (Ctrl+Shift+M)',
          onPointerMove: trackPointer,
          onClick: function () { setMode('full'); focusEditor(60); },
          onKeyDown: function (event) {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.currentTarget.click(); }
          },
        },
        React.createElement('span', null, '写点什么…'),
        React.createElement('span', { className: 'dshcc-mini-arrow' }, '\u2191'),
        ));
      }

      if (state.mode === 'hidden') {
        children.push(React.createElement('button', {
          key: 'recall',
          ref: function (el) { live.recall = el; },
          type: 'button',
          className: 'dshcc-recall dshcc-glass-surface dshcc-bubble',
          title: '展开对话栏 (Ctrl+Shift+H)',
          onPointerMove: trackPointer,
          onMouseDown: function (event) { event.preventDefault(); },
          onClick: function () { setMode('full'); },
        }, icon(ICON_EXPAND), React.createElement('span', null, '展开对话栏')));
      }

      if (state.mode === 'full') {
        children.push(React.createElement('div', {
          key: 'dock',
          ref: function (el) { live.dock = el; },
          [CHROME_ATTR]: '',
          className: 'dshcc-dock',
        },
        React.createElement(ControlButton, {
          key: 'collapse', d: ICON_COLLAPSE, title: '收起对话栏 (Ctrl+Shift+M)',
          onClick: function () { setMode('mini'); },
        }),
        React.createElement(ControlButton, {
          key: 'hide', d: ICON_HIDE, title: '隐藏对话栏 (Ctrl+Shift+H)',
          onClick: function () { setMode('hidden'); },
        }),
        ));
      }

      return React.createElement(React.Fragment, null, children);
    }

    /* --------------------------------------------------------------- plugin */

    function apply(ctx) {
      var style = document.getElementById(STYLE_ID);
      if (style === null) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = CSS;
        document.head.appendChild(style);
      }

      var disposers = [];
      applyDocumentFlags();
      disposers.push(startAutoShrink());

      var resizeObserver = new ResizeObserver(function () { schedule(); });
      resizeObserver.observe(document.body);

      var domObserver = new MutationObserver(function () {
        var card = composerCard();
        if (card !== null) markRoot(rootOf(card));
        var hasCard = card !== null;
        if (hasCard !== store.get().hasCard) store.set({ hasCard: hasCard });
        schedule();
      });
      domObserver.observe(document.body, { childList: true, subtree: true });

      /* chrome mounts/unmounts with the mode: reposition right after each render */
      disposers.push(store.subscribe(function () { schedule(); }));

      /* Coming back to the window must reopen an auto-shrunk composer even when
         no focusin fires (the same control keeps focus across the switch). */
      var onWindowWake = function () {
        if (typeof document.visibilityState === 'string' && document.visibilityState !== 'visible') return;
        var now = store.get();
        if (!now.hasCard) return;
        if (now.mode === 'mini' && now.userMode === 'full') setMode('full', { persist: false });
        schedule();
      };
      window.addEventListener('focus', onWindowWake);
      document.addEventListener('visibilitychange', onWindowWake);

      /* Clicking the conversation above the composer collapses it. The check is
         purely geometric so it works without knowing the message markup. */
      var onPointerDown = function (event) {
        var now = store.get();
        if (now.mode !== 'full' || live.anchor === null) return;
        if (event.button !== 0) return;
        if (isOurChrome(event.target)) return;
        var card = composerCard();
        if (card === null) return;
        var rect = card.getBoundingClientRect();
        if (rect.height < 24) return;
        if (card.contains(event.target)) return;
        if (event.target && event.target.closest && event.target.closest('[data-dshcc-root]')) return;
        if (event.clientY >= rect.top - 6) return;
        if (event.clientX < rect.left - 24 || event.clientX > rect.left + rect.width + 24) return;
        setMode('mini', { persist: false });
      };
      document.addEventListener('pointerdown', onPointerDown, true);

      var onKey = function (event) {
        if (event.key === 'Escape' && (store.get().mode === 'mini' || store.get().mode === 'hidden')) {
          setMode('full');
          return;
        }
        if (!event.ctrlKey || !event.shiftKey) return;
        var key = String(event.key).toLowerCase();
        if (key === 'm') {
          event.preventDefault();
          setMode(store.get().mode === 'full' ? 'mini' : 'full');
        } else if (key === 'h') {
          event.preventDefault();
          setMode(store.get().mode === 'hidden' ? 'full' : 'hidden');
        } else if (key === 'w') {
          event.preventDefault();
          var wall = !store.get().wall;
          writeStored(KEY_WALL, wall ? '1' : '0');
          store.set({ wall: wall });
          applyDocumentFlags();
        }
      };
      window.addEventListener('keydown', onKey);

      /* demand driven: reposition on scroll/resize/wheel and during transitions only */
      var kick = function () { schedule(); };
      window.addEventListener('scroll', kick, true);
      window.addEventListener('resize', kick);
      window.addEventListener('wheel', kick, { passive: true });
      disposers.push(function () {
        window.removeEventListener('scroll', kick, true);
        window.removeEventListener('resize', kick);
        window.removeEventListener('wheel', kick);
      });
      schedule();

      var slotsCleanup = ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({ name: 'shell.overlay', id: 'composer-collapse.controls' }, Chrome);
      });

      ctx.effect(function () {
        return function () {
          disposers.forEach(function (dispose) { try { dispose(); } catch (error) { /* gone */ } });
          window.cancelAnimationFrame(live.raf);
          window.removeEventListener('keydown', onKey);
          window.removeEventListener('focus', onWindowWake);
          document.removeEventListener('visibilitychange', onWindowWake);
          document.removeEventListener('pointerdown', onPointerDown, true);
          resizeObserver.disconnect();
          domObserver.disconnect();
          if (typeof slotsCleanup === 'function') slotsCleanup();
          if (live.followEl !== null) { live.followEl.style.transform = ''; live.followEl = null; }
          var card = composerCard();
          if (card !== null && card.parentElement !== null) {
            card.parentElement.removeAttribute('data-dshcc-mode');
            card.parentElement.removeAttribute('data-dshcc-root');
          }
          document.documentElement.classList.remove('dshcc-glass');
          document.documentElement.classList.remove('dshcc-wall');
          var tag = document.getElementById(STYLE_ID);
          if (tag !== null && tag.parentNode !== null) tag.parentNode.removeChild(tag);
        };
      });
    }

    exports.apply = apply;
    exports.inject = ['slots'];
    return module.exports;
  },
});
