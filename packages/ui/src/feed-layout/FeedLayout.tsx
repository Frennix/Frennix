import type { ReactNode } from "react";
import { Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { FeedLayoutSlots } from "./FeedLayoutSlots";
import { feedLayoutStyles, feedLayoutTypography } from "./tokens";

type SlotProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

function Root({
  children,
  active = false,
  style,
}: {
  children: ReactNode;
  active?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[feedLayoutStyles.root, active && feedLayoutStyles.rootActive, style]}>
      <View style={feedLayoutStyles.contentColumn}>{children}</View>
    </View>
  );
}

function Header({ children, style }: SlotProps) {
  return <View style={[feedLayoutStyles.header, style]}>{children}</View>;
}

function HeaderText({ children, style }: SlotProps) {
  return <View style={[feedLayoutStyles.headerText, style]}>{children}</View>;
}

function Media({ children, embedded = false, style }: SlotProps & { embedded?: boolean }) {
  return (
    <View style={[embedded ? feedLayoutStyles.embeddedMedia : feedLayoutStyles.media, style]}>
      {children}
    </View>
  );
}

function Actions({ children, style }: SlotProps) {
  return <View style={[feedLayoutStyles.actions, style]}>{children}</View>;
}

function Caption({
  children,
  style,
  textStyle,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[feedLayoutStyles.caption, style]}>
      {typeof children === "string" ? (
        <Text style={[feedLayoutTypography.caption, textStyle]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

function Engagement({ children, style }: SlotProps) {
  return <View style={[feedLayoutStyles.engagement, style]}>{children}</View>;
}

function Comments({ children, style }: SlotProps) {
  return <View style={[feedLayoutStyles.comments, style]}>{children}</View>;
}

export const FeedLayout = {
  Root,
  Header,
  HeaderText,
  Media,
  Actions,
  Caption,
  Engagement,
  Comments,
  ...FeedLayoutSlots,
};
