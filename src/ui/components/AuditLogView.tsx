import React, { useState, useEffect } from 'react';
import { History, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import { AuditEntry } from '../../storage/sqlite-storage.js';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/audit');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.audit || []);
      }
    } catch (err) {
      console.error('Audit fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'UPDATE':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'TOGGLE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'ROLLOUT_ADVANCE':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
      case 'CODEMOD_APPLY':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      default:
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center space-x-2">
          <History className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Daemon Audit Trail & Metrics</h3>
            <p className="text-xs text-zinc-400">
              Persistent SQLite audit log of flag lifecycle events and mutations
            </p>
          </div>
        </div>

        <button
          onClick={fetchAudit}
          disabled={loading}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      <div className="bg-zinc-900/40 rounded-xl border border-zinc-800 overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 text-xs">
            No audit events recorded yet. Mutations to feature flags will be recorded here.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {logs.map((log) => {
              let parsedDetails: any = null;
              try {
                parsedDetails = JSON.parse(log.details);
              } catch {
                parsedDetails = log.details;
              }

              return (
                <div key={log.id} className="p-4 hover:bg-zinc-800/20 transition-colors space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider border font-mono ${getActionBadge(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                      <span className="font-mono text-xs font-bold text-zinc-200">
                        {log.flagKey}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 text-[11px] text-zinc-500 font-mono">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  </div>

                  {parsedDetails && (
                    <div className="pl-2 border-l-2 border-zinc-800 text-[11px] font-mono text-zinc-400">
                      {typeof parsedDetails === 'object'
                        ? JSON.stringify(parsedDetails)
                        : parsedDetails}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
