-- Fix RLS infinite recursion on conversation_members by using a SECURITY DEFINER helper.

CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id uuid, uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_members
    WHERE conversation_id = conv_id AND user_id = uid
  );
$$;

DROP POLICY IF EXISTS "View conversation members" ON public.conversation_members;
CREATE POLICY "View conversation members" ON public.conversation_members
  FOR SELECT USING (
    public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Add conversation members" ON public.conversation_members;
CREATE POLICY "Add conversation members" ON public.conversation_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    OR public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "View own conversations" ON public.conversations;
CREATE POLICY "View own conversations" ON public.conversations
  FOR SELECT USING (
    public.is_conversation_member(id, auth.uid())
  );

CREATE POLICY "Update own conversations" ON public.conversations
  FOR UPDATE USING (public.is_conversation_member(id, auth.uid()));

DROP POLICY IF EXISTS "View messages in own conversations" ON public.messages;
CREATE POLICY "View messages in own conversations" ON public.messages
  FOR SELECT USING (
    public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Send messages" ON public.messages;
CREATE POLICY "Send messages" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );

DROP POLICY IF EXISTS "Mark messages read in own conversations" ON public.messages;
CREATE POLICY "Mark messages read in own conversations" ON public.messages
  FOR UPDATE USING (
    sender_id != auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  )
  WITH CHECK (
    sender_id != auth.uid()
    AND public.is_conversation_member(conversation_id, auth.uid())
  );
