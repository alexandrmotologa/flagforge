import { describe, it, expect } from 'vitest';
import {
  evaluateCondition,
  matchTargetingRules,
  getContextProperty,
  detectShadowedRules,
} from '../src/core/matcher.js';
import { TargetingRule } from '../src/core/types.js';

describe('Rule Matcher & Context Resolution', () => {
  it('extracts nested context properties with aliases', () => {
    const context = {
      userId: 'usr_42',
      user: {
        profile: {
          tier: 'enterprise',
          country: 'MD',
        },
      },
    };

    expect(getContextProperty(context, 'userId')).toBe('usr_42');
    expect(getContextProperty(context, 'targetingKey')).toBe('usr_42');
    expect(getContextProperty(context, 'user.profile.tier')).toBe('enterprise');
    expect(getContextProperty(context, 'user.profile.country')).toBe('MD');
    expect(getContextProperty(context, 'nonexistent.prop')).toBeUndefined();
  });

  it('evaluates equality and numeric operators', () => {
    expect(evaluateCondition({ property: 'tier', operator: 'equals', value: 'pro' }, 'pro')).toBe(true);
    expect(evaluateCondition({ property: 'tier', operator: 'equals', value: 'pro' }, 'free')).toBe(false);

    expect(evaluateCondition({ property: 'age', operator: 'gt', value: 18 }, 21)).toBe(true);
    expect(evaluateCondition({ property: 'age', operator: 'lte', value: 18 }, 18)).toBe(true);
    expect(evaluateCondition({ property: 'age', operator: 'lt', value: 18 }, 18)).toBe(false);
  });

  it('evaluates list, regex, and semver operators', () => {
    expect(evaluateCondition({ property: 'country', operator: 'in', value: ['MD', 'RO', 'DE'] }, 'MD')).toBe(true);
    expect(evaluateCondition({ property: 'country', operator: 'not_in', value: ['US', 'CA'] }, 'MD')).toBe(true);

    expect(evaluateCondition({ property: 'email', operator: 'matches_regex', value: '.*@company\\.com$' }, 'alex@company.com')).toBe(true);
    expect(evaluateCondition({ property: 'email', operator: 'matches_regex', value: '.*@company\\.com$' }, 'alex@gmail.com')).toBe(false);

    expect(evaluateCondition({ property: 'version', operator: 'semver_gte', value: '2.4.0' }, 'v2.5.1')).toBe(true);
    expect(evaluateCondition({ property: 'version', operator: 'semver_lt', value: '2.0.0' }, '1.9.8')).toBe(true);
  });

  it('matches sequential rules and detects shadowed rules', () => {
    const rules: TargetingRule[] = [
      {
        id: 'rule-vip',
        conditions: [
          { property: 'tier', operator: 'equals', value: 'vip' },
          { property: 'country', operator: 'equals', value: 'MD' },
        ],
        serve: { variant: 'vip-treatment' },
      },
      {
        id: 'rule-vip-dup',
        conditions: [
          { property: 'tier', operator: 'equals', value: 'vip' },
          { property: 'country', operator: 'equals', value: 'MD' },
        ],
        serve: { variant: 'alt' },
      },
      {
        id: 'rule-general-pro',
        conditions: [
          { property: 'tier', operator: 'equals', value: 'pro' },
        ],
        serve: { variant: 'pro-variant' },
      },
    ];

    const match1 = matchTargetingRules(rules, { tier: 'vip', country: 'MD' });
    expect(match1?.matchedRule.id).toBe('rule-vip');

    const match2 = matchTargetingRules(rules, { tier: 'pro', country: 'US' });
    expect(match2?.matchedRule.id).toBe('rule-general-pro');

    const matchNone = matchTargetingRules(rules, { tier: 'free', country: 'MD' });
    expect(matchNone).toBeNull();

    const shadowed = detectShadowedRules(rules);
    expect(shadowed.length).toBe(1);
    expect(shadowed[0].shadowedRuleId).toBe('rule-vip-dup');
    expect(shadowed[0].shadowedByRuleId).toBe('rule-vip');
  });
});
