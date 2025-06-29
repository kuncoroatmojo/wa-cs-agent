-- Fix external_message_id constraint for conversation_messages table
-- This enables proper upsert operations with onConflict parameter

-- First, remove any existing constraints/indexes on external_message_id
DROP INDEX IF EXISTS idx_conversation_messages_external_message_id;
ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_external_message_id_key;
ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS unique_external_message_id;

-- Create a proper unique constraint on external_message_id 
-- Note: We allow NULL values since some messages might not have external IDs
CREATE UNIQUE INDEX idx_conversation_messages_external_message_id_unique 
ON conversation_messages (external_message_id) 
WHERE external_message_id IS NOT NULL;

-- Add a named constraint for better error handling
ALTER TABLE conversation_messages 
ADD CONSTRAINT conversation_messages_external_message_id_unique 
UNIQUE USING INDEX idx_conversation_messages_external_message_id_unique;

-- Update any NULL external_message_ids with a generated value to avoid conflicts
UPDATE conversation_messages 
SET external_message_id = 'msg_' || id::text || '_' || extract(epoch from created_at)::bigint
WHERE external_message_id IS NULL;
