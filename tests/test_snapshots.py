import io
import json
import hashlib
from pathlib import Path

import fitz
import numpy as np
from PIL import Image

from apps.worker.services.reports import generate_dossier_pdf, generate_hr_pack_pdf

SNAPSHOT_DIR = Path(__file__).parent / "snapshots"
BASELINES = json.loads((SNAPSHOT_DIR / "baselines.json").read_text())


def _pdf_first_page(pdf_bytes: bytes) -> Image.Image:
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    page = doc.load_page(0)
    pix = page.get_pixmap(dpi=144)
    return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")


def _assert_snapshot(image: Image.Image, name: str, tolerance: float = 0.75) -> None:
    baseline = BASELINES[name]
    arr_current = np.array(image.convert("RGB"), dtype=np.int16)
    current_mean = float(arr_current.mean())
    diff = abs(current_mean - float(baseline["mean"]))
    assert diff <= tolerance, (
        f"Snapshot mean mismatch for {name}: Δ{diff:.2f} (expected ≤ {tolerance})"
    )
    current_size = image.size
    assert tuple(baseline["size"]) == current_size, (
        f"Snapshot size mismatch for {name}: {current_size} ≠ {tuple(baseline['size'])}"
    )
    digest = hashlib.sha256(arr_current.astype(np.uint8).tobytes()).hexdigest()
    assert digest == baseline["sha256"], (
        f"Snapshot hash mismatch for {name}: {digest} ≠ {baseline['sha256']}"
    )


def test_dossier_snapshot(tmp_path):
    payload = {"year": 2024, "totals": {"gross": 12800.0, "net": 8600.0}}
    artifact = generate_dossier_pdf("user-1", payload)
    image = _pdf_first_page(artifact.bytes)
    _assert_snapshot(image, "dossier")


def test_hr_pack_snapshot(tmp_path):
    payload = {
        "summary": "HR pack",
        "notes": ["Line 1", "Line 2"],
        "redacted_preview": {
            "url": "https://storage.local/user-1/example_redacted.png",
            "label": "example",
            "image_data": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+8cBcAAAAASUVORK5CYII=",
        },
    }
    artifact = generate_hr_pack_pdf("user-1", payload)
    image = _pdf_first_page(artifact.bytes)
    _assert_snapshot(image, "hr_pack")
