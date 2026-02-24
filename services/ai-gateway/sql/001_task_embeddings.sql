CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS task_embeddings (
  task_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  embedding vector(768) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_embeddings_tenant ON task_embeddings (tenant_id);

CREATE INDEX IF NOT EXISTS idx_task_embeddings_vec
  ON task_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
