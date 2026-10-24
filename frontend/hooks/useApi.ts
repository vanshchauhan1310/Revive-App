import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api, errorMessage } from '@/lib/api';

type State<T> = { data: T | null; error: string | null; loading: boolean; refreshing: boolean };

// Minimal data-fetching hook: load on mount (and optionally on screen focus), pull-to-refresh,
// and stale-response protection.
export function useApi<T>(path: string | null, opts: { query?: Record<string, any>; refetchOnFocus?: boolean } = {}) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: Boolean(path), refreshing: false });
  const seq = useRef(0);
  const queryKey = JSON.stringify(opts.query ?? {});

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    if (!path) return;
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: mode === 'initial' && !s.data, refreshing: mode === 'refresh', error: null }));
    try {
      const data = await api<T>(path, { query: JSON.parse(queryKey) });
      if (id === seq.current) setState({ data, error: null, loading: false, refreshing: false });
    } catch (err) {
      if (id === seq.current) setState((s) => ({ ...s, error: errorMessage(err), loading: false, refreshing: false }));
    }
  }, [path, queryKey]);

  useEffect(() => { load('initial'); }, [load]);

  const firstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    if (firstFocus.current) { firstFocus.current = false; return; }
    if (opts.refetchOnFocus) load('silent');
  }, [load, opts.refetchOnFocus]));

  return { ...state, reload: () => load('silent'), refresh: () => load('refresh'), setData: (d: T) => setState((s) => ({ ...s, data: d })) };
}
