import type {
  StoryChallengeJoinRecord,
  StoryCountdown,
  StoryPoll,
  StoryQuestion,
  StoryTrainingChallenge,
  StoryWorkoutCommitment,
} from "@frennix/types";
import {
  getStoryChallengeJoins,
  getStoryCountdown,
  getStoryQuestion,
  getStoryTrainingChallenge,
  getStoryWorkoutCommitment,
} from "./story-fitness";
import { getStoryPoll } from "./story-polls";

export type StoryInteractiveBundle = {
  poll: StoryPoll | null;
  trainingChallenge: StoryTrainingChallenge | null;
  challengeJoins: StoryChallengeJoinRecord[];
  countdown: StoryCountdown | null;
  question: StoryQuestion | null;
  commitment: StoryWorkoutCommitment | null;
};

/** Fetches story interactive widgets in one client round-trip (parallel Supabase calls). */
export async function getStoryInteractiveBundle(
  storyId: string,
  viewerId?: string,
  options?: { includeChallengeJoins?: boolean }
): Promise<StoryInteractiveBundle> {
  const includeChallengeJoins = options?.includeChallengeJoins ?? true;

  const [poll, trainingChallenge, countdown, question, commitment, challengeJoins] = await Promise.all([
    getStoryPoll(storyId, viewerId),
    getStoryTrainingChallenge(storyId),
    getStoryCountdown(storyId, viewerId),
    getStoryQuestion(storyId, viewerId),
    getStoryWorkoutCommitment(storyId),
    includeChallengeJoins ? getStoryChallengeJoins(storyId) : Promise.resolve([]),
  ]);

  return {
    poll,
    trainingChallenge,
    challengeJoins,
    countdown,
    question,
    commitment,
  };
}
