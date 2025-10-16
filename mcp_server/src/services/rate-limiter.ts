/**
 * Rate Limiter Service
 * 
 * Implements token bucket algorithm for rate limiting API calls.
 */

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number;
}

export class RateLimiter {
  private buckets = new Map<string, TokenBucket>();
  private defaultCapacity: number;
  private defaultRefillRate: number;

  constructor(capacity = 200, refillRate = 3.33) {
    this.defaultCapacity = capacity;
    this.defaultRefillRate = refillRate;
  }

  async throttle(key: string = 'default'): Promise<void> {
    const bucket = this.getOrCreateBucket(key);
    this.refillBucket(bucket);
    
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return;
    }
    
    const waitTime = (1 - bucket.tokens) / bucket.refillRate * 1000;
    await this.sleep(waitTime);
    bucket.tokens = 0;
  }

  private getOrCreateBucket(key: string): TokenBucket {
    let bucket = this.buckets.get(key);
    
    if (!bucket) {
      bucket = {
        tokens: this.defaultCapacity,
        lastRefill: Date.now(),
        capacity: this.defaultCapacity,
        refillRate: this.defaultRefillRate
      };
      this.buckets.set(key, bucket);
    }
    
    return bucket;
  }

  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = (now - bucket.lastRefill) / 1000;
    const tokensToAdd = elapsed * bucket.refillRate;
    
    bucket.tokens = Math.min(bucket.capacity, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  reset(key?: string): void {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }

  getStats(key: string = 'default'): { tokens: number; capacity: number } | null {
    const bucket = this.buckets.get(key);
    if (!bucket) return null;
    
    this.refillBucket(bucket);
    return {
      tokens: bucket.tokens,
      capacity: bucket.capacity
    };
  }
}

export const rateLimiter = new RateLimiter();
