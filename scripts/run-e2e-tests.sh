#!/bin/bash

# Skripti E2E-testien ajamiseen
# Tämä skripti käynnistää palvelimen, ajaa E2E-testit ja sammuttaa palvelimen

echo "Käynnistetään palvelin testejä varten..."
# Käynnistetään palvelin taustalle ja tallennetaan prosessin ID
npm run dev > /dev/null 2>&1 &
SERVER_PID=$!

# Odotetaan, että palvelin käynnistyy
echo "Odotetaan, että palvelin käynnistyy..."
sleep 5

# Tarkistetaan, että palvelin vastaa
if curl -s http://localhost:3001/ > /dev/null; then
  echo "Palvelin käynnistyi onnistuneesti."
  
  # Ajetaan E2E-testit
  echo "Ajetaan E2E-testit..."
  npm run test:e2e
  TEST_EXIT_CODE=$?
  
  # Sammutetaan palvelin
  echo "Sammutetaan palvelin..."
  kill $SERVER_PID
  
  # Odotetaan, että palvelin sammuu
  sleep 2
  
  echo "E2E-testit suoritettu."
  exit $TEST_EXIT_CODE
else
  echo "Palvelin ei käynnistynyt onnistuneesti."
  kill $SERVER_PID
  exit 1
fi
