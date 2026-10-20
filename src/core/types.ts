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
  | 'PREREQUISITE_FAILED'
  | 'ERROR';

export type ErrorCode =
  | 'FLAG_NOT_FOUND'
  | 'TYPE_MISMATCH'
  | 'PARSE_ERROR'
  | 'CIRCULAR_DEPENDENCY'
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
  weight: number;
}

export interface PercentageRollout {
  percentage: number; // 0 to 100
  stickinessProperty?: string;
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

export interface FlagPrerequisite {
  flagKey: string;
  expectedVariant?: string;
  expectedValue?: unknown;
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  errorThresholdPercent: number; // e.g. 5 for 5%
  minRequests: number; // minimum requests before evaluating threshold
  windowSeconds: number; // sliding window, e.g. 60s
  action: 'killswitch' | 'rollback_stage';
}

export interface RolloutSchedule {
  id: string;
  at: string; // ISO date string
  stage: CanaryStage;
  percentage: number;
  applied?: boolean;
}

export interface EnvironmentOverride {
  enabled?: boolean;
  rollout?: PercentageRollout;
  canaryStage?: CanaryStage;
}

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
  prerequisites?: FlagPrerequisite[];
  circuitBreaker?: CircuitBreakerConfig;
  schedules?: RolloutSchedule[];
  environments?: Record<string, EnvironmentOverride>; // 'local' | 'staging' | 'production'
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  staleSince?: string;
}

export interface EvaluationContext {
  targetingKey?: string;
  userId?: string;
  email?: string;
  country?: string;
  tier?: string;
  appVersion?: string;
  device?: string;
  environment?: string; // e.g. 'local', 'staging', 'production'
  [key: string]: unknown;
}

export interface EvaluationDetails<T = unknown> {
  flagKey: string;
  value: T;
  variant?: string;
  reason: EvaluationReason;
  ruleIndex?: number;
  matchedRuleId?: string;
  failedPrerequisiteKey?: string;
  bucket?: number;
  errorCode?: ErrorCode;
  errorMessage?: string;
  flagMetadata?: Record<string, unknown>;
  evaluatedAt: string;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: Array<'TOGGLE' | 'CANARY_ADVANCE' | 'CIRCUIT_BREAKER_TRIGGERED' | 'SCHEDULE_TRIGGERED'>;
  enabled: boolean;
}

export interface FlagConfiguration {
  version: string;
  flags: Record<string, FeatureFlag>;
  webhooks?: WebhookConfig[];
  metadata?: {
    environment?: string;
    description?: string;
    updatedAt?: string;
  };
}
