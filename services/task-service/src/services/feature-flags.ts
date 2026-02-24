export interface FeatureFlagValue {
  enabled: boolean;
  scope: string;
}

const featureFlagsStore = new Map<string, FeatureFlagValue>([
  ['workflow_v2', { enabled: true, scope: 'global' }],
  ['ai_assist', { enabled: false, scope: 'global' }],
  ['beta_reports', { enabled: true, scope: 'tenant_override' }],
]);

export const getFeatureFlags = (tenantId?: string) =>
  Array.from(featureFlagsStore.entries()).map(([key, value]) => ({
    key,
    enabled: value.enabled,
    scope: value.scope,
    tenantId: tenantId ?? null,
  }));

export const getFeatureFlagByKey = (key: string) => featureFlagsStore.get(key);

export const hasFeatureFlag = (key: string) => featureFlagsStore.has(key);

export const setFeatureFlag = (key: string, value: FeatureFlagValue) => {
  featureFlagsStore.set(key, value);
};
