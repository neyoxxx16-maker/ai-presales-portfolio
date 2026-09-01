"""Local PaddleOCR bridge. Emits one compact JSON document to stdout."""
import argparse
import json
import os
import sys
import time
from pathlib import Path

import fitz
# Paddle 3.3 CPU on Windows may select a oneDNN path that cannot execute some
# OCR graph attributes. Disable it before Paddle is imported; this is still
# local Paddle inference, only without that CPU acceleration path.
os.environ.setdefault("FLAGS_use_mkldnn", "0")

from paddleocr import PaddleOCR


def page_images(source: Path):
    if source.suffix.lower() != ".pdf":
        return [str(source)]
    document = fitz.open(source)
    images = []
    for page in document:
        pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        images.append(pixmap.tobytes("png"))
    return images


def legacy_result(ocr, image):
    result = ocr.ocr(image, cls=True)
    lines = result[0] if result else []
    texts = [line[1][0] for line in lines if len(line) > 1]
    scores = [float(line[1][1]) for line in lines if len(line) > 1]
    return texts, scores


def v3_result(ocr, image):
    result = next(iter(ocr.predict(image)))
    payload = getattr(result, "json", None)
    if callable(payload):
        payload = payload()
    if isinstance(payload, str):
        payload = json.loads(payload)
    payload = payload or dict(result)
    data = payload.get("res", payload)
    texts = data.get("rec_texts", [])
    scores = [float(score) for score in data.get("rec_scores", [])]
    return texts, scores


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()
    started = time.perf_counter()
    source = Path(args.input)
    ocr = PaddleOCR(lang="ch")
    pages = []
    for number, image in enumerate(page_images(source), start=1):
        try:
            texts, scores = v3_result(ocr, image)
        except (AttributeError, TypeError, KeyError):
            texts, scores = legacy_result(ocr, image)
        pages.append({"page": number, "text": "\n".join(texts), "confidence": sum(scores) / len(scores) if scores else None})
    text = "\n\n".join(page["text"] for page in pages if page["text"])
    print(json.dumps({"status": "OCR_SUCCEEDED" if text else "OCR_FAILED", "text": text, "pageResults": pages, "confidence": sum(page["confidence"] for page in pages if page["confidence"] is not None) / max(1, len([page for page in pages if page["confidence"] is not None])), "durationMs": round((time.perf_counter() - started) * 1000)}, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"status": "OCR_FAILED", "error": str(error)}, ensure_ascii=False))
        sys.exit(1)
