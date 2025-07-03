-- Migration: Fix conversation unique constraint to allow proper multi-user/multi-instance support
-- This fixes the issue where multiple users can't have conversations with the same external_conversation_id

-- Drop the overly restrictive unique constraint on external_conversation_id
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_external_conversation_id_unique;

-- Drop the index as well
DROP INDEX IF EXISTS conversations_external_conversation_id_unique;

-- Add a proper compound unique constraint that allows multiple users to have 
-- conversations with the same external_conversation_id, but prevents duplicates 
-- within the same user's scope
ALTER TABLE conversations 
ADD CONSTRAINT conversations_user_external_instance_unique 
UNIQUE (user_id, external_conversation_id, instance_key);

-- Add an index for performance on external_conversation_id lookups
CREATE INDEX idx_conversations_external_conversation_id 
ON conversations (external_conversation_id);

-- Add an index for user + instance queries
CREATE INDEX idx_conversations_user_instance 
ON conversations (user_id, instance_key);

-- Add a comment to document this constraint
COMMENT ON CONSTRAINT conversations_user_external_instance_unique ON conversations IS 
'Ensures each user can have only one conversation per external_conversation_id per instance, allowing multi-user support while preventing duplicates'; 