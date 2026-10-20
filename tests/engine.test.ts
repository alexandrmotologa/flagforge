import { describe, it, expect } from 'vitest';
import { FeatureFlagEngine } from '../src/core/engine.js';
import { FeatureFlag } from '../src/core/types.js';

describe('FeatureFlagEngine', () => {
  const flags: FeatureFlag[] = [
    {
      key: 'new-billing-engine',
      name: 'New Billing Engine',
      description: 'Staged migration to v2 payment pipeline',
      type: 'boolean',
      enabled: true,
      defaultValue: false,
      defaultVariant: 'off',
      variants: { on: true, off: false },
      rules: [
        {
          id: 'enterprise-early-access',
          conditions: [{ property: 'tier', operator: 'equals', value: 'enterprise' }],
          serve: { variant: 'on' },
        },
      ],
      rollout: {
        percentage: 30,
        stickinessProperty: 'userId',
      },
      lifecycle: 'canary',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      key: 'banner-color',
      name: 'Banner Color',
      description: 'A/B test banner theme',
      type: 'string',
      enabled: true,
      defaultValue: 'slate',
      variants: {
        slate: 'slate',
        emerald: 'emerald',
        indigo: 'indigo',
      },
      rules: [],
      rollout: {
        percentage: 100,
        variants: [
          { variant: 'slate', weight: 50 },
          { variant: 'emerald', weight: 25 },
          { variant: 'indigo', weight: 25 },
        ],
      },
      lifecycle: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      key: 'deprecated-legacy-nav',
      name: 'Deprecated Legacy Navigation',
      description: 'Old navbar flag',
      type: 'boolean',
      enabled: false, // Killswitch engaged
      defaultValue: false,
      variants: { on: true, off: false },
      rules: [],
      lifecycle: 'dead',
      staleSince: '2026-01-15T00:00:00Z',
      createdAt: '2025-10-01T00:00:00Z',
      updatedAt: '2026-01-15T00:00:00Z',
    },
  ];

  it('evaluates rule matches before rollout splits', () => {
    const engine = new FeatureFlagEngine(flags);

    // Enterprise user matches targeting rule
    const res = engine.evaluate('new-billing-engine', false, {
      userId: 'usr_random_99',
      tier: 'enterprise',
    });

    expect(res.value).toBe(true);
    expect(res.reason).toBe('TARGETING_MATCH');
    expect(res.matchedRuleId).toBe('enterprise-early-access');
  });

  it('evaluates rollout percentages for non-rule matches', () => {
    const engine = new FeatureFlagEngine(flags);

    // Non-enterprise user falls through to rollout
    const res = engine.evaluate('new-billing-engine', false, {
      userId: 'user-deterministic-1',
      tier: 'free',
    });

    expect(res.reason).toBe('SPLIT');
    expect(typeof res.value).toBe('boolean');
    expect(typeof res.bucket).toBe('number');
  });

  it('respects disabled killswitches', () => {
    const engine = new FeatureFlagEngine(flags);

    const res = engine.evaluate('deprecated-legacy-nav', true, {
      userId: 'admin_user',
    });

    expect(res.value).toBe(false);
    expect(res.reason).toBe('DISABLED');
  });

  it('returns fallback and ERROR reason when flag is not found', () => {
    const engine = new FeatureFlagEngine(flags);

    const res = engine.evaluate('missing-flag', 'fallback_val');
    expect(res.value).toBe('fallback_val');
    expect(res.reason).toBe('ERROR');
    expect(res.errorCode).toBe('FLAG_NOT_FOUND');
  });

  it('exports and reloads engine configuration', () => {
    const engine1 = new FeatureFlagEngine(flags);
    const exported = engine1.exportConfiguration();

    const engine2 = new FeatureFlagEngine();
    engine2.loadConfiguration(exported);

    expect(engine2.getAllFlags().length).toBe(3);
    expect(engine2.getFlag('banner-color')?.name).toBe('Banner Color');
  });
});
