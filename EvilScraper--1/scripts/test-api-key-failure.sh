#!/bin/bash

# Script for testing API key failure scenarios
# This script sets an invalid OpenAI API key and runs tests

# Save the original API key if it exists
if [ -n "$OPENAI_API_KEY" ]; then
  ORIGINAL_OPENAI_API_KEY=$OPENAI_API_KEY
  echo "Saved original OpenAI API key"
fi

# Set an invalid API key
echo "Setting invalid OpenAI API key..."
export OPENAI_API_KEY="invalid_key_sk_test_12345"

# Ensure the key is set
echo "Using API key: $OPENAI_API_KEY"

# Run tests
echo "Running tests with invalid API key..."
npm run test

# Restore the original API key if it existed
if [ -n "$ORIGINAL_OPENAI_API_KEY" ]; then
  echo "Restoring original OpenAI API key..."
  export OPENAI_API_KEY=$ORIGINAL_OPENAI_API_KEY
else
  echo "Removing invalid OpenAI API key..."
  unset OPENAI_API_KEY
fi

echo "Test complete!"
