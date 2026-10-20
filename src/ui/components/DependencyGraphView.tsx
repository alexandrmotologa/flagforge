import React, { useState, useEffect } from 'react';
import { GitFork, AlertTriangle, ShieldCheck, ArrowRight, Layers, RefreshCw } from 'lucide-react';
import { DependencyGraph, DependencyNode } from '../../core/engine.js';

export const DependencyGraphView: React.FC = () => {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);

  const fetchGraph = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/graph');
      if (res.ok) {
        const data = (await res.json()) as DependencyGraph;
        setGraph(data);
        if (data.nodes.length > 0 && !selectedNodeKey) {
          setSelectedNodeKey(data.nodes[0].key);
        }
      }
    } catch (err) {
      console.error('Failed to load dependency graph:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, []);

  const selectedNode = graph?.nodes.find((n) => n.key === selectedNodeKey);

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between bg-zinc-900/60 p-4 rounded-xl border border-zinc-800">
        <div className="flex items-center space-x-2">
          <GitFork className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Flag Dependency Graph & DAG Inspector</h3>
            <p className="text-xs text-zinc-400">
              Inspect prerequisite hierarchies, blocking conditions, and cycle hazards
            </p>
          </div>
        </div>

        <button
          onClick={fetchGraph}
          disabled={loading}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Graph</span>
        </button>
      </div>

      {graph?.hasCycles && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <span className="font-bold block">Circular Dependency Warning Detected!</span>
            <span>Cycle Path: {graph.cycleKeys?.join(' → ')}</span>
          </div>
        </div>
      )}

      {/* Visual DAG Nodes Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Interactive Graph Map */}
        <div className="lg:col-span-2 p-6 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Registered Flags & Prerequisite Links ({graph?.nodes.length || 0})
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {graph?.nodes.map((node) => {
              const isSelected = node.key === selectedNodeKey;
              const hasPrereqs = node.prerequisites.length > 0;
              const hasDependents = node.dependents.length > 0;

              return (
                <div
                  key={node.key}
                  onClick={() => setSelectedNodeKey(node.key)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-indigo-950/30 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/40'
                      : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold font-mono text-zinc-200">{node.key}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        node.enabled ? 'bg-emerald-400' : 'bg-zinc-600'
                      }`}
                    />
                  </div>

                  <p className="text-xs text-zinc-400 truncate mb-3">{node.name}</p>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500 border-t border-zinc-900 pt-2 font-mono">
                    <span>
                      {hasPrereqs ? (
                        <span className="text-amber-400">
                          Requires: {node.prerequisites.length}
                        </span>
                      ) : (
                        <span>Root node</span>
                      )}
                    </span>
                    <span>
                      {hasDependents ? (
                        <span className="text-indigo-400">
                          Blocks: {node.dependents.length}
                        </span>
                      ) : (
                        <span>Leaf node</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Node Inspector */}
        <div className="p-6 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Node Details & Evaluation Lineage
          </h4>

          {selectedNode ? (
            <div className="space-y-4">
              <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 space-y-1">
                <span className="text-[11px] font-mono text-zinc-500 block">Flag Key</span>
                <span className="text-sm font-bold font-mono text-indigo-400">
                  {selectedNode.key}
                </span>
                <span className="text-xs text-zinc-300 block">{selectedNode.name}</span>
              </div>

              {/* Prerequisites (Upstream) */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-zinc-300 block">
                  Upstream Prerequisites (Must Pass First):
                </span>
                {selectedNode.prerequisites.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic bg-zinc-950 p-2.5 rounded border border-zinc-900">
                    No prerequisites. Evaluates independently.
                  </p>
                ) : (
                  selectedNode.prerequisites.map((p) => (
                    <div
                      key={p}
                      onClick={() => setSelectedNodeKey(p)}
                      className="p-2.5 bg-zinc-950 hover:bg-zinc-900 rounded border border-zinc-800 cursor-pointer flex items-center justify-between text-xs font-mono text-amber-300 transition-colors"
                    >
                      <span>← {p}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                    </div>
                  ))
                )}
              </div>

              {/* Dependents (Downstream) */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-zinc-300 block">
                  Downstream Dependents (Blocked by this flag):
                </span>
                {selectedNode.dependents.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic bg-zinc-950 p-2.5 rounded border border-zinc-900">
                    No other flags depend on this flag.
                  </p>
                ) : (
                  selectedNode.dependents.map((d) => (
                    <div
                      key={d}
                      onClick={() => setSelectedNodeKey(d)}
                      className="p-2.5 bg-zinc-950 hover:bg-zinc-900 rounded border border-zinc-800 cursor-pointer flex items-center justify-between text-xs font-mono text-indigo-300 transition-colors"
                    >
                      <span>→ {d}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-500">Select a node from the map to inspect lineage.</p>
          )}
        </div>
      </div>
    </div>
  );
};
