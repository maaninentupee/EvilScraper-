#!/bin/bash

# Script for running E2E tests
# This script starts the server, runs E2E tests, and shuts down the server

echo "Starting server for tests..."
# Start the server in the background and save the process ID
npm run dev > /dev/null 2>&1 &
SERVER_PID=$!

# Wait for the server to start
echo "Waiting for the server to start..."
sleep 5

# Check that the server is responding
if curl -s http://localhost:3001/ > /dev/null; then
  echo "Server started successfully."
  
  # Run E2E tests
  echo "Running E2E tests..."
  npm run test:e2e
  TEST_EXIT_CODE=$?
  
  # Shut down the server
  echo "Shutting down the server..."
  kill $SERVER_PID
  
  # Wait for the server to shut down
  sleep 2
  
  echo "E2E tests completed."
  exit $TEST_EXIT_CODE
else
  echo "Server did not start successfully."
  kill $SERVER_PID
  exit 1
fi
