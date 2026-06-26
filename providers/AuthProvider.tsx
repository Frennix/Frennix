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
import { AppState, Platform } from "react-native";
import * as Linking from "expo-linking";
import type { Profile } from "@frennix/types";
import { getProfile, getSession, onAuthStateChange, signOut as supabaseSignOut } from "@frennix/api";
import type { Session } from "@supabase/supabase-js";
import { isWebRecoveryHash, clearWebRecoveryHash } from "@/lib/auth-redirect";
import {
  clearCachedProfile,
  readCachedProfile,
  writeCachedProfile,
} from "@/lib/auth-profile-cache";
import { isSupabaseConfigured } from "@/lib/config";
import { ensureSupabaseInitialized } from "@/lib/init-supabase";
import { registerForPushNotifications } from "@/lib/notifications";
import { establishSessionFromUrl, urlLooksLikePasswordRecovery } from "@/lib/recovery-session";
import { startPresenceTracking, stopPresenceTracking } from "@/lib/presence";

/** Grace period while Supabase refreshes the session after tab resume (ms). */
const SESSION_RECOVERY_MS = 1500;

/** Minimum time hidden before treating the next show as a resume (ms). */
const RESUME_HIDDEN_MS = 2000;

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  /** Initial auth bootstrap still running. */
  loading: boolean;
  /** Profile fetch in progress for the signed-in user. */
  profileLoading: boolean;
  /** Session is known and profile fetch (if needed) has finished — safe for routing. */
  authReady: boolean;
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
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(() => isWebRecoveryHash());
  const passwordRecoveryRef = useRef(passwordRecovery);
  const authEpochRef = useRef(0);
  const signOutInProgressRef = useRef(false);
  const sessionRef = useRef<Session | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const resolvedProfileUserIdRef = useRef<string | null>(null);
  const profileFetchRef = useRef<Promise<void> | null>(null);
  const profileFetchUserIdRef = useRef<string | null>(null);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    passwordRecoveryRef.current = passwordRecovery;
  }, [passwordRecovery]);

  const clearPasswordRecovery = useCallback(() => {
    passwordRecoveryRef.current = false;
    setPasswordRecovery(false);
  }, []);

  const loadProfileForUser = useCallback(
    async (userId: string, options?: { background?: boolean; epoch?: number }) => {
      const epoch = options?.epoch ?? authEpochRef.current;

      if (profileFetchUserIdRef.current === userId && profileFetchRef.current) {
        await profileFetchRef.current;
        return;
      }

      if (!options?.background) {
        setProfileLoading(true);
      }

      profileFetchUserIdRef.current = userId;
      const task = (async () => {
        try {
          const nextProfile = await getProfile(userId);
          if (epoch !== authEpochRef.current) return;
          setProfile(nextProfile);
          resolvedProfileUserIdRef.current = userId;
          writeCachedProfile(userId, nextProfile);
        } catch (error) {
          if (epoch !== authEpochRef.current) return;
          console.error("[auth] getProfile failed", error);
          setProfile(null);
          resolvedProfileUserIdRef.current = userId;
          writeCachedProfile(userId, null);
        } finally {
          if (!options?.background && epoch === authEpochRef.current) {
            setProfileLoading(false);
          }
        }
      })();

      profileFetchRef.current = task;
      try {
        await task;
      } finally {
        if (profileFetchRef.current === task) {
          profileFetchRef.current = null;
          profileFetchUserIdRef.current = null;
        }
      }
    },
    []
  );

  const refreshProfile = useCallback(
    async (userIdOrProfile?: string | Profile) => {
      if (userIdOrProfile && typeof userIdOrProfile === "object") {
        setProfile(userIdOrProfile);
        resolvedProfileUserIdRef.current = userIdOrProfile.id;
        writeCachedProfile(userIdOrProfile.id, userIdOrProfile);
        return;
      }

      const id =
        (typeof userIdOrProfile === "string" ? userIdOrProfile : undefined) ??
        sessionRef.current?.user.id;
      if (!id) return;

      await loadProfileForUser(id, { epoch: authEpochRef.current });
    },
    [loadProfileForUser]
  );

  const signOut = useCallback(async () => {
    authEpochRef.current += 1;
    signOutInProgressRef.current = true;
    const userId = sessionRef.current?.user?.id ?? null;
    try {
      await stopPresenceTracking(true, "auth-signOut", userId);
      await supabaseSignOut();
      setSession(null);
      setProfile(null);
      resolvedProfileUserIdRef.current = null;
      clearCachedProfile();
      setPasswordRecovery(false);
      setProfileLoading(false);
      setLoading(false);
    } finally {
      signOutInProgressRef.current = false;
    }
  }, []);

  const applySession = useCallback(
    async (nextSession: Session | null) => {
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
        const userId = nextSession.user.id;
        const sameUser = profileRef.current?.id === userId;
        const resolvedForUser = resolvedProfileUserIdRef.current === userId;

        if (!sameUser && !resolvedForUser) {
          const cached = readCachedProfile(userId);
          if (cached) {
            setProfile(cached);
          } else {
            setProfile(null);
          }
        }

        await loadProfileForUser(userId, { epoch });

        if (epoch !== authEpochRef.current) return;
        if (!passwordRecoveryRef.current) {
          startPresenceTracking(userId, "auth-session");
          registerForPushNotifications(userId).catch(() => undefined);
        } else {
          console.log("[presence] applySession skipped — password recovery mode", { userId });
        }
      } else {
        setProfile(null);
        resolvedProfileUserIdRef.current = null;
        clearCachedProfile();
        setProfileLoading(false);
      }

      if (epoch === authEpochRef.current) {
        setLoading(false);
      }
    },
    [loadProfileForUser]
  );

  const refreshAuthOnResume = useCallback(async () => {
    if (signOutInProgressRef.current) return;

    const epoch = authEpochRef.current;
    try {
      const recovered = await getSession();
      if (!recovered?.user.id || epoch !== authEpochRef.current) return;

      setSession(recovered);
      await loadProfileForUser(recovered.user.id, { background: true, epoch });
    } catch (error) {
      console.error("[auth] resume refresh failed", error);
    }
  }, [loadProfileForUser]);

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

      const initialSession = await getSession();
      if (initialSession?.user.id) {
        const cached = readCachedProfile(initialSession.user.id);
        if (cached) {
          setProfile(cached);
        }
      }

      await applySession(initialSession);
    }

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      void handleRecoveryUrl(url);
    });

    void bootstrapAuth().catch(() => {
      setLoading(false);
      setProfileLoading(false);
    });

    const { data: sub } = onAuthStateChange((event, nextSession) => {
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

        if (signOutInProgressRef.current) {
          void applySession(nextSession);
          return;
        }

        const signedOutUserId = sessionRef.current?.user?.id ?? null;

        void (async () => {
          await new Promise((resolve) => setTimeout(resolve, SESSION_RECOVERY_MS));
          if (signOutInProgressRef.current) return;

          try {
            const recovered = await getSession();
            if (recovered) return;
          } catch {
            // Fall through to offline presence.
          }

          await stopPresenceTracking(true, "auth-signed-out", signedOutUserId);
        })();
      }

      // Token refresh only updates JWT — keep profile and loading state intact.
      if (event === "TOKEN_REFRESHED") {
        if (nextSession) setSession(nextSession);
        return;
      }

      void applySession(nextSession);
    });

    return () => {
      linkSub.remove();
      sub.subscription.unsubscribe();
    };
  }, [applySession]);

  useEffect(() => {
    function onVisible() {
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenAt === null) return;
      if (Date.now() - hiddenAt < RESUME_HIDDEN_MS) return;
      void refreshAuthOnResume();
    }

    function onHidden() {
      hiddenAtRef.current = Date.now();
    }

    if (Platform.OS === "web" && typeof document !== "undefined") {
      const onVisibilityChange = () => {
        if (document.visibilityState === "visible") onVisible();
        else onHidden();
      };

      document.addEventListener("visibilitychange", onVisibilityChange);
      return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") onVisible();
      else if (nextState === "background" || nextState === "inactive") onHidden();
    });

    return () => subscription.remove();
  }, [refreshAuthOnResume]);

  const authReady = !loading && !(session?.user.id && profileLoading);

  const value = useMemo(
    () => ({
      session,
      profile,
      loading,
      profileLoading,
      authReady,
      passwordRecovery,
      clearPasswordRecovery,
      refreshProfile,
      applySession,
      signOut,
    }),
    [
      session,
      profile,
      loading,
      profileLoading,
      authReady,
      passwordRecovery,
      clearPasswordRecovery,
      refreshProfile,
      applySession,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
