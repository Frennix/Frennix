import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { Avatar } from "./Avatar";
import { colors } from "./theme";

interface EditableAvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  onPress?: () => void;
  uploading?: boolean;
}

export function EditableAvatar({
  uri,
  name,
  size = 128,
  onPress,
  uploading = false,
}: EditableAvatarProps) {
  const ringSize = size + 8;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || uploading}
      accessibilityRole="button"
      accessibilityLabel="Change profile photo"
      style={({ pressed }) => [pressed && onPress ? styles.pressed : null]}
    >
      <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
        <Avatar uri={uri} name={name} size={size} />
        {onPress ? (
          <View style={[styles.badge, { width: size * 0.32, height: size * 0.32, borderRadius: size * 0.16 }]}>
            {uploading ? (
              <ActivityIndicator size="small" color={colors.black} />
            ) : (
              <Text style={[styles.cameraIcon, { fontSize: size * 0.14 }]}>📷</Text>
            )}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.accent,
    padding: 2,
  },
  badge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.background,
  },
  pressed: { opacity: 0.85 },
  cameraIcon: { lineHeight: 16 },
});
