/** Shared document-level CSS for Safari / RN Web (dev + production export). */
const FRENNIX_WEB_BACKGROUND = "#0A0A0B";
const FRENNIX_WEB_SURFACE = "#141416";

/** App chrome below the viewport top (RN header + bottom tab bar). */
const FRENNIX_TAB_HEADER_BASE_PX = 92;
const FRENNIX_TAB_BAR_BASE_PX = 56;
const FRENNIX_TAB_CHROME_PX = FRENNIX_TAB_HEADER_BASE_PX + FRENNIX_TAB_BAR_BASE_PX;

const frennixWebDocumentCss = `
  :root {
    --frennix-safe-top: env(safe-area-inset-top, 0px);
    --frennix-safe-bottom: env(safe-area-inset-bottom, 0px);
    --frennix-tab-header-h: calc(${FRENNIX_TAB_HEADER_BASE_PX}px + var(--frennix-safe-top));
    --frennix-tab-bar-h: calc(${FRENNIX_TAB_BAR_BASE_PX}px + var(--frennix-safe-bottom));
    --frennix-tab-chrome-h: calc(var(--frennix-tab-header-h) + var(--frennix-tab-bar-h));
    --frennix-safari-bottom-chrome: 0px;
    --frennix-feed-scroll-bottom-pad: calc(
      var(--frennix-tab-bar-h) + var(--frennix-safari-bottom-chrome) + 28px + 8px
    );
    --frennix-tab-scene-min-h: max(240px, calc(100dvh - var(--frennix-tab-chrome-h)));
    --frennix-tab-scene-min-h-svh: max(240px, calc(100svh - var(--frennix-tab-chrome-h)));
  }
  html {
    height: 100%;
    height: -webkit-fill-available;
    min-height: 100%;
    max-width: 100%;
    overflow-x: hidden;
    background-color: ${FRENNIX_WEB_BACKGROUND};
  }
  body {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 100dvh;
    min-height: -webkit-fill-available;
    max-width: 100%;
    overflow-x: hidden;
    margin: 0;
    background-color: ${FRENNIX_WEB_BACKGROUND};
    overflow: hidden;
  }
  #root {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    width: 100%;
    max-width: 100%;
    height: 100%;
    min-height: 100%;
    min-height: 0;
    overflow-x: hidden;
    background-color: ${FRENNIX_WEB_BACKGROUND};
    pointer-events: auto;
  }
  #app-root-shell {
    position: relative !important;
    flex: 1 1 auto !important;
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    max-width: 100% !important;
    height: 100% !important;
    max-height: 100% !important;
    min-height: 0 !important;
    overflow-x: hidden !important;
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
  /* Feed tab sticky header — clip greeting block and respect iOS safe area. */
  #app-root-shell [role="banner"] {
    flex-shrink: 0 !important;
    overflow: hidden !important;
    z-index: 30 !important;
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
    padding-top: env(safe-area-inset-top, 0px) !important;
    min-height: calc(${FRENNIX_TAB_HEADER_BASE_PX}px + env(safe-area-inset-top, 0px)) !important;
  }
  #frennix-feed-header-title {
    max-width: 100% !important;
    overflow: hidden !important;
  }
  [data-frennix-feed-media-frame="portrait"] {
    width: 100% !important;
    max-width: none !important;
    aspect-ratio: 4 / 5 !important;
  }
  [data-frennix-feed-media-frame="square"] {
    width: 100% !important;
    max-width: none !important;
    aspect-ratio: 1 / 1 !important;
  }
  [data-frennix-feed-media-frame="landscape"] {
    width: 100% !important;
    max-width: none !important;
  }
  #feed-root-container,
  #feed-scroll-shell {
    flex: 1 1 0 !important;
    display: flex !important;
    flex-direction: column !important;
    width: 100% !important;
    min-height: max(200px, calc(100dvh - var(--frennix-tab-chrome-h) - var(--frennix-tab-header-h))) !important;
    max-height: 100% !important;
    overflow: hidden !important;
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
  }
  /*
   * Safari / iOS PWA: scrollport must be a bounded flex child (flex-basis 0 + height 0),
   * display:block, and no compositor transform — otherwise touch pan-y never moves scrollTop.
   */
  #feed-scroll-list,
  #discover-scroll,
  #calendar-scroll {
    flex: 1 1 0 !important;
    height: 0 !important;
    min-height: 0 !important;
    max-height: 100% !important;
    overflow-y: scroll !important;
    -webkit-overflow-scrolling: touch !important;
    touch-action: pan-y !important;
    display: block !important;
    transform: none !important;
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
  }
  /* Home feed — keep captions/workout details above fixed tab bar + Safari toolbar. */
  #feed-scroll-list > div {
    padding-bottom: var(--frennix-feed-scroll-bottom-pad) !important;
  }
  /* Feed inline video — keep speaker control above poster/video on WebKit. */
  .feed-video-mute-layer {
    position: absolute !important;
    inset: 0 !important;
    z-index: 50 !important;
    pointer-events: none !important;
  }
  .feed-video-mute-button {
    position: absolute !important;
    right: 14px !important;
    bottom: 14px !important;
    z-index: 51 !important;
    pointer-events: auto !important;
  }
  /* Inline feed video must not capture taps — route link opens the dedicated viewer. */
  video.feed-inline-video {
    pointer-events: none !important;
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    object-fit: cover !important;
    object-position: center !important;
  }
  a.feed-video-route-link {
    position: absolute !important;
    inset: 0 !important;
    z-index: 2 !important;
    touch-action: pan-y !important;
    pointer-events: auto !important;
    cursor: pointer;
    text-decoration: none;
    color: transparent;
  }
  a.feed-video-expand-button {
    position: absolute !important;
    top: 14px !important;
    left: 14px !important;
    z-index: 52 !important;
    pointer-events: auto !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 36px !important;
    height: 36px !important;
    border-radius: 18px !important;
    background-color: rgba(0, 0, 0, 0.55) !important;
    text-decoration: none !important;
  }
  /* Fullscreen lightbox — native controls must never appear; Frennix renders its own UI. */
  video.fullscreen-video-slide::-webkit-media-controls {
    display: none !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
  video.fullscreen-video-slide::-webkit-media-controls-enclosure {
    display: none !important;
  }
  .fullscreen-video-mute-button {
    pointer-events: auto !important;
  }
  .fullscreen-video-mute-button.fullscreen-chrome-hidden {
    opacity: 0 !important;
    pointer-events: none !important;
  }
  .fullscreen-video-scrubber {
    width: 100%;
    height: 28px;
    margin: 0;
    background: transparent;
    accent-color: #22c55e;
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
  textarea:not([data-frennix-comment-input="true"]),
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
  /*
   * iOS Safari auto-zooms focused inputs below 16px — keep comment composers at 16px on the
   * actual RN Web textarea/input, not a scaled wrapper.
   */
  [data-frennix-comments-sheet="true"] textarea,
  [data-frennix-comments-sheet="true"] input,
  textarea[data-frennix-comment-input="true"],
  input[data-frennix-comment-input="true"] {
    font-size: 16px !important;
    line-height: 22px !important;
    transform: none !important;
    zoom: normal !important;
  }
  textarea[data-frennix-comment-input="true"] {
    overflow-x: hidden !important;
    resize: none !important;
    box-sizing: border-box !important;
    min-width: 0 !important;
    max-width: 100% !important;
    width: 100% !important;
    margin: 0 !important;
    padding-top: 8px !important;
    padding-bottom: 8px !important;
    padding-left: 14px !important;
    padding-right: 14px !important;
    text-indent: 0 !important;
    border: none !important;
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    -webkit-appearance: none !important;
    appearance: none !important;
    -webkit-background-clip: padding-box !important;
    -webkit-overflow-scrolling: touch !important;
  }
  [data-frennix-comment-composer-field="true"] textarea[data-frennix-comment-input="true"],
  [data-frennix-comments-sheet="true"] textarea[data-frennix-comment-input="true"] {
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
  }
  [data-frennix-comment-input-wrap="true"],
  [data-frennix-comment-input-wrap="true"] > * {
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
  }
  [data-frennix-comment-composer-row="true"] {
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    overflow-x: hidden !important;
    overflow-y: visible !important;
  }
  textarea[data-frennix-comment-input="true"]::placeholder {
    color: #71717a !important;
    opacity: 1 !important;
  }
  textarea[data-frennix-comment-input="true"]:-webkit-autofill,
  textarea[data-frennix-comment-input="true"]:-webkit-autofill:hover,
  textarea[data-frennix-comment-input="true"]:-webkit-autofill:focus {
    -webkit-text-fill-color: #fafafa !important;
    -webkit-box-shadow: 0 0 0 1000px transparent inset !important;
    box-shadow: none !important;
    background-color: transparent !important;
  }
  textarea[data-frennix-chat-input="true"] {
    font-size: 16px !important;
    line-height: 22px !important;
    overflow-y: hidden !important;
    resize: none !important;
    box-sizing: border-box !important;
    -webkit-overflow-scrolling: touch !important;
    transform: none !important;
    zoom: normal !important;
  }
  /* Full-screen mobile web comments — opaque surface, no feed bleed-through. */
  [data-frennix-comments-fullscreen="true"] {
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
    opacity: 1 !important;
  }
  [data-frennix-comments-fullscreen="true"] textarea:not([data-frennix-comment-input="true"]),
  [data-frennix-comments-fullscreen="true"] input:not([data-frennix-comment-input="true"]) {
    background-color: ${FRENNIX_WEB_SURFACE} !important;
  }
  /* Dedicated mobile web comments route — opaque page, no feed underneath. */
  #frennix-comments-route,
  [data-frennix-comments-route="true"] {
    display: flex !important;
    flex-direction: column !important;
    flex: 1 1 auto !important;
    min-height: 0 !important;
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
    opacity: 1 !important;
  }
  [data-frennix-comments-route="true"] textarea:not([data-frennix-comment-input="true"]),
  [data-frennix-comments-route="true"] input:not([data-frennix-comment-input="true"]) {
    font-size: 16px !important;
    line-height: 22px !important;
    background-color: ${FRENNIX_WEB_SURFACE} !important;
    transform: none !important;
    zoom: normal !important;
  }
  /* Immersive mobile web video viewer — social chrome + comment trigger. */
  [data-frennix-immersive-video-viewer="true"] {
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
    overflow: hidden !important;
  }
  [data-frennix-immersive-video-viewer="true"] .fullscreen-video-mount,
  [data-frennix-immersive-video-viewer="true"] .fullscreen-video-slide {
    position: absolute !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    max-width: none !important;
    max-height: none !important;
  }
  [data-frennix-immersive-video-viewer="true"] .fullscreen-video-slide {
    object-fit: cover !important;
    object-position: center !important;
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
    pointer-events: none !important;
  }
  [data-frennix-immersive-comments-open="true"] {
    justify-content: flex-start !important;
  }
  [data-frennix-immersive-comments-open="true"] .fullscreen-video-slide {
    object-fit: contain !important;
  }
  [data-frennix-immersive-video-viewer="true"] [data-frennix-immersive-rail="true"] {
    pointer-events: auto !important;
    z-index: 100 !important;
  }
  [data-frennix-immersive-video-playlist="true"] {
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
    overflow: hidden !important;
  }
  .frennix-immersive-video-playlist-scroll {
    scroll-snap-type: y mandatory !important;
    -webkit-overflow-scrolling: touch !important;
    overscroll-behavior: contain !important;
    touch-action: pan-y !important;
  }
  .frennix-immersive-video-playlist-scroll > div {
    scroll-snap-align: start !important;
    scroll-snap-stop: always !important;
  }
  [data-frennix-comments-video-overlay="true"] {
    pointer-events: none !important;
  }
  [data-frennix-comments-video-overlay="true"] > * {
    pointer-events: auto !important;
  }
  [data-video-overlay-composer="true"] {
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    bottom: auto !important;
    z-index: 2147483647 !important;
    display: flex !important;
    align-items: flex-end !important;
    gap: 10px !important;
    min-height: 68px !important;
    padding: 8px 18px !important;
    box-sizing: border-box !important;
    background: #080808 !important;
    border-top: 1px solid #29292d !important;
    transform: none !important;
  }
  [data-frennix-comments-video-overlay="true"] [data-frennix-comment-composer-row="true"],
  [data-frennix-comments-video-overlay="true"] [data-frennix-comment-composer-host="true"],
  [data-frennix-comments-video-overlay="true"] textarea[data-frennix-comment-input="true"] {
    display: none !important;
  }
  [data-web-comment-composer-row="true"] {
    display: flex !important;
    align-items: flex-end !important;
    gap: 10px !important;
    width: 100% !important;
    max-width: 100% !important;
    box-sizing: border-box !important;
    background: ${FRENNIX_WEB_BACKGROUND} !important;
  }
  [data-web-comment-composer-row="true"] img {
    flex: 0 0 36px !important;
    width: 36px !important;
    height: 36px !important;
    border-radius: 50% !important;
  }
  [data-web-comment-composer-row="true"] button {
    flex: 0 0 auto !important;
    height: 48px !important;
    margin: 0 !important;
    padding: 0 4px !important;
    border: 0 !important;
    background: transparent !important;
    color: #20d760 !important;
    font-size: 16px !important;
    font-weight: 700 !important;
  }
  [data-web-comment-composer-row="true"] button:disabled,
  [data-video-overlay-composer="true"] button:disabled {
    color: #71717a !important;
    opacity: 1 !important;
  }
  [data-video-comment-field="true"] {
    position: relative !important;
    flex: 1 1 0% !important;
    display: block !important;
    width: 0 !important;
    min-width: 0 !important;
    height: var(--comment-field-height, 48px) !important;
    min-height: 48px !important;
    max-height: 114px !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    border: 1px solid #34343a !important;
    border-radius: 24px !important;
    background: #1b1b1e !important;
    contain: paint !important;
    isolation: isolate !important;
    -webkit-mask-image: -webkit-radial-gradient(white, black) !important;
  }
  [data-video-comment-field="true"] textarea {
    -webkit-appearance: none !important;
    appearance: none !important;
    display: block !important;
    width: 100% !important;
    min-width: 0 !important;
    height: 100% !important;
    min-height: 0 !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 12px 16px !important;
    box-sizing: border-box !important;
    border: 0 !important;
    border-radius: 0 !important;
    outline: 0 !important;
    background: transparent !important;
    color: #fff !important;
    font-size: 16px !important;
    line-height: 22px !important;
    resize: none !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    clip-path: none !important;
    -webkit-clip-path: none !important;
    contain: none !important;
    -webkit-mask-image: none !important;
  }
  [data-video-comment-field="true"] textarea::placeholder {
    color: #9a9aa1 !important;
    opacity: 1 !important;
  }
  [data-video-overlay-composer="true"] img {
    flex: 0 0 36px !important;
    width: 36px !important;
    height: 36px !important;
    border-radius: 50% !important;
  }
  [data-video-overlay-composer="true"] button {
    flex: 0 0 auto !important;
    height: 48px !important;
    margin: 0 !important;
    padding: 0 4px !important;
    border: 0 !important;
    background: transparent !important;
    color: #20d760 !important;
    font-size: 16px !important;
    font-weight: 700 !important;
  }
  [data-frennix-immersive-comments-open="true"] [data-frennix-video-stage-host="true"] {
    position: fixed !important;
    left: 0 !important;
    right: 0 !important;
    z-index: 30 !important;
    overflow: hidden !important;
  }
  /* Dedicated mobile web video route — opaque page, no feed underneath. */
  #frennix-video-route,
  [data-frennix-video-route="true"] {
    display: flex !important;
    flex-direction: column !important;
    flex: 1 1 auto !important;
    min-height: 100dvh !important;
    height: 100% !important;
    background-color: ${FRENNIX_WEB_BACKGROUND} !important;
    opacity: 1 !important;
    overflow: hidden !important;
  }
  /* While comments modal is open, block feed pointer/focus bleed-through. */
  body[data-frennix-comments-open="true"] #app-root-shell,
  body[data-frennix-comments-open="true"] #feed-scroll-list,
  body[data-frennix-comments-open="true"] #feed-tab-scene {
    pointer-events: none !important;
  }
  body[data-frennix-comments-open="true"] [data-frennix-comments-sheet="true"] {
    pointer-events: auto !important;
    isolation: isolate;
    z-index: 99998 !important;
  }
  #frennix-boot-shell[style*="display: none"],
  #frennix-boot-shell[hidden] {
    display: none !important;
    pointer-events: none !important;
  }
  #frennix-boot-shell[data-hiding="true"],
  #frennix-boot-shell[aria-hidden="true"] {
    pointer-events: none !important;
    visibility: hidden !important;
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
