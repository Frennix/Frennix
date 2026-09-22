-- SUPERSEDED — no-op. Do not recreate the key CHECK.
--
-- The original version of this file remapped story_item_reactions.reaction
-- glyphs to canonical keys and added story_item_reactions_reaction_check.
-- That is incompatible with published production 14543af, which writes raw
-- emoji text. The live database was restored by
-- 20260922020000_story_item_reactions_restore_emoji_compat.sql.
--
-- This replacement is intentionally a no-op so the filename cannot be
-- reapplied to constrain or remap production data.

SELECT 1;
