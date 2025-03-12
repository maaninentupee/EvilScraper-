# Ollama-resurssien laajennettu analyysi

## Yleiskatsaus

Tämä dokumentti kuvaa laajennetun Ollama-resurssien analyysityökalun käyttöä ja tulkintaa. Laajennettu analyysi tarjoaa syvällisemmän näkemyksen Ollama-mallien resurssien käytöstä eri kuormitustasoilla ja eri malleilla.

## Laajennetun analyysin ominaisuudet

Laajennettu analyysityökalu (`analyze-ollama-resources-extended.sh`) sisältää seuraavat ominaisuudet:

1. **Järjestelmän tietojen kerääminen**:
   - CPU-tiedot (malli, ydinten määrä)
   - Muistitiedot (fyysinen muisti, swap)
   - Käyttöjärjestelmätiedot

2. **Kaikkien saatavilla olevien mallien testaus**:
   - Testaa automaattisesti kaikki Ollama-palvelussa saatavilla olevat mallit
   - Kerää tietoja jokaisesta mallista erikseen

3. **Eri rinnakkaisuustasojen testaus**:
   - Testaa jokaista mallia 1, 2 ja 5 samanaikaisella pyynnöllä
   - Analysoi resurssien käyttöä eri kuormitustasoilla

4. **Kattavampi resurssien seuranta**:
   - CPU-käyttö prosessikohtaisesti ja ytimittäin
   - Muistinkäyttö ja muistikartat
   - Verkkoaktiivisuus
   - Levyaktiivisuus

5. **Yksityiskohtainen raportointi**:
   - Yhteenvetoraportti Markdown-muodossa
   - Taulukot CPU- ja muistinkäytöstä malleittain ja rinnakkaisuustasoittain
   - Vasteaikojen analyysi

## Käyttö

Laajennetun analyysityökalun käyttö:

```bash
# Varmista, että Ollama-palvelu on käynnissä
# Varmista, että Windsurf-palvelin on käynnissä (npm run dev)

# Suorita laajennettu analyysi
./scripts/analyze-ollama-resources-extended.sh
```

Analyysin suorittaminen kestää huomattavasti kauemmin kuin perusanalyysin, koska se testaa jokaista mallia useilla eri rinnakkaisuustasoilla.

## Tulosten tulkinta

Laajennettu analyysi tuottaa kattavan raportin hakemistoon `ollama-resource-analysis-extended-[aikaleima]`. Pääraportti on `extended_summary.md`, joka sisältää:

### 1. CPU-käytön analyysi

CPU-käytön taulukko näyttää jokaisen mallin ja rinnakkaisuustason minimi-, maksimi- ja keskimääräisen CPU-käytön. Tämä auttaa tunnistamaan:

- Mitkä mallit käyttävät eniten CPU-resursseja
- Miten CPU-käyttö skaalautuu rinnakkaisuuden kasvaessa
- Mahdolliset pullonkaulat korkeilla rinnakkaisuustasoilla

### 2. Muistinkäytön analyysi

Muistinkäytön taulukko näyttää jokaisen mallin ja rinnakkaisuustason minimi-, maksimi- ja keskimääräisen muistinkäytön. Tämä auttaa tunnistamaan:

- Mitkä mallit käyttävät eniten muistia
- Miten muistinkäyttö skaalautuu rinnakkaisuuden kasvaessa
- Mahdolliset muistivuodot pitkäkestoisessa käytössä

### 3. Vasteaikojen analyysi

Vasteaikojen taulukko näyttää jokaisen mallin ja rinnakkaisuustason keskimääräisen vasteajan. Tämä auttaa:

- Vertailemaan eri mallien suorituskykyä
- Arvioimaan rinnakkaisuuden vaikutusta vasteaikoihin
- Tunnistamaan optimaalisen rinnakkaisuustason kullekin mallille

## Suositeltuja käyttötapauksia

Laajennettu analyysi on erityisen hyödyllinen seuraavissa tilanteissa:

1. **Mallin valinta**: Kun haluat valita optimaalisen mallin tiettyyn käyttötapaukseen suorituskyvyn ja resurssien käytön perusteella.

2. **Kapasiteetin suunnittelu**: Kun suunnittelet palvelinresursseja tuotantoympäristöön ja haluat tietää, kuinka paljon resursseja tarvitset tietyllä käyttäjämäärällä.

3. **Suorituskyvyn optimointi**: Kun haluat optimoida Ollama-konfiguraatiota (batch-size, ctx-size, threads) perustuen todellisiin suorituskykymittauksiin.

4. **Rinnakkaisuuden optimointi**: Kun haluat määrittää optimaalisen rinnakkaisuustason, joka tasapainottaa suorituskyvyn ja resurssien käytön.

## Rajoitukset

Laajennettu analyysi on kattava, mutta sillä on tiettyjä rajoituksia:

1. Analyysi voi kestää pitkään, erityisesti jos käytössä on useita malleja.
2. Korkeat rinnakkaisuustasot voivat aiheuttaa järjestelmän ylikuormittumisen.
3. Analyysi ei ota huomioon pitkäkestoisen käytön vaikutuksia (esim. muistivuodot pitkällä aikavälillä).
4. Tulokset voivat vaihdella järjestelmän muun kuormituksen mukaan.

## Jatkokehitysideoita

Laajennetun analyysin jatkokehitysideoita:

1. Graafinen visualisointi CPU- ja muistinkäytöstä ajan funktiona
2. Automaattinen konfiguraatioparametrien optimointi tulosten perusteella
3. Pitkäkestoisten testien tuki (tunteja tai päiviä)
4. Vertailu eri Ollama-versioiden välillä
5. Lämpötilan seuranta pitkäkestoisissa testeissä
