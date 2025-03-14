# AI-pohjainen koodin optimointi

Tämä dokumentti kuvaa, miten AI-pohjainen koodin optimointi toimii osana koodin kehitys- ja optimointityönkulkua.

## Tekoälymallit optimoinnissa

Työnkulku hyödyntää kahta tehokasta tekoälymallia koodin optimointiin:

1. **Anthropic Claude**: Käytetään ensisijaisena optimointimallina SonarQube-havaintojen korjaamiseen
2. **OpenAI GPT-4**: Käytetään toissijaisena mallina lisäoptimointien tekemiseen

Tämä kahden mallin lähestymistapa tarjoaa kattavamman optimoinnin, sillä mallit täydentävät toisiaan eri vahvuuksillaan.

## Integraatio SonarQuben kanssa

AI-optimointi on integroitu SonarQuben kanssa:

1. SonarQube tunnistaa koodin ongelmat ja haavoittuvuudet
2. Anthropic Claude keskittyy korjaamaan SonarQuben havaitsemat ongelmat
3. OpenAI GPT-4 tekee lisäoptimointeja ja refaktorointeja
4. Tämä kohdistettu lähestymistapa varmistaa, että optimoinnit ovat relevantteja ja tehokkaita

## AI API -integraatio GitHub Actions -työnkulussa

GitHub Actions -työnkulussa AI-integraatio toimii seuraavasti:

```yaml
- name: 🤖 Send code issues to Anthropic Claude for optimization
  run: |
    curl -X POST "https://api.anthropic.com/v1/complete" \
    -H "Authorization: Bearer ${{ secrets.ANTHROPIC_API_KEY }}" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "claude-3-opus-2024-02-22",
      "prompt": "Optimize the following code based on SonarQube report:\n" + cat sonar-report.json,
      "max_tokens": 500
    }' > anthropic-optimized.json

- name: 🤖 Send code issues to OpenAI GPT-4 for additional optimizations
  run: |
    curl -X POST "https://api.openai.com/v1/completions" \
    -H "Authorization: Bearer ${{ secrets.OPENAI_API_KEY }}" \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gpt-4-turbo",
      "prompt": "Refactor and improve performance of the following code:\n" + cat anthropic-optimized.json,
      "max_tokens": 500
    }' > openai-optimized.json
```

Tämä prosessi:
1. Lähettää SonarQube-raportin Anthropic Claudelle optimoitavaksi
2. Lähettää Clauden optimoidun koodin OpenAI GPT-4:lle lisäoptimointeja varten
3. Yhdistää molempien mallien optimoinnit lopulliseksi tulokseksi

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

## AI-optimoinnin tulokset

AI-mallit tuottavat optimoidun koodin, joka sisältää korjaukset SonarQuben havaitsemiin ongelmiin. Optimoitu koodi tallennetaan JSON-tiedostoon, joka sisältää:

1. Korjatut koodikatkelmat
2. Selitykset tehdyistä muutoksista
3. Suositukset jatkotoimenpiteistä

## Optimointien yhdistäminen

GitHub Actions -työnkulussa molempien AI-mallien optimoinnit yhdistetään:

```yaml
- name: 🔄 Merge Optimized Code
  run: |
    jq -s '.[0] * .[1]' anthropic-optimized.json openai-optimized.json > final-optimized.json
```

Tämä komento käyttää `jq`-työkalua yhdistämään molempien mallien JSON-tulokset yhdeksi optimoiduksi tulokseksi.

## Korjausten soveltaminen

GitHub Actions -työnkulussa AI-optimoitu koodi sovelletaan automaattisesti:

```yaml
- name: 🔄 Commit Optimized Code
  run: |
    git config --global user.name "github-actions"
    git config --global user.email "actions@github.com"
    git checkout -b ai-optimized
    cp optimized-code.json .
    git add .
    git commit -m "♻️ AI Optimized Code (Anthropic Claude & OpenAI GPT-4)"
    git push origin ai-optimized
```

Tämä skripti:
1. Luo uuden haaran nimeltä "ai-optimized"
2. Kopioi optimoidun koodin projektihakemistoon
3. Commitoi ja työntää muutokset uuteen haaraan

## Pull Request -prosessi

Korjausten jälkeen GitHub Actions luo automaattisesti pull requestin:

```yaml
- name: 🔀 Create Pull Request for Optimized Code
  uses: repo-sync/pull-request@v2
  with:
    source_branch: "ai-optimized"
    destination_branch: "main"
    pr_title: "♻️ AI Optimized Code (Claude & GPT-4)"
    pr_body: "This PR contains AI-optimized fixes based on SonarQube analysis using Anthropic Claude and OpenAI GPT-4."
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

## Mac Mini -ympäristö

GitHub Actions -työnkulku on optimoitu Mac Mini -ympäristölle:

```yaml
jobs:
  analyze-and-optimize:
    runs-on: macos-latest  # Käyttää macOS-ympäristöä
```

Tämä mahdollistaa tehokkaan suorituskyvyn ja yhteensopivuuden macOS-spesifisten työkalujen kanssa.

## Parhaat käytännöt

1. **Tarkista aina AI-optimoinnit** ennen niiden hyväksymistä
2. **Testaa muutokset** varmistaaksesi, että ne eivät riko toiminnallisuutta
3. **Päivitä API-avaimet** säännöllisesti turvallisuuden varmistamiseksi
4. **Varmista, että GitHub-salaisuudet on määritetty** (SONAR_TOKEN, ANTHROPIC_API_KEY ja OPENAI_API_KEY)
5. **Hyödynnä Mac Mini -ympäristöä** macOS-spesifisten ominaisuuksien testaamiseen
