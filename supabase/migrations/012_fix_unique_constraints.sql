-- Migration: Fix unique constraints for upsert operations
-- This replaces indexes with proper constraints to support ON CONFLICT clauses

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS conversation_messages_external_message_id_unique;
DROP INDEX IF EXISTS conversations_external_conversation_id_unique;

-- Add proper unique constraints for conversation_messages.external_message_id
ALTER TABLE conversation_messages 
ADD CONSTRAINT conversation_messages_external_message_id_unique 
UNIQUE (external_message_id);

-- Add proper unique constraints for conversations.external_conversation_id  
ALTER TABLE conversations
ADD CONSTRAINT conversations_external_conversation_id_unique
UNIQUE (external_conversation_id);

-- Add comments to document these constraints
COMMENT ON CONSTRAINT conversation_messages_external_message_id_unique ON conversation_messages IS 
'Ensures each external_message_id is unique to prevent duplicate messages from external systems like WhatsApp/Evolution API';

COMMENT ON CONSTRAINT conversations_external_conversation_id_unique ON conversations IS
'Ensures each external_conversation_id is unique to prevent duplicate conversations from external systems like WhatsApp/Evolution API';
