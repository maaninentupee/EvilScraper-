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

/**
 * Calculates result based on input parameters
 * @param {number} a First number
 * @param {number} b Second number
 * @param {number} c Third number
 */
function calculateResult(a, b, c, isPositive) {
  if (isPositive) {
    return a + b + c;
  }
  return a + b - c;
}

/**
 * Complex function refactored for lower cognitive complexity
 */
function complexFunction(a, b, c, d, e) {
  const isAGreaterThanB = a > b;
  const isCGreaterThanD = c > d;
  const isEGreaterThanA = e > a;
  
  return isAGreaterThanB
    ? handleFirstCase(a, b, c, isCGreaterThanD, isEGreaterThanA)
    : handleSecondCase(a, b, c, isCGreaterThanD, isEGreaterThanA);
}

function handleFirstCase(a, b, c, isCGreaterThanD, isEGreaterThanA) {
  const modifiedB = isCGreaterThanD ? b : -b;
  return calculateResult(a, modifiedB, c, isEGreaterThanA);
}

function handleSecondCase(a, b, c, isCGreaterThanD, isEGreaterThanA) {
  const resultA = isCGreaterThanD ? a : -a;
  return calculateResult(b, resultA, c, isEGreaterThanA);
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
