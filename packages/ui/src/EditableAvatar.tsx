import { Pressable, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { Avatar } from "./Avatar";
import { colors } from "./theme";

interface EditableAvatarProps {
  uri?: string | null;
  name?: string;
  size?: number;
  /** Legacy: whole avatar opens edit flow (e.g. Edit Profile screen). */
  onPress?: () => void;
  /** Opens full-screen photo viewer when a photo exists. */
  onViewPress?: () => void;
  /** Camera badge only — change photo without opening the viewer. */
  onEditPress?: () => void;
  uploading?: boolean;
}

export function EditableAvatar({
  uri,
  name,
  size = 128,
  onPress,
  onViewPress,
  onEditPress,
  uploading = false,
}: EditableAvatarProps) {
  const ringSize = size + 8;
  const editHandler = onEditPress ?? onPress;
  const showEditBadge = Boolean(editHandler && (onEditPress || !onViewPress));
  const useSplitHandlers = Boolean(onViewPress || onEditPress);

  if (useSplitHandlers) {
    return (
      <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
        {onViewPress ? (
          <Pressable
            onPress={onViewPress}
            disabled={uploading}
            accessibilityRole="button"
            accessibilityLabel="View profile photo"
            style={({ pressed }) => [pressed ? styles.pressed : null]}
          >
            <Avatar uri={uri} name={name} size={size} deferImagePlaceholder />
          </Pressable>
        ) : (
          <Avatar uri={uri} name={name} size={size} deferImagePlaceholder />
        )}
        {showEditBadge ? (
          <Pressable
            style={[styles.badge, { width: size * 0.32, height: size * 0.32, borderRadius: size * 0.16 }]}
            onPress={editHandler}
            disabled={!editHandler || uploading}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
          >
            {uploading ? (
              <ActivityIndicator
                size="small"
                color={colors.black}
                accessibilityLabel="Uploading profile photo"
              />
            ) : (
              <Text style={[styles.cameraIcon, { fontSize: size * 0.14 }]}>📷</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || uploading}
      accessibilityRole="button"
      accessibilityLabel="Change profile photo"
      style={({ pressed }) => [pressed && onPress ? styles.pressed : null]}
    >
      <View style={[styles.ring, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
        <Avatar uri={uri} name={name} size={size} deferImagePlaceholder />
        {showEditBadge ? (
          <View style={[styles.badge, { width: size * 0.32, height: size * 0.32, borderRadius: size * 0.16 }]}>
            {uploading ? (
              <ActivityIndicator
                size="small"
                color={colors.black}
                accessibilityLabel="Uploading profile photo"
              />
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
