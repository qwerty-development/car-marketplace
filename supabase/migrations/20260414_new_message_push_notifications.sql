-- ============================================================
-- MIGRATION: Add push notifications for new chat messages
-- Purpose: Create pending_notifications when a new message is sent
-- Date: 2026-04-14
--
-- Problem: The process-notifications Edge Function handles 'new_message'
-- type notifications, but no trigger inserts them into pending_notifications
-- when a message is created. Users only see the in-app badge but never
-- receive a push notification for new messages.
--
-- Fix: Add a trigger on the messages table that creates a
-- pending_notifications record for the recipient of each new message.
-- The existing handle_notification_state_change trigger then fires
-- the Edge Function to deliver the push notification.
-- ============================================================

-- 1. Create the trigger function
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_conversation RECORD;
  v_recipient_id TEXT;
  v_sender_name TEXT;
  v_notification_title TEXT;
  v_notification_body TEXT;
  v_screen TEXT;
BEGIN
  -- Fetch conversation details to determine the recipient
  SELECT c.user_id, c.seller_user_id, c.dealership_id, c.conversation_type, c.id as conv_id
  INTO v_conversation
  FROM conversations c
  WHERE c.id = NEW.conversation_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Determine recipient: the person who did NOT send the message
  IF NEW.sender_role = 'user' THEN
    -- User sent the message → notify the dealer or seller_user
    IF v_conversation.conversation_type = 'user_dealer' AND v_conversation.dealership_id IS NOT NULL THEN
      -- For user→dealer conversations, find the dealer's user account
      SELECT d.user_id INTO v_recipient_id
      FROM dealerships d
      WHERE d.id = v_conversation.dealership_id;
    ELSIF v_conversation.conversation_type = 'user_user' AND v_conversation.seller_user_id IS NOT NULL THEN
      v_recipient_id := v_conversation.seller_user_id;
    END IF;
  ELSIF NEW.sender_role = 'dealer' THEN
    -- Dealer sent the message → notify the user (buyer)
    v_recipient_id := v_conversation.user_id;
  ELSIF NEW.sender_role = 'seller_user' THEN
    -- Seller user sent the message → notify the buyer
    v_recipient_id := v_conversation.user_id;
  END IF;

  -- Safety: don't notify yourself, and must have a recipient
  IF v_recipient_id IS NULL OR v_recipient_id = NEW.sender_id THEN
    RETURN NEW;
  END IF;

  -- Get sender name for notification title
  SELECT COALESCE(u.name, 'Someone') INTO v_sender_name
  FROM users u
  WHERE u.id = NEW.sender_id;

  v_notification_title := v_sender_name;
  v_notification_body := COALESCE(
    LEFT(NEW.body, 100),
    'Sent an attachment'
  );

  -- Route to the correct screen based on recipient role
  IF v_conversation.conversation_type = 'user_dealer' AND NEW.sender_role = 'user' THEN
    -- Recipient is a dealer → use dealer conversation screen
    v_screen := '/(home)/(dealer)/conversations/' || NEW.conversation_id;
  ELSE
    v_screen := '/(home)/(user)/conversations/' || NEW.conversation_id;
  END IF;

  -- Insert into pending_notifications (triggers handle_notification_state_change → Edge Function)
  INSERT INTO pending_notifications (user_id, type, data)
  VALUES (
    v_recipient_id,
    'new_message',
    json_build_object(
      'title', v_notification_title,
      'message', v_notification_body,
      'screen', v_screen,
      'conversationId', NEW.conversation_id,
      'messageId', NEW.id,
      'senderId', NEW.sender_id
    )
  );

  RETURN NEW;
END;
$function$;

-- 2. Create the trigger on the messages table
DROP TRIGGER IF EXISTS on_new_message_notification ON messages;
CREATE TRIGGER on_new_message_notification
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_message_notification();
