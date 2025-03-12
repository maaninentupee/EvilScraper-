#!/bin/bash

# run-all-tests.sh - Comprehensive test runner for Windsurf Project
# This script runs all tests and provides a summary of results

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print section headers
print_header() {
    echo -e "\n${BLUE}=====================================================${NC}"
    echo -e "${BLUE}= $1${NC}"
    echo -e "${BLUE}=====================================================${NC}\n"
}

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ $2 PASSED${NC}"
    else
        echo -e "${RED}✗ $2 FAILED${NC}"
    fi
}

# Start time
START_TIME=$(date +%s)

# Results array
declare -A TEST_RESULTS

# Create results directory
RESULTS_DIR="test-results-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

# Start resource monitoring in background if Netdata is available
if brew services list | grep -q "netdata.*started"; then
    print_header "Starting Ollama resource monitoring with Netdata"
    npm run monitor:ollama:netdata > "$RESULTS_DIR/resource-monitoring.log" 2>&1 &
    MONITOR_PID=$!
    echo -e "${CYAN}Resource monitoring started (PID: $MONITOR_PID)${NC}"
    echo -e "${CYAN}View metrics at: http://localhost:19999${NC}"
    # Give it a moment to start
    sleep 2
else
    echo -e "${YELLOW}Netdata not running. Resource monitoring will not be available.${NC}"
    echo -e "${YELLOW}To enable, run: brew services start netdata${NC}"
fi

# Warm up Ollama models
print_header "Warming up Ollama models"
npm run warmup:ollama
WARMUP_STATUS=$?
TEST_RESULTS["Warmup"]=$WARMUP_STATUS
print_status $WARMUP_STATUS "Model warmup"

# Run unit tests
print_header "Running unit tests"
npm test > "$RESULTS_DIR/unit-tests.log" 2>&1
UNIT_STATUS=$?
TEST_RESULTS["Unit Tests"]=$UNIT_STATUS
print_status $UNIT_STATUS "Unit tests"

# Run E2E tests
print_header "Running E2E tests"
npm run test:e2e > "$RESULTS_DIR/e2e-tests.log" 2>&1
E2E_STATUS=$?
TEST_RESULTS["E2E Tests"]=$E2E_STATUS
print_status $E2E_STATUS "E2E tests"

# Run load tests
print_header "Running load tests"
npm run test:load > "$RESULTS_DIR/load-tests.log" 2>&1
LOAD_STATUS=$?
TEST_RESULTS["Load Tests"]=$LOAD_STATUS
print_status $LOAD_STATUS "Load tests"

# Stop resource monitoring if it was started
if [ ! -z "$MONITOR_PID" ]; then
    kill $MONITOR_PID
    echo -e "${CYAN}Resource monitoring stopped${NC}"
fi

# End time and calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

# Print summary
print_header "Test Summary"
echo -e "${CYAN}Test execution completed in ${MINUTES}m ${SECONDS}s${NC}"
echo -e "${CYAN}Results saved to: ${RESULTS_DIR}${NC}\n"

# Print results table
echo -e "${PURPLE}Test Results:${NC}"
echo -e "${PURPLE}------------${NC}"
for test in "Warmup" "Unit Tests" "E2E Tests" "Load Tests"; do
    status=${TEST_RESULTS[$test]}
    if [ "$status" == "0" ]; then
        echo -e "${GREEN}✓ $test${NC}"
    else
        echo -e "${RED}✗ $test${NC}"
    fi
done

# Overall status
if [ ${TEST_RESULTS["Unit Tests"]} -eq 0 ] && [ ${TEST_RESULTS["E2E Tests"]} -eq 0 ] && [ ${TEST_RESULTS["Load Tests"]} -eq 0 ]; then
    echo -e "\n${GREEN}✓ ALL TESTS PASSED${NC}"
    exit 0
else
    echo -e "\n${RED}✗ SOME TESTS FAILED${NC}"
    exit 1
fi
