-- Create vector similarity search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10,
  user_id uuid DEFAULT NULL,
  source_types text[] DEFAULT ARRAY['document', 'webpage'],
  exclude_source_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  source_id uuid,
  source_type text,
  chunk_text text,
  chunk_index int,
  similarity float,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.source_id,
    de.source_type,
    de.chunk_text,
    de.chunk_index,
    (1 - (de.embedding <=> query_embedding)) as similarity,
    de.metadata,
    de.created_at
  FROM document_embeddings de
  WHERE 
    (user_id IS NULL OR de.user_id = user_id)
    AND de.source_type = ANY(source_types)
    AND (exclude_source_id IS NULL OR de.source_id != exclude_source_id)
    AND (1 - (de.embedding <=> query_embedding)) > match_threshold
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create function to get document chunks with metadata
CREATE OR REPLACE FUNCTION get_document_chunks(
  source_id_param uuid,
  source_type_param text DEFAULT 'document'
)
RETURNS TABLE (
  id uuid,
  chunk_text text,
  chunk_index int,
  metadata jsonb,
  source_title text,
  source_url text
)
LANGUAGE plpgsql
AS $$
BEGIN
  IF source_type_param = 'document' THEN
    RETURN QUERY
    SELECT
      de.id,
      de.chunk_text,
      de.chunk_index,
      de.metadata,
      d.title as source_title,
      NULL::text as source_url
    FROM document_embeddings de
    JOIN documents d ON de.source_id = d.id
    WHERE de.source_id = source_id_param
      AND de.source_type = 'document'
    ORDER BY de.chunk_index;
  ELSE
    RETURN QUERY
    SELECT
      de.id,
      de.chunk_text,
      de.chunk_index,
      de.metadata,
      wp.title as source_title,
      wp.url as source_url
    FROM document_embeddings de
    JOIN web_pages wp ON de.source_id = wp.id
    WHERE de.source_id = source_id_param
      AND de.source_type = 'webpage'
    ORDER BY de.chunk_index;
  END IF;
END;
$$;

-- Create function to clean up orphaned embeddings
CREATE OR REPLACE FUNCTION cleanup_orphaned_embeddings()
RETURNS TABLE (deleted_count bigint)
LANGUAGE plpgsql
AS $$
DECLARE
  doc_count bigint;
  webpage_count bigint;
BEGIN
  -- Delete embeddings for non-existent documents
  DELETE FROM document_embeddings 
  WHERE source_type = 'document' 
    AND source_id NOT IN (SELECT id FROM documents);
  
  GET DIAGNOSTICS doc_count = ROW_COUNT;
  
  -- Delete embeddings for non-existent web pages
  DELETE FROM document_embeddings 
  WHERE source_type = 'webpage' 
    AND source_id NOT IN (SELECT id FROM web_pages);
    
  GET DIAGNOSTICS webpage_count = ROW_COUNT;
  
  RETURN QUERY SELECT doc_count + webpage_count;
END;
$$;

-- Create function to get knowledge base statistics
CREATE OR REPLACE FUNCTION get_knowledge_base_stats(user_id_param uuid)
RETURNS TABLE (
  total_documents bigint,
  total_webpages bigint,
  total_embeddings bigint,
  ready_documents bigint,
  processing_documents bigint,
  error_documents bigint,
  ready_webpages bigint,
  processing_webpages bigint,
  error_webpages bigint,
  avg_document_chunks float,
  avg_webpage_chunks float,
  total_content_length bigint
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH doc_stats AS (
    SELECT 
      COUNT(*) as total_docs,
      COUNT(*) FILTER (WHERE status = 'ready') as ready_docs,
      COUNT(*) FILTER (WHERE status = 'processing') as processing_docs,
      COUNT(*) FILTER (WHERE status = 'error') as error_docs,
      COALESCE(SUM(LENGTH(content)), 0) as doc_content_length
    FROM documents 
    WHERE user_id = user_id_param
  ),
  webpage_stats AS (
    SELECT 
      COUNT(*) as total_pages,
      COUNT(*) FILTER (WHERE status = 'ready') as ready_pages,
      COUNT(*) FILTER (WHERE status = 'scraping') as processing_pages,
      COUNT(*) FILTER (WHERE status = 'error') as error_pages,
      COALESCE(SUM(LENGTH(content)), 0) as webpage_content_length
    FROM web_pages 
    WHERE user_id = user_id_param
  ),
  embedding_stats AS (
    SELECT 
      COUNT(*) as total_emb,
      AVG(CASE WHEN source_type = 'document' THEN 1.0 ELSE 0 END) * COUNT(*) FILTER (WHERE source_type = 'document') / NULLIF(COUNT(DISTINCT CASE WHEN source_type = 'document' THEN source_id END), 0) as avg_doc_chunks,
      AVG(CASE WHEN source_type = 'webpage' THEN 1.0 ELSE 0 END) * COUNT(*) FILTER (WHERE source_type = 'webpage') / NULLIF(COUNT(DISTINCT CASE WHEN source_type = 'webpage' THEN source_id END), 0) as avg_page_chunks
    FROM document_embeddings 
    WHERE user_id = user_id_param
  )
  SELECT 
    ds.total_docs,
    ws.total_pages,
    es.total_emb,
    ds.ready_docs,
    ds.processing_docs,
    ds.error_docs,
    ws.ready_pages,
    ws.processing_pages,
    ws.error_pages,
    COALESCE(es.avg_doc_chunks, 0),
    COALESCE(es.avg_page_chunks, 0),
    ds.doc_content_length + ws.webpage_content_length
  FROM doc_stats ds, webpage_stats ws, embedding_stats es;
END;
$$;

-- Create function to find duplicate content
CREATE OR REPLACE FUNCTION find_duplicate_content(
  user_id_param uuid,
  similarity_threshold float DEFAULT 0.95
)
RETURNS TABLE (
  source_id_1 uuid,
  source_type_1 text,
  source_id_2 uuid,
  source_type_2 text,
  similarity_score float,
  chunk_text_1 text,
  chunk_text_2 text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    de1.source_id,
    de1.source_type,
    de2.source_id,
    de2.source_type,
    (1 - (de1.embedding <=> de2.embedding)) as similarity,
    de1.chunk_text,
    de2.chunk_text
  FROM document_embeddings de1
  JOIN document_embeddings de2 ON de1.id < de2.id  -- Avoid duplicates
  WHERE de1.user_id = user_id_param
    AND de2.user_id = user_id_param
    AND (1 - (de1.embedding <=> de2.embedding)) > similarity_threshold
    AND (de1.source_id != de2.source_id OR de1.source_type != de2.source_type)
  ORDER BY similarity DESC
  LIMIT 100;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION match_documents TO authenticated;
GRANT EXECUTE ON FUNCTION get_document_chunks TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_orphaned_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION get_knowledge_base_stats TO authenticated;
GRANT EXECUTE ON FUNCTION find_duplicate_content TO authenticated; 