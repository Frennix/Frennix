/** Shared document-level CSS for Safari / RN Web (dev + production export). */
const FRENNIX_WEB_BACKGROUND = "#0A0A0B";
const FRENNIX_WEB_SURFACE = "#141416";

/** App chrome below the viewport top (RN header + bottom tab bar). */
const FRENNIX_TAB_CHROME_PX = 108;

const frennixWebDocumentCss = `
  :root {
    --frennix-tab-header-h: 52px;
    --frennix-tab-bar-h: 56px;
    --frennix-tab-chrome-h: ${FRENNIX_TAB_CHROME_PX}px;
    --frennix-tab-scene-min-h: max(240px, calc(100dvh - var(--frennix-tab-chrome-h)));
    --frennix-tab-scene-min-h-svh: max(240px, calc(100svh - var(--frennix-tab-chrome-h)));
  }
  html {
    height: 100%;
    height: -webkit-fill-available;
    min-height: 100%;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 0;
    padding: 0;
    overflow-x: hidden;
    overscroll-behavior-x: none;
    box-sizing: border-box;
    background-color: ${FRENNIX_WEB_BACKGROUND};
  }
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }
  body {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100dvh;
    min-height: -webkit-fill-available;
    margin: 0;
    padding: 0;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    overflow-x: hidden;
    overscroll-behavior-x: none;
    background-color: ${FRENNIX_WEB_BACKGROUND};
    overflow: hidden;
  }
  #root {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    margin: 0;
    padding: 0;
    height: 100%;
    min-height: 100%;
    min-height: 0;
    overflow-x: hidden;
    overscroll-behavior-x: none;
    box-sizing: border-box;
    background-color: ${FRENNIX_WEB_BACKGROUND};
    pointer-events: auto;
  }
  #app-root-shell {
    position: relative !important;
    flex: 1 1 auto !important;
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    height: 100% !important;
    max-height: 100% !important;
    min-height: 0 !important;
    overflow: hidden !important;
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
  }
  /*
   * RN stack scene flex column: contentStyle wrapper (empty, min-height:100%) must not
   * sit above screen content and push #feed-tab-scene to top:~100vh (black screen).
   */
  #app-root-shell .r-ifefl9 > .r-13qz1uu:empty {
    display: none !important;
    flex: 0 0 0 !important;
    min-height: 0 !important;
    height: 0 !important;
    max-height: 0 !important;
    overflow: hidden !important;
    pointer-events: none !important;
  }
  /* Resilient authenticated tab shell — cannot collapse to 0px on WebKit/PWA. */
  #feed-tab-scene {
    flex: 1 1 auto !important;
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    min-height: var(--frennix-tab-scene-min-h) !important;
    min-height: var(--frennix-tab-scene-min-h-svh) !important;
    overflow: hidden !important;
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
  }
  #feed-root-container,
  #feed-scroll-shell {
    flex: 1 1 auto !important;
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    min-height: max(200px, calc(100dvh - var(--frennix-tab-chrome-h) - var(--frennix-tab-header-h))) !important;
    overflow: hidden !important;
    overflow-x: hidden !important;
    box-sizing: border-box !important;
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
  }
  #feed-scroll-list,
  #discover-scroll,
  #calendar-scroll {
    flex: 1 1 auto !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    min-height: 0 !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    box-sizing: border-box !important;
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
  }
  #feed-search-section,
  #feed-search-bar {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow-x: hidden !important;
    box-sizing: border-box !important;
  }
  #discover-scroll [data-focusable="true"],
  #discover-scroll input,
  #discover-scroll textarea {
    max-width: 100% !important;
    box-sizing: border-box !important;
  }
  #feed-search-overlay {
    position: fixed !important;
    inset: 0 !important;
    width: 100% !important;
    max-width: 100% !important;
    height: 100dvh !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    box-sizing: border-box !important;
    z-index: 9999 !important;
    background-color: #0B0B0D !important;
  }
  /* Tab bar + home-indicator safe area — never show default white. */
  [role="tablist"] {
    background-color: ${FRENNIX_WEB_SURFACE} !important;
  }
  [data-testid="tab-bar-background"] {
    background-color: ${FRENNIX_WEB_SURFACE} !important;
  }
  /* Auth inputs — Safari dark mode + autofill must stay readable. */
  input:not([role="switch"]),
  textarea,
  [contenteditable="true"] {
    color: #fafafa !important;
    background-color: #141416 !important;
    -webkit-text-fill-color: #fafafa !important;
    caret-color: #fafafa;
  }
  input[role="switch"] {
    cursor: pointer;
    touch-action: manipulation;
  }
  input::placeholder,
  textarea::placeholder {
    color: #71717a !important;
    opacity: 1;
  }
  input:-webkit-autofill,
  input:-webkit-autofill:hover,
  input:-webkit-autofill:focus,
  textarea:-webkit-autofill,
  textarea:-webkit-autofill:hover,
  textarea:-webkit-autofill:focus {
    -webkit-text-fill-color: #fafafa !important;
    -webkit-box-shadow: 0 0 0 1000px #141416 inset !important;
    box-shadow: 0 0 0 1000px #141416 inset !important;
    transition: background-color 99999s ease-out 0s;
  }
  #frennix-boot-shell[style*="display: none"],
  #frennix-boot-shell[hidden] {
    display: none !important;
    pointer-events: none !important;
  }
  #auth-login-screen,
  #startup-retry-screen,
  #login-failure-screen {
    min-height: 100dvh;
    min-height: -webkit-fill-available;
  }
`;

module.exports = {
  FRENNIX_WEB_BACKGROUND,
  FRENNIX_WEB_SURFACE,
  FRENNIX_TAB_CHROME_PX,
  frennixWebDocumentCss,
};
