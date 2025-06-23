-- Fix the conversation_analytics constraint issue
-- The trigger function uses ON CONFLICT (conversation_id) but the table doesn't have this constraint

-- Add unique constraint on conversation_id in conversation_analytics
ALTER TABLE conversation_analytics 
ADD CONSTRAINT conversation_analytics_conversation_id_unique 
UNIQUE (conversation_id);

-- Also fix the conversations table to have last_message_from column that the trigger uses
DO $$
BEGIN
    -- Check if column exists before adding it
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'conversations' 
        AND column_name = 'last_message_from'
    ) THEN
        ALTER TABLE conversations ADD COLUMN last_message_from TEXT;
    END IF;
END $$; 