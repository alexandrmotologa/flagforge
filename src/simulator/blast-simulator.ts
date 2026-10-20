import { FeatureFlag } from '../core/types.js';
import { FeatureFlagEngine } from '../core/engine.js';
import { generateSyntheticCohort, CohortOptions, CohortProfile } from './cohort-generator.js';

export interface SegmentMetric {
  segment: string;
  total: number;
  affected: number;
  affectedPercentage: number;
}

export interface DecileBin {
  range: string;
  observed: number;
  expected: number;
}

export interface HistogramBin {
  bin: string;
  rangeStart: number;
  rangeEnd: number;
  count: number;
  percentage: number;
}

export interface SimulationResult {
  flagKey: string;
  totalEvaluated: number;
  affectedCount: number;
  blastRadiusPercentage: number;
  durationMs: number;
  reasons: Record<string, number>;
  variants: Record<string, { count: number; percentage: number }>;
  tierBreakdown: SegmentMetric[];
  countryBreakdown: SegmentMetric[];
  deviceBreakdown: SegmentMetric[];
  chiSquare: {
    statistic: number;
    degreesOfFreedom: number;
    uniformityScore: number; // 0 - 100
    rating: 'EXCELLENT' | 'GOOD' | 'SKEWED';
  };
  histogram: HistogramBin[];
}

export class BlastRadiusSimulator {
  private engine: FeatureFlagEngine;

  constructor(engine: FeatureFlagEngine) {
    this.engine = engine;
  }

  public runSimulation(
    flagKey: string,
    cohortOptions: CohortOptions = {},
    customFlag?: FeatureFlag
  ): SimulationResult {
    const startTime = performance.now();
    const flag = customFlag || this.engine.getFlag(flagKey);

    if (!flag) {
      throw new Error(`Flag "${flagKey}" not found for blast-radius simulation`);
    }

    // Temporary local engine to isolate simulation if customFlag is passed
    const simEngine = customFlag ? new FeatureFlagEngine([customFlag]) : this.engine;
    const cohort = generateSyntheticCohort(cohortOptions);
    const total = cohort.length;

    let affectedCount = 0;
    const reasons: Record<string, number> = {};
    const variantCounts: Record<string, number> = {};

    // Segment counters
    const tierStats: Record<string, { total: number; affected: number }> = {};
    const countryStats: Record<string, { total: number; affected: number }> = {};
    const deviceStats: Record<string, { total: number; affected: number }> = {};

    // 10 decile bins for Chi-square uniformity
    const deciles = new Array(10).fill(0);

    // 20 histogram bins (5% width each)
    const histBins = new Array(20).fill(0);

    for (const user of cohort) {
      // Record segment denominators
      tierStats[user.tier] = tierStats[user.tier] || { total: 0, affected: 0 };
      tierStats[user.tier].total++;

      countryStats[user.country] = countryStats[user.country] || { total: 0, affected: 0 };
      countryStats[user.country].total++;

      deviceStats[user.device] = deviceStats[user.device] || { total: 0, affected: 0 };
      deviceStats[user.device].total++;

      // Evaluate
      const res = simEngine.evaluate(flagKey, flag.defaultValue, user);

      // Record reason
      reasons[res.reason] = (reasons[res.reason] || 0) + 1;

      // Record variant
      const vKey = res.variant || (String(res.value) === 'true' ? 'on' : String(res.value));
      variantCounts[vKey] = (variantCounts[vKey] || 0) + 1;

      // Determine if affected: resolved value differs from defaultValue or is active treatment
      const isAffected =
        res.reason !== 'DISABLED' &&
        (res.value !== flag.defaultValue ||
          (res.reason === 'TARGETING_MATCH' && res.value !== false) ||
          (res.reason === 'SPLIT' && res.variant !== 'off' && res.variant !== 'control'));

      if (isAffected) {
        affectedCount++;
        tierStats[user.tier].affected++;
        countryStats[user.country].affected++;
        deviceStats[user.device].affected++;
      }

      // Record bucket distribution for hash uniformity checks
      if (res.bucket !== undefined) {
        const decileIdx = Math.min(Math.floor(res.bucket / 10), 9);
        deciles[decileIdx]++;

        const histIdx = Math.min(Math.floor(res.bucket / 5), 19);
        histBins[histIdx]++;
      }
    }

    const durationMs = Math.round((performance.now() - startTime) * 100) / 100;
    const blastRadiusPercentage = Math.round((affectedCount / total) * 10000) / 100;

    // Build variant metrics
    const variants: Record<string, { count: number; percentage: number }> = {};
    for (const [k, count] of Object.entries(variantCounts)) {
      variants[k] = {
        count,
        percentage: Math.round((count / total) * 10000) / 100,
      };
    }

    // Convert segment stats to list
    const formatSegments = (dict: Record<string, { total: number; affected: number }>): SegmentMetric[] => {
      return Object.entries(dict).map(([segment, data]) => ({
        segment,
        total: data.total,
        affected: data.affected,
        affectedPercentage: Math.round((data.affected / data.total) * 10000) / 100,
      }));
    };

    // Calculate Chi-Square Goodness of Fit across 10 deciles for bucketed population
    const bucketSampleTotal = deciles.reduce((acc, count) => acc + count, 0);
    const expectedPerDecile = bucketSampleTotal > 0 ? bucketSampleTotal / 10 : 1;
    let chiSquareStat = 0;
    for (let i = 0; i < 10; i++) {
      const o = deciles[i];
      const diff = o - expectedPerDecile;
      chiSquareStat += (diff * diff) / expectedPerDecile;
    }
    chiSquareStat = Math.round(chiSquareStat * 100) / 100;

    // Chi-Square critical value for df=9 at alpha=0.05 is 16.92
    let rating: 'EXCELLENT' | 'GOOD' | 'SKEWED' = 'EXCELLENT';
    let uniformityScore = 98;

    if (chiSquareStat < 10) {
      rating = 'EXCELLENT';
      uniformityScore = Math.max(95, Math.round(100 - chiSquareStat));
    } else if (chiSquareStat < 16.92) {
      rating = 'GOOD';
      uniformityScore = Math.max(85, Math.round(95 - (chiSquareStat - 10) * 1.5));
    } else {
      rating = 'SKEWED';
      uniformityScore = Math.max(60, Math.round(85 - (chiSquareStat - 16.92) * 2));
    }

    // Build histogram data
    const histogram: HistogramBin[] = histBins.map((count, idx) => {
      const start = idx * 5;
      const end = start + 5;
      return {
        bin: `${start}%-${end}%`,
        rangeStart: start,
        rangeEnd: end,
        count,
        percentage: Math.round((count / total) * 10000) / 100,
      };
    });

    return {
      flagKey,
      totalEvaluated: total,
      affectedCount,
      blastRadiusPercentage,
      durationMs,
      reasons,
      variants,
      tierBreakdown: formatSegments(tierStats),
      countryBreakdown: formatSegments(countryStats),
      deviceBreakdown: formatSegments(deviceStats),
      chiSquare: {
        statistic: chiSquareStat,
        degreesOfFreedom: 9,
        uniformityScore,
        rating,
      },
      histogram,
    };
  }
}
