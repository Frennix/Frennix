import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/providers/AuthProvider";
import { flexFill, webVerticalScrollStyle } from "@/lib/flex-layout";

/** Minimal post-login feed replacement for web isolation. */
export function LoggedInFeedTestScreen() {
  const { session, authReady, profile } = useAuth();

  return (
    <View style={styles.root}>
      <Text style={styles.title}>Logged in test screen</Text>
      <Text style={styles.meta}>
        authReady={String(authReady)} · user={session?.user.id?.slice(0, 8) ?? "none"} · profile=
        {profile?.username ?? "loading"}
      </Text>
      <ScrollView
        style={[styles.scroll, webVerticalScrollStyle]}
        contentContainerStyle={styles.content}
        nestedScrollEnabled
      >
        {Array.from({ length: 20 }, (_, index) => (
          <View key={index} style={styles.row}>
            <Text style={styles.rowText}>Test row {index + 1}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...flexFill,
    backgroundColor: "#000000",
  },
  title: {
    color: "#ffea00",
    fontSize: 22,
    fontWeight: "900",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  meta: {
    color: "#aaaaaa",
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  scroll: {
    ...flexFill,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 10,
  },
  row: {
    minHeight: 56,
    borderRadius: 8,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#333",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  rowText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
});
