import {
  Provider,
  ResolutionDetails,
  EvaluationContext as OFEvaluationContext,
  JsonValue,
  StandardResolutionReasons,
  ErrorCode as OFErrorCode,
  FlagMetadata,
} from '@openfeature/server-sdk';
import { FeatureFlagEngine } from '../core/engine.js';
import { EvaluationDetails } from '../core/types.js';

export interface FlagForgeProviderOptions {
  /**
   * If provided, evaluations run directly against this in-process engine.
   */
  engine?: FeatureFlagEngine;
  /**
   * If provided, evaluations query the local or remote FlagForge daemon via OFREP / REST.
   */
  daemonUrl?: string;
  /**
   * Request timeout in milliseconds when querying daemon. Defaults to 2000ms.
   */
  timeoutMs?: number;
}

export class FlagForgeProvider implements Provider {
  public readonly metadata = {
    name: 'flagforge-openfeature-provider',
  };

  public readonly runsOn = 'server' as const;

  private engine?: FeatureFlagEngine;
  private daemonUrl?: string;
  private timeoutMs: number;

  constructor(options: FlagForgeProviderOptions = {}) {
    this.engine = options.engine;
    this.daemonUrl = options.daemonUrl?.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs || 2000;
  }

  public async initialize(): Promise<void> {
    if (this.daemonUrl && !this.engine) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        const res = await fetch(`${this.daemonUrl}/api/v1/health`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!res.ok) {
          throw new Error(`FlagForge daemon health check failed with status ${res.status}`);
        }
      } catch (err) {
        throw new Error(
          `Unable to connect to FlagForge daemon at ${this.daemonUrl}: ${(err as Error).message}`
        );
      }
    }
  }

  public async onClose(): Promise<void> {
    // Graceful cleanup
  }

  public async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean,
    context: OFEvaluationContext
  ): Promise<ResolutionDetails<boolean>> {
    return this.resolveEvaluation<boolean>(flagKey, defaultValue, context);
  }

  public async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string,
    context: OFEvaluationContext
  ): Promise<ResolutionDetails<string>> {
    return this.resolveEvaluation<string>(flagKey, defaultValue, context);
  }

  public async resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number,
    context: OFEvaluationContext
  ): Promise<ResolutionDetails<number>> {
    return this.resolveEvaluation<number>(flagKey, defaultValue, context);
  }

  public async resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: OFEvaluationContext
  ): Promise<ResolutionDetails<T>> {
    return this.resolveEvaluation<T>(flagKey, defaultValue, context);
  }

  private async resolveEvaluation<T>(
    flagKey: string,
    defaultValue: T,
    context: OFEvaluationContext
  ): Promise<ResolutionDetails<T>> {
    // 1. Direct In-Memory Engine Evaluation
    if (this.engine) {
      const details = this.engine.evaluate<T>(flagKey, defaultValue, context as any);
      return this.toResolutionDetails(details, defaultValue);
    }

    // 2. Remote / Local Daemon Evaluation via OFREP
    if (this.daemonUrl) {
      return this.evaluateViaOFREP<T>(flagKey, defaultValue, context);
    }

    // 3. Fallback if unconfigured
    return {
      value: defaultValue,
      reason: StandardResolutionReasons.ERROR,
      errorCode: OFErrorCode.PROVIDER_NOT_READY,
      errorMessage: 'FlagForge provider has neither an engine instance nor a daemon URL configured',
    };
  }

  private async evaluateViaOFREP<T>(
    flagKey: string,
    defaultValue: T,
    context: OFEvaluationContext
  ): Promise<ResolutionDetails<T>> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(`${this.daemonUrl}/ofrep/v1/evaluate/flags/${encodeURIComponent(flagKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!res.ok) {
        if (res.status === 404) {
          return {
            value: defaultValue,
            reason: StandardResolutionReasons.ERROR,
            errorCode: OFErrorCode.FLAG_NOT_FOUND,
            errorMessage: `Flag "${flagKey}" not found on FlagForge daemon`,
          };
        }
        return {
          value: defaultValue,
          reason: StandardResolutionReasons.ERROR,
          errorCode: OFErrorCode.GENERAL,
          errorMessage: `Daemon returned HTTP ${res.status}`,
        };
      }

      const body = (await res.json()) as {
        key: string;
        value: T;
        variant?: string;
        reason?: string;
        metadata?: Record<string, string | number | boolean>;
      };

      return {
        value: body.value !== undefined ? body.value : defaultValue,
        variant: body.variant,
        reason: (body.reason as any) || StandardResolutionReasons.STATIC,
        flagMetadata: body.metadata as FlagMetadata,
      };
    } catch (err) {
      return {
        value: defaultValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: OFErrorCode.GENERAL,
        errorMessage: (err as Error).message,
      };
    }
  }

  private toResolutionDetails<T>(
    details: EvaluationDetails<T>,
    defaultValue: T
  ): ResolutionDetails<T> {
    const metadata: FlagMetadata = {};
    if (details.flagMetadata) {
      for (const [k, v] of Object.entries(details.flagMetadata)) {
        if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
          metadata[k] = v;
        }
      }
    }

    if (details.reason === 'ERROR') {
      let openFeatureErrorCode = OFErrorCode.GENERAL;
      if (details.errorCode === 'FLAG_NOT_FOUND') {
        openFeatureErrorCode = OFErrorCode.FLAG_NOT_FOUND;
      } else if (details.errorCode === 'TYPE_MISMATCH') {
        openFeatureErrorCode = OFErrorCode.TYPE_MISMATCH;
      }

      return {
        value: defaultValue,
        variant: details.variant,
        reason: StandardResolutionReasons.ERROR,
        errorCode: openFeatureErrorCode,
        errorMessage: details.errorMessage,
        flagMetadata: metadata,
      };
    }

    return {
      value: details.value,
      variant: details.variant,
      reason: details.reason as any,
      flagMetadata: metadata,
    };
  }
}
