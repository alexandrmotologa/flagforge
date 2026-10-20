import { describe, it, expect } from 'vitest';
import { FeatureFlagEngine } from '../src/core/engine.js';
import { BlastRadiusSimulator } from '../src/simulator/blast-simulator.js';
import { FeatureFlag } from '../src/core/types.js';

describe('BlastRadiusSimulator', () => {
  const flags: FeatureFlag[] = [
    {
      key: 'canary-rollout-test',
      name: 'Canary Rollout Test',
      description: 'Test flag for 20% canary rollout',
      type: 'boolean',
      enabled: true,
      defaultValue: false,
      defaultVariant: 'off',
      variants: { on: true, off: false },
      rules: [
        {
          id: 'enterprise-whitelist',
          conditions: [{ property: 'tier', operator: 'equals', value: 'enterprise' }],
          serve: { variant: 'on' },
        },
      ],
      rollout: {
        percentage: 20,
        stickinessProperty: 'userId',
      },
      lifecycle: 'canary',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  it('runs Monte Carlo simulation and calculates blast-radius percentage and segments', () => {
    const engine = new FeatureFlagEngine(flags);
    const simulator = new BlastRadiusSimulator(engine);

    const result = simulator.runSimulation('canary-rollout-test', { size: 3000 });

    expect(result.totalEvaluated).toBe(3000);
    expect(result.affectedCount).toBeGreaterThan(0);
    // 20% rollout + enterprise whitelist (~8% of users) -> blast radius between 22% and 30%
    expect(result.blastRadiusPercentage).toBeGreaterThan(20);
    expect(result.blastRadiusPercentage).toBeLessThan(32);

    expect(result.tierBreakdown.length).toBeGreaterThan(0);
    const entTier = result.tierBreakdown.find((t) => t.segment === 'enterprise');
    // Enterprise matches targeting rule 100%
    expect(entTier?.affectedPercentage).toBe(100);

    expect(result.chiSquare.degreesOfFreedom).toBe(9);
    expect(result.chiSquare.uniformityScore).toBeGreaterThanOrEqual(80);
    expect(result.histogram.length).toBe(20);
  });
});
