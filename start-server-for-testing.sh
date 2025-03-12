#!/bin/bash

# Windsurf-projektin palvelimen käynnistysskripti kuormitustestausta varten
echo "🚀 Käynnistetään Windsurf-palvelin kuormitustestausta varten..."

# Varmista, että olemme oikeassa hakemistossa
cd "$(dirname "$0")"

# Tarkista onko sovellus jo käännetty
if [ ! -d "dist" ]; then
  echo "📦 Käännetään sovellus..."
  npm run build
fi

# Tarkista onko palvelin jo käynnissä
if curl -s http://localhost:3001/ > /dev/null 2>&1; then
  echo "✅ Palvelin on jo käynnissä osoitteessa http://localhost:3001"
else
  echo "🔄 Käynnistetään palvelin..."
  
  # Käynnistä palvelin taustalle
  npm start &
  
  # Tallenna prosessin ID
  SERVER_PID=$!
  
  # Odota palvelimen käynnistymistä
  echo "⏳ Odotetaan palvelimen käynnistymistä..."
  
  # Yritä 30 sekunnin ajan
  for i in {1..30}; do
    if curl -s http://localhost:3001/ > /dev/null 2>&1; then
      echo "✅ Palvelin käynnistyi onnistuneesti osoitteessa http://localhost:3001"
      echo "📝 Palvelimen prosessi-ID: $SERVER_PID"
      echo ""
      echo "🧪 Voit nyt suorittaa kuormitustestejä:"
      echo "   ./load-test.sh"
      echo "   node autocannon-load-test.js"
      echo "   k6 run load-test.js"
      echo ""
      echo "🛑 Pysäyttääksesi palvelimen, suorita:"
      echo "   kill $SERVER_PID"
      exit 0
    fi
    
    echo -n "."
    sleep 1
  done
  
  echo ""
  echo "❌ Palvelimen käynnistys epäonnistui 30 sekunnin kuluessa."
  echo "📋 Tarkista virheloki:"
  echo "   npm start"
  
  # Lopeta taustaprosessi, jos se on vielä käynnissä
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
