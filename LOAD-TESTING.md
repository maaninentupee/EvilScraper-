# AI-palveluntarjoajien kuormitustestaus

Tämä dokumentti sisältää ohjeet Windsurf-projektin AI-palveluntarjoajien (Ollama, LM Studio) kuormitustestaukseen.

## Kuormitustestauksen tarkoitus

Kuormitustestauksen tarkoituksena on:
1. Varmistaa, että AI-palveluntarjoajat pystyvät käsittelemään useita samanaikaisia pyyntöjä
2. Tutkia optimaalinen rinnakkaisten pyyntöjen määrä kullekin palveluntarjoajalle
3. Tunnistaa ja korjata mahdolliset suorituskyvyn pullonkaulat
4. Testata virheenhallintalogiikan toimivuus kuormitustilanteissa

## Toteutetut parannukset

Olemme toteuttaneet seuraavat parannukset kuormitustestauksen mahdollistamiseksi:

### 1. OllamaProvider ja LMStudioProvider

Molempiin providereihin on tehty seuraavat parannukset:
- Lisätty pyyntöjen jonotusmekanismi
- Rajoitettu samanaikaisten pyyntöjen maksimimäärä (20)
- Parannettu virheenhallintaa
- Luotu oma axios-instanssi paremmilla asetuksilla (timeout 30s)

### 2. ProviderRegistry

Luotu uusi ProviderRegistry-luokka, joka:
- Tarjoaa pääsyn kaikkiin rekisteröityihin palveluntarjoajiin
- Mahdollistaa palveluntarjoajien haun nimen perusteella
- Tarjoaa metodin saatavilla olevien palveluntarjoajien tarkistamiseen

### 3. Kuormitustestaus-endpoint

Luotu uusi REST API endpoint kuormitustestausta varten:
- URL: `POST /ai/load-test/:provider`
- Parametrit:
  - `provider`: palveluntarjoajan nimi (ollama, lmstudio)
  - Pyynnön body:
    ```json
    {
      "prompt": "Kirjoita esimerkki AI:sta",
      "model": "llama2",
      "iterations": 10
    }
    ```
- Palauttaa yksityiskohtaista tietoa kuormitustestin tuloksista

### 4. k6 testiskripta

Päivitetty k6 testiskripta sisältää:
- Ollama ja LM Studio testausskenaariot eri vaiheilla
- Kynnysarvot suorituskyvyn mittaamiseen
- Monipuolisia testaus-prompteja
- Tuen sekä load-test API:n käyttöön että suoraan palveluntarjoajien API:en kutsumiseen

## Kuormitustestauksen suorittaminen

### Esivaatimukset

1. Asenna [k6](https://k6.io/docs/getting-started/installation/) kuormitustestaustyökalu
2. Varmista, että Windsurf-palvelin on käynnissä (`npm run start`)
3. Varmista, että Ollama ja/tai LM Studio on käynnissä

### Testauksen suorittaminen

1. Suorita testaus k6:lla:

```bash
# Suorita kaikki testiskenaariot
k6 run load-test.js

# Suorita vain Ollama-skenaariot
k6 run -e PROVIDER=ollama --tag testType=ollama -o scenario=ollama_load load-test.js

# Suorita vain LM Studio-skenaariot
k6 run -e PROVIDER=lmstudio --tag testType=lmstudio -o scenario=lmstudio_load load-test.js
```

2. Vaihtoehtoisesti voit käyttää suoraa API-testausta:

```bash
# Testaa Ollama API suoraan
k6 run -e PROVIDER=ollama --tag testType=direct_api load-test.js -f directAPITest

# Testaa LM Studio API suoraan
k6 run -e PROVIDER=lmstudio --tag testType=direct_api load-test.js -f directAPITest
```

## Tulosten tulkinta

K6 tarjoaa yksityiskohtaisia raportteja suorituskyvystä, kuten:
- Pyyntöjen määrä sekunnissa
- Vastausaikojen jakaumat (p90, p95, p99)
- Virheprosentit
- HTTP-tilakoodi jakaumat

Lisäksi load-test API endpoint tarjoaa yksityiskohtaisia tietoja yksittäisistä pyynnöistä:
- Onnistumisprosentti
- Keskimääräinen kesto
- Virheviestit
- Tokenien määrät vastauksissa

## Jatkokehitys

Jatkokehitysmahdollisuuksia:
1. Visualisointityökalut tulosten tarkasteluun (esim. Grafana)
2. Automaattinen skaalautuvuustestaus eri palvelinkonfiguraatioilla
3. Vertailuraporttien generointi eri palveluntarjoajien välillä
4. Muistinkäytön ja CPU-kuormituksen monitorointi testien aikana
