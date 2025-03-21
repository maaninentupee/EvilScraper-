#!/bin/bash
# Windsurf API Test Script using curl
# Run this script from terminal: bash curl-api-tests.sh

BASE_URL="http://localhost:3001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Windsurf API Test Script ===${NC}"
echo "Testing API functionality and error handling"
echo

# First check if the server is running
echo -e "${YELLOW}Checking API status...${NC}"
if curl -s "$BASE_URL" > /dev/null; then
  echo -e "${GREEN}API is running at $BASE_URL${NC}"
else
  echo -e "${RED}API is not responding at $BASE_URL${NC}"
  echo "Make sure the application is running: npm start"
  exit 1
fi

echo

# Function to make API requests
run_test() {
  local description=$1
  local endpoint=$2
  local method=$3
  local payload=$4
  local expected_status=$5

  echo -e "${YELLOW}Testing: $description${NC}"
  echo "Endpoint: $endpoint, Method: $method"
  
  if [ -n "$payload" ]; then
    echo "Payload: $payload"
    status_code=$(curl -s -o /dev/null -w "%{http_code}" -X $method -H "Content-Type: application/json" -d "$payload" "$BASE_URL$endpoint")
  else
    status_code=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$endpoint")
  fi
  
  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}Success! Status: $status_code${NC}"
  else
    echo -e "${RED}Failed! Expected status: $expected_status, Received status: $status_code${NC}"
  fi
  
  echo "Complete response:"
  if [ -n "$payload" ]; then
    curl -s -X $method -H "Content-Type: application/json" -d "$payload" "$BASE_URL$endpoint" | json_pp
  else
    curl -s -X $method "$BASE_URL$endpoint" | json_pp
  fi
  
  echo -e "\n----------------------------------------\n"
}

# 1. Evil Bot API Tests
run_test "Evil Bot - Valid Decision" "/evil-bot/decide" "POST" '{
  "situation": "You need to choose between two job offers. One pays more but has a toxic work environment. The other pays less but has great culture.",
  "options": ["Take the high-paying job", "Take the job with better culture"]
}' "201"

run_test "Evil Bot - Invalid Request (Empty)" "/evil-bot/decide" "POST" '{
  "situation": "",
  "options": []
}' "400"

run_test "Evil Bot - Missing Fields" "/evil-bot/decide" "POST" '{
  "situation": "This is a test situation"
}' "400"

# 2. AI API Tests
run_test "AI - Generate Completion (Valid)" "/ai/complete" "POST" '{
  "prompt": "Write a short paragraph about artificial intelligence.",
  "modelType": "seo",
  "maxTokens": 100,
  "temperature": 0.7
}' "201"

run_test "AI - Process AI Request (Valid)" "/ai/process" "POST" '{
  "input": "Analyze this text for SEO optimization opportunities.",
  "taskType": "seo"
}' "201"

run_test "AI - Get Available Models" "/ai/models" "GET" "" "200"

# 3. Scraping API Tests
run_test "Scraping - Analyze SEO (Valid)" "/scraping/analyze-seo" "POST" '{
  "url": "https://example.com",
  "title": "Example Website",
  "description": "This is an example website for testing SEO analysis.",
  "keywords": ["example", "test", "seo"],
  "content": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."
}' "201"

run_test "Scraping - Analyze SEO (Invalid)" "/scraping/analyze-seo" "POST" '{
  "url": "https://example.com",
  "description": "Missing required fields"
}' "400"

# 4. Bot API Tests
run_test "Bot - Decide Next Action (Valid)" "/bot/decide" "POST" '{
  "message": "I need help with my homework."
}' "201"

run_test "Bot - Decide Next Action (Empty)" "/bot/decide" "POST" '{
  "message": ""
}' "400"

# 5. Error Simulation Tests
run_test "Error Simulation - Network Error" "/ai/complete" "POST" '{
  "prompt": "'"$(printf 'A%.0s' {1..5000})"'",
  "modelType": "seo",
  "maxTokens": 1000
}' "503"

run_test "Error Simulation - API Key Error" "/ai/complete" "POST" '{
  "prompt": "SIMULATE_API_KEY_ERROR",
  "modelType": "seo"
}' "503"

run_test "Error Simulation - Malformed Response" "/evil-bot/decide" "POST" '{
  "situation": "SIMULATE_MALFORMED_RESPONSE",
  "options": ["Option 1", "Option 2"]
}' "500"

echo -e "${GREEN}All tests completed!${NC}"
