import path from 'node:path';
import fs from 'node:fs';
import { FeatureFlag } from '../core/types.js';

export interface AuditEntry {
  id: number;
  action:
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'TOGGLE'
    | 'CODEMOD_APPLY'
    | 'ROLLOUT_ADVANCE'
    | 'CIRCUIT_BREAKER_TRIGGERED'
    | 'SCHEDULE_TRIGGERED';
  flagKey: string;
  details: string;
  timestamp: string;
}

export interface MetricSummary {
  flagKey: string;
  totalEvaluations: number;
  variantCounts: Record<string, number>;
  lastEvaluatedAt?: string;
}

export class SqliteStorage {
  private db: any = null;
  private inMemoryAudit: AuditEntry[] = [];
  private inMemoryMetrics: Map<string, MetricSummary> = new Map();
  private inMemorySnapshots: Array<{ flagKey: string; snapshot: string; createdAt: string }> = [];
  private isNodeSqlite = false;

  constructor(dbPath?: string) {
    const finalPath = dbPath || path.resolve(process.cwd(), '.flagforge', 'flagforge.db');
    fs.mkdirSync(path.dirname(finalPath), { recursive: true });

    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sqliteModule = require('node:sqlite');
      if (sqliteModule && sqliteModule.DatabaseSync) {
        this.db = new sqliteModule.DatabaseSync(finalPath);
        this.isNodeSqlite = true;
        this.initSchema();
      }
    } catch {
      this.isNodeSqlite = false;
    }
  }

  private initSchema(): void {
    if (!this.db) return;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        flag_key TEXT NOT NULL,
        details TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS flag_metrics (
        flag_key TEXT NOT NULL,
        variant TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        last_evaluated TEXT NOT NULL,
        PRIMARY KEY (flag_key, variant)
      );

      CREATE TABLE IF NOT EXISTS flag_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        flag_key TEXT NOT NULL,
        snapshot TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  public recordAudit(
    action: AuditEntry['action'],
    flagKey: string,
    details: Record<string, unknown>
  ): void {
    const timestamp = new Date().toISOString();
    const detailsStr = JSON.stringify(details);

    if (this.isNodeSqlite && this.db) {
      try {
        const stmt = this.db.prepare(
          'INSERT INTO audit_log (action, flag_key, details, timestamp) VALUES (?, ?, ?, ?)'
        );
        stmt.run(action, flagKey, detailsStr, timestamp);
        return;
      } catch (err) {
        console.error('[FlagForge] SQLite audit error:', err);
      }
    }

    this.inMemoryAudit.unshift({
      id: this.inMemoryAudit.length + 1,
      action,
      flagKey,
      details: detailsStr,
      timestamp,
    });
  }

  public recordSnapshot(flag: FeatureFlag): void {
    const timestamp = new Date().toISOString();
    const snapshotStr = JSON.stringify(flag);

    if (this.isNodeSqlite && this.db) {
      try {
        const stmt = this.db.prepare(
          'INSERT INTO flag_snapshots (flag_key, snapshot, created_at) VALUES (?, ?, ?)'
        );
        stmt.run(flag.key, snapshotStr, timestamp);
        return;
      } catch (err) {
        console.error('[FlagForge] SQLite snapshot error:', err);
      }
    }

    this.inMemorySnapshots.push({
      flagKey: flag.key,
      snapshot: snapshotStr,
      createdAt: timestamp,
    });
  }

  public getFlagAtTimestamp(flagKey: string, timestamp: string): FeatureFlag | null {
    if (this.isNodeSqlite && this.db) {
      try {
        const stmt = this.db.prepare(
          'SELECT snapshot FROM flag_snapshots WHERE flag_key = ? AND created_at <= ? ORDER BY id DESC LIMIT 1'
        );
        const row = stmt.get(flagKey, timestamp) as { snapshot: string } | undefined;
        if (row && row.snapshot) {
          return JSON.parse(row.snapshot) as FeatureFlag;
        }
      } catch (err) {
        console.error('[FlagForge] SQLite time-travel query error:', err);
      }
    }

    // Fallback to in-memory snapshots
    const match = [...this.inMemorySnapshots]
      .reverse()
      .find((s) => s.flagKey === flagKey && s.createdAt <= timestamp);

    return match ? (JSON.parse(match.snapshot) as FeatureFlag) : null;
  }

  public getAuditLogs(limit = 100): AuditEntry[] {
    if (this.isNodeSqlite && this.db) {
      try {
        const stmt = this.db.prepare(
          'SELECT id, action, flag_key as flagKey, details, timestamp FROM audit_log ORDER BY id DESC LIMIT ?'
        );
        return stmt.all(limit) as AuditEntry[];
      } catch (err) {
        console.error('[FlagForge] SQLite getAuditLogs error:', err);
      }
    }

    return this.inMemoryAudit.slice(0, limit);
  }

  public recordEvaluation(flagKey: string, variant = 'default'): void {
    const timestamp = new Date().toISOString();

    if (this.isNodeSqlite && this.db) {
      try {
        const stmt = this.db.prepare(`
          INSERT INTO flag_metrics (flag_key, variant, count, last_evaluated)
          VALUES (?, ?, 1, ?)
          ON CONFLICT(flag_key, variant) DO UPDATE SET
            count = count + 1,
            last_evaluated = excluded.last_evaluated
        `);
        stmt.run(flagKey, variant, timestamp);
        return;
      } catch {
        // Continue to fallback
      }
    }

    const current = this.inMemoryMetrics.get(flagKey) || {
      flagKey,
      totalEvaluations: 0,
      variantCounts: {},
      lastEvaluatedAt: timestamp,
    };
    current.totalEvaluations++;
    current.variantCounts[variant] = (current.variantCounts[variant] || 0) + 1;
    current.lastEvaluatedAt = timestamp;
    this.inMemoryMetrics.set(flagKey, current);
  }

  public getMetrics(flagKey?: string): MetricSummary[] {
    if (this.isNodeSqlite && this.db) {
      try {
        const query = flagKey
          ? 'SELECT flag_key, variant, count, last_evaluated FROM flag_metrics WHERE flag_key = ?'
          : 'SELECT flag_key, variant, count, last_evaluated FROM flag_metrics';

        const stmt = this.db.prepare(query);
        const rows = (flagKey ? stmt.all(flagKey) : stmt.all()) as Array<{
          flag_key: string;
          variant: string;
          count: number;
          last_evaluated: string;
        }>;

        const map = new Map<string, MetricSummary>();
        for (const row of rows) {
          if (!map.has(row.flag_key)) {
            map.set(row.flag_key, {
              flagKey: row.flag_key,
              totalEvaluations: 0,
              variantCounts: {},
              lastEvaluatedAt: row.last_evaluated,
            });
          }
          const item = map.get(row.flag_key)!;
          item.totalEvaluations += row.count;
          item.variantCounts[row.variant] = row.count;
          if (row.last_evaluated > (item.lastEvaluatedAt || '')) {
            item.lastEvaluatedAt = row.last_evaluated;
          }
        }
        return Array.from(map.values());
      } catch {
        // Fallback
      }
    }

    if (flagKey) {
      const single = this.inMemoryMetrics.get(flagKey);
      return single ? [single] : [];
    }
    return Array.from(this.inMemoryMetrics.values());
  }

  public close(): void {
    if (this.isNodeSqlite && this.db && typeof this.db.close === 'function') {
      try {
        this.db.close();
      } catch {
        // ignore
      }
    }
  }
}
