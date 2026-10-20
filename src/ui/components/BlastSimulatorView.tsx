import React, { useState, useEffect } from 'react';
import { FeatureFlag } from '../../core/types.js';
import { SimulationResult } from '../../simulator/blast-simulator.js';
import { Activity, Users, Zap, CheckCircle2, AlertTriangle, BarChart3, Globe, Shield } from 'lucide-react';

interface BlastSimulatorViewProps {
  flags: FeatureFlag[];
  initialFlagKey?: string;
}

export const BlastSimulatorView: React.FC<BlastSimulatorViewProps> = ({
  flags,
  initialFlagKey,
}) => {
  const [selectedFlagKey, setSelectedFlagKey] = useState<string>(
    initialFlagKey || (flags[0]?.key ?? '')
  );
  const [cohortSize, setCohortSize] = useState<number>(5000);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async () => {
    if (!selectedFlagKey) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/v1/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flagKey: selectedFlagKey,
          cohortSize,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Simulation failed');
      }

      const data = (await res.json()) as SimulationResult;
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedFlagKey) {
      runSimulation();
    }
  }, [selectedFlagKey]);

  const selectedFlag = flags.find((f) => f.key === selectedFlagKey);

  return (
    <div className="space-y-6">
      {/* Simulation Configuration Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Select Feature Flag:
            </label>
            <select
              value={selectedFlagKey}
              onChange={(e) => setSelectedFlagKey(e.target.value)}
              className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-medium text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              {flags.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.name} ({f.key})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
              Simulated Cohort Size:
            </label>
            <select
              value={cohortSize}
              onChange={(e) => setCohortSize(parseInt(e.target.value, 10))}
              className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="1000">1,000 synthetic profiles</option>
              <option value="5000">5,000 synthetic profiles</option>
              <option value="10000">10,000 synthetic profiles</option>
              <option value="25000">25,000 synthetic profiles</option>
              <option value="50000">50,000 synthetic profiles</option>
            </select>
          </div>
        </div>

        <button
          onClick={runSimulation}
          disabled={loading}
          className="self-end sm:self-auto inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 shadow-sm"
        >
          <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Evaluating Cohort...' : 'Re-Run Blast Simulation'}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-6">
          {/* Top Key Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Blast Radius Card */}
            <div className="p-5 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Blast Radius</span>
                <Users className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-extrabold text-zinc-100 font-mono">
                  {result.blastRadiusPercentage}%
                </span>
                <span className="text-xs text-zinc-400">of total cohort</span>
              </div>
              <div className="text-xs text-zinc-500 font-mono">
                {result.affectedCount.toLocaleString()} / {result.totalEvaluated.toLocaleString()} users affected
              </div>
            </div>

            {/* Chi-Square Uniformity Card */}
            <div className="p-5 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Uniformity Score</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-extrabold text-emerald-400 font-mono">
                  {result.chiSquare.uniformityScore}%
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  {result.chiSquare.rating}
                </span>
              </div>
              <div className="text-xs text-zinc-500 font-mono">
                χ² = {result.chiSquare.statistic} (df={result.chiSquare.degreesOfFreedom})
              </div>
            </div>

            {/* Execution Latency Card */}
            <div className="p-5 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Simulation Latency</span>
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex items-baseline space-x-2">
                <span className="text-3xl font-extrabold text-amber-400 font-mono">
                  {result.durationMs}ms
                </span>
              </div>
              <div className="text-xs text-zinc-500 font-mono">
                {Math.round((result.totalEvaluated / (result.durationMs || 1)) * 1000).toLocaleString()} evals/sec
              </div>
            </div>

            {/* Rule Matches vs Splits */}
            <div className="p-5 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span>Resolution Reasons</span>
                <BarChart3 className="w-4 h-4 text-purple-400" />
              </div>
              <div className="space-y-1 text-xs">
                {Object.entries(result.reasons).map(([reason, count]) => (
                  <div key={reason} className="flex justify-between font-mono">
                    <span className="text-zinc-400">{reason}:</span>
                    <span className="text-zinc-200 font-semibold">{count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Distribution Curve / Histogram */}
          <div className="p-6 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-200">
                  Deterministic MurmurHash3 Distribution Curve
                </h3>
                <p className="text-xs text-zinc-500">
                  Bucketing density across 20 discrete 5% percentile bands
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-400">
                Expected per bin: ~{(result.totalEvaluated / 20).toFixed(0)}
              </span>
            </div>

            {/* Visual Bar Histogram */}
            <div className="h-44 flex items-end gap-1.5 pt-6 pb-2 border-b border-zinc-800">
              {result.histogram.map((bin) => {
                const maxCount = Math.max(...result.histogram.map((b) => b.count), 1);
                const heightPercent = Math.max(8, (bin.count / maxCount) * 100);

                return (
                  <div key={bin.bin} className="flex-1 flex flex-col items-center group relative">
                    <div
                      className="w-full bg-indigo-500/60 hover:bg-indigo-400 rounded-t transition-all group-hover:scale-y-105 origin-bottom"
                      style={{ height: `${heightPercent}%` }}
                    />

                    {/* Tooltip */}
                    <div className="absolute -top-10 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
                      <div className="bg-zinc-950 text-white text-[10px] font-mono px-2 py-1 rounded border border-zinc-800 shadow-xl whitespace-nowrap">
                        {bin.bin}: {bin.count} users ({bin.percentage}%)
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between text-[10px] font-mono text-zinc-500">
              <span>0% (First Bucket)</span>
              <span>50% (Median)</span>
              <span>100% (Last Bucket)</span>
            </div>
          </div>

          {/* Cohort Segments Breakdown Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Tier Impact */}
            <div className="p-5 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-zinc-200">
                <Shield className="w-4 h-4 text-indigo-400" />
                <span>Subscription Tier Impact</span>
              </div>
              <div className="space-y-2">
                {result.tierBreakdown.map((t) => (
                  <div key={t.segment} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="capitalize text-zinc-300">{t.segment}</span>
                      <span className="text-zinc-400 font-semibold">
                        {t.affectedPercentage}% ({t.affected}/{t.total})
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${t.affectedPercentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Country Impact */}
            <div className="p-5 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-zinc-200">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>Geographic Distribution</span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {result.countryBreakdown.map((c) => (
                  <div key={c.segment} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-zinc-300">{c.segment}</span>
                      <span className="text-zinc-400 font-semibold">
                        {c.affectedPercentage}% ({c.affected}/{c.total})
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${c.affectedPercentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Device Impact */}
            <div className="p-5 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-bold text-zinc-200">
                <Activity className="w-4 h-4 text-purple-400" />
                <span>Device Platform Impact</span>
              </div>
              <div className="space-y-2">
                {result.deviceBreakdown.map((d) => (
                  <div key={d.segment} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="capitalize text-zinc-300">{d.segment}</span>
                      <span className="text-zinc-400 font-semibold">
                        {d.affectedPercentage}% ({d.affected}/{d.total})
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${d.affectedPercentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
