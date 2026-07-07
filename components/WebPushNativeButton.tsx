import type { ReactNode } from "react";

/** Native-only platforms do not use web push registration button. */
export function WebPushNativeButton(_props: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
}) {
  return null;
}
