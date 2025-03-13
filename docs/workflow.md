# AI-pohjainen koodin kehitys- ja optimointityönkulku

Tämä dokumentti kuvaa projektin kehitys- ja optimointityönkulun, joka hyödyntää useita tekoälytyökaluja ja automaatiota koodin laadun parantamiseksi.

## Työnkulku vaiheittain

### 1️⃣ Koodin kirjoittaminen ja refaktorointi (Windsurf Editor + Cascade Agent)

- Windsurf Editorissa käytät Cascade Agentia, joka generoi koodia
- Koodi työstetään ja testataan Windsurfissa ennen pushaamista GitHubiin
- Tässä vaiheessa voit jo tehdä alustavia refaktorointeja, kuten parseArgs-funktion kognitiivisen monimutkaisuuden vähentäminen

### 2️⃣ Koodin työntäminen GitHubiin

- Kun koodi on valmis, pushaat sen GitHub-repoon
- Tämä käynnistää automaattisesti GitHub Actions -työnkulun
- GitHub Actions suorittaa testit ja lähettää koodin SonarQubeen analysoitavaksi

### 3️⃣ SonarQube analysoi koodin laadun ja haavoittuvuudet

- SonarQube analysoi GitHub-repossa olevan koodin
- Se tarkistaa tyyppivirheet, koodin hajanaisuuden, haavoittuvuudet ja suorituskykyongelmat
- Analyysin tulokset tallennetaan GitHub Actions -artefaktina myöhempää käyttöä varten
- Analyysin perusteella löydät ongelmat ennen optimointia

### 4️⃣ PearAI Editorin API-agentit optimoivat koodin

- PearAI:n agentit analysoivat koodin SonarQube-tulosten perusteella ja tekevät ehdotuksia optimointiin
- Agentti voi esimerkiksi:
  - Poistaa turhat importit
  - Refaktoroida ja parantaa suorituskykyä
  - Optimoida API-kutsut ja riippuvuudet
- GitHub Actions -työnkulku käynnistää PearAI-optimoinnin automaattisesti

### 5️⃣ Parannettu koodi ehdotetaan pull requestina

- PearAI:n optimoinnit luodaan uuteen haaraan
- GitHub Actions luo automaattisesti pull requestin, joka sisältää optimoidun koodin
- Kehittäjä voi tarkastella ehdotettuja muutoksia ja hyväksyä, muokata tai hylätä ne
- Tämä varmistaa, että kaikki muutokset käyvät läpi asianmukaisen tarkastuksen ennen päähaaraan yhdistämistä

## Miksi tämä työnkulku on tehokas?

- ✅ **Automaattinen analyysi**: Kaikki koodin laadun ja turvallisuuden tarkastukset tapahtuvat automaattisesti
- ✅ **Optimoitu koodi**: PearAI-agentit tekevät koodista tehokkaampaa ja paremmin ylläpidettävää
- ✅ **GitHub-versionhallinta**: Muutokset ovat dokumentoituja ja versionhallinnassa
- ✅ **Jatkuva parantaminen**: Jokaisen iteroinnin jälkeen koodi kehittyy paremmaksi
- ✅ **Laadunvarmistus**: Pull request -prosessi varmistaa, että kaikki muutokset tarkastetaan ennen käyttöönottoa

## Käyttöönotto

Työnkulun käyttöönotto vaatii seuraavat vaiheet:

1. GitHub-repositorion luominen ja koodin työntäminen sinne
2. GitHub Actions -työnkulun määrittäminen (.github/workflows/code-analysis.yml)
3. SonarQube-integraation määrittäminen (sonar-project.properties)
4. PearAI API -avaimen lisääminen GitHub-salaisuuksiin

## GitHub Actions -työnkulku

GitHub Actions -työnkulku on määritetty tiedostossa `.github/workflows/code-analysis.yml`. Se sisältää kaksi päävaihetta:

1. **Koodin analyysi (SonarQube)**:
   - Suorittaa testit ja lähettää koodin SonarQubeen
   - Tallentaa SonarQube-tulokset artefaktina

2. **Koodin optimointi (PearAI)**:
   - Lataa SonarQube-tulokset
   - Käyttää PearAI:ta koodin optimointiin
   - Luo uuden haaran optimoinneille
   - Luo pull requestin, joka sisältää optimoidun koodin

## Tarvittavat salaisuudet

GitHub-repositorioon tulee lisätä seuraavat salaisuudet:

- `SONAR_TOKEN`: SonarQube-integraatiota varten
- `PEARAI_TOKEN`: PearAI API -integraatiota varten

## Huomioitavaa

- GitHub Actions -työnkulku vaatii oikeudet pull requestien luomiseen
- PearAI-integraatio on tällä hetkellä kommentoitu esimerkki, joka tulee mukauttaa todelliseen API:iin
- SonarQube-analyysi vaatii SonarCloud-tilin ja projektin määrittämisen
