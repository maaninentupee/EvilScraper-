#!/bin/bash

# Windsurf Load Testing Script
# This script performs load testing on various endpoints of the Windsurf application

# Default values
HOST="localhost"
PORT="3000"
REQUESTS=100
CONCURRENCY=10
ENDPOINTS=("/scraper" "/evil-bot/decide" "/")

# Parse command line arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    -h|--host)
      HOST="$2"
      shift 2
      ;;
    -p|--port)
      PORT="$2"
      shift 2
      ;;
    -n|--requests)
      REQUESTS="$2"
      shift 2
      ;;
    -c|--concurrency)
      CONCURRENCY="$2"
      shift 2
      ;;
    -e|--endpoints)
      IFS=',' read -ra ENDPOINTS <<< "$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Check if ab is installed
if ! command -v ab &> /dev/null; then
  echo "Apache Benchmark (ab) is not installed. Please install it first."
  exit 1
fi

# Function to run load test on an endpoint
run_load_test() {
  local endpoint=$1
  local url="http://${HOST}:${PORT}${endpoint}"
  
  echo "========================================================"
  echo "Running load test on: $url"
  echo "Requests: $REQUESTS, Concurrency: $CONCURRENCY"
  echo "========================================================"
  
  # Run Apache Benchmark
  ab -n $REQUESTS -c $CONCURRENCY $url
  
  echo ""
}

# Check if the server is running
if ! curl -s "http://${HOST}:${PORT}/" > /dev/null; then
  echo "Error: Server is not running at http://${HOST}:${PORT}/"
  echo "Please start the server before running the load test."
  exit 1
fi

# Run load tests on all endpoints
for endpoint in "${ENDPOINTS[@]}"; do
  run_load_test "$endpoint"
done

echo "Load testing completed!"
