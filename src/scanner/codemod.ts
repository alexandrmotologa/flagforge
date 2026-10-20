import fs from 'node:fs';
import path from 'node:path';
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

export interface CodemodOptions {
  dryRun?: boolean;
  backup?: boolean;
  rootDir?: string;
}

export class ASTCodemodEngine {
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

    // Step 1: Discover variable identifiers bound to this flagKey
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

    // Helper to evaluate test condition with respect to resolved flag value
    function evaluateTest(node: t.Node): boolean | null {
      // Direct call: client.getBooleanValue('flag', false)
      if (t.isCallExpression(node) && isMatchingFlagCall(node, flagKey)) {
        return Boolean(resolveValue);
      }

      // Identifier: if (flagVariable)
      if (t.isIdentifier(node) && flagVariableNames.has(node.name)) {
        return Boolean(resolveValue);
      }

      // Unary expression: if (!flagVariable) or if (!client.getBooleanValue(...))
      if (t.isUnaryExpression(node) && node.operator === '!') {
        const inner = evaluateTest(node.argument);
        return inner === null ? null : !inner;
      }

      // Binary equality: if (variant === 'treatment')
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

    // Step 2: Unroll IfStatements
    traverse(ast, {
      IfStatement(pathNode: any) {
        const testOutcome = evaluateTest(pathNode.node.test);
        if (testOutcome === null) return;

        transformCount++;
        const { consequent, alternate } = pathNode.node;
        const targetNode = testOutcome ? consequent : alternate;

        if (!targetNode) {
          // No alternate and testOutcome is false -> remove entire if statement
          pathNode.remove();
        } else if (t.isBlockStatement(targetNode)) {
          // Replace IfStatement with block contents
          pathNode.replaceWithMultiple(targetNode.body);
        } else {
          pathNode.replaceWith(targetNode);
        }
      },
    });

    // Step 3: Remove unused variable declarations
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
        // Continue if path was already removed during unrolling
      }
    }

    if (transformCount === 0) {
      return null;
    }

    const output = generate(ast, { retainLines: false, compact: false }, originalCode);
    const modifiedCode = output.code;

    // Generate unified diff
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
