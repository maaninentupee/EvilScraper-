import { ProviderHealth } from '../ProviderHealthMonitor';

/**
 * Helper class for scoring service providers
 */
export class ProviderScoreUtils {
    /**
     * Calculates service provider score based on priority map and health information
     * @param health Service provider health information
     * @param priorityMap Priority map
     * @param retryCount Number of retries
     * @returns Score
     */
    public static calculateScore(
        health: ProviderHealth,
        priorityMap: Record<string, number> = {},
        retryCount: number = 0
    ): number {
        let score = 0;
        
        // Priority (0-100)
        const priority = priorityMap[health.name] || 0;
        score += priority * 100;
        
        // Success rate (0-50)
        const successRate = health.successRate || 1.0;
        score += successRate * 50;
        
        // Latency (0-30, inverse)
        const latency = health.averageLatency || 0;
        if (latency > 0) {
            // Lower latency = better score
            const latencyScore = Math.max(0, 30 - (latency / 100));
            score += latencyScore;
        } else {
            score += 30; // Default value if latency is not available
        }
        
        // If retries have been made, reduce score based on recent requests
        if (retryCount > 0) {
            const recentRequests = health.recentRequests || 0;
            const requestPenalty = Math.min(20, recentRequests / 5);
            score -= requestPenalty;
        }
        
        return score;
    }
    
    /**
     * Ranks service providers by score
     * @param providers Service providers
     * @param priorityMap Priority map
     * @param retryCount Number of retries
     * @returns Ranked service providers
     */
    public static rankProviders(
        providers: ProviderHealth[],
        priorityMap: Record<string, number> = {},
        retryCount: number = 0
    ): ProviderHealth[] {
        return [...providers].sort((a, b) => {
            const scoreA = this.calculateScore(a, priorityMap, retryCount);
            const scoreB = this.calculateScore(b, priorityMap, retryCount);
            return scoreB - scoreA; // Higher scores first
        });
    }
}
