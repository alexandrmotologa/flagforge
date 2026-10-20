import {
  FeatureFlag,
  EvaluationContext,
  EvaluationDetails,
  FlagConfiguration,
  EvaluationReason,
  ErrorCode,
} from './types.js';
import { isWithinRollout, selectVariantByWeight } from './murmurhash.js';
import { matchTargetingRules } from './matcher.js';

export interface DependencyNode {
  key: string;
  name: string;
  enabled: boolean;
  prerequisites: string[];
  dependents: string[];
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  hasCycles: boolean;
  cycleKeys?: string[];
}

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

  public setFlag(flag: FeatureFlag): void {
    const updatedFlag: FeatureFlag = {
      ...flag,
      updatedAt: new Date().toISOString(),
      createdAt: flag.createdAt || new Date().toISOString(),
    };
    this.flags.set(flag.key, updatedFlag);
  }

  public getFlag(key: string): FeatureFlag | undefined {
    return this.flags.get(key);
  }

  public deleteFlag(key: string): boolean {
    return this.flags.delete(key);
  }

  public getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  public loadConfiguration(config: FlagConfiguration): void {
    this.flags.clear();
    if (config.flags) {
      for (const [key, flag] of Object.entries(config.flags)) {
        this.flags.set(key, { ...flag, key });
      }
    }
    this.metadata = config.metadata || {};
  }

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
   * Constructs the full dependency graph of all flags and detects circular dependencies.
   */
  public getDependencyGraph(): DependencyGraph {
    const nodesMap = new Map<string, DependencyNode>();

    for (const flag of this.flags.values()) {
      const prereqs = flag.prerequisites?.map((p) => p.flagKey) || [];
      nodesMap.set(flag.key, {
        key: flag.key,
        name: flag.name,
        enabled: flag.enabled,
        prerequisites: prereqs,
        dependents: [],
      });
    }

    // Populate dependents
    for (const node of nodesMap.values()) {
      for (const prereqKey of node.prerequisites) {
        const prereqNode = nodesMap.get(prereqKey);
        if (prereqNode) {
          prereqNode.dependents.push(node.key);
        }
      }
    }

    // Detect cycles via DFS
    const visited = new Set<string>();
    const recStack = new Set<string>();
    let hasCycles = false;
    let cycleKeys: string[] = [];

    const checkCycle = (key: string, path: string[]): boolean => {
      visited.add(key);
      recStack.add(key);

      const node = nodesMap.get(key);
      if (node) {
        for (const neighbor of node.prerequisites) {
          if (!visited.has(neighbor)) {
            if (checkCycle(neighbor, [...path, neighbor])) return true;
          } else if (recStack.has(neighbor)) {
            hasCycles = true;
            cycleKeys = [...path, neighbor];
            return true;
          }
        }
      }

      recStack.delete(key);
      return false;
    };

    for (const key of nodesMap.keys()) {
      if (!visited.has(key)) {
        if (checkCycle(key, [key])) break;
      }
    }

    return {
      nodes: Array.from(nodesMap.values()),
      hasCycles,
      cycleKeys: hasCycles ? cycleKeys : undefined,
    };
  }

  /**
   * Evaluates a feature flag according to OpenFeature specification with
   * prerequisite enforcement and environment overrides.
   */
  public evaluate<T = unknown>(
    flagKey: string,
    fallbackValue: T,
    context: EvaluationContext = {},
    evalStack: Set<string> = new Set()
  ): EvaluationDetails<T> {
    const now = new Date().toISOString();

    // 0. Circular Dependency Protection
    if (evalStack.has(flagKey)) {
      return {
        flagKey,
        value: fallbackValue,
        reason: 'ERROR',
        errorCode: 'CIRCULAR_DEPENDENCY',
        errorMessage: `Circular dependency detected involving prerequisite flag "${flagKey}"`,
        evaluatedAt: now,
      };
    }

    const rawFlag = this.flags.get(flagKey);

    // 1. Check if flag exists
    if (!rawFlag) {
      return {
        flagKey,
        value: fallbackValue,
        reason: 'ERROR',
        errorCode: 'FLAG_NOT_FOUND',
        errorMessage: `Feature flag "${flagKey}" not found in FlagForge engine`,
        evaluatedAt: now,
      };
    }

    // Apply environment overrides if context specifies an environment
    const flag = this.applyEnvironmentOverrides(rawFlag, context.environment);

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

    // 3. Evaluate Prerequisites (DAG dependencies)
    if (flag.prerequisites && flag.prerequisites.length > 0) {
      const nextStack = new Set(evalStack);
      nextStack.add(flagKey);

      for (const prereq of flag.prerequisites) {
        const prereqResult = this.evaluate(prereq.flagKey, false, context, nextStack);

        if (prereqResult.errorCode === 'CIRCULAR_DEPENDENCY') {
          return {
            ...prereqResult,
            value: fallbackValue,
          };
        }

        let satisfied = true;
        if (prereqResult.reason === 'ERROR' || prereqResult.reason === 'DISABLED') {
          satisfied = false;
        } else if (prereq.expectedVariant !== undefined) {
          satisfied = prereqResult.variant === prereq.expectedVariant;
        } else if (prereq.expectedValue !== undefined) {
          satisfied = prereqResult.value === prereq.expectedValue;
        } else {
          // Default: prerequisite flag must be truthy / enabled
          satisfied = Boolean(prereqResult.value);
        }

        if (!satisfied) {
          return {
            flagKey,
            value: (flag.defaultValue as T) ?? fallbackValue,
            variant: flag.defaultVariant,
            reason: 'PREREQUISITE_FAILED',
            failedPrerequisiteKey: prereq.flagKey,
            evaluatedAt: now,
          };
        }
      }
    }

    // 4. Evaluate Targeting Rules
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

    // 5. Evaluate Percentage / Canary Rollout
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

        const val =
          flag.variants && chosenVariant in flag.variants
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
        const defaultVal =
          flag.variants && flag.defaultVariant && flag.defaultVariant in flag.variants
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

    // 6. Default Fallback
    const defaultVal =
      flag.variants && flag.defaultVariant && flag.defaultVariant in flag.variants
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

  public evaluateAll(context: EvaluationContext = {}): Record<string, EvaluationDetails> {
    const results: Record<string, EvaluationDetails> = {};
    for (const [key, flag] of this.flags.entries()) {
      results[key] = this.evaluate(key, flag.defaultValue, context);
    }
    return results;
  }

  private applyEnvironmentOverrides(flag: FeatureFlag, environment?: string): FeatureFlag {
    if (!environment || !flag.environments || !flag.environments[environment]) {
      return flag;
    }
    const envConfig = flag.environments[environment];
    return {
      ...flag,
      enabled: envConfig.enabled !== undefined ? envConfig.enabled : flag.enabled,
      rollout: envConfig.rollout || flag.rollout,
      canaryStage: envConfig.canaryStage || flag.canaryStage,
    };
  }

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

    const actualType = typeof resolvedValue;
    let typeOk = true;

    if (flag.type === 'boolean' && actualType !== 'boolean') typeOk = false;
    else if (flag.type === 'string' && actualType !== 'string') typeOk = false;
    else if (flag.type === 'number' && actualType !== 'number') typeOk = false;
    else if (flag.type === 'object' && (actualType !== 'object' || resolvedValue === null))
      typeOk = false;

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
