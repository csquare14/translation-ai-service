# 🌐 Translation AI Service

**AI/LLM core of the Serverless AI-Driven Language Translation System** — a context-aware, domain-intelligent translation pipeline built on AWS (Amazon Translate + Amazon Bedrock).

Unlike a plain text translator, this service **detects the document domain**, **locks domain terminology**, translates with a neural engine, and then **scores its own output** with an LLM-as-a-Judge, returning a structured **Quality Report** with every translation.

> 🎓 SRM University Delhi-NCR, Sonepat · Supervisor: Mr. Vikas Deswal
> 👥 Team: Rashi Kaushik, Rakshita, Chiranjan Bora, Suhani

---

## 📑 Table of Contents

1. [Why it is different](#-why-it-is-different)
2. [AI pipeline flowchart](#-ai-pipeline-flowchart)
3. [System architecture](#-system-architecture)
4. [Request sequence](#-request-sequence)
5. [Project structure](#-project-structure)
6. [Getting started](#-getting-started)
7. [Usage and sample output](#-usage-and-sample-output)
8. [Integration contract](#-integration-contract-for-the-team)
9. [Data model](#-data-model-dynamodb)
10. [Roadmap](#-roadmap)
11. [Security notes](#-security-notes)

---

## ✨ Why it is different

| Feature | Standard translator (e.g. Google Translate) | **Translation AI Service** |
|---|---|---|
| Target | General-purpose text strings | Enterprise documents and domain text |
| Domain adaptation | Limited / manual | **Automatic domain detection** (Legal, Medical, IT, Finance) |
| Terminology | None | **Custom glossary lock** via Amazon Translate terminologies |
| Quality control | None (raw output) | **LLM quality score + report** (fluency, terminology, issues) |
| Infrastructure | Fixed servers | **Serverless AWS** (Lambda, API Gateway, S3, DynamoDB) |
| Security / audit | Basic web form | Cognito auth, IAM roles, CloudWatch logs |
| Cost model | Always-on hardware | Pay-per-use, scales to zero |

---

## 🔄 AI pipeline flowchart

The core function `process_translation_pipeline()` runs three stages: **pre-processing**, **translation**, **post-processing**.

```mermaid
flowchart TD
    A([Input text + source/target language]) --> B[Step 1: Pre-processing<br/>detect_domain - Amazon Bedrock LLM]
    B --> C{Domain detected?}
    C -- Legal / Medical / IT_Software / Finance --> D[Attach custom terminology<br/>DOMAIN_Glossary]
    C -- General or error --> E[No glossary]
    D --> F[Step 2: Translation core<br/>Amazon Translate translate_text]
    E --> F
    F --> G[Step 3: Post-processing<br/>evaluate_translation - Bedrock LLM-as-a-Judge]
    G --> H{Valid JSON<br/>report?}
    H -- Yes --> I[Parse with Pydantic<br/>QualityReport]
    H -- No --> J[Fallback default report]
    I --> K[Step 4: Package result]
    J --> K
    K --> L([Return JSON: translated_text,<br/>detected_domain, quality_report])

    style B fill:#dbeafe,stroke:#2563eb
    style F fill:#dcfce7,stroke:#16a34a
    style G fill:#fef3c7,stroke:#d97706
    style L fill:#f3e8ff,stroke:#9333ea
```

---

## 🏗️ System architecture

Your AI module (`ai_core/`) plugs into the serverless backend as a library inside the Lambda function.

```mermaid
flowchart LR
    U[👤 User] --> FE[Frontend<br/>React / HTML]
    FE -- JWT login --> COG[Amazon Cognito<br/>User Pool]
    FE -- HTTPS + Bearer token --> APIGW[API Gateway<br/>/translate  /jobs  /jobs/id]
    APIGW --> LAM

    subgraph LAM[AWS Lambda - handler.py]
        direction TB
        AI[ai_core package<br/>process_translation_pipeline]
    end

    AI --> BR[Amazon Bedrock<br/>Claude / Nova<br/>domain + quality]
    AI --> TR[Amazon Translate<br/>+ custom terminology]
    LAM --> DDB[(DynamoDB<br/>TranslationJobs)]
    LAM --> S3[(Amazon S3<br/>source + translated docs)]
    S3 -. ObjectCreated event .-> LAM
    LAM --> CW[CloudWatch<br/>logs and metrics]

    style AI fill:#fef3c7,stroke:#d97706
    style LAM fill:#f8fafc,stroke:#64748b
```

---

## 📡 Request sequence

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant FE as Frontend
    participant API as API Gateway
    participant L as Lambda (ai_core)
    participant BR as Bedrock LLM
    participant TR as Amazon Translate
    participant DB as DynamoDB

    User->>FE: Paste text / upload document
    FE->>API: POST /translate (Bearer JWT)
    API->>L: Invoke handler (authorized)
    L->>BR: Classify domain
    BR-->>L: Medical
    L->>TR: translate_text + Medical_Glossary
    TR-->>L: Translated text
    L->>BR: Evaluate quality (source vs translation)
    BR-->>L: JSON quality report
    L->>DB: Save job (domain, score, report)
    L-->>API: translated_text + quality_report
    API-->>FE: 200 OK (JSON)
    FE-->>User: Side-by-side view + domain badge + quality card
```

---

## 📁 Project structure

```text
translation-ai-service/
├── ai_core/
│   ├── __init__.py        # exports process_translation_pipeline
│   ├── classifier.py      # detect_domain()      - Bedrock domain classifier
│   ├── evaluator.py       # evaluate_translation() - LLM quality scoring (Pydantic)
│   └── pipeline.py        # process_translation_pipeline() - master orchestrator
├── test_pipeline.py       # local end-to-end test
├── requirements.txt
└── .gitignore
```

```mermaid
flowchart LR
    T[test_pipeline.py / Lambda handler] --> P[pipeline.py]
    P --> C[classifier.py]
    P --> E[evaluator.py]
    C --> BR[(Bedrock)]
    E --> BR
    P --> TR[(Amazon Translate)]
```

---

## 🚀 Getting started

### Prerequisites

- Python 3.10+
- An AWS account with access to **Amazon Translate** and **Amazon Bedrock** (enable the Claude / Nova models in your region)
- VS Code with the *Python* and *AWS Toolkit* extensions (recommended)

### Setup

```bash
# 1. Clone
git clone https://github.com/csquare14/translation-ai-service.git
cd translation-ai-service

# 2. Virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 3. Dependencies
pip install -r requirements.txt

# 4. AWS credentials (use YOUR OWN IAM user - never share keys)
aws configure
```

`requirements.txt`

```text
boto3
botocore
pydantic
```

### Required IAM permissions

Ask the Cloud/DevOps lead for a dedicated IAM user with only:

- `bedrock:InvokeModel` / `bedrock:Converse`
- `translate:TranslateText`

### Custom terminology (glossaries)

Upload one terminology per domain, named `<Domain>_Glossary` (e.g. `Medical_Glossary`, `Legal_Glossary`, `IT_Software_Glossary`, `Finance_Glossary`):

```bash
aws translate import-terminology \
  --name Medical_Glossary \
  --merge-strategy OVERWRITE \
  --data-file fileb://Medical.csv \
  --terminology-data Format=CSV
```

---

## 🧪 Usage and sample output

```python
from ai_core import process_translation_pipeline

result = process_translation_pipeline(
    "The patient presents with severe acute myocardial infarction.",
    source_lang="en",
    target_lang="es",
)
print(result)
```

Run the bundled test:

```bash
python test_pipeline.py
```

Example response:

```json
{
  "source_language": "en",
  "target_language": "es",
  "detected_domain": "Medical",
  "translated_text": "El paciente presenta un infarto agudo de miocardio grave.",
  "quality_report": {
    "quality_score": 92,
    "fluency_rating": "High",
    "terminology_accuracy": "High",
    "flagged_issues": [],
    "suggestions": "Translation is accurate and uses correct medical terminology."
  }
}
```

---

## 🤝 Integration contract for the team

| Member | Role | What they consume / provide |
|---|---|---|
| **AI/LLM Engineer** | `ai_core/` | Provides `process_translation_pipeline(text, source_lang, target_lang)` |
| **Backend / API** | Lambda + API Gateway | Imports `ai_core` into `handler.py`; returns the JSON above |
| **Cloud / DB** | Cognito, S3, DynamoDB, IAM | Stores AI outputs; gives Lambda an IAM execution role |
| **Frontend** | React UI | Renders domain badge, side-by-side text, quality card |

```mermaid
flowchart LR
    AI[AI module<br/>ai_core] -- JSON response --> BE[Backend Lambda]
    BE -- save attributes --> DB[(DynamoDB)]
    BE -- API response --> FE[Frontend UI]
    CL[Cloud lead<br/>IAM, Cognito, S3] -. permissions .-> BE
    CL -. credentials / roles .-> AI
```

**Response keys the frontend should use:** `detected_domain`, `translated_text`, `quality_report.quality_score`, `quality_report.flagged_issues`, `quality_report.suggestions`.

---

## 🗄️ Data model (DynamoDB)

```mermaid
erDiagram
    TRANSLATION_JOBS {
        string jobId PK
        string userId
        string sourceLang
        string targetLang
        string status
        string timestamp
        string detected_domain
        number quality_score
        map quality_report_json
    }
    USER ||--o{ TRANSLATION_JOBS : submits
```

---

## 🗺️ Roadmap

```mermaid
gantt
    title Project work plan (8 weeks)
    dateFormat  YYYY-MM-DD
    axisFormat  Week %W
    section Phase 1 - MVP core
    Cognito, API Gateway, Lambda, Translate, DynamoDB :p1, 2025-01-06, 14d
    section Phase 2 - AI and domain engine
    Domain detection and custom glossaries          :p2, after p1, 14d
    section Phase 3 - Quality engine and UI
    LLM quality reports and frontend UI             :p3, after p2, 14d
    section Phase 4 - Hardening
    CloudFront, CloudWatch, load testing, docs      :p4, after p3, 14d
```

| Phase | Weeks | Focus | Status |
|---|---|---|---|
| 1 | 1-2 | Core serverless pipeline, baseline translation (`run_base_translation`) | 🔄 |
| 2 | 3-4 | Domain classifier + glossary lock | 🔄 |
| 3 | 5-6 | LLM quality evaluator + Quality Report UI | 🔄 |
| 4 | 7-8 | CloudFront, CloudWatch, audit logs, load testing | ⏳ |

---

## 🔒 Security notes

- **Never commit AWS keys** — keep `.env`, `~/.aws/credentials` and `venv/` in `.gitignore`.
- Each developer uses an **individual IAM user** with least privilege; do not share access keys.
- In production, Lambda uses an **IAM execution role** (temporary credentials), not stored keys.
- API routes are protected with **Amazon Cognito** JWT authorizers.

Suggested `.gitignore`:

```text
venv/
__pycache__/
*.pyc
.env
.aws/
```

---

## 📄 License

Academic project - add a license of your choice (e.g. MIT) before public release.