import { Pressable, StyleSheet, Text, View } from "react-native";
import type { StoryPoll } from "@frennix/types";
import { colors, overlays, spacing, typography } from "@frennix/ui";

type StoryPollVoteCardProps = {
  poll: StoryPoll;
  disabled?: boolean;
  onVote: (optionId: string) => void;
};

export function StoryPollVoteCard({ poll, disabled, onVote }: StoryPollVoteCardProps) {
  const totalVotes = poll.options.reduce((sum, option) => sum + (option.vote_count ?? 0), 0);
  const hasVoted = Boolean(poll.my_vote_option_id);

  return (
    <View style={styles.wrap}>
      <Text style={styles.question}>{poll.question}</Text>
      <View style={styles.options}>
        {poll.options.map((option) => {
          const votes = option.vote_count ?? 0;
          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
          const selected = poll.my_vote_option_id === option.id;

          return (
            <Pressable
              key={option.id}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => onVote(option.id)}
              disabled={disabled}
            >
              {hasVoted ? (
                <View style={[styles.fill, { width: `${pct}%` }, selected && styles.fillSelected]} />
              ) : null}
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>
                {option.label}
              </Text>
              {hasVoted ? <Text style={styles.pct}>{pct}%</Text> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: overlays.glassMedium,
    borderWidth: 1,
    borderColor: overlays.glassBorderStrong,
  },
  question: {
    ...typography.body,
    color: colors.white,
    fontWeight: "800",
  },
  options: {
    gap: spacing.xs,
  },
  option: {
    overflow: "hidden",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
    backgroundColor: overlays.glass,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
  },
  optionSelected: {
    borderColor: colors.accent,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  fillSelected: {
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  optionLabel: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: "700",
    flex: 1,
  },
  optionLabelSelected: {
    color: colors.accent,
  },
  pct: {
    ...typography.caption,
    color: overlays.whiteSoft,
    fontWeight: "700",
  },
});
