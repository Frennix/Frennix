-- Remove invalid story-owner self-view records and block future owner view events.

DELETE FROM public.story_slide_views AS ssv
USING public.stories AS s
WHERE ssv.story_id = s.id
  AND ssv.viewer_id = s.user_id;

DELETE FROM public.story_item_views AS siv
USING public.stories AS s
WHERE siv.story_id = s.id
  AND siv.viewer_id = s.user_id;

DELETE FROM public.story_engagement_events AS see
USING public.stories AS s
WHERE see.story_id = s.id
  AND see.event_type = 'view'
  AND see.viewer_id = s.user_id;
