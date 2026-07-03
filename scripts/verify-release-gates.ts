#!/usr/bin/env npx tsx
/**
 * Release gate validator — blocks staging/production deploy if checklists incomplete.
 *
 * Usage:
 *   npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-v1.0.1.md --phase internal
 *   npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-v1.0.1.md --phase staging
 *   npx tsx scripts/verify-release-gates.ts --release features/releases/RELEASE-v1.0.1.md --phase production
 *
 * Exit 0 = all gates pass. Exit 1 = blocked (incomplete items listed).
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");

type Phase = "internal" | "staging" | "production";

const GATE_CHECKS: Record<Phase, Array<{ label: string; patterns: RegExp[] }>> = {
  internal: [
    {
      label: "Internal testing complete",
      patterns: [/Internal testing complete\s*\|\s*✅/i, /\*\*Internal testing complete\*\*\s*\|\s*✅/i],
    },
  ],
  staging: [
    {
      label: "Internal testing complete",
      patterns: [/Internal testing complete\s*\|\s*✅/i, /\*\*Internal testing complete\*\*\s*\|\s*✅/i],
    },
    {
      label: "Release readiness report delivered",
      patterns: [
        /Release readiness report delivered\s*\|\s*✅/i,
        /\*\*Release readiness report delivered\*\*\s*\|\s*✅/i,
      ],
    },
    {
      label: "Human QA approved",
      patterns: [/Human QA approved\s*\|\s*✅/i, /\*\*Human QA approved\*\*\s*\|\s*✅/i],
    },
    {
      label: "Founder staging approval",
      patterns: [/Founder staging approval\s*\|\s*✅/i, /\*\*Founder staging approval\*\*\s*\|\s*✅/i],
    },
  ],
  production: [
    {
      label: "Internal testing complete",
      patterns: [/Internal testing complete\s*\|\s*✅/i, /\*\*Internal testing complete\*\*\s*\|\s*✅/i],
    },
    {
      label: "Release readiness report delivered",
      patterns: [
        /Release readiness report delivered\s*\|\s*✅/i,
        /\*\*Release readiness report delivered\*\*\s*\|\s*✅/i,
      ],
    },
    {
      label: "Human QA approved",
      patterns: [/Human QA approved\s*\|\s*✅/i, /\*\*Human QA approved\*\*\s*\|\s*✅/i],
    },
    {
      label: "Founder staging approval",
      patterns: [/Founder staging approval\s*\|\s*✅/i, /\*\*Founder staging approval\*\*\s*\|\s*✅/i],
    },
    {
      label: "Commit approval",
      patterns: [/Approved — commit v[\d.]+[^\n]*\|\s*✅/i],
    },
    {
      label: "Tag approval",
      patterns: [/Approved — tag v[\d.]+[^\n]*\|\s*✅/i],
    },
    {
      label: "Push approval",
      patterns: [/Approved — push v[\d.]+[^\n]*\|\s*✅/i],
    },
    {
      label: "Deploy approval",
      patterns: [/Approved — deploy v[\d.]+[^\n]*\|\s*✅/i],
    },
  ],
};

function parseArgs(): { releasePath: string; phase: Phase } {
  const args = process.argv.slice(2);
  let releasePath = "";
  let phase: Phase = "internal";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--release" && args[i + 1]) {
      releasePath = args[++i];
    } else if (args[i] === "--phase" && args[i + 1]) {
      const p = args[++i] as Phase;
      if (!["internal", "staging", "production"].includes(p)) {
        console.error(`Invalid phase: ${p}`);
        process.exit(1);
      }
      phase = p;
    }
  }

  if (!releasePath) {
    console.error("Usage: npx tsx scripts/verify-release-gates.ts --release <path> --phase internal|staging|production");
    process.exit(1);
  }

  return { releasePath, phase };
}

function countIncompleteCheckboxes(content: string): number {
  return (content.match(/\|\s*⬜\s*\|/g) ?? []).length;
}

function main() {
  const { releasePath, phase } = parseArgs();
  const absPath = join(ROOT, releasePath);

  if (!existsSync(absPath)) {
    console.error(`FAIL  Release file not found: ${releasePath}`);
    console.error("      Copy features/releases/templates/RELEASE-vX.Y.Z-TEMPLATE.md first.");
    process.exit(1);
  }

  const content = readFileSync(absPath, "utf8");
  const versionMatch = releasePath.match(/RELEASE-(v[\d.]+)\.md/i);
  const version = versionMatch?.[1] ?? "vX.Y.Z";

  console.log(`\nRelease gate check: ${version} — phase "${phase}"`);
  console.log(`File: ${releasePath}\n`);

  // Block if status is rolled-back or draft without explicit override
  if (/Status:.*rolled-back/i.test(content)) {
    console.error("FAIL  Release status is rolled-back. Create a new release file for redeploy.");
    process.exit(1);
  }

  const incomplete = countIncompleteCheckboxes(content);
  const checks = GATE_CHECKS[phase];

  let failed = 0;

  for (const { label, patterns } of checks) {
    const passed = patterns.some((p) => p.test(content));
    if (passed) {
      console.log(`PASS  ${label}`);
    } else {
      console.log(`FAIL  ${label} — mark ✅ in release file after sign-off`);
      failed++;
    }
  }

  // Staging/production: require iPhone post-login gate for web releases
  if (phase !== "internal") {
    const postLoginGate =
      /Post-login not black.*\|\s*✅/i.test(content) ||
      /Post-login screen not black.*✅/i.test(content) ||
      /iPhone Safari login → feed.*\|\s*✅/i.test(content);
    if (postLoginGate) {
      console.log("PASS  iPhone Safari post-login (no black screen)");
    } else {
      console.log("FAIL  iPhone Safari post-login — required since v1.0.0 incident");
      failed++;
    }
  }

  // Warn on remaining unchecked items in phase sections
  if (incomplete > 0 && phase !== "internal") {
    console.log(`\nWARN  ${incomplete} unchecked ⬜ items remain in release file`);
    if (phase === "production" && incomplete > 10) {
      console.log("FAIL  Too many incomplete checklist items for production deploy");
      failed++;
    }
  }

  console.log("");
  if (failed > 0) {
    console.log(`BLOCKED  ${failed} gate(s) failed — deploy not allowed`);
    console.log("         Complete checklists in features/releases/checklists/ and update release file.");
    process.exit(1);
  }

  console.log(`OK  All ${phase} gates passed — deploy may proceed (Founder approval still required)`);
}

main();
