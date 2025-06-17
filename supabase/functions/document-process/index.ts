import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAI } from 'https://esm.sh/openai@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ProcessRequest {
  document_id: string;
}

interface DocumentRecord {
  id: string;
  user_id: string;
  title: string;
  file_path?: string;
  file_type?: string;
  content?: string;
  metadata: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { document_id }: ProcessRequest = await req.json()

    // 1. Get document from database
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single()

    if (docError || !document) {
      throw new Error(`Document not found: ${document_id}`)
    }

    // 2. Update status to processing
    await updateDocumentStatus(supabase, document_id, 'processing')

    try {
      // 3. Extract text content
      const extractedContent = await extractTextContent(supabase, document as DocumentRecord)

      // 4. Update document with extracted content
      await supabase
        .from('documents')
        .update({ 
          content: extractedContent,
          processed_date: new Date().toISOString()
        })
        .eq('id', document_id)

      // 5. Split content into chunks
      const chunks = splitIntoChunks(extractedContent, 1000, 200) // 1000 chars with 200 overlap

      // 6. Generate embeddings for chunks
      const apiKey = Deno.env.get('OPENAI_API_KEY')
      if (!apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      await generateAndStoreEmbeddings(
        supabase,
        chunks,
        document.user_id,
        document_id,
        'document',
        apiKey
      )

      // 7. Update status to ready
      await updateDocumentStatus(supabase, document_id, 'ready')

      return new Response(
        JSON.stringify({
          success: true,
          document_id,
          chunks_processed: chunks.length,
          content_length: extractedContent.length
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )

    } catch (processingError) {
      // Update status to error
      await updateDocumentStatus(
        supabase, 
        document_id, 
        'error', 
        processingError.message
      )
      throw processingError
    }

  } catch (error) {
    console.error('Document processing error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})

async function updateDocumentStatus(
  supabase: any,
  documentId: string,
  status: string,
  errorMessage?: string
) {
  const updates: any = { status }
  if (errorMessage) {
    updates.error_message = errorMessage
  }

  await supabase
    .from('documents')
    .update(updates)
    .eq('id', documentId)
}

async function extractTextContent(supabase: any, document: DocumentRecord): Promise<string> {
  // If content is already provided, return it
  if (document.content) {
    return document.content
  }

  // If no file path, throw error
  if (!document.file_path) {
    throw new Error('No content or file path provided')
  }

  // Download file from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from('documents')
    .download(document.file_path)

  if (downloadError) {
    throw new Error(`Failed to download file: ${downloadError.message}`)
  }

  // Extract text based on file type
  const fileType = document.file_type?.toLowerCase() || ''
  
  if (fileType.includes('text') || fileType.includes('plain')) {
    return await fileData.text()
  }
  
  if (fileType.includes('json')) {
    const jsonData = await fileData.text()
    return JSON.stringify(JSON.parse(jsonData), null, 2)
  }

  if (fileType.includes('pdf')) {
    // For PDF processing, we'd need a PDF parser
    // For now, return a placeholder
    return `PDF content extraction not yet implemented for: ${document.title}`
  }

  if (fileType.includes('word') || fileType.includes('docx')) {
    // For Word documents, we'd need a DOCX parser
    return `Word document content extraction not yet implemented for: ${document.title}`
  }

  // Default: try to read as text
  try {
    return await fileData.text()
  } catch {
    throw new Error(`Unsupported file type: ${fileType}`)
  }
}

function splitIntoChunks(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  if (text.length <= chunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length)
    let chunk = text.slice(start, end)

    // Try to break at word boundaries
    if (end < text.length) {
      const lastSpaceIndex = chunk.lastIndexOf(' ')
      if (lastSpaceIndex > chunkSize * 0.8) { // Only break if it's not too far back
        chunk = chunk.slice(0, lastSpaceIndex)
      }
    }

    chunks.push(chunk.trim())

    // Move start position with overlap
    start = start + chunkSize - overlap
    
    // Prevent infinite loop
    if (start >= text.length) break
  }

  return chunks.filter(chunk => chunk.length > 50) // Filter out very small chunks
}

async function generateAndStoreEmbeddings(
  supabase: any,
  chunks: string[],
  userId: string,
  sourceId: string,
  sourceType: 'document' | 'webpage',
  apiKey: string
) {
  const openai = new OpenAI({ apiKey })

  // Process in batches to avoid rate limits
  const batchSize = 10
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    
    // Generate embeddings for this batch
    const embeddings = await Promise.all(
      batch.map(async (chunk) => {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk
        })
        return embeddingResponse.data[0].embedding
      })
    )

    // Store embeddings in database
    const embeddingRecords = batch.map((chunk, index) => ({
      user_id: userId,
      source_id: sourceId,
      source_type: sourceType,
      chunk_text: chunk,
      chunk_index: i + index,
      embedding: embeddings[index],
      metadata: {
        chunk_size: chunk.length,
        chunk_position: i + index
      }
    }))

    const { error } = await supabase
      .from('document_embeddings')
      .insert(embeddingRecords)

    if (error) {
      console.error('Failed to store embeddings batch:', error)
      throw new Error(`Failed to store embeddings: ${error.message}`)
    }

    // Add delay between batches to respect rate limits
    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
} 