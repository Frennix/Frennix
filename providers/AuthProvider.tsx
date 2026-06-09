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
import { getProfile, getSession, initSupabase, onAuthStateChange } from "@frennix/api";
import type { Session } from "@supabase/supabase-js";
import { config, isSupabaseConfigured } from "@/lib/config";
import { registerForPushNotifications } from "@/lib/notifications";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: (userIdOrProfile?: string | Profile) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async (userIdOrProfile?: string | Profile) => {
    if (userIdOrProfile && typeof userIdOrProfile === "object") {
      console.log("[refreshProfile] applied upsert result:", {
        id: userIdOrProfile.id,
        username: userIdOrProfile.username,
        onboarding_complete: userIdOrProfile.onboarding_complete,
      });
      setProfile(userIdOrProfile);
      return;
    }

    const id =
      (typeof userIdOrProfile === "string" ? userIdOrProfile : undefined) ?? session?.user.id;
    if (!id) {
      console.warn("[refreshProfile] skipped: no user id");
      return;
    }

    const p = await getProfile(id);
    console.log("[refreshProfile] fetched from Supabase:", {
      id,
      username: p?.username ?? null,
      onboarding_complete: p?.onboarding_complete ?? null,
    });
    setProfile(p);
  }, [session?.user.id]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }

    initSupabase(config.supabaseUrl, config.supabaseAnonKey);

    getSession().then(async (s) => {
      setSession(s);
      if (s?.user.id) {
        const p = await getProfile(s.user.id);
        setProfile(p);
        registerForPushNotifications(s.user.id).catch(() => undefined);
      }
      setLoading(false);
    });

    const { data: sub } = onAuthStateChange(async (_event, s) => {
      setSession(s);
      if (s?.user.id) {
        const p = await getProfile(s.user.id);
        setProfile(p);
        registerForPushNotifications(s.user.id).catch(() => undefined);
      } else {
        setProfile(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo(
    () => ({ session, profile, loading, refreshProfile }),
    [session, profile, loading, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
