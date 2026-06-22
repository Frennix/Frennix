import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as Linking from "expo-linking";
import type { Profile } from "@frennix/types";
import { getProfile, getSession, onAuthStateChange, signOut as supabaseSignOut } from "@frennix/api";
import type { Session } from "@supabase/supabase-js";
import { isWebRecoveryHash, clearWebRecoveryHash } from "@/lib/auth-redirect";
import { isSupabaseConfigured } from "@/lib/config";
import { ensureSupabaseInitialized } from "@/lib/init-supabase";
import { registerForPushNotifications } from "@/lib/notifications";
import { establishSessionFromUrl, urlLooksLikePasswordRecovery } from "@/lib/recovery-session";
import { startPresenceTracking, stopPresenceTracking } from "@/lib/presence";

/** Grace period while Supabase refreshes the session after tab resume (ms). */
const SESSION_RECOVERY_MS = 1500;

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  refreshProfile: (userIdOrProfile?: string | Profile) => Promise<void>;
  applySession: (session: Session | null) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  ensureSupabaseInitialized();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(() => isWebRecoveryHash());
  const passwordRecoveryRef = useRef(passwordRecovery);
  const authEpochRef = useRef(0);
  const signOutInProgressRef = useRef(false);
  const sessionRef = useRef<Session | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    passwordRecoveryRef.current = passwordRecovery;
  }, [passwordRecovery]);

  const clearPasswordRecovery = useCallback(() => {
    passwordRecoveryRef.current = false;
    setPasswordRecovery(false);
  }, []);

  const refreshProfile = useCallback(async (userIdOrProfile?: string | Profile) => {
    if (userIdOrProfile && typeof userIdOrProfile === "object") {
      setProfile(userIdOrProfile);
      return;
    }

    const id =
      (typeof userIdOrProfile === "string" ? userIdOrProfile : undefined) ?? session?.user.id;
    if (!id) return;

    const p = await getProfile(id);
    setProfile(p);
  }, [session?.user.id]);

  const signOut = useCallback(async () => {
    authEpochRef.current += 1;
    signOutInProgressRef.current = true;
    const userId = sessionRef.current?.user?.id ?? null;
    try {
      await stopPresenceTracking(true, "auth-signOut", userId);
      await supabaseSignOut();
      setSession(null);
      setProfile(null);
      setPasswordRecovery(false);
      setLoading(false);
    } finally {
      signOutInProgressRef.current = false;
    }
  }, []);

  const applySession = useCallback(async (nextSession: Session | null) => {
    const epoch = authEpochRef.current;

    if (!nextSession && sessionRef.current?.user?.id && !signOutInProgressRef.current) {
      await new Promise((resolve) => setTimeout(resolve, SESSION_RECOVERY_MS));
      if (epoch !== authEpochRef.current) return;
      if (signOutInProgressRef.current) return;

      try {
        const recovered = await getSession();
        if (recovered && !signOutInProgressRef.current) {
          nextSession = recovered;
        }
      } catch {
        // Fall through to signed-out handling.
      }
    }

    if (epoch !== authEpochRef.current) return;

    setSession(nextSession);
    if (nextSession?.user.id) {
      try {
        const p = await getProfile(nextSession.user.id);
        if (epoch !== authEpochRef.current) return;
        setProfile(p);
      } catch (e) {
        if (epoch !== authEpochRef.current) return;
        console.error("[auth] getProfile failed after applySession", e);
        setProfile(null);
      }
      if (epoch !== authEpochRef.current) return;
      if (!passwordRecoveryRef.current) {
        startPresenceTracking(nextSession.user.id, "auth-session");
        registerForPushNotifications(nextSession.user.id).catch(() => undefined);
      } else {
        console.log("[presence] applySession skipped — password recovery mode", {
          userId: nextSession.user.id,
        });
      }
    } else {
      setProfile(null);
    }
    if (epoch === authEpochRef.current) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    async function handleRecoveryUrl(url: string) {
      if (!urlLooksLikePasswordRecovery(url)) return;
      try {
        const isRecovery = await establishSessionFromUrl(url);
        if (isRecovery) setPasswordRecovery(true);
      } catch {
        // Session may already be established via detectSessionInUrl on web.
      }
    }

    async function bootstrapAuth() {
      // Web recovery links carry tokens in the URL hash; Expo Linking omits the hash.
      if (typeof window !== "undefined" && isWebRecoveryHash()) {
        try {
          const isRecovery = await establishSessionFromUrl(window.location.href);
          if (isRecovery) {
            setPasswordRecovery(true);
            clearWebRecoveryHash();
          }
        } catch {
          // detectSessionInUrl may have already handled it.
        }
      }

      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) await handleRecoveryUrl(initialUrl);

      const s = await getSession();
      await applySession(s);
    }

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      void handleRecoveryUrl(url);
    });

    void bootstrapAuth().catch(() => setLoading(false));

    const { data: sub } = onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") {
        passwordRecoveryRef.current = true;
        setPasswordRecovery(true);
      } else if (event === "SIGNED_IN") {
        passwordRecoveryRef.current = false;
        setPasswordRecovery(false);
        clearWebRecoveryHash();
      }
      if (event === "SIGNED_OUT") {
        passwordRecoveryRef.current = false;
        setPasswordRecovery(false);

        const signedOutUserId = sessionRef.current?.user?.id ?? null;

        void (async () => {
          await new Promise((resolve) => setTimeout(resolve, SESSION_RECOVERY_MS));
          try {
            const recovered = await getSession();
            if (recovered) return;
          } catch {
            // Fall through to offline presence.
          }
          await stopPresenceTracking(true, "auth-signed-out", signedOutUserId);
        })();
      }
      // Token refresh on tab resume only updates the JWT; skip profile refetch + push re-register.
      if (event === "TOKEN_REFRESHED") {
        setSession(s);
        setLoading(false);
        return;
      }
      void applySession(s);
    });

    return () => {
      linkSub.remove();
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      passwordRecovery,
      clearPasswordRecovery,
      refreshProfile,
      applySession,
      signOut,
    }),
    [session, profile, loading, passwordRecovery, clearPasswordRecovery, refreshProfile, applySession, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
