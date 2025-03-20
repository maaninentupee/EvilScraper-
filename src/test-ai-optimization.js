/**
 * Tämä tiedosto on luotu GitHub Actions -työnkulun testaamiseksi.
 * Se sisältää tarkoituksella muutamia koodiongelmia, jotka SonarQube voi tunnistaa.
 * 
 * Päivitetty 2025-03-15: Lisätty testauskommentti CI/CD-työnkulun testaamiseksi
 */

// Käyttämätön muuttuja (SonarQube Code Smell)
const unusedVariable = "Tätä ei käytetä missään";

// Puuttuva virheenkäsittely (SonarQube Bug)
function fetchData(url) {
  return fetch(url).then(response => response.json());
}

// Puuttuvat tyyppimäärittelyt (SonarQube Code Smell)
function calculateSum(a, b) {
  return a + b;
}

// Toistuva koodi (SonarQube Code Smell)
function processUser(user) {
  console.log("Käsitellään käyttäjä:", user.name);
  console.log("Käyttäjän ikä:", user.age);
  console.log("Käyttäjän sähköposti:", user.email);
}

function processAdmin(admin) {
  console.log("Käsitellään admin:", admin.name);
  console.log("Adminin ikä:", admin.age);
  console.log("Adminin sähköposti:", admin.email);
}

// Mahdollinen null-viittaus (SonarQube Bug)
function getUserName(user) {
  return user.name.toUpperCase();
}

// Tietoturvariski: kovakoodattu salasana (SonarQube Vulnerability)
const dbConfig = {
  host: "localhost",
  user: "admin",
  password: "admin123",
  database: "testdb"
};

// Monimutkainen funktio (SonarQube Code Smell)
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

// Vientimäärittelyt
module.exports = {
  calculateSum,
  processUser,
  processAdmin,
  getUserName,
  complexFunction,
  // fetchData puuttuu vientimäärittelyistä (SonarQube Code Smell)
};
