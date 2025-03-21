// This file is intended for testing SonarCloud integration
// Added comment for testing - 2025-03-16
// Added comment for testing - 2025-03-21 - Testing the pipeline

// This is a test file for SonarQube analysis
// Intentionally contains code errors that SonarQube can detect

// Unused variable (code smell)
const unusedVariable = "This is never used";

// Missing semicolon (code smell)
const missingTerminator = "Missing semicolon"

// Unnecessary console.log (security hotspot)
console.log("This is a security issue in production code");

// Missing error handling (bug)
function fetchData() {
  return fetch('https://api.example.com/data')
    .then(response => response.json());
  // Missing catch block
}

// Complex function without comments (code smell)
function complexFunction(a, b, c, d, e) {
  let result = 0;
  if (a > b) {
    if (c > d) {
      if (e > a) {
        result = a + b + c;
      } else {
        result = a + b - c;
      }
    } else {
      if (e > a) {
        result = a - b + c;
      } else {
        result = a - b - c;
      }
    }
  } else {
    if (c > d) {
      if (e > a) {
        result = b + a + c;
      } else {
        result = b + a - c;
      }
    } else {
      if (e > a) {
        result = b - a + c;
      } else {
        result = b - a - c;
      }
    }
  }
  return result;
}

/**
 * Simple function that adds two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of the numbers
 */
function addNumbers(a, b) {
  return a + b;
}

/**
 * Simple function that multiplies two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Product of the numbers
 */
function multiplyNumbers(a, b) {
  return a * b;
}

/**
 * Simple function that divides two numbers
 * @param {number} a - Dividend
 * @param {number} b - Divisor
 * @returns {number} Quotient of the numbers
 * @throws {Error} If divisor is zero
 */
function divideNumbers(a, b) {
  if (b === 0) {
    throw new Error("Divisor cannot be zero");
  }
  return a / b;
}

// Export functions
module.exports = {
  fetchData,
  complexFunction,
  addNumbers,
  multiplyNumbers,
  divideNumbers
};
