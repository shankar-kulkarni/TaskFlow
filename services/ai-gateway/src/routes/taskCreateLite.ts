import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../lib/db.js';
import { getTenantTimezone, getTodayISOInTimeZone } from '../services/tenantTimezone.js';

const schema = z.object({
  description: z.string().min(5),
  targetLanguage: z.string().min(2).max(32).optional(),
});

type LlamaResult = {
  title?: string | null;
  description?: string | null;
  priority?: string | null;
  status?: string | null;
  projectId?: string | null;
  project?: string | null;
  assigneeId?: string | null;
  assignee?: string[] | string | null;
  groupIds?: string[] | null;
  group?: string[] | string | null;
  groups?: string[] | string | null;
  startDate?: string | null;
  dueDate?: string | null;
  estimatedHrs?: number | string | null;
  tags?: unknown;
};

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const extractTargetLanguageFromText = (text: string): string | null => {
  const patterns = [
    /\btranslate\s+(?:title(?:\s+and\s+description)?|description|content)\s+to\s+([a-zA-Z][a-zA-Z\s-]{1,30})\b/i,
    /\btranslate\s+to\s+([a-zA-Z][a-zA-Z\s-]{1,30})\b/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    const value = m?.[1]?.trim();
    if (value) return value;
  }
  return null;
};

const normalizeTargetLanguage = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const raw = value.trim();
  const lower = raw.toLowerCase();
  if (lower.includes('hindi')) return 'Hindi';
  if (lower.includes('spanish')) return 'Spanish';
  if (lower.includes('french')) return 'French';
  if (lower.includes('german')) return 'German';
  if (lower.includes('japanese')) return 'Japanese';
  return raw;
};

const translateTextWithOllama = async (text: string, targetLanguage: string): Promise<string> => {
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const model = process.env.LLAMA_MODEL ?? 'llama3.2:1b';
  const prompt = [
    `Translate the text to ${targetLanguage}.`,
    'Return only the translated text. No quotes, no JSON, no explanation.',
    `Text: ${text}`,
  ].join('\n');

  const res = await fetch(`${ollamaBaseUrl.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { temperature: 0, top_p: 1 },
    }),
  });
  if (!res.ok) return text;
  const json = await res.json().catch(() => ({} as { response?: string }));
  const translated = typeof json.response === 'string' ? json.response.trim() : '';
  return translated || text;
};

const extractTitleFromText = (text: string): string | null => {
  const patterns = [
    /\btask\s*(?:is|as|=|:|called|named)\s*["']?([^,.;\n"]+?)["']?(?=\s*(?:,|;|\.|$))/i,
    /\btitle\s*(?:is|as|=|:|called|named)?\s*["']([^"']+)["']/i,
    /\btitle\s*(?:is|as|=|:|called|named)?\s*([^,.;\n]+?)(?=\s*(?:,|;|\.|$))/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    const value = m?.[1]?.trim();
    if (value) return value;
  }
  return null;
};

const extractDescriptionFromText = (text: string): string | null => {
  const patterns = [
    /\bdescription\s*(?:is|as|=|:)?\s*["']([^"']+)["']/i,
    /\bdescription\s*(?:is|as|=|:)?\s*([^,.;\n]+?)(?=\s*(?:,|;|\.|$))/i,
    /\bdesc\s*(?:is|as|=|:)?\s*["']([^"']+)["']/i,
    /\bdesc\s*(?:is|as|=|:)?\s*([^,.;\n]+?)(?=\s*(?:,|;|\.|$))/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    const value = m?.[1]?.trim();
    if (value) return value;
  }
  return null;
};

const extractAssigneeToken = (text: string): string | null => {
  const patterns = [
    /\bassign(?:ed)?\s*(?:to)?\s*(?:is|as|=|:)?\s*([^,;\n]+?)(?=\s*(?:,|;|$))/i,
    /\bassignee\s*(?:is|as|=|:)?\s*([^,;\n]+?)(?=\s*(?:,|;|$))/i,
    /\buser\s*(?:is|as|=|:)?\s*([^,;\n]+?)(?=\s*(?:,|;|$))/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    const value = m?.[1]?.trim();
    if (value) return value;
  }
  return null;
};

const extractGroupTokens = (text: string): string[] => {
  const patterns = [
    /\bgroups?\s*(?:is|are|as|=|:)?\s*([^;\n]+?)(?=\s*(?:;|$))/i,
    /\bgroup\s*(?:is|are|as|=|:)?\s*([^;\n]+?)(?=\s*(?:;|$))/i,
  ];
  let raw = '';
  for (const pattern of patterns) {
    const m = text.match(pattern);
    if (m?.[1]?.trim()) {
      raw = m[1].trim();
      break;
    }
  }
  if (!raw) return [];
  return raw
    .split(/\s*(?:,|and|&|\/)\s*/i)
    .map((v) => v.replace(/\bgroup\b/gi, '').trim())
    .filter(Boolean);
};

const normalizeStatus = (value: string | null): string | null => {
  if (!value) return null;
  const raw = value.trim().toUpperCase().replace(/\s+/g, '_');
  const allowed = new Set(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'DONE', 'CANCELLED']);
  if (allowed.has(raw)) return raw;
  if (raw === 'COMPLETE' || raw === 'COMPLETED') return 'DONE';
  if (raw === 'INPROGRESS') return 'IN_PROGRESS';
  if (raw === 'REVIEW') return 'IN_REVIEW';
  return null;
};

const normalizePriority = (value: string | null): string | null => {
  if (!value) return null;
  const raw = value.trim().toUpperCase();
  const allowed = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
  if (allowed.has(raw)) return raw;
  if (raw === 'P0' || raw === 'URGENT') return 'CRITICAL';
  if (raw === 'NORMAL') return 'MEDIUM';
  return null;
};

const extractStatusFromText = (text: string): string | null => {
  const patterns = [
    /\bstatus\s*(?:is|as|=|:)?\s*([^,;\n]+?)(?=\s*(?:,|;|$))/i,
    /\bset\s+status\s+(?:to\s+)?([^,;\n]+?)(?=\s*(?:,|;|$))/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    const value = normalizeStatus(m?.[1]?.trim() || null);
    if (value) return value;
  }
  return null;
};

const extractPriorityFromText = (text: string): string | null => {
  const patterns = [
    /\bpriority\s*(?:is|as|=|:)?\s*([^,;\n]+?)(?=\s*(?:,|;|$))/i,
    /\bset\s+priority\s+(?:to\s+)?([^,;\n]+?)(?=\s*(?:,|;|$))/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    const value = normalizePriority(m?.[1]?.trim() || null);
    if (value) return value;
  }
  return null;
};

const resolveUserId = (value: string | null, users: Array<{ id: string; display_name: string }>): string | null => {
  if (!value) return null;
  const norm = value.toLowerCase();
  const exactId = users.find((u) => u.id.toLowerCase() === norm);
  if (exactId) return exactId.id;
  const byName = users.find((u) =>
    u.display_name.toLowerCase() === norm ||
    u.display_name.toLowerCase().includes(norm) ||
    norm.includes(u.display_name.toLowerCase()),
  );
  if (byName) return byName.id;
  const token = norm.match(/\buser\s*(\d+)\b/);
  if (token) {
    const idx = token[1];
    const byNum = users.find((u) => u.id.toLowerCase().endsWith(`-${idx}`) || u.display_name.toLowerCase().includes(`user ${idx}`));
    return byNum?.id || null;
  }
  const numeric = norm.match(/\b(\d+)\b/);
  if (numeric) {
    const idx = numeric[1];
    const byNum = users.find((u) => u.id.toLowerCase().endsWith(`-${idx}`) || u.display_name.toLowerCase().includes(`user ${idx}`));
    if (byNum) return byNum.id;
  }
  return null;
};

const resolveUserIds = (value: string | null, users: Array<{ id: string; display_name: string }>): string[] => {
  if (!value) return [];
  const parts = value
    .split(/\s*(?:,|and|&|\/)\s*/i)
    .map((entry) => entry.trim())
    .filter(Boolean);
  const out = new Set<string>();
  for (const part of parts) {
    const resolved = resolveUserId(part, users);
    if (resolved) out.add(resolved);
  }
  if (out.size > 0) return [...out];

  const userMatches = value.toLowerCase().match(/\buser\s*\d+\b/g) || [];
  for (const match of userMatches) {
    const resolved = resolveUserId(match, users);
    if (resolved) out.add(resolved);
  }
  return [...out];
};

const resolveGroupIds = (values: string[], groups: Array<{ id: string; name: string }>): string[] => {
  const out = new Set<string>();
  for (const value of values) {
    const norm = value.toLowerCase();
    const exact = groups.find((g) => g.name.toLowerCase() === norm);
    if (exact) {
      out.add(exact.id);
      continue;
    }
    const fuzzy = groups.find((g) => g.name.toLowerCase().includes(norm) || norm.includes(g.name.toLowerCase()));
    if (fuzzy) out.add(fuzzy.id);
  }
  return [...out];
};

const extractProjectToken = (text: string): string | null => {
  const patterns = [
    /\bproject\s*(?:is|as|=|:|called|named)?\s*["']([^"']+)["']/i,
    /\bproject\s*(?:is|as|=|:|called|named)?\s*([^,;\n]+?)(?=\s*(?:,|;|$))/i,
    /\bin\s+project\s*["']([^"']+)["']/i,
    /\bin\s+project\s+([^,;\n]+?)(?=\s*(?:,|;|$))/i,
  ];
  for (const pattern of patterns) {
    const m = text.match(pattern);
    const value = m?.[1]?.trim();
    if (value) return value;
  }
  return null;
};

const resolveProjectId = (value: string | null, projects: Array<{ id: string; name: string }>): string | null => {
  if (!value) return null;
  const norm = value.toLowerCase();
  const exact = projects.find((p) => p.name.toLowerCase() === norm || p.id.toLowerCase() === norm);
  if (exact) return exact.id;
  const fuzzy = projects.find((p) => p.name.toLowerCase().includes(norm) || norm.includes(p.name.toLowerCase()));
  return fuzzy?.id || null;
};

const extractEstimatedHoursFromText = (text: string): number | null => {
  const m = text.match(/\b(?:est(?:imated)?\s*hours?|hours?)\s*(?:is|as|=|:)?\s*(\d+(?:\.\d+)?)\b|\b(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/i);
  const raw = m?.[1] || m?.[2];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

const shiftIso = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const nextMonthSameDay = (iso: string): string => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + 1);
  if (d.getUTCDate() < day) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
};

const parseDateByLabel = (
  text: string,
  label: 'start' | 'due',
  todayIso: string,
): string | null => {
  const pattern =
    label === 'start'
      ? /\b(?:start(?:ing)?|begin(?:ning)?)\s*(?:date)?\s*(?:is|as|=|:)?\s*([^,;\n]+?)(?=\s*(?:,|;|$))/i
      : /\b(?:due|by)\s*(?:date)?\s*(?:is|as|=|:)?\s*([^,;\n]+?)(?=\s*(?:,|;|$))/i;
  const m = text.match(pattern);
  const reversePattern =
    label === 'start'
      ? /\b([^,;\n]+?)\s+(?:start(?:ing)?|begin(?:ning)?)(?:\s*date)?\b/i
      : /\b([^,;\n]+?)\s+(?:due|by)(?:\s*date)?\b/i;
  const reverse = text.match(reversePattern);
  const forwardToken = (m?.[1] || '').trim().toLowerCase();
  const reverseToken = (reverse?.[1] || '').trim().toLowerCase();
  const preferReverse =
    label === 'start' &&
    /\b(?:and\s+)?due\b/.test(forwardToken) &&
    Boolean(reverseToken);
  let token = preferReverse ? reverseToken : (forwardToken || reverseToken);
  if (label === 'start' && /\band\s+due\b/.test(token)) {
    token = token.split(/\band\s+due\b/i)[0]?.trim() || token;
  }
  if (!token) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(token)) return token;
  if (/\btom(?:o|mo)?rrow\b/.test(token)) return shiftIso(todayIso, 1);
  if (/\btoday\b/.test(token)) return todayIso;
  if (/\bnext\s+month\s+same\s+day\b/.test(token)) return nextMonthSameDay(todayIso);
  const inDays = token.match(/\bin\s+(\d+)\s+days?\b/);
  if (inDays) return shiftIso(todayIso, Number(inDays[1]));
  return null;
};

const extractFallback = (
  text: string,
  projects: Array<{ id: string; name: string }>,
  users: Array<{ id: string; display_name: string }>,
  groups: Array<{ id: string; name: string }>,
  todayIso: string,
): LlamaResult => {
  const title = extractTitleFromText(text);
  const description = extractDescriptionFromText(text);
  const assigneeToken = extractAssigneeToken(text);
  const groupTokens = extractGroupTokens(text);
  const projectToken = extractProjectToken(text);
  const status = extractStatusFromText(text);
  const priority = extractPriorityFromText(text);
  const projectId = resolveProjectId(projectToken, projects);
  const assigneeId = resolveUserId(assigneeToken, users);
  const groupIds = resolveGroupIds(groupTokens, groups);
  const startDate = parseDateByLabel(text, 'start', todayIso);
  let dueDate = parseDateByLabel(text, 'due', todayIso);
  if (!dueDate && /\bnext\s+month\s+same\s+day\b/i.test(text)) {
    dueDate = nextMonthSameDay(startDate || todayIso);
  }
  if (startDate && dueDate && startDate >= dueDate) {
    dueDate = shiftIso(startDate, 1);
  }

  return {
    title,
    description,
    status: status || 'TODO',
    priority: priority || 'LOW',
    projectId,
    assigneeId,
    groupIds,
    startDate,
    dueDate,
    estimatedHrs: extractEstimatedHoursFromText(text),
    tags: [],
  };
};

const hasMeaningfulExtraction = (value: LlamaResult): boolean =>
  Boolean(
    value.title ||
      value.description ||
      value.priority ||
      value.status ||
      value.projectId ||
      value.assigneeId ||
      (Array.isArray(value.groupIds) && value.groupIds.length > 0) ||
      value.startDate ||
      value.dueDate ||
      value.estimatedHrs !== undefined ||
      (Array.isArray(value.tags) && value.tags.length > 0),
  );

const callOllamaExtract = async (
  text: string,
  timeZone: string,
  projects: Array<{ id: string; name: string }>,
  users: Array<{ id: string; display_name: string }>,
  groups: Array<{ id: string; name: string }>,
  targetLanguage?: string | null,
): Promise<LlamaResult> => {
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const model = process.env.LLAMA_MODEL ?? 'llama3.2:1b';
  const todayIso = getTodayISOInTimeZone(timeZone);
  const prompt = [
    'You are an extraction engine. Every request is unique. Do not infer or fill missing values.',
    'Think step by step internally but output only final JSON.',
    'No prose. Return only JSON.',
    'Only extract values explicitly present in USER_TEXT.',
    'If a field is not explicitly present in USER_TEXT, return null for scalar fields and [] for arrays.',
    'Never reuse values from old prompts/examples.',
    `Today: ${todayIso}. Timezone: ${timeZone}.`,
    'Output keys exactly:',
    'title, description, priority, status, projectId, assigneeId, groupIds, startDate, dueDate, estimatedHrs, tags',
    'Constraints:',
    '- priority in [LOW, MEDIUM, HIGH, CRITICAL] else null',
    '- status in [TODO, IN_PROGRESS, IN_REVIEW, BLOCKED, DONE, CANCELLED] else null',
    '- always calculate startDate first before calculating dueDate',
    '- startDate/dueDate format YYYY-MM-DD.',
    '- Convert relative dates from USER_TEXT (today, tomorrow, yesterday, in N days, next week, next month same day) using Today and Timezone above.',
    '- If both startDate and dueDate are present, dueDate must be later than startDate.',
    '- assigneeId must be one or more exact ids from Users list, else []',
    '- groupIds must be one or more exact ids from Groups list, else []',
    '- tags must be [] unless tags are explicitly mentioned',
    targetLanguage
      ? `- Translate only title and description to: ${targetLanguage}. Keep all other fields unchanged.`
      : '- Keep title and description in the same language as user text unless translation is explicitly requested.',
    'Candidates:',
    `Users: ${JSON.stringify(users)}`,
    `Groups: ${JSON.stringify(groups)}`,
    `Projects: ${JSON.stringify(projects)}`,
    `USER_TEXT: ${text}`,
  ].join('\n');

  const res = await fetch(`${ollamaBaseUrl.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      format: 'json',
      options: {
        temperature: 0,
        top_p: 1,
        repeat_penalty: 1.1,
        num_predict: 220,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ollama extract failed: ${res.status} ${body}`);
  }

  const json = await res.json().catch(() => ({} as { response?: string }));
  const raw = typeof json.response === 'string' ? json.response : '';
  if (!raw.trim()) return {};
  return (JSON.parse(raw) || {}) as LlamaResult;
};

export const taskCreateLiteHandler = async (req: Request, res: Response): Promise<void> => {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_input', details: parsed.error.flatten() });
    return;
  }

  const tenantId = (req as any).tenantId;
  if (!tenantId) {
    res.status(401).json({ error: 'missing_tenant' });
    return;
  }

  const raw = parsed.data.description.trim();
  const inferredTargetLanguage = extractTargetLanguageFromText(raw);
  const targetLanguage = normalizeTargetLanguage(parsed.data.targetLanguage?.trim() || inferredTargetLanguage || null);
  const translationRequested = Boolean(targetLanguage);

  try {
    const tenantTimezone = await getTenantTimezone(tenantId);
    const [projectsResult, usersResult, groupsResult] = await Promise.all([
      db.query<{ id: string; name: string }>(
        `SELECT p.id, p.name
         FROM projects p
         JOIN workspaces w ON w.id = p.workspace_id
         WHERE w.tenant_id = $1
         ORDER BY p.name ASC
         LIMIT 200`,
        [tenantId],
      ),
      db.query<{ id: string; display_name: string }>(
        `SELECT id, display_name
         FROM users
         WHERE tenant_id = $1 AND status = 'ACTIVE'
         ORDER BY display_name ASC
         LIMIT 500`,
        [tenantId],
      ),
      db.query<{ id: string; name: string }>(
        `SELECT id, name
         FROM groups
         WHERE tenant_id = $1
         ORDER BY name ASC
         LIMIT 500`,
        [tenantId],
      ),
    ]);

    const todayIso = getTodayISOInTimeZone(tenantTimezone);
    const modelUsed = process.env.LLAMA_MODEL ?? 'llama3.2:1b';
    const fallbackEnabled = parseBoolean(process.env.AI_TASK_CREATE_LITE_FALLBACK, false);
    const fallback = extractFallback(raw, projectsResult.rows, usersResult.rows, groupsResult.rows, todayIso);

    let ll: LlamaResult = {};
    let llamaCalled = true;

    try {
      ll = await callOllamaExtract(
        raw,
        tenantTimezone,
        projectsResult.rows,
        usersResult.rows,
        groupsResult.rows,
        targetLanguage,
      );
    } catch (error) {
      if (!fallbackEnabled) {
        throw error;
      }
      ll = fallback;
      llamaCalled = false;
    }

    if (!hasMeaningfulExtraction(ll) && fallbackEnabled) {
      ll = fallback;
      llamaCalled = false;
    }

    if (!hasMeaningfulExtraction(ll)) {
      res.status(422).json({ error: 'empty_extraction', message: 'Could not extract task entities.' });
      return;
    }

    const hasTitleMention = /\btitle\b/i.test(raw);
    const hasDescriptionMention = /\b(?:description|desc)\b/i.test(raw);
    const hasStatusMention = /\bstatus\b/i.test(raw);
    const hasPriorityMention = /\bpriority\b/i.test(raw);
    const hasProjectMention = /\bproject\b/i.test(raw);
    const hasAssigneeMention = /\b(?:assign(?:ed)?\s*(?:to)?|assignee|user)\b/i.test(raw);
    const hasGroupMention = /\bgroups?\b/i.test(raw);
    const hasStartDateMention = /\b(?:start(?:ing)?|begin(?:ning)?)\b/i.test(raw);
    const hasDueDateMention = /\b(?:due|by)\b/i.test(raw);
    const hasEstimatedMention = /\b(?:est(?:imated)?\s*hours?|hours?|h|hr|hrs)\b/i.test(raw);
    const hasTagsMention = /\btags?\b/i.test(raw);

    const tags = hasTagsMention && Array.isArray(ll.tags) ? ll.tags : [];
    const explicitTitle = extractTitleFromText(raw);
    const explicitDescription = extractDescriptionFromText(raw);
    const explicitStatus = extractStatusFromText(raw);
    const explicitPriority = extractPriorityFromText(raw);
    const explicitProjectToken = extractProjectToken(raw);
    const explicitAssigneeToken = extractAssigneeToken(raw);
    const explicitAssigneeIds = resolveUserIds(explicitAssigneeToken, usersResult.rows);
    const explicitGroupIds = resolveGroupIds(extractGroupTokens(raw), groupsResult.rows);
    const explicitGroupNames = explicitGroupIds
      .map((id) => groupsResult.rows.find((groupRow) => groupRow.id === id)?.name || null)
      .filter((name): name is string => Boolean(name));
    const explicitStartDate = parseDateByLabel(raw, 'start', todayIso);
    const explicitDueDate = parseDateByLabel(raw, 'due', todayIso);
    const explicitEstimatedHrs = extractEstimatedHoursFromText(raw);
    const asArray = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
      if (typeof value === 'string' && value.trim().length > 0) return [value.trim()];
      return [];
    };
    const projectLookup = (value: string | null | undefined): string | null => {
      if (!value) return null;
      const norm = value.trim().toLowerCase();
      const byId = projectsResult.rows.find((p) => p.id.toLowerCase() === norm);
      if (byId) return byId.name;
      const byName = projectsResult.rows.find((p) => p.name.toLowerCase() === norm);
      if (byName) return byName.name;
      const fuzzy = projectsResult.rows.find((p) => p.name.toLowerCase().includes(norm) || norm.includes(p.name.toLowerCase()));
      return fuzzy?.name || value;
    };
    const assigneeValues = Array.from(new Set([
      ...asArray(ll.assignee),
      ...(typeof ll.assigneeId === 'string' ? [ll.assigneeId] : []),
      ...(Array.isArray(ll.assigneeId) ? ll.assigneeId.filter((id): id is string => typeof id === 'string') : []),
      ...(fallbackEnabled && typeof fallback.assigneeId === 'string' ? [fallback.assigneeId] : []),
    ]));
    const aiResolvedAssignee = Array.from(new Set(
      assigneeValues.flatMap((value) => resolveUserIds(value, usersResult.rows))
    ));
    const assignee = hasAssigneeMention ? (explicitAssigneeIds.length > 0 ? explicitAssigneeIds : aiResolvedAssignee) : [];
    const groupValues = Array.from(new Set([
      ...asArray(ll.group),
      ...asArray(ll.groups),
      ...asArray(ll.groupIds),
      ...(fallbackEnabled ? asArray(fallback.groupIds) : []),
    ]));
    const aiResolvedGroup = Array.from(
      new Set(
        groupValues
          .map((value) => {
            const norm = value.toLowerCase();
            const byId = groupsResult.rows.find((g) => g.id.toLowerCase() === norm);
            if (byId) return byId.name;
            const byName = groupsResult.rows.find((g) => g.name.toLowerCase() === norm);
            if (byName) return byName.name;
            const fuzzy = groupsResult.rows.find((g) => g.name.toLowerCase().includes(norm) || norm.includes(g.name.toLowerCase()));
            return fuzzy?.name || value;
          })
          .filter((name): name is string => Boolean(name && name.trim().length > 0)),
      ),
    );
    const group = hasGroupMention ? (explicitGroupNames.length > 0 ? explicitGroupNames : aiResolvedGroup) : [];
    const estimatedHrs =
      ll.estimatedHrs !== undefined && ll.estimatedHrs !== null && Number.isFinite(Number(ll.estimatedHrs))
        ? Number(ll.estimatedHrs)
        : null;
    const resolvedEstimatedHrs = hasEstimatedMention ? (explicitEstimatedHrs ?? estimatedHrs) : null;

    const resolvedStartDate = hasStartDateMention
      ? (explicitStartDate || (fallbackEnabled
          ? (fallback.startDate || (typeof ll.startDate === 'string' && ll.startDate ? ll.startDate : null))
          : (typeof ll.startDate === 'string' && ll.startDate ? ll.startDate : null)))
      : null;
    const resolvedDueDate = hasDueDateMention
      ? (explicitDueDate || (fallbackEnabled
          ? (fallback.dueDate || (typeof ll.dueDate === 'string' && ll.dueDate ? ll.dueDate : null))
          : (typeof ll.dueDate === 'string' && ll.dueDate ? ll.dueDate : null)))
      : null;

    let resolvedTitle = hasTitleMention ? (explicitTitle || (typeof ll.title === 'string' && ll.title ? ll.title : null)) : null;
    let resolvedDescription = hasDescriptionMention ? (explicitDescription || (typeof ll.description === 'string' && ll.description ? ll.description : null)) : null;

    if (translationRequested && targetLanguage) {
      const baseTitle = explicitTitle || resolvedTitle;
      const baseDescription = explicitDescription || resolvedDescription;
      if (baseTitle && (!resolvedTitle || baseTitle.trim().toLowerCase() === resolvedTitle.trim().toLowerCase())) {
        resolvedTitle = await translateTextWithOllama(baseTitle, targetLanguage);
      }
      if (baseDescription && (!resolvedDescription || baseDescription.trim().toLowerCase() === resolvedDescription.trim().toLowerCase())) {
        resolvedDescription = await translateTextWithOllama(baseDescription, targetLanguage);
      }
    }

    const translationApplied = Boolean(
      translationRequested &&
      ((resolvedTitle && resolvedTitle.trim().length > 0) || (resolvedDescription && resolvedDescription.trim().length > 0)),
    );

    res.status(200).json({
      data: {
        title: resolvedTitle,
        description: resolvedDescription,
        priority: hasPriorityMention ? (explicitPriority || (typeof ll.priority === 'string' && ll.priority ? ll.priority : null)) : null,
        status: hasStatusMention ? (explicitStatus || (typeof ll.status === 'string' && ll.status ? ll.status : null)) : null,
        project: hasProjectMention
          ? projectLookup(
              explicitProjectToken ||
              (typeof ll.project === 'string' ? ll.project : null) ||
              (typeof ll.projectId === 'string' ? ll.projectId : null),
            )
          : null,
        assignee,
        group,
        startDate: resolvedStartDate,
        dueDate: resolvedDueDate,
        estimatedHrs: resolvedEstimatedHrs,
        tags,
      },
      mode: llamaCalled ? 'ollama-extract' : 'heuristic-fallback',
      model: modelUsed,
      timezone: tenantTimezone,
      fallbackEnabled,
      targetLanguage,
      translationApplied,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Task assist failed';
    res.status(500).json({ error: 'task_create_lite_failed', message });
  }
};

