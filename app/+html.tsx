import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

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
        <ScrollViewStyleReset />
        <style>{`
          html {
            height: 100%;
            height: -webkit-fill-available;
          }
          body {
            height: 100%;
            min-height: 100dvh;
            min-height: -webkit-fill-available;
          }
          #root {
            min-height: 0;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
