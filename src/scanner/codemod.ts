import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { parse } from '@babel/parser';
import traversePkg from '@babel/traverse';
import generatePkg from '@babel/generator';
import * as t from '@babel/types';
import * as diff from 'diff';

const traverse = (traversePkg as any).default || traversePkg;
const generate = (generatePkg as any).default || generatePkg;

export interface CodemodResult {
  filePath: string;
  relativeFilePath: string;
  flagKey: string;
  resolvedValue: boolean | string | number;
  originalCode: string;
  modifiedCode: string;
  diff: string;
  transformCount: number;
  applied: boolean;
  backupPath?: string;
}

export interface BulkCodemodResult {
  flagKey: string;
  resolvedValue: boolean | string | number;
  totalFilesModified: number;
  totalTransforms: number;
  files: CodemodResult[];
  branchCreated?: string;
}

export interface CodemodOptions {
  dryRun?: boolean;
  backup?: boolean;
  rootDir?: string;
  gitBranch?: string;
  commitMessage?: string;
}

const SUPPORTED_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

function getSourceFiles(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '.flagforge'].includes(entry.name)) continue;
      getSourceFiles(full, out);
    } else if (entry.isFile() && SUPPORTED_EXTS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

export class ASTCodemodEngine {
  /**
   * Refactors all files across a project referencing a specific feature flag.
   */
  public refactorProject(
    targetDir: string,
    flagKey: string,
    resolveValue: boolean | string | number,
    options: CodemodOptions = {}
  ): BulkCodemodResult {
    const files = getSourceFiles(targetDir);
    const results: CodemodResult[] = [];
    let totalTransforms = 0;

    for (const file of files) {
      try {
        const res = this.refactorFile(file, flagKey, resolveValue, options);
        if (res && res.transformCount > 0) {
          results.push(res);
          totalTransforms += res.transformCount;
        }
      } catch {
        // Skip unparseable files
      }
    }

    let branchCreated: string | undefined;

    // Optional Git Branch Creation & Commit
    if (options.dryRun === false && options.gitBranch && results.length > 0) {
      try {
        const branchName = options.gitBranch.startsWith('cleanup/')
          ? options.gitBranch
          : `cleanup/dead-flag-${options.gitBranch}`;

        execSync(`git checkout -b "${branchName}"`, { stdio: 'pipe' });

        for (const res of results) {
          execSync(`git add "${res.filePath}"`, { stdio: 'pipe' });
        }

        const msg =
          options.commitMessage ||
          `refactor(flags): cleanup dead feature flag ${flagKey} across ${results.length} files`;

        execSync(`git commit -m "${msg}"`, { stdio: 'pipe' });
        branchCreated = branchName;
      } catch (err) {
        console.error('[FlagForge] Git branch creation error:', (err as Error).message);
      }
    }

    return {
      flagKey,
      resolvedValue: resolveValue,
      totalFilesModified: results.length,
      totalTransforms,
      files: results,
      branchCreated,
    };
  }

  /**
   * Refactors a single source file by resolving a feature flag to a constant value.
   */
  public refactorFile(
    filePath: string,
    flagKey: string,
    resolveValue: boolean | string | number,
    options: CodemodOptions = {}
  ): CodemodResult | null {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const originalCode = fs.readFileSync(filePath, 'utf-8');
    const rootDir = options.rootDir || process.cwd();
    const relativeFilePath = path.relative(rootDir, filePath).replace(/\\/g, '/');

    let ast: t.File;
    try {
      ast = parse(originalCode, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
      });
    } catch (err) {
      throw new Error(`Failed to parse ${filePath}: ${(err as Error).message}`);
    }

    const flagVariableNames = new Set<string>();
    const varDeclarationPathsToRemove: any[] = [];
    let transformCount = 0;

    traverse(ast, {
      VariableDeclarator(pathNode: any) {
        const init = pathNode.node.init;
        if (!init || !t.isCallExpression(init)) return;

        if (isMatchingFlagCall(init, flagKey) && t.isIdentifier(pathNode.node.id)) {
          flagVariableNames.add(pathNode.node.id.name);
          varDeclarationPathsToRemove.push(pathNode);
        }
      },
    });

    function evaluateTest(node: t.Node): boolean | null {
      if (t.isCallExpression(node) && isMatchingFlagCall(node, flagKey)) {
        return Boolean(resolveValue);
      }

      if (t.isIdentifier(node) && flagVariableNames.has(node.name)) {
        return Boolean(resolveValue);
      }

      if (t.isUnaryExpression(node) && node.operator === '!') {
        const inner = evaluateTest(node.argument);
        return inner === null ? null : !inner;
      }

      if (t.isBinaryExpression(node)) {
        let leftVal: unknown = undefined;
        let rightVal: unknown = undefined;

        if (t.isIdentifier(node.left) && flagVariableNames.has(node.left.name)) {
          leftVal = resolveValue;
        } else if (t.isStringLiteral(node.left)) leftVal = node.left.value;
        else if (t.isBooleanLiteral(node.left)) leftVal = node.left.value;

        if (t.isIdentifier(node.right) && flagVariableNames.has(node.right.name)) {
          rightVal = resolveValue;
        } else if (t.isStringLiteral(node.right)) rightVal = node.right.value;
        else if (t.isBooleanLiteral(node.right)) rightVal = node.right.value;

        if (leftVal !== undefined && rightVal !== undefined) {
          if (node.operator === '===' || node.operator === '==') return leftVal === rightVal;
          if (node.operator === '!==' || node.operator === '!=') return leftVal !== rightVal;
        }
      }

      return null;
    }

    traverse(ast, {
      IfStatement(pathNode: any) {
        const testOutcome = evaluateTest(pathNode.node.test);
        if (testOutcome === null) return;

        transformCount++;
        const { consequent, alternate } = pathNode.node;
        const targetNode = testOutcome ? consequent : alternate;

        if (!targetNode) {
          pathNode.remove();
        } else if (t.isBlockStatement(targetNode)) {
          pathNode.replaceWithMultiple(targetNode.body);
        } else {
          pathNode.replaceWith(targetNode);
        }
      },
    });

    for (const varPath of varDeclarationPathsToRemove) {
      try {
        const parent = varPath.parentPath;
        if (parent.isVariableDeclaration() && parent.node.declarations.length === 1) {
          parent.remove();
          transformCount++;
        } else {
          varPath.remove();
          transformCount++;
        }
      } catch {
        // continue
      }
    }

    if (transformCount === 0) {
      return null;
    }

    const output = generate(ast, { retainLines: false, compact: false }, originalCode);
    const modifiedCode = output.code;

    const patch = diff.createTwoFilesPatch(
      relativeFilePath,
      relativeFilePath,
      originalCode,
      modifiedCode,
      'original',
      `codemod (${flagKey} -> ${resolveValue})`
    );

    let backupPath: string | undefined;
    const shouldApply = options.dryRun === false;

    if (shouldApply) {
      if (options.backup !== false) {
        backupPath = `${filePath}.bak`;
        fs.writeFileSync(backupPath, originalCode, 'utf-8');
      }
      fs.writeFileSync(filePath, modifiedCode, 'utf-8');
    }

    return {
      filePath,
      relativeFilePath,
      flagKey,
      resolvedValue: resolveValue,
      originalCode,
      modifiedCode,
      diff: patch,
      transformCount,
      applied: shouldApply,
      backupPath,
    };
  }
}

function isMatchingFlagCall(callNode: t.CallExpression, flagKey: string): boolean {
  let isFlagCall = false;
  const callee = callNode.callee;

  if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
    if (
      [
        'getBooleanValue',
        'getStringValue',
        'getNumberValue',
        'getObjectValue',
        'getValue',
        'isEnabled',
        'evaluate',
      ].includes(callee.property.name)
    ) {
      isFlagCall = true;
    }
  } else if (t.isIdentifier(callee)) {
    if (['useFlag', 'useBooleanFlag', 'useFeatureFlag', 'isFeatureEnabled'].includes(callee.name)) {
      isFlagCall = true;
    }
  }

  if (isFlagCall && callNode.arguments.length > 0) {
    const firstArg = callNode.arguments[0];
    if (t.isStringLiteral(firstArg) && firstArg.value === flagKey) {
      return true;
    }
  }

  return false;
}
