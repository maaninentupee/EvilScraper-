# AIService

AIService on Windsurf AI:n ydinpalvelu, joka tarjoaa älykkään fallback-mekanismin eri tekoälypalveluntarjoajien välillä. Se mahdollistaa joustavan mallinvalinnan ja virheiden käsittelyn, priorisoiden malleja määritetyssä järjestyksessä.

## Ominaisuudet

- **Älykäs fallback-mekanismi**: Kun yksi malli tai palveluntarjoaja epäonnistuu, järjestelmä siirtyy automaattisesti seuraavaan vaihtoehtoon.
- **Palveluntarjoajien priorisointi**: Palveluntarjoajat priorisoidaan oletuksena järjestyksessä: LM Studio, Ollama, Local, OpenAI, Anthropic.
- **Tehtäväkohtaiset mallit**: Eri tehtävätyypit (SEO, koodigenerointi, päätöksenteko) käyttävät niihin parhaiten sopivia malleja.
- **Erikoistuneet API-kutsut**: Helppokäyttöiset API-kutsut eri käyttötarkoituksiin.

## Käyttö

### SEO-analyysi

```typescript
const result = await aiService.analyzeSEO({
  title: "Esimerkki otsikko",
  description: "Esimerkki metakuvaus",
  content: "Sivun sisältö..."
});
```

### Koodigenerointi

```typescript
const result = await aiService.generateCode({
  language: "typescript",
  description: "Funktio, joka tarkistaa onko annettu merkkijono palindromi",
  requirements: ["Toimii erikoismerkkien kanssa", "Ei välitä kirjainkoosta"]
});
```

### Päätöksenteko

```typescript
const result = await aiService.makeDecision({
  situation: "Kumpi teknologia valita projektiin?",
  options: ["React", "Angular", "Vue.js"]
});
```

## Sisäinen toiminta

1. **Prompt-generaatio**: Käyttäjän syötteestä rakennetaan asianmukainen kehote mallille.
2. **Mallin valinta**: Valitaan sopiva malli taskType-parametrin ja providerPriority-listan perusteella.
3. **Suoritus fallback-strategialla**: Yritetään suorittaa pyyntö järjestyksessä eri malleilla, kunnes onnistutaan.
4. **Virheiden käsittely**: Jos kaikki mallit epäonnistuvat, heitetään kattava virheviesti.

## Mallijärjestys ja fallback-strategia

Oletusarvoinen palveluntarjoajien prioriteettijärjestys:

1. **LM Studio** (paikallinen palvelin)
2. **Ollama** (paikallinen palvelin)
3. **Local models** (paikallinen palvelin)
4. **OpenAI** (pilvipalvelu)
5. **Anthropic** (pilvipalvelu)

Tätä järjestystä voidaan muokata tarvittaessa.

## Virhetilanteiden käsittely

- Jos malli epäonnistuu, siirrytään seuraavaan malliin järjestyksessä.
- Jos kaikki mallit epäonnistuvat, heitetään virheviesti, joka sisältää kaikkien epäonnistumisten syyt.
- Virheet lokitetaan aina NestJS Loggerin avulla.

## Integraatio muihin palveluihin

AIService integroi:

- **ModelSelector**: Mallien valinta ja kyvykkyyksien tarkistus
- **AIGateway**: Varsinainen mallien suoritus ja kommunikointi
- **AIController**: Tarjoaa REST API:n AIServicen toiminnoille

## Testaus

AIServicellä on kattavat testit, jotka varmistavat fallback-mekanismin ja eri skenaarioiden toimivuuden.

Testit kattavat:
- Onnistuneet suoritukset ensisijaisilla malleilla
- Fallback-strategian eri mallivariaatioilla
- Virheiden käsittelyn

## Suorituskykyhuomiot

- Paikalliset palveluntarjoajat (LM Studio, Ollama, Local models) priorisoidaan latenssin minimoimiseksi.
- Pilvipalvelut (OpenAI, Anthropic) toimivat fallback-vaihtoehtoina.
- Suorituskyvyn optimoimiseksi mallit valitaan käyttäen tehokkainta saatavilla olevaa mallia kuhunkin tehtävätyyppiin.

## Tulevat parannukset

- Mallinvalintaan liittyvien kyvykkyyksien tarkempi arviointi
- Kattavampi lokianalyysi suorituskyvystä
- Palveluntarjoajien dynaamisempi priorisointi saatavuuden ja suorituskyvyn perusteella
