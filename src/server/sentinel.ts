import { CircuitBreakerConfig, FeatureFlag } from '../core/types.js';

interface RequestEvent {
  timestamp: number;
  isError: boolean;
}

export interface BreakerStatus {
  flagKey: string;
  totalRequests: number;
  errorCount: number;
  errorRatePercent: number;
  thresholdPercent: number;
  state: 'HEALTHY' | 'WARNING' | 'TRIPPED';
  lastTrippedAt?: string;
}

export class ErrorSentinel {
  private events: Map<string, RequestEvent[]> = new Map();
  private lastTripped: Map<string, string> = new Map();
  private onTriggerCallback?: (event: {
    flagKey: string;
    action: string;
    errorRate: number;
    totalRequests: number;
  }) => void;

  constructor(
    onTrigger?: (event: {
      flagKey: string;
      action: string;
      errorRate: number;
      totalRequests: number;
    }) => void
  ) {
    this.onTriggerCallback = onTrigger;
  }

  public recordEvaluation(flagKey: string, isError = false): void {
    const list = this.events.get(flagKey) || [];
    list.push({ timestamp: Date.now(), isError });
    this.events.set(flagKey, list);
  }

  public recordError(flagKey: string): void {
    this.recordEvaluation(flagKey, true);
  }

  /**
   * Evaluates the circuit breaker status for a given flag and triggers action if tripped.
   */
  public evaluateFlag(flag: FeatureFlag): {
    status: BreakerStatus;
    tripped: boolean;
    action?: string;
  } {
    const config = flag.circuitBreaker;
    const defaultStatus: BreakerStatus = {
      flagKey: flag.key,
      totalRequests: 0,
      errorCount: 0,
      errorRatePercent: 0,
      thresholdPercent: config?.errorThresholdPercent || 5,
      state: 'HEALTHY',
      lastTrippedAt: this.lastTripped.get(flag.key),
    };

    if (!config || !config.enabled) {
      return { status: defaultStatus, tripped: false };
    }

    const windowMs = (config.windowSeconds || 60) * 1000;
    const now = Date.now();
    const cutoff = now - windowMs;

    // Prune expired events
    const allEvents = this.events.get(flag.key) || [];
    const recent = allEvents.filter((e) => e.timestamp >= cutoff);
    this.events.set(flag.key, recent);

    const total = recent.length;
    const errors = recent.filter((e) => e.isError).length;
    const rate = total > 0 ? (errors / total) * 100 : 0;
    const roundedRate = Math.round(rate * 100) / 100;

    let state: BreakerStatus['state'] = 'HEALTHY';
    if (total >= (config.minRequests || 5)) {
      if (roundedRate >= config.errorThresholdPercent) {
        state = 'TRIPPED';
      } else if (roundedRate >= config.errorThresholdPercent * 0.7) {
        state = 'WARNING';
      }
    }

    const status: BreakerStatus = {
      flagKey: flag.key,
      totalRequests: total,
      errorCount: errors,
      errorRatePercent: roundedRate,
      thresholdPercent: config.errorThresholdPercent,
      state,
      lastTrippedAt: this.lastTripped.get(flag.key),
    };

    if (state === 'TRIPPED') {
      const trippedIso = new Date().toISOString();
      this.lastTripped.set(flag.key, trippedIso);

      if (this.onTriggerCallback) {
        this.onTriggerCallback({
          flagKey: flag.key,
          action: config.action,
          errorRate: roundedRate,
          totalRequests: total,
        });
      }

      return { status, tripped: true, action: config.action };
    }

    return { status, tripped: false };
  }

  public getStatus(flagKey: string): BreakerStatus {
    const allEvents = this.events.get(flagKey) || [];
    const cutoff = Date.now() - 60000;
    const recent = allEvents.filter((e) => e.timestamp >= cutoff);
    const total = recent.length;
    const errors = recent.filter((e) => e.isError).length;
    const rate = total > 0 ? Math.round((errors / total) * 10000) / 100 : 0;

    return {
      flagKey,
      totalRequests: total,
      errorCount: errors,
      errorRatePercent: rate,
      thresholdPercent: 5,
      state: rate > 5 ? 'TRIPPED' : rate > 3 ? 'WARNING' : 'HEALTHY',
      lastTrippedAt: this.lastTripped.get(flagKey),
    };
  }

  public reset(flagKey: string): void {
    this.events.delete(flagKey);
    this.lastTripped.delete(flagKey);
  }
}
