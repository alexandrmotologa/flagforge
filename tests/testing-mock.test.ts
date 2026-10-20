import { describe, it, expect } from 'vitest';
import { mockFlagForge, createTestClient } from '../src/testing/index.js';
import { OpenFeature } from '@openfeature/server-sdk';

describe('SDK Testing & Mocking Fixture', () => {
  it('allows mocking flag values with zero boilerplates in tests', async () => {
    const client = await createTestClient({
      'feature-enabled': true,
      'model-name': 'claude-3-7-sonnet',
      'max-tokens': 4096,
    });

    const isEnabled = await client.getBooleanValue('feature-enabled', false);
    const model = await client.getStringValue('model-name', 'default');
    const tokens = await client.getNumberValue('max-tokens', 100);
    const missing = await client.getBooleanValue('unmocked-flag', false);

    expect(isEnabled).toBe(true);
    expect(model).toBe('claude-3-7-sonnet');
    expect(tokens).toBe(4096);
    expect(missing).toBe(false);
  });
});
