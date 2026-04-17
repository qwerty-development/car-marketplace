-- ============================================================
-- Fix notification trigger: dealer routing, async HTTP, anon key
--
-- handle_notification_state_change() is a trigger on:
--   TABLE:  pending_notifications
--   TRIGGER: process_pending_notification  (AFTER INSERT, FOR EACH ROW)
--
-- It fires for ALL notification types (new_message, price_drop,
-- car_sold, view_milestone, inactive_reminder, dealership_notification)
-- so changes here affect the entire notification pipeline.
--
-- Changes:
--  1. handle_new_message_notification: route dealer recipients to
--     the dealer conversation screen (was always using user path)
--     and include proper params object for Expo Router navigation.
--  2. handle_notification_state_change: switch from synchronous
--     `http` extension (blocks the INSERT INTO messages transaction)
--     to async `pg_net` (fire-and-forget, no latency impact).
--  3. Credentials stored in Supabase Vault (encrypted at rest) and
--     read via vault.decrypted_secrets inside the trigger function.
--     To rotate the key: UPDATE vault.secrets SET secret = '...'
--       WHERE name = 'supabase_anon_key';
-- ============================================================

-- ╔══════════════════════════════════════════════════════════════╗
-- ║  ROLLBACK — paste this into the SQL editor to revert fully  ║
-- ╚══════════════════════════════════════════════════════════════╝
--
-- CREATE OR REPLACE FUNCTION handle_notification_state_change()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
-- DECLARE
--   response http_response;
--   duplicate_exists boolean;
--   v_anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vbWhkeGxtd3pkaWt4bXdpdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMwMzM5MDUsImV4cCI6MjAzODYwOTkwNX0.ONVTIDh-5yG7XcZk_UL2KMVYwHQQ3OyIhsXXOMJfoK8';
-- BEGIN
--   SELECT EXISTS (
--     SELECT 1 FROM pending_notifications
--     WHERE user_id = NEW.user_id AND type = NEW.type
--       AND data->>'message' = NEW.data->>'message'
--       AND created_at >= (NEW.created_at - interval '5 seconds')
--       AND id != NEW.id
--   ) INTO duplicate_exists;
--   IF NOT duplicate_exists AND TG_OP = 'INSERT' THEN
--     SELECT * INTO response FROM http((
--       'POST',
--       'https://momhdxlmwzdikxmwittx.supabase.co/functions/v1/process-notifications',
--       ARRAY[
--         http_header('Content-Type', 'application/json'),
--         http_header('Authorization', 'Bearer ' || v_anon_key)
--       ],
--       'application/json',
--       jsonb_build_object('record', row_to_json(NEW))
--     )::http_request);
--     IF response.status >= 400 THEN
--       INSERT INTO notification_errors (error_details, record)
--       VALUES (
--         jsonb_build_object('status', response.status, 'response', response.content),
--         row_to_json(NEW)
--       );
--     END IF;
--   END IF;
--   RETURN NEW;
-- END;
-- $$;
--
-- CREATE OR REPLACE FUNCTION handle_new_message_notification()
-- RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
-- DECLARE
--   v_conversation RECORD;
--   v_recipient_id TEXT;
--   v_sender_name TEXT;
--   v_notification_title TEXT;
--   v_notification_body TEXT;
--   v_screen TEXT;
-- BEGIN
--   SELECT c.user_id, c.seller_user_id, c.dealership_id, c.conversation_type, c.id as conv_id
--   INTO v_conversation FROM conversations c WHERE c.id = NEW.conversation_id;
--   IF NOT FOUND THEN RETURN NEW; END IF;
--   IF NEW.sender_role = 'user' THEN
--     IF v_conversation.conversation_type = 'user_dealer' AND v_conversation.dealership_id IS NOT NULL THEN
--       SELECT d.user_id INTO v_recipient_id FROM dealerships d WHERE d.id = v_conversation.dealership_id;
--     ELSIF v_conversation.conversation_type = 'user_user' AND v_conversation.seller_user_id IS NOT NULL THEN
--       v_recipient_id := v_conversation.seller_user_id;
--     END IF;
--   ELSIF NEW.sender_role = 'dealer' THEN
--     v_recipient_id := v_conversation.user_id;
--   ELSIF NEW.sender_role = 'seller_user' THEN
--     v_recipient_id := v_conversation.user_id;
--   END IF;
--   IF v_recipient_id IS NULL OR v_recipient_id = NEW.sender_id THEN RETURN NEW; END IF;
--   SELECT COALESCE(u.name, 'Someone') INTO v_sender_name FROM users u WHERE u.id = NEW.sender_id;
--   v_notification_title := v_sender_name;
--   v_notification_body := COALESCE(LEFT(NEW.body, 100), 'Sent an attachment');
--   v_screen := '/(home)/(user)/conversations/' || NEW.conversation_id;
--   INSERT INTO pending_notifications (user_id, type, data)
--   VALUES (v_recipient_id, 'new_message', json_build_object(
--     'title', v_notification_title, 'message', v_notification_body,
--     'screen', v_screen, 'conversationId', NEW.conversation_id,
--     'messageId', NEW.id, 'senderId', NEW.sender_id
--   ));
--   RETURN NEW;
-- END;
-- $$;
--
-- Also re-enable the duplicate trigger if you disabled it:
-- ALTER TABLE messages ENABLE TRIGGER trigger_notify_chat_message;
-- ════════════════════════════════════════════════════════════════

-- ── 0. Enable Supabase Vault (idempotent, safe to run if already on) ─
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- ── 1. Store credentials in Supabase Vault (idempotent) ───────
-- Secrets are stored encrypted and read via vault.decrypted_secrets.
-- To rotate: SELECT vault.update_secret(id, '<new-value>') FROM vault.secrets
--   WHERE name = 'supabase_anon_key';
DO $$
BEGIN
  -- Anon key
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'supabase_anon_key') THEN
    UPDATE vault.secrets
    SET secret = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vbWhkeGxtd3pkaWt4bXdpdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMwMzM5MDUsImV4cCI6MjAzODYwOTkwNX0.ONVTIDh-5yG7XcZk_UL2KMVYwHQQ3OyIhsXXOMJfoK8'
    WHERE name = 'supabase_anon_key';
  ELSE
    PERFORM vault.create_secret(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1vbWhkeGxtd3pkaWt4bXdpdHR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMwMzM5MDUsImV4cCI6MjAzODYwOTkwNX0.ONVTIDh-5yG7XcZk_UL2KMVYwHQQ3OyIhsXXOMJfoK8',
      'supabase_anon_key',
      'Supabase anon key used by DB triggers to call Edge Functions'
    );
  END IF;

  -- Project URL (custom domain)
  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'supabase_project_url') THEN
    UPDATE vault.secrets
    SET secret = 'https://auth.fleetapp.me'
    WHERE name = 'supabase_project_url';
  ELSE
    PERFORM vault.create_secret(
      'https://auth.fleetapp.me',
      'supabase_project_url',
      'Supabase project URL (custom domain) used by DB triggers to call Edge Functions'
    );
  END IF;
END $$;

-- ── 2. Replace handle_new_message_notification ────────────────
--    Fixes: dealer routing + proper Expo Router params in data
CREATE OR REPLACE FUNCTION handle_new_message_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_conversation   RECORD;
  v_recipient_id   TEXT;
  v_recipient_role TEXT;
  v_sender_name    TEXT;
  v_notification_title TEXT;
  v_notification_body  TEXT;
  v_screen             TEXT;
BEGIN
  -- Fetch conversation details
  SELECT c.user_id, c.seller_user_id, c.dealership_id,
         c.conversation_type, c.id AS conv_id
  INTO v_conversation
  FROM conversations c
  WHERE c.id = NEW.conversation_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Determine recipient: the party that did NOT send the message
  IF NEW.sender_role = 'user' THEN
    IF v_conversation.conversation_type = 'user_dealer'
       AND v_conversation.dealership_id IS NOT NULL THEN
      -- user → dealer: notify the dealer's owner account
      SELECT d.user_id INTO v_recipient_id
      FROM dealerships d
      WHERE d.id = v_conversation.dealership_id;
    ELSIF v_conversation.conversation_type = 'user_user'
          AND v_conversation.seller_user_id IS NOT NULL THEN
      v_recipient_id := v_conversation.seller_user_id;
    END IF;
  ELSIF NEW.sender_role = 'dealer' THEN
    -- dealer → notify the buyer
    v_recipient_id := v_conversation.user_id;
  ELSIF NEW.sender_role = 'seller_user' THEN
    -- seller_user → notify the buyer
    v_recipient_id := v_conversation.user_id;
  END IF;

  -- Safety checks
  IF v_recipient_id IS NULL OR v_recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  -- Look up recipient role to decide which screen to route to
  SELECT role INTO v_recipient_role
  FROM users
  WHERE id = v_recipient_id;

  -- Get sender name
  SELECT COALESCE(u.name, 'Someone') INTO v_sender_name
  FROM users u
  WHERE u.id = NEW.sender_id;

  v_notification_title := v_sender_name;
  v_notification_body  := COALESCE(LEFT(NEW.body, 100), 'Sent an attachment');

  -- Route to the correct screen based on recipient role
  IF v_recipient_role = 'dealer' THEN
    v_screen := '/(home)/(dealer)/conversations/[conversationId]';
  ELSE
    v_screen := '/(home)/(user)/conversations/[conversationId]';
  END IF;

  -- Insert into pending_notifications
  -- params object matches what useNotifications.ts feeds to router.push()
  INSERT INTO pending_notifications (user_id, type, data)
  VALUES (
    v_recipient_id,
    'new_message',
    jsonb_build_object(
      'title',          v_notification_title,
      'message',        v_notification_body,
      'screen',         v_screen,
      'params',         jsonb_build_object('conversationId', NEW.conversation_id::text),
      'conversationId', NEW.conversation_id,
      'messageId',      NEW.id,
      'senderId',       NEW.sender_id
    )
  );

  RETURN NEW;
END;
$$;

-- ── 3. Replace handle_notification_state_change ───────────────
--    Fixes: sync http → async pg_net, anon key from DB setting
CREATE OR REPLACE FUNCTION handle_notification_state_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  duplicate_exists BOOLEAN;
  v_anon_key       TEXT;
  v_url            TEXT;
BEGIN
  -- Load credentials from Supabase Vault (encrypted at rest)
  SELECT decrypted_secret INTO v_anon_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_anon_key'
  LIMIT 1;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_project_url'
  LIMIT 1;

  -- Safety: skip if secrets are missing (avoids sending with blank auth)
  IF v_anon_key IS NULL OR v_url IS NULL THEN
    RAISE WARNING 'handle_notification_state_change: vault secrets missing, skipping HTTP call';
    RETURN NEW;
  END IF;

  -- Dedup: skip if a notification with the same message body was
  -- already queued for this user within the last 5 seconds.
  -- (Uses messageId when available for a tighter match.)
  SELECT EXISTS (
    SELECT 1
    FROM pending_notifications
    WHERE user_id = NEW.user_id
      AND type    = NEW.type
      AND (
        -- Prefer matching on messageId when both rows have it
        (NEW.data->>'messageId' IS NOT NULL
          AND data->>'messageId' = NEW.data->>'messageId')
        OR
        -- Fallback: match on truncated message body
        (NEW.data->>'messageId' IS NULL
          AND data->>'message' = NEW.data->>'message')
      )
      AND created_at >= (NEW.created_at - interval '5 seconds')
      AND id != NEW.id
  ) INTO duplicate_exists;

  IF NOT duplicate_exists AND TG_OP = 'INSERT' THEN
    -- Fire-and-forget async HTTP via pg_net (does NOT block the
    -- INSERT INTO messages transaction)
    PERFORM net.http_post(
      url     := v_url || '/functions/v1/process-notifications',
      headers := jsonb_build_object(
                   'Content-Type',  'application/json',
                   'Authorization', 'Bearer ' || v_anon_key
                 ),
      body    := jsonb_build_object('record', row_to_json(NEW))
    );
  END IF;

  RETURN NEW;
END;
$$;
