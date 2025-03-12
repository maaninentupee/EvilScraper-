/**
 * Testi AIGatewayEnhancer-luokan toiminnalle
 * 
 * Tämä skripti testaa AIGatewayEnhancer-luokan toimintaa erilaisissa tilanteissa,
 * kuten palveluntarjoajien virhetilanteissa ja fallback-mekanismin toiminnassa.
 * 
 * Käyttö: node test/enhanced-fallback-test.js
 */

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const fs = require('fs');
const path = require('path');

// Testiasetukset
const TEST_ITERATIONS = 10;
const PROVIDERS = ['openai', 'anthropic', 'ollama'];
const ERROR_TYPES = ['timeout', 'rate_limit', 'invalid_request', 'all'];
const STRATEGIES = ['COST_OPTIMIZED', 'PRIORITY', 'PERFORMANCE', 'LOAD_BALANCED'];

// Testipromptit
const TEST_PROMPTS = [
  'Kerro minulle Suomen historiasta',
  'Miten tekoäly toimii?',
  'Kirjoita runo keväästä',
  'Selitä kvanttimekaniikan perusteet',
  'Mikä on ilmastonmuutos?'
];

// Testitulokset
const results = {
  total: 0,
  success: 0,
  fallback: 0,
  failed: 0,
  byProvider: {},
  byErrorType: {},
  byStrategy: {},
  averageResponseTime: 0,
  totalResponseTime: 0
};

// Alusta tulokset
PROVIDERS.forEach(provider => {
  results.byProvider[provider] = {
    total: 0,
    success: 0,
    fallback: 0,
    failed: 0
  };
});

ERROR_TYPES.forEach(errorType => {
  results.byErrorType[errorType] = {
    total: 0,
    success: 0,
    fallback: 0,
    failed: 0
  };
});

STRATEGIES.forEach(strategy => {
  results.byStrategy[strategy] = {
    total: 0,
    success: 0,
    fallback: 0,
    failed: 0
  };
});

// Suorita testit
async function runTests() {
  console.log('Käynnistetään AIGatewayEnhancer-testit...');
  
  try {
    // Käynnistä NestJS-sovellus
    const app = await NestFactory.createApplicationContext(AppModule);
  
    // Haetaan tarvittavat palvelut
    const { AIGatewayEnhancer } = require('../dist/services/AIGatewayEnhancer');
    const { ProviderHealthMonitor } = require('../dist/services/ProviderHealthMonitor');
    
    const aiGatewayEnhancer = app.get(AIGatewayEnhancer);
    const providerHealthMonitor = app.get(ProviderHealthMonitor);
  
    console.log('Palvelut alustettu, aloitetaan testit');
  
    // Nollataan terveystiedot ennen testejä
    providerHealthMonitor.resetStats();
  
    // Suoritetaan testit eri asetuksilla
    for (const strategy of STRATEGIES) {
      for (const errorType of ERROR_TYPES) {
        for (let i = 0; i < TEST_ITERATIONS; i++) {
          const prompt = TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)];
          
          try {
            console.log(`Suoritetaan testi: strategia=${strategy}, virhetyyppi=${errorType}, iteraatio=${i+1}`);
            
            const startTime = Date.now();
            
            // Suorita testi
            const result = await aiGatewayEnhancer.processWithSmartFallback('text-generation', prompt, {
              strategy: strategy,
              testMode: true,
              testErrorType: errorType
            });
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            // Päivitä tulokset
            results.total++;
            results.byStrategy[strategy].total++;
            results.byErrorType[errorType].total++;
            
            if (result.success) {
              results.success++;
              results.byStrategy[strategy].success++;
              results.byErrorType[errorType].success++;
              
              if (result.usedFallback) {
                results.fallback++;
                results.byStrategy[strategy].fallback++;
                results.byErrorType[errorType].fallback++;
                
                if (result.provider) {
                  results.byProvider[result.provider].total++;
                  results.byProvider[result.provider].fallback++;
                }
              } else if (result.provider) {
                results.byProvider[result.provider].total++;
                results.byProvider[result.provider].success++;
              }
            } else {
              results.failed++;
              results.byStrategy[strategy].failed++;
              results.byErrorType[errorType].failed++;
            }
            
            results.totalResponseTime += responseTime;
            
            console.log(`Testi valmis: onnistui=${result.success}, käytti fallbackia=${result.usedFallback || false}, palveluntarjoaja=${result.provider || 'ei tiedossa'}, vastausaika=${responseTime}ms`);
            
          } catch (error) {
            console.error(`Virhe testin suorituksessa: ${error.message}`);
            results.total++;
            results.failed++;
            results.byStrategy[strategy].total++;
            results.byStrategy[strategy].failed++;
            results.byErrorType[errorType].total++;
            results.byErrorType[errorType].failed++;
          }
        }
      }
    }
    
    // Laske keskimääräinen vastausaika
    results.averageResponseTime = results.totalResponseTime / results.total;
    
    // Tallenna tulokset
    const resultsPath = path.join(__dirname, 'results', 'enhanced-fallback-results.json');
    
    // Varmista, että hakemisto on olemassa
    const resultsDir = path.dirname(resultsPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    console.log('Testit suoritettu onnistuneesti!');
    console.log(`Tulokset tallennettu: ${resultsPath}`);
    console.log(`Yhteenveto: yhteensä=${results.total}, onnistuneet=${results.success}, fallback=${results.fallback}, epäonnistuneet=${results.failed}, keskimääräinen vastausaika=${results.averageResponseTime.toFixed(2)}ms`);
    
    // Sulje sovellus
    await app.close();
    
  } catch (error) {
    console.error(`Virhe testien suorituksessa: ${error}`);
  }
}

// Käynnistä testit
runTests();
