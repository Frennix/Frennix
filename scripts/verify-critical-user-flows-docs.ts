#!/usr/bin/env npx tsx
/**
 * Ensures Critical User Flows checklist is wired into release process docs.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

function read(path: string) {
  return readFileSync(join(ROOT, path), "utf8");
}

function mustExist(path: string) {
  if (!existsSync(join(ROOT, path))) throw new Error(`missing ${path}`);
}

function mustInclude(file: string, needle: string) {
  if (!read(file).includes(needle)) {
    throw new Error(`${file} must reference ${needle}`);
  }
}

const checks = [
  {
    name: "checklist:CRITICAL-USER-FLOWS.md exists",
    run: () => mustExist("features/releases/checklists/CRITICAL-USER-FLOWS.md"),
  },
  {
    name: "template:verification template exists",
    run: () =>
      mustExist("features/releases/templates/CRITICAL-USER-FLOWS-VERIFICATION-TEMPLATE.md"),
  },
  {
    name: "docs:RELEASE_PROCESS references critical flows",
    run: () => mustInclude("features/releases/RELEASE_PROCESS.md", "CRITICAL-USER-FLOWS"),
  },
  {
    name: "docs:PRODUCTION-DEPLOYMENT gates critical flows",
    run: () => mustInclude("features/releases/checklists/PRODUCTION-DEPLOYMENT.md", "CRITICAL-USER-FLOWS"),
  },
  {
    name: "docs:RELEASE.md rule for critical flows",
    run: () => mustInclude("features/releases/RELEASE.md", "Critical User Flows"),
  },
  {
    name: "checklist:AUTH-01 sign up flow defined",
    run: () => mustInclude("features/releases/checklists/CRITICAL-USER-FLOWS.md", "AUTH-01"),
  },
  {
    name: "checklist:INT-05 action sheet flow defined",
    run: () => mustInclude("features/releases/checklists/CRITICAL-USER-FLOWS.md", "INT-05"),
  },
];

let failed = 0;
for (const check of checks) {
  try {
    check.run();
    console.log(`PASS  ${check.name}`);
  } catch (e) {
    failed += 1;
    console.error(`FAIL  ${check.name}`);
    console.error(`      ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (failed) {
  console.error(`\n${checks.length - failed}/${checks.length} PASS, ${failed} FAIL`);
  process.exit(1);
}
console.log(`\n${checks.length}/${checks.length} PASS`);
