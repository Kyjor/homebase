import React, { useState, useEffect } from 'react';
import { HouseholdProvider } from './contexts/HouseholdContext';
import { useAuth } from './contexts/AuthContext';
import { useHousehold } from './contexts/HouseholdContext';
import AuthForm from './components/AuthForm';
import HouseholdOnboarding from './components/HouseholdOnboarding';
import ExpenseTable from './components/ExpenseTable';
import DashboardSummary from './components/DashboardSummary';
import CategoryManager from './components/CategoryManager';
import BudgetManager from './components/BudgetManager';
import RecurringPayments from './components/RecurringPayments';
import ShoppingListManager from './components/ShoppingListManager';

const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);

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

  if (authLoading) return <div>Loading...</div>;
  if (!user) return <AuthForm />;

  return (
    <HouseholdProvider>
      {!isOnline && (
        <div style={{ background: '#ffecb3', color: '#7c5c00', padding: '8px 0', textAlign: 'center', fontWeight: 600 }}>
          Offline mode: changes will sync when you reconnect.
        </div>
      )}
      <HouseholdGate />
    </HouseholdProvider>
  );
};

const MODAL_OPTIONS = [
  { key: 'categories', label: 'Manage Categories', icon: '📂', component: CategoryManager },
  { key: 'budgets', label: 'Manage Budgets', icon: '💰', component: BudgetManager },
  { key: 'recurring', label: 'Recurring Payments', icon: '🔁', component: RecurringPayments },
];

type ModalKey = 'categories' | 'budgets' | 'recurring' | null;

const HouseholdGate: React.FC = () => {
  const { household, loading: householdLoading } = useHousehold();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'shopping'>('dashboard');
  const [modalOpen, setModalOpen] = useState<ModalKey>(null);
  const [manageMenuOpen, setManageMenuOpen] = useState(false);

  // Responsive: show floating button at bottom-right on mobile, top-right on desktop
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 700;

  useEffect(() => {
    const handleResize = () => {
      setManageMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (householdLoading) return <div>Loading...</div>;
  if (!household) return <HouseholdOnboarding />;

  // Modal content
  const modalContent = modalOpen
    ? (() => {
        const opt = MODAL_OPTIONS.find(o => o.key === modalOpen);
        if (!opt) return null;
        const Comp = opt.component;
        return (
          <div style={{ padding: isMobile ? 0 : 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: 24 }}>{opt.icon}</span>
              <span style={{ fontWeight: 700, fontSize: 20 }}>{opt.label}</span>
            </div>
            <Comp />
          </div>
        );
      })()
    : null;

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Top navigation for tabs */}
      <div style={{
        width: '100%',
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        justifyContent: 'center',
        gap: 0,
        position: 'sticky',
        top: 0,
        zIndex: 9,
      }}>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#6366f1', letterSpacing: 1, flex: 1, textAlign: 'left', paddingLeft: 18 }}>Homebase</span>
        <button
          onClick={() => setActiveTab('dashboard')}
          style={{
            flex: 1,
            padding: '12px 0',
            background: activeTab === 'dashboard' ? 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)' : 'none',
            color: activeTab === 'dashboard' ? '#fff' : '#334155',
            border: 'none',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
            borderBottom: activeTab === 'dashboard' ? '2px solid #6366f1' : '2px solid transparent',
            transition: 'background 0.2s',
          }}
        >Dashboard</button>
        <button
          onClick={() => setActiveTab('shopping')}
          style={{
            flex: 1,
            padding: '12px 0',
            background: activeTab === 'shopping' ? 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)' : 'none',
            color: activeTab === 'shopping' ? '#fff' : '#334155',
            border: 'none',
            fontWeight: 600,
            fontSize: 16,
            cursor: 'pointer',
            borderBottom: activeTab === 'shopping' ? '2px solid #6366f1' : '2px solid transparent',
            transition: 'background 0.2s',
          }}
        >Shopping Lists</button>
      </div>
      <main style={{ flex: 1, padding: isMobile ? 10 : 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        {activeTab === 'dashboard' ? (
          <>
            <DashboardSummary />
            <ExpenseTable />
            {/* Floating Manage Button */}
            <button
              onClick={() => setManageMenuOpen(true)}
              style={{
                position: 'fixed',
                right: isMobile ? 18 : 36,
                bottom: isMobile ? 18 : 'auto',
                top: isMobile ? 'auto' : 90,
                zIndex: 30,
                background: '#6366f1',
                color: '#fff',
                border: 'none',
                borderRadius: '50%',
                width: 56,
                height: 56,
                boxShadow: '0 4px 16px 0 rgba(60,72,88,0.12)',
                fontSize: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              aria-label="Manage"
            >
              ⚙️
            </button>
            {/* Manage Modal Menu */}
            {manageMenuOpen && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.18)',
                zIndex: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
                onClick={() => setManageMenuOpen(false)}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 8px 32px 0 rgba(60,72,88,0.18)',
                    padding: isMobile ? 12 : 32,
                    minWidth: isMobile ? 260 : 340,
                    maxWidth: '90vw',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                    position: 'relative',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => setManageMenuOpen(false)}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      background: 'none',
                      border: 'none',
                      fontSize: 22,
                      color: '#6366f1',
                      cursor: 'pointer',
                    }}
                    aria-label="Close menu"
                  >×</button>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {MODAL_OPTIONS.map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => {
                          setModalOpen(opt.key as ModalKey);
                          setManageMenuOpen(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 14,
                          background: '#f1f5f9',
                          color: '#334155',
                          border: 'none',
                          borderRadius: 8,
                          padding: '16px 18px',
                          fontWeight: 600,
                          fontSize: 17,
                          cursor: 'pointer',
                          boxShadow: '0 2px 8px 0 rgba(60,72,88,0.06)',
                          transition: 'background 0.2s',
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{opt.icon}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* Management Modal */}
            {modalOpen && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0,0,0,0.18)',
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
                onClick={() => setModalOpen(null)}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 16,
                    boxShadow: '0 8px 32px 0 rgba(60,72,88,0.18)',
                    padding: isMobile ? 8 : 28,
                    minWidth: isMobile ? 260 : 400,
                    maxWidth: '95vw',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    position: 'relative',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => setModalOpen(null)}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      background: 'none',
                      border: 'none',
                      fontSize: 22,
                      color: '#6366f1',
                      cursor: 'pointer',
                    }}
                    aria-label="Close modal"
                  >×</button>
                  {modalContent}
                </div>
              </div>
            )}
          </>
        ) : (
          <ShoppingListManager />
        )}
      </main>
    </div>
  );
};

export default App;
