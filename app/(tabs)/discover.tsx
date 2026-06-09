import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { discoverProfiles, getChallenges, getGroups } from "@frennix/api";
import { ChallengeCard, EmptyState, GroupCard, Input, UserRow, colors, spacing, typography } from "@frennix/ui";

type Tab = "people" | "groups" | "challenges";

export default function DiscoverScreen() {
  const [tab, setTab] = useState<Tab>("people");
  const [query, setQuery] = useState("");
  const [activity, setActivity] = useState("");

  const { data: people = [] } = useQuery({
    queryKey: ["discover-people", query, activity],
    queryFn: () => discoverProfiles({ city: query || undefined, activity: activity || undefined }),
  });

  const { data: groups = [] } = useQuery({
    queryKey: ["discover-groups", query],
    queryFn: () => getGroups({ query: query || undefined }),
  });

  const { data: challenges = [] } = useQuery({
    queryKey: ["discover-challenges"],
    queryFn: getChallenges,
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "people", label: "People" },
    { key: "groups", label: "Groups" },
    { key: "challenges", label: "Challenges" },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Find your training community</Text>
      <Input
        placeholder={tab === "people" ? "Search city..." : "Search..."}
        value={query}
        onChangeText={setQuery}
      />

      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "people" ? (
        <FlatList
          data={people}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              title="No partners yet"
              description="Try another city or activity filter to find people with similar fitness goals."
            />
          }
          renderItem={({ item }) => (
            <UserRow
              profile={item}
              subtitle={[...(item.activities ?? [])].slice(0, 2).join(", ")}
              onPress={() => router.push(`/user/${item.username}`)}
            />
          )}
        />
      ) : null}

      {tab === "groups" ? (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Pressable onPress={() => router.push("/create-group")}>
              <Text style={styles.createLink}>+ Create a group</Text>
            </Pressable>
          }
          ListEmptyComponent={
            <EmptyState
              title="No groups found"
              description="Start a group for your marathon crew, pickup league, or gym community."
              actionLabel="Create group"
              onAction={() => router.push("/create-group")}
            />
          }
          renderItem={({ item }) => (
            <GroupCard group={item} onPress={() => router.push(`/group/${item.id}`)} />
          )}
        />
      ) : null}

      {tab === "challenges" ? (
        <FlatList
          data={challenges}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <Pressable onPress={() => router.push("/create-challenge")}>
              <Text style={styles.createLink}>+ Create a challenge</Text>
            </Pressable>
          }
          ListEmptyComponent={
            <EmptyState
              title="No active challenges"
              description="Join or create a challenge to stay accountable with your community."
              actionLabel="Create challenge"
              onAction={() => router.push("/create-challenge")}
            />
          }
          renderItem={({ item }) => (
            <ChallengeCard challenge={item} onPress={() => router.push(`/challenge/${item.id}`)} />
          )}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  header: { ...typography.heading, marginBottom: spacing.sm },
  tabRow: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.md },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  tabActive: { backgroundColor: colors.accentMuted },
  tabText: { color: colors.textMuted, fontWeight: "600" },
  tabTextActive: { color: colors.accent },
  list: { paddingBottom: spacing.xxl },
  createLink: { color: colors.accent, fontWeight: "600", marginBottom: spacing.md },
});
