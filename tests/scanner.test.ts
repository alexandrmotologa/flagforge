import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ASTDeadFlagScanner } from '../src/scanner/ast-scanner.js';
import { FeatureFlag } from '../src/core/types.js';

describe('ASTDeadFlagScanner', () => {
  const flags: FeatureFlag[] = [
    {
      key: 'legacy-feature',
      name: 'Legacy Feature',
      description: 'Disabled old feature',
      type: 'boolean',
      enabled: false,
      defaultValue: false,
      variants: { on: true, off: false },
      rules: [],
      lifecycle: 'dead',
      staleSince: '2025-01-01T00:00:00Z',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      key: 'graduated-v2',
      name: 'Graduated v2',
      description: '100% rollout feature',
      type: 'boolean',
      enabled: true,
      defaultValue: false,
      variants: { on: true, off: false },
      rules: [],
      rollout: { percentage: 100 },
      lifecycle: 'active',
      staleSince: '2026-01-01T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  it('scans code and identifies flag calls with file and line coordinates', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagforge-scanner-test-'));
    const testFile = path.join(tempDir, 'sample.ts');

    const sampleContent = `
import { OpenFeature } from '@openfeature/server-sdk';

export async function processPayment(client: any) {
  const isV2 = client.getBooleanValue('graduated-v2', false);
  if (isV2) {
    return 'v2-payment-flow';
  }

  if (client.getBooleanValue('legacy-feature', false)) {
    console.log('Legacy warning');
  }

  const orphaned = client.getStringValue('unknown-flag-x', 'def');
  return 'default-flow';
}
`;
    fs.writeFileSync(testFile, sampleContent, 'utf-8');

    const scanner = new ASTDeadFlagScanner(flags);
    const summary = scanner.scanDirectory(tempDir);

    expect(summary.scannedFiles).toBe(1);
    expect(summary.totalReferences).toBe(3);

    const deadReport = summary.reports.find((r) => r.flagKey === 'legacy-feature');
    expect(deadReport?.status).toBe('DEAD');
    expect(deadReport?.references.length).toBe(1);
    expect(deadReport?.references[0].line).toBe(10);

    const staleReport = summary.reports.find((r) => r.flagKey === 'graduated-v2');
    expect(staleReport?.status).toBe('STALE');
    expect(staleReport?.references.length).toBe(1);
    expect(staleReport?.references[0].line).toBe(5);

    const orphanReport = summary.reports.find((r) => r.flagKey === 'unknown-flag-x');
    expect(orphanReport?.status).toBe('ORPHANED');
    expect(orphanReport?.references.length).toBe(1);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
