import { StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { ProgressiveImage } from "./ProgressiveImage";
import { colors } from "./theme";

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  /** Show green online indicator when true */
  showOnline?: boolean;
  isOnline?: boolean;
}

export function Avatar({ uri, name, size = 40, showOnline = false, isOnline = false }: AvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);
  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const dotSize = Math.max(10, Math.round(size * 0.28));
  const onlineDot =
    showOnline && isOnline ? (
      <View
        style={[
          styles.onlineDot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            right: Math.max(0, size * 0.02),
            bottom: Math.max(0, size * 0.02),
          },
        ]}
      />
    ) : null;

  if (uri && !failed) {
    return (
      <View style={{ width: size, height: size }}>
        <ProgressiveImage
          uri={uri}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          contentFit="cover"
          accessibilityLabel={name ? `${name} avatar` : "User avatar"}
          onError={() => setFailed(true)}
          recyclingKey={`avatar-${uri}`}
        />
        {onlineDot}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.initials, { fontSize: size * 0.35 }]}>{initials ?? "?"}</Text>
      </View>
      {onlineDot}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: colors.accent, fontWeight: "700" },
  onlineDot: {
    position: "absolute",
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
