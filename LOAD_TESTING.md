# Windsurf-projektin kuormitustestaus

Tämä dokumentti kuvaa Windsurf-projektin kuormitustestausta ja tarjoaa ohjeet eri kuormitustestaustyökalujen käyttöön.

## Kuormitustestaustyökalut

Projektissa on käytettävissä useita kuormitustestaustyökaluja:

1. **Apache Benchmark (ab)** - Yksinkertainen komentorivityökalu HTTP-kuormitustestaukseen
2. **k6** - Monipuolinen JavaScript-pohjainen kuormitustestaustyökalu
3. **Autocannon** - Node.js-pohjainen HTTP/HTTPS kuormitustestaustyökalu

## 1. Apache Benchmark (ab)

Apache Benchmark on yksinkertainen työkalu, joka on yleensä valmiiksi asennettuna useimmissa Unix/Linux-järjestelmissä.

### Käyttö

```bash
# Peruskomento: 1000 pyyntöä, 50 rinnakkaista yhteyttä
ab -n 1000 -c 50 http://localhost:3000/scraper

# Testaa AI-palvelua
ab -n 100 -c 10 http://localhost:3000/ai/models

# Testaa evil-bot-palvelua POST-pyynnöllä
ab -n 100 -c 10 -p post_data.json -T application/json http://localhost:3000/evil-bot/decide
```

### Parametrit

- `-n` - Pyyntöjen kokonaismäärä
- `-c` - Rinnakkaisten yhteyksien määrä
- `-p` - Tiedosto, joka sisältää POST-datan
- `-T` - Content-Type-otsake

### Valmis skripti

Projektissa on valmis skripti `load-test.sh`, joka suorittaa kuormitustestejä useille endpointeille:

```bash
# Suorita oletusasetuksilla
./load-test.sh

# Muokkaa parametreja
./load-test.sh -n 500 -c 20 -h localhost -p 3000
```

## 2. k6 Kuormitustestaus

k6 on monipuolinen JavaScript-pohjainen kuormitustestaustyökalu, joka mahdollistaa monimutkaisempien testiskenaarioiden luomisen.

### Asennus

```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Windows
choco install k6
```

### Käyttö

Projektissa on valmis k6-skripti `load-test.js`:

```bash
# Suorita testi
k6 run load-test.js

# Suorita testi vain Ollama-providerille
k6 run -e PROVIDER=ollama load-test.js

# Suorita testi vain LM Studio -providerille
k6 run -e PROVIDER=lmstudio load-test.js
```

### Skriptin ominaisuudet

- Testaa eri AI-palveluntarjoajia (Ollama, LM Studio)
- Simuloi kuorman nousua ja laskua
- Mittaa vasteaikoja ja virheprosentteja
- Käyttää erilaisia prompteja vaihtelun vuoksi

## 3. Autocannon

Autocannon on Node.js-pohjainen HTTP/HTTPS kuormitustestaustyökalu, joka on erityisen hyödyllinen Node.js-sovellusten testaamiseen.

### Asennus

```bash
# Asennettu projektiin devDependency:nä
npm install

# Tai asenna globaalisti
npm install -g autocannon
```

### Käyttö

Projektissa on valmis Autocannon-skripti `autocannon-load-test.js`:

```bash
# Suorita testi oletusasetuksilla
node autocannon-load-test.js

# Muokkaa parametreja
node autocannon-load-test.js --connections 100 --duration 30
```

### Parametrit

- `--connections, -c` - Rinnakkaisten yhteyksien määrä (oletus: 50)
- `--duration, -d` - Testin kesto sekunteina (oletus: 10)
- `--pipelining, -p` - Pipelined-pyyntöjen määrä (oletus: 1)
- `--timeout, -t` - Timeout sekunteina (oletus: 20)

## 4. AI-palveluiden kuormitustestaus

Projektissa on erityinen endpoint AI-palveluiden kuormitustestaukseen:

```
POST /ai/load-test/:provider
```

### Parametrit

- `provider` - Testattavan palveluntarjoajan nimi (ollama, lmstudio, openai, anthropic, local)
- `prompt` - Käytettävä prompt
- `model` - Käytettävä malli (oletuksena "default")
- `iterations` - Suoritettavien iteraatioiden määrä (oletuksena 1)

### Esimerkki

```bash
curl -X POST http://localhost:3000/ai/load-test/ollama \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Kirjoita lyhyt tarina tekoälystä", "model":"llama2", "iterations":5}'
```

## Tulosten analysointi

Kuormitustestien tuloksia voidaan analysoida seuraavien mittareiden avulla:

1. **Läpäisykyky (Throughput)** - Pyyntöjen määrä sekunnissa
2. **Vasteaika (Latency)** - Keskimääräinen, minimi, maksimi ja p99 vasteaika
3. **Virheprosentti** - Epäonnistuneiden pyyntöjen prosenttiosuus
4. **Samanaikaisuus** - Järjestelmän kyky käsitellä rinnakkaisia pyyntöjä

Autocannon-skripti tallentaa tulokset `load-test-results`-hakemistoon JSON-muodossa jatkokäsittelyä varten.

## Vinkkejä kuormitustestaukseen

1. **Aloita pienellä kuormalla** ja kasvata sitä asteittain
2. **Testaa eri endpointeja** erikseen ja yhdessä
3. **Monitoroi järjestelmän resursseja** (CPU, muisti, verkko) testauksen aikana
4. **Testaa säännöllisesti** osana CI/CD-putkea
5. **Vertaa tuloksia** aiempiin testeihin kehityksen edetessä

## Tunnettuja rajoituksia

- AI-mallit voivat olla hitaita, joten aseta riittävän pitkä timeout
- Paikalliset AI-palvelut (Ollama, LM Studio) voivat olla rajoitettuja laitteiston suorituskyvyn mukaan
- OpenAI ja Anthropic -palveluilla on API-rajoituksia, jotka voivat vaikuttaa kuormitustesteihin
