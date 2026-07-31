import React, { useState, useEffect } from 'react';
import { HouseholdProvider, useHousehold } from './contexts/HouseholdContext';
import { useAuth } from './contexts/AuthContext';
import { useSubscription } from './contexts/SubscriptionContext';
import AuthForm from './components/AuthForm';
import HouseholdOnboarding from './components/HouseholdOnboarding';
import SubscriptionPaywall from './components/SubscriptionPaywall';
import ExpenseTable from './components/ExpenseTable';
import DashboardSummary from './components/DashboardSummary';
import CategoryManager from './components/CategoryManager';
import BudgetManager from './components/BudgetManager';
import RecurringPayments from './components/RecurringPayments';
import ShoppingListManager from './components/ShoppingListManager';
import Calendar from './components/Calendar';
import HouseholdMembers from './components/HouseholdMembers';
import HouseHealth from './components/houseHealth/HouseHealth';
import DebugPanel from './components/DebugPanel';
import styles from './App.module.css';

type TabKey = 'dashboard' | 'health' | 'shopping' | 'calendar' | 'members';
type ModalKey = 'categories' | 'budgets' | 'recurring' | null;

const TABS: { key: TabKey; label: string; short: string; icon: string }[] = [
  { key: 'dashboard', label: 'Dashboard', short: 'Money', icon: '💵' },
  { key: 'health', label: 'House Health', short: 'House', icon: '🏠' },
  { key: 'shopping', label: 'Shopping', short: 'Shop', icon: '🛒' },
  { key: 'calendar', label: 'Calendar', short: 'Cal', icon: '📅' },
  { key: 'members', label: 'Members', short: 'People', icon: '👥' },
];

const MODAL_OPTIONS = [
  { key: 'categories' as const, label: 'Categories', icon: '📂', component: CategoryManager },
  { key: 'budgets' as const, label: 'Budgets', icon: '💰', component: BudgetManager },
  { key: 'recurring' as const, label: 'Recurring payments', icon: '🔁', component: RecurringPayments },
];

const App: React.FC = () => {
  const { user, loading: authLoading, error: authError } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [appError, setAppError] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (authError) {
      setAppError(`Authentication error: ${authError}`);
    }
  }, [authError]);

  if (appError) {
    return (
      <div className={styles.errorScreen}>
        <div className={styles.errorCard}>
          <h2>Something went wrong</h2>
          <p>{appError}</p>
          <button
            type="button"
            onClick={() => {
              setAppError(null);
              window.location.reload();
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return <div className={styles.loading}>Loading…</div>;
  }

  if (!user) return <AuthForm />;

  return <SubscribedApp isOnline={isOnline} />;
};

const SubscribedApp: React.FC<{ isOnline: boolean }> = ({ isOnline }) => {
  const { entitled, loading: subLoading } = useSubscription();

  if (subLoading) return <div className={styles.loading}>Checking subscription…</div>;
  if (!entitled) return <SubscriptionPaywall />;

  return (
    <HouseholdProvider>
      {!isOnline && (
        <div className={styles.offlineBanner}>
          You're offline — changes will sync when you reconnect.
        </div>
      )}
      <HouseholdGate />
      {import.meta.env.DEV && <DebugPanel />}
    </HouseholdProvider>
  );
};

const HouseholdGate: React.FC = () => {
  const { household, loading: householdLoading } = useHousehold();
  const { signOut, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [modalOpen, setModalOpen] = useState<ModalKey>(null);
  const [manageMenuOpen, setManageMenuOpen] = useState(false);

  if (householdLoading) return <div className={styles.loading}>Loading household…</div>;
  if (!household) return <HouseholdOnboarding />;

  const modalOpt = MODAL_OPTIONS.find(o => o.key === modalOpen);
  const ModalComp = modalOpt?.component;

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <div className={styles.brand}>Homebase</div>
        <span className={styles.householdName} title={household.name}>
          {household.name}
        </span>

        <nav className={styles.desktopNav} aria-label="Primary">
          {TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.navTab} ${activeTab === tab.key ? styles.navTabActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className={styles.topActions}>
          <button type="button" className={styles.signOutBtn} onClick={() => signOut()}>
            Sign out{user?.name ? ` · ${user.name.split(' ')[0]}` : ''}
          </button>
        </div>
      </header>

      <main className={styles.main}>
        {activeTab === 'dashboard' && (
          <>
            <div className={styles.pageHeader}>
              <div>
                <h1 className={styles.pageTitle}>Spending</h1>
                <p className={styles.pageSubtitle}>Track expenses and stay on budget.</p>
              </div>
              <div className={styles.toolbar}>
                <button
                  type="button"
                  className={styles.toolBtn}
                  onClick={() => setManageMenuOpen(true)}
                >
                  Categories & budgets
                </button>
              </div>
            </div>
            <DashboardSummary />
            <ExpenseTable />
          </>
        )}

        {activeTab === 'health' && <HouseHealth />}
        {activeTab === 'shopping' && <ShoppingListManager />}
        {activeTab === 'calendar' && <Calendar />}
        {activeTab === 'members' && <HouseholdMembers />}
      </main>

      <nav className={styles.bottomNav} aria-label="Primary mobile">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`${styles.bottomTab} ${activeTab === tab.key ? styles.bottomTabActive : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <span aria-hidden>{tab.icon}</span>
            <span>{tab.short}</span>
          </button>
        ))}
      </nav>

      {manageMenuOpen && (
        <div
          className={`${styles.modalOverlay} ${styles.modalCentered}`}
          onClick={() => setManageMenuOpen(false)}
        >
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setManageMenuOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className={styles.modalTitle}>Finance tools</h2>
            <div className={styles.menuList}>
              {MODAL_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => {
                    setModalOpen(opt.key);
                    setManageMenuOpen(false);
                  }}
                >
                  <span className={styles.menuItemIcon}>{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {modalOpen && ModalComp && (
        <div
          className={`${styles.modalOverlay} ${styles.modalCentered}`}
          onClick={() => setModalOpen(null)}
        >
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setModalOpen(null)}
              aria-label="Close"
            >
              ×
            </button>
            <h2 className={styles.modalTitle}>
              {modalOpt?.icon} {modalOpt?.label}
            </h2>
            <ModalComp />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
