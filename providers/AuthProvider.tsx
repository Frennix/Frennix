import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Profile } from "@frennix/types";
import { getProfile, getSession, initSupabase, onAuthStateChange, signOut as supabaseSignOut } from "@frennix/api";
import type { Session } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "@/lib/config";
import { registerForPushNotifications } from "@/lib/notifications";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: (userIdOrProfile?: string | Profile) => Promise<void>;
  applySession: (session: Session | null) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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
  }, []);

  const applySession = useCallback(async (nextSession: Session | null) => {
    setSession(nextSession);
    if (nextSession?.user.id) {
      const p = await getProfile(nextSession.user.id);
      setProfile(p);
      registerForPushNotifications(nextSession.user.id).catch(() => undefined);
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

    initSupabase(config.supabaseUrl, config.supabaseAnonKey);

    getSession()
      .then((s) => applySession(s))
      .catch(() => setLoading(false));

    const { data: sub } = onAuthStateChange((_event, s) => {
      void applySession(s);
    });

    return () => sub.subscription.unsubscribe();
  }, [applySession]);

  const value = useMemo(
    () => ({ session, profile, loading, refreshProfile, applySession, signOut }),
    [session, profile, loading, refreshProfile, applySession, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
