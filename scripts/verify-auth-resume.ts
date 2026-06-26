import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function assertIncludes(file: string, needle: string, message: string) {
  const source = read(file);
  if (!source.includes(needle)) {
    throw new Error(`${message} (missing in ${file})`);
  }
}

function assertExcludes(file: string, needle: string, message: string) {
  const source = read(file);
  if (source.includes(needle)) {
    throw new Error(`${message} (found in ${file})`);
  }
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "AuthProvider exports authReady and profileLoading",
    run: () => {
      assertIncludes("providers/AuthProvider.tsx", "authReady", "authReady must be exported");
      assertIncludes("providers/AuthProvider.tsx", "profileLoading", "profileLoading must be tracked");
    },
  },
  {
    name: "TOKEN_REFRESHED does not clear loading before profile resolves",
    run: () => {
      assertIncludes(
        "providers/AuthProvider.tsx",
        'if (event === "TOKEN_REFRESHED")',
        "TOKEN_REFRESHED handler required"
      );
      assertExcludes(
        "providers/AuthProvider.tsx",
        'if (event === "TOKEN_REFRESHED") {\n        setSession(s);\n        setLoading(false);',
        "TOKEN_REFRESHED must not force loading=false"
      );
    },
  },
  {
    name: "Index gate waits for authReady before onboarding redirect",
    run: () => {
      assertIncludes("app/index.tsx", "authReady", "index route must wait for authReady");
      assertIncludes("app/index.tsx", "onboarding_complete", "index route must check onboarding_complete");
    },
  },
  {
    name: "Onboarding waits for authReady and redirects completed profiles",
    run: () => {
      assertIncludes("app/onboarding.tsx", "authReady", "onboarding must wait for authReady");
      assertIncludes(
        "app/onboarding.tsx",
        "profile?.onboarding_complete",
        "onboarding must redirect completed profiles"
      );
    },
  },
  {
    name: "Auth navigation guard protects onboarding route",
    run: () => {
      assertIncludes(
        "lib/auth-navigation.ts",
        'root === "onboarding"',
        "navigation guard must handle onboarding route"
      );
    },
  },
  {
    name: "Profile cache helper exists for Safari resume hydration",
    run: () => {
      assertIncludes("lib/auth-profile-cache.ts", "readCachedProfile", "profile cache read helper required");
      assertIncludes("providers/AuthProvider.tsx", "readCachedProfile", "AuthProvider must hydrate cached profile");
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

console.log(`\nAll ${checks.length} auth resume checks passed.`);
