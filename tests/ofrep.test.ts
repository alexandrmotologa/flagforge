import { describe, it, expect } from 'vitest';
import { FeatureFlagEngine } from '../src/core/engine.js';
import { formatOFREPResponse, exportToFlagdSchema } from '../src/provider/ofrep.js';
import { FeatureFlag } from '../src/core/types.js';

describe('CNCF OFREP & flagd Protocol Formatter', () => {
  const flags: FeatureFlag[] = [
    {
      key: 'feature-flag-test',
      name: 'Test Flag',
      description: 'OFREP compliance test flag',
      type: 'boolean',
      enabled: true,
      defaultValue: false,
      defaultVariant: 'off',
      variants: { on: true, off: false },
      rules: [
        {
          id: 'rule-internal',
          conditions: [{ property: 'tier', operator: 'equals', value: 'internal' }],
          serve: { variant: 'on' },
        },
      ],
      lifecycle: 'active',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  it('formats OFREP success response matching CNCF standard', () => {
    const engine = new FeatureFlagEngine(flags);
    const details = engine.evaluate('feature-flag-test', false, { tier: 'internal' });
    const ofrep = formatOFREPResponse(details, flags[0]);

    expect(ofrep.key).toBe('feature-flag-test');
    expect(ofrep.value).toBe(true);
    expect(ofrep.reason).toBe('TARGETING_MATCH');
    expect(ofrep.variant).toBe('on');
    expect(ofrep.metadata?.flagName).toBe('Test Flag');
  });

  it('exports flags to CNCF flagd schema specification', () => {
    const schema = exportToFlagdSchema(flags);
    expect(schema.$schema).toBe('https://flagd.dev/schema/v0/flags.json');
    const flagsObj = schema.flags as Record<string, any>;
    expect(flagsObj['feature-flag-test'].state).toBe('ENABLED');
    expect(flagsObj['feature-flag-test'].defaultVariant).toBe('off');
  });
});
