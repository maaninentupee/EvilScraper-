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
- GitHub Actions suorittaa SonarQube-analyysin koodille

### 3️⃣ SonarQube analysoi koodin laadun ja haavoittuvuudet

- SonarQube analysoi GitHub-repossa olevan koodin
- Se tarkistaa tyyppivirheet, koodin hajanaisuuden, haavoittuvuudet ja suorituskykyongelmat
- Analyysin tulokset haetaan SonarCloud API:n kautta ja tallennetaan JSON-muodossa
- Tämä raportti sisältää yksityiskohtaiset tiedot kaikista havaituista ongelmista

### 4️⃣ PearAI optimoi SonarQuben havaitsemat ongelmat

- PearAI API vastaanottaa SonarQube-raportin JSON-muodossa
- PearAI keskittyy vain SonarQuben havaitsemien ongelmien korjaamiseen
- Tämä varmistaa, että optimoinnit ovat kohdennettuja ja relevantteja
- PearAI tuottaa korjaukset JSON-muodossa, joka sisältää tiedostonimen ja korjatun koodin

### 5️⃣ Optimoinnit ehdotetaan pull requestina

- GitHub Actions luo uuden haaran (ai-optimizations) optimointeja varten
- PearAI:n tuottamat korjaukset sovelletaan tiedostoihin
- Muutokset commitoidaan ja työnnetään uuteen haaraan
- GitHub Actions luo automaattisesti pull requestin, joka sisältää kaikki optimoinnit
- Kehittäjä voi tarkastella, muokata tai hylätä ehdotettuja muutoksia

## Miksi tämä työnkulku on tehokas?

- ✅ **Kohdistetut optimoinnit**: PearAI keskittyy vain SonarQuben havaitsemiin ongelmiin
- ✅ **Joustava ympäristö**: Työnkulku toimii sekä macOS- että Ubuntu-ympäristöissä
- ✅ **Automaattinen analyysi**: Kaikki koodin laadun ja turvallisuuden tarkastukset tapahtuvat automaattisesti
- ✅ **Optimoitu koodi**: PearAI-agentit tekevät koodista tehokkaampaa ja paremmin ylläpidettävää
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
   - Suorittaa SonarQube-analyysin koodille
   - Hakee analyysin tulokset SonarCloud API:n kautta
   - Tallentaa tulokset JSON-muodossa artefaktina

2. **Koodin optimointi (PearAI)**:
   - Lataa SonarQube-tulokset
   - Lähettää tulokset PearAI API:lle optimointia varten
   - Soveltaa PearAI:n tuottamat korjaukset koodiin
   - Luo pull requestin, joka sisältää optimoidun koodin

## Tarvittavat salaisuudet

GitHub-repositorioon tulee lisätä seuraavat salaisuudet:

- `SONAR_TOKEN`: SonarQube-integraatiota varten
- `PEARAI_TOKEN`: PearAI API -integraatiota varten

## Huomioitavaa

- Muista päivittää SonarQube API -kutsussa oleva "YOUR_PROJECT_KEY" oikealla projektiavaimella
- GitHub Actions -työnkulku käynnistyy automaattisesti, kun koodia työnnetään main-, develop- tai feature/*-haaroihin
- macOS-ympäristö on oletuksena käytössä, mutta voit vaihtaa sen Ubuntu-ympäristöön muokkaamalla työnkulkutiedostoa
