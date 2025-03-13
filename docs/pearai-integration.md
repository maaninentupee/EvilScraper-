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

PearAI-integraatio on erityisen tehokas, kun se yhdistetään SonarQube-analyysiin:

1. SonarQube tunnistaa koodin ongelmat ja haavoittuvuudet
2. PearAI käyttää näitä tuloksia optimointien kohdistamiseen
3. Tämä yhdistelmä mahdollistaa älykkäämmät ja kohdennetummat optimoinnit

## PearAI API -integraatio GitHub Actions -työnkulussa

GitHub Actions -työnkulussa PearAI-integraatio toimii seuraavasti:

```yaml
- name: Run PearAI optimization
  run: |
    echo "PearAI optimointi käynnissä SonarQube-tulosten perusteella..."
    curl -X POST https://api.pearai.com/optimize \
      -H "Authorization: Bearer ${{ secrets.PEARAI_TOKEN }}" \
      -F "sonarqube_report=@report-task.txt" \
      -F "repo=${{ github.repository }}" \
      -F "branch=${{ github.ref }}" \
      -o pearai-results.json
  env:
    PEARAI_TOKEN: ${{ secrets.PEARAI_TOKEN }}
```

## PearAI API -vastauksen käsittely

PearAI API palauttaa JSON-muotoisen vastauksen, joka sisältää optimointiehdotukset. Esimerkki:

```json
{
  "optimizations": [
    {
      "file": "src/utils.ts",
      "line": 15,
      "original": "import { useState, useEffect, useMemo, useCallback } from 'react';",
      "optimized": "import { useState, useEffect } from 'react';",
      "reason": "Käyttämättömät importit poistettu: useMemo, useCallback"
    },
    {
      "file": "src/api.ts",
      "line": 42,
      "original": "function parseArgs(args) { /* ... */ }",
      "optimized": "function parseArgs(args: string[]): ParsedArgs { /* ... */ }",
      "reason": "Lisätty tyyppimäärittelyt parantamaan koodin luettavuutta ja turvallisuutta"
    }
  ],
  "summary": {
    "files_analyzed": 25,
    "optimizations_found": 12,
    "estimated_performance_improvement": "15%"
  }
}
```

## Optimointien soveltaminen

GitHub Actions -työnkulussa PearAI:n ehdottamat optimoinnit voidaan soveltaa automaattisesti:

1. Lataa optimointiehdotukset JSON-muodossa
2. Käy läpi ehdotukset ja tee muutokset tiedostoihin
3. Commitoi muutokset uuteen haaraan
4. Luo pull request, joka sisältää kaikki optimoinnit

## Optimointien tarkastelu ja hyväksyminen

Kehittäjän vastuulla on tarkastella PearAI:n ehdottamia optimointeja:

1. Tarkista pull requestissa olevat muutokset
2. Testaa muutokset tarvittaessa
3. Hyväksy, muokkaa tai hylkää ehdotukset
4. Yhdistä hyväksytyt muutokset päähaaraan

## PearAI-integraation konfigurointi

PearAI-integraatiota voidaan konfiguroida tarkemmin lisäämällä `pearai.config.json`-tiedosto projektin juureen:

```json
{
  "optimization_level": "aggressive",
  "focus_areas": ["performance", "security", "maintainability"],
  "ignore_patterns": ["**/*.test.ts", "**/*.spec.ts"],
  "max_suggestions_per_file": 10,
  "sonarqube_integration": {
    "enabled": true,
    "prioritize_issues": true
  }
}
```

## Parhaat käytännöt

1. **Tarkista aina optimoinnit** ennen niiden hyväksymistä
2. **Testaa muutokset** varmistaaksesi, että ne eivät riko toiminnallisuutta
3. **Käytä versionhallintaa** optimointien hallintaan
4. **Päivitä PearAI-konfiguraatiota** projektin tarpeiden mukaan
5. **Yhdistä manuaalinen tarkastelu ja automaatio** parhaan tuloksen saavuttamiseksi
