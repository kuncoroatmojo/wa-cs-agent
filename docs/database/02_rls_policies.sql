-- WhatsApp AI Customer Support Assistant
-- Row Level Security (RLS) Policies
-- 
-- This file contains all RLS policies for secure multi-tenant data access
-- Run this after the initial schema migration (01_initial_schema.sql)

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES POLICIES
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (for registration)
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- =====================================================
-- WHATSAPP INSTANCES POLICIES
-- =====================================================

-- Users can view their own instances
CREATE POLICY "Users can view own instances" ON whatsapp_instances
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create new instances
CREATE POLICY "Users can create instances" ON whatsapp_instances
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own instances
CREATE POLICY "Users can update own instances" ON whatsapp_instances
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own instances
CREATE POLICY "Users can delete own instances" ON whatsapp_instances
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- CONVERSATIONS POLICIES
-- =====================================================

-- Users can view conversations from their instances
CREATE POLICY "Users can view own conversations" ON conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM whatsapp_instances 
      WHERE whatsapp_instances.id = conversations.instance_id 
      AND whatsapp_instances.user_id = auth.uid()
    )
  );

-- Users can create conversations for their instances
CREATE POLICY "Users can create conversations" ON conversations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_instances 
      WHERE whatsapp_instances.id = conversations.instance_id 
      AND whatsapp_instances.user_id = auth.uid()
    )
  );

-- Users can update conversations from their instances
CREATE POLICY "Users can update own conversations" ON conversations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM whatsapp_instances 
      WHERE whatsapp_instances.id = conversations.instance_id 
      AND whatsapp_instances.user_id = auth.uid()
    )
  );

-- Users can delete conversations from their instances
CREATE POLICY "Users can delete own conversations" ON conversations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM whatsapp_instances 
      WHERE whatsapp_instances.id = conversations.instance_id 
      AND whatsapp_instances.user_id = auth.uid()
    )
  );

-- =====================================================
-- MESSAGES POLICIES
-- =====================================================

-- Users can view messages from their conversations
CREATE POLICY "Users can view messages from own conversations" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations 
      JOIN whatsapp_instances ON conversations.instance_id = whatsapp_instances.id
      WHERE conversations.id = messages.conversation_id 
      AND whatsapp_instances.user_id = auth.uid()
    )
  );

-- Users can create messages in their conversations
CREATE POLICY "Users can create messages in own conversations" ON messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations 
      JOIN whatsapp_instances ON conversations.instance_id = whatsapp_instances.id
      WHERE conversations.id = messages.conversation_id 
      AND whatsapp_instances.user_id = auth.uid()
    )
  );

-- Users can update messages in their conversations
CREATE POLICY "Users can update messages in own conversations" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations 
      JOIN whatsapp_instances ON conversations.instance_id = whatsapp_instances.id
      WHERE conversations.id = messages.conversation_id 
      AND whatsapp_instances.user_id = auth.uid()
    )
  );

-- Users can delete messages from their conversations
CREATE POLICY "Users can delete messages from own conversations" ON messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM conversations 
      JOIN whatsapp_instances ON conversations.instance_id = whatsapp_instances.id
      WHERE conversations.id = messages.conversation_id 
      AND whatsapp_instances.user_id = auth.uid()
    )
  );

-- =====================================================
-- DOCUMENT SOURCES POLICIES
-- =====================================================

-- Users can manage their own document sources
CREATE POLICY "Users can view own document sources" ON document_sources
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create document sources" ON document_sources
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document sources" ON document_sources
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own document sources" ON document_sources
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- DOCUMENTS POLICIES
-- =====================================================

-- Users can view their own documents
CREATE POLICY "Users can view own documents" ON documents
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create documents
CREATE POLICY "Users can create documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own documents
CREATE POLICY "Users can update own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents" ON documents
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- AI CONFIGS POLICIES
-- =====================================================

-- Users can manage their own AI configurations
CREATE POLICY "Users can view own ai configs" ON ai_configs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create ai configs" ON ai_configs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own ai configs" ON ai_configs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own ai configs" ON ai_configs
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- CONVERSATION METRICS POLICIES
-- =====================================================

-- Users can view metrics for their instances
CREATE POLICY "Users can view own conversation metrics" ON conversation_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM whatsapp_instances 
      WHERE whatsapp_instances.id = conversation_metrics.instance_id 
      AND whatsapp_instances.user_id = auth.uid()
    )
  );

-- System can create metrics (no user restriction for automated metrics)
CREATE POLICY "System can create conversation metrics" ON conversation_metrics
  FOR INSERT WITH CHECK (TRUE);

-- Users can update metrics for their instances
CREATE POLICY "Users can update own conversation metrics" ON conversation_metrics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM whatsapp_instances 
      WHERE whatsapp_instances.id = conversation_metrics.instance_id 
      AND whatsapp_instances.user_id = auth.uid()
    )
  );

-- =====================================================
-- DAILY METRICS POLICIES
-- =====================================================

-- Users can view their own daily metrics
CREATE POLICY "Users can view own daily metrics" ON daily_metrics
  FOR SELECT USING (auth.uid() = user_id);

-- System can create daily metrics
CREATE POLICY "System can create daily metrics" ON daily_metrics
  FOR INSERT WITH CHECK (TRUE);

-- Users can update their own daily metrics
CREATE POLICY "Users can update own daily metrics" ON daily_metrics
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- AUTOMATION RULES POLICIES
-- =====================================================

-- Users can view automation rules for their instances
CREATE POLICY "Users can view own automation rules" ON automation_rules
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create automation rules for their instances
CREATE POLICY "Users can create automation rules" ON automation_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own automation rules
CREATE POLICY "Users can update own automation rules" ON automation_rules
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own automation rules
CREATE POLICY "Users can delete own automation rules" ON automation_rules
  FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- HELPER FUNCTIONS FOR ADVANCED POLICIES
-- =====================================================

-- Function to check if user has access to instance
CREATE OR REPLACE FUNCTION user_has_instance_access(instance_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM whatsapp_instances 
    WHERE id = instance_uuid 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION user_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- REALTIME SUBSCRIPTIONS
-- =====================================================

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_instances;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE documents;

-- =====================================================
-- STORAGE POLICIES (for file uploads)
-- =====================================================

-- Create storage bucket for uploads
INSERT INTO storage.buckets (id, name, public) 
VALUES ('uploads', 'uploads', false) 
ON CONFLICT (id) DO NOTHING;

-- Users can upload files to their own folder
CREATE POLICY "Users can upload own files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'uploads' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can view their own files
CREATE POLICY "Users can view own files" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'uploads' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own files
CREATE POLICY "Users can update own files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'uploads' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own files
CREATE POLICY "Users can delete own files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'uploads' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Row Level Security policies applied successfully!';
    RAISE NOTICE 'Database is now ready for use.';
    RAISE NOTICE 'Remember to set up your environment variables and test the connection.';
END $$; 