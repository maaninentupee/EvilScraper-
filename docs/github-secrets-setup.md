# GitHub-salaisuuksien määrittäminen

Tämä ohje neuvoo, miten lisäät tarvittavat salaisuudet GitHub-repositorioon AI-pohjaista koodin kehitys- ja optimointityönkulkua varten.

## Tarvittavat salaisuudet

1. **SONAR_TOKEN**: SonarQube-integraatiota varten
2. **PEARAI_TOKEN**: PearAI API -integraatiota varten

## Salaisuuksien lisääminen

1. Mene GitHub-repositoriosi sivulle
2. Valitse "Settings" (Asetukset) -välilehti
3. Valitse vasemmasta valikosta "Secrets and variables" → "Actions"
4. Klikkaa "New repository secret" -painiketta
5. Lisää salaisuudet yksi kerrallaan:

### SONAR_TOKEN

1. Kirjaudu SonarCloud-palveluun (https://sonarcloud.io/)
2. Mene käyttäjäprofiiliin → "My Account" → "Security"
3. Luo uusi token ja kopioi se
4. GitHub-repositoriossa:
   - Name: `SONAR_TOKEN`
   - Secret: [Liitä SonarCloud-token tähän]
5. Klikkaa "Add secret"

### PEARAI_TOKEN

1. Kirjaudu PearAI-palveluun
2. Mene API-avainten hallintaan
3. Luo uusi API-avain ja kopioi se
4. GitHub-repositoriossa:
   - Name: `PEARAI_TOKEN`
   - Secret: [Liitä PearAI API-avain tähän]
5. Klikkaa "Add secret"

## Salaisuuksien käyttö GitHub Actions -työnkulussa

Salaisuuksia käytetään GitHub Actions -työnkulussa seuraavasti:

```yaml
- name: SonarQube Scan
  uses: SonarSource/sonarcloud-github-action@master
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}

- name: Run PearAI optimization
  run: |
    # PearAI API -integraatio
  env:
    PEARAI_TOKEN: ${{ secrets.PEARAI_TOKEN }}
```

## Turvallisuushuomioita

- Älä koskaan jaa API-avaimia tai tokeneja julkisesti
- Varmista, että API-avaimilla on vain tarvittavat oikeudet
- Kierrätä avaimia säännöllisesti turvallisuuden varmistamiseksi
