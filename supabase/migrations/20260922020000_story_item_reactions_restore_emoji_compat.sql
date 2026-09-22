-- Restore production compatibility for story_item_reactions.
-- The prior key CHECK (20260922010000) is incompatible with published
-- production 14543af, which writes raw emoji glyphs. This migration:
--   1. drops story_item_reactions_reaction_check
--   2. converts stored keys back to displayed emojis
-- It is idempotent. RLS and other tables are not changed.

BEGIN;

ALTER TABLE public.story_item_reactions
  DROP CONSTRAINT IF EXISTS story_item_reactions_reaction_check;

UPDATE public.story_item_reactions
SET reaction = CASE reaction
  WHEN 'strong' THEN '💪🏾'
  WHEN 'fire' THEN '🔥'
  WHEN 'applause' THEN '👏'
  WHEN 'love' THEN '❤️'
  WHEN 'eyes' THEN '👀'
  WHEN 'laugh' THEN '😂'
  WHEN 'support' THEN '🤝'
  ELSE reaction
END
WHERE reaction IN ('strong', 'fire', 'applause', 'love', 'eyes', 'laugh', 'support');

DO $$
DECLARE
  v_keys int;
BEGIN
  SELECT COUNT(*) INTO v_keys
  FROM public.story_item_reactions
  WHERE reaction IN ('strong', 'fire', 'applause', 'love', 'eyes', 'laugh', 'support');

  IF v_keys <> 0 THEN
    RAISE EXCEPTION 'story_item_reactions restore failed: % canonical key row(s) remain', v_keys;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'story_item_reactions'
      AND con.conname = 'story_item_reactions_reaction_check'
  ) THEN
    RAISE EXCEPTION 'story_item_reactions restore failed: reaction CHECK still exists';
  END IF;
END $$;

COMMIT;
