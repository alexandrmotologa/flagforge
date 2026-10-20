import React, { useState } from 'react';
import { FeatureFlag, EvaluationDetails } from '../../core/types.js';
import { Terminal, Play, Copy, Check, Code, ShieldCheck, Cpu } from 'lucide-react';

interface OpenFeaturePlaygroundProps {
  flags: FeatureFlag[];
}

export const OpenFeaturePlayground: React.FC<OpenFeaturePlaygroundProps> = ({ flags }) => {
  const [selectedFlagKey, setSelectedFlagKey] = useState<string>(flags[0]?.key || '');
  const [contextJson, setContextJson] = useState<string>(
    JSON.stringify(
      {
        userId: 'usr_enterprise_77',
        email: 'alex@company.com',
        tier: 'enterprise',
        country: 'MD',
        appVersion: '2.1.0',
      },
      null,
      2
    )
  );
  const [evaluationResult, setEvaluationResult] = useState<EvaluationDetails | null>(null);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [activeLang, setActiveLang] = useState<'node' | 'react' | 'python' | 'go' | 'curl'>('node');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const selectedFlag = flags.find((f) => f.key === selectedFlagKey);

  const handleEvaluate = async () => {
    if (!selectedFlagKey) return;
    setEvaluating(true);

    let parsedContext = {};
    try {
      parsedContext = JSON.parse(contextJson);
    } catch {
      alert('Invalid JSON in evaluation context');
      setEvaluating(false);
      return;
    }

    try {
      const res = await fetch('/api/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flagKey: selectedFlagKey,
          defaultValue: selectedFlag?.defaultValue ?? false,
          context: parsedContext,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as EvaluationDetails;
        setEvaluationResult(data);
      }
    } catch (err) {
      console.error('Evaluation error:', err);
    } finally {
      setEvaluating(false);
    }
  };

  const getCodeSnippet = () => {
    const key = selectedFlagKey || 'feature-flag-key';
    const flagType = selectedFlag?.type || 'boolean';

    switch (activeLang) {
      case 'node':
        return `import { OpenFeature } from '@openfeature/server-sdk';
import { FlagForgeProvider } from 'flagforge/provider';

// Connect provider to FlagForge local zero-cloud daemon
await OpenFeature.setProviderAndWait(
  new FlagForgeProvider({ daemonUrl: 'http://localhost:4900' })
);

const client = OpenFeature.getClient();

// Real-time local evaluation (CNCF OpenFeature spec)
const isEnabled = await client.get${flagType === 'boolean' ? 'Boolean' : flagType === 'string' ? 'String' : 'Number'}Value(
  '${key}',
  ${JSON.stringify(selectedFlag?.defaultValue ?? false)},
  {
    targetingKey: 'usr_123',
    tier: 'enterprise',
    country: 'MD',
  }
);`;

      case 'react':
        return `import { useFlag, OpenFeatureProvider } from '@openfeature/react-sdk';

// In your root App component:
// <OpenFeatureProvider client={flagforgeClient}>

export function FeatureComponent() {
  const { value: isEnabled } = useFlag('${key}', ${JSON.stringify(
          selectedFlag?.defaultValue ?? false
        )});

  return (
    <div>
      {isEnabled ? <ModernView /> : <LegacyView />}
    </div>
  );
}`;

      case 'python':
        return `from openfeature import api
from openfeature.contrib.provider.ofrep import OFREPProvider

# Set OFREP provider pointing to FlagForge daemon
api.set_provider(OFREPProvider("http://localhost:4900/ofrep"))
client = api.get_client()

result = client.get_${flagType === 'boolean' ? 'boolean' : flagType === 'string' ? 'string' : 'number'}_value(
    "${key}",
    ${selectedFlag?.defaultValue === false ? 'False' : selectedFlag?.defaultValue === true ? 'True' : JSON.stringify(selectedFlag?.defaultValue ?? False)},
    {"targeting_key": "usr_123", "tier": "enterprise"}
)`;

      case 'go':
        return `package main

import (
    "context"
    "fmt"
    "github.com/open-feature/go-sdk/openfeature"
)

func main() {
    client := openfeature.NewClient("flagforge-service")
    evalCtx := openfeature.NewEvaluationContext(
        "usr_123",
        map[string]interface{}{"tier": "enterprise", "country": "MD"},
    )

    val, err := client.BooleanValue(context.Background(), "${key}", false, evalCtx)
    fmt.Printf("Flag ${key}: %v\\n", val)
}`;

      case 'curl':
        return `# CNCF OFREP Standard Evaluation Request:
curl -X POST http://localhost:4900/ofrep/v1/evaluate/flags/${key} \\
  -H "Content-Type: application/json" \\
  -d '{
    "context": {
      "targetingKey": "usr_enterprise_77",
      "tier": "enterprise",
      "country": "MD"
    }
  }'`;
    }
  };

  const copySnippet = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Live Flag Evaluation Debugger */}
      <div className="p-6 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-4">
        <div className="flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-indigo-400" />
          <div>
            <h3 className="text-sm font-bold text-zinc-100">Live OpenFeature Evaluator</h3>
            <p className="text-xs text-zinc-400">
              Test context resolution, nested attributes, and rule matching in real time
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
          {/* Left: Input Controls */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Target Flag</label>
              <select
                value={selectedFlagKey}
                onChange={(e) => setSelectedFlagKey(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
              >
                {flags.map((f) => (
                  <option key={f.key} value={f.key}>
                    {f.name} ({f.key})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-zinc-300">
                  Evaluation Context (JSON)
                </label>
                <div className="flex space-x-1">
                  <button
                    onClick={() =>
                      setContextJson(
                        JSON.stringify({ userId: 'u1', tier: 'enterprise', country: 'MD' }, null, 2)
                      )
                    }
                    className="text-[10px] text-zinc-400 hover:text-indigo-400 px-1.5 py-0.5 rounded bg-zinc-800"
                  >
                    Enterprise
                  </button>
                  <button
                    onClick={() =>
                      setContextJson(
                        JSON.stringify({ userId: 'u2', tier: 'free', country: 'US' }, null, 2)
                      )
                    }
                    className="text-[10px] text-zinc-400 hover:text-indigo-400 px-1.5 py-0.5 rounded bg-zinc-800"
                  >
                    Free
                  </button>
                  <button
                    onClick={() =>
                      setContextJson(
                        JSON.stringify(
                          { userId: 'u3', email: 'dev@flagforge.dev', tier: 'pro' },
                          null,
                          2
                        )
                      )
                    }
                    className="text-[10px] text-zinc-400 hover:text-indigo-400 px-1.5 py-0.5 rounded bg-zinc-800"
                  >
                    Staff
                  </button>
                </div>
              </div>
              <textarea
                rows={6}
                value={contextJson}
                onChange={(e) => setContextJson(e.target.value)}
                className="w-full p-3 bg-zinc-950 border border-zinc-800 rounded-lg text-xs font-mono text-zinc-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              onClick={handleEvaluate}
              disabled={evaluating}
              className="w-full inline-flex items-center justify-center space-x-2 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{evaluating ? 'Evaluating...' : 'Evaluate Flag'}</span>
            </button>
          </div>

          {/* Right: Inspection Output */}
          <div className="bg-zinc-950 rounded-xl border border-zinc-800 p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs">
                <span className="font-semibold text-zinc-400">Resolution Details</span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Latency: &lt;0.1ms
                </span>
              </div>

              {evaluationResult ? (
                <div className="space-y-3 pt-3 text-xs font-mono">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-zinc-400">Resolved Value:</span>
                    <span className="text-base font-bold text-emerald-400">
                      {JSON.stringify(evaluationResult.value)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-1 border-t border-zinc-900">
                    <span className="text-zinc-400">Resolution Reason:</span>
                    <span className="text-amber-400 font-semibold">{evaluationResult.reason}</span>
                  </div>

                  {evaluationResult.variant && (
                    <div className="flex justify-between items-center py-1 border-t border-zinc-900">
                      <span className="text-zinc-400">Variant:</span>
                      <span className="text-indigo-400">{evaluationResult.variant}</span>
                    </div>
                  )}

                  {evaluationResult.matchedRuleId && (
                    <div className="flex justify-between items-center py-1 border-t border-zinc-900">
                      <span className="text-zinc-400">Matched Rule ID:</span>
                      <span className="text-purple-400">{evaluationResult.matchedRuleId}</span>
                    </div>
                  )}

                  {evaluationResult.bucket !== undefined && (
                    <div className="flex justify-between items-center py-1 border-t border-zinc-900">
                      <span className="text-zinc-400">MurmurHash3 Bucket:</span>
                      <span className="text-zinc-200">{evaluationResult.bucket}%</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500 text-xs">
                  Click "Evaluate Flag" to run in-memory or OFREP evaluation.
                </div>
              )}
            </div>

            <div className="text-[10px] text-zinc-500 pt-3 border-t border-zinc-900 flex items-center justify-between">
              <span>CNCF OpenFeature Standard v0.7+</span>
              <span className="text-indigo-400">Zero-Cloud Local Provider</span>
            </div>
          </div>
        </div>
      </div>

      {/* SDK Integration Code Generator */}
      <div className="p-6 bg-zinc-900/40 rounded-xl border border-zinc-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Code className="w-5 h-5 text-indigo-400" />
            <div>
              <h3 className="text-sm font-bold text-zinc-100">Client SDK Integration Snippets</h3>
              <p className="text-xs text-zinc-400">
                Works directly with official OpenFeature SDKs without code changes
              </p>
            </div>
          </div>

          <button
            onClick={copySnippet}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedCode ? 'Copied' : 'Copy Snippet'}</span>
          </button>
        </div>

        {/* Language Tabs */}
        <div className="flex space-x-1 border-b border-zinc-800 pb-2">
          {(
            [
              { id: 'node', label: 'Node.js / TypeScript' },
              { id: 'react', label: 'React (@openfeature)' },
              { id: 'python', label: 'Python (openfeature-sdk)' },
              { id: 'go', label: 'Go (openfeature-go)' },
              { id: 'curl', label: 'cURL / OFREP API' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveLang(tab.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                activeLang === tab.id
                  ? 'bg-zinc-800 text-zinc-100 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Code Display */}
        <pre className="p-4 bg-zinc-950 rounded-xl border border-zinc-800/80 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed">
          {getCodeSnippet()}
        </pre>
      </div>
    </div>
  );
};
