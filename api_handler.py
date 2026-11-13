"""API Gateway HTTP API entry point; translation runs in the separate worker."""

import os

if os.getenv("JOB_BACKEND") != "aws" or os.getenv("LOCAL_AUTH_MODE", "clerk") != "clerk":
    raise RuntimeError("Deployed API requires JOB_BACKEND=aws and Clerk authentication.")

from mangum import Mangum
from backend.jobs.apis import app

handler = Mangum(app, lifespan="off")
