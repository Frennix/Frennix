import { openTrainingCalendarCreate } from "@/lib/training-calendar-navigation";

/** Open Training Calendar to schedule a workout from a story. */
export function openStoryWorkoutInvite(input: {
  partnerId: string;
  partnerUsername?: string;
  workoutType?: string | null;
  storyId?: string | null;
}) {
  openTrainingCalendarCreate({
    partnerId: input.partnerId,
    partnerUsername: input.partnerUsername ?? "",
    workoutType: input.workoutType ?? "",
    storyId: input.storyId ?? "",
    fromStory: "1",
  });
}
