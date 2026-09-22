-- Canonical story reaction keys for every displayed Story Viewer emoji.
-- Existing rows may store raw glyphs (including skin-tone variants). Remap, then
-- constrain writes to the seven keys. RLS is unchanged.

UPDATE public.story_item_reactions
SET reaction = CASE
  WHEN reaction IN ('strong', '💪', '💪🏻', '💪🏼', '💪🏽', '💪🏾', '💪🏿') THEN 'strong'
  WHEN reaction IN ('fire', '🔥') THEN 'fire'
  WHEN reaction IN ('applause', '👏', '👏🏻', '👏🏼', '👏🏽', '👏🏾', '👏🏿') THEN 'applause'
  WHEN reaction IN ('love', '❤️', '❤', '♥️') THEN 'love'
  WHEN reaction IN ('eyes', '👀') THEN 'eyes'
  WHEN reaction IN ('laugh', '😂') THEN 'laugh'
  WHEN reaction IN ('support', '🤝', '🤝🏻', '🤝🏼', '🤝🏽', '🤝🏾', '🤝🏿') THEN 'support'
  ELSE reaction
END
WHERE reaction IS NOT NULL;

ALTER TABLE public.story_item_reactions
  DROP CONSTRAINT IF EXISTS story_item_reactions_reaction_check;

ALTER TABLE public.story_item_reactions
  ADD CONSTRAINT story_item_reactions_reaction_check
  CHECK (reaction IN ('strong', 'fire', 'applause', 'love', 'eyes', 'laugh', 'support'));
