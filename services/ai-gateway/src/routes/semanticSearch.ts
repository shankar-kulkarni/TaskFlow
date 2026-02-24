import type { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../services/db.js';
import { createEmbedding, toPgVector } from '../services/embeddings.js';
import { getTenantTimezone } from '../services/tenantTimezone.js';

const searchSchema = z.object({
  query: z.string().min(2),
  limit: z.number().int().min(1).max(50).optional(),
  projectId: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  tenantId: z.string().optional().nullable(),
});

const SEARCH_STOPWORDS = new Set([
  'the',
  'and',
  'or',
  'for',
  'with',
  'from',
  'find',
  'task',
  'tasks',
  'status',
  'is',
]);

export type SemanticRow = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  project_id: string | null;
  project_name: string | null;
  score: number;
};

const tokenizeQuery = (query: string): string[] =>
  query
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !SEARCH_STOPWORDS.has(token));

const STATUS_ALIASES: Record<string, string> = {
  todo: 'TODO',
  'to-do': 'TODO',
  open: 'TODO',
  pending: 'TODO',
  inprogress: 'IN_PROGRESS',
  'in-progress': 'IN_PROGRESS',
  progress: 'IN_PROGRESS',
  review: 'IN_REVIEW',
  blocked: 'BLOCKED',
  done: 'DONE',
  completed: 'DONE',
  complete: 'DONE',
  cancelled: 'CANCELLED',
  canceled: 'CANCELLED',
};

const extractStatusFromQuery = (query: string): string | null => {
  const normalized = query
    .toLowerCase()
    .replace(/\bin\s+progress\b/g, 'inprogress')
    .replace(/[^a-z0-9\-_ ]+/g, ' ');
  const tokens = normalized
    .split(/\s+/g)
    .map((token) => token.trim())
    .filter(Boolean);
  for (const token of tokens) {
    const matched = STATUS_ALIASES[token];
    if (matched) return matched;
  }
  return null;
};

type QueryCondition = { type: 'status' | 'term'; value: string };
type QueryExpression = {
  conditions: QueryCondition[];
  operators: Array<'and' | 'or'>;
  hasBooleanOperators: boolean;
};

export const parseQueryExpression = (query: string): QueryExpression => {
  const normalized = query
    .toLowerCase()
    .replace(/\bin\s+progress\b/g, 'inprogress')
    .replace(/[^a-z0-9\-_ ]+/g, ' ')
    .trim();
  if (!/\s(and|or)\s/.test(normalized)) {
    const tokens = normalized
      .split(/\s+/g)
      .map((token) => token.trim())
      .filter(Boolean)
      .filter((token) => token.length >= 2)
      .filter((token) => !SEARCH_STOPWORDS.has(token));
    const conditions: QueryCondition[] = tokens.map((token) => {
      const alias = STATUS_ALIASES[token];
      return alias ? { type: 'status', value: alias } : { type: 'term', value: token };
    });
    return {
      conditions,
      operators: [],
      hasBooleanOperators: false,
    };
  }
  const parts = normalized.split(/\s+(and|or)\s+/g).filter(Boolean);
  const conditions: QueryCondition[] = [];
  const operators: Array<'and' | 'or'> = [];
  let pendingOperator: 'and' | 'or' | null = null;

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i].trim();
    if (!part) continue;
    if (part === 'and' || part === 'or') {
      pendingOperator = part;
      continue;
    }
    const partTokens = part
      .split(/\s+/g)
      .map((token) => token.trim())
      .filter(Boolean)
      .filter((token) => token.length >= 2)
      .filter((token) => !SEARCH_STOPWORDS.has(token));
    for (let tokenIndex = 0; tokenIndex < partTokens.length; tokenIndex += 1) {
      const token = partTokens[tokenIndex];
      if (conditions.length > 0) {
        operators.push(tokenIndex === 0 ? (pendingOperator ?? 'and') : 'and');
      }
      const alias = STATUS_ALIASES[token];
      if (alias) {
        conditions.push({ type: 'status', value: alias });
      } else {
        conditions.push({ type: 'term', value: token });
      }
      pendingOperator = null;
    }
  }

  return {
    conditions,
    operators,
    hasBooleanOperators: operators.length > 0,
  };
};

export const evaluateExpressionForRow = (row: SemanticRow, expression: QueryExpression): boolean => {
  if (expression.conditions.length === 0) return true;
  const title = (row.title ?? '').toLowerCase();
  const project = (row.project_name ?? '').toLowerCase();
  const priority = (row.priority ?? '').toLowerCase();
  const status = (row.status ?? '').toUpperCase();
  const conditionValues = expression.conditions.map((condition) => {
    if (condition.type === 'status') {
      return status === condition.value;
    }
    return title.includes(condition.value) || project.includes(condition.value) || priority.includes(condition.value);
  });
  let result = conditionValues[0] ?? true;
  for (let i = 1; i < conditionValues.length; i += 1) {
    const operator = expression.operators[i - 1] ?? 'and';
    if (operator === 'or') {
      result = result || conditionValues[i];
    } else {
      result = result && conditionValues[i];
    }
  }
  return result;
};

const lexicalTokenCoverage = (row: SemanticRow, tokens: string[]): number => {
  if (!tokens.length) return 0;
  const haystack = [
    row.title ?? '',
    row.project_name ?? '',
    row.status ?? '',
    row.priority ?? '',
    row.due_date ?? '',
  ]
    .join(' ')
    .toLowerCase();
  const hits = tokens.filter((token) => haystack.includes(token)).length;
  return hits / tokens.length;
};

export const semanticSearchHandler = async (req: Request, res: Response): Promise<void> => {
  console.log('[semanticSearch] tenantId:', req.tenantId, 'body:', req.body);
  const parsed = searchSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request payload', details: parsed.error.flatten() });
    return;
  }

  const jwtTenantId = req.tenantId;
  const headerTenantId = (req.header('x-tenant-id') ?? '').trim() || null;
  if (!jwtTenantId) {
    res.status(401).json({ error: 'Missing tenant context' });
    return;
  }

  const { query, limit = 20, projectId = null, status = null, tenantId: requestedTenantId = null } = parsed.data;
  const effectiveTenantId = requestedTenantId || headerTenantId || jwtTenantId;
  const inferredStatus = extractStatusFromQuery(query);
  const queryExpression = parseQueryExpression(query);
  const queryTokens = tokenizeQuery(query);
  const effectiveStatus = status || (queryExpression.hasBooleanOperators ? null : inferredStatus);

  if (!effectiveTenantId) {
    res.status(400).json({ error: 'tenant_id_required' });
    return;
  }

  if (effectiveTenantId !== jwtTenantId || (requestedTenantId && requestedTenantId !== jwtTenantId) || (headerTenantId && headerTenantId !== jwtTenantId)) {
    res.status(403).json({ error: 'Tenant mismatch in request context' });
    return;
  }

  const allowKeywordFallback = process.env.AI_ALLOW_KEYWORD_FALLBACK === '1';
  const tenantTimezone = await getTenantTimezone(effectiveTenantId);

  // Fallback: keyword search
  const queryKeywordCandidates = async (maxRows: number) => {
    const patterns = queryTokens.length > 0 ? queryTokens.map((token) => `%${token}%`) : [`%${query}%`];
    const keywordResults = await db.query(
      `
      SELECT
        t.id,
        t.title,
        t.status,
        t.priority,
        t.due_date,
        t.project_id,
        CASE
          WHEN t.title ILIKE $1 THEN 0.95
          WHEN COALESCE(p.name, '') ILIKE $1 THEN 0.9
          WHEN t.description ILIKE $1 THEN 0.75
          WHEN t.status::text ILIKE $1 THEN 0.72
          WHEN t.priority::text ILIKE $1 THEN 0.71
          WHEN to_char(t.due_date::date, 'YYYY-MM-DD') ILIKE $1 THEN 0.7
          ELSE 0.6
        END AS score
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.tenant_id::text = $2::text
        AND ($3::text IS NULL OR t.project_id::text = $3::text)
        AND ($4::text IS NULL OR t.status::text = $4::text)
        AND (
          t.title ILIKE ANY($1::text[])
          OR COALESCE(t.description, '') ILIKE ANY($1::text[])
          OR COALESCE(p.name, '') ILIKE ANY($1::text[])
          OR t.status::text ILIKE ANY($1::text[])
          OR t.priority::text ILIKE ANY($1::text[])
          OR to_char(t.due_date::date, 'YYYY-MM-DD') ILIKE ANY($1::text[])
        )
      ORDER BY score DESC, t.updated_at DESC
      LIMIT $5
      `,
      [patterns, effectiveTenantId, projectId, effectiveStatus, maxRows],
    );
    return keywordResults.rows as SemanticRow[];
  };

  const keywordFallback = async () => {
    const keywordRows = await queryKeywordCandidates(limit * 3);
    const keywordResults = keywordRows
      .filter((row) => evaluateExpressionForRow(row, queryExpression))
      .slice(0, limit);
    console.log('[semanticSearch] keyword fallback rows:', keywordResults.length);
    res.status(200).json({
      data: keywordResults,
      meta: {
        total: keywordResults.length,
        query,
        tenantId: effectiveTenantId,
        timezone: tenantTimezone,
        mode: 'keyword-fallback',
      },
    });
  };

  try {
    const queryEmbedding = await createEmbedding(query);
    const vector = toPgVector(queryEmbedding);
    console.log('[semanticSearch] embedding vector:', queryEmbedding);
    console.log('[semanticSearch] embedding length:', Array.isArray(queryEmbedding) ? queryEmbedding.length : 'N/A');

    const results = await db.query<SemanticRow>(
      `
      SELECT
        t.id,
        t.title,
        t.status,
        t.priority,
        t.due_date,
        t.project_id,
        p.name AS project_name,
        1 - (te.embedding <=> $1::vector) AS score
      FROM task_embeddings te
      JOIN tasks t ON t.id = te.task_id
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE te.tenant_id::text = $2::text
        AND ($3::text IS NULL OR t.project_id::text = $3::text)
        AND ($4::text IS NULL OR t.status::text = $4::text)
      ORDER BY te.embedding <=> $1::vector
      LIMIT $5
      `,
      [vector, effectiveTenantId, projectId, effectiveStatus, limit],
    );
    console.log('[semanticSearch] semantic raw rows:', results.rows.length);
    console.log('[semanticSearch] semantic rows:', results.rows);
    const tokens = tokenizeQuery(query);
    const queryLower = query.toLowerCase();
    const titleTermFilter = tokens.filter((token) => !STATUS_ALIASES[token]);
    const requireTitleTermMatch = titleTermFilter.length > 0 && !queryExpression.hasBooleanOperators && Boolean(effectiveStatus);
    const reranked = results.rows
      .map((row) => {
        const coverage = lexicalTokenCoverage(row, tokens);
        const titleText = (row.title ?? '').toLowerCase();
        const projectText = (row.project_name ?? '').toLowerCase();
        const exactPhraseBoost =
          titleText.includes(queryLower) || projectText.includes(queryLower) ? 0.2 : 0;
        const lexicalBoost = coverage * 0.35 + exactPhraseBoost;
        const finalScore = row.score * 0.65 + lexicalBoost;
        return {
          ...row,
          score: Number(finalScore.toFixed(6)),
          _semanticScore: row.score,
          _coverage: coverage,
        };
      })
      .filter((row) => {
        if (row._semanticScore < 0.2) return false;
        if (tokens.length > 0 && row._coverage < 0.2) return false;
        if (requireTitleTermMatch) {
          const title = (row.title ?? '').toLowerCase();
          const anyTitleHit = titleTermFilter.some((term) => title.includes(term));
          if (!anyTitleHit) return false;
        }
        if (!evaluateExpressionForRow(row, queryExpression)) return false;
        return true;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const semanticFiltered = reranked.map(({ _semanticScore, _coverage, ...row }) => row);
    let filtered = semanticFiltered;
    if (queryExpression.hasBooleanOperators || queryTokens.length > 1) {
      const keywordRows = await queryKeywordCandidates(limit * 3);
      const keywordFiltered = keywordRows.filter((row) => evaluateExpressionForRow(row, queryExpression));
      const seen = new Set(filtered.map((row) => row.id));
      for (const row of keywordFiltered) {
        if (seen.has(row.id)) continue;
        filtered.push(row);
        seen.add(row.id);
      }
      filtered = filtered.slice(0, limit);
    }
    console.log('[semanticSearch] semantic filtered rows:', filtered.length);
    if (filtered.length === 0) {
      if (allowKeywordFallback) {
        await keywordFallback();
        return;
      }
      res.status(200).json({
        data: [],
        meta: {
          total: 0,
          query,
          tenantId: effectiveTenantId,
          timezone: tenantTimezone,
          mode: 'semantic-empty',
        },
      });
      return;
    }
    res.status(200).json({
      data: filtered,
      meta: {
        total: filtered.length,
        query,
        status: effectiveStatus,
        tenantId: effectiveTenantId,
        timezone: tenantTimezone,
        mode: 'semantic',
      },
    });
  } catch (error) {
    console.error('[semanticSearch] Error in semantic search, falling back:', error);
    if (allowKeywordFallback) {
      await keywordFallback();
      return;
    }
    res.status(503).json({
      error: 'semantic_search_unavailable',
      message: 'Semantic search model is unavailable. Configure embedding model and task embeddings.',
      meta: {
        query,
        tenantId: effectiveTenantId,
        timezone: tenantTimezone,
        mode: 'semantic-unavailable',
      },
    });
  }
};
