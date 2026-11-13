# Run the translation application on Windows

The React CloudQuery frontend submits text or UTF-8 `.txt` files to a local FastAPI service.
One background worker translates queued jobs using Amazon Translate and Gemini.
SQLite stores job input, results, quality reports, and errors in `.local-data/jobs.db`.
Internet access is required for AWS, Gemini, and Clerk.

## Install and start

Open PowerShell in `translation-ai-service` and run:

```powershell
& ..\venv\Scripts\python.exe -m pip install -r requirements.txt
Push-Location frontend\web
npm.cmd install
Pop-Location
& ..\venv\Scripts\python.exe run_local.py
```

Open `http://localhost:8501`. Keep the terminal open and press Ctrl+C to stop.
If ports 8000 or 8501 are occupied, stop your previous local server first.
Install Node.js before installing the frontend dependencies. The launcher starts
the React development server and proxies authenticated API requests locally.
Use `run_local.py --streamlit` to open the original Streamlit interface instead.

Translation pages use your actual jobs. Resource Graph, Attack Path Analysis,
and Security Insights show clearly labelled sample infrastructure; AWS inventory
scanning is not connected. Reports support CSV, JSON, and browser Print / Save as PDF.
Animations respect your operating system preference and the Settings toggle.

To validate the frontend, run `npm.cmd test` and `npm.cmd run build` inside
`frontend/web`.

## Clerk configuration

For the existing selected Clerk application, authenticate in your own terminal:

```powershell
npx.cmd -y clerk@latest auth login
```

After login, link the project and pull development keys:

```powershell
npx.cmd -y clerk@latest link --app app_3M13155xX1S95GMHzsQ0ZybZsyz
npx.cmd -y clerk@latest env pull --instance dev --file .env.local
```

The app loads `.env.local` before `.env`. It derives the Clerk issuer from the
publishable key when `CLERK_ISSUER` is unset. The development env file and Clerk
project metadata are excluded from Git. Keep your AWS and Gemini configuration
in the existing `.env` file.

Keep the existing AWS and Gemini settings in `.env`. Add:

```dotenv
CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key
CLERK_ISSUER=https://your-app.clerk.accounts.dev
CLERK_ALLOWED_ORIGINS=http://localhost:8501,http://127.0.0.1:8501
```

Copy the publishable key and Frontend API URL from your Clerk application dashboard.
Use a Clerk development application for localhost. Restart the local servers after changes.
The API verifies RS256 signatures through Clerk's public JWKS, issuer, expiry,
session ID, and authorized frontend origin. Set `CLERK_AUDIENCE` only if your Clerk
session tokens have an application-specific audience. A Clerk secret key is not
required for public-key verification. Each job belongs to the verified token subject.

For an explicit single-user demonstration while setting up Clerk:

```powershell
& ..\venv\Scripts\python.exe run_local.py --demo
```

Demo mode accepts loopback requests, displays a warning, and uses one shared
`local-demo` owner. It does not demonstrate authentication or multi-user isolation.

## Use the application

1. Sign in, select source and target languages, then paste text or upload a `.txt` file.
2. Submit a translation. The app polls the job status automatically.
3. Download the translated text and JSON report after completion.
4. Select older jobs from the job list. Jobs survive server restarts.
5. Retry a failed job after fixing its input or service configuration.

Inputs must be nonempty UTF-8 text, at most 10,000 bytes. Other document formats
are not supported. Auto-detect requires `comprehend:DetectDominantLanguage` in
addition to `translate:TranslateText`. Gemini translates unsupported AWS language
pairs. Missing AWS terminology produces a warning and uses standard translation.
Local terminology replacements currently support French only.

## Job processing and recovery

### AWS-backed API (optional)

Set `JOB_BACKEND=aws`, `S3_BUCKET_NAME`, and `TRANSLATION_HISTORY_TABLE` in
your local configuration, then restart the launcher. Default `JOB_BACKEND=local`
keeps the SQLite demo. AWS mode creates the DynamoDB item before uploading
`incoming/{job_id}/source.txt`; the existing S3/SQS Lambda processes it.
The API does not run its local translation worker in AWS mode. Clerk ownership
checks also apply to cloud history, source files, reports, and retries.

The API identity needs DynamoDB PutItem/GetItem/UpdateItem/Scan on the history
table, S3 PutObject/GetObject on incoming objects, and GetObject on results.
Use your existing credential chain locally and an execution role when deployed;
never put credentials in frontend code. Worker permissions alone do not give
the separate API identity these permissions. Customer-managed KMS keys may
require additional key permissions.

History currently scans the existing table with an owner filter and pagination.
Add an owner/created_at index and replace Scan with Query before scaling.
Existing manually created items without a user_id are intentionally invisible.
API Gateway deployment is a separate next step; this change does not deploy AWS resources.

Build the separate API Lambda with `python build_lambda.py --api`.
The package also includes authenticated `/security/overview` and
`/security/jobs/{job_id}/check` routes. Resource Graph, Attack Path Analysis,
and Security Insights call that API in Clerk mode. Explicit demo mode retains
the labelled sample scenario. The API returns configured application topology,
not discovered account-wide inventory, and does not infer exploitable attack
paths from ordinary application connections. Storage checks report passed,
failed, or unknown. Grant the API role the read-only bucket permissions in
`aws-api-security-read-policy.json` to allow encryption/public-block checks;
granting these permissions to the CLI user does not grant them to Lambda.
Job validation checks use stored owned jobs, never client-provided identities,
and do not write a shared unscoped findings database. These checks do not
constitute an enterprise security certification or full IAM audit.

In Clerk mode, the security routes share one Security Dashboard. The backend
computes bounded `applicationPaths` and relationship labels; selecting a route
highlights only its consecutive edges in blue. `attackAssessment.status` remains
`not_assessed` until effective network and IAM evidence is available. Overview
and Reports use the same scoped API data and do not substitute demo findings
on API failures. Unknown reads are verification gaps, not low-risk findings.
Output: `dist/translation-api.zip`, Python 3.12 / x86_64, handler
`api_handler.handler`. Configure `JOB_BACKEND=aws`, `LOCAL_AUTH_MODE=clerk`,
`S3_BUCKET_NAME`, `TRANSLATION_HISTORY_TABLE`, `CLERK_PUBLISHABLE_KEY`,
`CLERK_ISSUER`, and `CLERK_ALLOWED_ORIGINS` on that function. Gemini credentials
belong only on the translation worker. The deployed entry point rejects local
storage or demo authentication. Use a separate API execution role with the
permissions described above and basic CloudWatch logging.

Connect an API Gateway HTTP API Lambda proxy integration (payload 2.0) with a
`$default` route and `$default` stage. Clerk authentication is enforced inside
the API for job routes. For direct browser requests, configure Gateway CORS
with exact frontend origins, GET/POST/OPTIONS methods, Authorization/Content-Type
headers, and expose Content-Disposition. Verify `/health` and an unauthenticated
`/jobs` request (401), then a signed-in create/status/download flow before
switching frontend traffic. Do not replace the worker Lambda with the API ZIP.

Run a single API process. The supplied launcher enforces one Uvicorn worker.
The background worker processes independent jobs in submission order.
Transient translation errors retry automatically up to three attempts with backoff.
Exhausted and permanent failures appear as `failed` and can be retried manually.
Jobs interrupted while processing are requeued when the API starts again.
Local failed-job storage provides inspection and retry. AWS dead-letter queue
configuration remains part of the separate AWS deployment.

API documentation is at `http://127.0.0.1:8000/docs`. Endpoints are:

- `POST /jobs` for JSON text submission
- `POST /jobs/upload` for multipart `.txt` submission
- `GET /jobs` and `GET /jobs/{id}` for owned history and status
- `GET /jobs/{id}/result?format=txt` or `format=json` for downloads
- `POST /jobs/{id}/retry` for a failed job

Clerk mode requires an `Authorization: Bearer <session-token>` header for all job
endpoints. Status, retry, list, and downloads enforce ownership. Logs are stored
in `.local-data/api.log` and `.local-data/ui.log`. The data directory and `.env`
are excluded from Git. Local input and results use the filesystem protections
of your Windows account. Database encryption at rest has not been implemented.
