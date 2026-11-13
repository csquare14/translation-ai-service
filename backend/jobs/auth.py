from functools import lru_cache
from urllib.parse import urlparse

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from . import config


bearer = HTTPBearer(auto_error=False)


@lru_cache(maxsize=4)
def signing_keys(issuer):
    return jwt.PyJWKClient(issuer + "/.well-known/jwks.json", timeout=5)


def current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
):
    if config.AUTH_MODE == "demo":
        if not request.client or request.client.host not in {"127.0.0.1", "::1", "localhost"}:
            raise HTTPException(403, "Local demo mode is restricted to this computer.")
        return "local-demo"
    if config.AUTH_MODE != "clerk":
        raise HTTPException(503, "LOCAL_AUTH_MODE must be clerk or demo.")
    issuer = config.CLERK_ISSUER
    if not issuer or urlparse(issuer).scheme != "https":
        raise HTTPException(503, "Set CLERK_ISSUER to your Clerk HTTPS Frontend API URL.")
    if credentials is None:
        raise HTTPException(401, "Sign in to access translation jobs.", headers={"WWW-Authenticate": "Bearer"})
    try:
        signing_key = signing_keys(issuer).get_signing_key_from_jwt(credentials.credentials)
        claims = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["RS256"],
            issuer=issuer,
            audience=config.CLERK_AUDIENCE,
            options={
                "require": ["exp", "iat", "nbf", "iss", "sub", "sid"],
                "verify_aud": bool(config.CLERK_AUDIENCE),
            },
            leeway=5,
        )
        if claims.get("azp") not in config.CLERK_ALLOWED_ORIGINS:
            raise jwt.InvalidTokenError("Unauthorized frontend origin")
        if claims.get("sts") == "pending" or not claims.get("sub") or not claims.get("sid"):
            raise jwt.InvalidTokenError("Inactive session")
        return claims["sub"]
    except jwt.PyJWKClientConnectionError:
        raise HTTPException(503, "Clerk signing keys could not be reached. Try again shortly.") from None
    except jwt.PyJWTError:
        raise HTTPException(401, "Your session is invalid or expired. Sign in again.", headers={"WWW-Authenticate": "Bearer"}) from None
