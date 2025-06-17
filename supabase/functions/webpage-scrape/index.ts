import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { OpenAI } from 'https://esm.sh/openai@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScrapeRequest {
  webpage_id: string;
}

interface WebPageRecord {
  id: string;
  user_id: string;
  url: string;
  title?: string;
  include_children: boolean;
  max_depth: number;
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

    const { webpage_id }: ScrapeRequest = await req.json()

    // 1. Get webpage record from database
    const { data: webpage, error: webpageError } = await supabase
      .from('web_pages')
      .select('*')
      .eq('id', webpage_id)
      .single()

    if (webpageError || !webpage) {
      throw new Error(`Webpage not found: ${webpage_id}`)
    }

    // 2. Update status to scraping
    await updateWebPageStatus(supabase, webpage_id, 'scraping')

    try {
      // 3. Scrape the main page
      const scrapedContent = await scrapePage(webpage.url)

      // 4. Get child pages if enabled
      const allPages = [{ url: webpage.url, content: scrapedContent }]
      
      if (webpage.include_children && webpage.max_depth > 1) {
        const childPages = await scrapeChildPages(
          webpage.url,
          webpage.max_depth - 1,
          new Set([webpage.url])
        )
        allPages.push(...childPages)
      }

      // 5. Combine all content
      const combinedContent = allPages
        .map(page => `URL: ${page.url}\n\n${page.content}`)
        .join('\n\n---\n\n')

      // 6. Update webpage with scraped content
      await supabase
        .from('web_pages')
        .update({
          content: combinedContent,
          title: scrapedContent.title || extractTitleFromUrl(webpage.url),
          scraped_at: new Date().toISOString(),
          metadata: {
            ...webpage.metadata,
            pages_scraped: allPages.length,
            content_length: combinedContent.length
          }
        })
        .eq('id', webpage_id)

      // 7. Split content into chunks and generate embeddings
      const chunks = splitIntoChunks(combinedContent, 1000, 200)

      const apiKey = Deno.env.get('OPENAI_API_KEY')
      if (!apiKey) {
        throw new Error('OpenAI API key not configured')
      }

      await generateAndStoreEmbeddings(
        supabase,
        chunks,
        webpage.user_id,
        webpage_id,
        'webpage',
        apiKey
      )

      // 8. Update status to ready
      await updateWebPageStatus(supabase, webpage_id, 'ready')

      return new Response(
        JSON.stringify({
          success: true,
          webpage_id,
          pages_scraped: allPages.length,
          chunks_processed: chunks.length,
          content_length: combinedContent.length
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )

    } catch (processingError) {
      // Update status to error
      await updateWebPageStatus(
        supabase,
        webpage_id,
        'error',
        processingError.message
      )
      throw processingError
    }

  } catch (error) {
    console.error('Webpage scraping error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})

async function updateWebPageStatus(
  supabase: any,
  webpageId: string,
  status: string,
  errorMessage?: string
) {
  const updates: any = { status }
  if (errorMessage) {
    updates.error_message = errorMessage
  }

  await supabase
    .from('web_pages')
    .update(updates)
    .eq('id', webpageId)
}

async function scrapePage(url: string): Promise<{ title?: string; content: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Wacanda-Bot/1.0'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    return extractTextFromHtml(html)
  } catch (error) {
    throw new Error(`Failed to scrape ${url}: ${error.message}`)
  }
}

function extractTextFromHtml(html: string): { title?: string; content: string } {
  // Simple HTML parsing for text extraction
  // In production, you'd want a more robust HTML parser
  
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch ? titleMatch[1].trim() : undefined

  // Remove script and style tags
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ') // Remove all HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()

  return { title, content: text }
}

async function scrapeChildPages(
  baseUrl: string,
  maxDepth: number,
  visitedUrls: Set<string>
): Promise<Array<{ url: string; content: string }>> {
  if (maxDepth <= 0) return []

  const childPages: Array<{ url: string; content: string }> = []
  
  try {
    // Get links from the base page
    const response = await fetch(baseUrl)
    const html = await response.text()
    const links = extractLinksFromHtml(html, baseUrl)

    // Limit to prevent excessive crawling
    const limitedLinks = links.slice(0, 5)

    for (const link of limitedLinks) {
      if (visitedUrls.has(link)) continue
      visitedUrls.add(link)

      try {
        const scrapedContent = await scrapePage(link)
        childPages.push({
          url: link,
          content: scrapedContent.content
        })

        // Recursively scrape if depth allows
        if (maxDepth > 1) {
          const grandchildren = await scrapeChildPages(link, maxDepth - 1, visitedUrls)
          childPages.push(...grandchildren)
        }

        // Add delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.warn(`Failed to scrape child page ${link}:`, error)
      }
    }
  } catch (error) {
    console.warn(`Failed to get child links from ${baseUrl}:`, error)
  }

  return childPages
}

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const linkRegex = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi
  const links: string[] = []
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    let url = match[1]
    
    // Skip non-HTTP links
    if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#')) {
      continue
    }

    // Convert relative URLs to absolute
    if (url.startsWith('/')) {
      const baseUrlObj = new URL(baseUrl)
      url = `${baseUrlObj.origin}${url}`
    } else if (!url.startsWith('http')) {
      url = new URL(url, baseUrl).href
    }

    // Only include links from the same domain
    const baseUrlObj = new URL(baseUrl)
    const linkUrlObj = new URL(url)
    
    if (linkUrlObj.hostname === baseUrlObj.hostname) {
      links.push(url)
    }
  }

  return [...new Set(links)] // Remove duplicates
}

function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.hostname + urlObj.pathname
  } catch {
    return url
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
      if (lastSpaceIndex > chunkSize * 0.8) {
        chunk = chunk.slice(0, lastSpaceIndex)
      }
    }

    chunks.push(chunk.trim())
    start = start + chunkSize - overlap
    
    if (start >= text.length) break
  }

  return chunks.filter(chunk => chunk.length > 50)
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

  const batchSize = 10
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    
    const embeddings = await Promise.all(
      batch.map(async (chunk) => {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: chunk
        })
        return embeddingResponse.data[0].embedding
      })
    )

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

    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
} 