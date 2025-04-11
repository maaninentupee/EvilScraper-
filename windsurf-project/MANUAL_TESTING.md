# Manual Testing

This document contains instructions for manual testing of the Windsurf project, especially for simulating error conditions.

## Testing Error Conditions

Testing the system's fault tolerance is an important part of quality assurance. Here are instructions for simulating various error conditions.

### API Key Error Condition

An OpenAI API key error condition can be simulated by setting an invalid API key:

```bash
# Manual method
export OPENAI_API_KEY=invalid_key
npm run test

# Or using the test script
./scripts/test-api-key-failure.sh
```

This test should demonstrate that:

1. The system recognizes an invalid API key
2. OpenAIProvider reports being unavailable (isAvailable returns false)
3. In case of an error, the system switches to using other available service providers
4. Errors are properly logged

### Testing Network Delays and Timeouts

Network delays and timeouts can be tested using a test script that simulates various network problems:

```bash
# Testing network delays
npm run test:network-delay

# Or using a more comprehensive test script
./scripts/test-network-delay.sh
```

This test simulates the following network problems:

1. Short delays (500ms)
2. Medium delays (2000ms)
3. Long delays (8000ms)
4. Timeouts (15000ms)
5. Connection interruptions
6. Invalid responses
7. Server errors

The tests demonstrate that the system:

1. Handles network delays appropriately
2. Identifies timeouts and reports them
3. Recovers from connection interruptions
4. Handles invalid responses correctly
5. Switches to alternative service providers when necessary

### Testing Service Provider Availability

You can test how the system behaves when a specific service provider is not available:

```bash
# Disable OpenAI
export USE_OPENAI=false
npm run test

# Disable Ollama
export USE_OLLAMA=false
npm run test

# Disable LMStudio
export USE_LM_STUDIO=false
npm run test
```

### Changing Service Provider Priority

You can test the priority order of service providers by changing the priority values:

```bash
# Set Ollama to highest priority
export OLLAMA_PRIORITY=1
export LMSTUDIO_PRIORITY=2
export OPENAI_PRIORITY=3
npm run test
```

### Simulating Network Connection Loss

You can simulate network connection loss using tools such as `iptables` (Linux) or Network Link Conditioner (macOS):

```bash
# macOS: Use the Network Link Conditioner tool
# Linux: Block connections to a specific port
sudo iptables -A OUTPUT -p tcp --dport 443 -j DROP
npm run test
sudo iptables -D OUTPUT -p tcp --dport 443 -j DROP
```

### Simulating Out of Memory

You can test the system's behavior when running out of memory by using Node.js memory limitation:

```bash
NODE_OPTIONS="--max-old-space-size=100" npm run test
```

## Interpreting Test Results

When interpreting the results of manual tests, pay attention to the following:

1. Clarity and informativeness of error messages
2. The system's ability to recover from error conditions
3. Activation of alternative service providers
4. Coverage and usefulness of log information

## Reporting Test Results

Report test results as follows:

1. Test description and execution method
2. Expected behavior
3. Observed behavior
4. Possible deviations and issues
5. Suggestions for system improvement
