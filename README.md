# ai-act-scan

**Find the AI in a codebase and turn it into an EU AI Act inventory.**

Every AI Act programme starts with the same question: *which AI do we actually run?* Most teams answer it from memory and miss half of it. `ai-act-scan` answers it from the code: it reads your dependency manifests, imports, API hosts and env templates, lists every AI component it finds, and tells you which part of the regulation to look at for each one.

- Zero dependencies, runs locally, sends nothing anywhere
- JavaScript/TypeScript, Python, Go, Ruby, Java/Kotlin, Rust, .NET and PHP
- 55+ signatures: hosted LLM APIs, self-hosted models, agent frameworks, image and voice generation, biometrics, emotion recognition, ML frameworks, speech, vector stores
- Output as a readable report, Markdown, JSON or a CSV register
- A CI mode that fails the build when someone adds AI that is not in your inventory yet

```bash
npx github:jose-rdgz/ai-act-scan
```

```text
ai-act-scan 1.0.1  ·  5 files scanned in examples

7 AI components found  (1 review first, 3 transparency, 2 classify, 1 info)

REVIEW FIRST  Face recognition libraries  (Open source)
              Biometrics / face analysis
              hiring-ml/requirements.txt
TRANSPARENCY  Anthropic Claude API  (Anthropic)
              Hosted generative AI API
              support-bot/.env.example, support-bot/package.json
TRANSPARENCY  ElevenLabs (voice synthesis)  (ElevenLabs)
              Image, audio or video generation
              support-bot/.env.example, support-bot/src/voice.ts
CLASSIFY      scikit-learn  (Open source)
              Model training / inference framework
              hiring-ml/rank.py, hiring-ml/requirements.txt
...
```

## What the labels mean

| Label | Meaning | Where to look |
|---|---|---|
| **Review first** | Biometrics or emotion recognition. Some uses are prohibited, others are high-risk. | Art. 5(1)(e)-(g), Annex III point 1, Art. 50(3) |
| **Transparency** | Generative AI. If people interact with it or you publish its output, disclosure and marking duties apply (since 2 August 2026). | Art. 50 |
| **Classify** | Your own models. The tier depends entirely on what they decide. | Art. 6, Annex III (from 2 December 2027) |
| **Info** | Supporting components such as vector stores. | |

These are signals, not a verdict. A library does not have a risk tier; a *use* does. The same `scikit-learn` model is minimal risk when it forecasts stock levels and high-risk when it ranks job applicants. The scanner tells you where to look, and you (or the [free 7-question assessment](https://eurogpsr.com/ai-act/assess?utm_source=ai-act-scan&utm_medium=readme)) decide the tier.

## Usage

```bash
ai-act-scan [path] [options]

--json                machine-readable inventory on stdout
--md                  Markdown report on stdout
--csv [file]          CSV register (stdout if no file is given)
--baseline <file>     an earlier --json output; marks components that are new
--fail-on <rule>      exit 1 when: new | review-first | any
--github-summary      also write the Markdown report to the GitHub job summary
```

Install it once if you prefer: `npm i -g github:jose-rdgz/ai-act-scan`. Node 18 or later.

### Keep the register

```bash
ai-act-scan --csv ai-inventory.csv
```

The CSV has the columns of the [EuroComply AI inventory template](https://eurogpsr.com/tools/ai-inventory-template?utm_source=ai-act-scan&utm_medium=readme) (system, purpose, vendor, owner, personal data, affects people, risk tier) plus where each component was detected. Purpose and owner are left empty on purpose: code cannot know them, and they are what decides the tier.

### Stop shadow AI in pull requests

Commit a baseline, then fail any pull request that adds an AI component nobody has reviewed:

```bash
ai-act-scan --json > .ai-inventory.json     # once, and after each review
ai-act-scan --baseline .ai-inventory.json --fail-on new
```

## GitHub Action

```yaml
name: AI inventory
on: [pull_request]
permissions:
  contents: read
jobs:
  ai-act-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: jose-rdgz/ai-act-scan@v1
        with:
          baseline: .ai-inventory.json   # optional
          fail-on: new                   # optional: new | review-first | any
```

The report is written to the job summary. Inputs: `path`, `baseline`, `fail-on`, `csv`. Outputs: `total`, `review-first`, `new`.

## What it reads, and what it does not

| Source | Used for |
|---|---|
| `package.json`, `requirements*.txt`, `pyproject.toml`, `Pipfile`, `go.mod`, `Gemfile`, `Cargo.toml`, `pom.xml`, `build.gradle(.kts)`, `*.csproj`, `composer.json` | Declared dependencies (direct ones; lockfiles are skipped so transitive packages do not flood the report) |
| Source files | Known AI API hostnames; Python imports |
| `.env.example`, `.env.sample`, `.env.template` | Variable **names** only |
| `.onnx`, `.safetensors`, `.gguf`, `.tflite`, `.pth`, `.keras`, `.mlmodel` | Model weights committed to the repository |

It never opens a real `.env`, never reads values, never makes a network request, and skips `node_modules`, virtualenvs, build output and vendored code.

**Limits.** It cannot see AI you buy as a feature of other software (the CV screener inside your ATS, the chatbot inside your helpdesk), models called through a generic HTTP client on a host it does not know, or anything outside the repository. Add those to the register by hand.

## Use it as a library

```js
import { scan } from 'ai-act-scan';

const inventory = await scan('/path/to/repo');
console.log(inventory.summary, inventory.systems);
```

## Add a signature

One entry in [`src/signatures.mjs`](src/signatures.mjs) and one assertion in [`test/scan.test.mjs`](test/scan.test.mjs). Pull requests welcome, especially for SDKs and ecosystems that are missing.

## Dates used

Regulation (EU) 2024/1689 as amended by Regulation (EU) 2026/1744 (the Digital Omnibus on AI): prohibitions since 2 February 2025, Article 50 transparency since 2 August 2026 (machine-readable marking for systems already on the market: 2 December 2026), Annex III high-risk obligations from 2 December 2027, Annex I from 2 August 2028. Full timeline: [eurogpsr.com/ai-act/deadlines](https://eurogpsr.com/ai-act/deadlines).

## Not legal advice

General information to help you organise compliance work. Built by [EuroComply](https://eurogpsr.com/?utm_source=ai-act-scan&utm_medium=readme), which also offers a free AI Act risk assessment and an MCP server for AI assistants. MIT licensed.
