import { ProviderHealth } from '../ProviderHealthMonitor';

/**
 * Apuluokka palveluntarjoajien pisteyttämiseen
 */
export class ProviderScoreUtils {
    /**
     * Laskee palveluntarjoajan pisteet prioriteettikartan ja terveystietojen perusteella
     * @param health Palveluntarjoajan terveystiedot
     * @param priorityMap Prioriteettikartta
     * @param retryCount Uudelleenyrityskertojen määrä
     * @returns Pisteet
     */
    public static calculateScore(
        health: ProviderHealth,
        priorityMap: Record<string, number> = {},
        retryCount: number = 0
    ): number {
        let score = 0;
        
        // Prioriteetti (0-100)
        const priority = priorityMap[health.name] || 0;
        score += priority * 100;
        
        // Onnistumisprosentti (0-50)
        const successRate = health.successRate || 1.0;
        score += successRate * 50;
        
        // Vasteaika (0-30, käänteinen)
        const latency = health.averageLatency || 0;
        if (latency > 0) {
            // Pienempi vasteaika = parempi pisteet
            const latencyScore = Math.max(0, 30 - (latency / 100));
            score += latencyScore;
        } else {
            score += 30; // Oletusarvo jos vasteaikaa ei ole
        }
        
        // Jos uudelleenyrityksiä on tehty, vähennetään pisteitä viimeaikaisten pyyntöjen perusteella
        if (retryCount > 0) {
            const recentRequests = health.recentRequests || 0;
            const requestPenalty = Math.min(20, recentRequests / 5);
            score -= requestPenalty;
        }
        
        return score;
    }
    
    /**
     * Järjestää palveluntarjoajat pisteiden mukaan
     * @param providers Palveluntarjoajat
     * @param priorityMap Prioriteettikartta
     * @param retryCount Uudelleenyrityskertojen määrä
     * @returns Järjestetty lista palveluntarjoajista
     */
    public static rankProviders(
        providers: ProviderHealth[],
        priorityMap: Record<string, number> = {},
        retryCount: number = 0
    ): ProviderHealth[] {
        return [...providers].sort((a, b) => {
            const scoreA = this.calculateScore(a, priorityMap, retryCount);
            const scoreB = this.calculateScore(b, priorityMap, retryCount);
            return scoreB - scoreA; // Suuremmat pisteet ensin
        });
    }
}
