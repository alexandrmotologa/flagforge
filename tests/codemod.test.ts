import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ASTCodemodEngine } from '../src/scanner/codemod.js';

describe('ASTCodemodEngine', () => {
  it('unrolls if statements when flag resolves to true', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagforge-codemod-test-'));
    const testFile = path.join(tempDir, 'feature.ts');

    const sample = `
function renderCheckout(client: any) {
  const isV2 = client.getBooleanValue('checkout-v2', false);
  if (isV2) {
    return 'render-modern-ui';
  } else {
    return 'render-legacy-ui';
  }
}
`;
    fs.writeFileSync(testFile, sample, 'utf-8');

    const engine = new ASTCodemodEngine();
    const result = engine.refactorFile(testFile, 'checkout-v2', true, { dryRun: true });

    expect(result).not.toBeNull();
    expect(result?.modifiedCode).toContain("return 'render-modern-ui';");
    expect(result?.modifiedCode).not.toContain("return 'render-legacy-ui';");
    expect(result?.modifiedCode).not.toContain('client.getBooleanValue');
    expect(result?.diff).toContain("return 'render-modern-ui';");

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('unrolls if statements when flag resolves to false and applies to disk with backup', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flagforge-codemod-test-'));
    const testFile = path.join(tempDir, 'feature2.ts');

    const sample = `
function checkPromo(client: any) {
  if (client.getBooleanValue('winter-promo', false)) {
    applyDiscount();
  }
  return 100;
}
`;
    fs.writeFileSync(testFile, sample, 'utf-8');

    const engine = new ASTCodemodEngine();
    const result = engine.refactorFile(testFile, 'winter-promo', false, { dryRun: false, backup: true });

    expect(result).not.toBeNull();
    expect(result?.applied).toBe(true);
    expect(fs.existsSync(testFile + '.bak')).toBe(true);

    const onDisk = fs.readFileSync(testFile, 'utf-8');
    expect(onDisk).not.toContain('winter-promo');
    expect(onDisk).not.toContain('applyDiscount');
    expect(onDisk).toContain('return 100;');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
