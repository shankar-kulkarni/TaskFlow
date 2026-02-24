import 'dotenv/config';
import express from 'express';
import { authenticateTenantJWT } from './middleware/auth.js';
import { enforceAIQuota } from './middleware/quota.js';
import { requireFeature } from './middleware/requireFeature.js';
import { healthHandler } from './routes/health.js';
import { semanticSearchHandler } from './routes/semanticSearch.js';
import { taskCreateLiteHandler } from './routes/taskCreateLite.js';
import { taskSummaryHandler } from './routes/taskSummary.js';
import { taskEmbeddingSyncHandler } from './routes/taskEmbeddingSync.js';
import { weeklyDigestHandler } from './routes/weeklyDigest.js';
import { workflowSuggestionHandler } from './routes/workflowSuggest.js';

const app = express();
const internalSyncKey = process.env.AI_INTERNAL_SYNC_KEY ?? 'dev-sync-key';

const allowedOrigins = (process.env.AI_CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    res.header('Access-Control-Allow-Origin', requestOrigin);
    res.header('Vary', 'Origin');
  } else {
    // Allow all origins for development fallback (optional, can restrict in prod)
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Tenant-ID');
  if (req.method === 'OPTIONS') {
    res.status(204).send();
    return;
  }
  next();
});

app.use(express.json({ limit: '1mb' }));
app.get('/health', healthHandler);
app.post('/ai/internal/task-embedding/sync', (req, res, next) => {
  const provided = req.header('x-ai-internal-key') ?? '';
  if (!provided || provided !== internalSyncKey) {
    res.status(401).json({ error: 'unauthorized_internal_sync' });
    return;
  }
  next();
}, taskEmbeddingSyncHandler);

app.use(authenticateTenantJWT);
app.use(enforceAIQuota);

app.post('/ai/task/create-lite', requireFeature('task_creation'), taskCreateLiteHandler);
app.post('/ai/search', requireFeature('semantic_search'), semanticSearchHandler);
app.post('/ai/task/summarise', requireFeature('task_summary'), taskSummaryHandler);
app.get('/ai/digest/weekly', requireFeature('weekly_digest'), weeklyDigestHandler);
app.get('/ai/workflow/suggest', requireFeature('workflow_suggest'), workflowSuggestionHandler);

const port = Number(process.env.PORT ?? 4010);

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`ai-gateway listening on :${port}`);
});
