-- ============================================================
-- Drop the duplicate message notification trigger.
--
-- Two AFTER INSERT triggers on `messages` both insert into
-- `pending_notifications`, causing a race condition where the
-- second trigger's notification is already marked processed by
-- the first, producing constant 404 errors and unreliable delivery.
--
-- KEEP: on_new_message_notification (handle_new_message_notification)
--   - Includes messageId for proper dedup
--   - Includes senderId for client-side logic
--   - Handles seller_user role correctly
--
-- DROP: trigger_notify_chat_message (notify_chat_message)
--   - Missing messageId (produces null messageId in data → 37 phantom duplicates)
--   - Redundant with the kept trigger
-- ============================================================

DROP TRIGGER IF EXISTS trigger_notify_chat_message ON messages;
DROP FUNCTION IF EXISTS notify_chat_message();
