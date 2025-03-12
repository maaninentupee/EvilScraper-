# Manuaalinen testaus

Tämä dokumentti sisältää ohjeita Windsurf-projektin manuaaliseen testaukseen, erityisesti virhetilanteiden simulointiin.

## Virhetilanteiden testaus

Järjestelmän vikasietoisuuden testaaminen on tärkeä osa laadunvarmistusta. Tässä on ohjeita erilaisten virhetilanteiden simulointiin.

### API-avaimen virhetilanne

OpenAI API-avaimen virhetilanne voidaan simuloida asettamalla virheellinen API-avain:

```bash
# Manuaalinen tapa
export OPENAI_API_KEY=invalid_key
npm run test

# Tai käyttämällä testiskriptiä
./scripts/test-api-key-failure.sh
```

Tämän testin pitäisi osoittaa, että:

1. Järjestelmä tunnistaa virheellisen API-avaimen
2. OpenAIProvider raportoi olevansa poissa käytöstä (isAvailable palauttaa false)
3. Virhetilanteessa järjestelmä siirtyy käyttämään muita saatavilla olevia palveluntarjoajia
4. Virheet kirjataan asianmukaisesti lokiin

### Verkkoviiveiden ja aikakatkojen testaus

Verkkoviiveitä ja aikakatkoja voidaan testata käyttämällä testiskriptiä, joka simuloi erilaisia verkko-ongelmia:

```bash
# Verkkoviiveiden testaaminen
npm run test:network-delay

# Tai käyttämällä laajempaa testiskriptiä
./scripts/test-network-delay.sh
```

Tämä testi simuloi seuraavia verkko-ongelmia:

1. Lyhyet viiveet (500ms)
2. Keskipitkät viiveet (2000ms)
3. Pitkät viiveet (8000ms)
4. Aikakatkaisut (15000ms)
5. Yhteyden katkaisut
6. Virheelliset vastaukset
7. Palvelinvirheet

Testit osoittavat, että järjestelmä:

1. Käsittelee verkkoviiveet asianmukaisesti
2. Tunnistaa aikakatkaisut ja raportoi niistä
3. Toipuu yhteyden katkaisuista
4. Käsittelee virheelliset vastaukset oikein
5. Siirtyy käyttämään vaihtoehtoisia palveluntarjoajia tarvittaessa

### Palveluntarjoajan saatavuuden testaus

Voit testata, miten järjestelmä käyttäytyy, kun tietty palveluntarjoaja ei ole saatavilla:

```bash
# Poista OpenAI käytöstä
export USE_OPENAI=false
npm run test

# Poista Ollama käytöstä
export USE_OLLAMA=false
npm run test

# Poista LMStudio käytöstä
export USE_LM_STUDIO=false
npm run test
```

### Palveluntarjoajan prioriteetin muuttaminen

Voit testata palveluntarjoajien prioriteettijärjestystä muuttamalla prioriteettiarvoja:

```bash
# Aseta Ollama korkeimmalle prioriteetille
export OLLAMA_PRIORITY=1
export LMSTUDIO_PRIORITY=2
export OPENAI_PRIORITY=3
npm run test
```

### Verkkoyhteyden katkeamisen simulointi

Voit simuloida verkkoyhteyden katkeamista käyttämällä työkaluja kuten `iptables` (Linux) tai Network Link Conditioner (macOS):

```bash
# macOS: Käytä Network Link Conditioner -työkalua
# Linux: Estä yhteydet tiettyyn porttiin
sudo iptables -A OUTPUT -p tcp --dport 443 -j DROP
npm run test
sudo iptables -D OUTPUT -p tcp --dport 443 -j DROP
```

### Muistin loppumisen simulointi

Voit testata järjestelmän käyttäytymistä muistin loppuessa käyttämällä Node.js:n muistirajoitusta:

```bash
NODE_OPTIONS="--max-old-space-size=100" npm run test
```

## Testitulosten tulkinta

Manuaalisten testien tuloksia tulkittaessa kiinnitä huomiota seuraaviin asioihin:

1. Virheviestien selkeys ja informatiivisuus
2. Järjestelmän kyky palautua virhetilanteista
3. Vaihtoehtoisten palveluntarjoajien käyttöönotto
4. Lokitietojen kattavuus ja hyödyllisyys

## Testitulosten raportointi

Raportoi testien tulokset seuraavasti:

1. Testin kuvaus ja suoritustapa
2. Odotettu käyttäytyminen
3. Havaittu käyttäytyminen
4. Mahdolliset poikkeamat ja ongelmat
5. Ehdotukset järjestelmän parantamiseksi
