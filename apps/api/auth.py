from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, Request, status
from jose import jwt

from apps.common.config import get_settings


@dataclass(slots=True)
class AuthenticatedUser:
    user_id: str


async def get_current_user(request: Request) -> AuthenticatedUser:
    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1]
    settings = get_settings()
    try:
        payload = jwt.get_unverified_claims(token)
    except jwt.JWTError as exc:  # type: ignore[attr-defined]
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    user_id = payload.get("sub") or payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    aud = payload.get("aud")
    if aud and settings.supabase_url not in aud and aud != "authenticated":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid audience")
    return AuthenticatedUser(user_id=str(user_id))


def require_internal_token(request: Request) -> None:
    expected = get_settings().internal_auth_token
    if not expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Internal token not configured")
    provided = request.headers.get("X-Internal-Token")
    if provided != expected:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


async def require_internal_or_authenticated(request: Request) -> Optional[AuthenticatedUser]:
    internal = request.headers.get("X-Internal-Token")
    if internal:
        require_internal_token(request)
        return None
    return await get_current_user(request)
