-- Migration: Add unique constraint on external_conversation_id
-- This ensures no duplicate conversations can be inserted with the same external_conversation_id (remoteJid)

-- Create unique index on external_conversation_id (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS conversations_external_conversation_id_unique
ON conversations(external_conversation_id)
WHERE external_conversation_id IS NOT NULL;

-- Add a comment to document this constraint
COMMENT ON INDEX conversations_external_conversation_id_unique IS 
'Ensures each external_conversation_id (remoteJid) is unique to prevent duplicate conversations from external systems like WhatsApp/Evolution API'; 