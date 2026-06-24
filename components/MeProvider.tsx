'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { MeResponse } from '@/lib/types';

interface MeCtx {
  /** The /api/me payload, or null while the first fetch is in flight. */
  me: MeResponse | null;
  loading: boolean;
  /** Re-fetch /api/me (after a mutation that changes the session, e.g. accepting a family invite). */
  refresh: () => Promise<void>;
  /** Patch the cached payload locally (optimistic UI). */
  setMe: (next: MeResponse) => void;
}

const MeContext = createContext<MeCtx>({
  me: null,
  loading: true,
  refresh: async () => {},
  setMe: () => {},
});

// Single owner of /api/me. Fetched once and shared, so the i18n provider (for locale) and the
// home page (for session + profiles + home location + pending invite) don't each round-trip it.
export function MeProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/api/me');
      setMe((await r.json()) as MeResponse);
    } catch {
      setMe({ user: null, account: null, profiles: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return <MeContext.Provider value={{ me, loading, refresh, setMe }}>{children}</MeContext.Provider>;
}

export const useMe = () => useContext(MeContext);
