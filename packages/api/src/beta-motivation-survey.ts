import type { BetaMotivationSurveyAnswer, BetaMotivationSurveyPrompt } from "@frennix/types";
import { formatSupabaseError } from "./profile-utils";
import { getSupabase } from "./supabase";

export async function getBetaMotivationSurveyPrompt(): Promise<BetaMotivationSurveyPrompt> {
  const { data, error } = await getSupabase().rpc("get_beta_motivation_survey_prompt");
  if (error) throw formatSupabaseError(error, "Failed to check survey eligibility");
  return (data ?? { show: false }) as BetaMotivationSurveyPrompt;
}

export async function dismissBetaMotivationSurvey(): Promise<void> {
  const { error } = await getSupabase().rpc("dismiss_beta_motivation_survey");
  if (error) throw formatSupabaseError(error, "Failed to dismiss survey");
}

export async function submitBetaMotivationSurvey(
  answer: BetaMotivationSurveyAnswer,
  feedback?: string
): Promise<void> {
  const { error } = await getSupabase().rpc("submit_beta_motivation_survey", {
    p_answer: answer,
    p_feedback: feedback?.trim() || null,
  });
  if (error) throw formatSupabaseError(error, "Failed to submit survey");
}
