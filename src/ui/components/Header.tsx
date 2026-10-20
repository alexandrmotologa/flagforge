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
    <header className="border-b border-zinc-850 bg-zinc-950/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3 sm:gap-4">
          {/* Left: Logo, Product Title, Status and Environment */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 flex-shrink-0">
            <div
              className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer select-none"
              onClick={() => setActiveTab('flags')}
            >
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shadow-inner flex-shrink-0">
                <Flag className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
              </div>
              <div className="flex-shrink-0">
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <span className="font-bold tracking-tight text-zinc-100 text-base sm:text-lg whitespace-nowrap">
                    FLAGFORGE
                  </span>
                  <span className="hidden 2xl:inline-block text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-zinc-850 text-zinc-400 border border-zinc-700/50 whitespace-nowrap">
                    OpenFeature
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 hidden 2xl:block whitespace-nowrap">
                  Zero-Cloud Local Daemon :4900
                </p>
              </div>
            </div>

            {/* Status pill & Environment Selector */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 pl-2 sm:pl-3 border-l border-zinc-800 flex-shrink-0">
              <div
                title={connected ? 'Connected to FlagForge SSE stream' : 'Disconnected from FlagForge'}
                className="flex items-center space-x-1.5 px-2 py-1 rounded-full text-[11px] sm:text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-300 flex-shrink-0 whitespace-nowrap"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                  }`}
                />
                <span className="hidden xl:inline whitespace-nowrap">{connected ? 'SSE Live' : 'Offline'}</span>
              </div>

              {/* Environment Switcher */}
              <div className="flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] sm:text-xs flex-shrink-0">
                <Globe className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="bg-transparent text-[11px] sm:text-xs font-semibold text-indigo-400 focus:outline-none cursor-pointer whitespace-nowrap"
                >
                  <option value="local">local</option>
                  <option value="staging">staging</option>
                  <option value="production">prod</option>
                </select>
              </div>
            </div>
          </div>

          {/* Center: Navigation Tabs (Desktop lg+): Strict Single-Row with No-Wrap */}
          <nav className="hidden lg:flex items-center space-x-1 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 flex-shrink-0 shadow-inner">
            <button
              onClick={() => setActiveTab('flags')}
              className={`inline-flex items-center space-x-1.5 px-2.5 xl:px-3 py-1.5 h-8 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 select-none ${
                activeTab === 'flags'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
              <span className="whitespace-nowrap">Studio</span>
            </button>

            <button
              onClick={() => setActiveTab('simulator')}
              className={`inline-flex items-center space-x-1.5 px-2.5 xl:px-3 py-1.5 h-8 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 select-none ${
                activeTab === 'simulator'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
              <span className="whitespace-nowrap">
                <span className="hidden xl:inline">Blast </span>Simulator
              </span>
            </button>

            <button
              onClick={() => setActiveTab('graph')}
              className={`inline-flex items-center space-x-1.5 px-2.5 xl:px-3 py-1.5 h-8 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 select-none ${
                activeTab === 'graph'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
              }`}
            >
              <GitFork className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
              <span className="whitespace-nowrap">
                <span className="hidden xl:inline">DAG </span>Graph
              </span>
            </button>

            <button
              onClick={() => setActiveTab('scanner')}
              className={`inline-flex items-center space-x-1.5 px-2.5 xl:px-3 py-1.5 h-8 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 select-none ${
                activeTab === 'scanner'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
              <span className="whitespace-nowrap">
                <span className="hidden xl:inline">AST </span>Scanner
              </span>
            </button>

            <button
              onClick={() => setActiveTab('playground')}
              className={`inline-flex items-center space-x-1.5 px-2.5 xl:px-3 py-1.5 h-8 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 select-none ${
                activeTab === 'playground'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
              <span className="whitespace-nowrap">Playground</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`inline-flex items-center space-x-1.5 px-2.5 xl:px-3 py-1.5 h-8 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 select-none ${
                activeTab === 'audit'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-700/60 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/60'
              }`}
            >
              <History className="w-3.5 h-3.5 flex-shrink-0 text-zinc-400" />
              <span className="whitespace-nowrap">
                Audit<span className="hidden xl:inline"> Log</span>
              </span>
            </button>
          </nav>

          {/* Right: Action button - Strict Single-Row, Never Wraps */}
          <div className="flex items-center flex-shrink-0">
            <button
              onClick={onNewFlag}
              className="inline-flex items-center justify-center space-x-1.5 px-2.5 sm:px-3.5 h-8 sm:h-9 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white transition-all shadow-sm shadow-indigo-950/40 flex-shrink-0 whitespace-nowrap select-none"
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="whitespace-nowrap">
                <span className="hidden sm:inline">Create </span>Flag
              </span>
            </button>
          </div>
        </div>

        {/* Mobile / Tablet Sub-Navigation Tabs (< lg: 1024px): Smooth Horizontal Scroll */}
        <div className="lg:hidden flex items-center space-x-1.5 pb-2.5 pt-1 overflow-x-auto no-scrollbar scroll-smooth border-t border-zinc-900/60">
          <button
            onClick={() => setActiveTab('flags')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 h-7 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all select-none ${
              activeTab === 'flags'
                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sliders className="w-3 h-3 flex-shrink-0" />
            <span className="whitespace-nowrap">Studio</span>
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 h-7 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all select-none ${
              activeTab === 'simulator'
                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Activity className="w-3 h-3 flex-shrink-0" />
            <span className="whitespace-nowrap">Simulator</span>
          </button>
          <button
            onClick={() => setActiveTab('graph')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 h-7 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all select-none ${
              activeTab === 'graph'
                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GitFork className="w-3 h-3 flex-shrink-0" />
            <span className="whitespace-nowrap">DAG Graph</span>
          </button>
          <button
            onClick={() => setActiveTab('scanner')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 h-7 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all select-none ${
              activeTab === 'scanner'
                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldAlert className="w-3 h-3 flex-shrink-0" />
            <span className="whitespace-nowrap">AST Scanner</span>
          </button>
          <button
            onClick={() => setActiveTab('playground')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 h-7 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all select-none ${
              activeTab === 'playground'
                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Terminal className="w-3 h-3 flex-shrink-0" />
            <span className="whitespace-nowrap">Playground</span>
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`inline-flex items-center space-x-1.5 px-3 py-1.5 h-7 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all select-none ${
              activeTab === 'audit'
                ? 'bg-zinc-800 text-white font-semibold border border-zinc-700/60 shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="w-3 h-3 flex-shrink-0" />
            <span className="whitespace-nowrap">Audit</span>
          </button>
        </div>
      </div>
    </header>
  );
};
