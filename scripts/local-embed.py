"""Local Sentence Transformers embedding runner; model weights stay in the local cache."""

import argparse
import json
import sys


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--serve", action="store_true")
    args = parser.parse_args()

    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as error:
        raise RuntimeError("Local embeddings require sentence-transformers. Install it in the configured local Python environment.") from error

    model = SentenceTransformer(args.model)

    def embed(payload):
        texts = payload.get("input")
        if not isinstance(texts, list) or not all(isinstance(text, str) for text in texts):
            raise ValueError("input must be a list of strings")
        embeddings = model.encode(texts, normalize_embeddings=True, show_progress_bar=False).tolist()
        return {"model": args.model, "dimensions": len(embeddings[0]) if embeddings else 0, "embeddings": embeddings}

    if args.serve:
        for line in sys.stdin:
            if not line.strip():
                continue
            payload = json.loads(line)
            result = embed(payload)
            result["id"] = payload.get("id")
            sys.stdout.write(json.dumps(result) + "\n")
            sys.stdout.flush()
        return

    json.dump(embed(json.load(sys.stdin)), sys.stdout)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        sys.stderr.write(str(error))
        sys.exit(1)
