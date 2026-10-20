import { EvaluationContext } from '../core/types.js';

export interface CohortProfile extends EvaluationContext {
  userId: string;
  targetingKey: string;
  email: string;
  country: string;
  tier: 'free' | 'pro' | 'enterprise' | 'vip';
  appVersion: string;
  device: 'ios' | 'android' | 'macos' | 'windows';
  accountAgeDays: number;
  betaTester: boolean;
}

export interface CohortOptions {
  size?: number; // default 5000
  seed?: number;
  countryDistribution?: Record<string, number>;
  tierDistribution?: Record<string, number>;
}

// Pseudo-random number generator with seed for reproducible cohort simulations
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateSyntheticCohort(options: CohortOptions = {}): CohortProfile[] {
  const size = Math.min(Math.max(options.size || 5000, 100), 50000);
  const rand = mulberry32(options.seed || 1337);

  const countries = [
    { code: 'US', weight: 0.35 },
    { code: 'DE', weight: 0.15 },
    { code: 'UK', weight: 0.12 },
    { code: 'FR', weight: 0.08 },
    { code: 'MD', weight: 0.06 },
    { code: 'RO', weight: 0.06 },
    { code: 'JP', weight: 0.10 },
    { code: 'BR', weight: 0.08 },
  ];

  const tiers: Array<{ name: CohortProfile['tier']; weight: number }> = [
    { name: 'free', weight: 0.65 },
    { name: 'pro', weight: 0.25 },
    { name: 'enterprise', weight: 0.08 },
    { name: 'vip', weight: 0.02 },
  ];

  const versions = [
    { ver: '1.0.0', weight: 0.05 },
    { ver: '1.4.2', weight: 0.15 },
    { ver: '2.0.0', weight: 0.40 },
    { ver: '2.1.0', weight: 0.40 },
  ];

  const devices: Array<{ os: CohortProfile['device']; weight: number }> = [
    { os: 'ios', weight: 0.40 },
    { os: 'android', weight: 0.35 },
    { os: 'macos', weight: 0.15 },
    { os: 'windows', weight: 0.10 },
  ];

  function pickWeighted<T>(items: Array<{ weight: number } & T>): T {
    const r = rand();
    let acc = 0;
    for (const item of items) {
      acc += item.weight;
      if (r <= acc) return item;
    }
    return items[items.length - 1];
  }

  const cohort: CohortProfile[] = [];

  for (let i = 1; i <= size; i++) {
    const id = `usr_${String(i).padStart(6, '0')}`;
    const country = pickWeighted(countries).code;
    const tier = pickWeighted(tiers).name;
    const appVersion = pickWeighted(versions).ver;
    const device = pickWeighted(devices).os;
    const accountAgeDays = Math.floor(rand() * 1200) + 1;
    const betaTester = rand() < 0.15; // 15% opt-in to beta

    // Assign realistic email
    let domain = 'gmail.com';
    const emailRand = rand();
    if (tier === 'enterprise' || tier === 'vip') {
      domain = emailRand < 0.3 ? 'flagforge.dev' : emailRand < 0.6 ? 'company.com' : 'enterprise-corp.io';
    } else {
      domain = emailRand < 0.5 ? 'gmail.com' : emailRand < 0.8 ? 'outlook.com' : 'icloud.com';
    }

    cohort.push({
      userId: id,
      targetingKey: id,
      email: `${id}@${domain}`,
      country,
      tier,
      appVersion,
      device,
      accountAgeDays,
      betaTester,
    });
  }

  return cohort;
}
