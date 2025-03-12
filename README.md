# Windsurf Project - AI Fallback System

Tämä projekti toteuttaa älykkään fallback-järjestelmän, joka hyödyntää ensisijaisesti paikallisia tekoälymalleja, mutta tarvittaessa siirtyy käyttämään OpenAI:n tai Anthropic:n API-malleja.

## Ominaisuudet

- **ModelSelector**: Valitsee sopivan mallin käyttötapauksen mukaan
- **AIGateway**: Hallinnoi paikallisten ja pilvipalveluiden mallien käyttöä
- **Fallback-mekanismi**: Siirtyy automaattisesti OpenAI:hin ja tarvittaessa Anthropic:iin
- **ScrapingService**: Web-sivujen SEO-analyysi tekoälyn avulla
- **EvilBotService**: Tekoälypohjainen päätöksentekojärjestelmä
- **BotService**: Käyttäjän viestien analyysi ja seuraavan toiminnon päättäminen
- **RESTful API**: NestJS-pohjainen rajapinta AI-toiminnallisuuksille

## Asennus

1. Kloonaa repo:
```
git clone [repo-url]
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

4. Määritä API-avaimet ja konfiguraatio .env-tiedostoon:
```
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

## Käyttö

Käynnistä sovellus:
```
npm run dev
```

### Tekoälyn käyttö API:n kautta

1. Pyyntö AI-prosessointiin:
```bash
curl -X POST http://localhost:3000/ai/process \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Kerro minulle tekoälystä",
    "taskType": "seo"
  }'
```

2. SEO-analyysi verkkosivusta:
```bash
curl -X POST http://localhost:3000/scraping/analyze-seo \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "title": "Example Domain",
    "description": "This domain is for use in examples.",
    "keywords": ["example", "domain"],
    "content": "Example page content..."
  }'
```

3. Evil Bot päätöksenteko:
```bash
curl -X POST http://localhost:3000/evil-bot/decide \
  -H "Content-Type: application/json" \
  -d '{
    "situation": "Käyttäjä haluaa tehdä ostoksen verkkokaupassa",
    "options": [
      "Suositellaan kalleinta tuotetta",
      "Näytetään personoituja suosituksia",
      "Tarjotaan alennuskuponki"
    ]
  }'
```

4. Käyttäjän viestien analyysi ja toiminta:
```bash
curl -X POST http://localhost:3000/bot/decide \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Haluan löytää uuden laitteen, joka auttaa minua kuvien muokkaamisessa"
  }'
```

## Testaus

Projekti sisältää kattavan testausinfrastruktuurin:

- **Yksikkötestit**: `npm test`
- **Integraatiotestit**: `npm run test:integration`
- **E2E-testit**: `npm run test:e2e` (katso [E2E_TESTING.md](E2E_TESTING.md))
- **Kuormitustestit**: `npm run test:load` (katso [LOAD_TESTING.md](LOAD_TESTING.md))
- **Manuaaliset testit**: Katso [MANUAL_TESTING.md](MANUAL_TESTING.md)

### Testien ajaminen

```bash
# Kaikki testit
npm test

# E2E-testit (vaatii käynnissä olevan palvelimen)
npm run test:e2e

# E2E-testit automaattisesti (käynnistää ja sammuttaa palvelimen)
npm run test:e2e:all

# Nopeat E2E-testit
npm run test:e2e:fast

# Integraatiotestit
npm run test:integration

# Testit Ollama-esilämmityksellä
npm run test:with-warmup
```

### Ollama-mallin esilämmitys

Ollama-mallin ensimmäinen käynnistys voi olla hidas, mikä voi aiheuttaa aikakatkaisuja testeissä. Tämän vuoksi projektissa on skripti mallien esilämmittämiseen ennen testien ajamista:

```bash
# Esilämmitä Ollama-mallit
npm run warmup:ollama

# Suorita testit esilämmityksen jälkeen
npm run test:with-warmup

# Suorita E2E-testit esilämmityksen jälkeen
npm run test:e2e:with-warmup
```

### End-to-End (E2E) testit

E2E-testit varmistavat, että koko järjestelmä toimii oikein käyttäjän näkökulmasta. Nämä testit simuloivat todellisia käyttötapauksia ja testaavat järjestelmän toimintaa päästä päähän.

E2E-testit on jaettu kolmeen kategoriaan:
1. **Perustoiminnallisuudet** - Testaa järjestelmän perustoiminnallisuuksia kuten tervetulosivua ja scraperiä
2. **AI-palvelut** - Testaa AI-palveluiden saatavuutta ja toimintaa
3. **Kuormitustestaus** - Testaa järjestelmän kykyä käsitellä useita samanaikaisia pyyntöjä

E2E-testien ajaminen:
```bash
# Normaalisti
npm run test:e2e

# Jos käytät esilämmitystä Ollamalle (suositeltu)
npm run test:e2e:with-warmup
```

### Suorituskyvyn optimointi

Ollama-mallit käyttävät huomattavasti muistia. Varmista, että järjestelmässäsi on tarpeeksi vapaata muistia:

```bash
# Tarkista järjestelmän muistinkäyttö (macOS)
vm_stat

# Tarkista Ollama-prosessin muistinkäyttö
ps -o pid,rss,%mem,command -p $(pgrep ollama)
```

Suuret mallit (13B parametria tai enemmän) voivat vaatia merkittävästi enemmän muistia kuin pienemmät mallit.

### Ollama-resurssien analyysi

Projekti sisältää työkalun Ollama-resurssien käytön analysointiin. Tämä auttaa optimoimaan Ollama-mallien suorituskykyä ja tunnistamaan mahdollisia pullonkauloja:

```bash
# Suorita Ollama-resurssien analyysi
./scripts/analyze-ollama-resources.sh
```

Skripti kerää tietoja Ollama-prosessien CPU- ja muistinkäytöstä sekä suorittaa kuormitustestin. Tulokset tallennetaan `ollama-resource-analysis-[aikaleima]`-hakemistoon.

Katso tarkempi analyysi ja suositukset tiedostosta [OLLAMA_RESOURCE_ANALYSIS.md](OLLAMA_RESOURCE_ANALYSIS.md).

## Arkkitehtuuri

Järjestelmä käyttää seuraavia komponentteja:

- **ModelSelector**: Valitsee sopivan mallin tehtävän tyypin ja saatavuuden perusteella
- **AIGateway**: Pääluokka, joka hallinnoi tekoälyn pyyntöjä ja fallback-logiikkaa
- **ScrapingService**: Analysoi verkkosivujen SEO-laatua tekoälyn avulla
- **EvilBotService**: Tekee päätöksiä tekoälyn avulla annetuista vaihtoehdoista
- **BotService**: Analysoi käyttäjän viestejä ja päättää seuraavan askeleen

## Lisenssi

Copyright (c) 2025
