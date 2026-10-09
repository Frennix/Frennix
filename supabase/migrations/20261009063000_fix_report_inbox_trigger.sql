-- Profile reports insert into public.reports, then notify_on_user_report
-- copies the row into the founder inbox. The trigger named columns that
-- founder_inbox_items does not have, so every insert rolled back.

CREATE OR REPLACE FUNCTION public.notify_on_user_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.founder_inbox_items (
    type,
    priority,
    title,
    body,
    source_table,
    source_id,
    status,
    metadata
  )
  VALUES (
    'user_report',
    'high',
    'New user report',
    NEW.reason,
    'reports',
    NEW.id,
    'open',
    jsonb_build_object(
      'report_id', NEW.id,
      'reported_user_id', NEW.reported_user_id,
      'content_type', NEW.content_type
    )
  );
  RETURN NEW;
END;
$$;
