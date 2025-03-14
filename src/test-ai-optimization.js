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
  let result = 0;
  
  if (a > 0) {
    if (b > 0) {
      if (c > 0) {
        if (d > 0) {
          if (e > 0) {
            result = a + b + c + d + e;
          } else {
            result = a + b + c + d;
          }
        } else {
          result = a + b + c;
        }
      } else {
        result = a + b;
      }
    } else {
      result = a;
    }
  }
  
  return result;
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
