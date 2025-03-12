/**
 * Testi AIControllerEnhanced-luokan toiminnalle
 * 
 * Tämä skripti testaa AIControllerEnhanced-luokan toimintaa erilaisissa tilanteissa,
 * kuten yksittäisten pyyntöjen ja eräkäsittelyn toiminnassa.
 * 
 * Käyttö: node test/enhanced-controller-test.js
 */

const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Testiasetukset
const TEST_ITERATIONS = 5;
const STRATEGIES = ['performance', 'cost', 'quality', 'fallback'];
const ERROR_TYPES = [null, 'timeout', 'rate_limit', 'invalid_request'];
const BATCH_SIZES = [2, 5];

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
  singleRequests: {
    total: 0,
    success: 0,
    failed: 0,
    byStrategy: {},
    byErrorType: {},
    averageResponseTime: 0,
    totalResponseTime: 0
  },
  batchRequests: {
    total: 0,
    success: 0,
    failed: 0,
    byStrategy: {},
    byBatchSize: {},
    averageResponseTime: 0,
    totalResponseTime: 0
  }
};

// Alusta tulokset
STRATEGIES.forEach(strategy => {
  results.singleRequests.byStrategy[strategy] = {
    total: 0,
    success: 0,
    failed: 0
  };
  results.batchRequests.byStrategy[strategy] = {
    total: 0,
    success: 0,
    failed: 0
  };
});

ERROR_TYPES.forEach(errorType => {
  if (errorType) {
    results.singleRequests.byErrorType[errorType] = {
      total: 0,
      success: 0,
      failed: 0
    };
  }
});

BATCH_SIZES.forEach(size => {
  results.batchRequests.byBatchSize[size] = {
    total: 0,
    success: 0,
    failed: 0
  };
});

// Suorita testit
async function runTests() {
  console.log('Käynnistetään AIControllerEnhanced-testit...');
  
  try {
    // Käynnistä NestJS-sovellus
    const app = await NestFactory.create(AppModule);
    await app.listen(3000);
    
    console.log('Sovellus käynnistetty portissa 3000, aloitetaan testit');
    
    // Testaa yksittäiset pyynnöt
    await testSingleRequests();
    
    // Testaa eräkäsittely
    await testBatchRequests();
    
    // Tallenna tulokset
    const resultsPath = path.join(__dirname, 'results', 'enhanced-controller-results.json');
    
    // Varmista, että hakemisto on olemassa
    const resultsDir = path.dirname(resultsPath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
    
    console.log('Testit suoritettu onnistuneesti!');
    console.log(`Tulokset tallennettu: ${resultsPath}`);
    console.log(`Yhteenveto yksittäisistä pyynnöistä: yhteensä=${results.singleRequests.total}, onnistuneet=${results.singleRequests.success}, epäonnistuneet=${results.singleRequests.failed}, keskimääräinen vastausaika=${results.singleRequests.averageResponseTime.toFixed(2)}ms`);
    console.log(`Yhteenveto eräkäsittelystä: yhteensä=${results.batchRequests.total}, onnistuneet=${results.batchRequests.success}, epäonnistuneet=${results.batchRequests.failed}, keskimääräinen vastausaika=${results.batchRequests.averageResponseTime.toFixed(2)}ms`);
    
    // Sulje sovellus
    await app.close();
    
  } catch (error) {
    console.error(`Virhe testien suorituksessa: ${error}`);
  }
}

// Testaa yksittäiset pyynnöt
async function testSingleRequests() {
  console.log('Testataan yksittäisiä pyyntöjä...');
  
  for (const strategy of STRATEGIES) {
    for (const errorType of ERROR_TYPES) {
      for (let i = 0; i < TEST_ITERATIONS; i++) {
        const prompt = TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)];
        
        try {
          console.log(`Suoritetaan yksittäinen testi: strategia=${strategy}, virhetyyppi=${errorType || 'ei virhettä'}, iteraatio=${i+1}`);
          
          const startTime = Date.now();
          
          // Suorita testi
          const response = await axios.post('http://localhost:3000/ai-enhanced/process', {
            input: prompt,
            taskType: 'text-generation',
            strategy,
            cacheResults: true,
            testMode: errorType !== null,
            testError: errorType
          });
          
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          // Päivitä tulokset
          results.singleRequests.total++;
          results.singleRequests.byStrategy[strategy].total++;
          
          if (errorType) {
            results.singleRequests.byErrorType[errorType].total++;
          }
          
          if (response.data && response.data.success) {
            results.singleRequests.success++;
            results.singleRequests.byStrategy[strategy].success++;
            
            if (errorType) {
              results.singleRequests.byErrorType[errorType].success++;
            }
          } else {
            results.singleRequests.failed++;
            results.singleRequests.byStrategy[strategy].failed++;
            
            if (errorType) {
              results.singleRequests.byErrorType[errorType].failed++;
            }
          }
          
          results.singleRequests.totalResponseTime += responseTime;
          
          console.log(`Yksittäinen testi valmis: onnistui=${response.data && response.data.success}, vastausaika=${responseTime}ms`);
          
        } catch (error) {
          console.error(`Virhe yksittäisen testin suorituksessa: ${error.message}`);
          results.singleRequests.total++;
          results.singleRequests.failed++;
          results.singleRequests.byStrategy[strategy].total++;
          results.singleRequests.byStrategy[strategy].failed++;
          
          if (errorType) {
            results.singleRequests.byErrorType[errorType].total++;
            results.singleRequests.byErrorType[errorType].failed++;
          }
        }
      }
    }
  }
  
  // Laske keskimääräinen vastausaika
  if (results.singleRequests.total > 0) {
    results.singleRequests.averageResponseTime = results.singleRequests.totalResponseTime / results.singleRequests.total;
  }
  
  console.log('Yksittäisten pyyntöjen testit suoritettu');
}

// Testaa eräkäsittely
async function testBatchRequests() {
  console.log('Testataan eräkäsittelyä...');
  
  for (const strategy of STRATEGIES) {
    for (const batchSize of BATCH_SIZES) {
      for (let i = 0; i < TEST_ITERATIONS; i++) {
        const inputs = [];
        
        // Luo satunnaisia prompteja
        for (let j = 0; j < batchSize; j++) {
          inputs.push(TEST_PROMPTS[Math.floor(Math.random() * TEST_PROMPTS.length)]);
        }
        
        try {
          console.log(`Suoritetaan eräkäsittelytesti: strategia=${strategy}, eräkoko=${batchSize}, iteraatio=${i+1}`);
          
          const startTime = Date.now();
          
          // Suorita testi
          const response = await axios.post('http://localhost:3000/ai-enhanced/process-batch', {
            inputs,
            taskType: 'text-generation',
            strategy,
            cacheResults: true
          });
          
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          // Päivitä tulokset
          results.batchRequests.total++;
          results.batchRequests.byStrategy[strategy].total++;
          results.batchRequests.byBatchSize[batchSize].total++;
          
          if (response.data && Array.isArray(response.data) && response.data.every(item => item.success)) {
            results.batchRequests.success++;
            results.batchRequests.byStrategy[strategy].success++;
            results.batchRequests.byBatchSize[batchSize].success++;
          } else {
            results.batchRequests.failed++;
            results.batchRequests.byStrategy[strategy].failed++;
            results.batchRequests.byBatchSize[batchSize].failed++;
          }
          
          results.batchRequests.totalResponseTime += responseTime;
          
          console.log(`Eräkäsittelytesti valmis: onnistui=${response.data && Array.isArray(response.data) && response.data.every(item => item.success)}, vastausaika=${responseTime}ms`);
          
        } catch (error) {
          console.error(`Virhe eräkäsittelytestin suorituksessa: ${error.message}`);
          results.batchRequests.total++;
          results.batchRequests.failed++;
          results.batchRequests.byStrategy[strategy].total++;
          results.batchRequests.byStrategy[strategy].failed++;
          results.batchRequests.byBatchSize[batchSize].total++;
          results.batchRequests.byBatchSize[batchSize].failed++;
        }
      }
    }
  }
  
  // Laske keskimääräinen vastausaika
  if (results.batchRequests.total > 0) {
    results.batchRequests.averageResponseTime = results.batchRequests.totalResponseTime / results.batchRequests.total;
  }
  
  console.log('Eräkäsittelyn testit suoritettu');
}

// Käynnistä testit
runTests();
