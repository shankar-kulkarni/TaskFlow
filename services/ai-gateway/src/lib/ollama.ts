const OLLAMA = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const EMBED_MODEL = process.env.EMBED_MODEL ?? "nomic-embed-text";

export async function embed(text: string): Promise<number[]> {
  const r = await fetch(`${OLLAMA}/api/embeddings`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text })
  });
  if (!r.ok) throw new Error(`Embedding failed: ${r.status}`);
  const j = await r.json();
  return j.embedding as number[];
}