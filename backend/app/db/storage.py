"""Supabase Storage — 업로드 원본 파일 보관.

크레덴셜(SUPABASE_URL/SUPABASE_SERVICE_KEY) 미설정 시 graceful no-op
→ 원본 보관만 비활성, 업로드·팩트체크 기능은 그대로 동작.
"""
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_BUCKET = "uploads"


def _enabled() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_key)


def _headers(content_type: str | None = None) -> dict:
    h = {"Authorization": f"Bearer {settings.supabase_service_key}"}
    if content_type:
        h["Content-Type"] = content_type
    return h


def _object_path(upload_id: str, filename: str) -> str:
    safe = filename.replace("/", "_").replace("..", "_") or "file"
    return f"{upload_id}/{safe}"


def upload_original(upload_id: str, filename: str, content: bytes, content_type: str) -> str | None:
    """원본 파일을 Storage에 저장. 성공 시 object path, 미설정/실패 시 None."""
    if not _enabled():
        return None
    path = _object_path(upload_id, filename)
    url = f"{settings.supabase_url}/storage/v1/object/{_BUCKET}/{path}"
    try:
        r = httpx.post(
            url,
            headers={**_headers(content_type or "application/octet-stream"), "x-upsert": "true"},
            content=content,
            timeout=30,
        )
        r.raise_for_status()
        return path
    except Exception as e:
        logger.warning("Storage 업로드 실패 (%s): %s", path, e)
        return None


def get_download_url(path: str, expires_in: int = 3600) -> str | None:
    """object path에 대한 임시 서명 URL 생성. 미설정/실패 시 None."""
    if not _enabled() or not path:
        return None
    url = f"{settings.supabase_url}/storage/v1/object/sign/{_BUCKET}/{path}"
    try:
        r = httpx.post(url, headers=_headers("application/json"), json={"expiresIn": expires_in}, timeout=15)
        r.raise_for_status()
        signed = r.json().get("signedURL") or r.json().get("signedUrl")
        if not signed:
            return None
        return f"{settings.supabase_url}/storage/v1{signed}"
    except Exception as e:
        logger.warning("Storage 서명 URL 실패 (%s): %s", path, e)
        return None


def delete_original(path: str) -> bool:
    """원본 파일 삭제. 성공(또는 삭제할 것 없음) 시 True, 실패 시 False."""
    if not _enabled() or not path:
        return True
    url = f"{settings.supabase_url}/storage/v1/object/{_BUCKET}/{path}"
    try:
        r = httpx.request("DELETE", url, headers=_headers(), timeout=15)
        r.raise_for_status()
        return True
    except Exception as e:
        logger.warning("Storage 삭제 실패 (%s): %s", path, e)
        return False
