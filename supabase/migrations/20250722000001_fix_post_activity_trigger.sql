-- v1.0.2 hotfix: post insert trigger still used legacy activity column after engine migration.
-- Migration 20250719000001 renamed the activity column and added record_activity_feed_post(),
-- but never replaced workout_post_activity_record.

DROP TRIGGER IF EXISTS workout_post_activity_record ON public.posts;
DROP TRIGGER IF EXISTS feed_post_activity_record ON public.posts;

CREATE OR REPLACE FUNCTION public.record_activity_feed_post()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM public.publish_platform_activity(
    NEW.author_id, 'feed_post_created', 'posts', NEW.id,
    jsonb_build_object('post_type', NEW.post_type), NEW.created_at
  );

  IF NEW.post_type IN ('workout_update', 'photo', 'video') THEN
    PERFORM public.publish_platform_activity(
      NEW.author_id, 'workout_completed', 'posts', NEW.id,
      jsonb_build_object('post_type', NEW.post_type), NEW.created_at
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER feed_post_activity_record
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.record_activity_feed_post();

DROP FUNCTION IF EXISTS public.record_activity_workout_post();

COMMENT ON FUNCTION public.record_activity_feed_post IS
  'Platform Activity Engine — records feed_post_created and workout_completed for workout shares.';
