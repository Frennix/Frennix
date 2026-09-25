#!/usr/bin/env npx tsx
/**
 * Guards the onboarding/profile-setup hook order that caused React #310
 * (Rendered more hooks than during the previous render).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function extractFunction(source: string, name: string) {
  const header = source.search(new RegExp(`(?:export\\s+)?function ${name}\\(`));
  if (header < 0) throw new Error(`function ${name} not found`);
  const headerOpen = source.indexOf("(", header);
  let depth = 1;
  let i = headerOpen + 1;
  for (; i < source.length && depth > 0; i += 1) {
    if (source[i] === "(") depth += 1;
    else if (source[i] === ")") depth -= 1;
  }
  const bodyStart = source.indexOf("{", i);
  if (bodyStart < 0) throw new Error(`function ${name} body not found`);
  depth = 0;
  for (let j = bodyStart; j < source.length; j += 1) {
    if (source[j] === "{") depth += 1;
    else if (source[j] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(header, j + 1);
    }
  }
  throw new Error(`function ${name} is unclosed`);
}

const HOOK_RE =
  /\buse(?:State|Effect|LayoutEffect|Memo|Callback|Ref|Context|Form|Auth|WindowDimensions|BottomActionSheetLayout|SafeAreaInsets)\b/g;

function hookCalls(fnSource: string) {
  return [...fnSource.matchAll(HOOK_RE)].map((match) => ({
    name: match[0],
    index: match.index ?? 0,
  }));
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const checks: Array<{ name: string; run: () => void }> = [
  {
    name: "BottomActionSheet: no hooks after web !visible return",
    run: () => {
      const fn = stripComments(extractFunction(read("components/BottomActionSheet.tsx"), "BottomActionSheet"));
      const earlyReturn = fn.indexOf('if (Platform.OS === "web" && !visible) return null');
      assert(earlyReturn >= 0, "web !visible early return is required");
      const afterReturn = hookCalls(fn.slice(earlyReturn));
      assert(
        afterReturn.length === 0,
        `hooks after early return would throw React #310 when the location sheet opens: ${afterReturn
          .map((hook) => hook.name)
          .join(", ")}`
      );
      assert(
        fn.indexOf("useMemo") >= 0 && fn.indexOf("useMemo") < earlyReturn,
        "sheetAnimatedStyle useMemo must run before the early return"
      );
    },
  },
  {
    name: "OnboardingContent: all hooks run before auth/profile early returns",
    run: () => {
      const fn = stripComments(extractFunction(read("app/onboarding.tsx"), "OnboardingContent"));
      const firstReturn = fn.search(/if \(!authReady\)/);
      assert(firstReturn >= 0, "authReady early return is required");
      const afterReturn = hookCalls(fn.slice(firstReturn));
      assert(
        afterReturn.length === 0,
        `hooks after authReady return: ${afterReturn.map((hook) => hook.name).join(", ")}`
      );
      const before = hookCalls(fn.slice(0, firstReturn)).map((hook) => hook.name);
      assert(before.includes("useAuth"), "useAuth must run unconditionally");
      assert(before.includes("useForm"), "useForm must run unconditionally");
      assert(before.includes("useEffect"), "cleanup effect must run unconditionally");
      assert(
        fn.includes('watch("displayName")'),
        "displayName must be watched at the top of the component, not only in JSX"
      );
    },
  },
  {
    name: "Fresh and partial onboarding share the same hook path",
    run() {
      const fn = stripComments(extractFunction(read("app/onboarding.tsx"), "OnboardingContent"));
      const firstReturn = fn.search(/if \(!authReady\)/);
      assert(firstReturn >= 0, "authReady early return is required");
      const hookPath = hookCalls(fn.slice(0, firstReturn)).map((hook) => hook.name);
      const expected = [
        "useAuth",
        "useState",
        "useState",
        "useState",
        "useState",
        "useState",
        "useState",
        "useState",
        "useState",
        "useState",
        "useRef",
        "useRef",
        "useForm",
        "useEffect",
      ];
      assert(
        hookPath.join(",") === expected.join(","),
        `unexpected hook path ${hookPath.join(" → ")}; expected ${expected.join(" → ")}`
      );

      assert(fn.includes("profileNeedsOnboardingRepair(profile)"), "partial/repair profiles stay on setup");
      assert(fn.includes('profile?.onboarding_complete && !profileNeedsOnboardingRepair(profile)'), "completed profiles redirect");
      const formTree = fn.slice(fn.indexOf("return (", firstReturn));
      assert(formTree.includes("LocationOnboardingStep"), "fresh and partial accounts both mount the location step");
      assert(formTree.includes("ManualLocationSheet") === false, "manual sheet stays inside LocationOnboardingStep");
    },
  },
  {
    name: "Location step always mounts the manual-location sheet",
    run: () => {
      const step = read("components/LocationOnboardingStep.tsx");
      assert(step.includes("ManualLocationSheet"), "manual location sheet is in the onboarding tree");
      assert(step.includes("visible={manualVisible}"), "sheet starts closed and can open without remounting the parent");
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
  console.error(`\n${failed} onboarding hook check(s) failed`);
  process.exit(1);
}

console.log("\nAll onboarding hook checks passed");
