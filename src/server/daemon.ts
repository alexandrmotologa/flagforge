import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { Server } from 'node:http';
import { FeatureFlagEngine } from '../core/engine.js';
import { FeatureFlag, CanaryStage } from '../core/types.js';
import { YamlStorage } from '../storage/yaml-storage.js';
import { SqliteStorage } from '../storage/sqlite-storage.js';
import { SSEManager } from './sse.js';
import { formatOFREPResponse, exportToFlagdSchema } from '../provider/ofrep.js';
import { BlastRadiusSimulator } from '../simulator/blast-simulator.js';
import { ASTDeadFlagScanner } from '../scanner/ast-scanner.js';
import { ASTCodemodEngine } from '../scanner/codemod.js';

export interface DaemonOptions {
  port?: number;
  configPath?: string;
  dbPath?: string;
  uiStaticDir?: string;
}

export class FlagForgeDaemon {
  public readonly app: express.Express;
  public readonly engine: FeatureFlagEngine;
  public readonly yamlStorage: YamlStorage;
  public readonly sqliteStorage: SqliteStorage;
  public readonly sse: SSEManager;
  public readonly simulator: BlastRadiusSimulator;
  public readonly scanner: ASTDeadFlagScanner;
  public readonly codemod: ASTCodemodEngine;

  private server?: Server;
  private port: number;
  private uiStaticDir: string;

  constructor(options: DaemonOptions = {}) {
    this.port = options.port || 4900;
    this.uiStaticDir = options.uiStaticDir || path.resolve(process.cwd(), 'dist', 'ui');

    this.engine = new FeatureFlagEngine();
    this.sqliteStorage = new SqliteStorage(options.dbPath);
    this.sse = new SSEManager();
    this.simulator = new BlastRadiusSimulator(this.engine);
    this.scanner = new ASTDeadFlagScanner();
    this.codemod = new ASTCodemodEngine();

    // Initialize YAML storage with live hot reload
    this.yamlStorage = new YamlStorage({
      filePath: options.configPath,
      autoWatch: true,
      onConfigChange: (newConfig) => {
        console.log('[FlagForge] Detected configuration change on disk. Reloading...');
        this.engine.loadConfiguration(newConfig);
        this.scanner.updateKnownFlags(this.engine.getAllFlags());
        this.sse.broadcast({
          type: 'init',
          data: { flags: this.engine.getAllFlags() },
        });
      },
    });

    // Initial load
    const initialConfig = this.yamlStorage.load();
    this.engine.loadConfiguration(initialConfig);
    this.scanner.updateKnownFlags(this.engine.getAllFlags());

    this.app = express();
    this.configureMiddleware();
    this.configureRoutes();
  }

  private configureMiddleware(): void {
    this.app.use(cors({ origin: '*' }));
    this.app.use(express.json({ limit: '10mb' }));
  }

  private configureRoutes(): void {
    // 1. Health check
    this.app.get('/api/v1/health', (req: Request, res: Response) => {
      res.json({
        status: 'ok',
        version: '1.0.0',
        uptime: process.uptime(),
        flagsCount: this.engine.getAllFlags().length,
        connectedClients: this.sse.getConnectedClientsCount(),
        configPath: this.yamlStorage.getFilePath(),
      });
    });

    // 2. Server-Sent Events stream
    this.app.get('/api/v1/events', (req: Request, res: Response) => {
      this.sse.addClient(res);
      // Immediately send current state on connection
      res.write(`event: init\ndata: ${JSON.stringify({ flags: this.engine.getAllFlags() })}\n\n`);
    });

    // 3. Flags CRUD
    this.app.get('/api/v1/flags', (req: Request, res: Response) => {
      const flags = this.engine.getAllFlags();
      const metrics = this.sqliteStorage.getMetrics();
      const metricsMap = new Map(metrics.map((m) => [m.flagKey, m]));

      const flagsWithMetrics = flags.map((flag) => ({
        ...flag,
        metrics: metricsMap.get(flag.key) || {
          flagKey: flag.key,
          totalEvaluations: 0,
          variantCounts: {},
        },
      }));

      res.json({ flags: flagsWithMetrics });
    });

    this.app.post('/api/v1/flags', (req: Request, res: Response) => {
      const flagData = req.body as FeatureFlag;
      if (!flagData || !flagData.key || !flagData.name) {
        res.status(400).json({ error: 'Missing flag key or name' });
        return;
      }

      this.engine.setFlag(flagData);
      this.persistConfiguration();
      this.sqliteStorage.recordAudit('CREATE', flagData.key, { name: flagData.name });
      this.sse.broadcast({ type: 'flag_updated', data: flagData });

      res.status(201).json({ flag: flagData });
    });

    this.app.get('/api/v1/flags/:key', (req: Request, res: Response) => {
      const key = String(req.params.key);
      const flag = this.engine.getFlag(key);
      if (!flag) {
        res.status(404).json({ error: 'Flag not found' });
        return;
      }
      const metrics = this.sqliteStorage.getMetrics(flag.key);
      res.json({ flag, metrics: metrics[0] || null });
    });

    this.app.put('/api/v1/flags/:key', (req: Request, res: Response) => {
      const flagKey = String(req.params.key);
      const existing = this.engine.getFlag(flagKey);
      if (!existing) {
        res.status(404).json({ error: 'Flag not found' });
        return;
      }

      const updated: FeatureFlag = {
        ...existing,
        ...req.body,
        key: flagKey,
        updatedAt: new Date().toISOString(),
      };

      this.engine.setFlag(updated);
      this.persistConfiguration();
      this.sqliteStorage.recordAudit('UPDATE', flagKey, { changes: Object.keys(req.body) });
      this.sse.broadcast({ type: 'flag_updated', data: updated });

      res.json({ flag: updated });
    });

    this.app.delete('/api/v1/flags/:key', (req: Request, res: Response) => {
      const flagKey = String(req.params.key);
      const deleted = this.engine.deleteFlag(flagKey);
      if (!deleted) {
        res.status(404).json({ error: 'Flag not found' });
        return;
      }

      this.persistConfiguration();
      this.sqliteStorage.recordAudit('DELETE', flagKey, {});
      this.sse.broadcast({ type: 'flag_deleted', data: { flagKey } });

      res.json({ success: true, flagKey });
    });

    // Emergency killswitch toggle
    this.app.post('/api/v1/flags/:key/toggle', (req: Request, res: Response) => {
      const flagKey = String(req.params.key);
      const flag = this.engine.getFlag(flagKey);
      if (!flag) {
        res.status(404).json({ error: 'Flag not found' });
        return;
      }

      flag.enabled = !flag.enabled;
      flag.updatedAt = new Date().toISOString();
      this.engine.setFlag(flag);
      this.persistConfiguration();

      this.sqliteStorage.recordAudit('TOGGLE', flagKey, { enabled: flag.enabled });
      this.sse.broadcast({
        type: 'flag_toggled',
        data: { flagKey, enabled: flag.enabled },
      });

      res.json({ flagKey, enabled: flag.enabled });
    });

    // Canary stage progression
    this.app.post('/api/v1/flags/:key/advance', (req: Request, res: Response) => {
      const flagKey = String(req.params.key);
      const flag = this.engine.getFlag(flagKey);
      if (!flag) {
        res.status(404).json({ error: 'Flag not found' });
        return;
      }

      const stages: CanaryStage[] = ['internal', 'canary_5', 'beta_25', 'staged_50', 'ga_100'];
      const stagePercentages: Record<CanaryStage, number> = {
        internal: 0,
        canary_5: 5,
        beta_25: 25,
        staged_50: 50,
        ga_100: 100,
        custom: flag.rollout?.percentage || 0,
      };

      const currentStage = flag.canaryStage || 'internal';
      const currentIndex = stages.indexOf(currentStage);
      const nextIndex = Math.min(currentIndex + 1, stages.length - 1);
      const nextStage = stages[nextIndex];

      flag.canaryStage = nextStage;
      if (!flag.rollout) {
        flag.rollout = { percentage: 0 };
      }
      flag.rollout.percentage = stagePercentages[nextStage];
      flag.updatedAt = new Date().toISOString();

      if (nextStage === 'ga_100') {
        flag.lifecycle = 'active';
        flag.staleSince = new Date().toISOString();
      }

      this.engine.setFlag(flag);
      this.persistConfiguration();
      this.sqliteStorage.recordAudit('ROLLOUT_ADVANCE', flagKey, {
        from: currentStage,
        to: nextStage,
        percentage: flag.rollout.percentage,
      });

      this.sse.broadcast({ type: 'flag_updated', data: flag });
      res.json({ flag });
    });

    // 4. REST Evaluations
    this.app.post('/api/v1/evaluate', (req: Request, res: Response) => {
      const { flagKey, defaultValue, context } = req.body;
      if (!flagKey) {
        res.status(400).json({ error: 'Missing flagKey' });
        return;
      }

      const details = this.engine.evaluate(flagKey, defaultValue, context || {});
      this.sqliteStorage.recordEvaluation(flagKey, details.variant);
      res.json(details);
    });

    this.app.post('/api/v1/evaluate-all', (req: Request, res: Response) => {
      const { context } = req.body;
      const results = this.engine.evaluateAll(context || {});
      for (const [key, details] of Object.entries(results)) {
        this.sqliteStorage.recordEvaluation(key, details.variant);
      }
      res.json({ flags: results });
    });

    // 5. CNCF OFREP Standard Endpoints
    this.app.post('/ofrep/v1/evaluate/flags/:flagKey', (req: Request, res: Response) => {
      const flagKey = String(req.params.flagKey);
      const context = req.body?.context || {};
      const flag = this.engine.getFlag(flagKey);

      if (!flag) {
        res.status(404).json({
          key: flagKey,
          errorCode: 'FLAG_NOT_FOUND',
          errorDetails: `Flag "${flagKey}" not found`,
        });
        return;
      }

      const details = this.engine.evaluate(flagKey, flag.defaultValue, context);
      this.sqliteStorage.recordEvaluation(flagKey, details.variant);
      const ofrepPayload = formatOFREPResponse(details, flag);
      res.json(ofrepPayload);
    });

    this.app.post('/ofrep/v1/evaluate/flags', (req: Request, res: Response) => {
      const context = req.body?.context || {};
      const flags = this.engine.getAllFlags();
      const responses = [];

      for (const flag of flags) {
        const details = this.engine.evaluate(flag.key, flag.defaultValue, context);
        this.sqliteStorage.recordEvaluation(flag.key, details.variant);
        responses.push(formatOFREPResponse(details, flag));
      }

      res.json({ flags: responses });
    });

    // 6. Metrics and Audit
    this.app.get('/api/v1/metrics', (req: Request, res: Response) => {
      res.json({ metrics: this.sqliteStorage.getMetrics() });
    });

    this.app.get('/api/v1/audit', (req: Request, res: Response) => {
      res.json({ audit: this.sqliteStorage.getAuditLogs(100) });
    });

    // 7. Config Export / Import
    this.app.get('/api/v1/export/yaml', (req: Request, res: Response) => {
      res.setHeader('Content-Type', 'text/yaml');
      res.setHeader('Content-Disposition', 'attachment; filename="flagforge.config.yaml"');
      res.send(this.yamlStorage.load());
    });

    this.app.get('/api/v1/export/flagd', (req: Request, res: Response) => {
      const flags = this.engine.getAllFlags();
      res.json(exportToFlagdSchema(flags));
    });

    // 8. Blast-Radius Simulator
    this.app.post('/api/v1/simulate', (req: Request, res: Response) => {
      const { flagKey, cohortSize, customFlag } = req.body;
      if (!flagKey) {
        res.status(400).json({ error: 'Missing flagKey' });
        return;
      }

      try {
        const result = this.simulator.runSimulation(
          flagKey,
          { size: cohortSize || 5000 },
          customFlag
        );
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    });

    // 9. AST Dead Flag Scanner and Codemod
    this.app.post('/api/v1/scanner/scan', (req: Request, res: Response) => {
      const targetDir = req.body?.directory || process.cwd();
      try {
        this.scanner.updateKnownFlags(this.engine.getAllFlags());
        const summary = this.scanner.scanDirectory(targetDir);
        res.json(summary);
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    });

    this.app.post('/api/v1/scanner/codemod', (req: Request, res: Response) => {
      const { filePath, flagKey, resolvedValue, dryRun, backup } = req.body;
      if (!filePath || !flagKey || resolvedValue === undefined) {
        res.status(400).json({ error: 'Missing filePath, flagKey, or resolvedValue' });
        return;
      }

      try {
        const result = this.codemod.refactorFile(filePath, flagKey, resolvedValue, {
          dryRun: dryRun !== false,
          backup: backup !== false,
          rootDir: process.cwd(),
        });

        if (!result) {
          res.json({ message: 'No matching flag references found for refactoring in file', result: null });
          return;
        }

        if (dryRun === false) {
          this.sqliteStorage.recordAudit('CODEMOD_APPLY', flagKey, {
            filePath,
            resolvedValue,
          });
        }

        res.json({ result });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    });

    // 10. Serve Static UI if built
    if (fs.existsSync(this.uiStaticDir)) {
      this.app.use(express.static(this.uiStaticDir));
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api') || req.path.startsWith('/ofrep')) {
          return next();
        }
        res.sendFile(path.join(this.uiStaticDir, 'index.html'));
      });
    } else {
      this.app.get('/', (req: Request, res: Response) => {
        res.send(`
          <html>
            <body style="font-family: system-ui; background: #09090b; color: #f4f4f5; padding: 2rem;">
              <h1>FlagForge Zero-Cloud Local Daemon</h1>
              <p>Daemon running on port ${this.port}. OpenFeature OFREP active on <code>/ofrep/v1/evaluate/flags</code>.</p>
              <p>Vite Rollout Studio UI running in dev server on <a href="http://localhost:5173" style="color: #6366f1;">http://localhost:5173</a>.</p>
            </body>
          </html>
        `);
      });
    }
  }

  private persistConfiguration(): void {
    const config = this.engine.exportConfiguration();
    this.yamlStorage.save(config);
    this.scanner.updateKnownFlags(this.engine.getAllFlags());
  }

  public async start(): Promise<number> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`[FlagForge] Daemon listening on http://localhost:${this.port}`);
        console.log(`[FlagForge] OFREP Endpoint: http://localhost:${this.port}/ofrep/v1/evaluate/flags`);
        resolve(this.port);
      });
    });
  }

  public async stop(): Promise<void> {
    this.sse.close();
    this.yamlStorage.stopWatching();
    this.sqliteStorage.close();
    if (this.server) {
      return new Promise((resolve) => {
        this.server?.close(() => resolve());
      });
    }
  }
}
