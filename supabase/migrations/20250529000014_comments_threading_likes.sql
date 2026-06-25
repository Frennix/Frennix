-- Threaded comments, comment likes, delete policy, reply notifications

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_parent ON public.comments(parent_id);

CREATE TABLE IF NOT EXISTS public.comment_likes (
  comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON public.comment_likes(comment_id);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View comment likes" ON public.comment_likes
  FOR SELECT USING (true);

CREATE POLICY "Create comment like" ON public.comment_likes
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Delete own comment like" ON public.comment_likes
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Delete own comment" ON public.comments
  FOR DELETE USING (author_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
  parent_author UUID;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT author_id INTO parent_author FROM public.comments WHERE id = NEW.parent_id;
    IF parent_author IS NOT NULL AND parent_author != NEW.author_id THEN
      INSERT INTO public.notifications (user_id, type, payload)
      VALUES (
        parent_author,
        'comment_reply',
        jsonb_build_object(
          'post_id', NEW.post_id,
          'comment_id', NEW.id,
          'parent_id', NEW.parent_id,
          'author_id', NEW.author_id
        )
      );
    END IF;
  ELSE
    SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
    IF post_author IS NOT NULL AND post_author != NEW.author_id THEN
      INSERT INTO public.notifications (user_id, type, payload)
      VALUES (
        post_author,
        'comment',
        jsonb_build_object('post_id', NEW.post_id, 'author_id', NEW.author_id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
