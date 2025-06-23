-- Drop the unique constraint on external_message_id since it's optional
ALTER TABLE conversation_messages DROP CONSTRAINT IF EXISTS conversation_messages_external_message_id_key;

-- Drop the unique constraint on conversations
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user_id_integration_type_contact_id_integration_id_key;

-- Add new unique constraint on conversations
ALTER TABLE conversations ADD CONSTRAINT conversations_user_id_integration_type_contact_id_key UNIQUE (user_id, integration_type, contact_id); 