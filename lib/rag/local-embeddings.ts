import { spawn } from "node:child_process";
import path from "node:path";

type LocalEmbeddingPayload = { model: string; dimensions: number; embeddings: number[][] };

export const localEmbeddingConfig = {
  model: process.env.LOCAL_EMBEDDING_MODEL ?? "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  python: process.env.LOCAL_EMBEDDING_PYTHON ?? "python",
};

export async function embedLocally(input: string[]): Promise<number[][]> {
  if (!input.length) return [];
  const scriptPath = path.join(process.cwd(), "scripts", "local-embed.py");
  return new Promise((resolve, reject) => {
    const processHandle = spawn(localEmbeddingConfig.python, [scriptPath, "--model", localEmbeddingConfig.model], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    processHandle.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    processHandle.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    processHandle.on("error", () => reject(new Error("local_embedding_runner_unavailable")));
    processHandle.on("close", (code) => {
      if (code !== 0) return reject(new Error(stderr.trim() || "local_embedding_failed"));
      try {
        const payload = JSON.parse(stdout) as LocalEmbeddingPayload;
        if (payload.model !== localEmbeddingConfig.model || !Array.isArray(payload.embeddings) || payload.embeddings.length !== input.length || payload.dimensions < 1) throw new Error("local_embedding_malformed_output");
        resolve(payload.embeddings);
      } catch (error) {
        reject(error instanceof Error ? error : new Error("local_embedding_malformed_output"));
      }
    });
    processHandle.stdin.end(JSON.stringify({ input }));
  });
}
