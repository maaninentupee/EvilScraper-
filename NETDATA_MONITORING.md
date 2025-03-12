# Netdata-monitorointi Ollama-malleille

Tämä dokumentaatio kuvaa, miten voit käyttää Netdata-työkalua Ollama-mallien resurssien käytön monitorointiin.

## Yleiskatsaus

Netdata on tehokas reaaliaikainen monitorointityökalu, joka tarjoaa yksityiskohtaista tietoa järjestelmän suorituskyvystä. Olemme integroineet Ollama-mallien resurssien käytön seurannan Netdata-työkaluun, mikä mahdollistaa mallien suorituskyvyn tarkan analysoinnin.

## Asennus

### Netdata-asennus

Asenna Netdata Homebrew'n avulla:

```bash
brew install netdata
brew services start netdata
```

Netdata-käyttöliittymä on saatavilla osoitteessa: [http://localhost:19999](http://localhost:19999)

## Ollama-monitorointi

Olemme luoneet skriptin, joka kerää Ollama-mallien resurssien käyttötietoja ja lähettää ne Netdata-palveluun StatsD-protokollan avulla.

### Monitoroinnin käynnistäminen

Käynnistä Ollama-monitorointi suorittamalla:

```bash
npm run monitor:ollama:netdata
```

tai suoraan:

```bash
./scripts/ollama-netdata-collector.sh
```

### Kerättävät mittarit

Skripti kerää seuraavat mittarit:

#### Ollama-palvelu (pääprosessi)
- `ollama.main.cpu` - CPU-käyttö prosentteina
- `ollama.main.memory_percent` - Muistin käyttö prosentteina
- `ollama.main.memory_mb` - Muistin käyttö megatavuina

#### Ollama-mallit (runner-prosessit)
- `ollama.runners.count` - Aktiivisten mallien määrä
- `ollama.runners.cpu` - Kaikkien mallien yhteenlaskettu CPU-käyttö
- `ollama.runners.memory_percent` - Kaikkien mallien yhteenlaskettu muistin käyttö prosentteina
- `ollama.runners.memory_mb` - Kaikkien mallien yhteenlaskettu muistin käyttö megatavuina

#### Mallikohtaiset mittarit
- `ollama.model.<mallinimi>.cpu` - Tietyn mallin CPU-käyttö
- `ollama.model.<mallinimi>.memory_percent` - Tietyn mallin muistin käyttö prosentteina
- `ollama.model.<mallinimi>.memory_mb` - Tietyn mallin muistin käyttö megatavuina

#### Kokonaiskäyttö
- `ollama.total.cpu` - Kokonais-CPU-käyttö
- `ollama.total.memory_percent` - Kokonaismuistin käyttö prosentteina
- `ollama.total.memory_mb` - Kokonaismuistin käyttö megatavuina

#### API-tiedot
- `ollama.api.models_count` - Saatavilla olevien mallien määrä

## Käyttöesimerkkejä

### Resurssien käytön seuranta kuormitustestien aikana

1. Käynnistä Netdata-palvelu:
   ```bash
   brew services start netdata
   ```

2. Käynnistä Ollama-monitorointi:
   ```bash
   npm run monitor:ollama:netdata
   ```

3. Avaa Netdata-käyttöliittymä selaimessa:
   [http://localhost:19999](http://localhost:19999)

4. Suorita kuormitustestit:
   ```bash
   npm run test:load
   ```

5. Seuraa resurssien käyttöä Netdata-käyttöliittymässä.

### Eri mallien vertailu

1. Käynnistä monitorointi kuten yllä.
2. Lämmitä mallit:
   ```bash
   npm run warmup:ollama
   ```
3. Vertaile eri mallien resurssien käyttöä Netdata-käyttöliittymässä.

## Dashboardit

Netdata-käyttöliittymässä voit luoda mukautettuja dashboardeja, jotka näyttävät sinulle tärkeimmät mittarit. Voit esimerkiksi luoda dashboardin, joka näyttää:

- CPU-käyttö malleittain
- Muistin käyttö malleittain
- Kokonaiskäyttö ajan funktiona

## Hälytykset

Netdata tukee hälytysten määrittämistä. Voit määrittää hälytyksiä, jotka ilmoittavat, kun:

- CPU-käyttö ylittää tietyn rajan
- Muistin käyttö ylittää tietyn rajan
- Mallien määrä muuttuu

## Vianmääritys

Jos kohtaat ongelmia:

1. Varmista, että Netdata-palvelu on käynnissä:
   ```bash
   brew services list | grep netdata
   ```

2. Varmista, että Ollama-palvelu on käynnissä:
   ```bash
   curl -s http://localhost:11434/api/tags
   ```

3. Tarkista, että StatsD-portti (8125) on käytettävissä:
   ```bash
   lsof -i :8125
   ```

## Lisätietoja

- [Netdata-dokumentaatio](https://learn.netdata.cloud/)
- [StatsD-dokumentaatio](https://github.com/statsd/statsd)
- [Ollama-dokumentaatio](https://ollama.ai/)
