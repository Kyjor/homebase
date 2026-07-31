import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  getCachedEntitlement,
  listenForSubscriptionPurchases,
  setCachedEntitlement,
  syncSubscriptionFromStore,
} from '../native/iap';

interface SubscriptionContextType {
  entitled: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
  markEntitled: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [entitled, setEntitled] = useState(() => getCachedEntitlement());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const ok = await syncSubscriptionFromStore();
      setEntitled(ok || getCachedEntitlement());
    } finally {
      setLoading(false);
    }
  }, []);

  const markEntitled = useCallback(() => {
    setCachedEntitlement(true);
    setEntitled(true);
  }, []);

  useEffect(() => {
    void refresh();
    let unsub = () => {};
    void listenForSubscriptionPurchases(() => {
      markEntitled();
    }).then((fn) => {
      unsub = fn;
    });
    return () => unsub();
  }, [refresh, markEntitled]);

  return (
    <SubscriptionContext.Provider value={{ entitled, loading, refresh, markEntitled }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within SubscriptionProvider');
  return ctx;
}
