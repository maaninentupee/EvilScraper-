#!/bin/bash

# Skripti verkkoviiveiden ja aikakatkojen testaamiseen
# Tämä skripti käynnistää testipalvelimen ja testaa erilaisia verkkoviiveitä ja aikakatkoja

echo "=== Verkkoviiveiden ja aikakatkojen testaus ==="

# Varmista, että lokihakemisto on olemassa
mkdir -p logs

# Suorita verkkoviiveiden testit
echo "Suoritetaan verkkoviiveiden testit..."
npm run test:network-delay | tee logs/network-delay-$(date +%Y%m%d-%H%M%S).log

echo "Testit suoritettu. Katso tulokset logs-hakemistosta."

# Testaa API-kutsut eri aikakatkaisuilla
echo "Testataan API-kutsuja eri aikakatkaisuilla..."

# Funktio API-kutsun testaamiseen tietyllä aikakatkaisulla
test_api_timeout() {
  local endpoint=$1
  local timeout=$2
  echo "Testataan endpointia $endpoint aikakatkaisulla ${timeout}ms..."
  
  curl -s -X POST -H "Content-Type: application/json" \
    -d '{"prompt":"Test prompt with timeout","maxTokens":50}' \
    --max-time $(echo "scale=1; $timeout/1000" | bc) \
    http://localhost:3001/$endpoint || echo " -> Aikakatkaistu asianmukaisesti"
  
  echo ""
}

# Testaa eri endpointit eri aikakatkaisuilla
if curl -s http://localhost:3001/ > /dev/null; then
  echo "Palvelin on käynnissä, testataan API-kutsuja..."
  
  # Testaa peruspäätepisteen aikakatkaisua
  test_api_timeout "ai/generate" 1000  # 1s timeout (todennäköisesti aikakatkaisu)
  test_api_timeout "ai/generate" 5000  # 5s timeout
  
  # Testaa AI-palveluntarjoajien aikakatkaisua
  test_api_timeout "ai/openai" 2000    # 2s timeout
  test_api_timeout "ai/anthropic" 2000 # 2s timeout
  test_api_timeout "ai/ollama" 3000    # 3s timeout
  
  echo "API-testit suoritettu."
else
  echo "Palvelin ei ole käynnissä. Käynnistä palvelin komennolla 'npm run dev' ja aja tämä skripti uudelleen."
fi

echo "=== Verkkoviiveiden ja aikakatkojen testaus valmis ==="
