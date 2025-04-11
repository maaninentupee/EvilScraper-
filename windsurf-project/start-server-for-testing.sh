#!/bin/bash

# Windsurf project server startup script for load testing
echo "🚀 Starting Windsurf server for load testing..."

# Make sure we're in the correct directory
cd "$(dirname "$0")"

# Check if the application is already compiled
if [ ! -d "dist" ]; then
  echo "📦 Building the application..."
  npm run build
fi

# Check if the server is already running
if curl -s http://localhost:3001/ > /dev/null 2>&1; then
  echo "✅ Server is already running at http://localhost:3001"
else
  echo "🔄 Starting the server..."
  
  # Start the server in the background
  npm start &
  
  # Save the process ID
  SERVER_PID=$!
  
  # Wait for the server to start
  echo "⏳ Waiting for the server to start..."
  
  # Try for 30 seconds
  for i in {1..30}; do
    if curl -s http://localhost:3001/ > /dev/null 2>&1; then
      echo "✅ Server started successfully at http://localhost:3001"
      echo "📝 Server process ID: $SERVER_PID"
      echo ""
      echo "🧪 You can now run load tests:"
      echo "   ./load-test.sh"
      echo "   node autocannon-load-test.js"
      echo "   k6 run load-test.js"
      echo ""
      echo "🛑 To stop the server, run:"
      echo "   kill $SERVER_PID"
      exit 0
    fi
    
    echo -n "."
    sleep 1
  done
  
  echo ""
  echo "❌ Server failed to start within 30 seconds."
  echo "📋 Check the error log:"
  echo "   npm start"
  
  # Stop the background process if it's still running
  kill $SERVER_PID 2>/dev/null
  exit 1
fi
