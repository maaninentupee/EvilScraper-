# GitHub-salaisuuksien määrittäminen

Tämä dokumentti opastaa, miten määrität tarvittavat GitHub-salaisuudet CI/CD-työnkulkua varten.

## Tarvittavat salaisuudet

CI/CD-työnkulku vaatii seuraavat salaisuudet:

1. **SONAR_TOKEN**: SonarQube-integraatiota varten
2. **AI_API_KEY**: PearAI-optimointia varten

## SONAR_TOKEN-salaisuuden lisääminen

1. Kirjaudu [SonarCloud](https://sonarcloud.io/)-palveluun
2. Siirry käyttäjäasetuksiin (My Account > Security)
3. Luo uusi token nimellä "GitHub Actions"
4. Kopioi generoitu token

Lisää token GitHub-repositorioosi:

1. Siirry GitHub-repositoriosi asetuksiin
2. Valitse "Secrets and variables" > "Actions"
3. Klikkaa "New repository secret"
4. Aseta nimeksi `SONAR_TOKEN`
5. Liitä SonarCloud-token arvokenttään
6. Klikkaa "Add secret"

## AI_API_KEY-salaisuuden lisääminen

1. Kirjaudu [PearAI](https://pearai.com/)-palveluun
2. Siirry API-avaimet -osioon
3. Luo uusi API-avain nimellä "GitHub Actions"
4. Kopioi generoitu API-avain

Lisää API-avain GitHub-repositorioosi:

1. Siirry GitHub-repositoriosi asetuksiin
2. Valitse "Secrets and variables" > "Actions"
3. Klikkaa "New repository secret"
4. Aseta nimeksi `AI_API_KEY`
5. Liitä PearAI API-avain arvokenttään
6. Klikkaa "Add secret"

## Salaisuuksien käyttö GitHub Actions -työnkulussa

GitHub Actions -työnkulku käyttää näitä salaisuuksia seuraavasti:

```yaml
- name: 🔍 Run SonarQube Analysis
  uses: sonarsource/sonarqube-scan-action@master
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

- name: 🧠 Run PearAI with Custom AI API Key
  run: |
    pearai optimize sonar-report.json --api-key="${{ secrets.AI_API_KEY }}" > optimized-code.zip
```

## Salaisuuksien turvallisuus

GitHub salaa salaisuudet ja välittää ne työnkulkuun vain tarvittaessa. Salaisuudet eivät koskaan näy GitHub Actions -lokeissa, vaikka yrittäisit tulostaa ne.

**HUOM!** Älä koskaan sisällytä näitä salaisuuksia suoraan koodiin tai työnkulkutiedostoihin. Käytä aina `${{ secrets.SECRET_NAME }}` -syntaksia.
