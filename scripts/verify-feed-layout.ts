/**
 * Regression checks for the shared FeedLayout system.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

const SECTION_ORDER = [
  "FeedLayout.Header",
  "FeedLayout.Media",
  "FeedPostActionBar",
  "FeedLayout.Caption",
  "FeedLayout.Engagement",
  "FeedLayout.Comments",
];

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "FeedLayout tokens define shared spacing and typography",
    run: () => {
      const src = read("packages/ui/src/feed-layout/tokens.ts");
      for (const key of [
        "maxContentWidth",
        "contentPaddingX",
        "mediaMarginX",
        "header",
        "actions",
        "caption",
        "engagement",
        "comments",
      ]) {
        if (!src.includes(key)) {
          throw new Error(`feedLayout tokens must define ${key}`);
        }
      }
      if (!src.includes("feedLayoutTypography")) {
        throw new Error("feedLayoutTypography must be exported");
      }
    },
  },
  {
    name: "FeedPostCard composes FeedLayout sections",
    run: () => {
      const src = read("packages/ui/src/FeedPostCard.tsx");
      if (!src.includes("FeedLayout.Root")) {
        throw new Error("FeedPostCard must use FeedLayout.Root");
      }
      for (const section of SECTION_ORDER) {
        if (!src.includes(section)) {
          throw new Error(`FeedPostCard must render ${section}`);
        }
      }
    },
  },
  {
    name: "FeedPostCard mounts media through FeedMedia",
    run: () => {
      const src = read("packages/ui/src/FeedPostCard.tsx");
      if (!src.includes("<FeedMedia")) {
        throw new Error("FeedPostCard must render FeedMedia for media");
      }
      if (!src.includes("onMediaPress={onMediaPress}")) {
        throw new Error("FeedPostCard must pass onMediaPress to media");
      }
    },
  },
  {
    name: "FeedMedia is the canonical feed media component",
    run: () => {
      const src = read("packages/ui/src/feed-layout/FeedMedia.tsx");
      if (!src.includes("FeedMediaSlot")) {
        throw new Error("FeedMedia must delegate to FeedMediaSlot");
      }
      if (!src.includes("FeedLayout.Media")) {
        throw new Error("FeedMedia must apply FeedLayout.Media shell");
      }
    },
  },
  {
    name: "feedMediaRules define aspect and crop policy",
    run: () => {
      const src = read("packages/ui/src/feed-layout/feedMediaRules.ts");
      if (!src.includes("maxPortraitRatio:")) {
        throw new Error("feedMediaRules must cap portrait media at 4:5");
      }
      if (!src.includes('contentFit: "cover"')) {
        throw new Error("feedMediaRules must use cover fit for feed media");
      }
      if (!src.includes("preserveAspectRatio: true")) {
        throw new Error("feedMediaRules must preserve aspect ratio");
      }
    },
  },
  {
    name: "FeedLayout extension slots are defined for future monetization",
    run: () => {
      const src = read("packages/ui/src/feed-layout/feedLayoutExtensions.ts");
      for (const kind of ["sponsored", "premium_gated", "affiliate", "advertisement"]) {
        if (!src.includes(`"${kind}"`)) {
          throw new Error(`feedLayoutExtensions must define ${kind} monetization kind`);
        }
      }
      if (!src.includes("FeedPostLayoutSlots")) {
        throw new Error("FeedPostLayoutSlots type must exist");
      }
    },
  },
  {
    name: "FeedPostCard accepts optional layout extension slots",
    run: () => {
      const src = read("packages/ui/src/FeedPostCard.tsx");
      if (!src.includes("slots?: FeedPostLayoutSlots")) {
        throw new Error("FeedPostCard must accept optional FeedPostLayoutSlots");
      }
      if (!src.includes("FeedLayout.Label")) {
        throw new Error("FeedPostCard must wire FeedLayout.Label slot");
      }
    },
  },
  {
    name: "PERFORMANCE.md documents feed baseline metrics",
    run: () => {
      const doc = read("PERFORMANCE.md");
      if (!doc.includes("Largest Contentful Paint")) {
        throw new Error("PERFORMANCE.md must document LCP baseline");
      }
      if (!doc.includes("FeedLayout redesign")) {
        throw new Error("PERFORMANCE.md must reference FeedLayout redesign baseline");
      }
    },
  },
  {
    name: "FeedPostActionBar meets accessibility standards",
    run: () => {
      const src = read("packages/ui/src/feed-layout/FeedPostActionBar.tsx");
      if (!src.includes("accessibilityRole=\"toolbar\"")) {
        throw new Error("FeedPostActionBar must expose toolbar role");
      }
      if (!src.includes("accessibilityState")) {
        throw new Error("FeedPostActionBar must expose selected state for toggles");
      }
      if (!src.includes("minHeight: touchTarget")) {
        throw new Error("FeedPostActionBar buttons must meet 44pt touch target");
      }
      if (!src.includes("feedAccessibility.maxFontSizeMultiplier")) {
        throw new Error("FeedPostActionBar must support capped Dynamic Type");
      }
    },
  },
  {
    name: "Feed layout components are documented",
    run: () => {
      const doc = read("packages/ui/src/feed-layout/COMPONENTS.md");
      if (!doc.includes("FeedMedia")) {
        throw new Error("COMPONENTS.md must document FeedMedia");
      }
      if (!doc.includes("When to use")) {
        throw new Error("COMPONENTS.md must include when-to-use guidance");
      }
    },
  },
  {
    name: "FeedStoriesRow imports feedLayout from feed-layout tokens",
    run: () => {
      const src = read("packages/ui/src/FeedStoriesRow.tsx");
      if (/feedLayout.*from \"\.\/theme\"/.test(src)) {
        throw new Error("FeedStoriesRow must import feedLayout from ./feed-layout, not ./theme");
      }
      if (!src.includes('from "./feed-layout"')) {
        throw new Error("FeedStoriesRow must import feedLayout from ./feed-layout");
      }
    },
  },
  {
    name: "FeedLayout uses premium card shell with shared content column",
    run: () => {
      const tokens = read("packages/ui/src/feed-layout/tokens.ts");
      if (!tokens.includes("contentColumn")) {
        throw new Error("feedLayout must define contentColumn for unified post width");
      }
      if (!tokens.includes("contentPaddingX")) {
        throw new Error("feedLayout must define contentPaddingX for text sections");
      }
      const rootBlock = tokens.match(/root:\s*\{([\s\S]*?)\n  \},/)?.[1] ?? "";
      if (/paddingHorizontal:/.test(rootBlock)) {
        throw new Error("FeedLayout root must not apply horizontal padding — media is full-bleed");
      }
      if (!tokens.includes("paddingHorizontal: feedLayout.contentPaddingX")) {
        throw new Error("FeedLayout text sections must apply horizontal inset");
      }
      if (!tokens.includes("postRadius")) {
        throw new Error("feedLayout must define postRadius for premium cards");
      }
    },
  },
  {
    name: "FeedPostCard renders workout type chips and stats pills",
    run: () => {
      const src = read("packages/ui/src/FeedPostCard.tsx");
      if (!src.includes("WorkoutTypeChips")) {
        throw new Error("FeedPostCard must render WorkoutTypeChips for workout tags");
      }
      if (!src.includes("WorkoutStatsPills")) {
        throw new Error("FeedPostCard must render WorkoutStatsPills when metrics exist");
      }
    },
  },
  {
    name: "FeedPostCardSkeleton mirrors FeedLayout structure",
    run: () => {
      const src = read("packages/ui/src/FeedPostCardSkeleton.tsx");
      if (!src.includes("FeedLayout.Root")) {
        throw new Error("FeedPostCardSkeleton must use FeedLayout");
      }
      if (!src.includes("FeedLayout.Media")) {
        throw new Error("FeedPostCardSkeleton must include media placeholder");
      }
    },
  },
  {
    name: "FeedCommentPreview uses feed layout tokens",
    run: () => {
      const src = read("packages/ui/src/FeedCommentPreview.tsx");
      if (!src.includes("feedLayout")) {
        throw new Error("FeedCommentPreview must import feedLayout tokens");
      }
    },
  },
  {
    name: "MediaAspectFrame does not inflate feed height after dimensions load",
    run: () => {
      const src = read("packages/ui/src/MediaAspectFrame.tsx");
      if (/Math\.max\(height,\s*FEED_MIN_MEDIA_HEIGHT\)/.test(src)) {
        throw new Error("MediaAspectFrame must not force FEED_MIN_MEDIA_HEIGHT on loaded dimensions");
      }
    },
  },
  {
    name: "Feed index routes media tap to lightbox handler",
    run: () => {
      const src = read("app/(tabs)/index.tsx");
      if (!src.includes("openGallery(displayPost.media_urls")) {
        throw new Error("Feed onMediaPress must open the image lightbox");
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
    console.error(`FAIL  ${check.name}: ${error instanceof Error ? error.message : error}`);
  }
}

if (failed) process.exit(1);
console.log(`\nAll ${checks.length} feed layout checks passed.`);
