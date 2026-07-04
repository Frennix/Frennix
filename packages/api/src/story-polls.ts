import type { StoryPoll, StoryPollOption } from "@frennix/types";
import { getSupabase } from "./supabase";

export type CreateStoryPollInput = {
  storyId: string;
  question: string;
  options: string[];
};

export async function createStoryPoll(input: CreateStoryPollInput): Promise<StoryPoll> {
  const labels = input.options.map((label) => label.trim()).filter(Boolean);
  if (labels.length < 2) throw new Error("Add at least two poll options");

  const { data: pollRow, error: pollError } = await getSupabase()
    .from("story_polls")
    .insert({
      story_id: input.storyId,
      question: input.question.trim(),
    })
    .select("*")
    .single();

  if (pollError) throw pollError;

  const pollId = pollRow.id as string;
  const optionRows = labels.map((label, index) => ({
    poll_id: pollId,
    label,
    sort_order: index,
  }));

  const { data: insertedOptions, error: optionsError } = await getSupabase()
    .from("story_poll_options")
    .insert(optionRows)
    .select("*")
    .order("sort_order", { ascending: true });

  if (optionsError) throw optionsError;

  return {
    id: pollId,
    story_id: input.storyId,
    question: pollRow.question as string,
    options: (insertedOptions ?? []).map((row) => ({
      id: row.id as string,
      poll_id: pollId,
      label: row.label as string,
      sort_order: row.sort_order as number,
      vote_count: 0,
    })),
  };
}

export async function getStoryPoll(storyId: string, viewerId?: string): Promise<StoryPoll | null> {
  const { data: pollRow, error } = await getSupabase()
    .from("story_polls")
    .select("*")
    .eq("story_id", storyId)
    .maybeSingle();

  if (error) throw error;
  if (!pollRow) return null;

  const pollId = pollRow.id as string;

  const [{ data: optionRows, error: optionsError }, { data: voteRows, error: votesError }] =
    await Promise.all([
      getSupabase()
        .from("story_poll_options")
        .select("*")
        .eq("poll_id", pollId)
        .order("sort_order", { ascending: true }),
      getSupabase().from("story_poll_votes").select("option_id, user_id").eq("poll_id", pollId),
    ]);

  if (optionsError) throw optionsError;
  if (votesError) throw votesError;

  const voteCountByOption = new Map<string, number>();
  let myVoteOptionId: string | null = null;

  for (const vote of voteRows ?? []) {
    const optionId = vote.option_id as string;
    voteCountByOption.set(optionId, (voteCountByOption.get(optionId) ?? 0) + 1);
    if (viewerId && vote.user_id === viewerId) {
      myVoteOptionId = optionId;
    }
  }

  const options: StoryPollOption[] = (optionRows ?? []).map((row) => ({
    id: row.id as string,
    poll_id: pollId,
    label: row.label as string,
    sort_order: row.sort_order as number,
    vote_count: voteCountByOption.get(row.id as string) ?? 0,
  }));

  return {
    id: pollId,
    story_id: storyId,
    question: pollRow.question as string,
    options,
    my_vote_option_id: myVoteOptionId,
  };
}

export async function voteStoryPoll(pollId: string, optionId: string, userId: string): Promise<void> {
  const { error } = await getSupabase().from("story_poll_votes").upsert(
    {
      poll_id: pollId,
      option_id: optionId,
      user_id: userId,
    },
    { onConflict: "poll_id,user_id" }
  );

  if (error) throw error;
}
