import React, { useState, useEffect } from 'react';
import { HouseholdProvider } from './contexts/HouseholdContext';
import { useAuth } from './contexts/AuthContext';
import AuthForm from './components/AuthForm';
import HouseholdOnboarding from './components/HouseholdOnboarding';
import ExpenseTable from './components/ExpenseTable';
import DashboardSummary from './components/DashboardSummary';
import CategoryManager from './components/CategoryManager';
import BudgetManager from './components/BudgetManager';
import ShoppingList from './components/ShoppingList';
import RecurringPayments from './components/RecurringPayments';

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

const HouseholdGate: React.FC = () => {
  const { household, loading: householdLoading } = require('./contexts/HouseholdContext').useHousehold();
  if (householdLoading) return <div>Loading...</div>;
  if (!household) return <HouseholdOnboarding />;
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 320, padding: 16, borderRight: '1px solid #eee', background: '#fafbfc' }}>
        <CategoryManager />
        <BudgetManager />
        <ShoppingList />
        <RecurringPayments />
      </aside>
      <main style={{ flex: 1, padding: 24 }}>
        <DashboardSummary />
        <ExpenseTable />
      </main>
    </div>
  );
};

export default App;
