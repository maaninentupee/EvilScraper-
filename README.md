# Windsurf Project - AI Fallback System

Tämä projekti toteuttaa älykkään fallback-järjestelmän, joka hyödyntää ensisijaisesti paikallisia tekoälymalleja, mutta tarvittaessa siirtyy käyttämään OpenAI:n tai Anthropic:n API-malleja.

## Ominaisuudet

- **ModelSelector**: Valitsee sopivan mallin käyttötapauksen mukaan
- **AIGateway**: Hallinnoi paikallisten ja pilvipalveluiden mallien käyttöä
- **AIGatewayEnhancer**: Paranneltu versio AIGateway-luokasta, joka tarjoaa älykkään fallback-mekanismin ja välimuistin
- **AIControllerEnhanced**: Uusi kontrolleri, joka hyödyntää AIGatewayEnhancer-luokkaa tarjoten monipuolisempia prosessointimahdollisuuksia
- **ProviderHealthMonitor**: Seuraa palveluntarjoajien suorituskykyä ja saatavuutta
- **Fallback-mekanismi**: Siirtyy automaattisesti OpenAI:hin ja tarvittaessa Anthropic:iin
- **ScrapingService**: Web-sivujen SEO-analyysi tekoälyn avulla
- **EvilBotService**: Tekoälypohjainen päätöksentekojärjestelmä
- **BotService**: Käyttäjän viestien analyysi ja seuraavan toiminnon päättäminen
- **RESTful API**: NestJS-pohjainen rajapinta AI-toiminnallisuuksille

## Asennus

1. Kloonaa repo:
```
git clone https://github.com/maaninentupee/EvilScraper-.git
cd windsurf-project
```

2. Asenna riippuvuudet:
```
npm install
```

3. Kopioi ympäristömuuttujat:
```
cp .env.example .env
```

4. Muokkaa .env-tiedostoa lisäämällä API-avaimet:
```
OPENAI_API_KEY=your-api-key
ANTHROPIC_API_KEY=your-api-key
```

5. Käynnistä sovellus:
```
npm run start
```

## Testaus

Projekti sisältää kattavat testit, jotka varmistavat fallback-mekanismin toimivuuden eri tilanteissa:

```
# Suorita yksikkötestit
npm run test

# Suorita e2e-testit
npm run test:e2e

# Suorita fallback-testit
node test/fallback-test.js

# Suorita parannellut fallback-testit
node test/enhanced-fallback-test.js

# Suorita kontrollerin testit
node test/enhanced-controller-test.js
```

## Kuormitustestaus

Projekti sisältää työkaluja kuormitustestaukseen, jotka auttavat arvioimaan järjestelmän suorituskykyä raskaassa käytössä:

```
# Suorita perus kuormitustesti
node test/load/load-test.js

# Suorita raskas kuormitustesti
node test/load/heavy-load-test.js

# Suorita mallien vertailutesti
node test/load/model-comparison-test.js
```

## Resurssien monitorointi

Projekti sisältää työkalun Ollama-resurssien käytön analysointiin. Tämä auttaa optimoimaan Ollama-mallien suorituskykyä ja tunnistamaan mahdollisia pullonkauloja:

```bash
# Suorita Ollama-resurssien analyysi
./scripts/analyze-ollama-resources.sh
```

## Viimeisimmät parannukset

1. Fallback-mekanismin parannukset:
   - ErrorClassifier-luokan täydentäminen Injectable-dekoraattorilla
   - isRetryable-metodin korjaaminen AIGateway- ja AIGatewayEnhancer-luokissa
   - Kattavampi virheidenkäsittely

2. Välimuistin optimointi:
   - Eräkäsittelyn keskimääräinen vasteaika vain 0.68ms

3. Terveysmonitorointi:
   - ProviderHealthMonitor seuraa palveluntarjoajien suorituskykyä

## Tulevat kehityskohteet

1. Rate limiting -mekanismit (korkea prioriteetti)
2. Llama-binäärin asennus (keskitason prioriteetti)
3. Vasteaikojen optimointi (keskitason prioriteetti)
4. Virheiden raportoinnin laajennus (matala prioriteetti)

## Lisenssi

MIT
