import React, { useState } from 'react';
import { useFlags } from './hooks/useFlags.js';
import { Header, TabType } from './components/Header.js';
import { FlagList } from './components/FlagList.js';
import { FlagEditorModal } from './components/FlagEditorModal.js';
import { BlastSimulatorView } from './components/BlastSimulatorView.js';
import { DeadScannerView } from './components/DeadScannerView.js';
import { OpenFeaturePlayground } from './components/OpenFeaturePlayground.js';
import { AuditLogView } from './components/AuditLogView.js';
import { DependencyGraphView } from './components/DependencyGraphView.js';
import { FeatureFlag } from '../core/types.js';

export const App: React.FC = () => {
  const {
    flags,
    loading,
    connected,
    toggleFlag,
    advanceStage,
    saveFlag,
    deleteFlag,
    refresh,
  } = useFlags();

  const [activeTab, setActiveTab] = useState<TabType>('flags');
  const [environment, setEnvironment] = useState<string>('local');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [simulationTarget, setSimulationTarget] = useState<string | undefined>(undefined);

  const handleNewFlag = () => {
    setEditingFlag(null);
    setModalOpen(true);
  };

  const handleEditFlag = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setModalOpen(true);
  };

  const handleSimulate = (flagKey: string) => {
    setSimulationTarget(flagKey);
    setActiveTab('simulator');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connected={connected}
        flagsCount={flags.length}
        environment={environment}
        setEnvironment={setEnvironment}
        onNewFlag={handleNewFlag}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-32 space-x-3 text-zinc-400">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Connecting to FlagForge Daemon...</span>
          </div>
        ) : (
          <>
            {activeTab === 'flags' && (
              <FlagList
                flags={flags}
                onToggle={toggleFlag}
                onAdvanceStage={advanceStage}
                onEdit={handleEditFlag}
                onDelete={deleteFlag}
                onSimulate={handleSimulate}
                onRefresh={refresh}
              />
            )}

            {activeTab === 'simulator' && (
              <BlastSimulatorView flags={flags} initialFlagKey={simulationTarget} />
            )}

            {activeTab === 'graph' && <DependencyGraphView />}

            {activeTab === 'scanner' && <DeadScannerView />}

            {activeTab === 'playground' && <OpenFeaturePlayground flags={flags} />}

            {activeTab === 'audit' && <AuditLogView />}
          </>
        )}
      </main>

      <FlagEditorModal
        isOpen={modalOpen}
        flag={editingFlag}
        onClose={() => setModalOpen(false)}
        onSave={saveFlag}
      />

      <footer className="border-t border-zinc-850 bg-zinc-950 py-6 text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-zinc-400">FlagForge</span>
            <span>•</span>
            <span>CNCF OpenFeature Local Engine, Sentinel & Rollout Studio</span>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://openfeature.dev"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              OpenFeature Spec
            </a>
            <a
              href="https://github.com/alexandrmotologa/flagforge"
              target="_blank"
              rel="noreferrer"
              className="hover:text-zinc-300 transition-colors"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
