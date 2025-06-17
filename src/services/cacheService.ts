import { supabase } from '../lib/supabase'

export interface CacheConfig {
  ttl: number // Time to live in milliseconds
  maxSize: number // Maximum number of entries
  strategy: 'lru' | 'lfu' | 'fifo' // Cache eviction strategy
}

export interface CacheEntry<T> {
  value: T
  timestamp: number
  accessCount: number
  lastAccessed: number
  size: number
}

export interface CacheStats {
  hits: number
  misses: number
  hitRate: number
  totalEntries: number
  memoryUsage: number
  evictions: number
}

export class CacheService {
  private static instance: CacheService
  private caches: Map<string, Map<string, CacheEntry<any>>> = new Map()
  private configs: Map<string, CacheConfig> = new Map()
  private stats: Map<string, CacheStats> = new Map()

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService()
    }
    return CacheService.instance
  }

  constructor() {
    // Initialize default cache configurations
    this.initializeDefaultCaches()
    
    // Start cleanup interval
    setInterval(() => this.cleanupExpiredEntries(), 60000) // Every minute
  }

  /**
   * Create or configure a cache namespace
   */
  createCache(
    namespace: string, 
    config: Partial<CacheConfig> = {}
  ): void {
    const defaultConfig: CacheConfig = {
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      strategy: 'lru'
    }

    this.configs.set(namespace, { ...defaultConfig, ...config })
    this.caches.set(namespace, new Map())
    this.stats.set(namespace, {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalEntries: 0,
      memoryUsage: 0,
      evictions: 0
    })
  }

  /**
   * Get value from cache
   */
  get<T>(namespace: string, key: string): T | null {
    const cache = this.caches.get(namespace)
    const stats = this.stats.get(namespace)
    
    if (!cache || !stats) {
      console.warn(`Cache namespace '${namespace}' not found`)
      return null
    }

    const entry = cache.get(key)
    
    if (!entry) {
      stats.misses++
      this.updateHitRate(stats)
      return null
    }

    const config = this.configs.get(namespace)!
    const now = Date.now()

    // Check if entry is expired
    if (now - entry.timestamp > config.ttl) {
      cache.delete(key)
      stats.misses++
      stats.totalEntries--
      this.updateHitRate(stats)
      return null
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = now
    stats.hits++
    this.updateHitRate(stats)

    return entry.value
  }

  /**
   * Set value in cache
   */
  set<T>(
    namespace: string, 
    key: string, 
    value: T, 
    _customTTL?: number
  ): boolean {
    const cache = this.caches.get(namespace)
    const config = this.configs.get(namespace)
    const stats = this.stats.get(namespace)
    
    if (!cache || !config || !stats) {
      console.warn(`Cache namespace '${namespace}' not found`)
      return false
    }

    const now = Date.now()
    const size = this.calculateSize(value)
    
    // Check if we need to evict entries
    if (cache.size >= config.maxSize) {
      this.evictEntries(namespace, 1)
    }

    const entry: CacheEntry<T> = {
      value,
      timestamp: now,
      accessCount: 1,
      lastAccessed: now,
      size
    }

    cache.set(key, entry)
    stats.totalEntries++
    stats.memoryUsage += size

    return true
  }

  /**
   * Delete specific key from cache
   */
  delete(namespace: string, key: string): boolean {
    const cache = this.caches.get(namespace)
    const stats = this.stats.get(namespace)
    
    if (!cache || !stats) {
      return false
    }

    const entry = cache.get(key)
    if (entry) {
      cache.delete(key)
      stats.totalEntries--
      stats.memoryUsage -= entry.size
      return true
    }

    return false
  }

  /**
   * Clear entire cache namespace
   */
  clear(namespace: string): void {
    const cache = this.caches.get(namespace)
    const stats = this.stats.get(namespace)
    
    if (cache && stats) {
      cache.clear()
      stats.totalEntries = 0
      stats.memoryUsage = 0
    }
  }

  /**
   * Get cache statistics
   */
  getStats(namespace: string): CacheStats | null {
    return this.stats.get(namespace) || null
  }

  /**
   * Get all cache statistics
   */
  getAllStats(): Record<string, CacheStats> {
    const allStats: Record<string, CacheStats> = {}
    this.stats.forEach((stats, namespace) => {
      allStats[namespace] = { ...stats }
    })
    return allStats
  }

  /**
   * Intelligent cache preloading based on usage patterns
   */
  async preloadCache(
    namespace: string,
    dataLoader: (keys: string[]) => Promise<Record<string, any>>
  ): Promise<void> {
    try {
      // Analyze access patterns to determine what to preload
      const keysToPreload = await this.analyzeAccessPatterns(namespace)
      
      if (keysToPreload.length === 0) return

      // Load data in batches
      const batchSize = 10
      for (let i = 0; i < keysToPreload.length; i += batchSize) {
        const batch = keysToPreload.slice(i, i + batchSize)
        const data = await dataLoader(batch)
        
        // Store in cache
        Object.entries(data).forEach(([key, value]) => {
          this.set(namespace, key, value)
        })
      }
    } catch (error) {
      console.error('Error preloading cache:', error)
    }
  }

  /**
   * Cache with automatic refresh
   */
  async getOrSet<T>(
    namespace: string,
    key: string,
    fetcher: () => Promise<T>,
    customTTL?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = this.get<T>(namespace, key)
    if (cached !== null) {
      return cached
    }

    // Not in cache, fetch the data
    try {
      const value = await fetcher()
      this.set(namespace, key, value, customTTL)
      return value
    } catch (error) {
      console.error(`Error fetching data for cache key ${key}:`, error)
      throw error
    }
  }

  /**
   * Batch get operation
   */
  getBatch<T>(namespace: string, keys: string[]): Record<string, T | null> {
    const results: Record<string, T | null> = {}
    
    keys.forEach(key => {
      results[key] = this.get<T>(namespace, key)
    })

    return results
  }

  /**
   * Batch set operation
   */
  setBatch<T>(
    namespace: string, 
    entries: Record<string, T>,
    customTTL?: number
  ): Record<string, boolean> {
    const results: Record<string, boolean> = {}
    
    Object.entries(entries).forEach(([key, value]) => {
      results[key] = this.set(namespace, key, value, customTTL)
    })

    return results
  }

  /**
   * Smart cache invalidation based on patterns
   */
  invalidatePattern(namespace: string, pattern: string): number {
    const cache = this.caches.get(namespace)
    const stats = this.stats.get(namespace)
    
    if (!cache || !stats) {
      return 0
    }

    let invalidatedCount = 0
    const regex = new RegExp(pattern)
    
    for (const [key, entry] of cache.entries()) {
      if (regex.test(key)) {
        cache.delete(key)
        stats.totalEntries--
        stats.memoryUsage -= entry.size
        invalidatedCount++
      }
    }

    return invalidatedCount
  }

  /**
   * Cache warming based on user behavior
   */
  async warmCache(
    namespace: string,
    userId: string,
    dataLoaders: Record<string, () => Promise<any>>
  ): Promise<void> {
    try {
      // Get user's recent activity patterns
      const patterns = await this.getUserActivityPatterns(userId)
      
      // Determine what data to pre-cache
      const cacheTargets = this.determineCacheTargets(patterns)
      
      // Load and cache the data
      for (const target of cacheTargets) {
        if (dataLoaders[target.type]) {
          const data = await dataLoaders[target.type]()
          this.set(namespace, target.key, data)
        }
      }
    } catch (error) {
      console.error('Error warming cache:', error)
    }
  }

  /**
   * Distributed cache invalidation (for multi-instance deployments)
   */
  async broadcastInvalidation(
    namespace: string,
    keys: string[]
  ): Promise<void> {
    try {
      // Use Supabase Realtime for cache invalidation broadcasts
      await supabase
        .channel('cache-invalidation')
        .send({
          type: 'broadcast',
          event: 'invalidate',
          payload: {
            namespace,
            keys,
            timestamp: Date.now()
          }
        })

      // Local invalidation
      keys.forEach(key => this.delete(namespace, key))
    } catch (error) {
      console.error('Error broadcasting cache invalidation:', error)
    }
  }

  /**
   * Listen for distributed cache invalidations
   */
  subscribeToInvalidations(): () => void {
    const channel = supabase
      .channel('cache-invalidation')
      .on('broadcast', { event: 'invalidate' }, (payload) => {
        const { namespace, keys } = payload.payload
        keys.forEach((key: string) => this.delete(namespace, key))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  /**
   * Cache compression for large objects
   */
  setCompressed<T>(
    namespace: string,
    key: string,
    value: T,
    customTTL?: number
  ): boolean {
    try {
      const compressed = this.compressValue(value)
      return this.set(namespace, key, compressed, customTTL)
    } catch (error) {
      console.error('Error setting compressed cache value:', error)
      return false
    }
  }

  /**
   * Get compressed cache value
   */
  getCompressed<T>(namespace: string, key: string): T | null {
    try {
      const compressed = this.get(namespace, key)
      if (compressed === null) return null
      
      return this.decompressValue(compressed)
    } catch (error) {
      console.error('Error getting compressed cache value:', error)
      return null
    }
  }

  // Private helper methods

  private initializeDefaultCaches(): void {
    // RAG cache for embeddings and search results
    this.createCache('rag', {
      ttl: 600000, // 10 minutes
      maxSize: 500,
      strategy: 'lru'
    })

    // AI responses cache
    this.createCache('ai_responses', {
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      strategy: 'lfu'
    })

    // User sessions cache
    this.createCache('sessions', {
      ttl: 900000, // 15 minutes
      maxSize: 200,
      strategy: 'lru'
    })

    // Document metadata cache
    this.createCache('documents', {
      ttl: 1800000, // 30 minutes
      maxSize: 500,
      strategy: 'lru'
    })

    // Configuration cache
    this.createCache('config', {
      ttl: 3600000, // 1 hour
      maxSize: 100,
      strategy: 'lru'
    })
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now()

    this.caches.forEach((cache, namespace) => {
      const config = this.configs.get(namespace)
      const stats = this.stats.get(namespace)
      
      if (!config || !stats) return

      const expiredKeys: string[] = []
      
      cache.forEach((entry, key) => {
        if (now - entry.timestamp > config.ttl) {
          expiredKeys.push(key)
        }
      })

      expiredKeys.forEach(key => {
        const entry = cache.get(key)
        if (entry) {
          cache.delete(key)
          stats.totalEntries--
          stats.memoryUsage -= entry.size
        }
      })
    })
  }

  private evictEntries(namespace: string, count: number): void {
    const cache = this.caches.get(namespace)
    const config = this.configs.get(namespace)
    const stats = this.stats.get(namespace)
    
    if (!cache || !config || !stats) return

    const entries = Array.from(cache.entries())
    let toEvict: string[] = []

    switch (config.strategy) {
      case 'lru':
        toEvict = entries
          .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed)
          .slice(0, count)
          .map(([key]) => key)
        break
      
      case 'lfu':
        toEvict = entries
          .sort(([,a], [,b]) => a.accessCount - b.accessCount)
          .slice(0, count)
          .map(([key]) => key)
        break
      
      case 'fifo':
        toEvict = entries
          .sort(([,a], [,b]) => a.timestamp - b.timestamp)
          .slice(0, count)
          .map(([key]) => key)
        break
    }

    toEvict.forEach(key => {
      const entry = cache.get(key)
      if (entry) {
        cache.delete(key)
        stats.totalEntries--
        stats.memoryUsage -= entry.size
        stats.evictions++
      }
    })
  }

  private calculateSize(value: any): number {
    // Rough estimation of object size in bytes
    const json = JSON.stringify(value)
    return new Blob([json]).size
  }

  private updateHitRate(stats: CacheStats): void {
    const total = stats.hits + stats.misses
    stats.hitRate = total > 0 ? (stats.hits / total) * 100 : 0
  }

  private async analyzeAccessPatterns(namespace: string): Promise<string[]> {
    // This would analyze cache access logs to determine frequently accessed keys
    // For now, return empty array
    return []
  }

  private async getUserActivityPatterns(userId: string): Promise<any[]> {
    try {
      // Get user's recent chat sessions and document access
      const { data: sessions } = await supabase
        .from('chat_sessions')
        .select('id, sender_type, session_metadata')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(10)

      const { data: documents } = await supabase
        .from('documents')
        .select('id, title, folder_path')
        .eq('user_id', userId)
        .order('upload_date', { ascending: false })
        .limit(20)

      return [
        ...(sessions || []).map(s => ({ type: 'session', data: s })),
        ...(documents || []).map(d => ({ type: 'document', data: d }))
      ]
    } catch (error) {
      console.error('Error analyzing user activity patterns:', error)
      return []
    }
  }

  private determineCacheTargets(patterns: any[]): Array<{ type: string; key: string }> {
    const targets: Array<{ type: string; key: string }> = []
    
    // Determine what to cache based on patterns
    patterns.forEach(pattern => {
      if (pattern.type === 'session') {
        targets.push({
          type: 'session_messages',
          key: `session_${pattern.data.id}`
        })
      } else if (pattern.type === 'document') {
        targets.push({
          type: 'document_content',
          key: `document_${pattern.data.id}`
        })
      }
    })

    return targets
  }

  private compressValue(value: any): string {
    // Simple compression using JSON stringification
    // In a real implementation, you might use a compression library
    return JSON.stringify(value)
  }

  private decompressValue<T>(compressed: string): T {
    // Simple decompression
    return JSON.parse(compressed)
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance()

// Enhanced cache decorators for automatic caching
export function Cached(
  namespace: string,
  ttl?: number,
  keyGenerator?: (...args: any[]) => string
) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function(...args: any[]) {
      const key = keyGenerator 
        ? keyGenerator(...args)
        : `${propertyName}_${JSON.stringify(args)}`

      // Try cache first
      const cached = cacheService.get(namespace, key)
      if (cached !== null) {
        return cached
      }

      // Execute method and cache result
      const result = await method.apply(this, args)
      cacheService.set(namespace, key, result, ttl)
      
      return result
    }

    return descriptor
  }
}

// Cache invalidation decorator
export function InvalidateCache(
  namespace: string,
  pattern?: string
) {
  return function(target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function(...args: any[]) {
      const result = await method.apply(this, args)
      
      if (pattern) {
        cacheService.invalidatePattern(namespace, pattern)
      } else {
        cacheService.clear(namespace)
      }
      
      return result
    }

    return descriptor
  }
} 