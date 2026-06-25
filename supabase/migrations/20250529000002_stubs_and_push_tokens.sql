-- Stub tables and push_tokens for MVP+ forward compatibility

CREATE TABLE public.push_tokens (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_token TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios' CHECK (platform IN ('ios', 'android', 'web')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, expo_token)
);

CREATE INDEX idx_push_tokens_user ON public.push_tokens(user_id);

-- Matching stubs
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'unmatched')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b),
  CHECK (user_a != user_b)
);

CREATE TABLE public.match_swipes (
  swiper_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  swipee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('left', 'right')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (swiper_id, swipee_id),
  CHECK (swiper_id != swipee_id)
);

-- Premium stubs
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  interval TEXT NOT NULL DEFAULT 'month' CHECK (interval IN ('month', 'year')),
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'cancelled')),
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Events stub
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  location_geo JSONB,
  group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notification triggers for likes and comments
CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (post_author, 'like', jsonb_build_object('post_id', NEW.post_id, 'user_id', NEW.user_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like_notify
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

CREATE OR REPLACE FUNCTION public.notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  post_author UUID;
BEGIN
  SELECT author_id INTO post_author FROM public.posts WHERE id = NEW.post_id;
  IF post_author IS NOT NULL AND post_author != NEW.author_id THEN
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (post_author, 'comment', jsonb_build_object('post_id', NEW.post_id, 'author_id', NEW.author_id));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_notify
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_comment();

-- RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_swipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push tokens" ON public.push_tokens
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users view own matches" ON public.matches
  FOR SELECT USING (user_a = auth.uid() OR user_b = auth.uid());

CREATE POLICY "Users manage own swipes" ON public.match_swipes
  FOR ALL USING (swiper_id = auth.uid()) WITH CHECK (swiper_id = auth.uid());

CREATE POLICY "View active subscription plans" ON public.subscription_plans
  FOR SELECT USING (active = true);

CREATE POLICY "Users view own subscriptions" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "View events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Create events" ON public.events FOR INSERT WITH CHECK (created_by = auth.uid());
