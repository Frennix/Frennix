/** Temporary production diagnostics — remove after login black-screen incident is closed. */
export type StartupStep =
  | "app:mount"
  | "auth:init:start"
  | "auth:init:end"
  | "auth:session:loaded"
  | "auth:session:invalid"
  | "login:render:start"
  | "login:render:end"
  | "login:failure";

export function logStartupStep(step: StartupStep, detail?: Record<string, unknown>) {
  const payload = detail ? ` ${JSON.stringify(detail)}` : "";
  console.info(`[frennix-startup] ${step}${payload}`);

  if (typeof window === "undefined") return;
  const w = window as Window & {
    __FRENNIX_STARTUP_STEPS__?: Array<{ step: StartupStep; at: string; detail?: Record<string, unknown> }>;
  };
  const list = w.__FRENNIX_STARTUP_STEPS__ ?? [];
  list.push({ step, at: new Date().toISOString(), detail });
  w.__FRENNIX_STARTUP_STEPS__ = list;
}
