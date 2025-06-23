import { supabase } from '../lib/supabase'
import type { WebPage } from '../types'

export class WebPageService {
  async addWebPage(
    userId: string,
    url: string,
    includeChildren: boolean = false,
    maxDepth: number = 1
  ): Promise<WebPage> {
    // Validate URL format
    try {
      new URL(url)
    } catch { // Ignored 
      throw new Error('Invalid URL format')
    }

    const { data, error } = await supabase
      .from('web_pages')
      .insert({
        user_id: userId,
        url,
        include_children: includeChildren,
        max_depth: maxDepth,
        status: 'pending'
      })
      .select()
      .single()

    if (error) throw error

    // Trigger scraping via Edge Function (will be implemented in Phase 2)
    try {
      await supabase.functions.invoke('webpage-scrape', {
        body: { webpage_id: data.id }
      })
    } catch { // Ignored 
    }

    return data
  }

  async getWebPages(userId: string): Promise<WebPage[]> {
    const { data, error } = await supabase
      .from('web_pages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async getWebPage(webPageId: string): Promise<WebPage | null> {
    const { data, error } = await supabase
      .from('web_pages')
      .select('*')
      .eq('id', webPageId)
      .single()

    if (error) {
      console.error('Error fetching web page:', error)
      return null
    }
    return data
  }

  async updateWebPage(webPageId: string, updates: Partial<WebPage>): Promise<WebPage> {
    const { data, error } = await supabase
      .from('web_pages')
      .update(updates)
      .eq('id', webPageId)
      .select()
      .single()

    if (error) throw error
    return data
  }

  async deleteWebPage(webPageId: string): Promise<void> {
    const { error } = await supabase
      .from('web_pages')
      .delete()
      .eq('id', webPageId)

    if (error) throw error
  }

  async getWebPagesByStatus(userId: string, status: string): Promise<WebPage[]> {
    const { data, error } = await supabase
      .from('web_pages')
      .select('*')
      .eq('user_id', userId)
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async searchWebPages(userId: string, query: string): Promise<WebPage[]> {
    const { data, error } = await supabase
      .from('web_pages')
      .select('*')
      .eq('user_id', userId)
      .or(`url.ilike.%${query}%,title.ilike.%${query}%,content.ilike.%${query}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  async retryWebPageScraping(webPageId: string): Promise<WebPage> {
    // Reset status to pending
    const webPage = await this.updateWebPage(webPageId, { 
      status: 'pending',
      error_message: undefined
    })

    // Trigger scraping again
    try {
      await supabase.functions.invoke('webpage-scrape', {
        body: { webpage_id: webPageId }
      })
    } catch { // Ignored 
      throw new Error('Failed to restart scraping process')
    }

    return webPage
  }

  async bulkAddWebPages(
    userId: string,
    urls: string[],
    includeChildren: boolean = false,
    maxDepth: number = 1
  ): Promise<WebPage[]> {
    const webPages: WebPage[] = []

    for (const url of urls) {
      try {
        const webPage = await this.addWebPage(userId, url, includeChildren, maxDepth)
        webPages.push(webPage)
      } catch { // Ignored 
        console.error(`Failed to add web page ${url}:`, error)
        // Continue with other URLs even if one fails
      }
    }

    return webPages
  }

  async getWebPageCount(userId: string): Promise<number> {
    const { count, error } = await supabase
      .from('web_pages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) throw error
    return count || 0
  }

  async getWebPagesByDomain(userId: string, domain: string): Promise<WebPage[]> {
    const { data, error } = await supabase
      .from('web_pages')
      .select('*')
      .eq('user_id', userId)
      .ilike('url', `%${domain}%`)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data || []
  }

  // Extract domain from URL for grouping
  extractDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch { // Ignored 
      return 'unknown'
    }
  }

  async getWebPagesByStatusCounts(userId: string): Promise<Record<string, number>> {
    const { data, error } = await supabase
      .from('web_pages')
      .select('status')
      .eq('user_id', userId)

    if (error) throw error

    const counts: Record<string, number> = {}
    data?.forEach(item => {
      counts[item.status] = (counts[item.status] || 0) + 1
    })

    return counts
  }
}

export const webPageService = new WebPageService() 