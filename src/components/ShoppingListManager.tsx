import React from 'react';

const ShoppingListManager: React.FC = () => {
  return (
    <div style={{ maxWidth: 600, margin: '40px auto', background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px 0 rgba(60,72,88,0.10)', padding: '2rem 1.5rem', textAlign: 'center' }}>
      <h2 style={{ fontWeight: 700, color: '#2d3748', marginBottom: 16 }}>Shopping Lists</h2>
      <div style={{ color: '#64748b', fontSize: 17, marginTop: 12 }}>
        Multi-list shopping support coming soon.
      </div>
    </div>
  );
};

export default ShoppingListManager; 