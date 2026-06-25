-- Frennix initial schema with RLS

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  fitness_goals TEXT[] DEFAULT '{}',
  activities TEXT[] DEFAULT '{}',
  city TEXT,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'followers', 'private')),
  matching_enabled BOOLEAN DEFAULT false,
  gender TEXT,
  match_preference TEXT CHECK (match_preference IN ('same', 'opposite', 'any')),
  is_premium BOOLEAN DEFAULT false,
  onboarding_complete BOOLEAN DEFAULT false,
  push_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_activities ON public.profiles USING GIN(activities);
CREATE INDEX idx_profiles_fitness_goals ON public.profiles USING GIN(fitness_goals);

-- Posts
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  media_urls TEXT[] DEFAULT '{}',
  post_type TEXT NOT NULL DEFAULT 'text' CHECK (post_type IN ('workout_update', 'text', 'photo', 'video')),
  group_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_posts_author ON public.posts(author_id);
CREATE INDEX idx_posts_group ON public.posts(group_id);
CREATE INDEX idx_posts_created ON public.posts(created_at DESC);

-- Follows
CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Likes
CREATE TABLE public.likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

-- Comments
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now() 
  );

-- Groups
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  sport_tags TEXT[] DEFAULT '{}',
  cover_image_url TEXT,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.posts
  ADD CONSTRAINT posts_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON DELETE SET NULL;

-- Group members
CREATE TABLE public.group_members (
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

-- Challenges
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.challenge_participants (
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'left')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (challenge_id, user_id)
);

-- Messaging
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.conversation_members (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);

-- Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);

-- Moderation
CREATE TABLE public.blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reported_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Future: marketplace products (stub)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  image_url TEXT,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    'user_' || substr(replace(NEW.id::text, '-', ''), 1, 8),
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'Frennix User')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- DM conversation lookup
CREATE OR REPLACE FUNCTION public.get_dm_conversation(user_a UUID, user_b UUID)
RETURNS UUID AS $$
  SELECT cm1.conversation_id
  FROM public.conversation_members cm1
  JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
  WHERE cm1.user_id = user_a AND cm2.user_id = user_b
  AND (
    SELECT COUNT(*) FROM public.conversation_members cm3
    WHERE cm3.conversation_id = cm1.conversation_id
  ) = 2
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Notification triggers
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (NEW.following_id, 'follow', jsonb_build_object('follower_id', NEW.follower_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_follow_notify
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

CREATE OR REPLACE FUNCTION public.notify_on_message()
RETURNS TRIGGER AS $$
DECLARE
  member RECORD;
BEGIN
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
        'preview', left(NEW.content, 100)
      )
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_message_notify
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_message();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER posts_updated_at BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable" ON public.profiles
  FOR SELECT USING (
    visibility = 'public'
    OR id = auth.uid()
    OR (visibility = 'followers' AND EXISTS (
      SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND following_id = profiles.id
    ))
  );

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Posts policies
CREATE POLICY "View posts from self, follows, or public groups" ON public.posts
  FOR SELECT USING (
    author_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.follows WHERE follower_id = auth.uid() AND following_id = posts.author_id)
    OR (group_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.group_id = posts.group_id AND (g.is_public OR gm.user_id = auth.uid())
    ))
  );

CREATE POLICY "Users create own posts" ON public.posts
  FOR INSERT WITH CHECK (author_id = auth.uid());

CREATE POLICY "Users update own posts" ON public.posts
  FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "Users delete own posts" ON public.posts
  FOR DELETE USING (author_id = auth.uid());

-- Follows
CREATE POLICY "View follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Create follow" ON public.follows FOR INSERT WITH CHECK (follower_id = auth.uid());
CREATE POLICY "Delete own follow" ON public.follows FOR DELETE USING (follower_id = auth.uid());

-- Likes
CREATE POLICY "View likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Create like" ON public.likes FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Delete own like" ON public.likes FOR DELETE USING (user_id = auth.uid());

-- Comments
CREATE POLICY "View comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Create comment" ON public.comments FOR INSERT WITH CHECK (author_id = auth.uid());

-- Groups
CREATE POLICY "View public groups or member groups" ON public.groups
  FOR SELECT USING (
    is_public = true
    OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.group_members WHERE group_id = groups.id AND user_id = auth.uid())
  );

CREATE POLICY "Create groups" ON public.groups FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners update groups" ON public.groups FOR UPDATE USING (owner_id = auth.uid());

-- Group members
CREATE POLICY "View group members" ON public.group_members FOR SELECT USING (true);
CREATE POLICY "Join groups" ON public.group_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leave groups" ON public.group_members FOR DELETE USING (user_id = auth.uid());

-- Challenges
CREATE POLICY "View challenges" ON public.challenges FOR SELECT USING (true);
CREATE POLICY "Create challenges" ON public.challenges FOR INSERT WITH CHECK (created_by = auth.uid());

-- Challenge participants
CREATE POLICY "View participants" ON public.challenge_participants FOR SELECT USING (true);
CREATE POLICY "Join challenge" ON public.challenge_participants FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leave challenge" ON public.challenge_participants FOR DELETE USING (user_id = auth.uid());

-- Conversations
CREATE POLICY "View own conversations" ON public.conversations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.conversation_members WHERE conversation_id = conversations.id AND user_id = auth.uid())
  );

CREATE POLICY "Create conversations" ON public.conversations FOR INSERT WITH CHECK (true);

-- Conversation members
CREATE POLICY "View conversation members" ON public.conversation_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Add conversation members" ON public.conversation_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.conversation_members cm
      WHERE cm.conversation_id = conversation_members.conversation_id AND cm.user_id = auth.uid()
    )
  );

-- Messages
CREATE POLICY "View messages in own conversations" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_members
      WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
  );

-- Notifications
CREATE POLICY "View own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Blocks
CREATE POLICY "Manage own blocks" ON public.blocks FOR ALL USING (blocker_id = auth.uid());

-- Reports
CREATE POLICY "Create reports" ON public.reports FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Products (public read when active - future marketplace)
CREATE POLICY "View active products" ON public.products FOR SELECT USING (active = true);

-- Storage buckets (run via dashboard or separate migration)
-- avatars, posts buckets with RLS policies in Supabase dashboard

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
