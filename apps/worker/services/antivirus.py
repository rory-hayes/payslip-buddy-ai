from __future__ import annotations

import logging
from typing import Optional

try:
    import pyclamd
except Exception:  # pragma: no cover - optional dependency may be missing
    pyclamd = None

LOGGER = logging.getLogger(__name__)


class AntivirusError(RuntimeError):
    pass


def scan_bytes(data: bytes, *, host: str = "clamav", port: int = 3310, timeout: int = 30) -> None:
    """Scan payload using ClamAV if available."""
    if pyclamd is None:
        LOGGER.warning("pyclamd unavailable; skipping antivirus scan.")
        return
    try:
        client = pyclamd.ClamdNetworkSocket(host=host, port=port, timeout=timeout)
        ping = client.ping()
    except Exception as exc:  # pragma: no cover - network failure path
        LOGGER.warning("Unable to reach ClamAV daemon: %s", exc)
        return
    if ping != "PONG":  # pragma: no cover - defensive guard
        LOGGER.warning("Unexpected ClamAV ping response: %s", ping)
        return
    result = client.scan_stream(data)
    if result:
        raise AntivirusError(str(result))


__all__ = ["scan_bytes", "AntivirusError"]
