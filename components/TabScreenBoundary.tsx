import type { ReactNode } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { AppScreen } from "@/components/AppScreen";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";

type Props = {
  label: string;
  children: ReactNode;
  compact?: boolean;
};

/** Per-tab error isolation — one failed section does not lock the app. */
export function TabScreenBoundary({ label, children, compact }: Props) {
  const { session } = useAuth();
  return (
    <AppScreen nativeID={`screen-${label}`}>
      <SectionErrorBoundary
        label={label}
        screen={`/(tabs)/${label}`}
        userId={session?.user.id}
        email={session?.user.email ?? undefined}
        compact={compact}
      >
        {children}
      </SectionErrorBoundary>
    </AppScreen>
  );
}
