import React, { useState } from 'react';
import { ScannerSummary, FlagScanReport, CodeReference } from '../../scanner/ast-scanner.js';
import { CodemodResult, BulkCodemodResult } from '../../scanner/codemod.js';
import {
  ShieldAlert,
  FolderSearch,
  FileCode,
  Wrench,
  CheckCircle,
  GitBranch,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const DeadScannerView: React.FC = () => {
  const [directory, setDirectory] = useState('.');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ScannerSummary | null>(null);
  const [selectedReport, setSelectedReport] = useState<FlagScanReport | null>(null);
  const [codemodResult, setCodemodResult] = useState<CodemodResult | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkCodemodResult | null>(null);
  const [codemodLoading, setCodemodLoading] = useState(false);
  const [appliedSuccess, setAppliedSuccess] = useState(false);
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);
  const [gitBranchInput, setGitBranchInput] = useState('');

  const handleScan = async () => {
    setLoading(true);
    setSelectedReport(null);
    setCodemodResult(null);
    setBulkResult(null);

    try {
      const res = await fetch('/api/v1/scanner/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory }),
      });

      if (res.ok) {
        const data = (await res.json()) as ScannerSummary;
        setSummary(data);
      }
    } catch (err) {
      console.error('Scan error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewCodemod = async (
    ref: CodeReference,
    report: FlagScanReport,
    resolvedVal: boolean
  ) => {
    setSelectedReport(report);
    setCodemodLoading(true);
    setAppliedSuccess(false);

    try {
      const res = await fetch('/api/v1/scanner/codemod', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath: ref.filePath,
          flagKey: report.flagKey,
          resolvedValue: resolvedVal,
          dryRun: true,
          backup: true,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCodemodResult(data.result);
      }
    } catch (err) {
      console.error('Codemod preview error:', err);
    } finally {
      setCodemodLoading(false);
    }
  };

  const handleBulkCodemod = async (report: FlagScanReport, resolvedVal: boolean) => {
    setCodemodLoading(true);
    setAppliedSuccess(false);

    try {
      const res = await fetch('/api/v1/scanner/codemod-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directory,
          flagKey: report.flagKey,
          resolvedValue: resolvedVal,
          dryRun: false,
          gitBranch: gitBranchInput || report.flagKey,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setBulkResult(data.result);
        setAppliedSuccess(true);
        handleScan();
      }
    } catch (err) {
      console.error('Bulk codemod error:', err);
    } finally {
      setCodemodLoading(false);
    }
  };

  const deadCount = summary?.reports.filter((r) => r.status === 'DEAD').length || 0;
  const staleCount = summary?.reports.filter((r) => r.status === 'STALE').length || 0;
  const orphanedCount = summary?.reports.filter((r) => r.status === 'ORPHANED').length || 0;

  return (
    <div className="space-y-6">
      {/* Scanner Control Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div className="flex-1 flex items-center space-x-3">
          <FolderSearch className="w-5 h-5 text-zinc-400" />
          <div className="flex-1 max-w-lg">
            <input
              type="text"
              placeholder="Codebase directory path (default: .)"
              value={directory}
              onChange={(e) => setDirectory(e.target.value)}
              className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <button
          onClick={handleScan}
          disabled={loading}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50 whitespace-nowrap flex-shrink-0 select-none shadow-sm"
        >
          <ShieldAlert className={`w-4 h-4 flex-shrink-0 ${loading ? 'animate-spin' : ''}`} />
          <span className="whitespace-nowrap">{loading ? 'Analyzing AST...' : 'Scan Codebase AST'}</span>
        </button>
      </div>

      {summary && (
        <div className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 bg-zinc-900/40 rounded-xl border border-zinc-800">
              <span className="text-xs text-zinc-400 block mb-1">Scanned Files</span>
              <span className="text-2xl font-bold font-mono text-zinc-100">
                {summary.scannedFiles}
              </span>
              <span className="text-[10px] text-zinc-500 block mt-1">in {summary.scanDurationMs}ms</span>
            </div>

            <div className="p-4 bg-zinc-900/40 rounded-xl border border-rose-900/30 bg-rose-950/10">
              <span className="text-xs text-rose-400 block mb-1">Dead Flags Found</span>
              <span className="text-2xl font-bold font-mono text-rose-400">{deadCount}</span>
              <span className="text-[10px] text-rose-500/80 block mt-1">Disabled or archived</span>
            </div>

            <div className="p-4 bg-zinc-900/40 rounded-xl border border-amber-900/30 bg-amber-950/10">
              <span className="text-xs text-amber-400 block mb-1">Stale Flags (100% Rollout)</span>
              <span className="text-2xl font-bold font-mono text-amber-400">{staleCount}</span>
              <span className="text-[10px] text-amber-500/80 block mt-1">Ready for codemod unrolling</span>
            </div>

            <div className="p-4 bg-zinc-900/40 rounded-xl border border-purple-900/30 bg-purple-950/10">
              <span className="text-xs text-purple-400 block mb-1">Orphaned References</span>
              <span className="text-2xl font-bold font-mono text-purple-400">{orphanedCount}</span>
              <span className="text-[10px] text-purple-500/80 block mt-1">In code but missing in YAML</span>
            </div>
          </div>

          {/* Discovered Flags List */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              Flag Audit Results ({summary.reports.length})
            </h3>

            {summary.reports.map((report) => {
              const isExpanded = expandedFlag === report.flagKey;
              return (
                <div
                  key={report.flagKey}
                  className="bg-zinc-900/40 rounded-xl border border-zinc-800 overflow-hidden"
                >
                  <div
                    onClick={() => setExpandedFlag(isExpanded ? null : report.flagKey)}
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-zinc-800/30 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${
                          report.status === 'DEAD'
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            : report.status === 'STALE'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : report.status === 'ORPHANED'
                            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {report.status}
                      </span>
                      <span className="font-mono text-xs font-semibold text-zinc-200">
                        {report.flagKey}
                      </span>
                      <span className="text-xs text-zinc-500">
                        ({report.referenceCount} {report.referenceCount === 1 ? 'call' : 'calls'})
                      </span>
                    </div>

                    <div className="flex items-center space-x-4">
                      <span className="text-xs text-zinc-400 hidden md:inline">
                        {report.recommendation}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-500" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/40 space-y-4">
                      {/* Bulk Codemod Action Bar */}
                      <div className="p-3 bg-zinc-900/80 rounded-lg border border-indigo-500/30 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center space-x-2">
                          <GitBranch className="w-4 h-4 text-indigo-400" />
                          <span className="text-xs font-semibold text-zinc-200">
                            Bulk Project Codemod:
                          </span>
                          <input
                            type="text"
                            placeholder="Git branch (e.g. cleanup/dead-flag)"
                            value={gitBranchInput}
                            onChange={(e) => setGitBranchInput(e.target.value)}
                            className="px-2 py-1 bg-zinc-950 border border-zinc-800 rounded font-mono text-[11px] text-zinc-200 w-48"
                          />
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleBulkCodemod(report, true)}
                            disabled={codemodLoading}
                            className="px-3 py-1 rounded text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
                          >
                            Unroll All → True
                          </button>
                          <button
                            onClick={() => handleBulkCodemod(report, false)}
                            disabled={codemodLoading}
                            className="px-3 py-1 rounded text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
                          >
                            Unroll All → False
                          </button>
                        </div>
                      </div>

                      {/* Individual File Sites */}
                      <div className="space-y-2">
                        {report.references.map((ref, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800 space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 text-xs font-mono text-indigo-400">
                                <FileCode className="w-3.5 h-3.5" />
                                <span>
                                  {ref.relativeFilePath}:{ref.line}:{ref.column}
                                </span>
                              </div>

                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handlePreviewCodemod(ref, report, true)}
                                  className="px-2 py-0.5 rounded text-[11px] bg-emerald-600/20 text-emerald-300 border border-emerald-500/30"
                                >
                                  Diff True
                                </button>
                                <button
                                  onClick={() => handlePreviewCodemod(ref, report, false)}
                                  className="px-2 py-0.5 rounded text-[11px] bg-rose-600/20 text-rose-300 border border-rose-500/30"
                                >
                                  Diff False
                                </button>
                              </div>
                            </div>

                            <pre className="p-2 bg-zinc-950 rounded text-[11px] font-mono text-zinc-300 overflow-x-auto">
                              {ref.snippet}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bulk Codemod Success Notification */}
          {bulkResult && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs space-y-1">
              <span className="font-bold block">
                Bulk Codemod Completed: {bulkResult.totalFilesModified} files modified (
                {bulkResult.totalTransforms} AST nodes unrolled).
              </span>
              {bulkResult.branchCreated && (
                <span>
                  Git branch created and committed: <code>{bulkResult.branchCreated}</code>
                </span>
              )}
            </div>
          )}

          {/* Single Codemod Diff Preview */}
          {codemodResult && (
            <div className="p-6 bg-zinc-900/90 rounded-xl border border-indigo-500/40 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Wrench className="w-5 h-5 text-indigo-400" />
                  <span className="text-sm font-bold text-zinc-100">
                    Diff Preview: {codemodResult.relativeFilePath}
                  </span>
                </div>
                <button
                  onClick={() => setCodemodResult(null)}
                  className="text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Close
                </button>
              </div>

              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 text-xs font-mono max-h-72 overflow-y-auto">
                {codemodResult.diff.split('\n').map((line, idx) => {
                  const isAdd = line.startsWith('+') && !line.startsWith('+++');
                  const isDel = line.startsWith('-') && !line.startsWith('---');
                  const isHdr = line.startsWith('@@') || line.startsWith('Index:');
                  return (
                    <div
                      key={idx}
                      className={`${
                        isAdd
                          ? 'bg-emerald-950/40 text-emerald-300'
                          : isDel
                          ? 'bg-rose-950/40 text-rose-300'
                          : isHdr
                          ? 'text-cyan-400'
                          : 'text-zinc-400'
                      } px-2 py-0.5 whitespace-pre`}
                    >
                      {line}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
