-- Allow automatic crash/diagnostic reports without a user-written message.

ALTER TABLE public.beta_feedback DROP CONSTRAINT IF EXISTS beta_feedback_message_or_rating;
ALTER TABLE public.beta_feedback ADD CONSTRAINT beta_feedback_message_or_rating CHECK (
  (type = 'rating' AND rating IS NOT NULL)
  OR (type = 'crash')
  OR (type IN ('bug', 'feature', 'general') AND message IS NOT NULL AND length(trim(message)) > 0)
);
