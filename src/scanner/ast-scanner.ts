import fs from 'node:fs';
import path from 'node:path';
import { parse } from '@babel/parser';
import traversePkg from '@babel/traverse';
import * as t from '@babel/types';
import { FeatureFlag } from '../core/types.js';

// Resolve traverse default import across ESM/CJS interop
const traverse = (traversePkg as any).default || traversePkg;

export type FlagHealthStatus = 'ACTIVE' | 'CANARY' | 'STALE' | 'DEAD' | 'ORPHANED';

export interface CodeReference {
  filePath: string;
  relativeFilePath: string;
  line: number;
  column: number;
  flagKey: string;
  methodName: string;
  fallbackValue?: unknown;
  snippet: string;
  contextNode: string; // 'IfStatement' | 'VariableDeclaration' | 'CallExpression'
}

export interface FlagScanReport {
  flagKey: string;
  status: FlagHealthStatus;
  references: CodeReference[];
  referenceCount: number;
  recommendation: string;
  staleSinceDays?: number;
  flagDefinition?: FeatureFlag;
}

export interface ScannerSummary {
  scannedFiles: number;
  totalReferences: number;
  reports: FlagScanReport[];
  scanDurationMs: number;
}

const SUPPORTED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function findFilesRecursive(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === '.flagforge'
      ) {
        continue;
      }
      findFilesRecursive(fullPath, fileList);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SUPPORTED_EXTENSIONS.has(ext)) {
        fileList.push(fullPath);
      }
    }
  }

  return fileList;
}

function extractSnippet(lines: string[], targetLine: number, context = 2): string {
  const start = Math.max(0, targetLine - 1 - context);
  const end = Math.min(lines.length, targetLine + context);
  return lines.slice(start, end).join('\n');
}

export class ASTDeadFlagScanner {
  private knownFlags: Map<string, FeatureFlag>;

  constructor(flags: FeatureFlag[] = []) {
    this.knownFlags = new Map(flags.map((f) => [f.key, f]));
  }

  public updateKnownFlags(flags: FeatureFlag[]): void {
    this.knownFlags = new Map(flags.map((f) => [f.key, f]));
  }

  public scanDirectory(targetDir: string): ScannerSummary {
    const startTime = performance.now();
    const files = findFilesRecursive(targetDir);
    const referencesByFlag = new Map<string, CodeReference[]>();

    for (const filePath of files) {
      try {
        const fileRefs = this.scanFile(filePath, targetDir);
        for (const ref of fileRefs) {
          const list = referencesByFlag.get(ref.flagKey) || [];
          list.push(ref);
          referencesByFlag.set(ref.flagKey, list);
        }
      } catch {
        // Skip files with unparseable syntax
      }
    }

    // Merge with known flags
    const allFlagKeys = new Set([
      ...Array.from(this.knownFlags.keys()),
      ...Array.from(referencesByFlag.keys()),
    ]);

    const reports: FlagScanReport[] = [];
    const now = Date.now();

    for (const key of allFlagKeys) {
      const flagDef = this.knownFlags.get(key);
      const refs = referencesByFlag.get(key) || [];

      let status: FlagHealthStatus = 'ACTIVE';
      let staleDays: number | undefined;
      let recommendation = 'Flag is actively configured and evaluated in code.';

      if (!flagDef) {
        status = 'ORPHANED';
        recommendation = 'Flag is referenced in code but missing from FlagForge configuration. Create or remove it.';
      } else if (flagDef.lifecycle === 'dead' || flagDef.enabled === false) {
        status = 'DEAD';
        recommendation = 'Flag is disabled or archived. Remove code branches and delete flag to pay down tech debt.';
      } else if (flagDef.rollout?.percentage === 100) {
        status = 'STALE';
        if (flagDef.staleSince) {
          staleDays = Math.floor((now - new Date(flagDef.staleSince).getTime()) / (1000 * 60 * 60 * 24));
        } else {
          staleDays = 30; // default assumption for 100% rollout
        }
        recommendation = `Flag rolled out to 100% for ~${staleDays} days. Safe to codemod active branch into source.`;
      } else if (flagDef.lifecycle === 'canary') {
        status = 'CANARY';
        recommendation = `Flag in canary stage (${flagDef.canaryStage || 'custom'}). Monitor blast-radius before advancing.`;
      }

      reports.push({
        flagKey: key,
        status,
        references: refs,
        referenceCount: refs.length,
        recommendation,
        staleSinceDays: staleDays,
        flagDefinition: flagDef,
      });
    }

    // Sort by status priority: DEAD first, then STALE, ORPHANED, CANARY, ACTIVE
    const priority: Record<FlagHealthStatus, number> = {
      DEAD: 1,
      STALE: 2,
      ORPHANED: 3,
      CANARY: 4,
      ACTIVE: 5,
    };
    reports.sort((a, b) => priority[a.status] - priority[b.status]);

    const totalRefs = Array.from(referencesByFlag.values()).reduce((acc, l) => acc + l.length, 0);

    return {
      scannedFiles: files.length,
      totalReferences: totalRefs,
      reports,
      scanDurationMs: Math.round((performance.now() - startTime) * 100) / 100,
    };
  }

  public scanFile(filePath: string, rootDir: string): CodeReference[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const relativeFilePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const refs: CodeReference[] = [];

    let ast: t.File;
    try {
      ast = parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });
    } catch {
      return refs;
    }

    traverse(ast, {
      CallExpression(pathNode: any) {
        const callee = pathNode.node.callee;
        let methodName = '';
        let isFlagCall = false;

        // Pattern 1: client.getBooleanValue('key', false) or flagforge.isEnabled('key')
        if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
          methodName = callee.property.name;
          if (
            [
              'getBooleanValue',
              'getStringValue',
              'getNumberValue',
              'getObjectValue',
              'getValue',
              'isEnabled',
              'evaluate',
            ].includes(methodName)
          ) {
            isFlagCall = true;
          }
        }
        // Pattern 2: useFlag('key') or useBooleanFlag('key')
        else if (t.isIdentifier(callee)) {
          methodName = callee.name;
          if (['useFlag', 'useBooleanFlag', 'useFeatureFlag', 'isFeatureEnabled'].includes(methodName)) {
            isFlagCall = true;
          }
        }

        if (isFlagCall && pathNode.node.arguments.length > 0) {
          const firstArg = pathNode.node.arguments[0];
          if (t.isStringLiteral(firstArg)) {
            const flagKey = firstArg.value;
            const loc = pathNode.node.loc?.start;
            const line = loc ? loc.line : 1;
            const column = loc ? loc.column : 0;

            // Detect fallback argument if present
            let fallbackValue: unknown = undefined;
            if (pathNode.node.arguments.length > 1) {
              const secondArg = pathNode.node.arguments[1];
              if (t.isBooleanLiteral(secondArg)) fallbackValue = secondArg.value;
              else if (t.isStringLiteral(secondArg)) fallbackValue = secondArg.value;
              else if (t.isNumericLiteral(secondArg)) fallbackValue = secondArg.value;
            }

            // Find context parent node
            let contextNode = 'CallExpression';
            if (pathNode.parentPath?.isIfStatement()) {
              contextNode = 'IfStatement';
            } else if (pathNode.parentPath?.isVariableDeclarator()) {
              contextNode = 'VariableDeclaration';
            }

            refs.push({
              filePath,
              relativeFilePath,
              line,
              column,
              flagKey,
              methodName,
              fallbackValue,
              snippet: extractSnippet(lines, line),
              contextNode,
            });
          }
        }
      },
    });

    return refs;
  }
}
