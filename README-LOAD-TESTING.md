# Windsurf-projektin kuormitustestaus

## Yleiskatsaus

Tämä dokumentti tarjoaa yhteenvedon Windsurf-projektin kuormitustestauksesta. Kuormitustestauksen tarkoituksena on simuloida, kuinka hyvin järjestelmä kestää suuren määrän pyyntöjä ja tunnistaa mahdolliset pullonkaulat.

## Kuormitustestaustyökalut

Projektissa on käytössä useita kuormitustestaustyökaluja:

1. **Apache Benchmark (ab)** - Yksinkertainen komentorivityökalu HTTP-kuormitustestaukseen
2. **k6** - Monipuolinen JavaScript-pohjainen kuormitustestaustyökalu
3. **Autocannon** - Node.js-pohjainen HTTP/HTTPS kuormitustestaustyökalu

## Testattavat endpointit

Kuormitustestauksessa keskitytään seuraaviin endpointeihin:

1. **/** - Peruspäätepisteen vasteaika
2. **/scraper** - Verkkosivujen jäsennyspäätepisteen suorituskyky
3. **/evil-bot/decide** - Tekoälyn päätöksentekoprosessin suorituskyky
4. **/ai/load-test/:provider** - Tekoälypalveluiden kuormitustestaus

## Kuormitustestien suorittaminen

### Palvelimen käynnistäminen testausta varten

```bash
# Käynnistä palvelin testausta varten
./start-server-for-testing.sh
```

### Apache Benchmark (ab)

```bash
# Peruskomento: 1000 pyyntöä, 50 rinnakkaista yhteyttä
ab -n 1000 -c 50 http://localhost:3000/scraper

# Testaa evil-bot-palvelua POST-pyynnöllä
ab -n 100 -c 10 -p post_data.json -T application/json http://localhost:3000/evil-bot/decide
```

### k6

```bash
# Suorita testi
k6 run load-test.js

# Suorita testi vain Ollama-providerille
k6 run -e PROVIDER=ollama load-test.js
```

### Autocannon

```bash
# Suorita testi oletusasetuksilla
node autocannon-load-test.js

# Muokkaa parametreja
node autocannon-load-test.js --connections 100 --duration 30
```

## Tulosten analysointi

Kuormitustestien tulokset tallennetaan `load-test-results` -hakemistoon. Voit visualisoida tulokset suorittamalla:

```bash
node visualize-load-test-results.js
```

Tämä luo `load-test-report.html` -tiedoston, joka sisältää visuaalisen raportin kuormitustestien tuloksista.

## Yksikkö- ja integraatiotestit

Projektissa on myös yksikkö- ja integraatiotestit kuormitustestauksen endpointeille:

```bash
# Suorita yksikkötestit
npm test -- test/unit/controllers/ai-controller-load-test.spec.ts

# Suorita integraatiotestit
npm test -- test/integration/load-test-integration.spec.ts
```

## Kuormitustestauksen parametrit

### Apache Benchmark (ab)

- `-n` - Pyyntöjen kokonaismäärä
- `-c` - Rinnakkaisten yhteyksien määrä
- `-p` - Tiedosto, joka sisältää POST-datan
- `-T` - Content-Type-otsake

### k6

- `vus` - Virtuaalikäyttäjien määrä
- `duration` - Testin kesto
- `stages` - Kuorman vaiheet (nousu, tasainen, lasku)

### Autocannon

- `--connections, -c` - Rinnakkaisten yhteyksien määrä
- `--duration, -d` - Testin kesto sekunteina
- `--pipelining, -p` - Pipelined-pyyntöjen määrä
- `--timeout, -t` - Timeout sekunteina

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

## Lisätietoja

Katso yksityiskohtaisemmat ohjeet tiedostosta [LOAD_TESTING.md](./LOAD_TESTING.md).
