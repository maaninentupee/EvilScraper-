import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Määritellään metriikat
const errorRate = new Rate('error_rate');
const aiProcessingTime = new Trend('ai_processing_time');

// Testin asetukset - 500 samanaikaista pyyntöä
export const options = {
  scenarios: {
    perustaso: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 50 },  // Nopeasti 50 käyttäjään
        { duration: '40s', target: 50 },  // Pidetään 50 käyttäjää 40 sekuntia
        { duration: '10s', target: 0 }    // Lasketaan käyttäjämäärä alas
      ],
    },
  },
  thresholds: {
    'error_rate': ['rate<0.1'],       // Virheprosentti alle 10%
    'http_req_duration': ['p(95)<5000'], // 95% pyynnöistä alle 5s
    'ai_processing_time': ['avg<3000'],  // Keskimääräinen käsittelyaika alle 3s
  },
};

// Testin pääfunktio
export default function() {
  const url = 'http://localhost:3001/ai/seo';
  const payload = JSON.stringify({
    title: 'Example Website',
    description: 'This is an example website for testing purposes',
    content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam euismod, nisl eget aliquam ultricies, nunc nisl aliquet nunc, quis aliquam nisl nunc eu nisl.',
  });
  
  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const startTime = new Date().getTime();
  const response = http.post(url, payload, params);
  const endTime = new Date().getTime();
  
  // Lasketaan käsittelyaika millisekunteina
  const processingTime = endTime - startTime;
  aiProcessingTime.add(processingTime);
  
  // Tarkistetaan vastauksen onnistuminen
  let success = check(response, {
    'status is 200': (r) => r.status === 200,
  });
  
  // Tarkistetaan vastauksen sisältö vain jos status on 200
  if (success && response.body) {
    try {
      const jsonData = response.json();
      success = success && check(response, {
        'response has result': (r) => jsonData && jsonData.hasOwnProperty('result'),
      });
    } catch (e) {
      console.error(`JSON-käsittelyvirhe: ${e.message}`);
      success = false;
    }
  } else if (response.status !== 200) {
    console.warn(`Virheellinen vastaus: Status ${response.status}`);
  } else if (!response.body) {
    console.warn('Vastauksen body on tyhjä');
  }
  
  // Päivitetään virheprosentti
  errorRate.add(!success);
  
  // Lisätään pieni tauko pyyntöjen väliin
  sleep(1);
}
