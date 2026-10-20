import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { FlagConfiguration, FeatureFlag } from '../core/types.js';

export interface YamlStorageOptions {
  filePath?: string;
  autoWatch?: boolean;
  onConfigChange?: (config: FlagConfiguration) => void;
}

export class YamlStorage {
  private filePath: string;
  private watcher?: fs.FSWatcher;
  private debounceTimer?: NodeJS.Timeout;
  private onConfigChange?: (config: FlagConfiguration) => void;

  constructor(options: YamlStorageOptions = {}) {
    this.filePath = options.filePath || path.resolve(process.cwd(), 'flagforge.config.yaml');
    this.onConfigChange = options.onConfigChange;

    if (options.autoWatch !== false) {
      this.startWatching();
    }
  }

  public getFilePath(): string {
    return this.filePath;
  }

  /**
   * Loads the configuration from the YAML file.
   * If the file does not exist, it initializes it with standard defaults.
   */
  public load(): FlagConfiguration {
    if (!fs.existsSync(this.filePath)) {
      const initial = this.getDefaultConfiguration();
      this.save(initial);
      return initial;
    }

    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = YAML.parse(raw) as FlagConfiguration;
      if (!parsed || typeof parsed !== 'object') {
        return this.getDefaultConfiguration();
      }
      return parsed;
    } catch (err) {
      console.error(`[FlagForge] Error parsing YAML at ${this.filePath}:`, (err as Error).message);
      return this.getDefaultConfiguration();
    }
  }

  /**
   * Saves the configuration object to the YAML file.
   */
  public save(config: FlagConfiguration): void {
    const header = '# FlagForge Feature Flag Configuration\n# Auto-generated & watched by FlagForge Daemon\n\n';
    const yamlStr = YAML.stringify(config, { indent: 2 });
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, header + yamlStr, 'utf-8');
  }

  /**
   * Watches the YAML file for disk changes and notifies the callback.
   */
  public startWatching(): void {
    if (this.watcher) return;
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      this.watcher = fs.watch(this.filePath, (eventType) => {
        if (eventType === 'change' || eventType === 'rename') {
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            if (fs.existsSync(this.filePath) && this.onConfigChange) {
              const updated = this.load();
              this.onConfigChange(updated);
            }
          }, 150);
        }
      });
    } catch {
      // In case file does not exist yet
    }
  }

  public stopWatching(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  /**
   * Provides realistic sample configuration for initial setup.
   */
  public getDefaultConfiguration(): FlagConfiguration {
    const sampleFlags: Record<string, FeatureFlag> = {
      'new-dashboard-ui': {
        key: 'new-dashboard-ui',
        name: 'New Dashboard UI (v2)',
        description: 'Next-generation analytics overview with real-time stream cards',
        type: 'boolean',
        enabled: true,
        defaultValue: false,
        defaultVariant: 'off',
        variants: {
          on: true,
          off: false,
        },
        rules: [
          {
            id: 'internal-employees',
            description: 'Enable for internal company accounts',
            conditions: [
              {
                property: 'email',
                operator: 'matches_regex',
                value: '.*@(flagforge\\.dev|company\\.com)$',
              },
            ],
            serve: { variant: 'on' },
          },
          {
            id: 'beta-testers',
            description: 'Enable for users in beta tier in MD & EU',
            conditions: [
              { property: 'tier', operator: 'in', value: ['beta', 'vip', 'enterprise'] },
              { property: 'country', operator: 'in', value: ['MD', 'RO', 'DE', 'FR'] },
            ],
            serve: { variant: 'on' },
          },
        ],
        rollout: {
          percentage: 25,
          stickinessProperty: 'userId',
          salt: 'dash_salt_2026',
        },
        canaryStage: 'beta_25',
        lifecycle: 'canary',
        tags: ['frontend', 'ui', 'canary'],
        createdAt: '2026-01-10T10:00:00.000Z',
        updatedAt: '2026-01-15T14:30:00.000Z',
      },
      'ai-copilot-engine': {
        key: 'ai-copilot-engine',
        name: 'AI Copilot Engine',
        description: 'Multi-model inference assistant and autocomplete',
        type: 'string',
        enabled: true,
        defaultValue: 'disabled',
        defaultVariant: 'disabled',
        variants: {
          disabled: 'disabled',
          fast: 'gemini-flash',
          pro: 'claude-3-7-sonnet',
        },
        rules: [
          {
            id: 'pro-users',
            description: 'Assign pro tier to Claude Sonnet',
            conditions: [{ property: 'tier', operator: 'equals', value: 'enterprise' }],
            serve: { variant: 'pro' },
          },
        ],
        rollout: {
          percentage: 100,
          variants: [
            { variant: 'fast', weight: 70 },
            { variant: 'pro', weight: 30 },
          ],
        },
        canaryStage: 'ga_100',
        lifecycle: 'active',
        tags: ['ai', 'inference', 'backend'],
        createdAt: '2026-02-01T09:00:00.000Z',
        updatedAt: '2026-02-10T11:00:00.000Z',
      },
      'legacy-auth-redirect': {
        key: 'legacy-auth-redirect',
        name: 'Legacy Auth Redirect',
        description: 'Old SSO callback endpoint used during OAuth migration',
        type: 'boolean',
        enabled: false,
        defaultValue: false,
        defaultVariant: 'off',
        variants: {
          on: true,
          off: false,
        },
        rules: [],
        lifecycle: 'dead',
        tags: ['auth', 'deprecated'],
        staleSince: '2025-11-20T00:00:00.000Z',
        createdAt: '2025-08-01T12:00:00.000Z',
        updatedAt: '2025-11-20T00:00:00.000Z',
      },
      'max-upload-size-mb': {
        key: 'max-upload-size-mb',
        name: 'Max Upload Size (MB)',
        description: 'Dynamic file upload limit per tier',
        type: 'number',
        enabled: true,
        defaultValue: 25,
        defaultVariant: 'standard',
        variants: {
          standard: 25,
          boosted: 100,
          enterprise: 500,
        },
        rules: [
          {
            id: 'enterprise-limit',
            description: 'Enterprise accounts get 500MB',
            conditions: [{ property: 'tier', operator: 'equals', value: 'enterprise' }],
            serve: { variant: 'enterprise' },
          },
          {
            id: 'pro-limit',
            description: 'Pro tier gets 100MB',
            conditions: [{ property: 'tier', operator: 'equals', value: 'pro' }],
            serve: { variant: 'boosted' },
          },
        ],
        canaryStage: 'ga_100',
        lifecycle: 'active',
        tags: ['storage', 'billing'],
        createdAt: '2026-01-05T08:00:00.000Z',
        updatedAt: '2026-01-05T08:00:00.000Z',
      },
    };

    return {
      version: '1.0.0',
      flags: sampleFlags,
      metadata: {
        environment: 'local-development',
        description: 'FlagForge local zero-cloud feature flags',
        updatedAt: new Date().toISOString(),
      },
    };
  }
}
