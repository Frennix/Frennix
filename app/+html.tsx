import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";
import { frennixWebDocumentCss, FRENNIX_WEB_BACKGROUND } from "@/lib/web-document-styles";

const bootShellCss = `
  #frennix-boot-shell {
    position: fixed;
    inset: 0;
    z-index: 2147483646;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    background: ${FRENNIX_WEB_BACKGROUND};
    color: #f5f5f5;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  #frennix-boot-shell .spinner {
    width: 28px;
    height: 28px;
    border: 3px solid rgba(255,255,255,0.15);
    border-top-color: #c8ff00;
    border-radius: 50%;
    animation: frennix-spin 0.9s linear infinite;
  }
  @keyframes frennix-spin { to { transform: rotate(360deg); } }
`;

const bootShellScript = `
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
  function hideBootShell() {
    var el = document.getElementById("frennix-boot-shell");
    if (el) el.style.display = "none";
  }
  function startupReady() {
    var markers = [
      ["auth-login-screen", 200],
      ["startup-retry-screen", 200],
      ["login-failure-screen", 120],
      ["onboarding-screen", 120],
      ["web-authenticated-startup-fallback", 120],
      ["frennix-startup-failure-overlay", 120]
    ];
    for (var i = 0; i < markers.length; i++) {
      if (elementVisible(markers[i][0], markers[i][1])) return true;
    }
    if (elementVisible("feed-scroll-list", 60)) return true;
    if (elementVisible("feed-root-container", 100)) return true;
    return false;
  }
  var iv = setInterval(function () {
    if (startupReady()) {
      hideBootShell();
      clearInterval(iv);
    }
  }, 150);
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (!startupReady()) {
        var stalled = document.getElementById("frennix-boot-shell-stalled");
        if (stalled) stalled.style.display = "block";
      }
    }, 15000);
  });
})();`;

/**
 * Web document shell. Keeps Expo's body overflow:hidden (FlatList scrolls internally)
 * and adds Safari-friendly viewport + flex min-height fixes for nested scroll.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content={FRENNIX_WEB_BACKGROUND} />
        <meta name="color-scheme" content="dark" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Frennix" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <ScrollViewStyleReset />
        <style id="frennix-web-scroll">{frennixWebDocumentCss}</style>
        <style id="frennix-boot-shell-css">{bootShellCss}</style>
      </head>
      <body>
        <div id="frennix-boot-shell" aria-live="polite" aria-busy="true">
          <div class="spinner" />
          <div>Loading Frennix…</div>
          <div id="frennix-boot-shell-stalled" style={{ display: "none", fontSize: 13, opacity: 0.75 }}>
            Still loading — check your connection or reopen the app.
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: bootShellScript }} />
        {children}
      </body>
    </html>
  );
}
