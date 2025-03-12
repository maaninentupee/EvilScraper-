/**
 * LM Studio ja Ollama API-testaustyökalu
 * 
 * Käytetään paikallisten AI-palveluntarjoajien toiminnan testaamiseen ja vianetsintään
 */

const axios = require('axios');

// Konfiguraatio
const config = {
  lmstudio: {
    url: 'http://localhost:1234',
    models: '/v1/models',
    completions: '/v1/completions',
    timeout: 60000
  },
  ollama: {
    url: 'http://localhost:11434',
    models: '/api/tags',
    completions: '/api/generate',
    timeout: 120000, // Pidempi timeout Ollamalle
    timeoutOptions: [10000, 30000, 60000, 120000] // Useita timeout-vaihtoehtoja testausta varten
  }
};

/**
 * Testaa yhteys palveluun
 */
async function testConnection(provider) {
  const { url, models, timeout } = config[provider];
  
  console.log(`\n🧪 Testataan yhteyttä: ${provider.toUpperCase()} API (${url}${models})`);
  try {
    const response = await axios.get(`${url}${models}`, { timeout });
    console.log(`✅ Yhteys onnistui! Status: ${response.status}`);
    console.log(`📋 Saatavilla olevat mallit:`);
    
    if (provider === 'lmstudio') {
      const modelList = response.data?.data || [];
      modelList.forEach(model => console.log(` - ${model.id}`));
      return modelList.length > 0 ? modelList[0].id : null;
    } else if (provider === 'ollama') {
      const modelList = response.data?.models || [];
      modelList.forEach(model => console.log(` - ${model.name}`));
      return modelList.length > 0 ? modelList[0].name : null;
    }
    
    return null;
  } catch (error) {
    console.log(`❌ Yhteys epäonnistui: ${error.message}`);
    if (error.code) {
      console.log(`   Virhekoodi: ${error.code}`);
    }
    return null;
  }
}

/**
 * Testaa tekstin generointi
 */
async function testCompletion(provider, modelName) {
  const { url, completions, timeout } = config[provider];
  
  console.log(`\n🧪 Testataan tekstin generointia: ${provider.toUpperCase()}, malli: ${modelName}`);
  
  try {
    const startTime = Date.now();
    let response;
    
    if (provider === 'lmstudio') {
      response = await axios.post(
        `${url}${completions}`, 
        {
          model: modelName,
          prompt: "Kerro lyhyesti tekoälymalleista",
          max_tokens: 50,
          temperature: 0.7
        },
        { timeout }
      );
      
      const text = response.data?.choices?.[0]?.text || '';
      const duration = Date.now() - startTime;
      
      console.log(`✅ Generointi onnistui (${duration}ms)`);
      console.log(`📝 Generoitu teksti:\n${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
    } else if (provider === 'ollama') {
      response = await axios.post(
        `${url}${completions}`, 
        {
          model: modelName,
          prompt: "Kerro lyhyesti tekoälymalleista",
          stream: false
        },
        { timeout }
      );
      
      const text = response.data?.response || '';
      const duration = Date.now() - startTime;
      
      console.log(`✅ Generointi onnistui (${duration}ms)`);
      console.log(`📝 Generoitu teksti:\n${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Generointi epäonnistui: ${error.message}`);
    if (error.code) {
      console.log(`   Virhekoodi: ${error.code}`);
    }
    if (error.response) {
      console.log(`   API vastaus: ${error.response.status} ${error.response.statusText}`);
    }
    return false;
  }
}

/**
 * Testaa Ollama timeout-arvoja
 */
async function testOllamaTimeouts(modelName) {
  if (!modelName) {
    console.log(`\n⏭️ Ohitetaan Ollama timeout-testit, koska mallia ei löytynyt`);
    return;
  }
  
  console.log(`\n🧪 Testataan Ollama eri timeout-arvoilla:`);
  
  for (const timeout of config.ollama.timeoutOptions) {
    console.log(`\n⏱️ Testataan timeout: ${timeout}ms`);
    
    try {
      const startTime = Date.now();
      const response = await axios.post(
        `${config.ollama.url}${config.ollama.completions}`, 
        {
          model: modelName,
          prompt: "Kerro lyhyesti tekoälymalleista",
          stream: false
        },
        { timeout }
      );
      
      const duration = Date.now() - startTime;
      console.log(`✅ Generointi onnistui (${duration}ms)`);
      console.log(`📝 Vastauksen sanat: ${(response.data?.response || '').split(' ').length}`);
      
      // Jos saimme vastauksen, lopetetaan testaus
      break;
    } catch (error) {
      console.log(`❌ Timeout ${timeout}ms epäonnistui: ${error.message}`);
      if (error.code) {
        console.log(`   Virhekoodi: ${error.code}`);
      }
    }
  }
}

/**
 * Suorita testit
 */
async function runTests() {
  console.log("🔍 AI-palveluntarjoajien diagnostiikkatyökalu");
  
  // Testaa LM Studio
  const lmStudioModelName = await testConnection('lmstudio');
  if (lmStudioModelName) {
    await testCompletion('lmstudio', lmStudioModelName);
  }
  
  // Testaa Ollama
  const ollamaModelName = await testConnection('ollama');
  if (ollamaModelName) {
    await testCompletion('ollama', ollamaModelName);
    
    // Testaa eri timeout-arvoja
    await testOllamaTimeouts(ollamaModelName);
  }
  
  console.log("\n🏁 Testit suoritettu!");
}

// Suorita testit
runTests().catch(console.error);
