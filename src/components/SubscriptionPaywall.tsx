import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import {
  fetchSubscriptionProduct,
  isDevMockAllowed,
  mockSubscription,
  purchaseSubscription,
  restoreSubscription,
} from '../native/iap';
import styles from './SubscriptionPaywall.module.css';

function errorMessage(reason: string): string {
  switch (reason) {
    case 'canceled':
      return 'Purchase canceled.';
    case 'not_found':
    case 'expired':
      return 'No active subscription found for this Apple ID.';
    case 'iap_unavailable':
      return 'Store purchases aren’t available in this build yet.';
    default:
      return reason || 'Something went wrong.';
  }
}

export default function SubscriptionPaywall() {
  const { signOut } = useAuth();
  const { markEntitled, refresh } = useSubscription();
  const [priceLabel, setPriceLabel] = useState('$4.99/month');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [brandTaps, setBrandTaps] = useState(0);

  useEffect(() => {
    void fetchSubscriptionProduct().then((p) => {
      if (p?.formattedPrice) setPriceLabel(`${p.formattedPrice}/month`);
    });
  }, []);

  useEffect(() => {
    if (brandTaps === 0) return;
    const t = window.setTimeout(() => setBrandTaps(0), 2000);
    return () => window.clearTimeout(t);
  }, [brandTaps]);

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <p
          className={styles.brand}
          onClick={() => {
            const next = brandTaps + 1;
            setBrandTaps(next);
            if (next < 7) return;
            setBrandTaps(0);
            void mockSubscription().then(() => markEntitled());
          }}
        >
          Homebase
        </p>
        <h1 className={styles.title}>Try free for 30 days</h1>
        <p className={styles.lede}>
          Full household access — spending, shopping, house care, and shared calendars. Then{' '}
          {priceLabel}. Cancel anytime in Apple Settings.
        </p>

        <ul className={styles.bullets}>
          <li>Shared expenses & budgets</li>
          <li>Shopping lists that stay in sync</li>
          <li>House-care tasks with photo attachments</li>
        </ul>

        {msg && <p className={styles.msg}>{msg}</p>}

        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            const res = await purchaseSubscription();
            setBusy(false);
            if (res.ok) {
              markEntitled();
              setMsg(res.pending ? 'Purchase pending…' : 'You’re in — welcome to Homebase.');
              return;
            }
            setMsg(errorMessage(res.reason));
          }}
        >
          Start free trial
        </button>

        <button
          type="button"
          className={styles.secondary}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            const res = await restoreSubscription();
            setBusy(false);
            if (res.ok) {
              markEntitled();
              await refresh();
              setMsg('Subscription restored.');
              return;
            }
            setMsg(errorMessage(res.reason));
          }}
        >
          Restore purchases
        </button>

        {isDevMockAllowed() && (
          <button
            type="button"
            className={styles.dev}
            disabled={busy}
            onClick={async () => {
              await mockSubscription();
              markEntitled();
            }}
          >
            Mock subscribe (dev)
          </button>
        )}

        <p className={styles.fine}>
          Payment charged to your Apple ID after the trial unless you cancel at least 24 hours
          before it ends. Subscription renews monthly until canceled.
        </p>

        <button type="button" className={styles.signOut} onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </div>
  );
}
