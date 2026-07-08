export type WebPushLogEntry = {
  ts: number;
  step: string;
  detail: string;
  data?: unknown;
};

const MAX_LOGS = 120;
const logs: WebPushLogEntry[] = [];
const listeners = new Set<() => void>();

export function pushLog(step: string, detail: string, data?: unknown) {
  const entry: WebPushLogEntry = { ts: Date.now(), step, detail, data };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
  console.log(`[frennix-web-push] ${step} — ${detail}`, data ?? "");
  listeners.forEach((listener) => listener());
}

export function getPushLogs(): WebPushLogEntry[] {
  return [...logs];
}

export function clearPushLogs() {
  logs.length = 0;
  listeners.forEach((listener) => listener());
}

export function subscribePushLogs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function formatPushLogEntry(entry: WebPushLogEntry): string {
  const time = new Date(entry.ts).toISOString().slice(11, 23);
  const data =
    entry.data === undefined
      ? ""
      : ` | ${typeof entry.data === "string" ? entry.data : JSON.stringify(entry.data)}`;
  return `${time} [${entry.step}] ${entry.detail}${data}`;
}

export function formatPushError(error: unknown): Record<string, unknown> {
  if (error instanceof DOMException) {
    return {
      type: "DOMException",
      name: error.name,
      message: error.message,
      code: error.code,
    };
  }
  if (error instanceof Error) {
    return {
      type: error.constructor.name,
      name: error.name,
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 3).join(" | "),
    };
  }
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      type: "object",
      message: record.message ? String(record.message) : String(error),
      code: record.code ? String(record.code) : undefined,
      details: record.details ? String(record.details) : undefined,
      hint: record.hint ? String(record.hint) : undefined,
    };
  }
  return { type: typeof error, message: String(error) };
}
