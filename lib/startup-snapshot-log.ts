/**
 * Temporary startup snapshot logging for the login black-screen incident.
 * Records environment + auth + DOM state to console, local storage, Sentry, and analytics.
 */
import { Platform } from "react-native";
import { logDiagnostic } from "@/lib/client-diagnostics";
import { trackAnalyticsEvent } from "@/lib/product-analytics";
import { Sentry } from "@/lib/sentry";
import { isIosSafariBrowser, isIosWebDevice, isWebStandalone } from "@/lib/pwa";
import { safePathname } from "@/lib/safe-pathname";
import { hasPersistedAuthToken } from "@/lib/auth-storage";
import { getStartupMountEvents } from "@/lib/startup-mount-trace";

const STORAGE_KEY = "frennix:startupSnapshots";
const MAX_SNAPSHOTS = 40;
const SERVER_FLUSH_COOLDOWN_MS = 15_000;

export type StartupSnapshotPhase =
  | "app:mount"
  | "auth:init:start"
  | "auth:init:end"
  | "auth:session:loaded"
  | "auth:session:invalid"
  | "login:render:start"
  | "login:render:end"
  | "login:failure"
  | "snapshot:interval"
  | "snapshot:route-change"
  | "snapshot:auth-change"
  | "snapshot:black-screen"
  | "snapshot:error";

export type StartupAuthState = {
  authReady: boolean;
  loading: boolean;
  profileLoading: boolean;
  hasSession: boolean;
  hasProfile: boolean;
  hasPersistedToken: boolean;
  passwordRecovery: boolean;
  userId?: string;
};

export type StartupEnvironment = {
  deviceType: "iphone" | "ipad" | "ipod" | "android" | "desktop" | "unknown";
  browser: "safari" | "chrome" | "firefox" | "edge" | "other" | "unknown";
  iosVersion: string | null;
  displayMode: "pwa_standalone" | "safari_browser" | "browser_tab" | "native" | "unknown";
  isPrivateBrowsing: boolean | null;
  userAgent: string | null;
  viewport: { width: number; height: number } | null;
};

export type StartupDomState = {
  route: string;
  href: string;
  bootOverlayPresent: boolean;
  bootOverlayVisible: boolean;
  loginScreenPresent: boolean;
  loginMounted: boolean;
  retryScreenPresent: boolean;
  failureScreenPresent: boolean;
  rootChildCount: number;
  rootTextLength: number;
  inputCount: number;
  passwordInputVisible: boolean;
  bodyTextPreview: string;
  blackScreenSuspected: boolean;
};

export type StartupSnapshot = {
  id: string;
  phase: StartupSnapshotPhase;
  at: string;
  elapsedMs: number;
  environment: StartupEnvironment;
  auth: StartupAuthState | null;
  dom: StartupDomState;
  mountTraceTail: string[];
  uncaughtErrors: StartupCapturedError[];
  detail?: Record<string, unknown>;
};

export type StartupCapturedError = {
  at: string;
  type: "error" | "unhandledrejection";
  message: string;
  stack?: string;
  filename?: string;
  lineno?: number;
};

const capturedErrors: StartupCapturedError[] = [];
const snapshots: StartupSnapshot[] = [];
const serverFlushAt = new Map<string, number>();
let bootMark = typeof performance !== "undefined" ? performance.now() : Date.now();
let installed = false;

function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function nextSnapshotId(phase: StartupSnapshotPhase) {
  return `${phase}-${Date.now()}-${snapshots.length + 1}`;
}

function detectPrivateBrowsing(): boolean | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const probe = "__frennix_private_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return false;
  } catch {
    return true;
  }
}

export function parseWebEnvironment(): StartupEnvironment {
  if (Platform.OS !== "web" || typeof navigator === "undefined") {
    return {
      deviceType: "unknown",
      browser: "unknown",
      iosVersion: Platform.Version != null ? String(Platform.Version) : null,
      displayMode: "native",
      isPrivateBrowsing: null,
      userAgent: null,
      viewport: null,
    };
  }

  const ua = navigator.userAgent ?? "";
  let deviceType: StartupEnvironment["deviceType"] = "unknown";
  if (/iPhone/.test(ua)) deviceType = "iphone";
  else if (/iPad/.test(ua)) deviceType = "ipad";
  else if (/iPod/.test(ua)) deviceType = "ipod";
  else if (/Android/.test(ua)) deviceType = "android";
  else if (ua) deviceType = "desktop";

  let browser: StartupEnvironment["browser"] = "other";
  if (/Edg\//.test(ua)) browser = "edge";
  else if (/Firefox\//.test(ua)) browser = "firefox";
  else if (/CriOS|Chrome\//.test(ua)) browser = "chrome";
  else if (/Safari\//.test(ua)) browser = "safari";

  const iosMatch = ua.match(/OS (\d+[_\d]*)/);
  const iosVersion = iosMatch ? iosMatch[1].replace(/_/g, ".") : null;

  let displayMode: StartupEnvironment["displayMode"] = "browser_tab";
  if (isWebStandalone()) displayMode = "pwa_standalone";
  else if (isIosSafariBrowser()) displayMode = "safari_browser";

  return {
    deviceType,
    browser,
    iosVersion,
    displayMode,
    isPrivateBrowsing: detectPrivateBrowsing(),
    userAgent: ua || null,
    viewport:
      typeof window !== "undefined"
        ? { width: window.innerWidth, height: window.innerHeight }
        : null,
  };
}

export function collectDomStartupState(route = ""): StartupDomState {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return {
      route,
      href: route,
      bootOverlayPresent: false,
      bootOverlayVisible: false,
      loginScreenPresent: false,
      loginMounted: false,
      retryScreenPresent: false,
      failureScreenPresent: false,
      rootChildCount: 0,
      rootTextLength: 0,
      inputCount: 0,
      passwordInputVisible: false,
      bodyTextPreview: "",
      blackScreenSuspected: false,
    };
  }

  const shell = document.getElementById("frennix-boot-shell");
  const login = document.getElementById("auth-login-screen");
  const retry = document.getElementById("startup-retry-screen");
  const failure = document.getElementById("login-failure-screen");
  const authFallback = document.getElementById("authenticated-startup-fallback");
  const feedTab = document.getElementById("feed-tab-scene");
  const feedRoot = document.getElementById("feed-root-container");
  const onboarding = document.getElementById("onboarding-screen");
  const root = document.getElementById("root");
  const passwordInput = [...document.querySelectorAll("input")].find((el) => el.type === "password");
  const passwordRect = passwordInput?.getBoundingClientRect();
  const bodyText = document.body.innerText.replace(/\s+/g, " ").trim();
  const loginMounted = getStartupMountEvents().some((event) => event.id === "auth-login:mounted");
  const bootOverlayVisible = Boolean(shell && shell.style.display !== "none");
  const passwordInputVisible = Boolean(
    passwordRect && passwordRect.height > 5 && passwordRect.width > 20 && passwordRect.top < window.innerHeight
  );

  const blackScreenSuspected =
    (!bootOverlayVisible &&
      !login &&
      !retry &&
      !failure &&
      !authFallback &&
      !onboarding &&
      bodyText.length < 20 &&
      (root?.childElementCount ?? 0) <= 1) ||
    (Boolean(feedTab) &&
      (feedRoot?.getBoundingClientRect().height ?? 0) <= 1 &&
      !/STORIES|Share workout|Your feed is ready|Could not load feed|This section could not load/i.test(bodyText));

  return {
    route: route || safePathname(typeof window !== "undefined" ? window.location.pathname : ""),
    href: typeof window !== "undefined" ? window.location.href : safePathname(route),
    bootOverlayPresent: Boolean(shell),
    bootOverlayVisible,
    loginScreenPresent: Boolean(login),
    loginMounted,
    retryScreenPresent: Boolean(retry),
    failureScreenPresent: Boolean(failure),
    rootChildCount: root?.childElementCount ?? 0,
    rootTextLength: root?.innerText?.length ?? 0,
    inputCount: document.querySelectorAll("input").length,
    passwordInputVisible,
    bodyTextPreview: bodyText.slice(0, 160),
    blackScreenSuspected,
  };
}

function persistSnapshotsLocally() {
  if (Platform.OS !== "web" || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots.slice(-MAX_SNAPSHOTS)));
  } catch {
    // Private mode or quota — console/window copies still available.
  }
  (window as Window & { __FRENNIX_STARTUP_SNAPSHOTS__?: StartupSnapshot[] }).__FRENNIX_STARTUP_SNAPSHOTS__ =
    [...snapshots];
}

function shouldSendToServer(phase: StartupSnapshotPhase): boolean {
  if (phase === "snapshot:interval") return false;
  const last = serverFlushAt.get(phase) ?? 0;
  if (Date.now() - last < SERVER_FLUSH_COOLDOWN_MS) return false;
  serverFlushAt.set(phase, Date.now());
  return true;
}

function sendSnapshotToServer(snapshot: StartupSnapshot) {
  if (!shouldSendToServer(snapshot.phase)) return;

  const payload = {
    snapshot_id: snapshot.id,
    phase: snapshot.phase,
    device_type: snapshot.environment.deviceType,
    browser: snapshot.environment.browser,
    ios_version: snapshot.environment.iosVersion,
    display_mode: snapshot.environment.displayMode,
    is_private_browsing: snapshot.environment.isPrivateBrowsing,
    route: snapshot.dom.route,
    auth_ready: snapshot.auth?.authReady ?? null,
    has_session: snapshot.auth?.hasSession ?? null,
    has_profile: snapshot.auth?.hasProfile ?? null,
    has_persisted_token: snapshot.auth?.hasPersistedToken ?? null,
    login_mounted: snapshot.dom.loginMounted,
    boot_overlay_visible: snapshot.dom.bootOverlayVisible,
    black_screen_suspected: snapshot.dom.blackScreenSuspected,
    password_input_visible: snapshot.dom.passwordInputVisible,
    mount_trace_tail: snapshot.mountTraceTail,
    uncaught_error_count: snapshot.uncaughtErrors.length,
    body_text_preview: snapshot.dom.bodyTextPreview,
    ...snapshot.detail,
  };

  trackAnalyticsEvent("startup_snapshot", payload);

  try {
    if (snapshot.phase === "snapshot:black-screen" || snapshot.phase === "login:failure") {
      Sentry.captureMessage(`[startup] ${snapshot.phase}`, {
        level: "error",
        extra: payload,
      });
    } else if (snapshot.uncaughtErrors.length > 0) {
      Sentry.captureMessage(`[startup] ${snapshot.phase} with errors`, {
        level: "warning",
        extra: payload,
      });
    }
  } catch {
    // Sentry optional
  }
}

export function getStartupSnapshots(): readonly StartupSnapshot[] {
  return snapshots;
}

export function getStartupCapturedErrors(): readonly StartupCapturedError[] {
  return capturedErrors;
}

export function recordStartupSnapshot(
  phase: StartupSnapshotPhase,
  input?: {
    auth?: StartupAuthState | null;
    route?: string;
    detail?: Record<string, unknown>;
  }
) {
  const mountTraceTail = getStartupMountEvents().slice(-12).map((event) => event.id);
  const snapshot: StartupSnapshot = {
    id: nextSnapshotId(phase),
    phase,
    at: new Date().toISOString(),
    elapsedMs: Math.round(nowMs() - bootMark),
    environment: parseWebEnvironment(),
    auth: input?.auth ?? null,
    dom: collectDomStartupState(input?.route),
    mountTraceTail,
    uncaughtErrors: [...capturedErrors],
    detail: input?.detail,
  };

  snapshots.push(snapshot);
  if (snapshots.length > MAX_SNAPSHOTS) snapshots.shift();

  const line = `[frennix-startup-snapshot] ${JSON.stringify({
    phase: snapshot.phase,
    at: snapshot.at,
    elapsedMs: snapshot.elapsedMs,
    environment: snapshot.environment,
    auth: snapshot.auth,
    dom: snapshot.dom,
    mountTraceTail: snapshot.mountTraceTail,
    uncaughtErrors: snapshot.uncaughtErrors,
    detail: snapshot.detail,
  })}`;

  if (
    phase === "login:failure" ||
    phase === "snapshot:black-screen" ||
    snapshot.uncaughtErrors.length > 0
  ) {
    console.error(line);
  } else {
    console.info(line);
  }

  logDiagnostic("startup-snapshot", phase, snapshot.dom.blackScreenSuspected ? "error" : "info", {
    snapshot_id: snapshot.id,
    elapsed_ms: snapshot.elapsedMs,
    environment: snapshot.environment,
    auth: snapshot.auth,
    dom: snapshot.dom,
    mount_trace_tail: snapshot.mountTraceTail,
    uncaught_errors: snapshot.uncaughtErrors,
    detail: snapshot.detail,
  });

  persistSnapshotsLocally();
  sendSnapshotToServer(snapshot);

  if (
    snapshot.phase === "snapshot:black-screen" ||
    snapshot.phase === "login:failure" ||
    (snapshot.dom.blackScreenSuspected && snapshot.auth?.hasSession)
  ) {
    void import("@/lib/auto-startup-diagnostic-report").then(({ sendStartupDiagnosticReport }) =>
      sendStartupDiagnosticReport({
        source: `startup-snapshot:${snapshot.phase}`,
        reason:
          snapshot.phase === "snapshot:black-screen"
            ? "Black screen suspected after authentication"
            : `Startup snapshot ${snapshot.phase}`,
        userId: snapshot.auth?.userId,
        screen: snapshot.dom.route,
        extra: {
          snapshot_id: snapshot.id,
          black_screen_suspected: snapshot.dom.blackScreenSuspected,
          mount_trace_tail: snapshot.mountTraceTail,
          body_text_preview: snapshot.dom.bodyTextPreview,
        },
      })
    );
  }

  if (snapshot.dom.blackScreenSuspected && phase !== "snapshot:black-screen") {
    recordStartupSnapshot("snapshot:black-screen", {
      auth: input?.auth ?? null,
      route: input?.route,
      detail: { triggered_by: phase },
    });
  }

  return snapshot;
}

export function recordStartupCapturedError(
  type: StartupCapturedError["type"],
  error: unknown,
  meta?: { filename?: string; lineno?: number }
) {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : JSON.stringify(error);

  const entry: StartupCapturedError = {
    at: new Date().toISOString(),
    type,
    message: message.slice(0, 500),
    stack: error instanceof Error ? error.stack : undefined,
    filename: meta?.filename,
    lineno: meta?.lineno,
  };

  capturedErrors.push(entry);
  if (capturedErrors.length > 20) capturedErrors.shift();

  console.error(`[frennix-startup-error] ${JSON.stringify(entry)}`);
  logDiagnostic("startup-error", message, "error", entry);
  recordStartupSnapshot("snapshot:error", { detail: { error: entry } });
}

export function installStartupSnapshotCapture() {
  if (installed || Platform.OS !== "web" || typeof window === "undefined") return;
  installed = true;
  bootMark = nowMs();

  window.addEventListener("error", (event) => {
    recordStartupCapturedError("error", event.error ?? new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    recordStartupCapturedError("unhandledrejection", event.reason);
  });
}

/** Build auth snapshot from AuthProvider values. */
export function buildStartupAuthState(input: {
  session: { user: { id: string } } | null;
  profile: unknown | null;
  authReady: boolean;
  loading: boolean;
  profileLoading: boolean;
  passwordRecovery: boolean;
}): StartupAuthState {
  return {
    authReady: input.authReady,
    loading: input.loading,
    profileLoading: input.profileLoading,
    hasSession: Boolean(input.session),
    hasProfile: Boolean(input.profile),
    hasPersistedToken: hasPersistedAuthToken(),
    passwordRecovery: input.passwordRecovery,
    userId: input.session?.user.id,
  };
}

/** Backwards-compatible step logger used across startup code. */
export function logStartupStep(
  step: StartupSnapshotPhase,
  detail?: Record<string, unknown>,
  auth?: StartupAuthState | null
) {
  console.info(`[frennix-startup] ${step}${detail ? ` ${JSON.stringify(detail)}` : ""}`);
  recordStartupSnapshot(step, { auth, detail });
}
