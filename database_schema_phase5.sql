-- Phase 5: Advanced Features & Performance Optimization
-- Additional database functions and optimizations

-- ============================================================================
-- VECTOR SEARCH FUNCTIONS
-- ============================================================================

-- Function to match documents using vector similarity
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id uuid
)
RETURNS TABLE (
  id uuid,
  source_id uuid,
  source_type text,
  chunk_text text,
  chunk_index int,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_embeddings.id,
    document_embeddings.source_id,
    document_embeddings.source_type,
    document_embeddings.chunk_text,
    document_embeddings.chunk_index,
    1 - (document_embeddings.embedding <=> query_embedding) as similarity,
    document_embeddings.metadata
  FROM document_embeddings
  WHERE 
    document_embeddings.user_id = match_documents.user_id
    AND 1 - (document_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY document_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get document context with metadata
CREATE OR REPLACE FUNCTION get_document_context (
  doc_ids uuid[],
  user_id uuid
)
RETURNS TABLE (
  id uuid,
  title text,
  source_type text,
  metadata jsonb,
  chunk_count int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    CASE 
      WHEN de.source_type = 'document' THEN d.id
      WHEN de.source_type = 'webpage' THEN w.id
    END as id,
    CASE 
      WHEN de.source_type = 'document' THEN d.title
      WHEN de.source_type = 'webpage' THEN w.title
    END as title,
    de.source_type,
    CASE 
      WHEN de.source_type = 'document' THEN d.metadata
      WHEN de.source_type = 'webpage' THEN w.metadata
    END as metadata,
    COUNT(de.id)::int as chunk_count
  FROM document_embeddings de
  LEFT JOIN documents d ON de.source_id = d.id AND de.source_type = 'document'
  LEFT JOIN web_pages w ON de.source_id = w.id AND de.source_type = 'webpage'
  WHERE 
    de.source_id = ANY(doc_ids)
    AND de.user_id = get_document_context.user_id
  GROUP BY de.source_type, d.id, d.title, d.metadata, w.id, w.title, w.metadata;
END;
$$;

-- ============================================================================
-- HANDOFF MANAGEMENT TABLES AND FUNCTIONS
-- ============================================================================

-- Handoff requests table
CREATE TABLE IF NOT EXISTS handoff_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES chat_sessions(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'resolved', 'cancelled')),
  assigned_agent_id UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  assigned_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  resolution_notes TEXT
);

-- Indexes for handoff requests
CREATE INDEX IF NOT EXISTS idx_handoff_requests_status ON handoff_requests(status);
CREATE INDEX IF NOT EXISTS idx_handoff_requests_urgency ON handoff_requests(urgency);
CREATE INDEX IF NOT EXISTS idx_handoff_requests_created_at ON handoff_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_handoff_requests_session_id ON handoff_requests(session_id);

-- Agent availability table
CREATE TABLE IF NOT EXISTS agent_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_available BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'busy', 'away', 'offline')),
  max_concurrent_chats INTEGER DEFAULT 5,
  current_chat_count INTEGER DEFAULT 0,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  working_hours JSONB DEFAULT '{}', -- Schedule configuration
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Function to get available agents
CREATE OR REPLACE FUNCTION get_available_agents (
  urgency_level text DEFAULT 'medium'
)
RETURNS TABLE (
  agent_id uuid,
  agent_name text,
  current_load int,
  max_capacity int,
  availability_score float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    aa.agent_id,
    p.full_name as agent_name,
    aa.current_chat_count as current_load,
    aa.max_concurrent_chats as max_capacity,
    CASE 
      WHEN aa.current_chat_count >= aa.max_concurrent_chats THEN 0.0
      ELSE (aa.max_concurrent_chats - aa.current_chat_count)::float / aa.max_concurrent_chats::float
    END as availability_score
  FROM agent_availability aa
  JOIN profiles p ON aa.agent_id = p.id
  WHERE 
    aa.is_available = true 
    AND aa.status IN ('online', 'away')
    AND aa.current_chat_count < aa.max_concurrent_chats
  ORDER BY 
    CASE urgency_level
      WHEN 'high' THEN aa.current_chat_count -- Least busy for high priority
      ELSE aa.max_concurrent_chats - aa.current_chat_count -- Most available for others
    END DESC,
    aa.last_activity DESC
  LIMIT 10;
END;
$$;

-- ============================================================================
-- CONVERSATION ANALYTICS AND INSIGHTS
-- ============================================================================

-- Function to analyze conversation patterns
CREATE OR REPLACE FUNCTION analyze_conversation_metrics (
  session_id uuid
)
RETURNS TABLE (
  message_count int,
  avg_response_time_ms float,
  sentiment_score float,
  complexity_score float,
  handoff_probability float
)
LANGUAGE plpgsql
AS $$
DECLARE
  msg_count int;
  avg_response float;
  sentiment float;
  complexity float;
  handoff_prob float;
BEGIN
  -- Count messages
  SELECT COUNT(*) INTO msg_count
  FROM chat_messages
  WHERE chat_messages.session_id = analyze_conversation_metrics.session_id;
  
  -- Calculate average response time
  SELECT AVG(response_time_ms) INTO avg_response
  FROM chat_messages
  WHERE chat_messages.session_id = analyze_conversation_metrics.session_id
    AND response_time_ms IS NOT NULL;
  
  -- Simple sentiment analysis (placeholder - would use actual sentiment analysis)
  sentiment := 0.5; -- Neutral baseline
  
  -- Complexity score based on message length and technical terms
  SELECT AVG(LENGTH(content) / 100.0) INTO complexity
  FROM chat_messages
  WHERE chat_messages.session_id = analyze_conversation_metrics.session_id
    AND role = 'user';
  
  -- Handoff probability based on various factors
  handoff_prob := LEAST(
    (msg_count / 20.0) + -- More messages = higher probability
    (COALESCE(complexity, 0) / 5.0) + -- Higher complexity = higher probability
    (1.0 - COALESCE(sentiment, 0.5)), -- Lower sentiment = higher probability
    1.0
  );
  
  RETURN QUERY SELECT msg_count, avg_response, sentiment, complexity, handoff_prob;
END;
$$;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION FUNCTIONS
-- ============================================================================

-- Function to cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_data (
  days_to_keep int DEFAULT 90
)
RETURNS TABLE (
  table_name text,
  rows_deleted int
)
LANGUAGE plpgsql
AS $$
DECLARE
  cutoff_date timestamp;
  deleted_count int;
BEGIN
  cutoff_date := NOW() - (days_to_keep || ' days')::interval;
  
  -- Cleanup old chat messages from inactive sessions
  DELETE FROM chat_messages 
  WHERE created_at < cutoff_date
    AND session_id IN (
      SELECT id FROM chat_sessions 
      WHERE is_active = false 
        AND last_message_at < cutoff_date
    );
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN QUERY SELECT 'chat_messages'::text, deleted_count;
  
  -- Cleanup old RAG contexts
  DELETE FROM rag_contexts 
  WHERE created_at < cutoff_date;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN QUERY SELECT 'rag_contexts'::text, deleted_count;
  
  -- Cleanup resolved handoff requests
  DELETE FROM handoff_requests 
  WHERE status = 'resolved' 
    AND resolved_at < cutoff_date;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN QUERY SELECT 'handoff_requests'::text, deleted_count;
  
  -- Cleanup old document embeddings for deleted documents
  DELETE FROM document_embeddings 
  WHERE source_type = 'document' 
    AND source_id NOT IN (SELECT id FROM documents);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN QUERY SELECT 'orphaned_document_embeddings'::text, deleted_count;
  
  DELETE FROM document_embeddings 
  WHERE source_type = 'webpage' 
    AND source_id NOT IN (SELECT id FROM web_pages);
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN QUERY SELECT 'orphaned_webpage_embeddings'::text, deleted_count;
END;
$$;

-- Function to get usage statistics
CREATE OR REPLACE FUNCTION get_usage_statistics (
  user_id uuid,
  start_date timestamp DEFAULT NOW() - interval '30 days',
  end_date timestamp DEFAULT NOW()
)
RETURNS TABLE (
  total_sessions int,
  total_messages int,
  avg_response_time float,
  total_tokens_used bigint,
  handoff_rate float,
  avg_confidence float,
  active_sessions int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(DISTINCT cs.id)::int as total_sessions,
    COUNT(cm.id)::int as total_messages,
    AVG(cm.response_time_ms) as avg_response_time,
    COALESCE(SUM(cm.tokens_used), 0) as total_tokens_used,
    COALESCE(
      COUNT(DISTINCT hr.session_id)::float / NULLIF(COUNT(DISTINCT cs.id), 0)::float * 100,
      0
    ) as handoff_rate,
    AVG(cm.confidence_score) as avg_confidence,
    COUNT(DISTINCT CASE WHEN cs.is_active THEN cs.id END)::int as active_sessions
  FROM chat_sessions cs
  LEFT JOIN chat_messages cm ON cs.id = cm.session_id
  LEFT JOIN handoff_requests hr ON cs.id = hr.session_id
  WHERE 
    cs.user_id = get_usage_statistics.user_id
    AND cs.created_at BETWEEN start_date AND end_date;
END;
$$;

-- ============================================================================
-- ADVANCED INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_role_created 
ON chat_messages(session_id, role, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_active_updated 
ON chat_sessions(user_id, is_active, updated_at);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_user_source 
ON document_embeddings(user_id, source_type, source_id);

-- Partial indexes for active data
CREATE INDEX IF NOT EXISTS idx_active_chat_sessions 
ON chat_sessions(user_id, last_message_at) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_pending_handoffs 
ON handoff_requests(urgency, created_at) 
WHERE status = 'pending';

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE handoff_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_availability ENABLE ROW LEVEL SECURITY;

-- Policies for handoff_requests
CREATE POLICY "Users can view their own handoff requests" ON handoff_requests
  FOR SELECT USING (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create handoff requests for their sessions" ON handoff_requests
  FOR INSERT WITH CHECK (
    session_id IN (
      SELECT id FROM chat_sessions WHERE user_id = auth.uid()
    )
  );

-- Policies for agent_availability (agents can manage their own availability)
CREATE POLICY "Agents can manage their own availability" ON agent_availability
  FOR ALL USING (agent_id = auth.uid());

CREATE POLICY "Users can view agent availability" ON agent_availability
  FOR SELECT USING (is_available = true);

-- ============================================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================================================

-- Daily usage statistics materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_usage_stats AS
SELECT
  DATE(cs.created_at) as usage_date,
  cs.user_id,
  COUNT(DISTINCT cs.id) as sessions_created,
  COUNT(cm.id) as messages_sent,
  COALESCE(SUM(cm.tokens_used), 0) as total_tokens,
  AVG(cm.response_time_ms) as avg_response_time,
  COUNT(DISTINCT hr.id) as handoffs_created
FROM chat_sessions cs
LEFT JOIN chat_messages cm ON cs.id = cm.session_id
LEFT JOIN handoff_requests hr ON cs.id = hr.session_id
WHERE cs.created_at >= NOW() - interval '365 days'
GROUP BY DATE(cs.created_at), cs.user_id;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_daily_usage_stats_date_user 
ON daily_usage_stats(usage_date, user_id);

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_usage_stats;
END;
$$;

-- ============================================================================
-- AUTOMATED MAINTENANCE
-- ============================================================================

-- Function to run automated maintenance tasks
CREATE OR REPLACE FUNCTION run_maintenance_tasks()
RETURNS TABLE (
  task_name text,
  result text,
  duration_ms int
)
LANGUAGE plpgsql
AS $$
DECLARE
  start_time timestamp;
  end_time timestamp;
  task_result text;
BEGIN
  -- Cleanup old data
  start_time := clock_timestamp();
  PERFORM cleanup_old_data(90);
  end_time := clock_timestamp();
  RETURN QUERY SELECT 
    'cleanup_old_data'::text, 
    'completed'::text, 
    extract(milliseconds from end_time - start_time)::int;
  
  -- Refresh analytics views
  start_time := clock_timestamp();
  PERFORM refresh_analytics_views();
  end_time := clock_timestamp();
  RETURN QUERY SELECT 
    'refresh_analytics'::text, 
    'completed'::text, 
    extract(milliseconds from end_time - start_time)::int;
  
  -- Update statistics
  start_time := clock_timestamp();
  ANALYZE;
  end_time := clock_timestamp();
  RETURN QUERY SELECT 
    'analyze_tables'::text, 
    'completed'::text, 
    extract(milliseconds from end_time - start_time)::int;
END;
$$;

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Function to update session last_message_at when new message is added
CREATE OR REPLACE FUNCTION update_session_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE chat_sessions 
  SET 
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.session_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to automatically update session timestamps
DROP TRIGGER IF EXISTS trigger_update_session_last_message ON chat_messages;
CREATE TRIGGER trigger_update_session_last_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_session_last_message();

-- Function to update agent chat count
CREATE OR REPLACE FUNCTION update_agent_chat_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE agent_availability 
    SET 
      current_chat_count = current_chat_count + 1,
      last_activity = NOW()
    WHERE agent_id = NEW.assigned_agent_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status AND NEW.status = 'resolved' THEN
    UPDATE agent_availability 
    SET 
      current_chat_count = GREATEST(current_chat_count - 1, 0),
      last_activity = NOW()
    WHERE agent_id = OLD.assigned_agent_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger to automatically update agent workload
DROP TRIGGER IF EXISTS trigger_update_agent_chat_count ON handoff_requests;
CREATE TRIGGER trigger_update_agent_chat_count
  AFTER INSERT OR UPDATE ON handoff_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_chat_count();

-- ============================================================================
-- INITIAL DATA AND CONFIGURATION
-- ============================================================================

-- Insert default AI configuration if none exists
INSERT INTO ai_configurations (user_id, name, provider, api_key, model_name, temperature, max_tokens, system_prompt, is_active)
SELECT 
  id as user_id,
  'Default OpenAI' as name,
  'openai' as provider,
  'your-api-key-here' as api_key,
  'gpt-4o' as model_name,
  0.7 as temperature,
  1000 as max_tokens,
  'You are Wacanda, a helpful AI customer service assistant.' as system_prompt,
  true as is_active
FROM profiles
WHERE id NOT IN (SELECT user_id FROM ai_configurations WHERE is_active = true)
ON CONFLICT DO NOTHING;

-- Create default agent availability for admin users
INSERT INTO agent_availability (agent_id, is_available, status, max_concurrent_chats)
SELECT 
  id as agent_id,
  true as is_available,
  'offline' as status,
  5 as max_concurrent_chats
FROM profiles 
WHERE role IN ('admin', 'agent')
ON CONFLICT DO NOTHING; 