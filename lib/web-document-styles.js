/** Shared document-level CSS for Safari / RN Web (dev + production export). */
const FRENNIX_WEB_BACKGROUND = "#0A0A0B";
const FRENNIX_WEB_SURFACE = "#141416";

const frennixWebDocumentCss = `
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
    pointer-events: none;
  }
  /* Tab bar + home-indicator safe area — never show default white. */
  [role="tablist"] {
    background-color: ${FRENNIX_WEB_SURFACE} !important;
  }
  [data-testid="tab-bar-background"] {
    background-color: ${FRENNIX_WEB_SURFACE} !important;
  }
`;

module.exports = {
  FRENNIX_WEB_BACKGROUND,
  FRENNIX_WEB_SURFACE,
  frennixWebDocumentCss,
};
