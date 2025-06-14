-- WhatsApp AI Customer Support Assistant
-- Initial Database Schema Migration
-- 
-- This file contains the complete database schema for the application
-- Run this in your Supabase SQL editor after creating a new project

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS & PROFILES
-- =====================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  organization TEXT,
  role TEXT CHECK (role IN ('admin', 'agent', 'viewer')) DEFAULT 'agent',
  timezone TEXT DEFAULT 'UTC',
  language TEXT DEFAULT 'en',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- WHATSAPP INSTANCES
-- =====================================================

-- WhatsApp instances table
CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  instance_key TEXT UNIQUE NOT NULL,
  api_type TEXT CHECK (api_type IN ('baileys', 'cloud')) DEFAULT 'baileys',
  status TEXT CHECK (status IN ('connecting', 'connected', 'disconnected', 'error')) DEFAULT 'disconnected',
  phone_number TEXT,
  qr_code TEXT,
  webhook_url TEXT,
  business_hours JSONB DEFAULT '{"enabled": false, "timezone": "UTC", "schedule": {}}',
  auto_reply JSONB DEFAULT '{"enabled": false, "message": "Thank you for your message. We will get back to you soon!"}',
  settings JSONB DEFAULT '{}',
  last_seen TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CONVERSATIONS & MESSAGES
-- =====================================================

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL,
  contact_name TEXT,
  contact_number TEXT,
  contact_avatar TEXT,
  status TEXT CHECK (status IN ('active', 'resolved', 'escalated', 'spam')) DEFAULT 'active',
  assigned_to UUID REFERENCES profiles(id),
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')) DEFAULT 'medium',
  tags TEXT[] DEFAULT '{}',
  last_message_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  escalated_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique conversations per instance-contact pair
  UNIQUE(instance_id, contact_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id TEXT UNIQUE NOT NULL,
  sender_type TEXT CHECK (sender_type IN ('contact', 'agent', 'bot')) NOT NULL,
  sender_id TEXT, -- WhatsApp ID or agent ID
  content TEXT NOT NULL,
  message_type TEXT CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'contact')) DEFAULT 'text',
  media_url TEXT,
  media_caption TEXT,
  quoted_message_id UUID REFERENCES messages(id),
  is_forwarded BOOLEAN DEFAULT FALSE,
  read_by_contact BOOLEAN DEFAULT FALSE,
  read_by_agent BOOLEAN DEFAULT FALSE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- =====================================================
-- DOCUMENTS & RAG SYSTEM
-- =====================================================

-- Document sources for RAG
CREATE TABLE IF NOT EXISTS document_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('upload', 'google_drive', 'url', 'api')) NOT NULL,
  config JSONB DEFAULT '{}', -- Source-specific configuration
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_status TEXT CHECK (sync_status IN ('pending', 'syncing', 'completed', 'error')) DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table for RAG
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_id UUID REFERENCES document_sources(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  file_path TEXT,
  source_url TEXT,
  page_number INTEGER,
  chunk_index INTEGER,
  embedding vector(1536), -- OpenAI embeddings dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- AI CONFIGURATION
-- =====================================================

-- AI models and configurations
CREATE TABLE IF NOT EXISTS ai_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT CHECK (provider IN ('openai', 'anthropic', 'google', 'local')) NOT NULL,
  model TEXT NOT NULL,
  temperature FLOAT DEFAULT 0.7 CHECK (temperature >= 0 AND temperature <= 2),
  max_tokens INTEGER DEFAULT 1000,
  system_prompt TEXT,
  is_default BOOLEAN DEFAULT FALSE,
  enabled BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ANALYTICS & METRICS
-- =====================================================

-- Conversation metrics
CREATE TABLE IF NOT EXISTS conversation_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  first_response_time INTEGER, -- Seconds
  resolution_time INTEGER, -- Seconds
  message_count INTEGER DEFAULT 0,
  agent_message_count INTEGER DEFAULT 0,
  bot_message_count INTEGER DEFAULT 0,
  escalation_count INTEGER DEFAULT 0,
  satisfaction_rating INTEGER CHECK (satisfaction_rating >= 1 AND satisfaction_rating <= 5),
  satisfaction_feedback TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Daily usage metrics
CREATE TABLE IF NOT EXISTS daily_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  total_conversations INTEGER DEFAULT 0,
  new_conversations INTEGER DEFAULT 0,
  resolved_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  bot_messages INTEGER DEFAULT 0,
  agent_messages INTEGER DEFAULT 0,
  avg_response_time FLOAT, -- Minutes
  avg_resolution_time FLOAT, -- Minutes
  avg_satisfaction FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one record per user/instance/date
  UNIQUE(user_id, instance_id, date)
);

-- =====================================================
-- AUTOMATION RULES
-- =====================================================

-- Bot automation rules
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT CHECK (trigger_type IN ('keyword', 'intent', 'time', 'sentiment')) NOT NULL,
  trigger_config JSONB NOT NULL,
  action_type TEXT CHECK (action_type IN ('reply', 'escalate', 'tag', 'assign', 'forward')) NOT NULL,
  action_config JSONB NOT NULL,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_documents_embedding 
ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Conversation indexes
CREATE INDEX IF NOT EXISTS idx_conversations_instance ON conversations(instance_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned ON conversations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at);

-- Message indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_sender_type ON messages(sender_type);

-- Document indexes
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_source ON documents(source_id);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_conversation_metrics_instance ON conversation_metrics(instance_id);
CREATE INDEX IF NOT EXISTS idx_conversation_metrics_date ON conversation_metrics(date);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date ON daily_metrics(date);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_user_date ON daily_metrics(user_id, date);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_whatsapp_instances_updated_at BEFORE UPDATE ON whatsapp_instances 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_sources_updated_at BEFORE UPDATE ON document_sources 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_configs_updated_at BEFORE UPDATE ON ai_configs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at BEFORE UPDATE ON automation_rules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

-- Display success message
DO $$
BEGIN
    RAISE NOTICE 'Database schema created successfully!';
    RAISE NOTICE 'Next step: Run the RLS policies script (02_rls_policies.sql)';
END $$; 