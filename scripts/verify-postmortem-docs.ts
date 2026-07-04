#!/usr/bin/env npx tsx
/**
 * Ensures postmortem process is wired into release documentation.
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
  if (!read(file).includes(needle)) throw new Error(`${file} must include ${needle}`);
}

const checks = [
  {
    name: "process:POSTMORTEM-PROCESS.md exists",
    run: () => mustExist("features/releases/POSTMORTEM-PROCESS.md"),
  },
  {
    name: "template:POSTMORTEM-TEMPLATE.md exists",
    run: () => mustExist("features/releases/templates/POSTMORTEM-TEMPLATE.md"),
  },
  {
    name: "index:postmortems/README.md exists",
    run: () => mustExist("features/releases/postmortems/README.md"),
  },
  {
    name: "example:BUG-001 postmortem exists",
    run: () => mustExist("features/releases/postmortems/BUG-001-POSTMORTEM.md"),
  },
  {
    name: "docs:RELEASE.md postmortem rule",
    run: () => mustInclude("features/releases/RELEASE.md", "Postmortems"),
  },
  {
    name: "docs:RELEASE_PROCESS core rule",
    run: () => mustInclude("features/releases/RELEASE_PROCESS.md", "POSTMORTEM-PROCESS"),
  },
  {
    name: "template:required postmortem fields",
    run: () => {
      const t = read("features/releases/templates/POSTMORTEM-TEMPLATE.md");
      for (const field of [
        "Bug ID",
        "Severity",
        "Priority",
        "Version Found",
        "Version Fixed",
        "Assigned Milestone",
        "Date reported",
        "Who discovered it",
        "Root cause",
        "Why automated testing did not catch it",
        "What code was changed",
        "What QA test was added",
        "Status",
      ]) {
        if (!t.includes(field)) throw new Error(`POSTMORTEM-TEMPLATE missing ${field}`);
      }
    },
  },
  {
    name: "process:status lifecycle documented",
    run: () => {
      mustInclude("features/releases/POSTMORTEM-PROCESS.md", "Open");
      mustInclude("features/releases/POSTMORTEM-PROCESS.md", "Fixed");
      mustInclude("features/releases/POSTMORTEM-PROCESS.md", "Verified");
      mustInclude("features/releases/POSTMORTEM-PROCESS.md", "Closed");
    },
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
