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
import { isWebRecoveryHash } from "@/lib/auth-redirect";
import { isSupabaseConfigured } from "@/lib/config";
import { ensureSupabaseInitialized } from "@/lib/init-supabase";
import { registerForPushNotifications } from "@/lib/notifications";
import { establishSessionFromUrl, urlLooksLikePasswordRecovery } from "@/lib/recovery-session";

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

  useEffect(() => {
    passwordRecoveryRef.current = passwordRecovery;
  }, [passwordRecovery]);

  const clearPasswordRecovery = useCallback(() => {
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
    await supabaseSignOut();
    setSession(null);
    setProfile(null);
    setPasswordRecovery(false);
  }, []);

  const applySession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (nextSession?.user.id) {
      const p = await getProfile(nextSession.user.id);
      setProfile(p);
      if (!passwordRecoveryRef.current) {
        registerForPushNotifications(nextSession.user.id).catch(() => undefined);
      }
    } else {
      setProfile(null);
    }
    setLoading(false);
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

    Linking.getInitialURL().then((url) => {
      if (url) void handleRecoveryUrl(url);
    });

    const linkSub = Linking.addEventListener("url", ({ url }) => {
      void handleRecoveryUrl(url);
    });

    getSession()
      .then((s) => applySession(s))
      .catch(() => setLoading(false));

    const { data: sub } = onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
      }
      if (event === "SIGNED_OUT") {
        setPasswordRecovery(false);
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
