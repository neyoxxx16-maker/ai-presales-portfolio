"""True local PaddleOCR smoke test: image-only PDF -> OCR JSON observation."""
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main():
    with tempfile.TemporaryDirectory(prefix="tender-paddle-test-") as directory:
        root = Path(directory)
        image_path = root / "scan.png"
        pdf_path = root / "scan.pdf"
        image = Image.new("RGB", (1400, 360), "white")
        draw = ImageDraw.Draw(image)
        font = ImageFont.truetype("arial.ttf", 64)
        expected = "Tender Project No. 2026-001"
        draw.text((60, 120), expected, font=font, fill="black")
        image.save(image_path)
        image.save(pdf_path, "PDF", resolution=150.0)
        process = subprocess.run([sys.executable, str(Path(__file__).with_name("paddle-ocr.py")), "--input", str(pdf_path)], capture_output=True, text=True, encoding="utf-8", errors="replace", check=False, timeout=180)
        lines = [line for line in process.stdout.splitlines() if line.strip()]
        if process.returncode or not lines:
            raise RuntimeError(process.stderr[-1000:] or "PaddleOCR did not return an observation")
        observation = json.loads(lines[-1])
        assert observation["status"] == "OCR_SUCCEEDED", observation
        assert observation["pageResults"] and observation["pageResults"][0]["page"] == 1, observation
        assert observation["text"].strip(), observation
        assert observation.get("confidence") is not None, observation
        print(f"PaddleOCR local regression: PASS ({len(observation['text'])} characters, confidence {observation['confidence']:.3f}, {observation['durationMs']} ms)")


if __name__ == "__main__":
    main()
