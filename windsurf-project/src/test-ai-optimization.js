/**
 * This file was created for testing the GitHub Actions workflow.
 * It intentionally contains some code issues that SonarQube can identify.
 * 
 * Updated 2025-03-15: Added testing comment for CI/CD workflow testing
 */

// Unused variable (SonarQube Code Smell)
const unusedVariable = "This is not used anywhere";

// Missing error handling (SonarQube Bug)
function fetchData(url) {
  return fetch(url).then(response => response.json());
}

// Missing type definitions (SonarQube Code Smell)
function calculateSum(a, b) {
  return a + b;
}

// Duplicate code (SonarQube Code Smell)
function processUser(user) {
  console.log("Processing user:", user.name);
  console.log("User age:", user.age);
  console.log("User email:", user.email);
}

function processAdmin(admin) {
  console.log("Processing admin:", admin.name);
  console.log("Admin age:", admin.age);
  console.log("Admin email:", admin.email);
}

// Possible null reference (SonarQube Bug)
function getUserName(user) {
  return user.name.toUpperCase();
}

// Security risk: hardcoded password (SonarQube Vulnerability)
const dbConfig = {
  host: "localhost",
  user: "admin",
  password: "admin123", 
  database: "testdb"
};

// Complex function (SonarQube Code Smell)
function complexFunction(a, b, c, d, e) {
  if (a <= 0) return 0;
  
  const values = [a, b, c, d, e];
  let sum = 0;
  
  for (let i = 0; i < values.length; i++) {
    if (values[i] <= 0) break;
    sum += values[i];
  }
  
  return sum;
}

// Export definitions
module.exports = {
  calculateSum,
  processUser,
  processAdmin,
  getUserName,
  complexFunction,
  fetchData
};
