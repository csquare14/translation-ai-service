import base64
import binascii
import os
import re
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env.local")
load_dotenv(PROJECT_ROOT / ".env")


def issuer_from_publishable_key(publishable_key):
    """Recover the public Frontend API hostname encoded in a Clerk key."""
    if not publishable_key.startswith(("pk_test_", "pk_live_")):
        return ""
    encoded = publishable_key.split("_", 2)[2]
    try:
        domain = base64.b64decode(encoded + "=" * (-len(encoded) % 4), validate=True).decode("ascii")
    except (ValueError, UnicodeDecodeError, binascii.Error):
        return ""
    if not domain.endswith("$"):
        return ""
    domain = domain[:-1]
    if not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?", domain) or "." not in domain:
        return ""
    return "https://" + domain

DATA_DIR = Path(os.getenv("LOCAL_DATA_DIR", str(PROJECT_ROOT / ".local-data")))
AUTH_MODE = os.getenv("LOCAL_AUTH_MODE", "clerk").lower()
CLERK_PUBLISHABLE_KEY = (
    os.getenv("CLERK_PUBLISHABLE_KEY")
    or os.getenv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY")
    or os.getenv("VITE_CLERK_PUBLISHABLE_KEY", "")
)
CLERK_ISSUER = (
    os.getenv("CLERK_ISSUER") or issuer_from_publishable_key(CLERK_PUBLISHABLE_KEY)
).rstrip("/")
CLERK_AUDIENCE = os.getenv("CLERK_AUDIENCE")
CLERK_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CLERK_ALLOWED_ORIGINS", "http://localhost:8501,http://127.0.0.1:8501"
    ).split(",")
    if origin.strip()
]

MAX_INPUT_BYTES = 10000
JOB_BACKEND = os.getenv("JOB_BACKEND", "local").lower()
if JOB_BACKEND not in {"local", "aws"}:
    raise RuntimeError("JOB_BACKEND must be local or aws.")
