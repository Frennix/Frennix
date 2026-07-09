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
    pointer-events: auto;
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
  frennixWebDocumentCss,
};
