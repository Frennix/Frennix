import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";
import { frennixWebDocumentCss, FRENNIX_WEB_BACKGROUND } from "@/lib/web-document-styles";

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
      </head>
      <body>{children}</body>
    </html>
  );
}
