import {
  FeatureFlag,
  EvaluationContext,
  EvaluationDetails,
  FlagConfiguration,
  EvaluationReason,
  ErrorCode,
} from './types.js';
import { isWithinRollout, selectVariantByWeight, calculateBucket } from './murmurhash.js';
import { matchTargetingRules } from './matcher.js';

export class FeatureFlagEngine {
  private flags: Map<string, FeatureFlag> = new Map();
  private metadata: Record<string, unknown> = {};

  constructor(initialFlags?: FeatureFlag[]) {
    if (initialFlags) {
      for (const flag of initialFlags) {
        this.flags.set(flag.key, flag);
      }
    }
  }

  /**
   * Registers or updates a feature flag.
   */
  public setFlag(flag: FeatureFlag): void {
    const updatedFlag: FeatureFlag = {
      ...flag,
      updatedAt: new Date().toISOString(),
      createdAt: flag.createdAt || new Date().toISOString(),
    };
    this.flags.set(flag.key, updatedFlag);
  }

  /**
   * Retrieves a feature flag definition.
   */
  public getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  /**
   * Deletes a feature flag from the engine.
   */
  public deleteFlag(key: string): boolean {
    return this.flags.delete(key);
  }

  /**
   * Returns all registered feature flags.
   */
  public getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Loads an entire configuration structure (e.g. from YAML or database).
   */
  public loadConfiguration(config: FlagConfiguration): void {
    this.flags.clear();
    if (config.flags) {
      for (const [key, flag] of Object.entries(config.flags)) {
        this.flags.set(key, { ...flag, key });
      }
    }
    this.metadata = config.metadata || {};
  }

  /**
   * Exports the current engine state to FlagConfiguration format.
   */
  public exportConfiguration(): FlagConfiguration {
    const flagsObj: Record<string, FeatureFlag> = {};
    for (const [key, flag] of this.flags.entries()) {
      flagsObj[key] = flag;
    }
    return {
      version: '1.0.0',
      flags: flagsObj,
      metadata: {
        ...this.metadata,
        updatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Evaluates a feature flag according to OpenFeature specification.
   */
  public evaluate<T = unknown>(
    flagKey: string,
    fallbackValue: T,
    context: EvaluationContext = {}
  ): EvaluationDetails<T> {
    const now = new Date().toISOString();
    const flag = this.flags.get(flagKey);

    // 1. Check if flag exists
    if (!flag) {
      return {
        flagKey,
        value: fallbackValue,
        reason: 'ERROR',
        errorCode: 'FLAG_NOT_FOUND',
        errorMessage: `Feature flag "${flagKey}" not found in FlagForge engine`,
        evaluatedAt: now,
      };
    }

    // 2. Check if flag is disabled (killswitch)
    if (!flag.enabled) {
      const disabledValue = (flag.defaultValue as T) ?? fallbackValue;
      return {
        flagKey,
        value: disabledValue,
        variant: flag.defaultVariant,
        reason: 'DISABLED',
        evaluatedAt: now,
      };
    }

    // 3. Evaluate Targeting Rules
    if (flag.rules && flag.rules.length > 0) {
      const matchResult = matchTargetingRules(flag.rules, context);
      if (matchResult) {
        const { matchedRule, ruleIndex } = matchResult;
        let resolvedValue: unknown;
        let resolvedVariant = matchedRule.serve.variant;

        if (resolvedVariant && flag.variants && resolvedVariant in flag.variants) {
          resolvedValue = flag.variants[resolvedVariant];
        } else if (matchedRule.serve.value !== undefined) {
          resolvedValue = matchedRule.serve.value;
        } else {
          resolvedValue = flag.defaultValue;
        }

        return this.validateAndFormat(
          flagKey,
          resolvedValue as T,
          flag,
          fallbackValue,
          'TARGETING_MATCH',
          resolvedVariant,
          ruleIndex,
          matchedRule.id
        );
      }
    }

    // 4. Evaluate Percentage / Canary Rollout
    if (flag.rollout && flag.rollout.percentage !== undefined) {
      const stickinessKey = flag.rollout.stickinessProperty || 'targetingKey';
      const identifier = String(
        context[stickinessKey] ??
          context.targetingKey ??
          context.userId ??
          context.id ??
          'anonymous'
      );

      // Multi-variant split rollout
      if (flag.rollout.variants && flag.rollout.variants.length > 0) {
        const { variant: chosenVariant, bucket } = selectVariantByWeight(
          flag.key,
          identifier,
          flag.rollout.variants,
          flag.rollout.salt
        );

        const val = flag.variants && chosenVariant in flag.variants
          ? flag.variants[chosenVariant]
          : flag.defaultValue;

        const res = this.validateAndFormat(
          flagKey,
          val as T,
          flag,
          fallbackValue,
          'SPLIT',
          chosenVariant
        );
        res.bucket = bucket;
        return res;
      }

      // Simple percentage rollout (e.g. boolean canary)
      const { within, bucket } = isWithinRollout(
        flag.key,
        identifier,
        flag.rollout.percentage,
        flag.rollout.salt
      );

      if (within) {
        // If flag has variants, use first non-default or 'on'/'treatment' variant
        let treatmentValue: unknown = true;
        let treatmentVariant = 'on';

        if (flag.type === 'boolean') {
          treatmentValue = true;
          treatmentVariant = 'on';
        } else if (flag.variants) {
          const keys = Object.keys(flag.variants).filter((k) => k !== flag.defaultVariant);
          if (keys.length > 0) {
            treatmentVariant = keys[0];
            treatmentValue = flag.variants[treatmentVariant];
          } else {
            treatmentValue = flag.defaultValue;
          }
        }

        const res = this.validateAndFormat(
          flagKey,
          treatmentValue as T,
          flag,
          fallbackValue,
          'SPLIT',
          treatmentVariant
        );
        res.bucket = bucket;
        return res;
      } else {
        // Outside rollout percentage -> serve default
        const defaultVal = flag.variants && flag.defaultVariant && flag.defaultVariant in flag.variants
          ? flag.variants[flag.defaultVariant]
          : flag.defaultValue;

        const res = this.validateAndFormat(
          flagKey,
          defaultVal as T,
          flag,
          fallbackValue,
          'SPLIT',
          flag.defaultVariant || 'off'
        );
        res.bucket = bucket;
        return res;
      }
    }

    // 5. Default Fallback
    const defaultVal = flag.variants && flag.defaultVariant && flag.defaultVariant in flag.variants
      ? flag.variants[flag.defaultVariant]
      : flag.defaultValue;

    return this.validateAndFormat(
      flagKey,
      defaultVal as T,
      flag,
      fallbackValue,
      'DEFAULT',
      flag.defaultVariant
    );
  }

  /**
   * Evaluates all flags registered in the engine for the provided context.
   */
  public evaluateAll(context: EvaluationContext = {}): Record<string, EvaluationDetails> {
    const results: Record<string, EvaluationDetails> = {};
    for (const [key, flag] of this.flags.entries()) {
      results[key] = this.evaluate(key, flag.defaultValue, context);
    }
    return results;
  }

  /**
   * Helper to ensure returned type matches flag type and construct EvaluationDetails.
   */
  private validateAndFormat<T>(
    flagKey: string,
    resolvedValue: T,
    flag: FeatureFlag,
    fallbackValue: T,
    reason: EvaluationReason,
    variant?: string,
    ruleIndex?: number,
    matchedRuleId?: string
  ): EvaluationDetails<T> {
    const now = new Date().toISOString();

    // Type checking
    const actualType = typeof resolvedValue;
    let typeOk = true;

    if (flag.type === 'boolean' && actualType !== 'boolean') typeOk = false;
    else if (flag.type === 'string' && actualType !== 'string') typeOk = false;
    else if (flag.type === 'number' && actualType !== 'number') typeOk = false;
    else if (flag.type === 'object' && (actualType !== 'object' || resolvedValue === null)) typeOk = false;

    if (!typeOk) {
      return {
        flagKey,
        value: fallbackValue,
        variant,
        reason: 'ERROR',
        errorCode: 'TYPE_MISMATCH',
        errorMessage: `Evaluated value ${JSON.stringify(resolvedValue)} does not match flag type "${flag.type}"`,
        evaluatedAt: now,
      };
    }

    return {
      flagKey,
      value: resolvedValue,
      variant,
      reason,
      ruleIndex,
      matchedRuleId,
      flagMetadata: {
        type: flag.type,
        lifecycle: flag.lifecycle,
        canaryStage: flag.canaryStage,
        tags: flag.tags,
      },
      evaluatedAt: now,
    };
  }
}
