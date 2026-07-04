import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = join(import.meta.dirname, "..");

/** Files that mount immediately after login (tabs stay mounted: lazy: false). */
const ENTRY_POINTS = [
  "app/(tabs)/_layout.tsx",
  "app/(tabs)/index.tsx",
  "app/(tabs)/discover.tsx",
  "app/(tabs)/events.tsx",
  "app/(tabs)/create.tsx",
  "app/(tabs)/messages.tsx",
  "app/(tabs)/profile.tsx",
  "components/TabPrefetchCoordinator.tsx",
  "providers/AuthProvider.tsx",
  "providers/TabBadgeProvider.tsx",
];

function read(relativePath: string) {
  return readFileSync(join(ROOT, relativePath), "utf8");
}

function resolveImport(specifier: string, fromFile: string): string | null {
  const candidates: string[] = [];

  if (specifier.startsWith("@/")) {
    const base = specifier.slice(2);
    candidates.push(
      `${base}.tsx`,
      `${base}.ts`,
      join(base, "index.tsx"),
      join(base, "index.ts")
    );
  } else if (specifier.startsWith(".")) {
    const base = join(dirname(fromFile), specifier);
    candidates.push(
      `${base}.tsx`,
      `${base}.ts`,
      join(base, "index.tsx"),
      join(base, "index.ts")
    );
  } else {
    return null;
  }

  for (const candidate of candidates) {
    const full = join(ROOT, candidate);
    if (existsSync(full) && statSync(full).isFile()) {
      return candidate;
    }
  }
  return null;
}

function extractImports(source: string): string[] {
  const specs: string[] = [];
  const patterns = [
    /from\s+["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      specs.push(match[1]);
    }
  }
  return specs;
}

function collectPostLoginShellFiles(): Set<string> {
  const files = new Set<string>();
  const queue = [...ENTRY_POINTS];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (files.has(current)) continue;
    if (!existsSync(join(ROOT, current))) continue;
    files.add(current);

    const source = read(current);
    for (const spec of extractImports(source)) {
      const resolved = resolveImport(spec, current);
      if (resolved && !files.has(resolved)) {
        queue.push(resolved);
      }
    }
  }

  return files;
}

function collectTs2304Errors(): Array<{ file: string; line: number; message: string }> {
  let output = "";
  try {
    execSync("npx tsc --noEmit", { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    output = `${err.stdout ?? ""}\n${err.stderr ?? ""}`;
  }

  const errors: Array<{ file: string; line: number; message: string }> = [];
  for (const line of output.split("\n")) {
    const match = line.match(/^(.+?)\((\d+),(\d+)\): error TS2304: (.+)$/);
    if (!match) continue;
    const [, filePath, lineNo, , message] = match;
    errors.push({
      file: relative(ROOT, filePath),
      line: Number(lineNo),
      message,
    });
  }
  return errors;
}

export function auditPostLoginShell(): {
  ok: boolean;
  messages: string[];
  shellFileCount: number;
} {
  const shellFiles = collectPostLoginShellFiles();
  const ts2304 = collectTs2304Errors().filter((error) => shellFiles.has(error.file));
  const messages = ts2304.map(
    (error) => `${error.file}:${error.line} TS2304 ${error.message}`
  );

  return { ok: messages.length === 0, messages, shellFileCount: shellFiles.size };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = auditPostLoginShell();
  if (result.ok) {
    console.log(
      `PASS  post-login shell (${result.shellFileCount} files) has no TS2304 undefined reference errors`
    );
    process.exit(0);
  }
  console.error(`FAIL  post-login shell reference errors (${result.shellFileCount} files scanned):`);
  for (const message of result.messages) {
    console.error(`  - ${message}`);
  }
  process.exit(1);
}
