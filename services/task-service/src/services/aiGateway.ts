const configuredGatewayUrl = process.env.AI_GATEWAY_URL;
const gatewayBaseUrls = configuredGatewayUrl
  ? [configuredGatewayUrl]
  : ['http://ai-gateway:4010', 'http://localhost:4010'];
const internalSyncKey = process.env.AI_INTERNAL_SYNC_KEY ?? 'dev-sync-key';

type SyncTaskEmbeddingParams = {
  taskId: string;
  tenantId: string;
  authorization?: string;
};

export const syncTaskEmbedding = async ({ taskId, tenantId, authorization }: SyncTaskEmbeddingParams): Promise<void> => {
  for (const baseUrl of gatewayBaseUrls) {
    try {
      const response = await fetch(`${baseUrl}/ai/internal/task-embedding/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
          'X-AI-Internal-Key': internalSyncKey,
          ...(authorization ? { Authorization: authorization } : {}),
        },
        body: JSON.stringify({ taskId }),
      });
      if (response.ok) return;
      const body = await response.text().catch(() => '');
      console.error(`[syncTaskEmbedding] ai-gateway ${baseUrl} responded ${response.status}: ${body}`);
    } catch {
      // Try next known gateway URL.
    }
  }
  console.error('[syncTaskEmbedding] Failed to call ai-gateway on all configured URLs');
};
