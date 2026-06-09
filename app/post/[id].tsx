import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { addComment, getComments, getPost, toggleLike } from "@frennix/api";
import { useAuth } from "@/providers/AuthProvider";
import { useState } from "react";
import { PostCard, Input, Button, Avatar, colors, spacing, typography } from "@frennix/ui";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id ?? "";
  const [comment, setComment] = useState("");
  const queryClient = useQueryClient();

  const { data: post } = useQuery({
    queryKey: ["post", id, userId],
    queryFn: () => getPost(id!, userId),
    enabled: !!id && !!userId,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["comments", id],
    queryFn: () => getComments(id!),
    enabled: !!id,
  });

  const likeMutation = useMutation({
    mutationFn: () => toggleLike(id!, userId, !!post?.liked_by_me),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["post", id] }),
  });

  const commentMutation = useMutation({
    mutationFn: () => addComment(id!, userId, comment.trim()),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["comments", id] });
    },
  });

  if (!post) return null;

  return (
    <View style={styles.container}>
      <PostCard
        post={post}
        onLike={() => likeMutation.mutate()}
        onComment={() => undefined}
      />
      <Text style={styles.section}>Comments</Text>
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <Avatar uri={item.author?.avatar_url} name={item.author?.display_name} size={32} />
            <View>
              <Text style={styles.commentAuthor}>{item.author?.display_name}</Text>
              <Text style={styles.commentBody}>{item.content}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Input value={comment} onChangeText={setComment} placeholder="Add a comment..." />
            <Button title="Post" onPress={() => commentMutation.mutate()} loading={commentMutation.isPending} />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  section: { ...typography.heading, fontSize: 18, marginVertical: spacing.sm },
  comment: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  commentAuthor: { fontWeight: "600", color: colors.text },
  commentBody: { color: colors.textSecondary },
  footer: { gap: spacing.sm, marginTop: spacing.md },
});
