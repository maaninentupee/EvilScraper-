import { TokenBucket } from '../../src/services/utils/TokenBucket';

/**
 * TokenBucket Integration Test
 * 
 * This test verifies that the token bucket algorithm correctly limits
 * the rate of requests according to the configured capacity and refill rate.
 */
describe('TokenBucket Integration Test', () => {
  let tokenBucket: TokenBucket;

  beforeEach(() => {
    // Max 10 requests, refills at 1 token per second
    tokenBucket = new TokenBucket(10, 1);
  });

  it('should allow requests within limit', () => {
    // Should allow 10 requests (full capacity)
    for (let i = 0; i < 10; i++) {
      expect(tokenBucket.consume()).toBe(true);
    }
  });

  it('should block requests over the limit', () => {
    // Consume all tokens
    for (let i = 0; i < 10; i++) {
      tokenBucket.consume();
    }

    // The next request should be blocked
    expect(tokenBucket.consume()).toBe(false);
  });

  it('should refill tokens over time', async () => {
    // Consume all tokens
    for (let i = 0; i < 10; i++) {
      tokenBucket.consume();
    }

    // Wait for 2 seconds (should refill 2 tokens)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Should allow 2 requests now
    expect(tokenBucket.consume()).toBe(true);
    expect(tokenBucket.consume()).toBe(true);
    
    // But not a third
    expect(tokenBucket.consume()).toBe(false);
  });

  it('should respect the configured capacity', () => {
    // Create a bucket with smaller capacity
    const smallBucket = new TokenBucket(3, 1);
    
    // Should allow exactly 3 requests
    expect(smallBucket.consume()).toBe(true);
    expect(smallBucket.consume()).toBe(true);
    expect(smallBucket.consume()).toBe(true);
    expect(smallBucket.consume()).toBe(false);
  });

  it('should handle fractional token consumption', async () => {
    const bucket = new TokenBucket(5, 0.5); // 0.5 tokens per second
    
    // Consume all tokens
    for (let i = 0; i < 5; i++) {
      bucket.consume();
    }
    
    // Wait for 2 seconds (should refill 1 token)
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Should allow 1 request
    expect(bucket.consume()).toBe(true);
    expect(bucket.consume()).toBe(false);
  });

  it('should reset to full capacity when requested', () => {
    // Consume some tokens
    for (let i = 0; i < 5; i++) {
      tokenBucket.consume();
    }
    
    // Reset the bucket
    tokenBucket.reset();
    
    // Should now allow 10 requests again
    for (let i = 0; i < 10; i++) {
      expect(tokenBucket.consume()).toBe(true);
    }
    
    // But not an 11th
    expect(tokenBucket.consume()).toBe(false);
  });
});
