-- Migration: Add unique constraint on external_message_id
-- This ensures no duplicate messages can be inserted with the same external_message_id

-- Create unique index on external_message_id (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_external_message_id_unique
ON conversation_messages(external_message_id)
WHERE external_message_id IS NOT NULL;

-- Add a comment to document this constraint
COMMENT ON INDEX conversation_messages_external_message_id_unique IS 
'Ensures each external_message_id is unique to prevent duplicate messages from external systems like WhatsApp/Evolution API'; 