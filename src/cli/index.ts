#!/usr/bin/env node
import { Command } from 'commander';
import pc from 'picocolors';
import path from 'node:path';
import fs from 'node:fs';
import { FlagForgeDaemon } from '../server/daemon.js';
import { FeatureFlagEngine } from '../core/engine.js';
import { YamlStorage } from '../storage/yaml-storage.js';
import { BlastRadiusSimulator } from '../simulator/blast-simulator.js';
import { ASTDeadFlagScanner } from '../scanner/ast-scanner.js';
import { ASTCodemodEngine } from '../scanner/codemod.js';
import { exportToFlagdSchema } from '../provider/ofrep.js';

const program = new Command();

program
  .name('flagforge')
  .description('OpenFeature-compliant local feature flag engine, blast-radius simulator and AST dead flag scanner')
  .version('1.0.0');

// Command: start
program
  .command('start')
  .description('Start the local zero-cloud FlagForge daemon and studio UI')
  .option('-p, --port <number>', 'Port to listen on', '4900')
  .option('-c, --config <path>', 'Path to YAML configuration file', 'flagforge.config.yaml')
  .action(async (options) => {
    const port = parseInt(options.port, 10);
    const configPath = path.resolve(process.cwd(), options.config);

    console.log(pc.bold(pc.cyan('\n  ⚑ FLAGFORGE LOCAL ENGINE & STUDIO')));
    console.log(pc.dim('  OpenFeature v0.7+ CNCF Compliant Zero-Cloud Daemon\n'));

    const daemon = new FlagForgeDaemon({
      port,
      configPath,
    });

    await daemon.start();

    console.log(`  ${pc.green('✓')} Daemon listening:   ${pc.underline(`http://localhost:${port}`)}`);
    console.log(`  ${pc.green('✓')} OFREP API endpoint: ${pc.underline(`http://localhost:${port}/ofrep/v1/evaluate/flags`)}`);
    console.log(`  ${pc.green('✓')} Configuration file:  ${pc.dim(configPath)}`);
    console.log(`  ${pc.green('✓')} SSE Live Stream:    ${pc.dim(`/api/v1/events`)}`);
    console.log(`  ${pc.cyan('ℹ')} Studio Web UI:      ${pc.underline(`http://localhost:${port}`)} or dev ${pc.underline('http://localhost:5173')}\n`);
    console.log(pc.dim('  Press Ctrl+C to shut down.\n'));

    process.on('SIGINT', async () => {
      console.log(pc.yellow('\n  Shutting down FlagForge daemon...'));
      await daemon.stop();
      process.exit(0);
    });
  });

// Command: eval
program
  .command('eval <flagKey>')
  .description('Evaluate a feature flag using local engine')
  .option('-c, --context <json>', 'Evaluation context as JSON string', '{}')
  .option('-d, --default <val>', 'Fallback value', 'false')
  .option('--config <path>', 'Config path', 'flagforge.config.yaml')
  .action((flagKey, options) => {
    let context = {};
    try {
      context = JSON.parse(options.context);
    } catch {
      console.error(pc.red('Error: Invalid JSON context provided'));
      process.exit(1);
    }

    const yamlStorage = new YamlStorage({ filePath: path.resolve(process.cwd(), options.config) });
    const config = yamlStorage.load();
    const engine = new FeatureFlagEngine();
    engine.loadConfiguration(config);

    const details = engine.evaluate(flagKey, options.default, context);

    console.log(pc.bold(`\n  Flag Evaluation: ${pc.cyan(flagKey)}`));
    console.log(`  Resolved Value:  ${pc.bold(details.value ? pc.green(String(details.value)) : pc.red(String(details.value)))}`);
    console.log(`  Reason:          ${pc.yellow(details.reason)}`);
    if (details.variant) console.log(`  Variant:         ${pc.magenta(details.variant)}`);
    if (details.matchedRuleId) console.log(`  Matched Rule:    ${pc.dim(details.matchedRuleId)}`);
    if (details.bucket !== undefined) console.log(`  Hash Bucket:     ${pc.dim(`${details.bucket}%`)}`);
    console.log('');
  });

// Command: simulate
program
  .command('simulate <flagKey>')
  .description('Run blast-radius simulation against a synthetic user cohort')
  .option('-s, --size <number>', 'Cohort size', '5000')
  .option('--config <path>', 'Config path', 'flagforge.config.yaml')
  .action((flagKey, options) => {
    const size = parseInt(options.size, 10);
    const yamlStorage = new YamlStorage({ filePath: path.resolve(process.cwd(), options.config) });
    const config = yamlStorage.load();
    const engine = new FeatureFlagEngine();
    engine.loadConfiguration(config);

    const simulator = new BlastRadiusSimulator(engine);
    console.log(pc.bold(pc.cyan(`\n  Simulating Blast-Radius for "${flagKey}" (${size.toLocaleString()} users)...`)));

    try {
      const result = simulator.runSimulation(flagKey, { size });
      console.log(`  Evaluated:     ${result.totalEvaluated.toLocaleString()} synthetic profiles in ${result.durationMs}ms`);
      console.log(`  Affected:      ${pc.bold(pc.green(result.affectedCount.toLocaleString()))} users (${pc.bold(pc.magenta(`${result.blastRadiusPercentage}%`))} blast radius)`);
      console.log(`  Uniformity:    ${result.chiSquare.rating} (${result.chiSquare.uniformityScore}% score, χ² = ${result.chiSquare.statistic})\n`);

      console.log(pc.bold('  Impact by Subscription Tier:'));
      for (const tier of result.tierBreakdown) {
        console.log(`    ${pc.cyan(tier.segment.padEnd(12))} ${tier.affected.toString().padStart(5)} / ${tier.total} (${pc.yellow(`${tier.affectedPercentage}%`)})`);
      }
      console.log('');
    } catch (err) {
      console.error(pc.red(`Error: ${(err as Error).message}`));
    }
  });

// Command: scan
program
  .command('scan [directory]')
  .description('Scan codebase AST for dead, stale, and orphaned feature flags')
  .option('--config <path>', 'Config path', 'flagforge.config.yaml')
  .action((directory, options) => {
    const targetDir = path.resolve(process.cwd(), directory || '.');
    const yamlStorage = new YamlStorage({ filePath: path.resolve(process.cwd(), options.config) });
    const config = yamlStorage.load();
    const engine = new FeatureFlagEngine();
    engine.loadConfiguration(config);

    const scanner = new ASTDeadFlagScanner(engine.getAllFlags());
    console.log(pc.bold(pc.cyan(`\n  Scanning codebase AST in ${targetDir}...`)));

    const summary = scanner.scanDirectory(targetDir);
    console.log(`  Scanned ${summary.scannedFiles} source files in ${summary.scanDurationMs}ms.`);
    console.log(`  Found ${summary.totalReferences} flag references across ${summary.reports.length} flags.\n`);

    for (const report of summary.reports) {
      const statusColor =
        report.status === 'DEAD'
          ? pc.red
          : report.status === 'STALE'
          ? pc.yellow
          : report.status === 'ORPHANED'
          ? pc.magenta
          : pc.green;

      console.log(`  ${statusColor(`[${report.status}]`)} ${pc.bold(report.flagKey)} (${report.referenceCount} references)`);
      console.log(`    Recommendation: ${pc.dim(report.recommendation)}`);
      for (const ref of report.references.slice(0, 3)) {
        console.log(`    → ${pc.dim(ref.relativeFilePath)}:${ref.line}:${ref.column} (${ref.methodName})`);
      }
      if (report.references.length > 3) {
        console.log(`    ${pc.dim(`... and ${report.references.length - 3} more`)}`);
      }
      console.log('');
    }
  });

// Command: codemod
program
  .command('codemod <file>')
  .description('Safely refactor away a dead flag by unrolling AST branches')
  .requiredOption('--flag <key>', 'Feature flag key to eliminate')
  .requiredOption('--resolve <value>', 'Resolved value (true, false, or string variant)')
  .option('--apply', 'Apply changes to file (defaults to dry-run preview)', false)
  .action((file, options) => {
    const filePath = path.resolve(process.cwd(), file);
    let resolvedVal: boolean | string | number = options.resolve;
    if (options.resolve === 'true') resolvedVal = true;
    else if (options.resolve === 'false') resolvedVal = false;
    else if (!isNaN(Number(options.resolve))) resolvedVal = Number(options.resolve);

    const codemod = new ASTCodemodEngine();
    console.log(pc.bold(pc.cyan(`\n  Running AST Codemod for "${options.flag}" -> ${resolvedVal}...`)));

    try {
      const result = codemod.refactorFile(filePath, options.flag, resolvedVal, {
        dryRun: !options.apply,
        backup: true,
      });

      if (!result) {
        console.log(pc.yellow('  No matching flag calls found in specified file.\n'));
        return;
      }

      console.log(`  Transformed ${result.transformCount} AST nodes.`);
      if (options.apply) {
        console.log(`  ${pc.green('✓')} Applied changes to: ${result.filePath}`);
        if (result.backupPath) console.log(`  ${pc.dim('Backup created at: ' + result.backupPath)}`);
      } else {
        console.log(`  ${pc.yellow('ℹ')} Dry-run mode. Pass --apply to write changes to disk.`);
      }

      console.log(pc.bold('\n  Diff Preview:'));
      console.log(result.diff);
    } catch (err) {
      console.error(pc.red(`Error: ${(err as Error).message}`));
    }
  });

// Command: export
program
  .command('export')
  .description('Export flag configuration in flagd or YAML format')
  .option('-f, --format <format>', 'Export format: flagd or yaml', 'flagd')
  .option('--config <path>', 'Config path', 'flagforge.config.yaml')
  .action((options) => {
    const yamlStorage = new YamlStorage({ filePath: path.resolve(process.cwd(), options.config) });
    const config = yamlStorage.load();
    const engine = new FeatureFlagEngine();
    engine.loadConfiguration(config);

    if (options.format === 'yaml') {
      console.log(fs.readFileSync(yamlStorage.getFilePath(), 'utf-8'));
    } else {
      console.log(JSON.stringify(exportToFlagdSchema(engine.getAllFlags()), null, 2));
    }
  });

program.parse();
