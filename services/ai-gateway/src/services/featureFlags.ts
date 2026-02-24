import type { Request } from 'express';

const parseBoolean = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
};

export const featureFlags = {
  killSwitch: () => parseBoolean(process.env.AI_KILL_SWITCH, false),
  taskCreation: () => parseBoolean(process.env.AI_FEATURE_TASK_CREATION, true),
  semanticSearch: () => parseBoolean(process.env.AI_FEATURE_SEMANTIC_SEARCH, true),
  taskSummary: () => parseBoolean(process.env.AI_FEATURE_TASK_SUMMARY, true),
  weeklyDigest: () => parseBoolean(process.env.AI_FEATURE_WEEKLY_DIGEST, true),
  workflowSuggest: () => parseBoolean(process.env.AI_FEATURE_WORKFLOW_SUGGEST, true),
};

export const isFeatureEnabledForRequest = (
  feature: 'task_creation' | 'semantic_search' | 'task_summary' | 'weekly_digest' | 'workflow_suggest',
  _req: Request,
): boolean => {
  if (featureFlags.killSwitch()) return false;

  switch (feature) {
    case 'task_creation':
      return featureFlags.taskCreation();
    case 'semantic_search':
      return featureFlags.semanticSearch();
    case 'task_summary':
      return featureFlags.taskSummary();
    case 'weekly_digest':
      return featureFlags.weeklyDigest();
    case 'workflow_suggest':
      return featureFlags.workflowSuggest();
    default:
      return false;
  }
};
