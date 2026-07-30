#!/usr/bin/env node
/**
 * Password visibility toggle — static checks.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function record(results, name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function main() {
  const results = [];
  const passwordInput = read("packages/ui/src/PasswordInput.tsx");
  const login = read("app/(auth)/login.tsx");
  const signup = read("app/(auth)/signup.tsx");
  const reset = read("app/reset-password.tsx");
  const bootstrap = read("app/founder/bootstrap.tsx");
  const barrel = read("packages/ui/src/index.ts");

  record(results, "PasswordInput exported from UI barrel", barrel.includes('export * from "./PasswordInput"'));
  record(results, "PasswordInput uses eye toggle icons", /EyeOff/.test(passwordInput) && /Eye/.test(passwordInput));
  record(
    results,
    "PasswordInput accessibility labels",
    passwordInput.includes('"Hide password"') && passwordInput.includes('"Show password"')
  );
  record(
    results,
    "PasswordInput reserves right padding for icon",
    /paddingRight:\s*INPUT_PADDING_RIGHT/.test(passwordInput)
  );
  record(results, "Login uses PasswordInput", login.includes("PasswordInput") && !login.includes("secureTextEntry"));
  record(results, "Signup uses PasswordInput", signup.includes("PasswordInput") && !signup.includes("secureTextEntry"));
  record(
    results,
    "Reset password uses PasswordInput for both fields",
    (reset.match(/PasswordInput/g) ?? []).length >= 2
  );
  record(results, "Founder bootstrap uses PasswordInput", bootstrap.includes("PasswordInput"));

  const secureOutsideComponent = [login, signup, reset, bootstrap].some((source) =>
    /secureTextEntry/.test(source)
  );
  record(results, "Auth screens avoid raw secureTextEntry", !secureOutsideComponent);

  const failed = results.filter((r) => !r.ok);
  if (failed.length) process.exit(1);
  console.log("\nAll password visibility checks passed.");
}

main();
