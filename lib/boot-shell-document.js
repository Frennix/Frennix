/** Shared splash / boot shell markup for web (dev +html.tsx and production patch-web-html). */

const FRENNIX_SPLASH_BACKGROUND = "#000000";
const FRENNIX_SPLASH_LOGO_PATH = "/brand/frennix-splash-logo.png";

const bootShellCss = `
  #frennix-boot-shell {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${FRENNIX_SPLASH_BACKGROUND};
    opacity: 1;
    transition: opacity 320ms ease-out;
    pointer-events: auto;
  }
  #frennix-boot-shell.frennix-boot-shell--hiding {
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
  }
  #frennix-boot-shell[data-hiding="true"],
  #frennix-boot-shell[aria-hidden="true"] {
    pointer-events: none !important;
    visibility: hidden !important;
  }
  #frennix-boot-shell .frennix-boot-shell-logo {
    display: block;
    width: min(44vw, 200px);
    height: auto;
    max-height: 28vh;
    object-fit: contain;
    user-select: none;
    -webkit-user-drag: none;
  }
  #frennix-boot-shell[style*="display: none"],
  #frennix-boot-shell[hidden] {
    display: none !important;
    pointer-events: none !important;
  }`;

const bootShellHtml = `
    <div id="frennix-boot-shell" aria-live="polite" aria-busy="true" aria-label="Frennix">
      <img
        class="frennix-boot-shell-logo"
        src="${FRENNIX_SPLASH_LOGO_PATH}"
        alt=""
        decoding="async"
        fetchpriority="high"
      />
    </div>`;

const splashHeadTags = `
    <link rel="preload" href="${FRENNIX_SPLASH_LOGO_PATH}" as="image" type="image/png" />
    <link rel="apple-touch-startup-image" href="${FRENNIX_SPLASH_LOGO_PATH}" />`;

const HIDE_BOOT_SHELL_FN = `
  function hideBootShell() {
    var el = document.getElementById("frennix-boot-shell");
    if (!el || el.getAttribute("data-hiding") === "true") return;
    el.setAttribute("data-hiding", "true");
    el.classList.add("frennix-boot-shell--hiding");
    el.setAttribute("aria-busy", "false");
    el.style.pointerEvents = "none";
    el.style.visibility = "hidden";
    var done = function () {
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
    };
    el.addEventListener("transitionend", done, { once: true });
    setTimeout(done, 450);
    var failure = document.getElementById("frennix-startup-failure-overlay");
    if (failure) failure.remove();
  }`;

function buildBootShellScript({ supabaseUrl = "", anonKey = "" } = {}) {
  return `
    <script id="frennix-boot-shell-script">
(function () {
  var STALL_MS = 5000;
  var cfg = {
    supabaseUrl: ${JSON.stringify(supabaseUrl)},
    anonKey: ${JSON.stringify(anonKey)}
  };

  function readAuth() {
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && key.indexOf("auth-token") !== -1) {
          var data = JSON.parse(localStorage.getItem(key) || "{}");
          return {
            hasToken: !!data.access_token,
            userId: data.user && data.user.id,
            email: data.user && data.user.email,
            accessToken: data.access_token
          };
        }
      }
    } catch (e) {}
    return { hasToken: false };
  }

  function elementVisible(id, minHeight) {
    var el = document.getElementById(id);
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    var style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) < 0.05) return false;
    return rect.height >= minHeight && rect.width >= 20;
  }

  function feedDestinationReady() {
    if (elementVisible("feed-scroll-list", 60)) return true;
    return false;
  }

  function markerVisible(id, minHeight) {
    return elementVisible(id, minHeight || 40);
  }

  function visibleDestination() {
    if (feedDestinationReady()) return true;
    var markers = [
      ["auth-login-screen", 200],
      ["startup-retry-screen", 200],
      ["login-failure-screen", 120],
      ["onboarding-screen", 120],
      ["web-authenticated-startup-fallback", 120],
      ["frennix-startup-failure-overlay", 120],
      ["create-post-screen", 120],
      ["notifications-screen", 120],
      ["founder-dashboard-screen", 120]
    ];
    for (var i = 0; i < markers.length; i++) {
      if (markerVisible(markers[i][0], markers[i][1])) return true;
    }
    return false;
  }

  function collectInlineDiag(reason) {
    var auth = readAuth();
    var trace = window.__FRENNIX_MOUNT_TRACE__ || [];
    return {
      at: new Date().toISOString(),
      reason: reason,
      route: location.pathname,
      href: location.href,
      auth: { hasToken: auth.hasToken, userId: auth.userId, email: auth.email },
      mount_trace_tail: trace.slice(-12).map(function (e) { return e.id; }),
      body_preview: String(document.body.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 240),
      user_agent: navigator.userAgent
    };
  }

  function sendInlineReport(diag) {
    if (!cfg.supabaseUrl || !cfg.anonKey || !diag.auth.userId || !diag.auth.hasToken) return;
    var token = readAuth().accessToken;
    if (!token) return;
    var payload = {
      user_id: diag.auth.userId,
      type: "crash",
      status: "new",
      priority: "critical",
      message: "[inline-startup] " + diag.reason,
      screen_path: diag.route,
      metadata: diag
    };
    fetch(cfg.supabaseUrl + "/rest/v1/beta_feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: cfg.anonKey,
        Authorization: "Bearer " + token,
        Prefer: "return=minimal"
      },
      body: JSON.stringify(payload)
    }).catch(function () {});
  }

  function showInlineFailure(diag) {
    if (document.getElementById("frennix-startup-failure-overlay")) return;
    var overlay = document.createElement("div");
    overlay.id = "frennix-startup-failure-overlay";
    overlay.setAttribute("role", "alert");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#0A0A0B;padding:20px;";
    overlay.innerHTML =
      '<div style="max-width:360px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif">' +
      '<div style="font-size:18px;font-weight:700">Account loading stalled</div>' +
      '<div style="font-size:14px;opacity:0.85;line-height:20px">We\\'re having trouble loading your account. Please retry or log out.</div>' +
      '<div style="font-size:12px;opacity:0.75">Diagnostic report sent automatically. Tap Copy report to share with support.</div>' +
      '<button id="frennix-inline-copy" style="padding:10px 16px;border-radius:8px;border:none;background:#c8ff00;color:#0a0a0b;font-weight:700">Copy report</button>' +
      '<button id="frennix-inline-retry" style="padding:10px 16px;border-radius:8px;border:1px solid #444;background:transparent;color:#f5f5f5">Retry</button>' +
      "</div>";
    document.body.appendChild(overlay);
    var copyBtn = document.getElementById("frennix-inline-copy");
    if (copyBtn) {
      copyBtn.onclick = function () {
        var text = JSON.stringify(diag, null, 2);
        if (navigator.clipboard) navigator.clipboard.writeText(text);
      };
    }
    var retryBtn = document.getElementById("frennix-inline-retry");
    if (retryBtn) retryBtn.onclick = function () { location.reload(); };
  }

  ${HIDE_BOOT_SHELL_FN}

  function signedOutReady() {
    if (markerVisible("auth-login-screen", 200)) return true;
    if (markerVisible("startup-retry-screen", 200)) return true;
    if (markerVisible("login-failure-screen", 120)) return true;
    return false;
  }

  function startupReady() {
    if (visibleDestination()) return true;
    if (readAuth().hasToken) return false;
    return signedOutReady();
  }

  var stallTimer = setTimeout(function () {
    var auth = readAuth();
    if (!auth.hasToken) return;
    if (visibleDestination()) return;
    var diag = collectInlineDiag("post-login black screen before React destination");
    try { sessionStorage.setItem("frennix:inline-startup-diag", JSON.stringify(diag)); } catch (e) {}
    sendInlineReport(diag);
    showInlineFailure(diag);
  }, STALL_MS);

  var iv = setInterval(function () {
    if (startupReady()) {
      hideBootShell();
      clearInterval(iv);
      clearTimeout(stallTimer);
    }
  }, 150);
})();</script>`;
}

/** Lightweight boot script for Expo dev (+html.tsx) when env credentials are unavailable. */
function buildDevBootShellScript() {
  return `
(function () {
  function elementVisible(id, minHeight) {
    var el = document.getElementById(id);
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    var style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) < 0.05) return false;
    return rect.height >= minHeight && rect.width >= 20;
  }
  ${HIDE_BOOT_SHELL_FN}
  function startupReady() {
    var markers = [
      ["auth-login-screen", 200],
      ["startup-retry-screen", 200],
      ["login-failure-screen", 120],
      ["onboarding-screen", 120],
      ["web-authenticated-startup-fallback", 120],
      ["frennix-startup-failure-overlay", 120],
      ["create-post-screen", 120],
      ["notifications-screen", 120],
      ["founder-dashboard-screen", 120]
    ];
    for (var i = 0; i < markers.length; i++) {
      if (elementVisible(markers[i][0], markers[i][1])) return true;
    }
    if (elementVisible("feed-scroll-list", 60)) return true;
    return false;
  }
  var iv = setInterval(function () {
    if (startupReady()) {
      hideBootShell();
      clearInterval(iv);
    }
  }, 150);
})();`;
}

module.exports = {
  FRENNIX_SPLASH_BACKGROUND,
  FRENNIX_SPLASH_LOGO_PATH,
  bootShellCss,
  bootShellHtml,
  splashHeadTags,
  buildBootShellScript,
  buildDevBootShellScript,
};
