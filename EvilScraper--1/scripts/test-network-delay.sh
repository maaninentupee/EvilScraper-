#!/bin/bash

# Script for testing network delays and timeouts
# This script starts a test server and tests various network delays and timeouts

echo "=== Network Delay and Timeout Testing ==="

# Ensure that the log directory exists
mkdir -p logs

# Run network delay tests
echo "Running network delay tests..."
npm run test:network-delay | tee logs/network-delay-$(date +%Y%m%d-%H%M%S).log

echo "Tests completed. See results in the logs directory."

# Test API calls with different timeouts
echo "Testing API calls with different timeouts..."

# Function to test API call with a specific timeout
test_api_timeout() {
  local endpoint=$1
  local timeout=$2
  echo "Testing endpoint $endpoint with timeout ${timeout}ms..."
  
  curl -s -X POST -H "Content-Type: application/json" \
    -d '{"prompt":"Test prompt with timeout","maxTokens":50}' \
    --max-time $(echo "scale=1; $timeout/1000" | bc) \
    http://localhost:3001/$endpoint || echo " -> Timed out appropriately"
  
  echo ""
}

# Test different endpoints with different timeouts
if curl -s http://localhost:3001/ > /dev/null; then
  echo "Server is running, testing API calls..."
  
  # Test the main endpoint's timeout
  test_api_timeout "ai/generate" 1000  # 1s timeout (likely to timeout)
  test_api_timeout "ai/generate" 5000  # 5s timeout
  
  # Test AI service providers' timeouts
  test_api_timeout "ai/openai" 2000    # 2s timeout
  test_api_timeout "ai/anthropic" 2000 # 2s timeout
  test_api_timeout "ai/ollama" 3000    # 3s timeout
  
  echo "API tests completed."
else
  echo "Server is not running. Start the server with 'npm run dev' and run this script again."
fi

echo "=== Network Delay and Timeout Testing Complete ==="
