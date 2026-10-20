import React from 'react';
import {
  Flag,
  Activity,
  Sliders,
  ShieldAlert,
  Terminal,
  History,
  Plus,
  GitFork,
  Globe,
} from 'lucide-react';

export type TabType = 'flags' | 'simulator' | 'graph' | 'scanner' | 'playground' | 'audit';

interface HeaderProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  connected: boolean;
  flagsCount: number;
  environment: string;
  setEnvironment: (env: string) => void;
  onNewFlag: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  connected,
  flagsCount,
  environment,
  setEnvironment,
  onNewFlag,
}) => {
  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Product Title */}
          <div className="flex items-center space-x-6">
            <div
              className="flex items-center space-x-3 cursor-pointer"
              onClick={() => setActiveTab('flags')}
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shadow-inner">
                <Flag className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-bold tracking-tight text-zinc-100 text-lg">FLAGFORGE</span>
                  <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                    CNCF OpenFeature
                  </span>
                </div>
                <p className="text-xs text-zinc-400 hidden sm:block">Zero-Cloud Local Daemon :4900</p>
              </div>
            </div>

            {/* Status pills */}
            <div className="hidden md:flex items-center space-x-2 pl-4 border-l border-zinc-800">
              <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300">
                <span
                  className={`w-2 h-2 rounded-full ${
                    connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
                <span>{connected ? 'SSE Live' : 'Reconnecting'}</span>
              </div>

              {/* Environment Switcher */}
              <div className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
                <Globe className="w-3.5 h-3.5 text-zinc-400" />
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-indigo-400 focus:outline-none cursor-pointer"
                >
                  <option value="local">Env: local</option>
                  <option value="staging">Env: staging</option>
                  <option value="production">Env: production</option>
                </select>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden lg:flex items-center space-x-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/80">
            <button
              onClick={() => setActiveTab('flags')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'flags'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Studio</span>
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'simulator'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Blast Simulator</span>
            </button>

            <button
              onClick={() => setActiveTab('graph')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'graph'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Dependency Graph</span>
            </button>

            <button
              onClick={() => setActiveTab('scanner')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'scanner'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>AST Scanner</span>
            </button>

            <button
              onClick={() => setActiveTab('playground')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'playground'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Playground & SDKs</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'audit'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit</span>
            </button>
          </nav>

          {/* Action button */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onNewFlag}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Flag</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Tabs */}
        <div className="lg:hidden flex items-center space-x-1 pb-3 overflow-x-auto">
          <button
            onClick={() => setActiveTab('flags')}
            className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap ${
              activeTab === 'flags' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'
            }`}
          >
            Studio
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap ${
              activeTab === 'simulator' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'
            }`}
          >
            Simulator
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap ${
              activeTab === 'graph' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'
            }`}
          >
            DAG Graph
          </button>
          <button
            onClick={() => setActiveTab('scanner')}
            className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap ${
              activeTab === 'scanner' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'
            }`}
          >
            AST Scanner
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap ${
              activeTab === 'playground' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'
            }`}
          >
            SDKs
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap ${
              activeTab === 'audit' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'
            }`}
          >
            Audit
          </button>
        </div>
      </div>
    </header>
  );
};
