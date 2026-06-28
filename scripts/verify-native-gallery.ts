/**
 * Static QA checks for full-screen gallery behavior on iOS/Android.
 * Run: npx tsx scripts/verify-native-gallery.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const lightbox = read("components/ImageLightbox.tsx");
const hook = read("lib/useMediaGallery.tsx");
const feed = read("app/(tabs)/index.tsx");

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "Gallery images use contain fit (portrait, landscape, square)",
    run: () => {
      if (!lightbox.includes('contentFit="contain"')) {
        throw new Error("CachedImage must use contentFit contain");
      }
      if (lightbox.includes('contentFit="cover"')) {
        throw new Error("Gallery must not use cover");
      }
    },
  },
  {
    name: "Native stage uses measured bounds (no percent sizing crop)",
    run: () => {
      if (!lightbox.includes("NativeZoomableImage")) {
        throw new Error("NativeZoomableImage component required");
      }
      if (lightbox.includes('width: "100%"') && lightbox.includes("imageFill")) {
        throw new Error("Percent-sized image fill causes cropping");
      }
      if (!lightbox.includes("stageWidth") || !lightbox.includes("stageHeight")) {
        throw new Error("Stage dimensions must be measured");
      }
    },
  },
  {
    name: "Native pinch-to-zoom, pan, and double-tap zoom",
    run: () => {
      if (!lightbox.includes("Gesture.Pinch()")) throw new Error("Pinch gesture missing");
      if (!lightbox.includes("Gesture.Pan()")) throw new Error("Pan gesture missing");
      if (!lightbox.includes("Gesture.Tap()")) throw new Error("Double-tap gesture missing");
      if (!lightbox.includes("numberOfTaps(2)")) throw new Error("Double-tap zoom missing");
    },
  },
  {
    name: "Zoom resets to fit when scale returns to 1",
    run: () => {
      if (!lightbox.includes("resetZoom")) throw new Error("resetZoom helper missing");
      if (!lightbox.includes("scale.value <= 1.01")) {
        throw new Error("Native pinch end must reset when zoomed out");
      }
    },
  },
  {
    name: "Gallery swipe disabled while zoomed",
    run: () => {
      if (!lightbox.includes("scrollEnabled={scrollEnabled}")) {
        throw new Error("FlatList scroll must respect zoom state");
      }
      if (!lightbox.includes("setScrollEnabled(!zoomed)")) {
        throw new Error("Zoom change must toggle gallery scroll");
      }
    },
  },
  {
    name: "Image counter stays visible in multi-photo gallery",
    run: () => {
      if (!lightbox.includes("galleryCounter")) throw new Error("Counter UI missing");
      if (!lightbox.includes("{index + 1}/{items.length}")) {
        throw new Error("Counter must show current/total");
      }
    },
  },
  {
    name: "Close button remains accessible above gallery",
    run: () => {
      if (!lightbox.includes("closeButton")) throw new Error("Close button missing");
      if (!lightbox.includes("zIndex: 20")) throw new Error("Close button must sit above gallery");
      if (!lightbox.includes('accessibilityLabel="Close"')) {
        throw new Error("Close button needs accessibility label");
      }
    },
  },
  {
    name: "Closing gallery returns feed to same carousel index",
    run: () => {
      if (!hook.includes("handleClose") || !hook.includes("finalIndex")) {
        throw new Error("Gallery must pass final index on close");
      }
      if (!feed.includes("openGallery(displayPost.media_urls ?? [], index, (finalIndex)")) {
        throw new Error("Feed must restore carousel index on gallery close");
      }
      if (!feed.includes("setCarouselIndex(post.id, finalIndex)")) {
        throw new Error("Feed must persist final carousel index");
      }
    },
  },
];

let failed = 0;
for (const check of checks) {
  try {
    check.run();
    console.log(`PASS  ${check.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${check.name}`);
    console.error(`      ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failed) {
  console.error(`\n${failed} native gallery check(s) failed.`);
  process.exit(1);
}

console.log(`\nAll ${checks.length} native gallery checks passed.`);
