import type { CSSProperties, MouseEvent, ReactNode } from "react";

type Props = {
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  children: ReactNode;
};

/**
 * Native HTML button — required for iOS PWA Notification.requestPermission() user gesture.
 * React Native Pressable does not preserve the browser user-activation chain on iOS.
 */
export function WebPushNativeButton({ onClick, disabled, loading, children }: Props) {
  const style: CSSProperties = {
    width: "100%",
    minHeight: 48,
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #22C55E",
    backgroundColor: "#141416",
    color: "#F4F4F5",
    fontSize: 16,
    fontWeight: 600,
    cursor: disabled || loading ? "not-allowed" : "pointer",
    opacity: disabled || loading ? 0.55 : 1,
    pointerEvents: disabled || loading ? "none" : "auto",
  };

  return (
    <button type="button" disabled={disabled || loading} onClick={onClick} style={style}>
      {loading ? "Enabling…" : children}
    </button>
  );
}
