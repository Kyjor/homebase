import React, { useEffect, useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { Expense, Category, Budget } from '../types';
import { getExpensesByHousehold } from '../services/expenseService';
import { getCategoriesByHousehold } from '../services/categoryService';
import { getBudgetsByHousehold } from '../services/budgetService';
import styles from './DashboardSummary.module.css';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

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
      getBudgetsByHousehold(household.id),
    ])
      .then(([exps, cats, buds]) => {
        setExpenses(exps);
        setCategories(cats);
        setBudgets(buds);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, [household]);

  if (loading) return <div className={styles.loading}>Loading summary…</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  const currentMonth = getCurrentMonth();
  const expensesThisMonth = expenses.filter(e => e.date.startsWith(currentMonth));
  const totalSpent = expensesThisMonth.reduce((sum, e) => sum + Number(e.amount), 0);

  const categoryTotals: Record<string, number> = {};
  expensesThisMonth.forEach(e => {
    categoryTotals[e.category_id] = (categoryTotals[e.category_id] || 0) + Number(e.amount);
  });

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          This month <span className={styles.month}>{currentMonth}</span>
        </h2>
        <div className={styles.total}>${totalSpent.toFixed(2)}</div>
      </div>

      {categories.length === 0 ? (
        <p className={styles.empty}>Add categories from “Categories & budgets” to track spending.</p>
      ) : (
        <div className={styles.list}>
          {categories.map(cat => {
            const spent = categoryTotals[cat.id] || 0;
            const budget = budgets.find(b => b.category_id === cat.id && b.month === currentMonth);
            const limit = budget?.limit_amount || 0;
            const percent = limit ? Math.min(100, (spent / limit) * 100) : 0;
            let barColor = '#22c55e';
            if (limit && percent >= 100) barColor = '#ef4444';
            else if (limit && percent >= 80) barColor = '#f59e0b';

            return (
              <div key={cat.id} className={styles.row}>
                <span className={styles.catName}>{cat.name}</span>
                <span className={styles.amounts}>
                  <span className={styles.spent}>${spent.toFixed(2)}</span>
                  {limit > 0 ? ` / $${limit.toFixed(2)}` : ''}
                </span>
                {limit > 0 && (
                  <div className={styles.barRow}>
                    <div className={styles.barTrack}>
                      <div
                        className={styles.barFill}
                        style={{ width: `${percent}%`, background: barColor }}
                      />
                    </div>
                    <span className={styles.barMeta} style={{ color: barColor }}>
                      {percent.toFixed(0)}%
                    </span>
                    {percent >= 80 && (
                      <span className={styles.warn} style={{ color: barColor }}>
                        {percent >= 100 ? 'Over' : 'Near limit'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DashboardSummary;
