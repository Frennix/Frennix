import { Platform } from "react-native";
import { profileNeedsOnboardingRepair } from "@frennix/api";
import type { Profile } from "@frennix/types";
import { getBuildVersion } from "@/lib/build-version";
import { isSupabaseConfigured } from "@/lib/config";
import { hasPersistedAuthToken } from "@/lib/auth-storage";
import { safePathname } from "@/lib/safe-pathname";
import { isWebStandalone } from "@/lib/pwa";

export type PostLoginDiagnosticSnapshot = {
  route: string;
  href: string;
  authLoaded: boolean;
  profileLoaded: boolean;
  profileUsername: string | null;
  onboardingComplete: boolean | null;
  needsOnboardingRepair: boolean | null;
  repairReason: string | null;
  activeTab: string | null;
  feedTabSceneH: number;
  feedRootH: number;
  feedScrollH: number;
  feedContentMounted: boolean;
  feedMeaningfulText: boolean;
  bootShellVisible: boolean;
  blackScreenSuspected: boolean;
  supabaseConfigured: boolean;
  hasPersistedToken: boolean;
  displayMode: string;
  buildLine: string;
  bodyPreview: string;
  mountTraceTail: string[];
};

function rectH(id: string): number {
  if (typeof document === "undefined") return 0;
  const el = document.getElementById(id);
  if (!el) return -1;
  return Math.round(el.getBoundingClientRect().height);
}

function readActiveTab(): string | null {
  if (typeof document === "undefined") return null;
  const selected = document.querySelector('[role="tab"][aria-selected="true"]');
  if (!selected) return null;
  return (selected.textContent ?? "").replace(/\s+/g, " ").trim() || null;
}

function readRepair(profile: Profile | null | undefined): {
  needs: boolean | null;
  reason: string | null;
} {
  if (!profile) return { needs: null, reason: null };
  try {
    const needs = profileNeedsOnboardingRepair(profile);
    return { needs, reason: needs ? "profileNeedsOnboardingRepair" : null };
  } catch (error) {
    return { needs: null, reason: error instanceof Error ? error.message : "repair-check-failed" };
  }
}

export function collectPostLoginDiagnosticSnapshot(input: {
  authReady: boolean;
  hasSession: boolean;
  profile: Profile | null | undefined;
  route?: string;
  mountTraceTail?: string[];
}): PostLoginDiagnosticSnapshot {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return {
      route: input.route ?? "/",
      href: "",
      authLoaded: input.authReady && input.hasSession,
      profileLoaded: Boolean(input.profile),
      profileUsername: input.profile?.username ?? null,
      onboardingComplete: input.profile?.onboarding_complete ?? null,
      needsOnboardingRepair: null,
      repairReason: null,
      activeTab: null,
      feedTabSceneH: 0,
      feedRootH: 0,
      feedScrollH: 0,
      feedContentMounted: false,
      feedMeaningfulText: false,
      bootShellVisible: false,
      blackScreenSuspected: false,
      supabaseConfigured: isSupabaseConfigured(),
      hasPersistedToken: false,
      displayMode: "native",
      buildLine: formatBuildVersionLine(),
      bodyPreview: "",
      mountTraceTail: input.mountTraceTail ?? [],
    };
  }

  const bodyText = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
  const feedTabSceneH = rectH("feed-tab-scene");
  const feedRootH = rectH("feed-root-container");
  const feedScrollH = rectH("feed-scroll-list");
  const feedContentMounted = feedRootH > 0 || Boolean(document.getElementById("feed-root-container"));
  const feedMeaningfulText = /STORIES|Share workout|Your feed is ready|Could not load feed|section could not load/i.test(
    bodyText
  );
  const boot = document.getElementById("frennix-boot-shell");
  const bootShellVisible = Boolean(boot && getComputedStyle(boot).display !== "none");
  const repair = readRepair(input.profile);

  const blackScreenSuspected =
    input.authReady &&
    input.hasSession &&
    Boolean(input.profile) &&
    (input.profile?.onboarding_complete ?? false) &&
    !repair.needs &&
    !bootShellVisible &&
    feedTabSceneH > 80 &&
    feedRootH <= 1 &&
    !feedMeaningfulText;

  return {
    route: input.route ?? safePathname(window.location.pathname),
    href: window.location.href,
    authLoaded: input.authReady && input.hasSession,
    profileLoaded: Boolean(input.profile),
    profileUsername: input.profile?.username ?? null,
    onboardingComplete: input.profile?.onboarding_complete ?? null,
    needsOnboardingRepair: repair.needs,
    repairReason: repair.reason,
    activeTab: readActiveTab(),
    feedTabSceneH,
    feedRootH,
    feedScrollH,
    feedContentMounted,
    feedMeaningfulText,
    bootShellVisible,
    blackScreenSuspected,
    supabaseConfigured: isSupabaseConfigured(),
    hasPersistedToken: hasPersistedAuthToken(),
    displayMode: isWebStandalone() ? "pwa_standalone" : "browser",
    buildLine: formatBuildVersionLine(),
    bodyPreview: bodyText.slice(0, 140),
    mountTraceTail: input.mountTraceTail ?? [],
  };
}

function formatBuildVersionLine(): string {
  const v = getBuildVersion();
  return `${v.sha} · ${v.bundle} · sw:${v.swVersion}`;
}
