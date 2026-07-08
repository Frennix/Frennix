-- Allow send-push edge function (service_role) to resolve match notifications → DM chat deep links.

GRANT EXECUTE ON FUNCTION public.create_or_get_dm_conversation(UUID, UUID) TO service_role;
