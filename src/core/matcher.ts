import { RuleCondition, TargetingRule, EvaluationContext, RuleOperator } from './types.js';

/**
 * Resolves a dot-notated property path from an evaluation context.
 * e.g., 'user.profile.tier' -> context.user?.profile?.tier
 */
export function getContextProperty(context: EvaluationContext, path: string): unknown {
  if (!context || !path) return undefined;

  // Direct property check
  if (path in context) {
    return context[path];
  }

  // Common aliases
  if (path === 'userId' || path === 'targetingKey') {
    return context.targetingKey ?? context.userId ?? context.id;
  }

  // Nested dot notation
  const parts = path.split('.');
  let current: unknown = context;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Simplified SemVer parser: parses 'vX.Y.Z' or 'X.Y.Z-prerelease'
 */
function parseSemVer(v: unknown): [number, number, number] | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const str = String(v).trim().replace(/^v/, '');
  const match = str.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return [
    parseInt(match[1] || '0', 10),
    parseInt(match[2] || '0', 10),
    parseInt(match[3] || '0', 10),
  ];
}

function compareSemVer(a: unknown, b: unknown): number | null {
  const parsedA = parseSemVer(a);
  const parsedB = parseSemVer(b);
  if (!parsedA || !parsedB) return null;

  for (let i = 0; i < 3; i++) {
    if (parsedA[i] > parsedB[i]) return 1;
    if (parsedA[i] < parsedB[i]) return -1;
  }
  return 0;
}

/**
 * Evaluates a single rule condition against a given context value.
 */
export function evaluateCondition(
  condition: RuleCondition,
  contextValue: unknown
): boolean {
  const { operator, value: expected } = condition;

  if (contextValue === undefined || contextValue === null) {
    if (operator === 'not_equals') return expected !== null && expected !== undefined;
    if (operator === 'not_in') return true;
    return false;
  }

  switch (operator) {
    case 'equals':
      return String(contextValue).toLowerCase() === String(expected).toLowerCase();

    case 'not_equals':
      return String(contextValue).toLowerCase() !== String(expected).toLowerCase();

    case 'gt':
      return Number(contextValue) > Number(expected);

    case 'gte':
      return Number(contextValue) >= Number(expected);

    case 'lt':
      return Number(contextValue) < Number(expected);

    case 'lte':
      return Number(contextValue) <= Number(expected);

    case 'in': {
      if (Array.isArray(expected)) {
        return expected.some((item) => String(item).toLowerCase() === String(contextValue).toLowerCase());
      }
      if (typeof expected === 'string') {
        const set = expected.split(',').map((s) => s.trim().toLowerCase());
        return set.includes(String(contextValue).toLowerCase());
      }
      return false;
    }

    case 'not_in': {
      if (Array.isArray(expected)) {
        return !expected.some((item) => String(item).toLowerCase() === String(contextValue).toLowerCase());
      }
      if (typeof expected === 'string') {
        const set = expected.split(',').map((s) => s.trim().toLowerCase());
        return !set.includes(String(contextValue).toLowerCase());
      }
      return true;
    }

    case 'starts_with':
      return String(contextValue).startsWith(String(expected));

    case 'ends_with':
      return String(contextValue).endsWith(String(expected));

    case 'contains': {
      if (Array.isArray(contextValue)) {
        return contextValue.some((item) => String(item).toLowerCase() === String(expected).toLowerCase());
      }
      return String(contextValue).toLowerCase().includes(String(expected).toLowerCase());
    }

    case 'matches_regex': {
      try {
        const regex = new RegExp(String(expected), 'i');
        return regex.test(String(contextValue));
      } catch {
        return false;
      }
    }

    case 'semver_gt': {
      const cmp = compareSemVer(contextValue, expected);
      return cmp !== null && cmp > 0;
    }

    case 'semver_gte': {
      const cmp = compareSemVer(contextValue, expected);
      return cmp !== null && cmp >= 0;
    }

    case 'semver_lt': {
      const cmp = compareSemVer(contextValue, expected);
      return cmp !== null && cmp < 0;
    }

    case 'semver_lte': {
      const cmp = compareSemVer(contextValue, expected);
      return cmp !== null && cmp <= 0;
    }

    case 'date_after': {
      const actualTime = new Date(String(contextValue)).getTime();
      const targetTime = new Date(String(expected)).getTime();
      return !isNaN(actualTime) && !isNaN(targetTime) && actualTime > targetTime;
    }

    case 'date_before': {
      const actualTime = new Date(String(contextValue)).getTime();
      const targetTime = new Date(String(expected)).getTime();
      return !isNaN(actualTime) && !isNaN(targetTime) && actualTime < targetTime;
    }

    default:
      return false;
  }
}

/**
 * Evaluates all targeting rules sequentially.
 * Returns the first matched rule or null if none matched.
 */
export function matchTargetingRules(
  rules: TargetingRule[],
  context: EvaluationContext
): { matchedRule: TargetingRule; ruleIndex: number } | null {
  if (!rules || rules.length === 0) return null;

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    if (!rule.conditions || rule.conditions.length === 0) continue;

    // All conditions in a rule must be satisfied (AND logic)
    const matchesAll = rule.conditions.every((condition) => {
      const propValue = getContextProperty(context, condition.property);
      return evaluateCondition(condition, propValue);
    });

    if (matchesAll) {
      return { matchedRule: rule, ruleIndex: i };
    }
  }

  return null;
}

/**
 * Analyzes rule sets for dead / shadowed rules.
 * e.g., if Rule A has conditions identical to Rule B, Rule B will never execute.
 */
export function detectShadowedRules(rules: TargetingRule[]): Array<{
  shadowedRuleId: string;
  shadowedByRuleId: string;
  reason: string;
}> {
  const shadowed: Array<{ shadowedRuleId: string; shadowedByRuleId: string; reason: string }> = [];

  for (let i = 0; i < rules.length; i++) {
    const prev = rules[i];
    for (let j = i + 1; j < rules.length; j++) {
      const curr = rules[j];
      // Check if curr conditions are identical to prev conditions
      if (
        prev.conditions.length === curr.conditions.length &&
        prev.conditions.every((pCond) =>
          curr.conditions.some(
            (cCond) =>
              cCond.property === pCond.property &&
              cCond.operator === pCond.operator &&
              JSON.stringify(cCond.value) === JSON.stringify(pCond.value)
          )
        )
      ) {
        shadowed.push({
          shadowedRuleId: curr.id,
          shadowedByRuleId: prev.id,
          reason: `Exact condition match with preceding rule "${prev.id}"`,
        });
      }
    }
  }

  return shadowed;
}
