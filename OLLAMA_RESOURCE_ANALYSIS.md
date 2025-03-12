# Ollama-resurssien analyysi

## Yhteenveto

Tämä dokumentti analysoi Ollama-palvelun resurssien käyttöä Windsurf-projektissa. Analyysi perustuu `analyze-ollama-resources.sh`-skriptin tuottamiin tuloksiin, jotka kerättiin 3.3.2025.

## Käytössä olevat mallit

Ollama-palvelussa on käytössä seuraavat mallit:

| Malli | Koko | Parametrien määrä | Kvantisointitaso |
|-------|------|-------------------|------------------|
| llama2:13b | 7.0 GB | 13B | Q4_0 |
| codellama:7b-code | 3.6 GB | 7B | Q4_0 |
| mistral:latest | 3.9 GB | 7.2B | Q4_0 |

## CPU-käytön analyysi

### Perustilanne (ennen kuormitusta)

- Ollama serve -prosessi: ~22.4% CPU
- Ollama runner -prosessi: ~1.2% CPU
- Järjestelmän kokonaiskuorma: 2.06, 3.42, 3.66 (1, 5, 15 min)
- CPU-käyttö: 39.44% käyttäjä, 25.92% järjestelmä, 34.62% vapaa

### Kuormituksen aikana

- CPU-käyttö vaihteli välillä 15-45% käyttäjäprosesseille
- Järjestelmäprosessien CPU-käyttö vaihteli välillä 8-15%
- Järjestelmän kokonaiskuorma pysyi melko tasaisena (~2.0-2.1 yhden minuutin keskiarvolla)

### Kuormituksen jälkeen

- CPU-käyttö palautui normaalille tasolle
- Ollama-prosessien CPU-käyttö laski lähes nollaan
- Järjestelmän kokonaiskuorma laski hieman: 1.94, 3.25, 3.59 (1, 5, 15 min)

## Muistinkäytön analyysi

### Perustilanne

- Ollama serve -prosessi: ~26 MB (0.2% muistista)
- Ollama runner -prosessi: ~578 MB (3.4% muistista)
- Kokonaismuistinkäyttö: 15 GB (10 GB wired, 3.1 GB compressor)
- Swap-käyttö: 3.1 GB / 4.0 GB

### Kuormituksen aikana

- Ollama runner -prosessin muistinkäyttö pysyi melko tasaisena (~562 MB)
- Ollama serve -prosessin muistinkäyttö laski hieman (~24 MB)
- Kokonaismuistinkäyttö pysyi vakaana

### Kuormituksen jälkeen

- Ollama-prosessien muistinkäyttö pysyi lähes samana kuin kuormituksen aikana
- Kokonaismuistinkäyttö: 15 GB (1.4 GB wired, 2.7 GB compressor)
- Swap-käyttö pysyi samana: 3.1 GB / 4.0 GB

## Havainnot ja johtopäätökset

1. **CPU-käyttö**: 
   - Ollama-palvelu käyttää merkittävästi CPU-resursseja erityisesti käynnistyksen yhteydessä
   - Kuormituksen aikana CPU-käyttö nousee, mutta pysyy kohtuullisella tasolla
   - Järjestelmä palautuu nopeasti normaalitilaan kuormituksen jälkeen

2. **Muistinkäyttö**:
   - Ollama runner -prosessi käyttää merkittävästi muistia (~560-580 MB)
   - Muistinkäyttö pysyy melko vakaana kuormituksen aikana
   - Swap-muistia käytetään huomattavasti (3.1 GB), mikä voi vaikuttaa suorituskykyyn

3. **Mallit**:
   - Suurin malli (llama2:13b) vie eniten levytilaa (7.0 GB)
   - Kaikki mallit käyttävät Q4_0-kvantisointia, mikä on hyvä kompromissi tarkkuuden ja resurssien käytön välillä

## Suositukset

1. **CPU-optimointi**:
   - Harkitse Ollama-prosessin thread-määrän optimointia (`--threads` parametri)
   - Testaa eri batch-size-arvoja (`--batch-size` parametri) optimaalisen suorituskyvyn löytämiseksi
   - Monitoroi CPU-käyttöä pitkäkestoisissa kuormitustilanteissa

2. **Muistin optimointi**:
   - Harkitse pienempien mallien käyttöä, jos 13B-malli ei ole välttämätön
   - Varmista, että järjestelmässä on riittävästi fyysistä muistia swap-käytön vähentämiseksi
   - Testaa eri context size -arvoja (`--ctx-size` parametri) muistinkäytön optimoimiseksi

3. **Kuormitustestaus**:
   - Tee pidempiä kuormitustestejä (10+ samanaikaista pyyntöä)
   - Testaa eri malleja ja vertaile niiden resurssien käyttöä
   - Monitoroi lämpötiloja pitkäkestoisissa kuormitustilanteissa

4. **Skaalautuvuus**:
   - Harkitse Ollama-palvelun ajamista erillisellä palvelimella raskaassa käytössä
   - Testaa rinnakkaisten Ollama-instanssien käyttöä kuorman jakamiseksi
   - Implementoi automaattinen skaalaus kuormituksen mukaan

## Jatkotoimenpiteet

1. Päivitä `analyze-ollama-resources.sh`-skriptiä keräämään tietoja pidemmältä ajalta
2. Toteuta vertailutestit eri mallien välillä
3. Testaa eri konfiguraatioparametreja ja niiden vaikutusta suorituskykyyn
4. Implementoi automaattinen monitorointi tuotantoympäristöön
