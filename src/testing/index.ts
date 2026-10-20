import {
  Provider,
  ResolutionDetails,
  EvaluationContext,
  JsonValue,
  StandardResolutionReasons,
  OpenFeature,
  Client,
} from '@openfeature/server-sdk';

export class MockFlagForgeProvider implements Provider {
  public readonly metadata = {
    name: 'flagforge-mock-provider',
  };
  public readonly runsOn = 'server' as const;

  private mockFlags: Record<string, unknown>;

  constructor(flags: Record<string, unknown> = {}) {
    this.mockFlags = flags;
  }

  public setFlags(flags: Record<string, unknown>): void {
    this.mockFlags = { ...this.mockFlags, ...flags };
  }

  public setFlag(key: string, value: unknown): void {
    this.mockFlags[key] = value;
  }

  public async resolveBooleanEvaluation(
    flagKey: string,
    defaultValue: boolean
  ): Promise<ResolutionDetails<boolean>> {
    const val = this.mockFlags[flagKey];
    return {
      value: typeof val === 'boolean' ? val : defaultValue,
      reason: val !== undefined ? StandardResolutionReasons.STATIC : StandardResolutionReasons.DEFAULT,
    };
  }

  public async resolveStringEvaluation(
    flagKey: string,
    defaultValue: string
  ): Promise<ResolutionDetails<string>> {
    const val = this.mockFlags[flagKey];
    return {
      value: typeof val === 'string' ? val : defaultValue,
      reason: val !== undefined ? StandardResolutionReasons.STATIC : StandardResolutionReasons.DEFAULT,
    };
  }

  public async resolveNumberEvaluation(
    flagKey: string,
    defaultValue: number
  ): Promise<ResolutionDetails<number>> {
    const val = this.mockFlags[flagKey];
    return {
      value: typeof val === 'number' ? val : defaultValue,
      reason: val !== undefined ? StandardResolutionReasons.STATIC : StandardResolutionReasons.DEFAULT,
    };
  }

  public async resolveObjectEvaluation<T extends JsonValue>(
    flagKey: string,
    defaultValue: T
  ): Promise<ResolutionDetails<T>> {
    const val = this.mockFlags[flagKey];
    return {
      value: (val as T) !== undefined ? (val as T) : defaultValue,
      reason: val !== undefined ? StandardResolutionReasons.STATIC : StandardResolutionReasons.DEFAULT,
    };
  }
}

/**
 * Creates an OpenFeature mock provider with pre-configured flag values for unit/integration tests.
 */
export function mockFlagForge(flags: Record<string, unknown> = {}): MockFlagForgeProvider {
  return new MockFlagForgeProvider(flags);
}

/**
 * Initializes a test client ready for evaluation assertions.
 */
export async function createTestClient(flags: Record<string, unknown> = {}): Promise<Client> {
  const provider = mockFlagForge(flags);
  await OpenFeature.setProviderAndWait(provider);
  return OpenFeature.getClient();
}
