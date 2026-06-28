import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function assertIncludes(file: string, needle: string, message: string) {
  if (!read(file).includes(needle)) {
    throw new Error(`${message} (missing in ${file})`);
  }
}

function assertExcludes(file: string, needle: string, message: string) {
  if (read(file).includes(needle)) {
    throw new Error(`${message} (found in ${file})`);
  }
}

function readMainWebBundle() {
  const webDir = join(ROOT, "dist/_expo/static/js/web");
  const distFiles = readdirSync(webDir).filter(
    (file) => file.startsWith("entry-") || file.startsWith("index-")
  );
  if (distFiles.length === 0) {
    throw new Error("Run build:web before verify:post-login (missing dist bundle)");
  }
  const mainBundle = distFiles.reduce((largest, file) => {
    const size = statSync(join(webDir, file)).size;
    const largestSize = statSync(join(webDir, largest)).size;
    return size > largestSize ? file : largest;
  });
  return read(`dist/_expo/static/js/web/${mainBundle}`);
}

function assertValidFeedPostCardHeader() {
  const source = read("packages/ui/src/FeedPostCard.tsx");
  if (!source.includes("{isOwn ? (")) {
    throw new Error("FeedPostCard header menu must guard on isOwn");
  }
  // Regression: orphaned ternary after ScalePressable refactor (049e85b).
  if (/\)\s*:\s*onModerationPress\s*\?/.test(source) && !/\{isOwn \?\s*\(/.test(source)) {
    throw new Error("FeedPostCard has orphaned ternary — header JSX is invalid");
  }
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "Root layout mounts providers in correct order",
    run: () => {
      const layout = read("app/_layout.tsx");
      const rootSection = layout.slice(layout.indexOf("export default function RootLayout"));
      const queryIdx = rootSection.indexOf("<QueryProvider");
      const authIdx = rootSection.indexOf("<AuthProvider");
      const tabsIdx = rootSection.indexOf("<TabBadgeRoot");
      const boundaryIdx = rootSection.indexOf('scope="navigation"');
      if (queryIdx < 0 || authIdx < 0 || tabsIdx < 0 || boundaryIdx < 0) {
        throw new Error("Expected QueryProvider, AuthProvider, TabBadgeRoot, navigation boundary");
      }
      if (!(queryIdx < authIdx && authIdx < tabsIdx)) {
        throw new Error("Provider order must be QueryProvider → AuthProvider → TabBadgeRoot");
      }
    },
  },
  {
    name: "Login applies session before routing home",
    run: () => {
      assertIncludes("app/(auth)/login.tsx", "await applySession(session)", "login must apply session");
      assertIncludes("app/(auth)/login.tsx", 'router.replace("/")', "login must route to index after session");
    },
  },
  {
    name: "Index gate waits for authReady before tabs redirect",
    run: () => {
      assertIncludes("app/index.tsx", "authReady", "index must wait for authReady");
      assertIncludes("app/index.tsx", 'Redirect href="/(tabs)"', "completed users route to tabs");
      assertExcludes(
        "app/index.tsx",
        "if (!session) return <Redirect href=\"/(tabs)\"",
        "index must not redirect unsigned users to tabs"
      );
    },
  },
  {
    name: "AuthNavigationGuard protects routes after bootstrap",
    run: () => {
      assertIncludes("lib/auth-navigation.ts", "authReady", "guard must wait for authReady");
      assertIncludes("lib/auth-navigation.ts", "AuthNavigationGuard", "guard export required");
    },
  },
  {
    name: "Tabs stay mounted for instant switching",
    run: () => {
      assertIncludes("app/(tabs)/_layout.tsx", "lazy: false", "tabs must stay mounted");
      assertIncludes("app/(tabs)/_layout.tsx", "freezeOnBlur: true", "tabs must freeze when blurred");
    },
  },
  {
    name: "FeedPostCard header JSX is valid (post-login feed render)",
    run: assertValidFeedPostCardHeader,
  },
  {
    name: "AnimatedFeedListItem disables Reanimated entering on web (Safari crash fix)",
    run: () => {
      assertIncludes(
        "components/AnimatedFeedListItem.tsx",
        'Platform.OS !== "web"',
        "entering animation must be disabled on web"
      );
      const bundle = readMainWebBundle();
      if (bundle.includes("FadeInDown.duration(260).springify().damping(22)")) {
        throw new Error("Web bundle still ships FadeInDown entering — Safari post-login crash risk");
      }
    },
  },
  {
    name: "Haptics are no-op on web (Safari must not throw UnavailabilityError)",
    run: () => {
      assertIncludes("lib/haptics.ts", "Platform.OS", "haptics must gate native-only APIs");
      assertExcludes(
        "lib/haptics.ts",
        'import * as Haptics from "expo-haptics"',
        "haptics must not eagerly import expo-haptics (web Safari crash risk)"
      );
      assertIncludes("lib/haptics.ts", 'require("expo-haptics")', "haptics must lazy-load on native");
    },
  },
  {
    name: "Feed stories query declared before story handlers",
    run: () => {
      const feed = read("app/(tabs)/index.tsx");
      const storiesDecl = feed.indexOf("data: stories = []");
      const firstStoriesDep = feed.indexOf("[userId, stories]");
      if (storiesDecl < 0 || firstStoriesDep < 0) {
        throw new Error("feed story hooks missing");
      }
      if (storiesDecl > firstStoriesDep) {
        throw new Error("stories is referenced before useQuery declaration (login crash)");
      }
    },
  },
  {
    name: "Safari web shell patch keeps scroll layout without emergency banner",
    run: () => {
      const layout = read("app/_layout.tsx");
      if (layout.includes("<EmergencyDebugBanner")) {
        throw new Error("EmergencyDebugBanner must not mount in production root layout");
      }
      assertIncludes("scripts/patch-web-html.js", "frennix-web-scroll", "Safari scroll shell patch required");
      assertExcludes("scripts/patch-web-html.js", "frennix-emergency-html", "pre-JS emergency banner must be removed");
      assertIncludes("scripts/patch-web-html.js", "pointer-events: none", "#root pointer pass-through required");
    },
  },
  {
    name: "Post-login shell error boundary wraps tabs",
    run: () => {
      assertIncludes("components/PostLoginShellErrorBoundary.tsx", "Post-login shell error", "shell boundary required");
      assertIncludes("app/(tabs)/_layout.tsx", "PostLoginShellErrorBoundary", "tabs must use shell boundary");
    },
  },
  {
    name: "Web feed uses incremental bisection screen",
    run: () => {
      assertIncludes("components/FeedBisectionScreen.tsx", "Feed is rendering", "bisection baseline copy required");
      assertIncludes("lib/feed-bisection.ts", "feedStep", "feed step query param required");
      assertIncludes("app/(tabs)/index.web.tsx", "FeedBisectionScreen", "web feed must use bisection screen");
      if (existsSync(join(ROOT, "app/(tabs)/_layout.web.tsx"))) {
        throw new Error("app/(tabs)/_layout.web.tsx must be removed — use real tabs shell on web");
      }
    },
  },
  {
    name: "Feed header supports bisection visibility flags",
    run: () => {
      assertIncludes("components/FeedHeader.tsx", "showQuickActions", "FeedHeader must gate quick actions");
      assertIncludes("components/FeedHeader.tsx", "showStories", "FeedHeader must gate stories");
    },
  },
  {
    name: "Feed layout diagnostics probe zero-height parents",
    run: () => {
      assertIncludes("components/FeedLayoutDiagnostics.tsx", "Feed layout probes", "layout diagnostics required");
      assertIncludes("components/FeedLayoutDiagnostics.tsx", "display:none", "layout diagnostics must flag hidden nodes");
    },
  },
  {
    name: "Web bundle ships feed bisection strings",
    run: () => {
      const bundle = readMainWebBundle();
      if (!bundle.includes("Feed is rendering")) {
        throw new Error("Web bundle must include feed bisection baseline copy");
      }
      if (!bundle.includes("FEED BISECTION")) {
        throw new Error("Web bundle must include feed bisection banner");
      }
      const html = read("dist/index.html");
      if (!html.includes("2025-06-28-feed-bisection")) {
        throw new Error("dist/index.html must include feed bisection build id");
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
    console.error(error instanceof Error ? error.message : error);
  }
}

if (failed > 0) {
  process.exit(1);
}

console.log(`\nAll ${checks.length} post-login checks passed.`);
