import { Injectable } from '@nestjs/common';

/**
 * Simple cache service for storing and retrieving AI responses
 */
@Injectable()
export class CacheService {
  private cache: Map<string, any> = new Map();

  /**
   * Store a value in the cache
   * @param key Cache key
   * @param value Value to store
   * @param ttlMs Time to live in milliseconds (optional)
   */
  set(key: string, value: any, ttlMs?: number): void {
    this.cache.set(key, value);
    
    if (ttlMs) {
      setTimeout(() => {
        this.cache.delete(key);
      }, ttlMs);
    }
  }

  /**
   * Get a value from the cache
   * @param key Cache key
   * @returns The cached value or null if not found
   */
  get(key: string): any {
    return this.cache.has(key) ? this.cache.get(key) : null;
  }

  /**
   * Check if a key exists in the cache
   * @param key Cache key
   * @returns True if the key exists, false otherwise
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete a value from the cache
   * @param key Cache key
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
  }
}
