# AI-palvelun kuormitustestit

Tämä hakemisto sisältää kuormitustestit AI-palvelun suorituskyvyn ja luotettavuuden testaamiseen suurilla pyyntömäärillä.

## Vaatimukset

- [k6](https://k6.io/) - Moderni kuormitustyökalu
- Bash-yhteensopiva komentotulkki resurssien monitorointiin

## Testien asennus

1. Asenna k6:
   ```
   brew install k6  # macOS
   ```

2. Tee monitorointiskriptistä suoritettava:
   ```
   chmod +x monitor-resources.sh
   ```

## Testien suorittaminen

### Perustason kuormitustesti

Tämä testi simuloi maltillista kuormaa AI-palvelulle:

```bash
k6 run load-test.js
```

### Raskas kuormitustesti (500 samanaikaista pyyntöä)

Tämä testi simuloi raskasta kuormaa AI-palvelulle:

```bash
k6 run heavy-load-test.js
```

### Resurssien monitorointi testin aikana

Suorita resurssien monitorointi erillisessä terminaalissa samalla kun ajat kuormitustestin:

```bash
./monitor-resources.sh node 180  # Monitoroi 'node' prosessia 3 minuutin ajan
```

## Testien konfigurointi

Voit muokata testien asetuksia muokkaamalla JavaScript-tiedostoja:

- `options.stages`: Määrittelee testin vaiheet ja keston
- `options.thresholds`: Määrittelee hyväksyttävät raja-arvot
- Pyyntöjen parametrit: URL, payload, headers jne.

## Tulosten tulkinta

K6 näyttää testin tulokset konsolissa, mukaan lukien:

- Pyyntöjen määrä ja nopeus
- Virheprosentti
- Vasteaikojen jakaumat (min, max, keskiarvo, mediaani, p90, p95)
- Mukautetut metriikat (AI-käsittelyaika, onnistumisprosentti)

Resurssien monitorointi tuottaa CSV-tiedoston ja yhteenvedon CPU- ja muistinkäytöstä.

## Testien mukauttaminen

Voit mukauttaa testejä muuttamalla:

- Tehtävätyyppejä ja syötteitä
- Kuorman määrää ja jakaumaa
- Onnistumiskriteerejä
- Monitoroitavia metriikoita

## Vianetsintä

Jos testit epäonnistuvat:

1. Varmista, että AI-palvelu on käynnissä osoitteessa `http://localhost:3000`
2. Tarkista, että kaikki tarvittavat API-avaimet ovat asetettu
3. Tarkista palvelun lokit virheiden varalta
4. Säädä testin parametreja, jos palvelu ylikuormittuu
