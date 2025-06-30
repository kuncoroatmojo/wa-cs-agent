-- Fix external_message_id constraint for conversation_messages table
-- This enables proper upsert operations with onConflict parameter

-- Remove any existing constraints/indexes on external_message_id
DROP INDEX IF EXISTS idx_conversation_messages_external_message_id;
DROP INDEX IF EXISTS idx_conversation_messages_external_message_id_unique;
ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_external_message_id_key;
ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS unique_external_message_id;
ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_external_message_id_unique;

-- Update any NULL external_message_ids with a generated value to avoid conflicts
UPDATE conversation_messages 
SET external_message_id = 'msg_' || id::text || '_' || extract(epoch from created_at)::bigint
WHERE external_message_id IS NULL OR external_message_id = '';

-- Create a simple unique constraint 
ALTER TABLE conversation_messages 
ADD CONSTRAINT conversation_messages_external_message_id_unique 
UNIQUE (external_message_id);

-- Create an index for performance
CREATE INDEX idx_conversation_messages_external_message_id 
ON conversation_messages (external_message_id);
