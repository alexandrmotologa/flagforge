/**
 * MurmurHash3 (32-bit) implementation for uniform deterministic bucketing.
 * Conforms to standard MurmurHash3_x86_32 specification.
 */

export function murmurhash3_32(key: string, seed = 0): number {
  let remainder: number;
  let bytes: number;
  let h1: number;
  let h1b: number;
  let c1: number;
  let c2: number;
  let k1: number;
  let i = 0;

  remainder = key.length & 3; // key.length % 4
  bytes = key.length - remainder;
  h1 = seed;
  c1 = 0xcc9e2d51;
  c2 = 0x1b873593;

  while (i < bytes) {
    k1 =
      (key.charCodeAt(i) & 0xff) |
      ((key.charCodeAt(++i) & 0xff) << 8) |
      ((key.charCodeAt(++i) & 0xff) << 16) |
      ((key.charCodeAt(++i) & 0xff) << 24);
    ++i;

    k1 = ((k1 & 0xffff) * c1 + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
    k1 = (k1 << 15) | (k1 >>> 17);
    k1 = ((k1 & 0xffff) * c2 + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;

    h1 ^= k1;
    h1 = (h1 << 13) | (h1 >>> 19);
    h1b = ((h1 & 0xffff) * 5 + ((((h1 >>> 16) * 5) & 0xffff) << 16)) & 0xffffffff;
    h1 = (h1b & 0xffff) + 0x6b64 + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16);
  }

  k1 = 0;

  switch (remainder) {
    case 3:
      k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
    // fallthrough
    case 2:
      k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
    // fallthrough
    case 1:
      k1 ^= key.charCodeAt(i) & 0xff;
      k1 = ((k1 & 0xffff) * c1 + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
      k1 = (k1 << 15) | (k1 >>> 17);
      k1 = ((k1 & 0xffff) * c2 + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
      h1 ^= k1;
  }

  h1 ^= key.length;

  h1 ^= h1 >>> 16;
  h1 = ((h1 & 0xffff) * 0x85ebca6b + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 13;
  h1 = ((h1 & 0xffff) * 0xc2b2ae35 + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16)) & 0xffffffff;
  h1 ^= h1 >>> 16;

  return h1 >>> 0;
}

/**
 * Computes a bucket float between 0.0 and 99.99 for a given flag and targeting identifier.
 * Precision: 2 decimal places (10,000 discrete bins).
 */
export function calculateBucket(
  flagKey: string,
  identifier: string,
  salt = ''
): number {
  const compositeKey = `${flagKey}:${identifier}:${salt}`;
  const hash = murmurhash3_32(compositeKey);
  // (hash % 10000) / 100 yields a range [0, 99.99]
  return (hash % 10000) / 100;
}

/**
 * Checks if an identifier falls within a percentage rollout (0 - 100).
 */
export function isWithinRollout(
  flagKey: string,
  identifier: string,
  percentage: number,
  salt = ''
): { within: boolean; bucket: number } {
  if (percentage <= 0) {
    return { within: false, bucket: 0 };
  }
  if (percentage >= 100) {
    return { within: true, bucket: 0 };
  }
  const bucket = calculateBucket(flagKey, identifier, salt);
  return {
    within: bucket < percentage,
    bucket,
  };
}

/**
 * Distributes an identifier across multi-variant splits.
 * splits: array of { variant: string, weight: number }
 */
export function selectVariantByWeight(
  flagKey: string,
  identifier: string,
  splits: Array<{ variant: string; weight: number }>,
  salt = ''
): { variant: string; bucket: number } {
  if (!splits || splits.length === 0) {
    throw new Error('Splits must not be empty');
  }

  const totalWeight = splits.reduce((acc, s) => acc + s.weight, 0);
  if (totalWeight <= 0) {
    return { variant: splits[0].variant, bucket: 0 };
  }

  const bucket = calculateBucket(flagKey, identifier, salt);
  // Scale bucket [0, 100) to totalWeight
  const scaledBucket = (bucket / 100) * totalWeight;

  let cumulative = 0;
  for (const split of splits) {
    cumulative += split.weight;
    if (scaledBucket < cumulative) {
      return { variant: split.variant, bucket };
    }
  }

  return { variant: splits[splits.length - 1].variant, bucket };
}
