import { describe, it, expect } from 'vitest';
import { FeatureFlagEngine } from '../src/core/engine.js';
import { FeatureFlag } from '../src/core/types.js';

describe('Multi-Environment Evaluation', () => {
  const flag: FeatureFlag = {
    key: 'dark-mode-v2',
    name: 'Dark Mode v2',
    description: '',
    type: 'boolean',
    enabled: true, // Enabled in default/local
    defaultValue: false,
    variants: { on: true, off: false },
    rules: [],
    rollout: { percentage: 100 },
    environments: {
      production: {
        enabled: false, // Disabled in production
        rollout: { percentage: 0 },
      },
      staging: {
        enabled: true,
        rollout: { percentage: 50 },
      },
    },
    lifecycle: 'active',
    createdAt: '',
    updatedAt: '',
  };

  it('evaluates local environment by default', () => {
    const engine = new FeatureFlagEngine([flag]);
    const res = engine.evaluate('dark-mode-v2', false, { userId: 'u1' });
    expect(res.value).toBe(true);
  });

  it('applies production environment override when specified in context', () => {
    const engine = new FeatureFlagEngine([flag]);
    const res = engine.evaluate('dark-mode-v2', false, { userId: 'u1', environment: 'production' });
    expect(res.value).toBe(false);
    expect(res.reason).toBe('DISABLED');
  });

  it('applies staging environment rollout percentage', () => {
    const engine = new FeatureFlagEngine([flag]);
    const res = engine.evaluate('dark-mode-v2', false, { userId: 'u1', environment: 'staging' });
    expect(res.reason).toBe('SPLIT');
  });
});
