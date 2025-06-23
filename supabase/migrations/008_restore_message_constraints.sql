-- Restore unique constraint on external_message_id for webhook upserts
-- This allows the webhook to use ON CONFLICT (external_message_id) DO UPDATE

-- First, clean up any duplicate external_message_id values
DELETE FROM conversation_messages 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM conversation_messages 
  GROUP BY external_message_id
  HAVING external_message_id IS NOT NULL
);

-- Add unique constraint back on external_message_id
-- But allow NULL values (for manual messages that don't have external IDs)
CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_external_message_id_unique 
ON conversation_messages(external_message_id) 
WHERE external_message_id IS NOT NULL; 