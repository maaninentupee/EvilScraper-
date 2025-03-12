#!/bin/bash

# Skripti API-avaimen virhetilanteen testaamiseen
# Tämä skripti asettaa virheellisen OpenAI API-avaimen ja ajaa testit

# Tallenna alkuperäinen API-avain, jos sellainen on
if [ -n "$OPENAI_API_KEY" ]; then
  ORIGINAL_OPENAI_API_KEY=$OPENAI_API_KEY
  echo "Tallennettu alkuperäinen OpenAI API-avain"
fi

# Aseta virheellinen API-avain
echo "Asetetaan virheellinen OpenAI API-avain..."
export OPENAI_API_KEY="invalid_key_sk_test_12345"

# Varmista, että avain on asetettu
echo "Käytetään API-avainta: $OPENAI_API_KEY"

# Aja testit
echo "Ajetaan testit virheellisellä API-avaimella..."
npm run test

# Palauta alkuperäinen API-avain, jos sellainen oli
if [ -n "$ORIGINAL_OPENAI_API_KEY" ]; then
  echo "Palautetaan alkuperäinen OpenAI API-avain..."
  export OPENAI_API_KEY=$ORIGINAL_OPENAI_API_KEY
else
  echo "Poistetaan virheellinen OpenAI API-avain..."
  unset OPENAI_API_KEY
fi

echo "Testi valmis!"
