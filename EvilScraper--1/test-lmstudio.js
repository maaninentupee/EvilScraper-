/**
 * LM Studio and Ollama API testing tool
 * 
 * Used for testing and troubleshooting local AI service providers
 */

const axios = require('axios');

// Configuration
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
    timeout: 120000, // Longer timeout for Ollama
    timeoutOptions: [10000, 30000, 60000, 120000] // Multiple timeout options for testing
  }
};

/**
 * Test connection to service
 */
async function testConnection(provider) {
  const { url, models, timeout } = config[provider];
  
  console.log(`\n🧪 Testing connection: ${provider.toUpperCase()} API (${url}${models})`);
  try {
    const response = await axios.get(`${url}${models}`, { timeout });
    console.log(`✅ Connection successful! Status: ${response.status}`);
    console.log(`📋 Available models:`);
    
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
    console.log(`❌ Connection failed: ${error.message}`);
    if (error.code) {
      console.log(`   Error code: ${error.code}`);
    }
    return null;
  }
}

/**
 * Test text generation
 */
async function testCompletion(provider, modelName) {
  const { url, completions, timeout } = config[provider];
  
  console.log(`\n🧪 Testing text generation: ${provider.toUpperCase()}, model: ${modelName}`);
  
  try {
    const startTime = Date.now();
    let response;
    
    if (provider === 'lmstudio') {
      response = await axios.post(
        `${url}${completions}`, 
        {
          model: modelName,
          prompt: "Briefly explain AI models",
          max_tokens: 50,
          temperature: 0.7
        },
        { timeout }
      );
      
      const text = response.data?.choices?.[0]?.text || '';
      const duration = Date.now() - startTime;
      
      console.log(`✅ Generation successful (${duration}ms)`);
      console.log(`📝 Generated text:\n${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
    } else if (provider === 'ollama') {
      response = await axios.post(
        `${url}${completions}`, 
        {
          model: modelName,
          prompt: "Briefly explain AI models",
          stream: false
        },
        { timeout }
      );
      
      const text = response.data?.response || '';
      const duration = Date.now() - startTime;
      
      console.log(`✅ Generation successful (${duration}ms)`);
      console.log(`📝 Generated text:\n${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Generation failed: ${error.message}`);
    if (error.code) {
      console.log(`   Error code: ${error.code}`);
    }
    if (error.response) {
      console.log(`   API response: ${error.response.status} ${error.response.statusText}`);
    }
    return false;
  }
}

/**
 * Test Ollama timeout values
 */
async function testOllamaTimeouts(modelName) {
  if (!modelName) {
    console.log(`\n⏭️ Skipping Ollama timeout tests because no model was found`);
    return;
  }
  
  console.log(`\n🧪 Testing Ollama with different timeout values:`);
  
  for (const timeout of config.ollama.timeoutOptions) {
    console.log(`\n⏱️ Testing timeout: ${timeout}ms`);
    
    try {
      const startTime = Date.now();
      const response = await axios.post(
        `${config.ollama.url}${config.ollama.completions}`, 
        {
          model: modelName,
          prompt: "Briefly explain AI models",
          stream: false
        },
        { timeout }
      );
      
      const duration = Date.now() - startTime;
      console.log(`✅ Generation successful (${duration}ms)`);
      console.log(`📝 Words in response: ${(response.data?.response || '').split(' ').length}`);
      
      // If we got a response, stop testing
      break;
    } catch (error) {
      console.log(`❌ Timeout ${timeout}ms failed: ${error.message}`);
      if (error.code) {
        console.log(`   Error code: ${error.code}`);
      }
    }
  }
}

/**
 * Run tests
 */
async function runTests() {
  console.log("🔍 AI service provider diagnostic tool");
  
  // Test LM Studio
  const lmStudioModelName = await testConnection('lmstudio');
  if (lmStudioModelName) {
    await testCompletion('lmstudio', lmStudioModelName);
  }
  
  // Test Ollama
  const ollamaModelName = await testConnection('ollama');
  if (ollamaModelName) {
    await testCompletion('ollama', ollamaModelName);
    
    // Test different timeout values
    await testOllamaTimeouts(ollamaModelName);
  }
  
  console.log("\n🏁 Tests completed!");
}

// Run tests
runTests().catch(console.error);
