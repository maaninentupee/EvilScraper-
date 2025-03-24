/**
 * TokenBucket implementation for rate limiting
 * Uses the token bucket algorithm to control the rate of requests
 */
export class TokenBucket {
  private tokens: number;
  private readonly capacity: number;
  private readonly refillRate: number; // tokens per second
  private lastRefillTimestamp: number;

  /**
   * Creates a new TokenBucket
   * @param capacity Maximum number of tokens the bucket can hold
   * @param refillRate Rate at which tokens are added to the bucket (tokens per second)
   */
  constructor(capacity: number, refillRate: number) {
    this.tokens = capacity;
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.lastRefillTimestamp = Date.now();
  }

  /**
   * Refills the token bucket based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsedTimeInSeconds = (now - this.lastRefillTimestamp) / 1000;
    
    // Calculate tokens to add based on elapsed time and refill rate
    const tokensToAdd = elapsedTimeInSeconds * this.refillRate;
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefillTimestamp = now;
    }
  }

  /**
   * Attempts to consume a token from the bucket
   * @param count Number of tokens to consume (default: 1)
   * @returns true if tokens were consumed, false if not enough tokens
   */
  public consume(count: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= count) {
      this.tokens -= count;
      return true;
    }
    
    return false;
  }

  /**
   * Gets the current number of tokens in the bucket
   * @returns Current token count
   */
  public getTokenCount(): number {
    this.refill();
    return this.tokens;
  }

  /**
   * Resets the token bucket to full capacity
   */
  public reset(): void {
    this.tokens = this.capacity;
    this.lastRefillTimestamp = Date.now();
  }
}
