-- Migration: Unified Chat Management System for RAG and Multi-Integration Support
-- This enhances existing chat_sessions and chat_messages to support:
-- 1. Evolution API, Instagram, Web chatbot, etc.
-- 2. RAG-ready conversation context
-- 3. Unified conversation management
-- 4. Webhook synchronization

-- First, create the missing update_updated_at_column function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add missing columns to whatsapp_instances for Evolution API support (if table exists)
DO $$
BEGIN
    -- Check if whatsapp_instances table exists first
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_instances') THEN
        -- Add evolution_api to connection_type if not already there
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.check_constraints 
            WHERE constraint_name LIKE '%whatsapp_instances_connection_type%' 
            AND check_clause LIKE '%evolution_api%'
        ) THEN
            ALTER TABLE whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_connection_type_check;
            ALTER TABLE whatsapp_instances ADD CONSTRAINT whatsapp_instances_connection_type_check 
            CHECK (connection_type IN ('baileys', 'cloud_api', 'evolution_api'));
            
            RAISE NOTICE 'Added evolution_api to connection_type constraint';
        END IF;
    ELSE
        RAISE NOTICE 'whatsapp_instances table does not exist, skipping constraint update';
    END IF;
END
$$;

-- Drop existing conversations table if it has wrong schema
DROP TABLE IF EXISTS conversations CASCADE;

-- Conversations table - unified conversation management across all integrations
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Integration details
  integration_type TEXT NOT NULL CHECK (integration_type IN ('whatsapp', 'instagram', 'web', 'api', 'telegram', 'messenger')),
  integration_id UUID, -- References whatsapp_instances.id, instagram_instances.id, etc.
  instance_key TEXT, -- For quick lookup
  
  -- Contact information
  contact_id TEXT NOT NULL, -- Phone number, Instagram username, web session ID, etc.
  contact_name TEXT,
  contact_metadata JSONB DEFAULT '{}', -- Profile picture, bio, etc.
  
  -- Conversation state
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'archived', 'handed_off')),
  assigned_agent_id UUID REFERENCES profiles(id),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  tags TEXT[] DEFAULT '{}',
  
  -- Message statistics
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_message_preview TEXT,
  last_message_from TEXT, -- 'contact' or 'agent' or 'bot'
  
  -- RAG context
  conversation_summary TEXT, -- AI-generated summary for RAG context
  conversation_topics TEXT[] DEFAULT '{}', -- Extracted topics for better RAG retrieval
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  
  -- Synchronization
  external_conversation_id TEXT, -- Original conversation ID from external API
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'failed')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique conversations per integration
  UNIQUE(user_id, integration_type, contact_id, integration_id)
);

-- Messages table - unified message storage across all integrations
CREATE TABLE conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Message content
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker', 'reaction')),
  media_url TEXT, -- For media messages
  media_metadata JSONB DEFAULT '{}', -- File size, duration, etc.
  
  -- Message direction and sender
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('contact', 'agent', 'bot')),
  sender_name TEXT,
  sender_id TEXT, -- Agent ID, bot ID, or contact ID
  
  -- Message status
  status TEXT DEFAULT 'delivered' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  
  -- AI processing
  ai_processed BOOLEAN DEFAULT false,
  ai_response_time_ms INTEGER,
  ai_model_used TEXT,
  ai_confidence_score DECIMAL(3,2),
  ai_tokens_used INTEGER,
  
  -- External API details
  external_message_id TEXT UNIQUE, -- Original message ID from external API
  external_timestamp TIMESTAMP WITH TIME ZONE,
  external_metadata JSONB DEFAULT '{}', -- Raw message data from external API
  
  -- RAG context for this specific message
  rag_context_used TEXT, -- RAG context that was used to generate response
  rag_sources TEXT[], -- Document/webpage IDs used for RAG
  rag_similarity_scores DECIMAL(3,2)[], -- Similarity scores for RAG sources
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation participants (for group chats, multiple agents, etc.)
CREATE TABLE conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  participant_type TEXT NOT NULL CHECK (participant_type IN ('contact', 'agent', 'bot')),
  participant_id TEXT NOT NULL, -- User ID, agent ID, or contact ID
  participant_name TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('member', 'admin', 'moderator')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  UNIQUE(conversation_id, participant_type, participant_id)
);

-- Webhook events for synchronization
CREATE TABLE conversation_sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  integration_id UUID,
  
  event_type TEXT NOT NULL, -- 'message_received', 'message_sent', 'status_update', etc.
  event_data JSONB NOT NULL,
  
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversation analytics for better insights
CREATE TABLE conversation_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  
  -- Response times
  avg_response_time_ms INTEGER,
  first_response_time_ms INTEGER,
  resolution_time_ms INTEGER,
  
  -- Message statistics
  total_messages INTEGER DEFAULT 0,
  contact_messages INTEGER DEFAULT 0,
  agent_messages INTEGER DEFAULT 0,
  bot_messages INTEGER DEFAULT 0,
  
  -- AI performance
  avg_ai_confidence DECIMAL(3,2),
  total_ai_tokens INTEGER DEFAULT 0,
  handoff_triggered BOOLEAN DEFAULT false,
  handoff_reason TEXT,
  
  -- Customer satisfaction
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  satisfaction_feedback TEXT,
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all new tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON conversations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations" ON conversations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for conversation_messages
CREATE POLICY "Users can view messages in own conversations" ON conversation_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = conversation_messages.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in own conversations" ON conversation_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = conversation_messages.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages in own conversations" ON conversation_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = conversation_messages.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );

-- Similar policies for other tables
CREATE POLICY "Users can manage own conversation participants" ON conversation_participants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = conversation_participants.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own sync events" ON conversation_sync_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create sync events" ON conversation_sync_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own conversation analytics" ON conversation_analytics
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conversations 
      WHERE conversations.id = conversation_analytics.conversation_id 
      AND conversations.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX idx_conversations_user_integration ON conversations(user_id, integration_type, status);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversations_contact ON conversations(contact_id, integration_type);
CREATE INDEX idx_conversations_external_id ON conversations(external_conversation_id);

CREATE INDEX idx_conversation_messages_conversation ON conversation_messages(conversation_id, created_at DESC);
CREATE INDEX idx_conversation_messages_external_id ON conversation_messages(external_message_id);
CREATE INDEX idx_conversation_messages_direction ON conversation_messages(direction, sender_type);

CREATE INDEX idx_conversation_participants_conversation ON conversation_participants(conversation_id, is_active);
CREATE INDEX idx_conversation_sync_events_processed ON conversation_sync_events(processed, created_at);
CREATE INDEX idx_conversation_sync_events_integration ON conversation_sync_events(integration_type, integration_id);

-- Triggers for updated_at
CREATE TRIGGER update_conversations_updated_at 
  BEFORE UPDATE ON conversations 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_messages_updated_at 
  BEFORE UPDATE ON conversation_messages 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversation_analytics_updated_at 
  BEFORE UPDATE ON conversation_analytics 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update conversation statistics when messages are added
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Update message count and last message info
  UPDATE conversations SET
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    last_message_preview = CASE 
      WHEN NEW.message_type = 'text' THEN LEFT(NEW.content, 100)
      ELSE '[' || UPPER(NEW.message_type) || ']'
    END,
    last_message_from = NEW.sender_type,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  -- Update or create analytics record
  INSERT INTO conversation_analytics (conversation_id, total_messages)
  VALUES (NEW.conversation_id, 1)
  ON CONFLICT (conversation_id) DO UPDATE SET
    total_messages = conversation_analytics.total_messages + 1,
    contact_messages = conversation_analytics.contact_messages + CASE WHEN NEW.sender_type = 'contact' THEN 1 ELSE 0 END,
    agent_messages = conversation_analytics.agent_messages + CASE WHEN NEW.sender_type = 'agent' THEN 1 ELSE 0 END,
    bot_messages = conversation_analytics.bot_messages + CASE WHEN NEW.sender_type = 'bot' THEN 1 ELSE 0 END,
    updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_stats
  AFTER INSERT ON conversation_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_stats();

-- Function to sync WhatsApp conversations from Evolution API
CREATE OR REPLACE FUNCTION sync_whatsapp_conversations(
  p_user_id UUID,
  p_instance_id UUID,
  p_conversations JSONB
) RETURNS INTEGER AS $$
DECLARE
  conversation_data JSONB;
  conversation_record conversations%ROWTYPE;
  synced_count INTEGER := 0;
BEGIN
  -- Loop through each conversation in the input
  FOR conversation_data IN SELECT * FROM jsonb_array_elements(p_conversations)
  LOOP
    -- Insert or update conversation
    INSERT INTO conversations (
      user_id,
      integration_type,
      integration_id,
      instance_key,
      contact_id,
      contact_name,
      external_conversation_id,
      last_synced_at
    ) VALUES (
      p_user_id,
      'whatsapp',
      p_instance_id,
      conversation_data->>'instanceKey',
      conversation_data->>'contactPhone',
      conversation_data->>'contactName',
      conversation_data->>'remoteJid',
      NOW()
    )
    ON CONFLICT (user_id, integration_type, contact_id, integration_id)
    DO UPDATE SET
      contact_name = EXCLUDED.contact_name,
      last_synced_at = NOW(),
      sync_status = 'synced';
    
    synced_count := synced_count + 1;
  END LOOP;
  
  RETURN synced_count;
END;
$$ LANGUAGE plpgsql;

-- Function to sync messages for a conversation
CREATE OR REPLACE FUNCTION sync_conversation_messages(
  p_conversation_id UUID,
  p_messages JSONB
) RETURNS INTEGER AS $$
DECLARE
  message_data JSONB;
  synced_count INTEGER := 0;
BEGIN
  -- Loop through each message in the input
  FOR message_data IN SELECT * FROM jsonb_array_elements(p_messages)
  LOOP
    -- Insert message if it doesn't exist
    INSERT INTO conversation_messages (
      conversation_id,
      content,
      message_type,
      direction,
      sender_type,
      sender_name,
      status,
      external_message_id,
      external_timestamp,
      external_metadata
    ) VALUES (
      p_conversation_id,
      message_data->>'content',
      COALESCE(message_data->>'messageType', 'text'),
      CASE WHEN (message_data->>'isFromMe')::boolean THEN 'outbound' ELSE 'inbound' END,
      CASE WHEN (message_data->>'isFromMe')::boolean THEN 'bot' ELSE 'contact' END,
      message_data->>'senderName',
      'delivered',
      message_data->>'messageId',
      (message_data->>'timestamp')::timestamp with time zone,
      message_data
    )
    ON CONFLICT (external_message_id) DO NOTHING;
    
    synced_count := synced_count + 1;
  END LOOP;
  
  RETURN synced_count;
END;
$$ LANGUAGE plpgsql;

-- Try to add tables to realtime publication (will fail gracefully if publication doesn't exist)
DO $$
BEGIN
    -- Add to realtime publication if it exists
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
        ALTER PUBLICATION supabase_realtime ADD TABLE conversation_messages;
        ALTER PUBLICATION supabase_realtime ADD TABLE conversation_sync_events;
        RAISE NOTICE 'Added tables to supabase_realtime publication';
    ELSE
        RAISE NOTICE 'supabase_realtime publication does not exist, skipping realtime setup';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not add tables to realtime publication: %', SQLERRM;
END
$$; 