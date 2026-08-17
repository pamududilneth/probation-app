"""
Resolves who's calling the API.

Two modes, controlled by the AUTH_MODE env var:

- AUTH_MODE=dev (the default — what you want for running on your laptop with
  no Azure account yet): the frontend just sends a plain `X-Dev-Email` header
  after a lightweight local "login" screen. No tokens, no signature checks.
  This is for local development ONLY — never deploy with this on.

- AUTH_MODE=azure (switch to this once you have an Azure App Registration):
  the frontend (MSAL) sends `Authorization: Bearer <token>`, and this module
  verifies the token's signature against Azure's public JWKS.

Either way, we end up upserting a local `User` row so the rest of the app
works with plain DB users instead of raw tokens/headers everywhere.
"""
import os
import time
from typing import Optional

import httpx
from fastapi import Depends, HTTPException, Request
from jose import jwt
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from .database import get_db
from .models import User, RoleEnum

load_dotenv()

AUTH_MODE = os.environ.get("AUTH_MODE", "dev")  # "dev" or "azure"

# Only used when AUTH_MODE=azure — fill these in from your Azure App Registration.
TENANT_ID = os.environ.get("AZURE_TENANT_ID", "<tenant-id>")
API_CLIENT_ID = os.environ.get("AZURE_API_CLIENT_ID", "<api-client-id>")

JWKS_URL = f"https://login.microsoftonline.com/{TENANT_ID}/discovery/v2.0/keys"
ISSUER = f"https://login.microsoftonline.com/{TENANT_ID}/v2.0"

# Very small in-process JWKS cache so we don't hit Azure on every request.
_jwks_cache = {"keys": None, "fetched_at": 0}
_JWKS_TTL_SECONDS = 3600


def _get_jwks() -> dict:
    now = time.time()
    if _jwks_cache["keys"] is None or now - _jwks_cache["fetched_at"] > _JWKS_TTL_SECONDS:
        resp = httpx.get(JWKS_URL, timeout=10)
        resp.raise_for_status()
        _jwks_cache["keys"] = resp.json()
        _jwks_cache["fetched_at"] = now
    return _jwks_cache["keys"]


def _decode_token(token: str) -> dict:
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Malformed token")

    jwks = _get_jwks()
    key = next((k for k in jwks["keys"] if k["kid"] == unverified_header.get("kid")), None)
    if key is None:
        raise HTTPException(status_code=401, detail="Signing key not found")

    try:
        payload = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=API_CLIENT_ID,
            issuer=ISSUER,
        )
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    return payload


def _get_or_create_user(db: Session, email: str, name: Optional[str], oid: Optional[str]) -> User:
    user = None
    if oid:
        user = db.query(User).filter(User.azure_oid == oid).first()
    if user is None:
        # First time we've seen this person — try to match an Admin-seeded
        # row by email (e.g. Admin pre-invited them), otherwise create fresh
        # with no role. New users always start with role=None; an Admin
        # assigns one from the Admin Dashboard.
        user = db.query(User).filter(User.email == email).first()
        if user is None:
            user = User(email=email, display_name=name, azure_oid=oid, role=None)
            db.add(user)
        else:
            if oid:
                user.azure_oid = oid
            if not user.display_name and name:
                user.display_name = name
        db.commit()
        db.refresh(user)
    return user


def _get_current_user_dev(request: Request, db: Session) -> User:
    email = request.headers.get("X-Dev-Email")
    name = request.headers.get("X-Dev-Name") or email
    if not email:
        raise HTTPException(
            status_code=401,
            detail="Missing X-Dev-Email header (AUTH_MODE=dev) — sign in through the app first",
        )
    return _get_or_create_user(db, email=email, name=name, oid=f"dev:{email}")


def _get_current_user_azure(request: Request, db: Session) -> User:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = auth_header.split(" ", 1)[1]

    payload = _decode_token(token)
    oid = payload.get("oid")
    email = payload.get("preferred_username") or payload.get("email")
    name = payload.get("name")
    if not oid or not email:
        raise HTTPException(status_code=401, detail="Token missing required claims")

    return _get_or_create_user(db, email=email, name=name, oid=oid)


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    if AUTH_MODE == "dev":
        return _get_current_user_dev(request, db)
    return _get_current_user_azure(request, db)


def require_role(*roles: RoleEnum):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="You don't have access to this resource")
        return user

    return dependency


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != RoleEnum.admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user
