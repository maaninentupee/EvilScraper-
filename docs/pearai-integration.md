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

## PearAI API -integraatio GitHub Actions -työnkulussa

GitHub Actions -työnkulussa PearAI-integraatio toimii seuraavasti:

```yaml
- name: Run PearAI Optimization (only for SonarQube issues)
  run: |
    curl -X POST "https://pearai.api/optimize" \
    -H "Authorization: Bearer ${{ secrets.PEARAI_TOKEN }}" \
    -H "Content-Type: application/json" \
    -d @sonar-report.json > pearai-fixes.json
```

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

## PearAI API -vastauksen rakenne

PearAI API palauttaa JSON-muotoisen vastauksen, joka sisältää korjaukset SonarQuben havaitsemiin ongelmiin:

```json
{
  "fixes": [
    {
      "file": "src/utils.ts",
      "code": "import { useState, useEffect } from 'react';\n\n// Muu koodi tässä..."
    },
    {
      "file": "src/api.ts",
      "code": "function parseArgs(args: string[]): ParsedArgs {\n  // Funktion sisältö...\n}"
    }
  ],
  "summary": {
    "issues_fixed": 2,
    "issues_skipped": 1,
    "reasons_skipped": ["Requires more context"]
  }
}
```

## Korjausten soveltaminen

GitHub Actions -työnkulussa PearAI:n ehdottamat korjaukset sovelletaan automaattisesti:

```yaml
- name: Apply AI Fixes to Detected Issues
  run: |
    git checkout -b ai-optimizations
    jq -r '.fixes[] | "echo \"\(.code)\" > \(.file)"' pearai-fixes.json | sh
    git add .
    git commit -m "AI Optimization from PearAI based on SonarQube analysis"
    git push origin ai-optimizations
```

Tämä skripti:
1. Luo uuden haaran nimeltä "ai-optimizations"
2. Käyttää `jq`-työkalua PearAI:n JSON-vastauksen käsittelyyn
3. Kirjoittaa korjatun koodin tiedostoihin
4. Commitoi ja työntää muutokset uuteen haaraan

## Pull Request -prosessi

Korjausten jälkeen GitHub Actions luo automaattisesti pull requestin:

```yaml
- name: Create Pull Request for AI Fixes
  uses: peter-evans/create-pull-request@v4
  with:
    title: "AI Optimizations from PearAI"
    body: "This PR contains automated fixes based on SonarQube analysis."
    branch: ai-optimizations
    token: ${{ secrets.GITHUB_TOKEN }}
```

## Ympäristön valinta

GitHub Actions -työnkulku on määritetty käyttämään macOS-ympäristöä, mutta voit vaihtaa sen Ubuntu-ympäristöön muokkaamalla työnkulkutiedostoa:

```yaml
jobs:
  analyze:
    runs-on: macos-latest  # Vaihda 'ubuntu-latest', jos et tarvitse macOS:ää
```

## Parhaat käytännöt

1. **Tarkista aina optimoinnit** ennen niiden hyväksymistä
2. **Testaa muutokset** varmistaaksesi, että ne eivät riko toiminnallisuutta
3. **Päivitä SonarQube API -kutsussa oleva projektiavain** vastaamaan omaa projektiasi
4. **Varmista, että GitHub-salaisuudet on määritetty** (SONAR_TOKEN ja PEARAI_TOKEN)
5. **Harkitse Ubuntu-ympäristön käyttöä** nopeampaa suoritusta varten, jos macOS-ominaisuuksia ei tarvita
