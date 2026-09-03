import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";
import {
  bootShellCss,
  buildDevBootShellScript,
  FRENNIX_SPLASH_BACKGROUND,
  FRENNIX_SPLASH_LOGO_PATH,
} from "@/lib/boot-shell-document";
import { frennixWebDocumentCss } from "@/lib/web-document-styles";

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
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta name="theme-color" content={FRENNIX_SPLASH_BACKGROUND} />
        <meta name="color-scheme" content="dark" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="Frennix" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="preload" href={FRENNIX_SPLASH_LOGO_PATH} as="image" type="image/png" />
        <link rel="apple-touch-startup-image" href={FRENNIX_SPLASH_LOGO_PATH} />
        <ScrollViewStyleReset />
        <style id="frennix-web-scroll">{frennixWebDocumentCss}</style>
        <style id="frennix-boot-shell-css">{bootShellCss}</style>
      </head>
      <body>
        <div id="frennix-boot-shell" aria-live="polite" aria-busy="true" aria-label="Frennix">
          <img
            className="frennix-boot-shell-logo"
            src={FRENNIX_SPLASH_LOGO_PATH}
            alt=""
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <script dangerouslySetInnerHTML={{ __html: buildDevBootShellScript() }} />
        {children}
      </body>
    </html>
  );
}
