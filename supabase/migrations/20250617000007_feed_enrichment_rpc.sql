-- Server-side feed enrichment: replaces per-page client round trips that fetched all like/comment rows.

CREATE OR REPLACE FUNCTION public.get_post_interaction_stats(
  p_post_ids uuid[],
  p_viewer_id uuid
)
RETURNS TABLE (
  post_id uuid,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean,
  saved_by_me boolean
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    pid AS post_id,
    COALESCE((
      SELECT count(*)::bigint FROM public.likes l WHERE l.post_id = pid
    ), 0) AS like_count,
    COALESCE((
      SELECT count(*)::bigint FROM public.comments c WHERE c.post_id = pid
    ), 0) AS comment_count,
    EXISTS (
      SELECT 1 FROM public.likes l WHERE l.post_id = pid AND l.user_id = p_viewer_id
    ) AS liked_by_me,
    EXISTS (
      SELECT 1 FROM public.saved_posts s WHERE s.post_id = pid AND s.user_id = p_viewer_id
    ) AS saved_by_me
  FROM unnest(p_post_ids) AS pid;
$$;

CREATE OR REPLACE FUNCTION public.get_post_preview_comments(p_post_ids uuid[])
RETURNS TABLE (
  id uuid,
  post_id uuid,
  author_id uuid,
  parent_id uuid,
  content text,
  created_at timestamptz,
  author jsonb
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      c.id,
      c.post_id,
      c.author_id,
      c.parent_id,
      c.content,
      c.created_at,
      row_number() OVER (PARTITION BY c.post_id ORDER BY c.created_at ASC) AS rn
    FROM public.comments c
    WHERE c.post_id = ANY(p_post_ids)
      AND c.parent_id IS NULL
  )
  SELECT
    r.id,
    r.post_id,
    r.author_id,
    r.parent_id,
    r.content,
    r.created_at,
    to_jsonb(p.*) AS author
  FROM ranked r
  JOIN public.profiles p ON p.id = r.author_id
  WHERE r.rn <= 2;
$$;

GRANT EXECUTE ON FUNCTION public.get_post_interaction_stats(uuid[], uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_post_preview_comments(uuid[]) TO authenticated;
