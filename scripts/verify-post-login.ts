import { readFileSync, readdirSync } from "node:fs";
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
      const distFiles = readdirSync(join(ROOT, "dist/_expo/static/js/web")).filter((f) =>
        f.startsWith("entry-")
      );
      if (distFiles.length === 0) {
        throw new Error("Run build:web before verify:post-login (missing dist bundle)");
      }
      const bundle = read(`dist/_expo/static/js/web/${distFiles[0]}`);
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
    name: "Feed FlatList has flex layout for vertical scroll",
    run: () => {
      const feed = read("app/(tabs)/index.tsx");
      if (!feed.includes("feedScrollShell")) {
        throw new Error("Feed must wrap FlatList in feedScrollShell (minHeight:0 scroll chain)");
      }
      if (!feed.includes("flexFill")) {
        throw new Error("Feed must use flexFill for Safari web scroll");
      }
      if (feed.includes("feedHiddenWhileStory")) {
        throw new Error("Remove feedHiddenWhileStory wrapper — it breaks web scroll");
      }
    },
  },
  {
    name: "Feed scroll debug overlay for ?feedDebug=1",
    run: () => {
      assertIncludes("components/FeedScrollDebugOverlay.tsx", "FeedScrollDebugOverlay", "debug overlay required");
      assertIncludes("lib/useFeedScrollDebug.ts", "useFeedScrollDebug", "debug hook required");
      assertIncludes("app/(tabs)/index.tsx", "FeedScrollDebugOverlay", "feed must render debug overlay");
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
