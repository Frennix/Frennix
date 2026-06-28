-- Workout story views and lightweight reactions.

CREATE TABLE IF NOT EXISTS story_views (
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  story_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_viewed_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (viewer_id, story_user_id)
);

CREATE TABLE IF NOT EXISTS story_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  story_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL CHECK (emoji IN ('💪', '🔥', '👏', '❤️')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (viewer_id, post_id)
);

CREATE INDEX IF NOT EXISTS story_views_story_user_idx ON story_views (story_user_id);
CREATE INDEX IF NOT EXISTS story_reactions_post_idx ON story_reactions (post_id);

ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE story_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own story views"
  ON story_views FOR ALL
  USING (viewer_id = auth.uid())
  WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "Story owners read views on their stories"
  ON story_views FOR SELECT
  USING (story_user_id = auth.uid());

CREATE POLICY "Users manage own story reactions"
  ON story_reactions FOR ALL
  USING (viewer_id = auth.uid())
  WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "Story owners read reactions on their stories"
  ON story_reactions FOR SELECT
  USING (story_user_id = auth.uid());
