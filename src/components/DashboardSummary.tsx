import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { Expense, Category, Budget } from '../types';
import { getExpensesByHousehold } from '../services/expenseService';
import { getCategoriesByHousehold } from '../services/categoryService';
import { getBudgetsByHousehold } from '../services/budgetService';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 700;

const DashboardSummary: React.FC = () => {
  const { household } = useHousehold();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!household) return;
    setLoading(true);
    Promise.all([
      getExpensesByHousehold(household.id),
      getCategoriesByHousehold(household.id),
      getBudgetsByHousehold(household.id)
    ])
      .then(([expenses, categories, budgets]) => {
        setExpenses(expenses);
        setCategories(categories);
        setBudgets(budgets);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [household]);

  if (loading) return <div>Loading summary...</div>;
  if (error) return <div className="dashboard-error">{error}</div>;

  const mobile = isMobile();
  const currentMonth = getCurrentMonth();
  const expensesThisMonth = expenses.filter(e => e.date.startsWith(currentMonth));
  const totalSpent = expensesThisMonth.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals: { [catId: string]: number } = {};
  expensesThisMonth.forEach(e => {
    categoryTotals[e.category_id] = (categoryTotals[e.category_id] || 0) + e.amount;
  });

  return (
    <div style={{
      background: '#fff',
      borderRadius: 14,
      boxShadow: '0 4px 24px 0 rgba(60,72,88,0.10)',
      padding: mobile ? '1.2rem 0.5rem' : '2rem 2.5rem',
      margin: mobile ? '18px 0' : '32px 0',
      maxWidth: 900,
      width: mobile ? '95%' : '100%',
      marginLeft: 'auto',
      marginRight: 'auto',
    }}>
      <h2 style={{ fontWeight: 700, fontSize: mobile ? 22 : 28, color: '#2d3748', marginBottom: 10 }}>
        Spending Summary <span style={{ fontWeight: 400, fontSize: mobile ? 15 : 18, color: '#64748b' }}>({currentMonth})</span>
      </h2>
      <div style={{ fontSize: mobile ? 18 : 22, fontWeight: 700, color: '#1e293b', marginBottom: 18 }}>
        Total Spent: <span style={{ color: '#6366f1' }}>${totalSpent.toFixed(2)}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 16 : 22 }}>
        {categories.map(cat => {
          const spent = categoryTotals[cat.id] || 0;
          const budget = budgets.find(b => b.category_id === cat.id && b.month === currentMonth);
          const limit = budget?.limit_amount || 0;
          const percent = limit ? Math.min(100, (spent / limit) * 100) : 0;
          let barColor = '#22c55e';
          if (limit && percent >= 100) barColor = '#ef4444';
          else if (limit && percent >= 80) barColor = '#f59e42';
          return (
            <div key={cat.id} style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', alignItems: mobile ? 'flex-start' : 'center', gap: mobile ? 6 : 18, background: mobile ? '#f8fafc' : 'none', borderRadius: 8, padding: mobile ? '10px 8px' : 0 }}>
              <span style={{ minWidth: 90, fontWeight: 600, color: '#334155', fontSize: 15 }}>{cat.name}</span>
              <span style={{ fontWeight: 600, color: '#6366f1', fontSize: 15 }}>${spent.toFixed(2)}</span>
              {limit > 0 && (
                <span style={{ color: '#64748b', fontSize: 15, marginLeft: 4 }}>/ ${limit.toFixed(2)}</span>
              )}
              <div style={{ flex: 1, minWidth: 80, margin: mobile ? '8px 0' : '0 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ background: '#e5e7eb', borderRadius: 6, width: '100%', height: 10, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${percent}%`,
                      background: barColor,
                      height: 10,
                      borderRadius: 6,
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
                {limit > 0 && (
                  <span style={{ fontWeight: 600, fontSize: 14, color: barColor }}>{percent.toFixed(0)}%</span>
                )}
                {limit > 0 && percent >= 80 && (
                  <span style={{ color: barColor, fontWeight: 600, fontSize: 14, marginLeft: 6 }}>
                    {percent >= 100 ? 'Over budget!' : 'Nearing limit'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardSummary; 