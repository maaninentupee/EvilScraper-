// Tämä on testitiedosto SonarQube-analyysia varten
// Sisältää tarkoituksella koodivirheitä, jotka SonarQube voi havaita

// Käyttämätön muuttuja (code smell)
const unusedVariable = "This is never used";

// Puuttuva puolipiste (code smell)
const missingTerminator = "Missing semicolon"

// Turha console.log (security hotspot)
console.log("This is a security issue in production code");

// Puuttuva virheenkäsittely (bug)
function fetchData() {
  return fetch('https://api.example.com/data')
    .then(response => response.json());
  // Puuttuu catch-lohko
}

// Monimutkainen funktio ilman kommentteja (code smell)
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

// Viedään funktiot
module.exports = {
  fetchData,
  complexFunction
};
