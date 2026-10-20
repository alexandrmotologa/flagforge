import { describe, it, expect, vi } from 'vitest';
import { ErrorSentinel } from '../src/server/sentinel.js';
import { FeatureFlag } from '../src/core/types.js';

describe('ErrorSentinel Circuit Breaker', () => {
  const flag: FeatureFlag = {
    key: 'risky-canary-feature',
    name: 'Risky Canary',
    description: '',
    type: 'boolean',
    enabled: true,
    defaultValue: false,
    variants: { on: true, off: false },
    rules: [],
    rollout: { percentage: 25 },
    canaryStage: 'beta_25',
    circuitBreaker: {
      enabled: true,
      errorThresholdPercent: 10, // 10% error threshold
      minRequests: 10,
      windowSeconds: 60,
      action: 'killswitch',
    },
    lifecycle: 'canary',
    createdAt: '',
    updatedAt: '',
  };

  it('remains HEALTHY when error rate is below threshold', () => {
    const sentinel = new ErrorSentinel();

    for (let i = 0; i < 20; i++) {
      sentinel.recordEvaluation('risky-canary-feature', false); // 20 successes
    }

    const { status, tripped } = sentinel.evaluateFlag(flag);
    expect(tripped).toBe(false);
    expect(status.state).toBe('HEALTHY');
    expect(status.errorRatePercent).toBe(0);
  });

  it('trips circuit breaker when error rate exceeds threshold', () => {
    const onTrip = vi.fn();
    const sentinel = new ErrorSentinel(onTrip);

    // 8 successes + 2 errors = 20% error rate (threshold is 10%)
    for (let i = 0; i < 8; i++) {
      sentinel.recordEvaluation('risky-canary-feature', false);
    }
    sentinel.recordError('risky-canary-feature');
    sentinel.recordError('risky-canary-feature');

    const { status, tripped, action } = sentinel.evaluateFlag(flag);

    expect(tripped).toBe(true);
    expect(status.state).toBe('TRIPPED');
    expect(status.errorRatePercent).toBe(20);
    expect(action).toBe('killswitch');
    expect(onTrip).toHaveBeenCalledTimes(1);
  });
});
