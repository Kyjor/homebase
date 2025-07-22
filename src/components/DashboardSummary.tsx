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

  const currentMonth = getCurrentMonth();
  const expensesThisMonth = expenses.filter(e => e.date.startsWith(currentMonth));
  const totalSpent = expensesThisMonth.reduce((sum, e) => sum + e.amount, 0);

  const categoryTotals: { [catId: string]: number } = {};
  expensesThisMonth.forEach(e => {
    categoryTotals[e.category_id] = (categoryTotals[e.category_id] || 0) + e.amount;
  });

  return (
    <div className="dashboard-summary">
      <h2>Spending Summary ({currentMonth})</h2>
      <div className="dashboard-total">Total Spent: <strong>${totalSpent.toFixed(2)}</strong></div>
      <div className="dashboard-categories">
        {categories.map(cat => {
          const spent = categoryTotals[cat.id] || 0;
          const budget = budgets.find(b => b.category_id === cat.id && b.month === currentMonth);
          const limit = budget?.limit_amount || 0;
          const percent = limit ? Math.min(100, (spent / limit) * 100) : 0;
          let barColor = 'green';
          if (limit && percent >= 100) barColor = 'red';
          else if (limit && percent >= 80) barColor = 'orange';
          return (
            <div key={cat.id} className="dashboard-category-row">
              <span className="cat-name">{cat.name}</span>
              <span className="cat-spent">${spent.toFixed(2)}</span>
              {limit > 0 && (
                <span className="cat-budget">/ ${limit.toFixed(2)}</span>
              )}
              <div className="cat-bar-container">
                <div className="cat-bar-bg">
                  <div
                    className="cat-bar"
                    style={{ width: `${percent}%`, background: barColor, height: 8 }}
                  />
                </div>
                {limit > 0 && (
                  <span className="cat-percent">{percent.toFixed(0)}%</span>
                )}
                {limit > 0 && percent >= 80 && (
                  <span className="cat-warning" style={{ color: barColor, marginLeft: 8 }}>
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