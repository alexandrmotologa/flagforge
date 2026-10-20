/**
 * OpenFeature standard reason codes and types for FlagForge
 */
export type FlagValueType = 'boolean' | 'string' | 'number' | 'object';

export type EvaluationReason =
  | 'TARGETING_MATCH'
  | 'SPLIT'
  | 'DEFAULT'
  | 'DISABLED'
  | 'STATIC'
  | 'ERROR';

export type ErrorCode =
  | 'FLAG_NOT_FOUND'
  | 'TYPE_MISMATCH'
  | 'PARSE_ERROR'
  | 'GENERAL';

export type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'starts_with'
  | 'ends_with'
  | 'contains'
  | 'matches_regex'
  | 'semver_gt'
  | 'semver_gte'
  | 'semver_lt'
  | 'semver_lte'
  | 'date_before'
  | 'date_after';

export interface RuleCondition {
  property: string;
  operator: RuleOperator;
  value: unknown;
}

export interface RuleServe {
  variant?: string;
  value?: unknown;
}

export interface TargetingRule {
  id: string;
  description?: string;
  conditions: RuleCondition[];
  serve: RuleServe;
}

export interface VariantSplit {
  variant: string;
  weight: number; // percentage weight, e.g. 50
}

export interface PercentageRollout {
  percentage: number; // 0 to 100
  stickinessProperty?: string; // defaults to 'targetingKey' or 'userId'
  salt?: string;
  variants?: VariantSplit[];
}

export type CanaryStage =
  | 'internal'
  | 'canary_5'
  | 'beta_25'
  | 'staged_50'
  | 'ga_100'
  | 'custom';

export type FlagLifecycle = 'active' | 'canary' | 'dead' | 'archived';

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  type: FlagValueType;
  enabled: boolean;
  defaultValue: unknown;
  defaultVariant?: string;
  variants: Record<string, unknown>;
  rules: TargetingRule[];
  rollout?: PercentageRollout;
  canaryStage?: CanaryStage;
  lifecycle: FlagLifecycle;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  staleSince?: string; // ISO date string when flag was completed or abandoned
}

export interface EvaluationContext {
  targetingKey?: string;
  userId?: string;
  email?: string;
  country?: string;
  tier?: string;
  appVersion?: string;
  device?: string;
  [key: string]: unknown;
}

export interface EvaluationDetails<T = unknown> {
  flagKey: string;
  value: T;
  variant?: string;
  reason: EvaluationReason;
  ruleIndex?: number;
  matchedRuleId?: string;
  bucket?: number;
  errorCode?: ErrorCode;
  errorMessage?: string;
  flagMetadata?: Record<string, unknown>;
  evaluatedAt: string;
}

export interface FlagConfiguration {
  version: string;
  flags: Record<string, FeatureFlag>;
  metadata?: {
    environment?: string;
    description?: string;
    updatedAt?: string;
  };
}
