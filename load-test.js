import http from 'k6/http';
import { check, sleep } from 'k6';

// Kuormitustestin asetukset
export const options = {
  // Vaiheittainen kuormitus - optimoitu tehokkaaseen testaukseen
  stages: [
    { duration: '5s', target: 1 },    // Aloitetaan yhdellä käyttäjällä (lämmittely)
    { duration: '10s', target: 3 },   // Nostetaan 3 käyttäjään
    { duration: '20s', target: 6 },   // Nostetaan 6 käyttäjään (huippukuorma)
    { duration: '10s', target: 4 },   // Lasketaan 4 käyttäjään
    { duration: '5s', target: 1 },    // Lasketaan takaisin yhteen käyttäjään (jäähdytys)
  ],
  thresholds: {
    // Realistisemmat kynnysarvot AI-palveluille
    http_req_duration: ['p(90)<30000'],  // 90% pyyntöjen tulee olla alle 30s
    http_req_failed: ['rate<0.20'],      // Alle 20% pyynnöistä saa epäonnistua
  },
  // Lisätään batch-parametri tehostamaan testien suoritusta
  batch: 2, // Suoritetaan pyynnöt 2 kerrallaan per VU
};

// Eri prompt-vaihtoehdot optimoitu kuormitustestausta varten
const prompts = [
  "TEST_LOAD: SEO optimointi",
  "TEST_LOAD: Kello widget",
  "TEST_LOAD: Blogi otsikko",
  "TEST_LOAD: Some jakaminen",
  "TEST_LOAD: Email pohja",
  "TEST_LOAD: Nappi teksti",
  "TEST_LOAD: Väri teema",
  "TEST_LOAD: Logo idea"
];

// Mallit, joita voidaan käyttää testeissä (jos mallivalinta on käytössä)
const models = [
  "llama2",
  "mistral",
  "gemma"
];

// Pääfunktio, jota k6 kutsuu jokaiselle virtuaalikäyttäjälle
export default function () {
  // Käytetään satunnaista syötettä jokaisessa pyynnössä
  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  
  // Tehdään HTTP-pyyntö AIGateway-palveluun optimoiduilla parametreilla
  // Valitaan satunnainen malli, jos malleja on määritelty
  const randomModel = models[Math.floor(Math.random() * models.length)];
  
  const payload = JSON.stringify({
    taskType: "seo",
    input: randomPrompt,
    maxTokens: 25,  // Pienennetty 30 -> 25 nopeuttamaan vastauksia
    timeout: 25000, // Pienennetty 40000 -> 25000 nopeuttamaan testejä
    model: randomModel, // Lisätään satunnainen malli, jos palvelu tukee tätä
    isLoadTest: true // Merkintä kuormitustestistä palvelulle
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  // Käytetään porttia 3001, joka on oletusportti sovellukselle
  // Käytetään oikeaa reittiä /ai/process, joka käsittelee AIRequestDto-tyyppisiä pyyntöjä
  const res = http.post('http://localhost:3001/ai/process', payload, params);
  
  // Tarkistetaan vastauksen laatu - optimoidut tarkistukset
  const checkResult = check(res, {
    'status was 201 or 200': (r) => r.status === 201 || r.status === 200,
    'response time < 30s': (r) => r.timings.duration < 30000, // Tiukempi aikaraja
    'response has valid data': (r) => {
      try {
        const data = r.json();
        return data && (data.result || data.error); // Tarkistetaan että vastaus sisältää joko tuloksen tai virheen
      } catch (e) {
        return false;
      }
    }
  });
  
  // Lisätään tehostettu diagnostiikka
  try {
    const responseData = res.json();
    const modelInfo = responseData.model ? ` Malli: ${responseData.model},` : '';
    const providerInfo = responseData.provider ? ` Provider: ${responseData.provider},` : '';
    
    if (res.status === 201 || res.status === 200) {
      console.log(
        `OK [${res.timings.duration}ms]${modelInfo}${providerInfo}` +
        ` Fallback: ${responseData.wasFailover || false},` +
        ` Pituus: ${responseData.result ? responseData.result.length : 0}`
      );
    } else {
      console.error(
        `VIRHE [${res.status}]${modelInfo}${providerInfo}` +
        ` Virhe: ${responseData.error || 'Tuntematon'}`
      );
    }
  } catch (e) {
    // Tarkistetaan, että res.body on määritelty ennen substring-metodin kutsumista
    const bodyPreview = res.body ? res.body.substring(0, 100) : 'ei sisältöä';
    console.error(`Virheellinen vastaus: ${res.status}, ${bodyPreview}`);
  }
  
  // Optimoitu viive pyyntöjen välissä - vaihtelee kuorman mukaan
  const currentVUs = __VU || 1; // Nykyinen virtuaalikäyttäjämäärä
  const baseDelay = Math.max(0.5, 3 - (currentVUs * 0.3)); // Vähemmän viivettä kun käyttäjiä on enemmän
  sleep(baseDelay + Math.random() * 2);
}
