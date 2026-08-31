"""Local Sentence Transformers embedding runner; model weights stay in the local cache."""

import argparse
import json
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    args = parser.parse_args()
    payload = json.load(sys.stdin)
    texts = payload.get("input")
    if not isinstance(texts, list) or not all(isinstance(text, str) for text in texts):
        raise ValueError("input must be a list of strings")

    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as error:
        raise RuntimeError("Local embeddings require sentence-transformers. Install it in the configured local Python environment.") from error

    model = SentenceTransformer(args.model)
    embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False).tolist()
    dimensions = len(embeddings[0]) if embeddings else 0
    json.dump({"model": args.model, "dimensions": dimensions, "embeddings": embeddings}, sys.stdout)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        sys.stderr.write(str(error))
        sys.exit(1)
