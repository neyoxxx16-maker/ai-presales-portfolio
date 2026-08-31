import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import path from "node:path";

type LocalEmbeddingPayload = { model: string; dimensions: number; embeddings: number[][] };
type PendingEmbedding = { expectedLength: number; resolve: (embeddings: number[][]) => void; reject: (error: Error) => void };

export const localEmbeddingConfig = {
  model: process.env.LOCAL_EMBEDDING_MODEL ?? "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
  python: process.env.LOCAL_EMBEDDING_PYTHON ?? "python",
};

let worker: ChildProcessWithoutNullStreams | undefined;
let workerOutput = "";
let requestId = 0;
const pending = new Map<number, PendingEmbedding>();

function rejectPending(error: Error) {
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}

function startWorker() {
  const scriptPath = path.join(process.cwd(), "scripts", "local-embed.py");
  const processHandle = spawn(localEmbeddingConfig.python, [scriptPath, "--model", localEmbeddingConfig.model, "--serve"], { stdio: ["pipe", "pipe", "pipe"], windowsHide: true, env: { ...process.env, PYTHONUTF8: "1" } });
  worker = processHandle;
  processHandle.stdout.on("data", (chunk: Buffer) => {
    workerOutput += chunk.toString();
    const lines = workerOutput.split("\n");
    workerOutput = lines.pop() ?? "";
    for (const line of lines) {
      try {
        const payload = JSON.parse(line) as LocalEmbeddingPayload & { id?: number };
        const request = typeof payload.id === "number" ? pending.get(payload.id) : undefined;
        if (!request || payload.model !== localEmbeddingConfig.model || !Array.isArray(payload.embeddings) || payload.embeddings.length !== request.expectedLength || payload.dimensions < 1) throw new Error("local_embedding_malformed_output");
        pending.delete(payload.id!);
        request.resolve(payload.embeddings);
      } catch (error) {
        rejectPending(error instanceof Error ? error : new Error("local_embedding_malformed_output"));
      }
    }
  });
  processHandle.on("error", () => rejectPending(new Error("local_embedding_runner_unavailable")));
  processHandle.on("close", () => {
    if (worker === processHandle) worker = undefined;
    rejectPending(new Error("local_embedding_failed"));
  });
  return processHandle;
}

export async function embedLocally(input: string[]): Promise<number[][]> {
  if (!input.length) return [];
  return new Promise((resolve, reject) => {
    const id = requestId += 1;
    pending.set(id, { expectedLength: input.length, resolve, reject });
    const processHandle = worker ?? startWorker();
    processHandle.stdin.write(`${JSON.stringify({ id, input })}\n`);
  });
}

export function closeLocalEmbeddingWorker() {
  const processHandle = worker;
  worker = undefined;
  workerOutput = "";
  processHandle?.kill();
}
