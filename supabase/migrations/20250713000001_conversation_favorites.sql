-- Favorite training partners (separate from pinned conversations).

ALTER TABLE public.conversation_user_preferences
  ADD COLUMN IF NOT EXISTS favorited_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversation_user_preferences_favorited
  ON public.conversation_user_preferences (user_id, favorited_at DESC)
  WHERE favorited_at IS NOT NULL;

COMMENT ON COLUMN public.conversation_user_preferences.favorited_at IS
  'Favorite training partner — shown in Messages favorites section (max 5, app-enforced).';
