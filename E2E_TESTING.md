# End-to-End (E2E) testaus Windsurf-projektissa

Tämä dokumentti kuvaa Windsurf-projektin End-to-End (E2E) testausstrategiaa ja -käytäntöjä.

## Yleiskatsaus

E2E-testit varmistavat, että koko järjestelmä toimii oikein käyttäjän näkökulmasta. Nämä testit simuloivat todellisia käyttötapauksia ja testaavat järjestelmän toimintaa päästä päähän.

## E2E-testien rakenne

Windsurf-projektin E2E-testit on jaettu kolmeen pääkategoriaan:

1. **Perustoiminnallisuudet** (`app.e2e-spec.ts`)
   - Testaa tervetulosivua ja terveystarkistuksia
   - Testaa scraper-toiminnallisuutta
   - Testaa evil-bot päätöksentekoa
   - Testaa virheiden käsittelyä

2. **AI-palvelut** (`ai-providers.e2e-spec.ts`)
   - Testaa AI-palveluiden saatavuutta
   - Testaa mallien listausta
   - Testaa AI-palveluiden kuormitusta pienellä määrällä pyyntöjä

3. **Kuormitustestaus** (`load-testing.e2e-spec.ts`)
   - Testaa järjestelmän kykyä käsitellä useita samanaikaisia pyyntöjä
   - Varmistaa, että kuormitustestiskriptit ovat olemassa
   - Testaa AI-palveluiden kuormitustestausendpointteja

## E2E-testien ajaminen

E2E-testit vaativat, että palvelin on käynnissä. Testit käyttävät oletuksena osoitetta `http://localhost:3001`.

### Testien ajaminen

```bash
# Käynnistä palvelin ensin
npm run dev

# Toisessa terminaalissa, aja E2E-testit
npm run test:e2e
```

### Nopea testien ajaminen

Jos haluat ajaa vain nopeimmat testit (esim. CI/CD-ympäristössä tai kehityksen aikana):

```bash
npm run test:e2e:fast
```

### Testien ajaminen automaattisesti

Voit ajaa testit automaattisesti ilman erillistä palvelimen käynnistystä:

```bash
npm run test:e2e:all
```

Tämä skripti käynnistää palvelimen, ajaa testit ja sammuttaa palvelimen automaattisesti.

### Testien ajaminen Ollama-esilämmityksellä

Ollama-mallin ensimmäinen käynnistys voi olla hidas, mikä voi aiheuttaa aikakatkaisuja testeissä. Tämän vuoksi on suositeltavaa käyttää esilämmitystä ennen testien ajamista:

```bash
npm run test:e2e:with-warmup
```

Tämä komento suorittaa ensin `warmup-ollama.sh`-skriptin, joka esilämmittää Ollama-mallit, ja sen jälkeen ajaa E2E-testit.

## Testien konfiguraatio

E2E-testien konfiguraatio on määritelty tiedostossa `test/jest-e2e.json`. Konfiguraatio sisältää seuraavat asetukset:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": ".",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

## Testien aikakatkaisut

E2E-testit käyttävät pidempää aikakatkaisua (60-120 sekuntia) kuin yksikkötestit, koska AI-mallien lataaminen ja käyttö voi kestää kauemmin. Aikakatkaisut on määritelty kunkin testitiedoston alussa:

```typescript
// Nostetaan Jest-aikakatkaisua 60 sekuntiin
jest.setTimeout(60000); // 60 sekuntia
```

## Testien riippuvuudet

E2E-testit käyttävät seuraavia riippuvuuksia:

- **axios**: HTTP-pyyntöjen tekemiseen
- **jest**: Testien ajamiseen ja assertioihin
- **supertest**: HTTP-pyyntöjen tekemiseen ja assertioihin (vaihtoehtona axiosille)

## Testien laajentaminen

Kun lisäät uusia E2E-testejä, noudata seuraavia käytäntöjä:

1. Luo uusi testitiedosto `test/e2e/`-hakemistoon nimeämällä se muodossa `*.e2e-spec.ts`
2. Varmista, että testit ovat itsenäisiä ja eivät riipu toisistaan
3. Käytä riittävän pitkää aikakatkaisua AI-malleja käyttäville testeille
4. Lisää testeihin selkeät virheilmoitukset ja lokitukset
5. Varmista, että testit toimivat myös CI/CD-ympäristössä

## Testien vianhallinta

Jos E2E-testit epäonnistuvat, tarkista seuraavat asiat:

1. Onko palvelin käynnissä osoitteessa `http://localhost:3001`?
2. Ovatko kaikki tarvittavat ympäristömuuttujat määritelty?
3. Onko Ollama käynnissä ja ovatko mallit ladattu?
4. Onko järjestelmässä riittävästi muistia AI-mallien ajamiseen?

## Jatkuva integraatio (CI)

E2E-testit voidaan ajaa myös CI-ympäristössä. Tällöin on huomioitava seuraavat asiat:

1. CI-ympäristössä on oltava riittävästi muistia AI-mallien ajamiseen
2. Palvelin on käynnistettävä ennen testien ajamista
3. Ollama-mallit on esilämmitettävä ennen testien ajamista
4. Testien aikakatkaisut on säädettävä CI-ympäristöön sopiviksi

## Yhteenveto

E2E-testit ovat tärkeä osa Windsurf-projektin laadunvarmistusta. Ne varmistavat, että järjestelmä toimii oikein käyttäjän näkökulmasta ja että kaikki komponentit toimivat yhdessä odotetusti.
