import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { feedLayoutStyles } from "./tokens";

type SlotProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Renders nothing when children are absent — safe for optional future slots. */
function OptionalSlot({
  children,
  style,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  if (children == null || children === false) return null;
  return <View style={style}>{children}</View>;
}

/** Above header — Sponsored, Promoted, Featured. */
function Label({ children, style }: SlotProps) {
  return <OptionalSlot style={[feedLayoutStyles.label, style]}>{children}</OptionalSlot>;
}

/** Header row trailing — verified badge, premium lock, overflow. */
function HeaderTrailing({ children, style }: SlotProps) {
  return <OptionalSlot style={[feedLayoutStyles.headerTrailing, style]}>{children}</OptionalSlot>;
}

/** Below media, above actions — event RSVP, story link, promoted CTA. */
function BelowMedia({ children, style }: SlotProps) {
  return <OptionalSlot style={[feedLayoutStyles.belowMedia, style]}>{children}</OptionalSlot>;
}

/** Below caption — affiliate products, nutrition cards, coach upsell. */
function Commerce({ children, style }: SlotProps) {
  return <OptionalSlot style={[feedLayoutStyles.commerce, style]}>{children}</OptionalSlot>;
}

/** Below comments — ad disclaimer, legal, sponsorship copy. */
function Footer({ children, style }: SlotProps) {
  return <OptionalSlot style={[feedLayoutStyles.footer, style]}>{children}</OptionalSlot>;
}

/** Absolute overlay inside media frame — premium gate, play badge, ad marker. */
function MediaOverlay({ children, style }: SlotProps) {
  if (children == null || children === false) return null;
  return (
    <View style={[feedLayoutStyles.mediaOverlay, style]} pointerEvents="box-none">
      {children}
    </View>
  );
}

export const FeedLayoutSlots = {
  Label,
  HeaderTrailing,
  BelowMedia,
  Commerce,
  Footer,
  MediaOverlay,
};
