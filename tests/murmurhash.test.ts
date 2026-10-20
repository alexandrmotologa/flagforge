import { describe, it, expect } from 'vitest';
import { murmurhash3_32, calculateBucket, isWithinRollout, selectVariantByWeight } from '../src/core/murmurhash.js';

describe('MurmurHash3 & Bucketing', () => {
  it('computes deterministic hashes', () => {
    const hash1 = murmurhash3_32('test-key:user-123');
    const hash2 = murmurhash3_32('test-key:user-123');
    const hash3 = murmurhash3_32('test-key:user-456');

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(typeof hash1).toBe('number');
  });

  it('calculates bucket within 0 to 99.99', () => {
    for (let i = 0; i < 50; i++) {
      const bucket = calculateBucket('flag-a', `user-${i}`);
      expect(bucket).toBeGreaterThanOrEqual(0);
      expect(bucket).toBeLessThan(100);
    }
  });

  it('respects 0% and 100% rollout bounds', () => {
    expect(isWithinRollout('flag-a', 'user-1', 0).within).toBe(false);
    expect(isWithinRollout('flag-a', 'user-1', 100).within).toBe(true);
  });

  it('distributes users uniformly with low statistical skew on 10,000 samples', () => {
    let withinCount = 0;
    const sampleSize = 10000;
    const targetPercentage = 25; // 25% rollout

    for (let i = 0; i < sampleSize; i++) {
      if (isWithinRollout('checkout-v2', `user-${i}`, targetPercentage).within) {
        withinCount++;
      }
    }

    const observedRate = (withinCount / sampleSize) * 100;
    // Expected ~25% within ±1.5% margin for 10k samples
    expect(observedRate).toBeGreaterThan(23.5);
    expect(observedRate).toBeLessThan(26.5);
  });

  it('distributes across weighted multi-variant splits', () => {
    const splits = [
      { variant: 'control', weight: 50 },
      { variant: 'variant-a', weight: 30 },
      { variant: 'variant-b', weight: 20 },
    ];

    const counts: Record<string, number> = { control: 0, 'variant-a': 0, 'variant-b': 0 };
    const sampleSize = 10000;

    for (let i = 0; i < sampleSize; i++) {
      const res = selectVariantByWeight('ab-test', `user-${i}`, splits);
      counts[res.variant]++;
    }

    // Verify ~50%, ~30%, ~20%
    expect(counts['control'] / sampleSize).toBeGreaterThan(0.48);
    expect(counts['control'] / sampleSize).toBeLessThan(0.52);

    expect(counts['variant-a'] / sampleSize).toBeGreaterThan(0.28);
    expect(counts['variant-a'] / sampleSize).toBeLessThan(0.32);

    expect(counts['variant-b'] / sampleSize).toBeGreaterThan(0.18);
    expect(counts['variant-b'] / sampleSize).toBeLessThan(0.22);
  });
});
