import React, { useState } from 'react';
import { useHousehold } from '../contexts/HouseholdContext';
import { useAuth } from '../contexts/AuthContext';

const HouseholdOnboarding: React.FC = () => {
  const { household, createHousehold, joinHousehold, loading, error } = useHousehold();
  const { user } = useAuth();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  if (!user) return null;
  if (household) return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(120deg, #f8fafc 0%, #e3e7ed 100%)',
    }}>
      <div style={{
        background: '#fff',
        padding: '2.5rem 2rem',
        borderRadius: 12,
        boxShadow: '0 4px 24px 0 rgba(60,72,88,0.10)',
        minWidth: 340,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
      }}>
        <h2 style={{ textAlign: 'center', margin: 0, fontWeight: 700, color: '#2d3748' }}>
          Welcome to {household.name}!
        </h2>
        <p style={{ textAlign: 'center', color: '#475569', fontSize: 16, margin: 0 }}>
          Share this invite code with your partner:
        </p>
        <div style={{
          background: '#f1f5f9',
          color: '#334155',
          borderRadius: 8,
          padding: '10px 18px',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 1.5,
          marginTop: 8,
        }}>{household.id}</div>
      </div>
    </div>
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createHousehold(name);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    await joinHousehold(inviteCode);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(120deg, #f8fafc 0%, #e3e7ed 100%)',
    }}>
      <div style={{
        background: '#fff',
        padding: '2.5rem 2rem',
        borderRadius: 12,
        boxShadow: '0 4px 24px 0 rgba(60,72,88,0.10)',
        minWidth: 340,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
          <button
            onClick={() => setMode('create')}
            disabled={mode === 'create'}
            style={{
              background: mode === 'create' ? 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)' : '#f1f5f9',
              color: mode === 'create' ? '#fff' : '#334155',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontWeight: 600,
              fontSize: 15,
              cursor: mode === 'create' ? 'default' : 'pointer',
              boxShadow: mode === 'create' ? '0 2px 8px 0 rgba(60,72,88,0.08)' : 'none',
              transition: 'background 0.2s',
            }}
          >Create Household</button>
          <button
            onClick={() => setMode('join')}
            disabled={mode === 'join'}
            style={{
              background: mode === 'join' ? 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)' : '#f1f5f9',
              color: mode === 'join' ? '#fff' : '#334155',
              border: 'none',
              borderRadius: 6,
              padding: '8px 18px',
              fontWeight: 600,
              fontSize: 15,
              cursor: mode === 'join' ? 'default' : 'pointer',
              boxShadow: mode === 'join' ? '0 2px 8px 0 rgba(60,72,88,0.08)' : 'none',
              transition: 'background 0.2s',
            }}
          >Join Household</button>
        </div>
        {mode === 'create' ? (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ textAlign: 'center', margin: 0, fontWeight: 700, color: '#2d3748' }}>Create a New Household</h2>
            <input
              type="text"
              placeholder="Household Name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 16,
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '12px 0',
                fontWeight: 600,
                fontSize: 16,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 8,
                boxShadow: '0 2px 8px 0 rgba(60,72,88,0.08)',
                transition: 'background 0.2s',
              }}
            >Create</button>
          </form>
        ) : (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ textAlign: 'center', margin: 0, fontWeight: 700, color: '#2d3748' }}>Join an Existing Household</h2>
            <input
              type="text"
              placeholder="Invite Code"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              required
              style={{
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                fontSize: 16,
              }}
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'linear-gradient(90deg, #6366f1 0%, #60a5fa 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '12px 0',
                fontWeight: 600,
                fontSize: 16,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 8,
                boxShadow: '0 2px 8px 0 rgba(60,72,88,0.08)',
                transition: 'background 0.2s',
              }}
            >Join</button>
          </form>
        )}
        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#b91c1c',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 15,
            textAlign: 'center',
            marginTop: 4,
            fontWeight: 500,
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default HouseholdOnboarding; 