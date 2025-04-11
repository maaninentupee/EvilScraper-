# AI-Based Code Development and Optimization Workflow

This document describes the project's development and optimization workflow, which utilizes multiple AI tools and automation to improve code quality.

## Workflow Steps

### 1️⃣ Code Writing and Refactoring (Windsurf Editor + Cascade Agent)

- In Windsurf Editor, you use Cascade Agent to generate code
- Code is developed and tested in Windsurf before pushing to GitHub
- At this stage, you can already make preliminary refactorings, such as reducing the cognitive complexity of the parseArgs function

### 2️⃣ Pushing Code to GitHub

- When the code is ready, you push it to the GitHub repository
- This automatically triggers the GitHub Actions workflow
- GitHub Actions runs SonarQube analysis on the code

### 3️⃣ SonarQube Analyzes Code Quality and Vulnerabilities

- SonarQube analyzes the code in the GitHub repository
- It checks for type errors, code fragmentation, vulnerabilities, and performance issues
- Analysis results are retrieved via the SonarCloud API and saved in JSON format
- This report includes detailed information about all detected issues

### 4️⃣ PearAI Optimizes Issues Detected by SonarQube

- PearAI API receives the SonarQube report in JSON format
- PearAI focuses only on fixing issues detected by SonarQube
- This ensures that optimizations are targeted and relevant
- PearAI produces fixes in JSON format, which includes the filename and fixed code

### 5️⃣ Optimizations are Proposed as a Pull Request

- GitHub Actions creates a new branch (ai-optimizations) for optimizations
- Fixes produced by PearAI are applied to the files
- Changes are committed and pushed to the new branch
- GitHub Actions automatically creates a pull request containing all optimizations
- The developer can review, modify, or reject the proposed changes

## Why This Workflow is Effective

- ✅ **Targeted Optimizations**: PearAI focuses only on issues detected by SonarQube
- ✅ **Flexible Environment**: The workflow works in both macOS and Ubuntu environments
- ✅ **Automatic Analysis**: All code quality and security checks happen automatically
- ✅ **Optimized Code**: PearAI agents make the code more efficient and maintainable
- ✅ **Quality Assurance**: The pull request process ensures that all changes are reviewed before being merged

## Setting Up the Workflow

Setting up the workflow requires the following steps:

1. Creating a GitHub repository and pushing code to it
2. Configuring the GitHub Actions workflow (.github/workflows/code-analysis.yml)
3. Setting up SonarQube integration (sonar-project.properties)
4. Adding the PearAI API key to GitHub secrets

## GitHub Actions Workflow

The GitHub Actions workflow is defined in the file `.github/workflows/code-analysis.yml`. It contains two main phases:

1. **Code Analysis (SonarQube)**:
   - Runs SonarQube analysis on the code
   - Retrieves analysis results via the SonarCloud API
   - Saves results in JSON format as an artifact

2. **Code Optimization (PearAI)**:
   - Downloads SonarQube results
   - Sends results to PearAI API for optimization
   - Applies fixes produced by PearAI to the code
   - Creates a pull request containing the optimized code

## Required Secrets

The following secrets should be added to the GitHub repository:

- `SONAR_TOKEN`: For SonarQube integration
- `PEARAI_TOKEN`: For PearAI API integration

## Important Notes

- Remember to update "YOUR_PROJECT_KEY" in the SonarQube API call with the correct project key
- The GitHub Actions workflow is automatically triggered when code is pushed to main, develop, or feature/* branches
- The macOS environment is used by default, but you can switch to Ubuntu by modifying the workflow file
