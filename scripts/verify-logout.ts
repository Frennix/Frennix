#!/usr/bin/env npx tsx
/**
 * Guards the logout path that left Safari/PWA on settings until a manual refresh.
 */
import { readFileSync } from "node:fs";
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

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "Settings logout clears session then redirects",
    run: () => {
      assertIncludes("app/settings.tsx", "await signOut()", "settings calls signOut");
      assertIncludes("app/settings.tsx", "queryClient.clear()", "settings clears query cache");
      assertIncludes("app/settings.tsx", "redirectToLogin()", "settings redirects after signOut");
    },
  },
  {
    name: "Web redirect leaves the authenticated tree",
    run: () => {
      const nav = read("lib/auth-navigation.ts");
      if (!nav.includes("window.location.replace(LOGIN_WEB_PATH)")) {
        throw new Error("web logout must use a document navigation to /login");
      }
      if (nav.includes("router.replace(LOGIN_HREF)") && !nav.includes('Platform.OS === "web"')) {
        throw new Error("web must not rely on expo-router replace alone");
      }
    },
  },
  {
    name: "AuthProvider sign-out is local-first",
    run: () => {
      const auth = read("providers/AuthProvider.tsx");
      const signOutAt = auth.indexOf("const signOut = useCallback");
      const supabaseAt = auth.indexOf("await supabaseSignOut", signOutAt);
      const clearAt = auth.indexOf("clearAllPersistedAuth()", signOutAt);
      const setSessionAt = auth.indexOf("setSession(null)", signOutAt);
      if (signOutAt < 0 || supabaseAt < 0 || clearAt < 0 || setSessionAt < 0) {
        throw new Error("signOut is missing a required clear step");
      }
      if (!(clearAt < supabaseAt && setSessionAt < supabaseAt)) {
        throw new Error("local session/storage must clear before awaiting Supabase signOut");
      }
      assertIncludes("providers/AuthProvider.tsx", "explicitSignOutRef.current = true", "block session recovery");
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
    console.error(`      ${error instanceof Error ? error.message : error}`);
  }
}

if (failed) {
  process.exit(1);
}
console.log("\nAll logout checks passed.");
