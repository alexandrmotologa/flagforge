import { describe, it, expect } from 'vitest';
import { FeatureFlagEngine } from '../src/core/engine.js';
import { FeatureFlag } from '../src/core/types.js';

describe('Flag Prerequisites & Dependency Graph', () => {
  const flags: FeatureFlag[] = [
    {
      key: 'payment-v2',
      name: 'Payment Service v2',
      description: 'Backend gateway',
      type: 'boolean',
      enabled: true,
      defaultValue: false,
      defaultVariant: 'off',
      variants: { on: true, off: false },
      rules: [],
      lifecycle: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      key: 'one-click-checkout',
      name: 'One Click Checkout',
      description: 'Dependent UI flag',
      type: 'boolean',
      enabled: true,
      defaultValue: false,
      defaultVariant: 'off',
      variants: { on: true, off: false },
      rules: [],
      rollout: { percentage: 100 },
      prerequisites: [
        {
          flagKey: 'payment-v2',
          expectedVariant: 'on',
        },
      ],
      lifecycle: 'canary',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  it('fails evaluation with PREREQUISITE_FAILED when prerequisite is disabled', () => {
    const engine = new FeatureFlagEngine(flags);

    // Disable prerequisite
    const p2 = engine.getFlag('payment-v2')!;
    p2.enabled = false;
    engine.setFlag(p2);

    const res = engine.evaluate('one-click-checkout', false);
    expect(res.value).toBe(false);
    expect(res.reason).toBe('PREREQUISITE_FAILED');
    expect(res.failedPrerequisiteKey).toBe('payment-v2');
  });

  it('succeeds evaluation when prerequisite is enabled with expected variant', () => {
    const engine = new FeatureFlagEngine(flags);

    // Set prerequisite to variant 'on'
    const p2 = engine.getFlag('payment-v2')!;
    p2.enabled = true;
    p2.defaultVariant = 'on';
    p2.defaultValue = true;
    engine.setFlag(p2);

    const res = engine.evaluate('one-click-checkout', false);
    expect(res.value).toBe(true);
    expect(res.reason).toBe('SPLIT');
  });

  it('constructs dependency graph and detects cycles', () => {
    const cyclicFlags: FeatureFlag[] = [
      {
        key: 'flag-a',
        name: 'Flag A',
        description: '',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
        variants: { on: true, off: false },
        rules: [],
        prerequisites: [{ flagKey: 'flag-b' }],
        lifecycle: 'active',
        createdAt: '',
        updatedAt: '',
      },
      {
        key: 'flag-b',
        name: 'Flag B',
        description: '',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
        variants: { on: true, off: false },
        rules: [],
        prerequisites: [{ flagKey: 'flag-a' }],
        lifecycle: 'active',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const engine = new FeatureFlagEngine(cyclicFlags);
    const graph = engine.getDependencyGraph();

    expect(graph.hasCycles).toBe(true);
    expect(graph.nodes.length).toBe(2);

    // Engine protects against infinite evaluation loop
    const evalRes = engine.evaluate('flag-a', false);
    expect(evalRes.reason).toBe('ERROR');
    expect(evalRes.errorCode).toBe('CIRCULAR_DEPENDENCY');
  });
});
