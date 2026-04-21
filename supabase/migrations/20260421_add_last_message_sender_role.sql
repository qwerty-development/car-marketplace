-- ============================================================
-- BACKUP of update_conversation_metadata() BEFORE this migration
-- To restore, run everything between the dashes:
-- ----------------------------------------------------------------
-- CREATE OR REPLACE FUNCTION public.update_conversation_metadata()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- AS $function$
-- DECLARE
--   v_conversation_type text;
--   v_user_id text;
--   v_seller_user_id text;
-- BEGIN
--   SELECT conversation_type, user_id, seller_user_id
--   INTO v_conversation_type, v_user_id, v_seller_user_id
--   FROM conversations
--   WHERE id = NEW.conversation_id;
--
--   UPDATE conversations
--   SET
--     last_message_at = NEW.created_at,
--     last_message_preview = COALESCE(LEFT(NEW.body, 100), 'Attachment'),
--     updated_at = NOW(),
--     user_unread_count = user_unread_count +
--       CASE
--         WHEN v_conversation_type = 'user_dealer' AND NEW.sender_role = 'dealer' THEN 1
--         WHEN v_conversation_type = 'user_user' AND NEW.sender_role = 'seller_user' THEN 1
--         ELSE 0
--       END,
--     seller_unread_count = seller_unread_count +
--       CASE
--         WHEN v_conversation_type = 'user_dealer' AND NEW.sender_role = 'user' THEN 1
--         WHEN v_conversation_type = 'user_user' AND NEW.sender_role = 'user' THEN 1
--         ELSE 0
--       END
--   WHERE id = NEW.conversation_id;
--
--   RETURN NEW;
-- END;
-- $function$;
-- ----------------------------------------------------------------

-- Add column with NULL default so existing rows and old app versions are unaffected
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS last_message_sender_role text DEFAULT NULL;

-- Replace the trigger function to also write last_message_sender_role
CREATE OR REPLACE FUNCTION public.update_conversation_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_conversation_type text;
  v_user_id text;
  v_seller_user_id text;
BEGIN
  SELECT conversation_type, user_id, seller_user_id
  INTO v_conversation_type, v_user_id, v_seller_user_id
  FROM conversations
  WHERE id = NEW.conversation_id;

  UPDATE conversations
  SET
    last_message_at = NEW.created_at,
    last_message_preview = COALESCE(LEFT(NEW.body, 100), 'Attachment'),
    last_message_sender_role = NEW.sender_role,
    updated_at = NOW(),

    user_unread_count = user_unread_count +
      CASE
        WHEN v_conversation_type = 'user_dealer' AND NEW.sender_role = 'dealer' THEN 1
        WHEN v_conversation_type = 'user_user' AND NEW.sender_role = 'seller_user' THEN 1
        ELSE 0
      END,

    seller_unread_count = seller_unread_count +
      CASE
        WHEN v_conversation_type = 'user_dealer' AND NEW.sender_role = 'user' THEN 1
        WHEN v_conversation_type = 'user_user' AND NEW.sender_role = 'user' THEN 1
        ELSE 0
      END
  WHERE id = NEW.conversation_id;

  RETURN NEW;
END;
$function$;
