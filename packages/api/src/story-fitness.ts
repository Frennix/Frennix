import type {
  StoryChallengeJoinRecord,
  StoryCountdown,
  StoryQuestion,
  StoryQuestionAnswer,
  StoryTrainingChallenge,
  StoryWorkoutCommitment,
} from "@frennix/types";
import { getProfilesByIds } from "./profiles";
import { getSupabase } from "./supabase";

export async function createStoryTrainingChallenge(
  storyId: string,
  prompt: string
): Promise<StoryTrainingChallenge> {
  const { data, error } = await getSupabase()
    .from("story_training_challenges")
    .insert({ story_id: storyId, prompt: prompt.trim() })
    .select("*")
    .single();

  if (error) throw error;

  await getSupabase()
    .from("stories")
    .update({ challenge_prompt: prompt.trim() })
    .eq("id", storyId);

  return {
    id: data.id as string,
    story_id: storyId,
    prompt: data.prompt as string,
    created_at: data.created_at as string,
  };
}

export async function getStoryTrainingChallenge(storyId: string): Promise<StoryTrainingChallenge | null> {
  const { data, error } = await getSupabase()
    .from("story_training_challenges")
    .select("*")
    .eq("story_id", storyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id as string,
    story_id: storyId,
    prompt: data.prompt as string,
    created_at: data.created_at as string,
  };
}

export async function getStoryChallengeJoins(storyId: string): Promise<StoryChallengeJoinRecord[]> {
  const { data, error } = await getSupabase()
    .from("story_challenge_joins")
    .select("user_id, joined_at")
    .eq("story_id", storyId)
    .order("joined_at", { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  const userIds = data.map((row) => row.user_id as string);
  const profiles = await getProfilesByIds(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return data.map((row) => {
    const profile = profileById.get(row.user_id as string);
    return {
      user_id: row.user_id as string,
      profile: {
        id: profile?.id ?? (row.user_id as string),
        username: profile?.username ?? "athlete",
        display_name: profile?.display_name ?? "Athlete",
        avatar_url: profile?.avatar_url ?? null,
      },
      joined_at: row.joined_at as string,
    };
  });
}

export async function joinStoryTrainingChallenge(
  viewerId: string,
  storyOwnerId: string,
  storyId: string,
  trainingChallengeId: string
): Promise<void> {
  if (viewerId === storyOwnerId) return;

  const { error } = await getSupabase().from("story_challenge_joins").insert({
    story_id: storyId,
    story_training_challenge_id: trainingChallengeId,
    challenge_id: null,
    user_id: viewerId,
  });

  if (error) throw error;
}

export async function createStoryCountdown(input: {
  storyId: string;
  label: string;
  targetAt: string;
  eventId?: string | null;
}): Promise<StoryCountdown> {
  const { data, error } = await getSupabase()
    .from("story_countdowns")
    .insert({
      story_id: input.storyId,
      label: input.label.trim(),
      target_at: input.targetAt,
      event_id: input.eventId ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: data.id as string,
    story_id: input.storyId,
    label: data.label as string,
    target_at: data.target_at as string,
    event_id: (data.event_id as string | null) ?? null,
  };
}

export async function getStoryCountdown(
  storyId: string,
  viewerId?: string
): Promise<StoryCountdown | null> {
  const { data, error } = await getSupabase()
    .from("story_countdowns")
    .select("*")
    .eq("story_id", storyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  let subscribed = false;
  if (viewerId) {
    const { data: sub } = await getSupabase()
      .from("story_countdown_subscriptions")
      .select("user_id")
      .eq("countdown_id", data.id as string)
      .eq("user_id", viewerId)
      .maybeSingle();
    subscribed = Boolean(sub);
  }

  return {
    id: data.id as string,
    story_id: storyId,
    label: data.label as string,
    target_at: data.target_at as string,
    event_id: (data.event_id as string | null) ?? null,
    subscribed,
  };
}

export async function subscribeStoryCountdown(countdownId: string, userId: string): Promise<void> {
  const { error } = await getSupabase().from("story_countdown_subscriptions").upsert(
    { countdown_id: countdownId, user_id: userId },
    { onConflict: "countdown_id,user_id" }
  );
  if (error) throw error;
}

export async function createStoryQuestion(storyId: string, question: string): Promise<StoryQuestion> {
  const { data, error } = await getSupabase()
    .from("story_questions")
    .insert({ story_id: storyId, question: question.trim() })
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: data.id as string,
    story_id: storyId,
    question: data.question as string,
  };
}

export async function getStoryQuestion(storyId: string, viewerId?: string): Promise<StoryQuestion | null> {
  const { data, error } = await getSupabase()
    .from("story_questions")
    .select("*")
    .eq("story_id", storyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const questionId = data.id as string;

  const [{ count }, myAnswerResult] = await Promise.all([
    getSupabase()
      .from("story_question_answers")
      .select("*", { count: "exact", head: true })
      .eq("question_id", questionId),
    viewerId
      ? getSupabase()
          .from("story_question_answers")
          .select("answer_text")
          .eq("question_id", questionId)
          .eq("user_id", viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    id: questionId,
    story_id: storyId,
    question: data.question as string,
    answer_count: count ?? 0,
    my_answer: (myAnswerResult.data?.answer_text as string | undefined) ?? null,
  };
}

export async function answerStoryQuestion(
  questionId: string,
  userId: string,
  answerText: string
): Promise<void> {
  const trimmed = answerText.trim();
  if (!trimmed) throw new Error("Answer cannot be empty");

  const { error } = await getSupabase().from("story_question_answers").upsert(
    {
      question_id: questionId,
      user_id: userId,
      answer_text: trimmed,
    },
    { onConflict: "question_id,user_id" }
  );

  if (error) throw error;
}

export async function getStoryQuestionAnswersForOwner(
  questionId: string
): Promise<StoryQuestionAnswer[]> {
  const { data, error } = await getSupabase()
    .from("story_question_answers")
    .select("*")
    .eq("question_id", questionId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data?.length) return [];

  const userIds = data.map((row) => row.user_id as string);
  const profiles = await getProfilesByIds(userIds);
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return data.map((row) => {
    const profile = profileById.get(row.user_id as string);
    return {
      id: row.id as string,
      question_id: questionId,
      user_id: row.user_id as string,
      answer_text: row.answer_text as string,
      shared_at: (row.shared_at as string | null) ?? null,
      created_at: row.created_at as string,
      profile: profile
        ? {
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
          }
        : undefined,
    };
  });
}

export async function shareStoryQuestionAnswer(answerId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("story_question_answers")
    .update({ shared_at: new Date().toISOString() })
    .eq("id", answerId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function createStoryWorkoutCommitment(input: {
  storyId: string;
  userId: string;
  commitmentText: string;
  dueAt?: string | null;
}): Promise<StoryWorkoutCommitment> {
  const { data, error } = await getSupabase()
    .from("story_workout_commitments")
    .insert({
      story_id: input.storyId,
      user_id: input.userId,
      commitment_text: input.commitmentText.trim(),
      due_at: input.dueAt ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  return {
    id: data.id as string,
    story_id: input.storyId,
    commitment_text: data.commitment_text as string,
    due_at: (data.due_at as string | null) ?? null,
    completed_at: null,
  };
}

export async function getStoryWorkoutCommitment(storyId: string): Promise<StoryWorkoutCommitment | null> {
  const { data, error } = await getSupabase()
    .from("story_workout_commitments")
    .select("*")
    .eq("story_id", storyId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id as string,
    story_id: storyId,
    commitment_text: data.commitment_text as string,
    due_at: (data.due_at as string | null) ?? null,
    completed_at: (data.completed_at as string | null) ?? null,
  };
}

export async function markStoryCommitmentComplete(storyId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from("story_workout_commitments")
    .update({ completed_at: new Date().toISOString() })
    .eq("story_id", storyId)
    .eq("user_id", userId)
    .is("completed_at", null);

  if (error) throw error;
}
