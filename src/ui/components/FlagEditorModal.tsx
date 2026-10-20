import React, { useState } from 'react';
import {
  FeatureFlag,
  TargetingRule,
  RuleCondition,
  FlagValueType,
  FlagPrerequisite,
  CircuitBreakerConfig,
} from '../../core/types.js';
import { X, Plus, Trash2, GitFork, ShieldAlert, Clock, Globe } from 'lucide-react';

interface FlagEditorModalProps {
  flag: FeatureFlag | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (flag: FeatureFlag, isNew: boolean) => Promise<void>;
}

export const FlagEditorModal: React.FC<FlagEditorModalProps> = ({
  flag,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  const isNew = !flag;
  const [key, setKey] = useState(flag?.key || '');
  const [name, setName] = useState(flag?.name || '');
  const [description, setDescription] = useState(flag?.description || '');
  const [type, setType] = useState<FlagValueType>(flag?.type || 'boolean');
  const [enabled, setEnabled] = useState(flag ? flag.enabled : true);
  const [percentage, setPercentage] = useState(flag?.rollout?.percentage ?? 0);
  const [rules, setRules] = useState<TargetingRule[]>(flag?.rules || []);
  const [prerequisites, setPrerequisites] = useState<FlagPrerequisite[]>(
    flag?.prerequisites || []
  );

  // Circuit Breaker State
  const [breakerEnabled, setBreakerEnabled] = useState(flag?.circuitBreaker?.enabled ?? false);
  const [errorThreshold, setErrorThreshold] = useState(
    flag?.circuitBreaker?.errorThresholdPercent ?? 5
  );
  const [breakerAction, setBreakerAction] = useState<'killswitch' | 'rollback_stage'>(
    flag?.circuitBreaker?.action || 'killswitch'
  );

  // Scheduled Rollout State
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduleStage, setScheduleStage] = useState('ga_100');

  const [activeTab, setActiveTab] = useState<'general' | 'rules' | 'prereqs' | 'sentinel'>('general');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAddRule = () => {
    const newRule: TargetingRule = {
      id: `rule-${Date.now()}`,
      description: 'New targeting rule',
      conditions: [{ property: 'tier', operator: 'equals', value: 'enterprise' }],
      serve: { variant: 'on' },
    };
    setRules([...rules, newRule]);
  };

  const handleAddPrerequisite = () => {
    setPrerequisites([
      ...prerequisites,
      { flagKey: 'payment-v2', expectedVariant: 'on' },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !name.trim()) {
      setError('Key and Name are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const defaultVariant = type === 'boolean' ? 'off' : 'default';
      const variants =
        flag?.variants ||
        (type === 'boolean'
          ? { on: true, off: false }
          : { default: 'default', treatment: 'treatment' });

      const circuitBreaker: CircuitBreakerConfig | undefined = breakerEnabled
        ? {
            enabled: true,
            errorThresholdPercent: errorThreshold,
            minRequests: 5,
            windowSeconds: 60,
            action: breakerAction,
          }
        : undefined;

      const schedules = flag?.schedules || [];
      if (scheduleAt) {
        schedules.push({
          id: `sched-${Date.now()}`,
          at: new Date(scheduleAt).toISOString(),
          stage: scheduleStage as any,
          percentage: scheduleStage === 'ga_100' ? 100 : 50,
          applied: false,
        });
      }

      const updatedFlag: FeatureFlag = {
        key: key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
        name: name.trim(),
        description: description.trim(),
        type,
        enabled,
        defaultValue: flag?.defaultValue ?? (type === 'boolean' ? false : 'default'),
        defaultVariant,
        variants,
        rules,
        prerequisites: prerequisites.length > 0 ? prerequisites : undefined,
        circuitBreaker,
        schedules: schedules.length > 0 ? schedules : undefined,
        rollout: {
          percentage,
          stickinessProperty: 'userId',
        },
        canaryStage:
          percentage === 0
            ? 'internal'
            : percentage === 5
            ? 'canary_5'
            : percentage === 25
            ? 'beta_25'
            : percentage === 50
            ? 'staged_50'
            : percentage === 100
            ? 'ga_100'
            : 'custom',
        lifecycle: percentage === 100 ? 'active' : percentage > 0 ? 'canary' : 'active',
        tags: flag?.tags || ['feature'],
        createdAt: flag?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await onSave(updatedFlag, isNew);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div>
            <h2 className="text-base font-bold text-zinc-100">
              {isNew ? 'Create New Feature Flag' : `Edit Flag: ${flag.key}`}
            </h2>
            <p className="text-xs text-zinc-400">Configure OpenFeature rules, prerequisites & circuit breaker</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Subtabs */}
        <div className="flex space-x-1 px-6 pt-3 border-b border-zinc-800 bg-zinc-950/30">
          {(
            [
              { id: 'general', label: 'General & Rollout' },
              { id: 'rules', label: `Targeting Rules (${rules.length})` },
              { id: 'prereqs', label: `Prerequisites (${prerequisites.length})` },
              { id: 'sentinel', label: 'Sentinel Circuit Breaker' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Flag Key</label>
                  <input
                    type="text"
                    disabled={!isNew}
                    required
                    placeholder="e.g. checkout-v2"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Modern Checkout UI"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">Description</label>
                <input
                  type="text"
                  placeholder="What does this feature flag control?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Flag Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as FlagValueType)}
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="boolean">Boolean (true / false)</option>
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="object">JSON Object</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1.5">Killswitch State</label>
                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className={`w-full px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between ${
                      enabled
                        ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                        : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                    }`}
                  >
                    <span>{enabled ? 'Enabled' : 'Disabled (Killswitch Off)'}</span>
                    <span className={`w-2.5 h-2.5 rounded-full ${enabled ? 'bg-indigo-400' : 'bg-zinc-600'}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-zinc-300">Rollout Percentage:</span>
                  <span className="font-mono font-bold text-indigo-400 text-sm">{percentage}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={percentage}
                  onChange={(e) => setPercentage(parseInt(e.target.value, 10))}
                  className="w-full accent-indigo-500 bg-zinc-800 h-2 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {activeTab === 'rules' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-400">Targeting Rules</span>
                <button
                  type="button"
                  onClick={handleAddRule}
                  className="px-2.5 py-1 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  + Add Rule
                </button>
              </div>

              {rules.map((rule, idx) => (
                <div key={rule.id} className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-zinc-300">Rule #{idx + 1}</span>
                    <button
                      type="button"
                      onClick={() => setRules(rules.filter((r) => r.id !== rule.id))}
                      className="text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {rule.conditions.map((cond, cIdx) => (
                    <div key={cIdx} className="grid grid-cols-12 gap-2 text-xs">
                      <input
                        className="col-span-5 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-[11px] text-zinc-200"
                        value={cond.property}
                        onChange={(e) => {
                          const updated = [...rules];
                          updated[idx].conditions[cIdx].property = e.target.value;
                          setRules(updated);
                        }}
                      />
                      <select
                        className="col-span-3 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[11px] text-zinc-200"
                        value={cond.operator}
                        onChange={(e) => {
                          const updated = [...rules];
                          updated[idx].conditions[cIdx].operator = e.target.value as any;
                          setRules(updated);
                        }}
                      >
                        <option value="equals">equals</option>
                        <option value="in">in</option>
                        <option value="matches_regex">regex</option>
                        <option value="gt">&gt;</option>
                      </select>
                      <input
                        className="col-span-4 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[11px] text-zinc-200"
                        value={String(cond.value)}
                        onChange={(e) => {
                          const updated = [...rules];
                          updated[idx].conditions[cIdx].value = e.target.value;
                          setRules(updated);
                        }}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'prereqs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">Prerequisite Flags (DAG)</span>
                  <span className="text-[11px] text-zinc-500">
                    This flag will only evaluate if all prerequisite flags evaluate to their expected variants
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddPrerequisite}
                  className="px-2.5 py-1 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  + Add Prerequisite
                </button>
              </div>

              {prerequisites.length === 0 ? (
                <p className="text-xs text-zinc-500 italic bg-zinc-950 p-3 rounded-lg border border-zinc-800/40">
                  No prerequisites configured. Flag evaluates independently.
                </p>
              ) : (
                <div className="space-y-2">
                  {prerequisites.map((p, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex-1 flex items-center space-x-2">
                        <GitFork className="w-3.5 h-3.5 text-indigo-400" />
                        <input
                          type="text"
                          placeholder="Flag Key (e.g. payment-v2)"
                          value={p.flagKey}
                          onChange={(e) => {
                            const updated = [...prerequisites];
                            updated[pIdx].flagKey = e.target.value;
                            setPrerequisites(updated);
                          }}
                          className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-[11px] text-zinc-200 flex-1"
                        />
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className="text-zinc-500">Expected:</span>
                        <input
                          type="text"
                          placeholder="variant (on)"
                          value={p.expectedVariant || 'on'}
                          onChange={(e) => {
                            const updated = [...prerequisites];
                            updated[pIdx].expectedVariant = e.target.value;
                            setPrerequisites(updated);
                          }}
                          className="w-20 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-[11px] text-zinc-200"
                        />
                        <button
                          type="button"
                          onClick={() => setPrerequisites(prerequisites.filter((_, i) => i !== pIdx))}
                          className="text-zinc-500 hover:text-rose-400 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'sentinel' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-zinc-950 rounded-xl border border-zinc-800">
                <div className="flex items-center space-x-3">
                  <ShieldAlert className="w-5 h-5 text-indigo-400" />
                  <div>
                    <span className="text-xs font-bold text-zinc-200 block">
                      Auto-Rollback Error Sentinel
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Automatically trips killswitch or rolls back canary if error rates exceed threshold
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={breakerEnabled}
                  onChange={(e) => setBreakerEnabled(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 cursor-pointer"
                />
              </div>

              {breakerEnabled && (
                <div className="p-4 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-4 text-xs">
                  <div>
                    <label className="block text-zinc-400 mb-1">
                      Error Rate Threshold (%): <span className="text-indigo-400 font-mono font-bold">{errorThreshold}%</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="50"
                      value={errorThreshold}
                      onChange={(e) => setErrorThreshold(parseInt(e.target.value, 10))}
                      className="w-full accent-indigo-500 bg-zinc-800 h-2 rounded cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-400 mb-1">Trigger Action</label>
                    <select
                      value={breakerAction}
                      onChange={(e) => setBreakerAction(e.target.value as any)}
                      className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-200 focus:outline-none"
                    >
                      <option value="killswitch">Emergency Killswitch (Turn OFF)</option>
                      <option value="rollback_stage">Rollback Canary Stage (Step down %)</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
            >
              {saving ? 'Saving...' : isNew ? 'Create Flag' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
