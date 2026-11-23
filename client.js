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
      /* Self-lit: two soft blooms live INSIDE the surface, so the frost reads the
         same over a plain dark app background, a wallpaper, or nothing at all. */
      '  background:',
      '    radial-gradient(140% 120% at 8% -12%, rgba(128,162,255,.22) 0%, rgba(128,162,255,0) 58%),',
      '    radial-gradient(120% 120% at 102% 110%, rgba(112,236,206,.16) 0%, rgba(112,236,206,0) 62%),',
      '    linear-gradient(157deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,.06) 36%,',
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
      /* no backdrop-filter (old engine, disabled GPU compositing, forced solid bg):
         lean on a denser tint so the panel still reads as glass instead of soup */
      '@supports not ((backdrop-filter:blur(2px)) or (-webkit-backdrop-filter:blur(2px))){',
      '  :root{ --dshcc-tint:rgba(15,15,21,.82); --dshcc-tint-strong:rgba(15,15,21,.88); }',
      '}',
      /* ---------------- glass on the shipped composer ---------------- */
      'html.dshcc-glass [data-dshcc-root] [data-composer-card]{',
      '  background:',
      '    radial-gradient(140% 120% at 6% -14%, rgba(128,162,255,.20) 0%, rgba(128,162,255,0) 60%),',
      '    radial-gradient(120% 120% at 104% 112%, rgba(112,236,206,.14) 0%, rgba(112,236,206,0) 64%),',
      '    linear-gradient(157deg, rgba(255,255,255,.14) 0%, rgba(255,255,255,.05) 40%,',
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
      /* hide button that rides just outside the collapsed capsule */
      '.dshcc-mini-hide{',
      '  position:fixed; z-index:2147481100; width:26px; height:26px; border-radius:13px;',
      '  pointer-events:auto;',
      '}',
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
      '  background:radial-gradient(130% 130% at 18% -10%, rgba(140,172,255,.30), rgba(140,172,255,0) 62%),',
      '    linear-gradient(157deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,.06) 40%, var(--dshcc-tint-strong));',
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
      miniHide: null,
      dock: null,
      dockBase: null,
      dockX: 0,
      dockY: 0,
      dockMoving: false,
      centerX: null,
      styleKey: null,
    };

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
    /**
     * Keep the cluster glued to the card without hit-testing every frame: while
     * the card is being moved (wallpaper-engine parallax) we only push the measured
     * delta through a composited translate; the expensive occupancy probe runs
     * once the motion settles, or when the drift gets large.
     */
    function followDockWith(cardRect, deltaX, deltaY, first, now) {
      var el = live.dock;
      if (!el) return;
      var moving = Math.abs(deltaX) > 0.35 || Math.abs(deltaY) > 0.35;
      if (moving) {
        live.dockX += deltaX;
        live.dockY += deltaY;
        live.dockMoving = true;
      }
      var drift = Math.abs(live.dockX) + Math.abs(live.dockY);
      var settled = now - live.dockAt > 260;
      if (first || live.dockBase === null || drift > 160 || (live.dockMoving && settled) || now - live.dockAt > 1500) {
        live.dockX = 0;
        live.dockY = 0;
        live.dockMoving = false;
        live.dockAt = now;
        placeDock(cardRect);
        return;
      }
      if (moving) applyDockTransform();
    }

    function applyDockTransform() {
      var el = live.dock;
      var base = live.dockBase;
      if (el === null || base === null) return;
      el.style.transform = 'translate(' + base.tx + ',' + base.ty + ') translate3d(' +
        live.dockX.toFixed(2) + 'px,' + live.dockY.toFixed(2) + 'px,0)';
    }

    function placeDock(cardRect) {
      var el = live.dock;
      if (!el) return;
      var height = el.offsetHeight || 26;
      var gap = 6;
      /* Never inside the card: an inset cluster sits on top of the text you are
         typing. Prefer right above the card, then a second row higher, then the
         free side. If everything is occupied we still stay outside the card. */
      var candidates = [
        { left: cardRect.right, top: cardRect.top - gap - height, tx: '-100%', ty: '0' },
        { left: cardRect.right, top: cardRect.top - gap - height * 2 - 4, tx: '-100%', ty: '0' },
        { left: cardRect.left - gap * 2, top: cardRect.top + cardRect.height / 2, tx: '-100%', ty: '-50%' },
        { left: cardRect.right + gap * 2, top: cardRect.top + cardRect.height / 2, tx: '0', ty: '-50%' },
      ];
      var chosen = candidates[0];
      for (var i = 0; i < candidates.length; i++) {
        var cand = candidates[i];
        var probeX = cand.tx === '-100%' ? cand.left - 12 : cand.left + 12;
        var probeY = cand.ty === '-50%' ? cand.top : cand.top + height / 2;
        if (probeX < 8 || probeX > window.innerWidth - 8) continue;
        if (probeY < 8 || probeY > window.innerHeight - 8) continue;
        if (contentAt(probeX, probeY, true) === null) { chosen = cand; break; }
      }
      el.style.left = chosen.left + 'px';
      el.style.top = chosen.top + 'px';
      live.dockBase = chosen;
      applyDockTransform();
    }

    /* ------------------------------------------------------------ frame loop */

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
     * Frame-rate cap. The follower/tilt loop only needs smooth motion, not every
     * vsync tick, so paint runs at most FPS_CAP times per second. Override with
     * localStorage.setItem('dshcc.fps', '60') (accepts 30-240, default 120) and
     * reload the page.
     */
    function fpsCap() {
      var raw = 0;
      try { raw = parseInt(window.localStorage.getItem('dshcc.fps') || '', 10); } catch (err) { raw = 0; }
      if (!raw || raw < 30 || raw > 240) raw = 120;
      return raw;
    }
    var frameInterval = 1000 / fpsCap();
    var lastPaintAt = 0;

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
      /* rate limit: re-arm the rAF but skip the layout read until the cap allows it */
      if (now - lastPaintAt < frameInterval) {
        if (now < pumpUntil) schedule(); else pumpUntil = 0;
        return;
      }
      lastPaintAt = now;
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
        live.centerX = cardRect.left + cardRect.width / 2;
        var prev = live.lastCard;
        var deltaX = prev === null ? 0 : cardRect.left - prev.left;
        var deltaY = prev === null ? 0 : cardRect.top - prev.top;
        if (prev !== null) syncFollower(root, cardRect);
        live.lastCard = { left: cardRect.left, top: cardRect.top };
        followDockWith(cardRect, deltaX, deltaY, prev === null, now);
        return;
      }

      var anchor = live.anchor;
      if (anchor === null || anchor.width < 2) return;
      /* Deliberately NOT synced to the composer's live rect. A wallpaper engine
         moves the composer with a composited transform; JS can only observe that
         one or two frames late, so chasing it made the capsule trail behind and
         stutter. The capsule now keeps a cached column centre and stays put -
         independent, no per-frame rect read, no lag. It re-derives geometry on
         resize / mode change (anchor is refreshed whenever "full" paints). */
      var width = Math.min(200, Math.max(150, anchor.width - 24));
      var centerX = live.centerX === null ? window.innerWidth / 2 : live.centerX;
      var left = centerX - width / 2;
      left = Math.max(12, Math.min(window.innerWidth - width - 12, left));
      var bottom = 8;

      var element = mode === 'hidden' ? live.recall : live.mini;
      if (element === null) return;
      var probeWidth = mode === 'hidden' ? Math.min(width, element.offsetWidth || 200) : width;
      var probeLeft = mode === 'hidden' ? left + (width - probeWidth) / 2 : left;
      /* the hide button rides just outside the capsule's right edge */
      var hideSize = 26;
      var hideLeft = Math.min(probeLeft + probeWidth + 8, window.innerWidth - hideSize - 10);
      var styleKey = probeLeft.toFixed(1) + '|' + probeWidth.toFixed(1) + '|' + bottom + '|' + mode + '|' + hideLeft.toFixed(1);
      if (styleKey === live.styleKey) return;
      live.styleKey = styleKey;
      element.style.left = probeLeft + 'px';
      element.style.width = probeWidth + 'px';
      element.style.bottom = bottom + 'px';
      element.style.transform = 'none';
      if (mode === 'mini' && live.miniHide !== null) {
        live.miniHide.style.left = hideLeft + 'px';
        live.miniHide.style.bottom = (bottom + (38 - hideSize) / 2) + 'px';
      }
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
    var ICON_RECORD = 'M8 3.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2M8 6.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8';

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
        children.push(React.createElement(React.Fragment, { key: 'mini' },
        React.createElement('div', {
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
        ),
        /* the only control kept while collapsed: hide, right of the capsule */
        React.createElement('button', {
          ref: function (el) { live.miniHide = el; },
          type: 'button',
          className: 'dshcc-btn dshcc-mini-hide dshcc-glass-surface',
          title: '隐藏对话栏 (Ctrl+Shift+H)',
          onMouseDown: function (event) { event.preventDefault(); },
          onClick: function (event) { event.stopPropagation(); setMode('hidden'); },
        }, icon(ICON_HIDE))
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
        var key = String(event.key).toLowerCase();
        /* Ctrl+Alt+P also works: the app may claim Ctrl+Shift+P (command palette) */
        if (event.ctrlKey && event.altKey && key === 'p') {
          event.preventDefault();
          perfToggle();
          return;
        }
        if (!event.ctrlKey || !event.shiftKey) return;
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
        } else if (key === 'p') {
          event.preventDefault();
          perfToggle();
        }
      };
      window.addEventListener('keydown', onKey, true);
      disposers.push(function () { window.removeEventListener('keydown', onKey, true); });

      /* Opt-in frame/render probe. Ctrl+Shift+P records 20 s and downloads JSON. */
      window.__dshccPerf = {
        start: function (seconds) { return perfStart(seconds || PERF_SECONDS); },
        stop: function () { return perfStop(false); },
        report: function () { return perf.rec === null ? null : perfReport(perf.rec); },
        active: function () { return perf.active; },
      };
      disposers.push(function () {
        perfStop(true);
        if (window.__dshccPerf) delete window.__dshccPerf;
      });
      announceLoaded();

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

    /* ---- frame / render probe ------------------------------------------------
     * Ctrl+Shift+P starts a 20 s recording (press again to stop early). While it
     * runs it collects: rAF deltas, Event Timing (input -> processing duration),
     * long tasks, LoAF entries (which script blocked the frame), DOM mutation
     * volume per 250 ms bucket, our own mode changes and JS heap samples.
     * Stopping prints a console summary and downloads dshcc-perf-<stamp>.json.
     * Opt-in: nothing runs unless the hotkey is pressed.
     */
    var VERSION = '0.6.0';
    var PERF_SECONDS = 20;
    var PERF_EVENT_MIN = 16;

    function perfText(node) {
      if (node === null || node === undefined) return 'null';
      if (node.nodeType !== 1) return String(node.nodeName || node);
      var out = String(node.tagName).toLowerCase();
      if (node.id) out += '#' + node.id;
      var cls = String(node.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 3).join('.');
      if (cls) out += '.' + cls;
      var mark = node.getAttribute('role') || node.getAttribute('aria-label') || node.getAttribute('data-testid');
      if (mark) out += '[' + String(mark).slice(0, 40) + ']';
      return out;
    }

    function perfPct(sorted, p) {
      if (sorted.length === 0) return 0;
      var idx = Math.floor((sorted.length - 1) * p);
      if (idx < 0) idx = 0;
      if (idx > sorted.length - 1) idx = sorted.length - 1;
      return sorted[idx];
    }

    function perfStart(seconds) {
      if (perf.active) return null;
      var limit = (seconds || PERF_SECONDS) * 1000;
      var now = window.performance.now();
      var rec = {
        startedAt: new Date().toISOString(),
        t0: now,
        limit: limit,
        frames: [],
        events: [],
        tasks: [],
        loafs: [],
        inputs: [],
        buckets: [],
        modes: [],
        heap: [],
        obs: [],
        types: [],
        mutTop: {},
      };
      perf.rec = rec;
      perf.active = true;
      var cap = function (arr, max) { if (arr.length > max) arr.splice(0, arr.length - max); };

      /* frame deltas: one cheap rAF loop, capped so it cannot flood memory */
      var last = 0;
      var loop = function (ts) {
        if (!perf.active) return;
        if (last > 0) {
          rec.frames.push(Math.round((ts - last) * 10) / 10);
          cap(rec.frames, 8000);
        }
        last = ts;
        if (ts - rec.t0 >= rec.limit) { perfStop(false); return; }
        rec.raf = window.requestAnimationFrame(loop);
      };
      rec.raf = window.requestAnimationFrame(loop);

      /* performance observers, each optional: older Chromium lacks some types */
      var addObserver = function (type, options, handler) {
        try {
          var observer = new PerformanceObserver(handler);
          observer.observe(options);
          rec.obs.push(observer);
        } catch (error) { /* type unsupported here */ }
      };
      addObserver('longtask', { type: 'longtask', buffered: false }, function (list) {
        list.getEntries().forEach(function (entry) {
          rec.tasks.push({
            t: Math.round(entry.startTime),
            dur: Math.round(entry.duration),
            name: String(entry.name || ''),
            attr: (entry.attribution || []).map(function (a) { return String(a.name || '') + '/' + String(a.containerType || ''); }).join(','),
          });
          cap(rec.tasks, 2000);
        });
      });
      addObserver('event', { type: 'event', durationThreshold: PERF_EVENT_MIN, buffered: false }, function (list) {
        list.getEntries().forEach(function (entry) {
          rec.events.push({
            t: Math.round(entry.startTime),
            type: String(entry.name || ''),
            dur: Math.round(entry.duration),
            proc: Math.round((entry.processingEnd || entry.startTime) - (entry.processingStart || entry.startTime)),
            input: Math.round((entry.processingStart || entry.startTime) - entry.startTime),
            target: perfText(entry.target),
          });
          cap(rec.events, 3000);
        });
      });
      addObserver('long-animation-frame', { type: 'long-animation-frame', buffered: false }, function (list) {
        list.getEntries().forEach(function (entry) {
          var scripts = (entry.scripts || []).map(function (s) {
            return {
              fn: String(s.sourceFunctionName || ''),
              url: String(s.sourceURL || '').split('/').slice(-1)[0],
              invoker: String(s.invoker || ''),
              dur: Math.round(s.duration || 0),
              forced: Math.round(s.forcedStyleAndLayoutDuration || 0),
            };
          }).sort(function (a, b) { return b.dur - a.dur; }).slice(0, 6);
          rec.loafs.push({
            t: Math.round(entry.startTime),
            dur: Math.round(entry.duration),
            block: Math.round(entry.blockingDuration || 0),
            render: Math.round((entry.styleAndLayoutStart || 0) - (entry.renderStart || 0)),
            layout: Math.round((entry.startTime + entry.duration) - (entry.styleAndLayoutStart || 0)),
            scripts: scripts,
          });
          cap(rec.loafs, 400);
        });
      });

      /* DOM churn: how much the app re-renders, and where */
      try {
        rec.mo = new MutationObserver(function (records) {
          var at = window.performance.now();
          var index = Math.floor((at - rec.t0) / 250);
          while (rec.buckets.length < index) rec.buckets.push(0);
          rec.buckets[index] = (rec.buckets[index] || 0) + records.length;
          for (var i = 0; i < records.length && i < 60; i++) {
            var record = records[i];
            var key = perfText(record.target);
            var slot = rec.mutTop[key];
            if (!slot) { slot = { n: 0, add: 0, del: 0, attr: 0, text: 0 }; rec.mutTop[key] = slot; }
            slot.n += 1;
            if (record.type === 'attributes') slot.attr += 1;
            else if (record.type === 'characterData') slot.text += 1;
            slot.add += record.addedNodes ? record.addedNodes.length : 0;
            slot.del += record.removedNodes ? record.removedNodes.length : 0;
          }
        });
        rec.mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      } catch (error) { /* body not ready */ }

      /* raw input marks: the "what did I do" timeline */
      var inputTypes = ['pointerdown', 'pointerup', 'click', 'wheel', 'keydown', 'input', 'compositionstart', 'scroll'];
      rec.inputFn = function (event) {
        rec.inputs.push({ t: Math.round(window.performance.now()), type: event.type, target: perfText(event.target) });
        cap(rec.inputs, 4000);
      };
      inputTypes.forEach(function (type) {
        window.addEventListener(type, rec.inputFn, { capture: true, passive: true });
        rec.types.push(type);
      });

      /* our own mode transitions, for correlating with the spikes */
      var modeNow = null;
      rec.modeT = window.setInterval(function () {
        var root = document.querySelector('[data-dshcc-root]');
        var mode = root === null ? 'none' : String(root.getAttribute('data-dshcc-mode') || '');
        if (mode !== modeNow) {
          modeNow = mode;
          rec.modes.push({ t: Math.round(window.performance.now()), mode: mode });
        }
      }, 120);

      rec.heapT = window.setInterval(function () {
        var memory = window.performance && window.performance.memory;
        if (memory) rec.heap.push([Math.round(window.performance.now()), Math.round(memory.usedJSHeapSize / 1048576)]);
        cap(rec.heap, 600);
      }, 1000);

      if (perf.badge === null) {
        var badge = document.createElement('div');
        badge.setAttribute('data-dshcc-perf', '1');
        badge.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483647;padding:5px 9px;border-radius:9px;' +
          'font:11px/1.45 ui-monospace,Consolas,monospace;background:rgba(12,12,16,.84);color:#e9e9f2;' +
          'pointer-events:none;white-space:pre;box-shadow:0 2px 10px rgba(0,0,0,.35)';
        document.body.appendChild(badge);
        perf.badge = badge;
      }
      rec.badgeT = window.setInterval(function () {
        if (!perf.active) return;
        var recent = rec.frames.slice(-24);
        var sum = 0;
        for (var i = 0; i < recent.length; i++) sum += recent[i];
        var fps = sum > 0 ? Math.round((recent.length * 1000) / sum) : 0;
        var left = Math.max(0, Math.round((rec.limit - (window.performance.now() - rec.t0)) / 1000));
        perf.badge.textContent = 'REC ' + left + 's  ' + fps + ' fps\n' +
          'mut ' + (rec.buckets.length ? rec.buckets[rec.buckets.length - 1] : 0) + '  tasks ' + rec.tasks.length + '  loaf ' + rec.loafs.length;
      }, 200);
      return rec;
    }

    function perfReport(rec) {
      var frames = rec.frames.slice().sort(function (a, b) { return a - b; });
      var slow33 = 0, slow50 = 0, slow100 = 0;
      rec.frames.forEach(function (dt) { if (dt > 33.4) slow33 += 1; if (dt > 50) slow50 += 1; if (dt > 100) slow100 += 1; });
      var byEvent = rec.events.slice().sort(function (a, b) { return b.dur - a.dur; }).slice(0, 30);
      var byTask = rec.tasks.slice().sort(function (a, b) { return b.dur - a.dur; }).slice(0, 20);
      var byLoaf = rec.loafs.slice().sort(function (a, b) { return b.dur - a.dur; }).slice(0, 12);
      var hot = [];
      for (var key in rec.mutTop) hot.push({ target: key, n: rec.mutTop[key].n, add: rec.mutTop[key].add, del: rec.mutTop[key].del, attr: rec.mutTop[key].attr, text: rec.mutTop[key].text });
      hot.sort(function (a, b) { return b.n - a.n; });
      var inputCount = {};
      rec.inputs.forEach(function (input) { inputCount[input.type] = (inputCount[input.type] || 0) + 1; });
      var peakBucket = 0, peakIndex = -1;
      rec.buckets.forEach(function (value, index) { if (value > peakBucket) { peakBucket = value; peakIndex = index; } });
      return {
        plugin: 'dsh-composer-collapse perf probe',
        startedAt: rec.startedAt,
        seconds: Math.round((window.performance.now() - rec.t0) / 100) / 10,
        viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
        userAgent: navigator.userAgent,
        fps: {
          frames: rec.frames.length,
          p50ms: perfPct(frames, 0.5),
          p95ms: perfPct(frames, 0.95),
          p99ms: perfPct(frames, 0.99),
          worstms: frames.length ? frames[frames.length - 1] : 0,
          medianFps: perfPct(frames, 0.5) > 0 ? Math.round(10000 / perfPct(frames, 0.5)) / 10 : 0,
          slowOver33ms: slow33,
          slowOver50ms: slow50,
          slowOver100ms: slow100,
        },
        longTasks: { count: rec.tasks.length, totalMs: rec.tasks.reduce(function (sum, t) { return sum + t.dur; }, 0), worst: byTask },
        events: { count: rec.events.length, slowest: byEvent },
        loaf: { count: rec.loafs.length, worst: byLoaf },
        mutations: { per250ms: rec.buckets, peak: peakBucket, peakAtMs: peakIndex < 0 ? -1 : peakIndex * 250, hotspots: hot.slice(0, 15) },
        inputs: { counts: inputCount, timeline: rec.inputs.slice(0, 600) },
        modes: rec.modes,
        heapMB: rec.heap,
      };
    }

    function perfStop(silent) {
      if (!perf.active) return null;
      var rec = perf.rec;
      perf.active = false;
      window.cancelAnimationFrame(rec.raf);
      window.clearInterval(rec.modeT);
      window.clearInterval(rec.heapT);
      window.clearInterval(rec.badgeT);
      rec.obs.forEach(function (observer) { try { observer.disconnect(); } catch (error) { /* gone */ } });
      if (rec.mo) rec.mo.disconnect();
      rec.types.forEach(function (type) {
        window.removeEventListener(type, rec.inputFn, { capture: true });
      });
      if (perf.badge !== null) {
        if (perf.badge.parentNode) perf.badge.parentNode.removeChild(perf.badge);
        perf.badge = null;
      }
      var report = perfReport(rec);
      if (silent === true) return report;
      try {
        console.group('[dshcc perf] ' + report.seconds + 's, median ' + report.fps.medianFps + ' fps, ' +
          report.fps.slowOver50ms + ' frames over 50ms, ' + report.longTasks.count + ' long tasks');
        console.log('fps', report.fps);
        console.table(report.events.slowest.map(function (e) { return { t: e.t, type: e.type, dur: e.dur, proc: e.proc, target: e.target }; }));
        console.table(report.longTasks.worst.map(function (e) { return { t: e.t, dur: e.dur, name: e.name }; }));
        console.table(report.mutations.hotspots.map(function (e) { return { target: e.target, n: e.n, add: e.add, del: e.del, attr: e.attr }; }));
        console.groupEnd();
      } catch (error) { /* console closed */ }
      var json = JSON.stringify(report, null, 2);
      copyReport(json);
      var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      try {
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'dshcc-perf-' + stamp + '.json';
        document.body.appendChild(link);
        link.click();
        window.setTimeout(function () {
          URL.revokeObjectURL(url);
          if (link.parentNode) link.parentNode.removeChild(link);
        }, 3000);
      } catch (error) { /* download blocked */ }
      return report;
    }

    /**
     * The download can be silent or blocked depending on the shell, so the report
     * also goes to the clipboard: paste it straight into the chat.
     */
    function copyReport(json) {
      var done = function () { toast('帧率报告已复制到剪贴板 · 直接粘贴到对话里即可（也会下载 JSON）'); };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(json).then(done, function () { legacyCopy(json, done); });
          return;
        }
      } catch (error) { /* fall through */ }
      legacyCopy(json, done);
    }

    function legacyCopy(json, done) {
      try {
        var area = document.createElement('textarea');
        area.value = json;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.appendChild(area);
        area.select();
        var ok = document.execCommand && document.execCommand('copy');
        if (area.parentNode) area.parentNode.removeChild(area);
        if (ok) done();
        else toast('报告太大，复制失败：请到下载文件夹取 dshcc-perf-*.json');
      } catch (error) { toast('报告复制失败：请到下载文件夹取 dshcc-perf-*.json'); }
    }

    var toastTimer = null;

    function toast(text) {
      try {
        if (!document.body) return;
        var el = document.getElementById('dshcc-toast');
        if (el !== null && el.parentNode) el.parentNode.removeChild(el);
        el = document.createElement('div');
        el.id = 'dshcc-toast';
        el.setAttribute('data-dshcc-chrome', '');
        el.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:2147483647;' +
          'padding:7px 12px;border-radius:10px;font:12.5px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;' +
          'background:rgba(12,12,16,.88);color:#f0f0f7;box-shadow:0 4px 16px rgba(0,0,0,.4);transition:opacity .3s ease';
        el.textContent = text;
        document.body.appendChild(el);
        if (toastTimer !== null) window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(function () {
          el.style.opacity = '0';
          window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
        }, 6000);
      } catch (error) { /* ignore */ }
    }

    /* one short toast per page load: proves which build is live and how to record */
    function announceLoaded() {
      try {
        if (!document.body) return;
        var tip = document.createElement('div');
        tip.setAttribute('data-dshcc-chrome', '');
        tip.style.cssText = 'position:fixed;left:12px;bottom:56px;z-index:2147483646;padding:6px 10px;border-radius:10px;' +
          'font:12px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:rgba(12,12,16,.84);color:#ececf3;' +
          'pointer-events:none;transition:opacity .35s ease;box-shadow:0 2px 10px rgba(0,0,0,.3)';
        tip.textContent = 'composer-collapse ' + VERSION + ' 已加载 · Ctrl+Shift+H 隐藏 · Ctrl+Alt+P 录帧';
        document.body.appendChild(tip);
        window.setTimeout(function () { tip.style.opacity = '0'; }, 3600);
        window.setTimeout(function () { if (tip.parentNode) tip.parentNode.removeChild(tip); }, 4200);
      } catch (error) { /* ignore */ }
    }

    function perfToggle() {
      if (perf.active) perfStop(false);
      else perfStart(PERF_SECONDS);
    }

    exports.apply = apply;
    exports.inject = ['slots'];
    return module.exports;
  },
});
