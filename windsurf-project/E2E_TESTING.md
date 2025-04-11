# End-to-End (E2E) Testing in the Windsurf Project

This document describes the End-to-End (E2E) testing strategy and practices for the Windsurf project.

## Overview

E2E tests ensure that the entire system works correctly from the user's perspective. These tests simulate real use cases and test the system's functionality from end to end.

## E2E Test Structure

The Windsurf project's E2E tests are divided into three main categories:

1. **Basic Functionality** (`app.e2e-spec.ts`)
   - Tests the welcome page and health checks
   - Tests scraper functionality
   - Tests evil-bot decision making
   - Tests error handling

2. **AI Services** (`ai-providers.e2e-spec.ts`)
   - Tests AI service availability
   - Tests model listing
   - Tests AI service load with a small number of requests

3. **Load Testing** (`load-testing.e2e-spec.ts`)
   - Tests the system's ability to handle multiple concurrent requests
   - Ensures that load testing scripts exist
   - Tests AI service load testing endpoints

## Running E2E Tests

E2E tests require the server to be running. The tests use `http://localhost:3001` by default.

### Running Tests

```bash
# Start the server first
npm run dev

# In another terminal, run E2E tests
npm run test:e2e
```

### Quick Test Run

If you want to run only the fastest tests (e.g., in CI/CD environment or during development):

```bash
npm run test:e2e:fast
```

### Running Tests Automatically

You can configure the tests to run automatically when changes are detected:

```bash
npm run test:e2e:watch
```

## Test Configuration

The E2E test configuration is in the `test/e2e/jest-e2e.json` file. You can modify the following settings:

- **Timeout**: Default timeout for tests
- **Test Environment**: Node.js environment for tests
- **Test Match**: Patterns for test files
- **Root Directory**: Root directory for tests

## Test Data

Test data is stored in the `test/e2e/fixtures` directory. This includes:

- **Mock responses** for external services
- **Test URLs** for scraper testing
- **Sample data** for AI service testing

## Best Practices

1. **Write independent tests**: Each test should be able to run independently
2. **Clean up after tests**: Reset the system state after each test
3. **Use descriptive test names**: Test names should describe what is being tested
4. **Avoid flaky tests**: Tests should be deterministic and reliable
5. **Test error cases**: Include tests for error handling and edge cases

## Continuous Integration

E2E tests are run automatically in the CI/CD pipeline:

1. **Pull Request**: Basic E2E tests are run for each pull request
2. **Merge to Main**: All E2E tests are run when changes are merged to main
3. **Nightly**: Extended E2E tests including load tests are run nightly

## Troubleshooting

If E2E tests fail, check the following:

1. **Server is running**: Ensure the server is running on the expected port
2. **Environment variables**: Check that all required environment variables are set
3. **Dependencies**: Ensure all dependencies are installed
4. **Network issues**: Check for network connectivity issues
5. **Test data**: Verify that test data is available and correct

## Future Improvements

1. **Visual regression testing**: Add visual regression tests for UI components
2. **Performance metrics**: Collect and analyze performance metrics during E2E tests
3. **Cross-browser testing**: Extend tests to run on multiple browsers
4. **Mobile testing**: Add tests for mobile devices
5. **Accessibility testing**: Add accessibility tests

## References

- [Jest Documentation](https://jestjs.io/docs/en/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [NestJS Testing Documentation](https://docs.nestjs.com/fundamentals/testing)
