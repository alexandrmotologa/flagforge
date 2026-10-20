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
          <div className="flex items-center space-x-2 sm:space-x-6">
            <div
              className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer"
              onClick={() => setActiveTab('flags')}
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shadow-inner flex-shrink-0">
                <Flag className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
              </div>
              <div>
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <span className="font-bold tracking-tight text-zinc-100 text-base sm:text-lg">FLAGFORGE</span>
                  <span className="hidden sm:inline-block text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50">
                    CNCF OpenFeature
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 hidden sm:block">Zero-Cloud Local Daemon :4900</p>
              </div>
            </div>

            {/* Status pills & Environment Switcher - Accessible on all viewports */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 pl-2 sm:pl-4 border-l border-zinc-800">
              <div className="flex items-center space-x-1 sm:space-x-1.5 px-2 sm:px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300">
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
                <span className="hidden xs:inline sm:inline">{connected ? 'SSE Live' : 'Offline'}</span>
              </div>

              {/* Environment Switcher */}
              <div className="flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] sm:text-xs">
                <Globe className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="bg-transparent text-[11px] sm:text-xs font-semibold text-indigo-400 focus:outline-none cursor-pointer"
                >
                  <option value="local">local</option>
                  <option value="staging">staging</option>
                  <option value="production">prod</option>
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
        <div className="lg:hidden flex items-center space-x-1.5 pb-2.5 pt-1 overflow-x-auto no-scrollbar scroll-smooth">
          <button
            onClick={() => setActiveTab('flags')}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap flex items-center space-x-1.5 transition-all ${
              activeTab === 'flags' ? 'bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>Studio</span>
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap flex items-center space-x-1.5 transition-all ${
              activeTab === 'simulator' ? 'bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3 h-3" />
            <span>Simulator</span>
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap flex items-center space-x-1.5 transition-all ${
              activeTab === 'graph' ? 'bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GitFork className="w-3 h-3" />
            <span>DAG Graph</span>
          </button>
          <button
            onClick={() => setActiveTab('scanner')}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap flex items-center space-x-1.5 transition-all ${
              activeTab === 'scanner' ? 'bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            <span>AST Scanner</span>
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap flex items-center space-x-1.5 transition-all ${
              activeTab === 'playground' ? 'bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3 h-3" />
            <span>SDKs</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 text-xs rounded-lg whitespace-nowrap flex items-center space-x-1.5 transition-all ${
              activeTab === 'audit' ? 'bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-3 h-3" />
            <span>Audit</span>
          </button>
        </div>
      </div>
    </header>
  );
};
