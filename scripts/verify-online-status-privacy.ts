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
    name: "Migration adds show_online_status column",
    run: () =>
      assertIncludes(
        "supabase/migrations/20250630000006_show_online_status_privacy.sql",
        "show_online_status",
        "migration must add show_online_status"
      ),
  },
  {
    name: "Migration creates profiles_reader view",
    run: () =>
      assertIncludes(
        "supabase/migrations/20250630000006_show_online_status_privacy.sql",
        "profiles_reader",
        "profiles_reader view required"
      ),
  },
  {
    name: "set_presence respects show_online_status",
    run: () =>
      assertIncludes(
        "supabase/migrations/20250630000006_show_online_status_privacy.sql",
        "presence_hidden",
        "set_presence must short-circuit when hidden"
      ),
  },
  {
    name: "Profile type includes show_online_status",
    run: () =>
      assertIncludes(
        "packages/types/src/index.ts",
        "show_online_status",
        "Profile type must include show_online_status"
      ),
  },
  {
    name: "API reads use profiles_reader",
    run: () =>
      assertIncludes(
        "packages/api/src/profiles.ts",
        "profiles_reader",
        "profile reads must use profiles_reader"
      ),
  },
  {
    name: "UI presence helpers respect privacy flag",
    run: () => {
      assertIncludes("packages/ui/src/presence.ts", "isPresenceVisible", "UI presence guard");
      assertIncludes("packages/ui/src/presence.ts", "show_online_status", "UI checks setting");
    },
  },
  {
    name: "Privacy settings screen exists",
    run: () => {
      assertIncludes("app/privacy-settings.tsx", "Show Online Status", "privacy settings UI");
      assertIncludes("app/settings.tsx", "/privacy-settings", "settings links to privacy");
    },
  },
  {
    name: "Client skips online heartbeats when sharing disabled",
    run: () =>
      assertIncludes("lib/presence.ts", "presenceSharingEnabled", "presence sharing gate"),
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

console.log(`\nAll ${checks.length} online status privacy checks passed.`);
