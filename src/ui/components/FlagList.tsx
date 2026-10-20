import React, { useState } from 'react';
import { FlagWithMetrics } from '../hooks/useFlags.js';
import {
  Copy,
  Check,
  Edit2,
  Trash2,
  Activity,
  ChevronRight,
  Search,
  Filter,
  Layers,
  ShieldAlert,
  GitFork,
  Bug,
  RotateCcw,
} from 'lucide-react';
import { CanaryStage, FeatureFlag } from '../../core/types.js';

interface FlagListProps {
  flags: FlagWithMetrics[];
  onToggle: (key: string) => void;
  onAdvanceStage: (key: string) => void;
  onEdit: (flag: FeatureFlag) => void;
  onDelete: (key: string) => void;
  onSimulate: (flagKey: string) => void;
  onRefresh?: () => void;
}

export const FlagList: React.FC<FlagListProps> = ({
  flags,
  onToggle,
  onAdvanceStage,
  onEdit,
  onDelete,
  onSimulate,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'canary' | 'active' | 'dead'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleSimulateError = async (flagKey: string) => {
    try {
      await fetch(`/api/v1/flags/${flagKey}/report-error`, { method: 'POST' });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to report error:', err);
    }
  };

  const filteredFlags = flags.filter((f) => {
    const matchesSearch =
      f.key.toLowerCase().includes(search.toLowerCase()) ||
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      (f.tags && f.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));

    if (!matchesSearch) return false;
    if (statusFilter === 'all') return true;
    return f.lifecycle === statusFilter;
  });

  const getStagePercentage = (stage?: CanaryStage, rolloutPct?: number): number => {
    if (rolloutPct !== undefined) return rolloutPct;
    switch (stage) {
      case 'internal': return 0;
      case 'canary_5': return 5;
      case 'beta_25': return 25;
      case 'staged_50': return 50;
      case 'ga_100': return 100;
      default: return 0;
    }
  };

  return (
    <div className="space-y-6">
      {/* Controls: Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search feature flags by key, name, or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/80 transition-colors"
          />
        </div>

        <div className="flex items-center space-x-1.5 self-center sm:self-auto">
          <Filter className="w-3.5 h-3.5 text-zinc-500 mr-1" />
          {(['all', 'canary', 'active', 'dead'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                statusFilter === filter
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Flag Cards Grid */}
      {filteredFlags.length === 0 ? (
        <div className="text-center py-16 bg-zinc-900/20 rounded-2xl border border-zinc-800/60">
          <Layers className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-zinc-300">No feature flags match your filters</p>
          <p className="text-xs text-zinc-500 mt-1">Try refining your search terms or create a new flag.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredFlags.map((flag) => {
            const pct = getStagePercentage(flag.canaryStage, flag.rollout?.percentage);
            const isKillswitchDisabled = !flag.enabled;
            const hasPrereqs = flag.prerequisites && flag.prerequisites.length > 0;
            const breaker = (flag as any).breakerStatus;

            return (
              <div
                key={flag.key}
                className={`group rounded-xl border p-5 transition-all ${
                  isKillswitchDisabled
                    ? 'bg-zinc-950/60 border-zinc-900 opacity-75'
                    : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700/80'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Status Toggle & Info */}
                  <div className="flex items-start space-x-4">
                    {/* Emergency Killswitch Toggle Button */}
                    <button
                      onClick={() => onToggle(flag.key)}
                      title={flag.enabled ? 'Click to disable flag (Killswitch)' : 'Click to enable flag'}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none mt-1 ${
                        flag.enabled ? 'bg-indigo-600' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          flag.enabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-zinc-100 text-sm">{flag.name}</span>
                        <div
                          onClick={() => handleCopy(flag.key)}
                          className="flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 cursor-pointer hover:border-zinc-700 transition-colors"
                        >
                          <span>{flag.key}</span>
                          {copiedKey === flag.key ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 text-zinc-500" />
                          )}
                        </div>

                        {/* Type badge */}
                        <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono font-semibold tracking-wider bg-zinc-800/70 text-zinc-400 border border-zinc-700/40">
                          {flag.type}
                        </span>

                        {/* Lifecycle badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold tracking-wider border ${
                            flag.lifecycle === 'canary'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : flag.lifecycle === 'dead'
                              ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {flag.lifecycle}
                        </span>

                        {/* Prerequisite Pill */}
                        {hasPrereqs && (
                          <span className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/40 text-purple-300 border border-purple-800/50">
                            <GitFork className="w-3 h-3 text-purple-400" />
                            <span>Requires: {flag.prerequisites!.map((p) => p.flagKey).join(', ')}</span>
                          </span>
                        )}

                        {/* Circuit Breaker Status Pill */}
                        {breaker && breaker.state !== 'HEALTHY' && (
                          <span
                            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider border ${
                              breaker.state === 'TRIPPED'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            }`}
                          >
                            <ShieldAlert className="w-3 h-3" />
                            <span>
                              {breaker.state} ({breaker.errorRatePercent}% err)
                            </span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-400 line-clamp-1">{flag.description}</p>

                      {/* Rules & Tags summary */}
                      <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-zinc-500">
                        <span>
                          {flag.rules?.length || 0} targeting{' '}
                          {flag.rules?.length === 1 ? 'rule' : 'rules'}
                        </span>
                        <span>•</span>
                        <span>
                          {flag.metrics?.totalEvaluations
                            ? `${flag.metrics.totalEvaluations.toLocaleString()} evaluations`
                            : '0 evals logged'}
                        </span>
                        {flag.tags && flag.tags.length > 0 && (
                          <>
                            <span>•</span>
                            <div className="flex items-center space-x-1">
                              {flag.tags.map((t) => (
                                <span
                                  key={t}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-mono"
                                >
                                  #{t}
                                </span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Rollout Progress & Action Buttons */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 pl-12 lg:pl-0">
                    {/* Canary Progress Bar */}
                    <div className="w-full sm:w-48 space-y-1.5">
                      <div className="flex justify-between text-[11px] font-mono">
                        <span className="text-zinc-400">Rollout:</span>
                        <span className="font-semibold text-zinc-200">{pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-zinc-500 capitalize">
                        <span>{flag.canaryStage ? flag.canaryStage.replace('_', ' ') : 'default'}</span>
                        {pct < 100 && (
                          <button
                            onClick={() => onAdvanceStage(flag.key)}
                            className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center space-x-0.5"
                          >
                            <span>Advance</span>
                            <ChevronRight className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleSimulateError(flag.key)}
                        title="Simulate Error Report (Test Sentinel Circuit Breaker)"
                        className="p-2 rounded-lg bg-zinc-800/80 hover:bg-rose-950/40 text-zinc-400 hover:text-rose-400 border border-zinc-700/50 transition-colors"
                      >
                        <Bug className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onSimulate(flag.key)}
                        title="Simulate Blast-Radius on cohort"
                        className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/50 transition-colors"
                      >
                        <Activity className="w-4 h-4 text-amber-400" />
                      </button>

                      <button
                        onClick={() => onEdit(flag)}
                        title="Edit Flag, Prerequisites & Sentinel"
                        className="p-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/50 transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-zinc-300" />
                      </button>

                      <button
                        onClick={() => onDelete(flag.key)}
                        title="Delete Flag"
                        className="p-2 rounded-lg bg-zinc-800/80 hover:bg-rose-900/40 text-zinc-400 hover:text-rose-400 border border-zinc-700/50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
