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
    background-color: ${FRENNIX_WEB_BACKGROUND};
  }
  body {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100dvh;
    min-height: -webkit-fill-available;
    margin: 0;
    background-color: ${FRENNIX_WEB_BACKGROUND};
    overflow: hidden;
  }
  #root {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 100%;
    min-height: 0;
    background-color: ${FRENNIX_WEB_BACKGROUND};
    pointer-events: auto;
  }
  /* Resilient authenticated tab shell — cannot collapse to 0px on WebKit/PWA. */
  #app-root-shell,
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
    min-height: 0 !important;
    overflow: hidden !important;
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
  }
  #feed-scroll-list,
  #discover-scroll,
  #calendar-scroll {
    flex: 1 1 auto !important;
    min-height: 0 !important;
    overflow-y: auto !important;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
  }
  /* Tab bar + home-indicator safe area — never show default white. */
  [role="tablist"] {
    background-color: ${FRENNIX_WEB_SURFACE} !important;
  }
  [data-testid="tab-bar-background"] {
    background-color: ${FRENNIX_WEB_SURFACE} !important;
  }
  /* Auth inputs — Safari dark mode + autofill must stay readable. */
  input,
  textarea,
  [contenteditable="true"] {
    color: #fafafa !important;
    background-color: #141416 !important;
    -webkit-text-fill-color: #fafafa !important;
    caret-color: #fafafa;
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
