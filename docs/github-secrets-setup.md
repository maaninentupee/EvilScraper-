# Setting Up GitHub Secrets

This document guides you on how to set up the necessary GitHub secrets for the CI/CD workflow.

## Required Secrets

The CI/CD workflow requires the following secrets:

1. **SONAR_TOKEN**: For SonarQube integration
2. **ANTHROPIC_API_KEY**: For Anthropic Claude AI optimization
3. **OPENAI_API_KEY**: For OpenAI GPT-4 optimization

## Adding the SONAR_TOKEN Secret

1. Log in to [SonarCloud](https://sonarcloud.io/)
2. Go to user settings (My Account > Security)
3. Create a new token named "GitHub Actions"
4. Copy the generated token

Add the token to your GitHub repository:

1. Go to your GitHub repository settings
2. Select "Secrets and variables" > "Actions"
3. Click "New repository secret"
4. Set the name to `SONAR_TOKEN`
5. Paste the SonarCloud token in the value field
6. Click "Add secret"

## Adding the ANTHROPIC_API_KEY Secret

1. Log in to [Anthropic](https://console.anthropic.com/)
2. Go to the API keys section
3. Create a new API key named "GitHub Actions"
4. Copy the generated API key

Add the API key to your GitHub repository:

1. Go to your GitHub repository settings
2. Select "Secrets and variables" > "Actions"
3. Click "New repository secret"
4. Set the name to `ANTHROPIC_API_KEY`
5. Paste the Anthropic API key in the value field
6. Click "Add secret"

## Adding the OPENAI_API_KEY Secret

1. Log in to [OpenAI](https://platform.openai.com/)
2. Go to the API keys section
3. Create a new API key named "GitHub Actions"
4. Copy the generated API key

Add the API key to your GitHub repository:

1. Go to your GitHub repository settings
2. Select "Secrets and variables" > "Actions"
3. Click "New repository secret"
4. Set the name to `OPENAI_API_KEY`
5. Paste the OpenAI API key in the value field
6. Click "Add secret"

## Using the Secrets in GitHub Actions Workflow

GitHub Actions workflow uses these secrets as follows:

```yaml
- name: Run SonarQube Analysis
  uses: sonarsource/sonarqube-scan-action@master
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

- name: Send code issues to Anthropic Claude for optimization
  run: |
    curl -X POST "https://api.anthropic.com/v1/complete" \
    -H "Authorization: Bearer ${{ secrets.ANTHROPIC_API_KEY }}" \
    -H "Content-Type: application/json" \
    -d '{...}'

- name: Send code issues to OpenAI GPT-4 for additional optimizations
  run: |
    curl -X POST "https://api.openai.com/v1/completions" \
    -H "Authorization: Bearer ${{ secrets.OPENAI_API_KEY }}" \
    -H "Content-Type: application/json" \
    -d '{...}'
```

## Security Notes

GitHub secrets are encrypted and only exposed to GitHub Actions during workflow runs. Secrets are never visible in GitHub Actions logs, even if you try to print them.

**IMPORTANT!** Never include these secrets directly in your code or workflow files. Always use `${{ secrets.SECRET_NAME }}` syntax.
