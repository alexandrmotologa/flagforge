import { useState, useEffect, useCallback } from 'react';
import { FeatureFlag } from '../../core/types.js';

export interface FlagWithMetrics extends FeatureFlag {
  metrics?: {
    totalEvaluations: number;
    variantCounts: Record<string, number>;
    lastEvaluatedAt?: string;
  };
}

export function useFlags() {
  const [flags, setFlags] = useState<FlagWithMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [clientCount, setClientCount] = useState(1);

  const fetchFlags = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/flags');
      if (res.ok) {
        const data = await res.json();
        setFlags(data.flags || []);
      }
    } catch (err) {
      console.error('Failed to fetch flags:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();

    // Connect to Server-Sent Events stream
    const eventSource = new EventSource('/api/v1/events');

    eventSource.onopen = () => {
      setConnected(true);
    };

    eventSource.onerror = () => {
      setConnected(false);
    };

    eventSource.addEventListener('init', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.flags) setFlags(data.flags);
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('flag_updated', (e: MessageEvent) => {
      try {
        const updated = JSON.parse(e.data) as FeatureFlag;
        setFlags((prev) => {
          const index = prev.findIndex((f) => f.key === updated.key);
          if (index >= 0) {
            const next = [...prev];
            next[index] = { ...next[index], ...updated };
            return next;
          }
          return [updated, ...prev];
        });
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('flag_toggled', (e: MessageEvent) => {
      try {
        const { flagKey, enabled } = JSON.parse(e.data);
        setFlags((prev) =>
          prev.map((f) => (f.key === flagKey ? { ...f, enabled } : f))
        );
      } catch {
        // ignore
      }
    });

    eventSource.addEventListener('flag_deleted', (e: MessageEvent) => {
      try {
        const { flagKey } = JSON.parse(e.data);
        setFlags((prev) => prev.filter((f) => f.key !== flagKey));
      } catch {
        // ignore
      }
    });

    return () => {
      eventSource.close();
    };
  }, [fetchFlags]);

  const toggleFlag = async (key: string) => {
    // Optimistic UI update
    setFlags((prev) =>
      prev.map((f) => (f.key === key ? { ...f, enabled: !f.enabled } : f))
    );

    try {
      const res = await fetch(`/api/v1/flags/${key}/toggle`, { method: 'POST' });
      if (!res.ok) {
        // Revert on error
        fetchFlags();
      }
    } catch {
      fetchFlags();
    }
  };

  const advanceStage = async (key: string) => {
    try {
      const res = await fetch(`/api/v1/flags/${key}/advance`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setFlags((prev) =>
          prev.map((f) => (f.key === key ? { ...f, ...data.flag } : f))
        );
      }
    } catch (err) {
      console.error('Failed to advance stage:', err);
    }
  };

  const saveFlag = async (flag: FeatureFlag, isNew: boolean) => {
    const url = isNew ? '/api/v1/flags' : `/api/v1/flags/${flag.key}`;
    const method = isNew ? 'POST' : 'PUT';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(flag),
    });

    if (!res.ok) {
      throw new Error(`Failed to save flag: ${res.statusText}`);
    }

    await fetchFlags();
  };

  const deleteFlag = async (key: string) => {
    const res = await fetch(`/api/v1/flags/${key}`, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error(`Failed to delete flag: ${res.statusText}`);
    }
    setFlags((prev) => prev.filter((f) => f.key !== key));
  };

  return {
    flags,
    loading,
    connected,
    toggleFlag,
    advanceStage,
    saveFlag,
    deleteFlag,
    refresh: fetchFlags,
  };
}
