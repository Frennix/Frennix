import type { StoryTrainInvite, StoryTrainInviteStatus } from "@frennix/types";
import { getOrCreateConversation, sendMessage } from "./messaging";
import { createNotification } from "./notifications";
import { getProfile } from "./profiles";
import { trackStoryEngagementEvent } from "./story-insights";
import { getSupabase } from "./supabase";

export async function sendStoryTrainInvite(
  inviterId: string,
  inviteeId: string,
  postId: string | null
) {
  if (inviterId === inviteeId) return;

  const { data: invite, error } = await getSupabase()
    .from("story_train_invites")
    .upsert(
      {
        inviter_id: inviterId,
        invitee_id: inviteeId,
        post_id: postId,
        status: "pending",
        responded_at: null,
      },
      { onConflict: "inviter_id,invitee_id,post_id" }
    )
    .select("*")
    .single();

  if (error) throw error;

  const inviter = await getProfile(inviterId);
  const inviterName = inviter?.display_name ?? "Someone";

  await createNotification({
    user_id: inviteeId,
    type: "story_train_invite",
    payload: {
      inviter_id: inviterId,
      inviter_name: inviterName,
      post_id: postId,
      invite_id: invite.id,
      preview: `${inviterName} invited you to train.`,
    },
  });

  if (postId) {
    await trackStoryEngagementEvent({
      viewerId: inviterId,
      storyUserId: inviteeId,
      postId,
      eventType: "train_invite",
    }).catch(() => undefined);
  }

  return invite as StoryTrainInvite;
}

export async function respondStoryTrainInvite(
  inviteeId: string,
  inviteId: string,
  response: "accepted" | "suggest_day" | "message_first"
) {
  const status: StoryTrainInviteStatus =
    response === "accepted" ? "accepted" : response === "suggest_day" ? "suggest_day" : "pending";

  const { data: invite, error } = await getSupabase()
    .from("story_train_invites")
    .update({
      status,
      responded_at: new Date().toISOString(),
    })
    .eq("id", inviteId)
    .eq("invitee_id", inviteeId)
    .select("*")
    .single();

  if (error) throw error;
  if (!invite) throw new Error("Invite not found");

  const conversationId = await getOrCreateConversation(inviteeId, invite.inviter_id as string);

  if (response === "accepted") {
    await sendMessage(conversationId, inviteeId, "Accepted your train invite — let's plan a session! 💪");
  } else if (response === "suggest_day") {
    await sendMessage(
      conversationId,
      inviteeId,
      "Thanks for the train invite! Can we pick another day that works better?"
    );
  } else {
    await sendMessage(conversationId, inviteeId, "Saw your train invite — let's chat about timing first!");
  }

  return invite as StoryTrainInvite;
}
