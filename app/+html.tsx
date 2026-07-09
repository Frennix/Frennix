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
  function hideBootShell() {
    var el = document.getElementById("frennix-boot-shell");
    if (el) el.style.display = "none";
  }
  function startupReady() {
    if (document.getElementById("auth-login-screen")) return true;
    if (document.getElementById("startup-retry-screen")) return true;
    if (document.getElementById("login-failure-screen")) return true;
    var trace = window.__FRENNIX_MOUNT_TRACE__;
    if (!trace || !trace.length) return false;
    return trace.some(function (e) {
      return e.id === "stack:mounted" || e.id === "index-route:mounted" || e.id === "auth-login:mounted";
    });
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
