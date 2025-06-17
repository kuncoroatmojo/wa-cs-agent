-- Wacanda Database Schema - Phase 1
-- RAG-powered AI Customer Service Agent

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- User management and authentication (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI Configuration per organization/user
CREATE TABLE ai_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'openai',
  api_key TEXT NOT NULL,
  model_name TEXT NOT NULL DEFAULT 'gpt-4o',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,
  system_prompt TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat sessions grouped by sender
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  sender_name TEXT,
  sender_type TEXT NOT NULL,
  session_metadata JSONB DEFAULT '{}',
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, sender_id, sender_type)
);

-- Individual messages within sessions
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  metadata JSONB DEFAULT '{}',
  tokens_used INTEGER,
  model_used TEXT,
  confidence_score DECIMAL(3,2),
  response_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Knowledge base documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  file_path TEXT,
  file_type TEXT,
  file_size INTEGER,
  folder_path TEXT DEFAULT '/',
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Web pages for context
CREATE TABLE web_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  content TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scraping', 'ready', 'error')),
  include_children BOOLEAN DEFAULT false,
  max_depth INTEGER DEFAULT 1,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vector embeddings for RAG
CREATE TABLE document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  source_id UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('document', 'webpage')),
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- WhatsApp integrations
CREATE TABLE whatsapp_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('baileys', 'cloud_api')),
  phone_number TEXT,
  instance_key TEXT UNIQUE,
  qr_code TEXT,
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  credentials JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  last_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- External API integrations
CREATE TABLE external_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  integration_type TEXT NOT NULL,
  api_key TEXT,
  webhook_url TEXT,
  settings JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Additional tables for Phase 4: Integration & API Layer

-- Webhook events for external integrations
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES external_integrations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API usage logging for external integrations
CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES external_integrations(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Handoff requests for human agent escalation
CREATE TABLE handoff_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'resolved', 'cancelled')),
  assigned_agent_id UUID REFERENCES profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_chat_sessions_user_active ON chat_sessions(user_id, is_active, last_message_at DESC);
CREATE INDEX idx_chat_messages_session_created ON chat_messages(session_id, created_at DESC);
CREATE INDEX idx_documents_user_status ON documents(user_id, status, created_at DESC);
CREATE INDEX idx_web_pages_user_status ON web_pages(user_id, status, created_at DESC);
CREATE INDEX idx_embeddings_user_source ON document_embeddings(user_id, source_type, source_id);

-- Enable vector similarity search
CREATE INDEX ON document_embeddings USING ivfflat (embedding vector_cosine_ops);

-- Create indexes for performance
CREATE INDEX idx_webhook_events_integration_id ON webhook_events(integration_id);
CREATE INDEX idx_webhook_events_event_type ON webhook_events(event_type);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX idx_webhook_events_created_at ON webhook_events(created_at);

CREATE INDEX idx_api_usage_logs_integration_id ON api_usage_logs(integration_id);
CREATE INDEX idx_api_usage_logs_endpoint ON api_usage_logs(endpoint);
CREATE INDEX idx_api_usage_logs_timestamp ON api_usage_logs(timestamp);

CREATE INDEX idx_handoff_requests_session_id ON handoff_requests(session_id);
CREATE INDEX idx_handoff_requests_status ON handoff_requests(status);
CREATE INDEX idx_handoff_requests_urgency ON handoff_requests(urgency);
CREATE INDEX idx_handoff_requests_created_at ON handoff_requests(created_at);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE handoff_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can only see their own profile" ON profiles
  FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users can only manage their own AI configurations" ON ai_configurations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own chat sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access messages in their sessions" ON chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_sessions 
      WHERE chat_sessions.id = chat_messages.session_id 
      AND chat_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can only access their own documents" ON documents
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own web pages" ON web_pages
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own embeddings" ON document_embeddings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own WhatsApp integrations" ON whatsapp_integrations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can only access their own external integrations" ON external_integrations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "webhook_events_select" ON webhook_events
FOR SELECT USING (
  integration_id IN (
    SELECT id FROM external_integrations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "webhook_events_insert" ON webhook_events
FOR INSERT WITH CHECK (
  integration_id IN (
    SELECT id FROM external_integrations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "api_usage_logs_select" ON api_usage_logs
FOR SELECT USING (
  integration_id IN (
    SELECT id FROM external_integrations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "api_usage_logs_insert" ON api_usage_logs
FOR INSERT WITH CHECK (
  integration_id IN (
    SELECT id FROM external_integrations WHERE user_id = auth.uid()
  )
);

CREATE POLICY "handoff_requests_select" ON handoff_requests
FOR SELECT USING (
  session_id IN (
    SELECT id FROM chat_sessions WHERE user_id = auth.uid()
  )
);

CREATE POLICY "handoff_requests_insert" ON handoff_requests
FOR INSERT WITH CHECK (
  session_id IN (
    SELECT id FROM chat_sessions WHERE user_id = auth.uid()
  )
);

CREATE POLICY "handoff_requests_update" ON handoff_requests
FOR UPDATE USING (
  session_id IN (
    SELECT id FROM chat_sessions WHERE user_id = auth.uid()
  )
);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ai_configurations_updated_at BEFORE UPDATE ON ai_configurations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_web_pages_updated_at BEFORE UPDATE ON web_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_whatsapp_integrations_updated_at BEFORE UPDATE ON whatsapp_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_external_integrations_updated_at BEFORE UPDATE ON external_integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webhook_events_updated_at BEFORE UPDATE ON webhook_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_usage_logs_updated_at BEFORE UPDATE ON api_usage_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_handoff_requests_updated_at BEFORE UPDATE ON handoff_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get integration statistics
CREATE OR REPLACE FUNCTION get_integration_stats(p_integration_id UUID)
RETURNS JSON AS $$
DECLARE
  stats JSON;
BEGIN
  SELECT json_build_object(
    'total_sessions', COUNT(DISTINCT cs.id),
    'active_sessions', COUNT(DISTINCT cs.id) FILTER (WHERE cs.is_active = true),
    'total_messages', COUNT(DISTINCT cm.id),
    'messages_today', COUNT(DISTINCT cm.id) FILTER (WHERE cm.created_at >= CURRENT_DATE),
    'avg_response_time', AVG(cm.response_time_ms) FILTER (WHERE cm.response_time_ms IS NOT NULL),
    'last_activity', MAX(cs.last_message_at)
  ) INTO stats
  FROM external_integrations ei
  LEFT JOIN chat_sessions cs ON cs.sender_type = ei.integration_type AND cs.user_id = ei.user_id
  LEFT JOIN chat_messages cm ON cm.session_id = cs.id
  WHERE ei.id = p_integration_id;
  
  RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old webhook events and logs
CREATE OR REPLACE FUNCTION cleanup_old_integration_data()
RETURNS void AS $$
BEGIN
  -- Delete webhook events older than 30 days
  DELETE FROM webhook_events 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Delete API usage logs older than 90 days
  DELETE FROM api_usage_logs 
  WHERE timestamp < NOW() - INTERVAL '90 days';
  
  -- Update processed webhook events older than 7 days
  UPDATE webhook_events 
  SET processed = true 
  WHERE created_at < NOW() - INTERVAL '7 days' 
  AND processed = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 