import { EvaluationDetails, FeatureFlag } from '../core/types.js';

export interface OFREPResponse<T = unknown> {
  key: string;
  value: T;
  reason?: string;
  variant?: string;
  errorCode?: string;
  errorDetails?: string;
  metadata?: Record<string, unknown>;
}

export interface OFREPBulkResponse {
  flags: OFREPResponse[];
}

/**
 * Transforms an internal EvaluationDetails object into a standard OFREP response payload.
 */
export function formatOFREPResponse<T>(
  details: EvaluationDetails<T>,
  flag?: FeatureFlag
): OFREPResponse<T> {
  if (details.reason === 'ERROR') {
    return {
      key: details.flagKey,
      value: details.value,
      reason: 'ERROR',
      errorCode: details.errorCode || 'GENERAL',
      errorDetails: details.errorMessage || 'An error occurred during evaluation',
      metadata: details.flagMetadata,
    };
  }

  return {
    key: details.flagKey,
    value: details.value,
    reason: details.reason,
    variant: details.variant,
    metadata: {
      ...details.flagMetadata,
      flagName: flag?.name,
      description: flag?.description,
      canaryStage: flag?.canaryStage,
      lifecycle: flag?.lifecycle,
    },
  };
}

/**
 * Transforms an OpenFeature flag configuration to CNCF flagd JSON schema format.
 */
export function exportToFlagdSchema(flags: FeatureFlag[]): Record<string, unknown> {
  const flagdFlags: Record<string, unknown> = {};

  for (const flag of flags) {
    flagdFlags[flag.key] = {
      state: flag.enabled ? 'ENABLED' : 'DISABLED',
      variants: flag.variants,
      defaultVariant: flag.defaultVariant || Object.keys(flag.variants)[0] || 'default',
      targeting: flag.rules.length > 0 ? {
        if: flag.rules.map((r) => ({
          description: r.description,
          conditions: r.conditions,
          return: r.serve.variant,
        })),
      } : undefined,
    };
  }

  return {
    $schema: 'https://flagd.dev/schema/v0/flags.json',
    flags: flagdFlags,
    metadata: {
      exporter: 'FlagForge Local Daemon',
      exportedAt: new Date().toISOString(),
    },
  };
}
