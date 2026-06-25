-- Direct Share: forward posts to messages, groups, and challenges

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_post ON public.messages(post_id);

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS shared_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_shared_post ON public.posts(shared_post_id);

-- Allow reading original posts referenced by visible shares (messages, group/challenge feeds)
DROP POLICY IF EXISTS "View posts from self, follows, or public groups" ON public.posts;

CREATE POLICY "View posts from self, follows, or public groups" ON public.posts
  FOR SELECT USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND following_id = posts.author_id)
    OR (group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.group_id = posts.group_id AND (g.is_public OR gm.user_id = auth.uid())
    ))
    OR (challenge_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.challenges c WHERE c.id = posts.challenge_id
    ))
    OR (event_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.events e WHERE e.id = posts.event_id
    ))
    OR EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversation_members cm ON cm.conversation_id = m.conversation_id
      WHERE m.post_id = posts.id AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.posts wrapper
      WHERE wrapper.shared_post_id = posts.id
      AND (
        wrapper.author_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = auth.uid() AND f.following_id = wrapper.author_id
        )
        OR (wrapper.group_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.group_members gm
          JOIN public.groups g ON g.id = gm.group_id
          WHERE gm.group_id = wrapper.group_id AND (g.is_public OR gm.user_id = auth.uid())
        ))
        OR (wrapper.challenge_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.challenges c WHERE c.id = wrapper.challenge_id
        ))
        OR (wrapper.event_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.events e WHERE e.id = wrapper.event_id
        ))
      )
    )
  );

-- Message notifications: include shared post context
CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER AS $$
DECLARE
  member RECORD;
  preview_text TEXT;
BEGIN
  preview_text := CASE
    WHEN NEW.post_id IS NOT NULL THEN 'Shared a post'
    ELSE left(NEW.content, 100)
  END;

  FOR member IN
    SELECT user_id FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id AND user_id != NEW.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (
      member.user_id,
      'message',
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'sender_id', NEW.sender_id,
        'preview', preview_text,
        'post_id', NEW.post_id
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify original post author when their post is shared
CREATE OR REPLACE FUNCTION public.notify_on_post_share()
RETURNS TRIGGER AS $$
DECLARE
  original_post_id UUID;
  original_author UUID;
  sharer_id UUID;
  dest_type TEXT;
  dest_id UUID;
  dest_name TEXT;
BEGIN
  IF TG_TABLE_NAME = 'messages' THEN
    IF NEW.post_id IS NULL THEN
      RETURN NEW;
    END IF;
    original_post_id := NEW.post_id;
    sharer_id := NEW.sender_id;
    dest_type := 'message';
    dest_id := NEW.conversation_id;
  ELSE
    IF NEW.shared_post_id IS NULL THEN
      RETURN NEW;
    END IF;
    original_post_id := NEW.shared_post_id;
    sharer_id := NEW.author_id;
    IF NEW.group_id IS NOT NULL THEN
      dest_type := 'group';
      dest_id := NEW.group_id;
      SELECT name INTO dest_name FROM public.groups WHERE id = NEW.group_id;
    ELSIF NEW.challenge_id IS NOT NULL THEN
      dest_type := 'challenge';
      dest_id := NEW.challenge_id;
      SELECT title INTO dest_name FROM public.challenges WHERE id = NEW.challenge_id;
    ELSE
      RETURN NEW;
    END IF;
  END IF;

  SELECT author_id INTO original_author FROM public.posts WHERE id = original_post_id;
  IF original_author IS NULL OR original_author = sharer_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    original_author,
    'post_share',
    jsonb_build_object(
      'post_id', original_post_id,
      'sharer_id', sharer_id,
      'destination', dest_type,
      'destination_id', dest_id,
      'destination_name', dest_name,
      'conversation_id', CASE WHEN dest_type = 'message' THEN dest_id ELSE NULL END
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_post_share_notify ON public.messages;
CREATE TRIGGER on_message_post_share_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_share();

DROP TRIGGER IF EXISTS on_post_share_notify ON public.posts;
CREATE TRIGGER on_post_share_notify
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_post_share();
