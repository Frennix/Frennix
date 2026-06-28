import { useEffect, useLayoutEffect, type ReactNode } from "react";
import { markStartupMount } from "@/lib/startup-mount-trace";

interface StartupMountProbeProps {
  id: string;
  children: ReactNode;
}

/** Records sync render + layout/effect mount for startup bisection. */
export function StartupMountProbe({ id, children }: StartupMountProbeProps) {
  markStartupMount(`${id}:render`, "sync");

  useLayoutEffect(() => {
    markStartupMount(`${id}:layout-effect`, "effect");
  }, [id]);

  useEffect(() => {
    markStartupMount(`${id}:mounted`, "effect");
  }, [id]);

  return <>{children}</>;
}

/** Leaf probe with no children — for bootstrap components that return null. */
export function StartupMountMarker({ id }: { id: string }) {
  markStartupMount(`${id}:render`, "sync");

  useEffect(() => {
    markStartupMount(`${id}:mounted`, "effect");
  }, [id]);

  return null;
}
