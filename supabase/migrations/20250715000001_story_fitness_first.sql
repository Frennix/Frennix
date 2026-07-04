-- Fitness-first Stories: training challenges, countdowns, questions, commitments

-- ─── Story-native training challenges (no feed challenge required) ───────────

CREATE TABLE IF NOT EXISTS public.story_training_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id)
);

ALTER TABLE public.story_challenge_joins
  ALTER COLUMN challenge_id DROP NOT NULL;

ALTER TABLE public.story_challenge_joins
  ADD COLUMN IF NOT EXISTS story_training_challenge_id UUID
    REFERENCES public.story_training_challenges(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS story_challenge_joins_training_unique
  ON public.story_challenge_joins (story_id, user_id)
  WHERE story_training_challenge_id IS NOT NULL;

-- ─── Training countdown stickers ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.story_countdowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  target_at TIMESTAMPTZ NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id)
);

CREATE TABLE IF NOT EXISTS public.story_countdown_subscriptions (
  countdown_id UUID NOT NULL REFERENCES public.story_countdowns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (countdown_id, user_id)
);

-- ─── Training questions (private answers, optional share) ────────────────────

CREATE TABLE IF NOT EXISTS public.story_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id)
);

CREATE TABLE IF NOT EXISTS public.story_question_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.story_questions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  shared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, user_id)
);

-- ─── Workout commitments + completion badge ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.story_workout_commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commitment_text TEXT NOT NULL,
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (story_id)
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.story_training_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_countdowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_countdown_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_workout_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads story training challenges"
  ON public.story_training_challenges FOR SELECT USING (true);

CREATE POLICY "Story owners create training challenges"
  ON public.story_training_challenges FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

CREATE POLICY "Anyone reads story countdowns"
  ON public.story_countdowns FOR SELECT USING (true);

CREATE POLICY "Story owners create countdowns"
  ON public.story_countdowns FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

CREATE POLICY "Users manage countdown subscriptions"
  ON public.story_countdown_subscriptions FOR ALL
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anyone reads countdown subscriptions"
  ON public.story_countdown_subscriptions FOR SELECT USING (true);

CREATE POLICY "Anyone reads story questions"
  ON public.story_questions FOR SELECT USING (true);

CREATE POLICY "Story owners create questions"
  ON public.story_questions FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

CREATE POLICY "Users submit question answers"
  ON public.story_question_answers FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own answers or story owner reads all"
  ON public.story_question_answers FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.story_questions q
      JOIN public.stories s ON s.id = q.story_id
      WHERE q.id = question_id AND s.user_id = auth.uid()
    )
    OR shared_at IS NOT NULL
  );

CREATE POLICY "Users update own answers to share"
  ON public.story_question_answers FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Anyone reads commitments on visible stories"
  ON public.story_workout_commitments FOR SELECT USING (true);

CREATE POLICY "Story owners create commitments"
  ON public.story_workout_commitments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Story owners mark commitment complete"
  ON public.story_workout_commitments FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
