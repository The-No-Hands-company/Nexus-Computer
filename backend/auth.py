"""
Nexus Computer — Auth layer.

Single-user JWT auth for self-hosted deployment.
Password is set via NEXUS_PASSWORD env var, or via the setup endpoint on first run.
"""

import os
import json
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)

SECRET_KEY = os.environ.get("NEXUS_SECRET_KEY") or secrets.token_hex(32)
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = 30


def _auth_file(workspace: str) -> Path:
    return Path(workspace) / ".nexus" / "auth.json"


def _load_auth(workspace: str) -> dict:
    p = _auth_file(workspace)
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            pass
    return {}


def _save_auth(workspace: str, data: dict):
    p = _auth_file(workspace)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2))


def auth_configured(workspace: str) -> bool:
    """Returns True if a password hash is stored, or NEXUS_PASSWORD env is set."""
    if os.environ.get("NEXUS_PASSWORD"):
        return True
    data = _load_auth(workspace)
    return bool(data.get("password_hash"))


def setup_password(workspace: str, password: str) -> bool:
    """Hash and store a password. Returns False if already configured."""
    if auth_configured(workspace) and not os.environ.get("NEXUS_PASSWORD"):
        return False
    data = _load_auth(workspace)
    data["password_hash"] = pwd_ctx.hash(password)
    _save_auth(workspace, data)
    return True


def verify_password(workspace: str, password: str) -> bool:
    """Verify a password against stored hash or NEXUS_PASSWORD env."""
    env_pw = os.environ.get("NEXUS_PASSWORD")
    if env_pw:
        return secrets.compare_digest(password, env_pw)
    data = _load_auth(workspace)
    ph = data.get("password_hash")
    if not ph:
        return False
    return pwd_ctx.verify(password, ph)


def create_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": "operator", "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ── FastAPI dependency ─────────────────────────────────────────────────────────

_WORKSPACE: str = ""  # set by main.py at startup


def set_workspace(ws: str):
    global _WORKSPACE
    _WORKSPACE = ws


async def require_auth(
    request: Request,
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> bool:
    """Dependency: pass if auth is not configured (open mode) or token is valid."""
    if not auth_configured(_WORKSPACE):
        return True  # no password set — open access (local-only assumed)
    if not creds:
        raise HTTPException(status_code=401, detail="Authentication required")
    decode_token(creds.credentials)
    return True
