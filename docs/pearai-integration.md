# PearAI-integraatio

Tämä dokumentti kuvaa, miten PearAI-integraatio toimii osana AI-pohjaista koodin kehitys- ja optimointityönkulkua.

## Mikä on PearAI?

PearAI on tekoälypohjainen koodin optimointityökalu, joka analysoi koodia ja tekee automaattisesti parannusehdotuksia. Se voi:

- Tunnistaa ja korjata suorituskykyongelmia
- Poistaa käyttämättömiä importteja ja koodia
- Refaktoroida monimutkaisia funktioita
- Parantaa koodin luettavuutta ja ylläpidettävyyttä
- Korjata tietoturvaongelmia ja haavoittuvuuksia

## Integraatio SonarQuben kanssa

PearAI-integraatio on optimoitu toimimaan SonarQuben kanssa:

1. SonarQube tunnistaa koodin ongelmat ja haavoittuvuudet
2. PearAI keskittyy korjaamaan vain SonarQuben havaitsemat ongelmat
3. Tämä kohdistettu lähestymistapa varmistaa, että optimoinnit ovat relevantteja ja tehokkaita

## PearAI CLI -työkalu GitHub Actions -työnkulussa

GitHub Actions -työnkulussa PearAI-integraatio toimii CLI-työkalun kautta:

```yaml
- name: Run PearAI with Custom AI API Key
  run: |
    pearai optimize sonar-report.json --api-key="${{ secrets.AI_API_KEY }}" > optimized-code.zip
    unzip optimized-code.zip -d optimized/
```

Tämä komento:
1. Käyttää `pearai` CLI-työkalua
2. Optimoi koodin SonarQube-raportin perusteella
3. Käyttää mukautettua AI API -avainta
4. Tallentaa optimoidun koodin zip-tiedostoon
5. Purkaa zip-tiedoston optimized/-hakemistoon

## SonarQube-raportin rakenne

SonarQube API palauttaa JSON-muotoisen raportin, joka sisältää kaikki havaitut ongelmat:

```json
{
  "total": 3,
  "issues": [
    {
      "key": "AYxyz123456",
      "component": "maaninentupee_EvilScraper:src/utils.ts",
      "line": 15,
      "message": "Remove this unused import of 'useMemo'",
      "severity": "MINOR",
      "type": "CODE_SMELL"
    },
    {
      "key": "AYxyz789012",
      "component": "maaninentupee_EvilScraper:src/api.ts",
      "line": 42,
      "message": "Add type annotations to this function's parameters",
      "severity": "MAJOR",
      "type": "CODE_SMELL"
    }
  ]
}
```

## PearAI-optimoinnin tulokset

PearAI tuottaa optimoidun koodin, joka sisältää korjaukset SonarQuben havaitsemiin ongelmiin. Optimoitu koodi pakataan zip-tiedostoon, joka sisältää:

1. Korjatut tiedostot alkuperäisellä hakemistorakenteella
2. Yhteenvetoraportin optimoinneista (summary.json)
3. Yksityiskohtaisen lokitiedoston tehdyistä muutoksista (changes.log)

## Korjausten soveltaminen

GitHub Actions -työnkulussa PearAI:n optimoima koodi sovelletaan automaattisesti:

```yaml
- name: Commit Optimized Code
  run: |
    git config --global user.name "github-actions"
    git config --global user.email "actions@github.com"
    git checkout -b pearai-optimized
    cp -r optimized/* .
    git add .
    git commit -m "PearAI optimized code based on SonarQube analysis"
    git push origin pearai-optimized
```

Tämä skripti:
1. Luo uuden haaran nimeltä "pearai-optimized"
2. Kopioi optimoidun koodin projektihakemistoon
3. Commitoi ja työntää muutokset uuteen haaraan

## Pull Request -prosessi

Korjausten jälkeen GitHub Actions luo automaattisesti pull requestin:

```yaml
- name: Create Pull Request for Optimized Code
  uses: repo-sync/pull-request@v2
  with:
    source_branch: "pearai-optimized"
    destination_branch: "main"
    pr_title: "PearAI Optimized Code"
    pr_body: "This PR contains AI-optimized fixes based on SonarQube analysis."
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Mac Mini -ympäristö

GitHub Actions -työnkulku on optimoitu Mac Mini -ympäristölle:

```yaml
jobs:
  analyze-and-optimize:
    runs-on: macos-latest  # Mac Mini -yhteensopiva ympäristö
```

Tämä mahdollistaa tehokkaan suorituskyvyn ja yhteensopivuuden macOS-spesifisten työkalujen kanssa.

## Parhaat käytännöt

1. **Tarkista aina optimoinnit** ennen niiden hyväksymistä
2. **Testaa muutokset** varmistaaksesi, että ne eivät riko toiminnallisuutta
3. **Päivitä AI API -avain** säännöllisesti turvallisuuden varmistamiseksi
4. **Varmista, että GitHub-salaisuudet on määritetty** (SONAR_TOKEN ja AI_API_KEY)
5. **Hyödynnä Mac Mini -ympäristöä** macOS-spesifisten ominaisuuksien testaamiseen
