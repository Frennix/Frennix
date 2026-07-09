#!/usr/bin/env node
/**
 * Verify client diagnostics + resilient error handling.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function assertIncludes(haystack, needle, label) {
  if (!haystack.includes(needle)) throw new Error(`${label}: missing "${needle}"`);
}

assertIncludes(read("lib/client-diagnostics.ts"), "logApiDiagnostic", "diagnostics api logging");
assertIncludes(read("lib/startup-snapshot-log.ts"), "frennix-startup-snapshot", "startup snapshot logging");
assertIncludes(read("lib/safe-pathname.ts"), "isMessagesRoute", "safe pathname helper");
assertIncludes(read("providers/TabBadgeProvider.tsx"), "isMessagesRoute", "tab badge pathname guard");
assertIncludes(read("components/StartupSnapshotBootstrap.tsx"), "snapshot:interval", "startup snapshot bootstrap");
assertIncludes(read("lib/report-client-error.ts"), "submitCrashReport", "auto crash report");
assertIncludes(read("components/SectionErrorBoundary.tsx"), "This section could not load", "section boundary");
assertIncludes(read("components/ClientDiagnosticsBootstrap.tsx"), "unhandledrejection", "global handlers");
assertIncludes(read("app/beta-diagnostics.tsx"), "Copy full report", "beta diagnostics screen");
assertIncludes(read("app/(tabs)/index.tsx"), "TabScreenBoundary", "feed tab isolation");
assertIncludes(read("providers/AuthProvider.tsx"), "kept cached profile after getProfile failure", "auth cache resilience");
assertIncludes(read("packages/api/src/crash-reports.ts"), "type: \"crash\"", "crash report api");
assertIncludes(read("supabase/migrations/20260708000002_beta_feedback_crash_diagnostics.sql"), "type = 'crash'", "crash db constraint");

console.log("verify-client-diagnostics: all checks passed");
