import React, { useState } from 'react';
import { FeatureFlag, TargetingRule, RuleCondition, FlagValueType } from '../../core/types.js';
import { X, Plus, Trash2, Check, AlertCircle } from 'lucide-react';

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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleAddRule = () => {
    const newRule: TargetingRule = {
      id: `rule-${Date.now()}`,
      description: 'New targeting rule',
      conditions: [
        {
          property: 'tier',
          operator: 'equals',
          value: 'enterprise',
        },
      ],
      serve: { variant: 'on' },
    };
    setRules([...rules, newRule]);
  };

  const handleRemoveRule = (ruleId: string) => {
    setRules(rules.filter((r) => r.id !== ruleId));
  };

  const handleAddCondition = (ruleIndex: number) => {
    const updated = [...rules];
    updated[ruleIndex].conditions.push({
      property: 'country',
      operator: 'in',
      value: 'MD, RO',
    });
    setRules(updated);
  };

  const handleRemoveCondition = (ruleIndex: number, condIndex: number) => {
    const updated = [...rules];
    updated[ruleIndex].conditions.splice(condIndex, 1);
    setRules(updated);
  };

  const handleConditionChange = (
    ruleIndex: number,
    condIndex: number,
    field: keyof RuleCondition,
    val: any
  ) => {
    const updated = [...rules];
    (updated[ruleIndex].conditions[condIndex] as any)[field] = val;
    setRules(updated);
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
            <p className="text-xs text-zinc-400">Configure OpenFeature flag rules, type, and canary rollout</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-center space-x-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Key & Name */}
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
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
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
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1.5">Description</label>
            <input
              type="text"
              placeholder="What does this feature flag control?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Type & Enabled Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">Initial State</label>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`w-full px-3 py-2 rounded-lg text-xs font-medium border flex items-center justify-between transition-colors ${
                  enabled
                    ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                }`}
              >
                <span>{enabled ? 'Enabled (Active)' : 'Disabled (Killswitch Off)'}</span>
                <span
                  className={`w-2.5 h-2.5 rounded-full ${enabled ? 'bg-indigo-400' : 'bg-zinc-600'}`}
                />
              </button>
            </div>
          </div>

          {/* Percentage Rollout Slider */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-medium text-zinc-300">Deterministic Percentage Rollout:</span>
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
            {/* Quick Presets */}
            <div className="flex items-center space-x-2 pt-1">
              {[
                { label: '0% (Internal)', val: 0 },
                { label: '5% (Canary)', val: 5 },
                { label: '25% (Beta)', val: 25 },
                { label: '50% (Staged)', val: 50 },
                { label: '100% (GA)', val: 100 },
              ].map((preset) => (
                <button
                  type="button"
                  key={preset.val}
                  onClick={() => setPercentage(preset.val)}
                  className={`px-2 py-1 rounded text-[11px] font-mono border transition-all ${
                    percentage === preset.val
                      ? 'bg-indigo-600 text-white border-indigo-500'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Targeting Rules */}
          <div className="space-y-4 pt-4 border-t border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-zinc-200">Targeting Rules</h3>
                <p className="text-[11px] text-zinc-500">Evaluated in order before percentage rollout</p>
              </div>
              <button
                type="button"
                onClick={handleAddRule}
                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Rule</span>
              </button>
            </div>

            {rules.length === 0 ? (
              <p className="text-xs text-zinc-500 italic bg-zinc-950/40 p-3 rounded-lg border border-zinc-800/40">
                No targeting rules configured. All evaluations fall through to percentage rollout or default variant.
              </p>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, rIdx) => (
                  <div
                    key={rule.id}
                    className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-800 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-300">Rule #{rIdx + 1}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveRule(rule.id)}
                        className="text-zinc-500 hover:text-rose-400 text-xs p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Conditions */}
                    {rule.conditions.map((cond, cIdx) => (
                      <div key={cIdx} className="grid grid-cols-12 gap-2 items-center text-xs">
                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="property (e.g. tier)"
                            value={cond.property}
                            onChange={(e) =>
                              handleConditionChange(rIdx, cIdx, 'property', e.target.value)
                            }
                            className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded font-mono text-[11px] text-zinc-200"
                          />
                        </div>
                        <div className="col-span-3">
                          <select
                            value={cond.operator}
                            onChange={(e) =>
                              handleConditionChange(rIdx, cIdx, 'operator', e.target.value)
                            }
                            className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-[11px] text-zinc-200"
                          >
                            <option value="equals">equals</option>
                            <option value="not_equals">not equals</option>
                            <option value="in">in list</option>
                            <option value="not_in">not in list</option>
                            <option value="matches_regex">matches regex</option>
                            <option value="gt">&gt; greater</option>
                            <option value="lt">&lt; less</option>
                            <option value="semver_gte">semver &gt;=</option>
                          </select>
                        </div>
                        <div className="col-span-4">
                          <input
                            type="text"
                            placeholder="value"
                            value={String(cond.value)}
                            onChange={(e) =>
                              handleConditionChange(rIdx, cIdx, 'value', e.target.value)
                            }
                            className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-[11px] text-zinc-200"
                          />
                        </div>
                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveCondition(rIdx, cIdx)}
                            className="text-zinc-600 hover:text-rose-400"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => handleAddCondition(rIdx)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                      >
                        + Add condition (AND)
                      </button>

                      <div className="flex items-center space-x-2 text-xs">
                        <span className="text-zinc-400">Serve:</span>
                        <input
                          type="text"
                          value={rule.serve.variant || 'on'}
                          onChange={(e) => {
                            const updated = [...rules];
                            updated[rIdx].serve.variant = e.target.value;
                            setRules(updated);
                          }}
                          className="w-24 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded font-mono text-[11px] text-zinc-200"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : isNew ? 'Create Flag' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
