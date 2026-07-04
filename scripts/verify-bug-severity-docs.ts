#!/usr/bin/env npx tsx
/**
 * Ensures bug severity classification is wired into release documentation.
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
    name: "docs:BUG-SEVERITY.md exists",
    run: () => mustExist("features/releases/BUG-SEVERITY.md"),
  },
  {
    name: "docs:P0-P3 levels defined",
    run: () => {
      const s = read("features/releases/BUG-SEVERITY.md");
      for (const level of ["P0", "P1", "P2", "P3"]) {
        if (!s.includes(level)) throw new Error(`missing ${level}`);
      }
    },
  },
  {
    name: "docs:required fields documented",
    run: () => {
      const s = read("features/releases/BUG-SEVERITY.md");
      for (const field of [
        "Severity",
        "Priority",
        "Version Found",
        "Version Fixed",
        "Status",
        "Assigned Milestone",
      ]) {
        if (!s.includes(field)) throw new Error(`missing field ${field}`);
      }
    },
  },
  {
    name: "template:BUG-REPORT-TEMPLATE.md exists",
    run: () => mustExist("features/releases/templates/BUG-REPORT-TEMPLATE.md"),
  },
  {
    name: "docs:RELEASE.md references severity system",
    run: () => mustInclude("features/releases/RELEASE.md", "BUG-SEVERITY"),
  },
  {
    name: "docs:RELEASE_PROCESS references severity",
    run: () => mustInclude("features/releases/RELEASE_PROCESS.md", "BUG-SEVERITY"),
  },
  {
    name: "workflow:RELEASE-WORKFLOW references severity",
    run: () => mustInclude("features/releases/RELEASE-WORKFLOW.md", "BUG-SEVERITY"),
  },
  {
    name: "package:verify:bug-severity script",
    run: () => mustInclude("package.json", "verify:bug-severity"),
  },
  {
    name: "bug-list:v1.0.3 uses P0-P3 columns",
    run: () => {
      const s = read("features/releases/v1.0.3-BUG-LIST.md");
      for (const col of ["Sev", "Version Found", "Version Fixed", "Milestone"]) {
        if (!s.includes(col)) throw new Error(`v1.0.3-BUG-LIST missing ${col}`);
      }
      if (!s.includes("BUG-002") || !s.includes("**P1**")) {
        throw new Error("BUG-002 must be classified P1");
      }
    },
  },
  {
    name: "release-log:bug tables include severity columns",
    run: () => {
      const s = read("features/releases/RELEASE.md");
      if (!s.includes("| Sev | Priority | Version Found | Version Fixed | Milestone |")) {
        throw new Error("RELEASE.md bug table missing severity columns");
      }
      if (!s.includes("BUG-001") || !s.includes("**P0**")) {
        throw new Error("BUG-001 must be classified P0");
      }
    },
  },
  {
    name: "postmortem:severity fields in template",
    run: () => {
      const t = read("features/releases/templates/POSTMORTEM-TEMPLATE.md");
      for (const field of ["Severity", "Version Found", "Version Fixed", "Assigned Milestone"]) {
        if (!t.includes(field)) throw new Error(`POSTMORTEM-TEMPLATE missing ${field}`);
      }
    },
  },
  {
    name: "postmortem:BUG-001 classified P0",
    run: () => {
      const s = read("features/releases/postmortems/BUG-001-POSTMORTEM.md");
      if (!s.includes("**P0**")) throw new Error("BUG-001 postmortem must include P0");
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
